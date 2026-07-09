// Resource management - inventory tracking with shift-based access control
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiPost, apiGet } from '../../api';
import {
  Package, Pen, AlertTriangle, MinusCircle, Clock, Search, Plus,
  Download, Trash2, X, Check, AlertCircle,
  PackageX, PackageCheck, PackageMinus, Eye
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useShift } from '../../hooks/useShift';
import { Resource } from '../../types';
import { gregorianToEthiopian, formatEthiopianDate } from '../../utils/ethiopianCalendar';
import ExcelJS from 'exceljs';

function ResourceManagement() {
  const { user, activeOperator } = useAuth();
  const { activeSession, shift: currentGlobalShift } = useShift();
  const [resources, setResources] = useState<Resource[]>([]);
  const [deptFilter, setDeptFilter] = useState<string>('');
  const [userFilter, setUserFilter] = useState<string>('');
  const [reports, setReports] = useState<any[]>([]);
  const [editingQuantityId, setEditingQuantityId] = useState<string | number | null>(null);
  const [editingQuantityValue, setEditingQuantityValue] = useState<string>('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [activeStaffList, setActiveStaffList] = useState<any[]>([]);
  const [selectedReporterId, setSelectedReporterId] = useState<string>('');
  const [newResource, setNewResource] = useState({
    name: '', type: 'Drug', quantity: '', standardQuantity: '',
    unit: '', expiredDate: '', batchNumber: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editResourceId, setEditResourceId] = useState<string | number | null>(null);

  /* ─── Permissions ────────────────────────────────── */
  const isAdmin = user?.role === 'admin';
  const isCheckedIn = !!activeSession;
  const hasCheckedInStaff = activeStaffList.length > 0;
  const canEdit = isAdmin || hasCheckedInStaff; // admin or ANY staff checked in

  /* ─── Fetch data ─────────────────────────────────── */
  useEffect(() => {
    fetch('/api/resources').then(r => r.ok ? r.json() : []).then(d => setResources(Array.isArray(d) ? d : [])).catch(() => setResources([]));
  }, []);

  useEffect(() => {
    const url = deptFilter ? `/inventory-reports?department=${encodeURIComponent(deptFilter)}` : '/inventory-reports';
    apiGet(url).then(d => setReports(Array.isArray(d) ? d : [])).catch(() => setReports([]));
  }, [deptFilter]);

  useEffect(() => {
    if (user?.department) {
      apiGet(`/shifts/active-staff/${encodeURIComponent(user.department)}`)
        .then(data => {
          const checkedIn = data.filter((s: any) => s.session_id);
          setActiveStaffList(checkedIn);
          if (checkedIn.length > 0 && !selectedReporterId) setSelectedReporterId(checkedIn[0].id.toString());
          else if (checkedIn.length === 0) setSelectedReporterId('');
        })
        .catch(() => {});
    }
  }, [user, activeSession]);

  useEffect(() => {
    const onSaved = () => {
      const url = deptFilter ? `/inventory-reports?department=${encodeURIComponent(deptFilter)}` : '/inventory-reports';
      apiGet(url).then(d => setReports(Array.isArray(d) ? d : [])).catch(() => {});
    };
    window.addEventListener('inventory_report_saved', onSaved);
    return () => window.removeEventListener('inventory_report_saved', onSaved);
  }, [deptFilter]);

  /* ─── Status helpers ─────────────────────────────── */
  const now = new Date();
  const getResourceStatus = (r: Resource) => {
    const q = Number(r.quantity);
    const s = Number(r.standard_quantity as any);
    const exp = new Date(r.expiry_date as any);
    const hasStock = !isNaN(q) && q > 0;
    const isLow = !isNaN(q) && q <= 0 || (!isNaN(q) && !isNaN(s) && s > 0 && q > 0 && q < 2 && s >= 2);
    let isExpired = false;
    let isNearExpiry = false;
    if (r.type === 'Drug' && r.expiry_date && !isNaN(exp.getTime())) {
      const diffDays = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
      isExpired = hasStock && exp < now;
      isNearExpiry = hasStock && !isExpired && diffDays >= 0 && diffDays <= 30;
    }
    if (isExpired) return 'expired' as const;
    if (isNearExpiry) return 'near-expiry' as const;
    if (isLow) return 'low-stock' as const;
    return 'ok' as const;
  };

  /* ─── Department scope ───────────────────────────── */
  const targetDepartment = isAdmin ? deptFilter : (user?.department || '');
  const liveDeptScoped = resources.filter(r =>
    isAdmin ? (!targetDepartment || r.department === targetDepartment) : r.department === user?.department
  );

  const applyFilters = (list: Resource[]) => list.filter(r => {
    const matchType = filterType === 'All' || r.type === filterType;
    const matchStatus = filterStatus === 'All' || getResourceStatus(r) === filterStatus.toLowerCase().replace(' ', '-');
    const q = search.toLowerCase();
    const matchSearch = !q || r.name?.toLowerCase().includes(q) || r.unit?.toLowerCase().includes(q) || r.batch_number?.toLowerCase().includes(q);
    return matchType && matchStatus && matchSearch;
  });

  const latestReportForUser = useMemo(() => {
    const dept = targetDepartment || user?.department || '';
    const candidates = reports.filter((r: any) => (!dept || r.department === dept) && r.staffName?.toLowerCase() === userFilter.toLowerCase());
    if (!candidates.length) return null;
    candidates.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return candidates[0];
  }, [reports, userFilter, targetDepartment, user]);

  const reportResources = latestReportForUser?.resources || [];
  const filteredResources = applyFilters(userFilter ? reportResources : liveDeptScoped);

  /* ─── Stats ──────────────────────────────────────── */
  const stats = useMemo(() => {
    const list = userFilter ? reportResources : liveDeptScoped;
    return {
      total: list.length,
      ok: list.filter(r => getResourceStatus(r) === 'ok').length,
      lowStock: list.filter(r => getResourceStatus(r) === 'low-stock').length,
      nearExpiry: list.filter(r => getResourceStatus(r) === 'near-expiry').length,
      expired: list.filter(r => getResourceStatus(r) === 'expired').length,
    };
  }, [liveDeptScoped, reportResources, userFilter]);

  /* ─── CRUD handlers ──────────────────────────────── */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setNewResource(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const openEditModal = (resource: Resource) => {
    setEditMode(true);
    setEditResourceId(resource.id);
    setNewResource({
      name: resource.name || '', type: resource.type || 'Drug',
      quantity: resource.quantity?.toString() || '', standardQuantity: resource.standard_quantity?.toString() || '',
      unit: resource.unit || '', expiredDate: resource.expiry_date || '', batchNumber: resource.batch_number || ''
    });
    setShowModal(true);
  };

  const handleAddOrEditResource = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      if (!newResource.name.trim() || !newResource.type.trim() || !newResource.quantity.toString().trim() ||
          !newResource.standardQuantity.toString().trim() || !newResource.unit.trim() ||
          (newResource.type === 'Drug' && (!newResource.expiredDate.trim() || !newResource.batchNumber.trim()))) {
        setError('All fields are required.'); setLoading(false); return;
      }
      const body: any = {
        name: newResource.name, type: newResource.type,
        quantity: Number(newResource.quantity), standard_quantity: Number(newResource.standardQuantity),
        unit: newResource.unit, department: user?.department,
        last_updated_by: activeOperator?.username || user?.username,
        last_updated_by_name: activeOperator?.name || user?.name,
        shift_session_id: activeSession?.id || null,
        last_updated_by_id: activeOperator?.id || user?.id || null,
      };
      if (newResource.type === 'Drug') { body.expiry_date = newResource.expiredDate; body.batch_number = newResource.batchNumber; }

      const method = editMode && editResourceId ? 'PUT' : 'POST';
      const url = editMode && editResourceId ? `/api/resources/${editResourceId}` : '/api/resources';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`Failed to ${editMode ? 'update' : 'add'} resource`);

      const fresh = await fetch('/api/resources');
      if (fresh.ok) setResources(await fresh.json());
      setNewResource({ name: '', type: 'Drug', quantity: '', standardQuantity: '', unit: '', expiredDate: '', batchNumber: '' });
      setShowModal(false); setEditMode(false); setEditResourceId(null);
    } catch (err: any) { setError(err.message || 'Error saving resource'); }
    finally { setLoading(false); }
  };

  const handleQuantityEdit = (r: Resource) => { setEditingQuantityId(r.id); setEditingQuantityValue(r.quantity.toString()); };

  const handleQuantitySave = async (r: Resource) => {
    const n = Number(editingQuantityValue);
    if (isNaN(n) || n < 0) return;
    try {
      const body = { ...r, quantity: n, last_updated_by: activeOperator?.username || user?.username, last_updated_by_name: activeOperator?.name || user?.name, shift_session_id: activeSession?.id || null, last_updated_by_id: activeOperator?.id || user?.id || null };
      const res = await fetch(`/api/resources/${r.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('Failed to update quantity');
      const updated = await res.json();
      setResources(prev => prev.map(x => x.id === r.id ? updated : x));
      setEditingQuantityId(null);
    } catch (err: any) { setError(err.message); }
  };

  const handleDelete = async (id: string | number) => {
    if (!window.confirm('Delete this resource?')) return;
    try {
      const res = await fetch(`/api/resources/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setResources(prev => prev.filter(r => r.id !== id));
    } catch (err: any) { setError(err.message); }
  };

  /* ─── Excel export ───────────────────────────────── */
  const handleExport = useCallback(async () => {
    if (!filteredResources.length) return;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ISBAR-CSMS'; wb.created = new Date();
    const ws = wb.addWorksheet('Inventory', { views: [{ state: 'frozen', ySplit: 2 }], properties: { defaultColWidth: 14 } });

    const GREEN = 'FF09B8A0'; const GREEN_DARK = 'FF067D6A'; const GRAY_BG = 'FFF9FAFB'; const WHITE = 'FFFFFFFF';
    const hdrStyle: Partial<ExcelJS.Style> = {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } },
      font: { bold: true, color: { argb: WHITE }, size: 10, name: 'Calibri' },
      alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
      border: { top: { style: 'thin', color: { argb: GREEN_DARK } }, bottom: { style: 'medium', color: { argb: GREEN_DARK } }, left: { style: 'thin', color: { argb: GREEN_DARK } }, right: { style: 'thin', color: { argb: GREEN_DARK } } },
    };
    const bdr = { style: 'thin' as const, color: { argb: 'FFE5E7EB' } };
    const bdrAll = { top: bdr, bottom: bdr, left: bdr, right: bdr };
    const dept = targetDepartment || user?.department || 'All';
    const title = ws.addRow([`Inventory — ${dept} — ${filteredResources.length} items — ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`]);
    ws.mergeCells(title.number, 1, title.number, 10);
    title.height = 32; title.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1F2937' } };
    title.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    title.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } };

    const hdr = ws.addRow(['#', 'Name', 'Type', 'Qty', 'Standard', 'Unit', 'Expiry', 'Batch', 'Status', 'Updated By']);
    hdr.height = 28; hdr.eachCell(c => { Object.assign(c, hdrStyle); c.border = bdrAll; });

    filteredResources.forEach((r, i) => {
      const st = getResourceStatus(r);
      const exp = r.expiry_date ? new Date(r.expiry_date) : null;
      let expStr = '-';
      if (exp && !isNaN(exp.getTime())) { const eth = gregorianToEthiopian(exp); expStr = formatEthiopianDate(eth, 'amharic'); }
      const updatedBy = userFilter && latestReportForUser ? latestReportForUser.staffName : (r.last_updated_by_name || r.last_updated_by || '-');
      const row = [i + 1, r.name, r.type, Number(r.quantity), Number(r.standard_quantity as any) || 0, r.unit, expStr, r.batch_number || '-', st.replace('-', ' ').toUpperCase(), updatedBy];
      const rowObj = ws.addRow(row);
      rowObj.eachCell(c => { c.border = bdrAll; c.alignment = { vertical: 'middle', wrapText: true }; });
      if (i % 2 === 0) rowObj.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_BG } }; });
      const stCell = rowObj.getCell(9);
      if (st === 'expired') stCell.font = { color: { argb: 'FFDC2626' }, bold: true };
      else if (st === 'low-stock') stCell.font = { color: { argb: 'FFEA580C' }, bold: true };
      else if (st === 'near-expiry') stCell.font = { color: { argb: 'FFD97706' }, bold: true };
      else stCell.font = { color: { argb: 'FF16A34A' }, bold: true };
    });
    ws.columns.forEach((c, i) => { c.width = [4, 24, 12, 8, 10, 10, 14, 14, 14, 18][i] || 14; });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `inventory_${targetDepartment || 'all'}.xlsx`; a.click();
    URL.revokeObjectURL(url);
  }, [filteredResources, targetDepartment, user]);

  /* ─── Status badge config ────────────────────────── */
  const statusConfig: Record<string, { bg: string; text: string; icon: any; label: string }> = {
    ok: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: PackageCheck, label: 'OK' },
    'low-stock': { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', icon: PackageMinus, label: 'Low Stock' },
    'near-expiry': { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: AlertCircle, label: 'Near Expiry' },
    expired: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', icon: PackageX, label: 'Expired' },
  };

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Inventory</h2>
          <p className="text-sm text-gray-400 mt-1">
            {isAdmin ? (targetDepartment || 'All departments') : user?.department} · {resources.length} items
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} disabled={!filteredResources.length}
            className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-600 disabled:opacity-40 inline-flex items-center gap-1.5 transition-colors">
            <Download className="w-4 h-4" />Export
          </button>
          {canEdit && (
            <button onClick={() => { setShowModal(true); setEditMode(false); setEditResourceId(null); setNewResource({ name: '', type: 'Drug', quantity: '', standardQuantity: '', unit: '', expiredDate: '', batchNumber: '' }); }}
              className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-600 inline-flex items-center gap-1.5 transition-colors">
              <Plus className="w-4 h-4" />Add Resource
            </button>
          )}
        </div>
      </div>

      {/* ── Reporting Section ────────────────────────── */}
      <div className="bg-gradient-to-r from-brand/5 via-white to-brand/5 rounded-2xl border border-brand/10 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-brand/10 rounded-xl shrink-0">
              <Clock className="w-5 h-5 text-brand" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              {hasCheckedInStaff && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Reporter</span>
                    <select value={selectedReporterId} onChange={e => setSelectedReporterId(e.target.value)}
                      className="text-sm font-bold text-gray-900 bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand cursor-pointer min-w-[200px]">
                      {activeStaffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </>
              )}
              {!hasCheckedInStaff && (
                <span className="inline-flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-amber-200 w-fit">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  No staff on duty
                </span>
              )}
            </div>
          </div>

          <button disabled={!hasCheckedInStaff || !resources.length}
            onClick={async () => {
              if (!resources.length) { alert('No resources to save.'); return; }
              const deptResources = resources.filter(r => r.department === user?.department);
              const staff = activeStaffList.find(s => s.id.toString() === selectedReporterId);
              const report = {
                shift: currentGlobalShift || 'General', shift_session_id: activeSession?.id || null,
                staffName: staff?.name || user?.name, staffId: staff?.id || user?.id,
                department: user?.department || '', date: new Date().toISOString(),
                resources: deptResources.map(r => ({ ...r })),
              };
              try {
                await apiPost('/inventory-reports', report);
                window.dispatchEvent(new CustomEvent('inventory_report_saved', { detail: { shift: report.shift, date: report.date, department: report.department, staffName: report.staffName } }));
                alert('Inventory report saved successfully!');
              } catch (err: any) { alert('Failed: ' + (err?.message || err)); }
            }}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-2 transition-all shadow-md shrink-0 ${
              hasCheckedInStaff && resources.length
                ? 'bg-brand text-white hover:bg-brand-600 hover:shadow-lg active:scale-95'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-60'
            }`}>
            <Package className="w-4 h-4" />
            {!hasCheckedInStaff ? 'Waiting for staff check-in' : 'Save Inventory Report'}
          </button>
        </div>
        {!hasCheckedInStaff && (
          <p className="text-[11px] text-amber-600 mt-3 ml-12">
            Staff must check in from the dashboard before inventory can be edited and reports saved.
          </p>
        )}
      </div>

      {/* ── Stat Cards ──────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Items', value: stats.total, icon: Package, bg: 'bg-indigo-50', color: 'text-indigo-600' },
          { label: 'OK', value: stats.ok, icon: PackageCheck, bg: 'bg-emerald-50', color: 'text-emerald-600' },
          { label: 'Low Stock', value: stats.lowStock, icon: PackageMinus, bg: 'bg-orange-50', color: 'text-orange-600' },
          { label: 'Near Expiry', value: stats.nearExpiry, icon: AlertCircle, bg: 'bg-amber-50', color: 'text-amber-600' },
          { label: 'Expired', value: stats.expired, icon: PackageX, bg: 'bg-red-50', color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{s.label}</span>
              <div className={`p-1.5 rounded-lg ${s.bg}`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
            </div>
            <p className="text-2xl font-extrabold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-lg hover:shadow-gray-100/60 transition-shadow">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search by name, unit, or batch..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all" />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:ring-2 focus:ring-brand/20 focus:border-brand">
            <option value="All">All Types</option>
            <option value="Drug">Drug</option>
            <option value="Equipment">Equipment</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:ring-2 focus:ring-brand/20 focus:border-brand">
            <option value="All">All Status</option>
            <option value="OK">OK</option>
            <option value="Low Stock">Low Stock</option>
            <option value="Near Expiry">Near Expiry</option>
            <option value="Expired">Expired</option>
          </select>
          {isAdmin && (
            <>
              <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:ring-2 focus:ring-brand/20 focus:border-brand min-w-[140px]">
                <option value="">All Depts</option>
                {Array.from(new Set(resources.map(r => r.department).filter(Boolean))).map(d => (
                  <option key={d} value={String(d)}>{String(d)}</option>
                ))}
              </select>
              <select value={userFilter} onChange={e => setUserFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:ring-2 focus:ring-brand/20 focus:border-brand min-w-[140px]">
                <option value="">Live Inventory</option>
                {Array.from(new Set(reports.map(r => r.staffName).filter(Boolean))).map(n => (
                  <option key={n} value={String(n)}>{String(n)}</option>
                ))}
              </select>
            </>
          )}
          {(search || filterType !== 'All' || filterStatus !== 'All' || deptFilter || userFilter) && (
            <button onClick={() => { setSearch(''); setFilterType('All'); setFilterStatus('All'); setDeptFilter(''); setUserFilter(''); }}
              className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 font-medium">
              Clear
            </button>
          )}
        </div>
        {userFilter && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Viewing saved report for <strong>{userFilter}</strong>{targetDepartment ? ` in ${targetDepartment}` : ''}
          </div>
        )}
      </div>

      {/* ── Resource Table ───────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:shadow-gray-100/60 transition-shadow">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Current Inventory</h3>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg font-medium">{filteredResources.length} items</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/80">
                {['Resource', 'Type', 'Qty', 'Standard', 'Unit', 'Expiry', 'Batch', 'Status', 'Reported By', ...(canEdit ? ['Actions'] : [])].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredResources.map((resource) => {
                const st = getResourceStatus(resource);
                const cfg = statusConfig[st];
                const StatusIcon = cfg.icon;
                const exp = resource.expiry_date ? new Date(resource.expiry_date) : null;
                const diffDays = exp && !isNaN(exp.getTime()) ? Math.ceil((exp.getTime() - now.getTime()) / 86400000) : null;
                return (
                  <tr key={resource.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${cfg.bg}`}>
                          <Package className={`w-4 h-4 ${cfg.text}`} />
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{resource.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold ${resource.type === 'Drug' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-purple-50 text-purple-700 border border-purple-200'}`}>
                        {resource.type}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {canEdit && editingQuantityId === resource.id ? (
                        <div className="flex items-center gap-1">
                          <input type="number" value={editingQuantityValue} min="0" onChange={e => setEditingQuantityValue(e.target.value)}
                            className="w-16 px-2 py-1 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand" autoFocus />
                          <button onClick={() => handleQuantitySave(resource)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditingQuantityId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-semibold ${st === 'low-stock' || st === 'expired' ? 'text-red-600' : 'text-gray-900'}`}>
                            {Number(resource.quantity) || 0}
                          </span>
                          {canEdit && (
                            <button onClick={() => handleQuantityEdit(resource)} className="p-1 text-gray-300 hover:text-brand transition-colors"><Pen className="w-3 h-3" /></button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500">{Number(resource.standard_quantity as any) || 0}</td>
                    <td className="px-5 py-3 text-sm text-gray-500">{resource.unit}</td>
                    <td className="px-5 py-3">
                      {exp && !isNaN(exp.getTime()) ? (
                        <div className="text-sm">
                          <div className={diffDays !== null && diffDays <= 30 ? 'text-amber-600 font-semibold' : 'text-gray-900'}>
                            {(() => { const eth = gregorianToEthiopian(exp); return formatEthiopianDate(eth, 'amharic'); })()}
                          </div>
                          {diffDays !== null && diffDays <= 30 && (
                            <div className="text-[10px] text-amber-500 mt-0.5 font-medium">
                              {diffDays < 0 ? `Expired ${Math.abs(diffDays)}d ago` : `${diffDays}d left`}
                            </div>
                          )}
                        </div>
                      ) : <span className="text-gray-300 text-sm">-</span>}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500 font-mono">{resource.batch_number || '-'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${cfg.bg} ${cfg.text}`}>
                        <StatusIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-semibold text-gray-700">
                        {userFilter && latestReportForUser ? latestReportForUser.staffName : (resource.last_updated_by_name || resource.last_updated_by || '-')}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditModal(resource)} className="p-1.5 text-gray-400 hover:text-brand hover:bg-brand/5 rounded-lg transition-colors" title="Edit">
                            <Pen className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(resource.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredResources.length === 0 && (
          <div className="text-center py-16">
            <div className="p-4 bg-gray-100 rounded-2xl inline-block mb-3"><Package className="w-10 h-10 text-gray-300" /></div>
            <p className="text-sm font-medium text-gray-900">No resources found</p>
            <p className="text-xs text-gray-400 mt-1">{canEdit ? 'Add a new resource to get started' : 'Adjust filters to see inventory data'}</p>
          </div>
        )}
      </div>

      {/* ── Add/Edit Modal ───────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">{editMode ? 'Edit Resource' : 'Add New Resource'}</h3>
              <button onClick={() => { setShowModal(false); setEditMode(false); setEditResourceId(null); }}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddOrEditResource} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: 'Name', name: 'name', type: 'text', placeholder: 'Resource name', span: 2 },
                  { label: 'Type', name: 'type', type: 'select', options: [{ v: 'Drug', l: 'Drug' }, { v: 'Equipment', l: 'Equipment' }] },
                  { label: 'Quantity', name: 'quantity', type: 'number', min: 0 },
                  { label: 'Standard Quantity', name: 'standardQuantity', type: 'number', min: 0 },
                  { label: 'Unit', name: 'unit', type: 'select', options: [{ v: '', l: 'Select' }, { v: 'Vial', l: 'Vial' }, { v: 'Ampule', l: 'Ampule' }, { v: 'Number', l: 'Number' }, { v: 'Box', l: 'Box' }, { v: 'Strip', l: 'Strip' }] },
                ].map(f => (
                  <div key={f.name} className={`flex flex-col ${f.span === 2 ? 'md:col-span-2' : ''}`}>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">{f.label}</label>
                    {f.type === 'select' ? (
                      <select name={f.name} value={(newResource as any)[f.name]} onChange={handleInputChange}
                        className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:ring-2 focus:ring-brand/20 focus:border-brand">
                        {f.options!.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                    ) : (
                      <input type={f.type} name={f.name} value={(newResource as any)[f.name]} onChange={handleInputChange}
                        placeholder={(f as any).placeholder} min={(f as any).min}
                        className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:ring-2 focus:ring-brand/20 focus:border-brand" />
                    )}
                  </div>
                ))}
                {newResource.type === 'Drug' && (
                  <>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Expiry Date</label>
                      <input type="date" name="expiredDate" value={newResource.expiredDate} onChange={handleInputChange}
                        className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:ring-2 focus:ring-brand/20 focus:border-brand" />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Batch Number</label>
                      <input type="text" name="batchNumber" value={newResource.batchNumber} onChange={handleInputChange}
                        placeholder="e.g. BT-2026-001"
                        className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:ring-2 focus:ring-brand/20 focus:border-brand" />
                    </div>
                  </>
                )}
              </div>
              {error && (
                <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 shrink-0" />{error}
                </div>
              )}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => { setShowModal(false); setEditMode(false); setEditResourceId(null); }}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-bold hover:bg-brand-600 disabled:opacity-40 inline-flex items-center gap-2 transition-colors shadow-md hover:shadow-lg active:scale-95">
                  {loading ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{editMode ? 'Saving...' : 'Adding...'}</>
                  ) : (
                    <>{editMode ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{editMode ? 'Save Changes' : 'Add Resource'}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ResourceManagement;

// Resource management - inventory tracking with stock levels and reporting
import React, { useState, useEffect } from 'react';
import { apiPost, apiGet } from '../../api';
import { Package, Pen, Flag, AlertTriangle, MinusCircle, Clock, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useShift } from '../../hooks/useShift';
import { Resource } from '../../types';
import { EthiopianDateDisplay } from '../../components/shared/date/EthiopianDateDisplay';
// import { Layout } from './Layout';
function ResourceManagement() {
  const { user, activeOperator } = useAuth();
  const { activeSession, shift: currentGlobalShift } = useShift();
  const [resources, setResources] = useState<Resource[]>([]);
  // (removed duplicate filteredResources, see below for correct version)
  // Admin-only filters for viewing inventory
  const [deptFilter, setDeptFilter] = useState<string>('');
  const [userFilter, setUserFilter] = useState<string>('');
  const [selectedShift, setSelectedShift] = useState('Morning');
  const [reports, setReports] = useState<any[]>([]);
  const [editingQuantityId, setEditingQuantityId] = useState<string | number | null>(null);
  const [editingQuantityValue, setEditingQuantityValue] = useState<string>('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');
  
  const [activeStaffList, setActiveStaffList] = useState<any[]>([]);
  const [selectedReporterId, setSelectedReporterId] = useState<string>('');
  // const [currentPage, setCurrentPage] = useState('resources');
  const [newResource, setNewResource] = useState({
    name: '',
    type: 'Drug',
    quantity: '',
    standardQuantity: '',
    unit: '',
    expiredDate: '',
    batchNumber: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editResourceId, setEditResourceId] = useState<string | number | null>(null);

  useEffect(() => {
    const fetchResources = async () => {
      try {
        const res = await fetch('/api/resources'); // Keep raw fetch or use apiGet
        if (!res.ok) throw new Error('Failed to fetch resources');
        const data = await res.json();
        setResources(data);
      } catch (err) {
        setResources([]);
      }
    };
    fetchResources();
  }, []);

  // Fetch inventory reports (for viewing snapshots per user/department)
  useEffect(() => {
    const fetchReports = async () => {
      try {
        const url = deptFilter ? `/inventory-reports?department=${encodeURIComponent(deptFilter)}` : '/inventory-reports';
        const data = await apiGet(url);
        setReports(Array.isArray(data) ? data : []);
      } catch (e) {
        setReports([]);
      }
    };
    fetchReports();
  }, [deptFilter]);

  // Fetch active staff for this department (to choose who is reporting)
  useEffect(() => {
    if (user?.department && user.role !== 'admin') {
      apiGet(`/shifts/active-staff/${encodeURIComponent(user.department)}`)
        .then(data => {
            const onlineStaff = data.filter((s: any) => s.session_id);
            setActiveStaffList(onlineStaff);
            if (onlineStaff.length > 0 && !selectedReporterId) {
                setSelectedReporterId(onlineStaff[0].id.toString());
            }
        })
        .catch(err => console.error("Failed to fetch active staff", err));
    }
  }, [user, activeSession]);

  // Refresh reports when saved elsewhere
  useEffect(() => {
    const onSaved = () => {
      (async () => {
        try {
          const url = deptFilter ? `/inventory-reports?department=${encodeURIComponent(deptFilter)}` : '/inventory-reports';
          const data = await apiGet(url);
          setReports(Array.isArray(data) ? data : []);
        } catch { }
      })();
    };
    window.addEventListener('inventory_report_saved', onSaved);
    return () => window.removeEventListener('inventory_report_saved', onSaved);
  }, [deptFilter]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewResource((prev) => ({ ...prev, [name]: value }));
  };

  const openEditModal = (resource: any) => {
    setEditMode(true);
    setEditResourceId(resource.id);
    setNewResource({
      name: resource.name || '',
      type: resource.type || 'Drug',
      quantity: resource.quantity?.toString() || '',
      standardQuantity: resource.standard_quantity?.toString() || '',
      unit: resource.unit || '',
      expiredDate: resource.expiry_date || '',
      batchNumber: resource.batch_number || ''
    });
    setShowModal(true);
  };

  const handleAddOrEditResource = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Validation: all fields required for both Drug and Equipment
      if (!newResource.name.trim() ||
        !newResource.type.trim() ||
        !newResource.quantity.toString().trim() ||
        !newResource.standardQuantity.toString().trim() ||
        !newResource.unit.trim() ||
        (newResource.type === 'Drug' && (!newResource.expiredDate.trim() || !newResource.batchNumber.trim()))
      ) {
        setError('All fields are required.');
        setLoading(false);
        return;
      }
      // Build body object, only including Drug fields if type is Drug
      const body: any = {
        name: newResource.name,
        type: newResource.type,
        quantity: Number(newResource.quantity),
        standard_quantity: Number(newResource.standardQuantity),
        unit: newResource.unit,
        department: user?.department, // Add department from logged-in user
        last_updated_by: activeOperator?.username || user?.username,
        last_updated_by_name: activeOperator?.name || user?.name,
        shift_session_id: activeSession?.id || null,
        last_updated_by_id: activeOperator?.id || user?.id || null
      };
      if (newResource.type === 'Drug') {
        body.expiry_date = newResource.expiredDate;
        body.batch_number = newResource.batchNumber;
      }
      let res: Response;
      let updated: Resource;
      if (editMode && editResourceId) {
        res = await fetch(`/api/resources/${editResourceId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error('Failed to update resource: ' + errText);
        }
        updated = await res.json();
        setResources((prev) => prev.map(r => r.id === editResourceId ? updated : r));
        // Refetch to ensure full consistency with DB
        try {
          const fres = await fetch('/api/resources');
          if (fres.ok) {
            const list = await fres.json();
            setResources(list);
          }
        } catch { }
      } else {
        res = await fetch('/api/resources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error('Failed to add resource: ' + errText);
        }
        updated = await res.json();
        setResources((prev) => [...prev, updated]);
        // Refetch to ensure full consistency with DB
        try {
          const fres = await fetch('/api/resources');
          if (fres.ok) {
            const list = await fres.json();
            setResources(list);
          }
        } catch { }
      }
      setNewResource({ name: '', type: 'Drug', quantity: '', standardQuantity: '', unit: '', expiredDate: '', batchNumber: '' });
      setShowModal(false);
      setEditMode(false);
      setEditResourceId(null);
    } catch (err: any) {
      setError(err.message || 'Error saving resource');
    } finally {
      setLoading(false);
    }
  };

  // Determine target department context
  const targetDepartment = user?.role === 'admin' ? (deptFilter || '') : (user?.department || '');

  // Live resources filtered by department (admins can choose dept, others are fixed)
  const liveDeptScoped = resources.filter(r =>
    user?.role === 'admin' ? (!targetDepartment || r.department === targetDepartment) : r.department === user?.department
  );

  // Helper to apply search/type filters to a given list
  const applySearchAndType = (list: Resource[]) => {
    return list.filter(resource => {
      const matchesType = filterType === 'All' || resource.type === filterType;
      const searchLower = search.toLowerCase();
      const matchesSearch =
        resource.name?.toLowerCase().includes(searchLower) ||
        resource.unit?.toLowerCase().includes(searchLower) ||
        (resource.batch_number ? resource.batch_number.toLowerCase().includes(searchLower) : false);
      return matchesType && matchesSearch;
    });
  };

  // If a user is selected for viewing, show the latest report snapshot for that user and department
  const latestReportForUser = (() => {
    const dept = targetDepartment || user?.department || '';
    const candidates = (reports || []).filter((r: any) => (
      (!dept || r.department === dept) && (String(r.staffName || '').toLowerCase() === String(userFilter).toLowerCase())
    ));
    if (candidates.length === 0) return null;
    // newest by date
    candidates.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return candidates[0];
  })();

  const reportResourcesRaw: Resource[] = latestReportForUser?.resources || [];
  const filteredReportResources = applySearchAndType(reportResourcesRaw as any);
  const filteredLiveResources = applySearchAndType(liveDeptScoped);
  const filteredResources = userFilter ? filteredReportResources : filteredLiveResources;

  // Inline quantity save handler
  const handleQuantityEdit = (resource: Resource) => {
    setEditingQuantityId(resource.id);
    setEditingQuantityValue(resource.quantity.toString());
  };

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingQuantityValue(e.target.value);
  };

  const handleQuantitySave = async (resource: Resource) => {
    const newQuantity = Number(editingQuantityValue);
    if (isNaN(newQuantity) || newQuantity < 0) return;
    try {
      const body = {
        ...resource,
        quantity: newQuantity,
        last_updated_by: activeOperator?.username || user?.username,
        last_updated_by_name: activeOperator?.name || user?.name,
        shift_session_id: activeSession?.id || null,
        last_updated_by_id: activeOperator?.id || user?.id || null
      };
      const res = await fetch(`/api/resources/${resource.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to update quantity');
      const updated = await res.json();
      setResources((prev) => prev.map(r => r.id === resource.id ? updated : r));
      setEditingQuantityId(null);
    } catch (err: any) {
      setError(err.message || 'Error updating quantity');
    }
  };

  return (
    <div>
      <div className="p-6">
        {/* Reporting Mechanism UI (non-admin only) */}
        {user?.role !== 'admin' && (
          <div className="bg-white rounded-xl shadow-sm p-5 mb-6 border border-blue-100 bg-gradient-to-r from-blue-50 to-white">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600 rounded-lg text-white shadow-lg">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 leading-tight">Inventory Reporting</h3>
                  <div className="text-sm text-blue-700 font-medium mt-1">
                    {activeSession ? (
                      <span className="flex items-center gap-1.5 text-green-700"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Linked to your active {activeSession.shift_name} shift</span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-amber-600"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Not checked into any active shift</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-0.5">Reporting As</p>
                  <div className="flex items-center gap-2 justify-end">
                    {activeStaffList.length > 0 ? (
                      <select 
                        className="text-sm font-semibold text-gray-900 bg-transparent border-b border-gray-300 focus:outline-none focus:border-blue-500 pb-0.5 cursor-pointer max-w-[150px] truncate"
                        value={selectedReporterId}
                        onChange={e => setSelectedReporterId(e.target.value)}
                      >
                        {activeStaffList.map(staff => (
                          <option key={staff.id} value={staff.id}>{staff.name}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-sm font-semibold text-red-600 italic">No active staff</p>
                    )}
                    {activeSession && <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-700 font-bold border border-green-200 tracking-wide">ON DUTY</span>}
                  </div>
                </div>
                <button
                  className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${activeStaffList.length > 0 ? 'bg-blue-600 white text-white hover:bg-blue-700 shadow-md hover:shadow-lg active:scale-95' : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-70'}`}
                  disabled={activeStaffList.length === 0}
                  onClick={async () => {
                    if (!resources || resources.length === 0) {
                      alert('No resources to save in the report.');
                      return;
                    }
                    const now = new Date();
                    const deptResources = resources.filter(r => r.department === user?.department);
                    
                    const selectedStaff = activeStaffList.find(s => s.id.toString() === selectedReporterId);
                    const reporterName = selectedStaff ? selectedStaff.name : user?.name;
                    const reporterId = selectedStaff ? selectedStaff.id : user?.id;

                    const report = {
                      shift: currentGlobalShift || 'General',
                      shift_session_id: activeSession?.id || null,
                      staffName: reporterName,
                      staffId: reporterId,
                      department: user?.department || '',
                      date: now.toISOString(),
                      resources: deptResources.map(r => ({ ...r }))
                    };
                    
                    try {
                      await apiPost('/inventory-reports', report);
                      window.dispatchEvent(new CustomEvent('inventory_report_saved', {
                        detail: {
                          shift: report.shift,
                          date: report.date,
                          department: report.department,
                          staffName: user?.name
                        }
                      }));
                      alert('Inventory report saved successfully!');
                    } catch (err: any) {
                      alert('Failed to save report: ' + (err?.message || err));
                    }
                  }}
                  type="button"
                >
                  <Package className="w-5 h-5" />
                  Save Current Inventory Report
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8 w-full">
          {/* Admin Filters for viewing inventory by Department/User */}
          {user?.role === 'admin' && (
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto items-end">
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">Department</label>
                <select
                  value={deptFilter}
                  onChange={e => setDeptFilter(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-gray-50 min-w-[160px]"
                >
                  <option value="">All</option>
                  {Array.from(new Set(resources.map(r => r.department).filter(Boolean))).map(dep => (
                    <option key={String(dep)} value={String(dep)}>{String(dep)}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1">User</label>
                <select
                  value={userFilter}
                  onChange={e => setUserFilter(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-gray-50 min-w-[180px]"
                >
                  <option value="">All Users (Live)</option>
                  {Array.from(new Set(reports.map(r => r.staffName).filter(Boolean))).map(name => (
                    <option key={String(name)} value={String(name)}>{String(name)}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => { setDeptFilter(''); setUserFilter(''); }}
                className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Clear
              </button>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <input
              type="text"
              placeholder="Search by name, unit, or batch..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-gray-50 w-full sm:w-56"
            />
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-gray-50 w-full sm:w-auto"
            >
              <option value="All">All Types</option>
              <option value="Drug">Drug</option>
              <option value="Equipment">Equipment</option>
            </select>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto justify-end">
            <button
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow w-full sm:w-auto"
              onClick={() => {
                setShowModal(true);
                setEditMode(false);
                setEditResourceId(null);
                setNewResource({ name: '', type: 'Drug', quantity: '', standardQuantity: '', unit: '', expiredDate: '', batchNumber: '' });
              }}
            >
              Register New Resource
            </button>
          </div>
        </div>
        {userFilter && (
          <div className="mb-3 px-4 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm">
            Viewing latest saved inventory report for <strong>{userFilter}</strong>{targetDepartment ? ` in ${targetDepartment}` : ''}. Clear the User filter to return to live inventory.
          </div>
        )}
        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-xl relative border border-gray-200">
              <button
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-2xl font-bold"
                onClick={() => {
                  setShowModal(false);
                  setEditMode(false);
                  setEditResourceId(null);
                }}
                aria-label="Close"
              >
                &times;
              </button>
              <h3 className="text-2xl font-bold mb-6 text-gray-900">{editMode ? 'Edit Resource' : 'Register New Resource'}</h3>
              <form className="grid grid-cols-1 md:grid-cols-2 gap-6" onSubmit={handleAddOrEditResource}>
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    name="name"
                    value={newResource.name}
                    onChange={handleInputChange}
                    required
                    className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-gray-50"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    name="type"
                    value={newResource.type}
                    onChange={handleInputChange}
                    className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-gray-50"
                  >
                    <option value="Drug">Drug</option>
                    <option value="Equipment">Equipment</option>
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    name="quantity"
                    value={newResource.quantity}
                    onChange={handleInputChange}
                    required
                    min="0"
                    className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-gray-50"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">Standard Quantity</label>
                  <input
                    type="number"
                    name="standardQuantity"
                    value={newResource.standardQuantity}
                    onChange={handleInputChange}
                    required
                    min="0"
                    className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-gray-50"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    name="unit"
                    value={newResource.unit}
                    onChange={handleInputChange}
                    required
                    className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-gray-50"
                  >
                    <option value="">Select Unit</option>
                    <option value="Vial">Vial</option>
                    <option value="Ampule">Ampule</option>
                    <option value="Number">Number</option>
                    <option value="Box">Box</option>
                    <option value="Strip">Strip</option>
                  </select>
                </div>
                {/* Only show for Drug */}
                {newResource.type === 'Drug' && (
                  <>
                    <div className="flex flex-col">
                      <label className="text-sm font-medium text-gray-700 mb-1">Expired Date (Gregorian)</label>
                      <input
                        type="date"
                        name="expiredDate"
                        value={newResource.expiredDate}
                        onChange={handleInputChange}
                        required
                        className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-gray-50"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-sm font-medium text-gray-700 mb-1">Batch Number</label>
                      <input
                        type="text"
                        name="batchNumber"
                        value={newResource.batchNumber}
                        onChange={handleInputChange}
                        className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-gray-50"
                      />
                    </div>
                  </>
                )}
                <div className="md:col-span-2 flex justify-end items-center gap-4 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditMode(false);
                      setEditResourceId(null);
                    }}
                    className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      loading ||
                      !newResource.name.trim() ||
                      !newResource.type.trim() ||
                      !newResource.quantity.toString().trim() ||
                      !newResource.standardQuantity.toString().trim() ||
                      !newResource.unit.trim() ||
                      (newResource.type === 'Drug' && (!newResource.expiredDate.trim() || !newResource.batchNumber.trim()))
                    }
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {loading ? (editMode ? 'Saving...' : 'Registering...') : (editMode ? 'Save' : 'Register')}
                  </button>
                  {error && <span className="text-red-500 text-sm ml-4">{error}</span>}
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Resource Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Current Inventory</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Standard Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expired Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredResources.map((resource) => (
                  <tr key={resource.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Package className="w-5 h-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{resource.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${resource.type === 'Drug' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>{resource.type}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {editingQuantityId === resource.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={editingQuantityValue}
                            min="0"
                            onChange={handleQuantityChange}
                            className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                          />
                          <button
                            className="text-green-600 hover:text-green-800"
                            title="Save"
                            onClick={() => handleQuantitySave(resource)}
                          >
                            Save
                          </button>
                          <button
                            className="text-gray-400 hover:text-gray-600"
                            title="Cancel"
                            onClick={() => setEditingQuantityId(null)}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>{(() => { const q = Number(resource.quantity); return isNaN(q) ? 0 : q; })()}</span>
                          <button
                            className="text-blue-600 hover:text-blue-800"
                            title="Edit Quantity"
                            onClick={() => handleQuantityEdit(resource)}
                          >
                            <Pen className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(() => { const s = Number(resource.standard_quantity as any); return isNaN(s) ? 0 : s; })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {resource.unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {resource.type === 'Drug' && resource.expiry_date ? (
                        <EthiopianDateDisplay date={resource.expiry_date as any} format="long" />
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {resource.type === 'Drug' && resource.batch_number ? resource.batch_number : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(() => {
                        const qtyNum = Number(resource.quantity);
                        const stdNumRaw = (resource.standard_quantity as any);
                        const stdNum = stdNumRaw !== undefined && stdNumRaw !== null ? Number(stdNumRaw) : NaN;
                        // Low stock only when qty < 2 AND standard >= 2; if standard missing, fallback to qty < 2
                        const isLowStock = !isNaN(qtyNum) && (
                          qtyNum <= 0 ||
                          (!isNaN(stdNum) ? (qtyNum < 2 && stdNum >= 2) : (qtyNum < 2))
                        );
                        let isExpired = false;
                        let isNearExpired = false;
                        if (resource.type === 'Drug' && resource.expiry_date) {
                          const d = new Date(resource.expiry_date as any);
                          if (!isNaN(d.getTime())) {
                            const now = new Date();
                            const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                            // Only consider expiry statuses when quantity > 0
                            const hasStock = !isNaN(qtyNum) && qtyNum > 0;
                            isExpired = hasStock && d < now;
                            isNearExpired = hasStock && !isExpired && diffDays >= 0 && diffDays <= 7;
                          }
                        }
                        const badges: any[] = [];
                        if (isExpired) badges.push(
                          <span key="expired" className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            <Flag className="w-3 h-3 mr-1" />
                            Expired
                          </span>
                        );
                        if (isNearExpired) badges.push(
                          <span key="near" className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Near Expired
                          </span>
                        );
                        if (isLowStock) badges.push(
                          <span key="low" className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                            <MinusCircle className="w-3 h-3 mr-1" />
                            Low Stock
                          </span>
                        );
                        return badges.length ? (
                          <div className="flex flex-wrap items-center gap-2">{badges}</div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">OK</span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {resource.last_updated_by_name || resource.last_updated_by || 'System'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex gap-2">
                        <button
                          className="p-2 rounded hover:bg-blue-100 text-blue-600"
                          title="Edit"
                          onClick={() => openEditModal(resource)}
                        >
                          <Pen className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 rounded hover:bg-red-100 text-red-600"
                          title="Delete"
                          onClick={async () => {
                            if (window.confirm('Are you sure you want to delete this resource?')) {
                              try {
                                const res = await fetch(`/api/resources/${resource.id}`, { method: 'DELETE' });
                                if (!res.ok) throw new Error('Failed to delete resource');
                                setResources((prev) => prev.filter(r => r.id !== resource.id));
                              } catch (err: any) {
                                setError(err.message || 'Error deleting resource');
                              }
                            }
                          }}
                        >
                          <span className="sr-only">Delete</span>
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredResources.length === 0 && (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No resources found</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by adding a new resource.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ResourceManagement;


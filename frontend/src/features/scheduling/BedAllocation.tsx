// Bed Allocation - assign staff members to beds per day, grid layout (rows = staff, columns = dates)
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Users, Plus, X, ChevronLeft, ChevronRight, Bed, Trash2, Settings, Check, Lock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useStaff, useDepartments } from './hooks';
import { apiGet, apiPost, apiPut, apiDelete, getMediaUrl } from '../../api';
import { gregorianToEthiopian, ETHIOPIAN_MONTHS } from '../../utils/ethiopianCalendar';
import EthiopianDatePicker from './EthiopianDatePicker';

interface Bed {
  id: number;
  name: string;
  department: string;
  is_active: boolean;
}

interface BedAllocation {
  id: number;
  bedId: number;
  staffUserId: number;
  allocationDate: string;
  bedName: string;
  staffName: string;
  staffRole: string;
}

export default function BedAllocation({ locked = false }: { locked?: boolean }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const userDepartment = user?.department || '';

  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const makeStart = () => fmt(new Date());
  const makeEnd = () => { const d = new Date(); d.setDate(d.getDate() + 30); return fmt(d); };

  const [startDate, setStartDate] = useState(makeStart);
  const [endDate, setEndDate] = useState(makeEnd);
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterStaffId, setFilterStaffId] = useState<number | undefined>();
  const [beds, setBeds] = useState<Bed[]>([]);
  const [allocations, setAllocations] = useState<BedAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBedManager, setShowBedManager] = useState(false);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeDepartment = isAdmin ? filterDepartment : userDepartment;
  const { staff } = useStaff(activeDepartment);
  const allDepartments = useDepartments();

  const dates = useMemo(() => {
    const out: Date[] = [];
    const s = new Date(startDate + 'T00:00:00');
    const e = new Date(endDate + 'T00:00:00');
    while (s <= e) { out.push(new Date(s)); s.setDate(s.getDate() + 1); }
    return out;
  }, [startDate, endDate]);

  const today = fmt(new Date());
  const isToday = (d: Date) => fmt(d) === today;
  const ds = (d: Date) => fmt(d);

  const fetchBeds = useCallback(async () => {
    if (!activeDepartment) { setBeds([]); return; }
    try {
      const data = await apiGet(`/bed-allocation/beds?department=${encodeURIComponent(activeDepartment)}`);
      setBeds(Array.isArray(data) ? data : []);
    } catch { setBeds([]); }
  }, [activeDepartment]);

  const fetchAllocations = useCallback(async (showLoading = false) => {
    if (!activeDepartment) { setAllocations([]); setLoading(false); return; }
    if (showLoading) setLoading(true);
    try {
      const data = await apiGet(`/bed-allocation/allocations?department=${encodeURIComponent(activeDepartment)}&startDate=${startDate}&endDate=${endDate}`);
      setAllocations(Array.isArray(data) ? data : []);
    } catch { setAllocations([]); }
    finally { setLoading(false); }
  }, [activeDepartment, startDate, endDate]);

  useEffect(() => { fetchBeds(); fetchAllocations(true); }, [fetchBeds, fetchAllocations]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setEditingCell(null);
        setDropdownPos(null);
      }
    };
    if (editingCell) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editingCell]);

  const allocationMap = useMemo(() => {
    const m = new Map<string, BedAllocation>();
    allocations.forEach(a => m.set(`${a.staffUserId}-${a.allocationDate}`, a));
    return m;
  }, [allocations]);

  const groupedStaff = useMemo(() => {
    const groups = new Map<string, typeof staff>();
    const list = filterStaffId ? staff.filter(s => s.id === filterStaffId) : staff;
    list.forEach(s => {
      const key = s.profession || 'Staff';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    });
    return groups;
  }, [staff, filterStaffId]);

  const professions = useMemo(() => Array.from(new Set(staff.map(s => s.profession).filter(Boolean))).sort(), [staff]);

  const handleCellClick = useCallback((staffId: number, date: string, cellEl: HTMLElement) => {
    if (!activeDepartment || locked) return;
    const key = `${staffId}-${date}`;
    if (editingCell === key) {
      setEditingCell(null);
      setDropdownPos(null);
    } else {
      const rect = cellEl.getBoundingClientRect();
      setEditingCell(key);
      setDropdownPos({ top: rect.bottom + 4, left: rect.left });
    }
  }, [editingCell, activeDepartment]);

  const handleAssign = useCallback(async (staffId: number, bedId: number, date: string) => {
    if (!activeDepartment || locked) return;
    setEditingCell(null);
    setDropdownPos(null);
    const bed = beds.find(b => b.id === bedId);
    const st = staff.find(s => s.id === staffId);
    if (!bed || !st) return;
    const optimistic: BedAllocation = {
      id: Date.now(), bedId, staffUserId: staffId, allocationDate: date,
      bedName: bed.name, staffName: st.name, staffRole: st.profession || '',
    };
    setAllocations(prev => [...prev.filter(a => !(a.staffUserId === staffId && a.allocationDate === date)), optimistic]);
    try {
      await apiPost('/bed-allocation/allocations', {
        bedId, staffUserId: staffId, allocationDate: date, department: activeDepartment
      });
      await fetchAllocations(false);
    } catch {
      await fetchAllocations(false);
    }
  }, [activeDepartment, beds, staff, fetchAllocations]);

  const handleRemove = useCallback(async (allocationId: number) => {
    if (locked) return;
    if (!confirm('Remove this bed assignment?')) return;
    setAllocations(prev => prev.filter(a => a.id !== allocationId));
    try {
      await apiDelete(`/bed-allocation/allocations/${allocationId}`);
      await fetchAllocations(false);
    } catch {
      await fetchAllocations(false);
    }
  }, [fetchAllocations]);

  // ── Bed manager handlers ──────────────────────────────────────────────
  const [newBedName, setNewBedName] = useState('');

  const handleAddBed = async () => {
    if (!newBedName.trim() || !activeDepartment || locked) return;
    try {
      await apiPost('/bed-allocation/beds', { name: newBedName.trim(), department: activeDepartment });
      setNewBedName('');
      await fetchBeds();
    } catch (err: any) {
      alert(err?.message || 'Failed to add bed');
    }
  };

  const handleToggleBed = async (bed: Bed) => {
    if (locked) return;
    try {
      await apiPut(`/bed-allocation/beds/${bed.id}`, { isActive: !bed.is_active });
      await fetchBeds();
    } catch {}
  };

  const handleDeleteBed = async (bed: Bed) => {
    if (locked) return;
    if (!confirm(`Delete "${bed.name}"? Existing allocations for it will also be removed.`)) return;
    try {
      await apiDelete(`/bed-allocation/beds/${bed.id}`);
      await fetchBeds();
      await fetchAllocations(false);
    } catch {}
  };

  const shiftRange = (days: number) => {
    const s = new Date(startDate + 'T00:00:00');
    const e = new Date(endDate + 'T00:00:00');
    s.setDate(s.getDate() + days);
    e.setDate(e.getDate() + days);
    setStartDate(fmt(s));
    setEndDate(fmt(e));
  };

  const resetToToday = () => { setStartDate(makeStart()); setEndDate(makeEnd()); };

  const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Controls */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex-shrink-0">
        <div className="flex items-center justify-between max-w-[1800px] mx-auto flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button onClick={() => shiftRange(-7)} className="p-1 hover:bg-gray-100 rounded-md"><ChevronLeft className="w-4 h-4 text-gray-500" /></button>
            <button onClick={resetToToday} className="px-3 py-1 text-xs font-semibold bg-[#003153] text-white hover:bg-[#002640] rounded-lg shadow-sm">Today</button>
            <button onClick={() => shiftRange(7)} className="p-1 hover:bg-gray-100 rounded-md"><ChevronRight className="w-4 h-4 text-gray-500" /></button>
            <div className="flex items-center gap-1.5 ml-2">
              <EthiopianDatePicker value={startDate} onChange={setStartDate} />
              <span className="text-xs text-gray-400">to</span>
              <EthiopianDatePicker value={endDate} onChange={setEndDate} />
            </div>
            <span className="text-[11px] text-gray-400 ml-1">{dates.length} days</span>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <select value={filterDepartment} onChange={e => { setFilterDepartment(e.target.value); setFilterStaffId(undefined); }}
                className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white font-medium">
                <option value="">All Departments</option>
                {allDepartments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
            <select value={filterStaffId || ''} onChange={e => setFilterStaffId(e.target.value ? parseInt(e.target.value) : undefined)}
              className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white">
              <option value="">All Staff</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button onClick={() => setShowBedManager(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#003153] hover:bg-[#003153]/5 border border-[#003153]/20 rounded-md px-2.5 py-1.5 transition-colors">
              <Settings className="w-3.5 h-3.5" />
              Manage Beds ({beds.length})
            </button>
          </div>
        </div>
      </div>

      {/* Active bed selector note */}
      <div className={`border-b px-4 py-1.5 flex-shrink-0 ${locked ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
        <div className="max-w-[1800px] mx-auto flex items-center gap-2">
          {locked ? (
            <>
              <Lock className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-xs font-medium text-amber-800">
                Schedule is locked — unlock to assign or remove beds
              </span>
            </>
          ) : (
            <>
              <Bed className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-xs font-medium text-blue-800">
                {beds.length === 0
                  ? 'No beds yet — click "Manage Beds" to add beds for this department, then click a cell to assign'
                  : `Click a cell to assign a staff member to a bed (${beds.map(b => b.name).join(', ')})`}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-hidden px-4 py-3 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[#003153] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-gray-400 font-medium">Loading bed allocations...</span>
            </div>
          </div>
        ) : staff.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-sm font-semibold text-gray-500">No staff members found</p>
            <p className="text-xs text-gray-400 mt-1">Add staff to your department first</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 h-full overflow-auto">
            <div style={{ display: 'grid', gridTemplateColumns: `minmax(180px, 200px) repeat(${dates.length}, minmax(70px, 1fr))`, minWidth: `${180 + dates.length * 70}px` }}>

              {/* Header row */}
              <div className="sticky top-0 left-0 z-30 bg-gradient-to-b from-gray-50 to-white px-4 py-3 border-b border-gray-200 flex items-end">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Staff / Bed</span>
              </div>
              {dates.map((d, i) => {
                const wd = d.toLocaleDateString('en-US', { weekday: 'short' });
                const eth = gregorianToEthiopian(d);
                const mname = ETHIOPIAN_MONTHS[eth.month - 1]?.substring(0, 3) || '';
                const we = isWeekend(d);
                const td = isToday(d);
                return (
                  <div key={i}
                    className={`text-center px-1 py-2 border-b border-l ${
                      td ? 'bg-[#00b8d4]/20 border-l-[3px] border-l-[#00b8d4]' :
                      we ? 'bg-slate-200/70 border-l-slate-300' :
                      'bg-white border-l-gray-100'
                    }`}>
                    <div className={`text-[9px] font-bold uppercase tracking-wide ${td ? 'text-[#006b7a]' : we ? 'text-slate-500' : 'text-gray-500'}`}>{wd}</div>
                    <div className={`text-lg font-black leading-tight ${td ? 'text-[#006b7a]' : we ? 'text-slate-700' : 'text-gray-800'}`}>{eth.day}</div>
                    <div className={`text-[8px] font-semibold uppercase tracking-wider ${td ? 'text-[#006b7a]/70' : we ? 'text-slate-500/80' : 'text-gray-400'}`}>{mname}</div>
                  </div>
                );
              })}

              {/* Staff rows */}
              {Array.from(groupedStaff.entries()).map(([profession, profStaff]) => (
                <React.Fragment key={profession}>
                  <div style={{ gridColumn: '1 / -1' }} className="bg-gradient-to-r from-gray-50 to-transparent px-4 py-2 border-t border-b border-gray-200 flex items-center">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{profession}</span>
                    <span className="text-[11px] font-medium text-gray-400 ml-1.5">({profStaff.length})</span>
                  </div>

                  {profStaff.map((s) => (
                    <React.Fragment key={s.id}>
                      <div className="sticky left-0 z-10 bg-white px-3 py-2 border-b border-gray-100 flex items-center gap-2.5 hover:bg-gray-50/50 transition-colors">
                        {s.profile_picture ? (
                          <img src={getMediaUrl(s.profile_picture)} alt={s.name}
                            className="w-7 h-7 rounded-lg object-cover ring-2 ring-white shadow-sm flex-shrink-0" loading="lazy" decoding="async"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : null}
                        {!s.profile_picture && (
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#003153] to-[#004a7a] text-white flex items-center justify-center text-[10px] font-bold shadow-sm flex-shrink-0">
                            {s.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-gray-800 truncate leading-tight">{s.name}</div>
                          <div className="text-[9px] text-gray-400 truncate">{s.profession}</div>
                        </div>
                      </div>
                      {dates.map((d, di) => {
                        const key = ds(d);
                        const cellKey = `${s.id}-${key}`;
                        const assignment = allocationMap.get(cellKey);
                        return (
                          <div key={di}
                            className={`border-b border-l p-1 flex items-center justify-center min-h-[44px] transition-colors ${
                              isToday(d) ? 'bg-[#00b8d4]/[0.12] border-l-[3px] border-l-[#00b8d4]/60' :
                              isWeekend(d) ? 'bg-slate-200/50 border-l-slate-300/60' :
                              'border-l-gray-100 hover:bg-gray-50'
                            }`}>
                            {assignment ? (
                              <div className="group/cell relative">
                                <button
                                  onClick={(e) => locked ? undefined : handleCellClick(s.id, key, e.currentTarget)}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold text-white shadow-sm transition-shadow flex items-center gap-1 ${
                                    locked ? 'cursor-default' : 'cursor-pointer hover:shadow-md'
                                  }`}
                                  style={{ backgroundColor: '#0d9488' }}
                                  title={`${assignment.bedName}${locked ? ' (locked)' : ' — click to change/remove'}`}>
                                  <Bed className="w-2.5 h-2.5" />
                                  {assignment.bedName}
                                </button>
                                {!locked && (
                                  <button onClick={(e) => { e.stopPropagation(); handleRemove(assignment.id); }}
                                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full items-center justify-center shadow opacity-0 group-hover/cell:flex hover:bg-red-600 transition-all">
                                    <X className="w-2.5 h-2.5 text-white" />
                                  </button>
                                )}
                              </div>
                            ) : locked ? (
                              <div className="w-full h-full min-h-[36px]" />
                            ) : (
                              <button
                                onClick={(e) => handleCellClick(s.id, key, e.currentTarget)}
                                className="w-full h-full min-h-[36px] flex items-center justify-center rounded-lg border border-transparent hover:border-dashed hover:border-[#0d9488]/30 hover:bg-[#0d9488]/5 transition-all"
                                title="Click to assign a bed">
                                <Plus className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </React.Fragment>
              ))}
              {groupedStaff.size === 0 && (
                <div style={{ gridColumn: '1 / -1' }} className="text-center py-20 text-gray-400">
                  <p className="text-sm font-medium">No staff members found for this filter.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bed assignment dropdown */}
      {editingCell && dropdownPos && (() => {
        const parts = editingCell.split('-');
        const staffId = parseInt(parts[0]);
        const date = parts.slice(1).join('-');
        const current = allocationMap.get(editingCell);
        return (
          <div
            ref={dropdownRef}
            className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200 p-2 min-w-[180px]"
            style={{ top: dropdownPos.top, left: Math.min(dropdownPos.left, window.innerWidth - 200) }}
          >
            <div className="text-[10px] text-gray-400 font-medium px-2 pb-1.5 border-b border-gray-100 mb-1">
              Assign Bed {current ? `(currently: ${current.bedName})` : ''}
            </div>
            {beds.length === 0 ? (
              <p className="text-[10px] text-gray-400 px-2 py-3 text-center">No beds. Add beds via "Manage Beds".</p>
            ) : (
              <div className="grid grid-cols-1 gap-0.5 max-h-[220px] overflow-y-auto">
                {beds.map(b => (
                  <button
                    key={b.id}
                    onClick={() => handleAssign(staffId, b.id, date)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-left ${
                      current?.bedId === b.id ? 'bg-teal-50' : ''
                    }`}>
                    <span className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center text-[8px] font-bold text-white bg-[#0d9488]">
                      <Bed className="w-2 h-2" />
                    </span>
                    <span className="text-[11px] font-semibold text-gray-800">{b.name}</span>
                    {current?.bedId === b.id && <Check className="w-3 h-3 text-teal-600 ml-auto" />}
                  </button>
                ))}
              </div>
            )}
            {current && (
              <button
                onClick={() => { setEditingCell(null); setDropdownPos(null); handleRemove(current.id); }}
                className="w-full mt-1.5 flex items-center justify-center gap-1.5 text-[10px] font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 py-1.5 rounded-lg transition-colors">
                <Trash2 className="w-3 h-3" /> Remove Assignment
              </button>
            )}
            <button
              onClick={() => { setEditingCell(null); setDropdownPos(null); }}
              className="w-full mt-1.5 text-[10px] text-gray-400 hover:text-gray-600 py-1 text-center">
              Cancel
            </button>
          </div>
        );
      })()}

      {/* Bed Manager Modal */}
      {showBedManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowBedManager(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#003153] rounded-xl flex items-center justify-center">
                  <Bed className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Manage Beds</h3>
                  <p className="text-[10px] text-gray-400">{activeDepartment || 'No department selected'}</p>
                </div>
              </div>
              <button onClick={() => setShowBedManager(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="p-5">
              {locked && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-[11px] font-semibold text-amber-800">Schedule is locked — bed changes are disabled</span>
                </div>
              )}
              <div className="flex gap-2 mb-4">
                <input
                  value={newBedName}
                  onChange={e => setNewBedName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddBed(); }}
                  disabled={locked}
                  placeholder="e.g. Bed 3, Room A, ICU-05..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#003153] disabled:bg-gray-50 disabled:text-gray-400"
                />
                <button onClick={handleAddBed} disabled={locked}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-semibold text-white bg-[#003153] hover:bg-[#002640] rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>

              <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
                {beds.length === 0 ? (
                  <p className="text-center text-xs text-gray-400 py-6">No beds yet. Add your first bed above.</p>
                ) : beds.map(b => (
                  <div key={b.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${b.is_active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                    <Bed className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-800">{b.name}</div>
                      <div className="text-[9px] text-gray-400">{b.department}</div>
                    </div>
                    <button
                      onClick={() => handleToggleBed(b)}
                      disabled={locked}
                      title={locked ? 'Locked' : b.is_active ? 'Deactivate' : 'Activate'}
                      className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${b.is_active ? 'text-green-600 bg-green-50 hover:bg-green-100' : 'text-gray-400 bg-gray-100 hover:bg-gray-200'}`}>
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDeleteBed(b)} disabled={locked}
                      className="p-1.5 rounded-lg text-red-500 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end px-5 py-3 border-t border-gray-100">
              <button onClick={() => setShowBedManager(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

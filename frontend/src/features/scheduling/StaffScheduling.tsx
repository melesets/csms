import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  CalendarDays, ChevronLeft, ChevronRight, Download, FileText, History, Plus, X,
  Users, Lock
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useShiftTypes, useSchedules, useHolidays, useStaff, useDepartments, createScheduleApi, deleteScheduleApi, getChangeLogApi } from './hooks';
import type { Schedule, ScheduleChangeLog } from './types';
import { gregorianToEthiopian, formatEthiopianDate, ETHIOPIAN_MONTHS } from '../../utils/ethiopianCalendar';
import EthiopianDatePicker from './EthiopianDatePicker';

export default function StaffScheduling() {
  const { user } = useAuth();
  const [locked, setLocked] = useState(false);
  const canEditBase = user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'user';
  const canEdit = canEditBase && !locked;
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const userDepartment = user?.department || '';

  const today = new Date();
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const parseLocal = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const makeStart = () => fmt(new Date());
  const makeEnd = () => { const d = new Date(); d.setDate(d.getDate() + 30); return fmt(d); };

  const [startDate, setStartDate] = useState(makeStart);
  const [endDate, setEndDate] = useState(makeEnd);
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStaffId, setFilterStaffId] = useState<number | undefined>();
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null);
  const [showChangeLog, setShowChangeLog] = useState(false);
  const [changeLog, setChangeLog] = useState<ScheduleChangeLog[]>([]);
  const [saving, setSaving] = useState(false);

  const activeDepartment = isAdmin ? filterDepartment : userDepartment;

  const { shiftTypes } = useShiftTypes();
  const { schedules, setSchedules, loading, refresh: refreshSchedules } = useSchedules(activeDepartment, startDate, endDate, filterStaffId);
  const holidays = useHolidays(startDate, endDate);
  const { staff } = useStaff(activeDepartment);
  const allDepartments = useDepartments();

  const dates = useMemo(() => {
    const r: Date[] = [];
    const s = parseLocal(startDate);
    const e = parseLocal(endDate);
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) r.push(new Date(d));
    return r;
  }, [startDate, endDate]);

  const holidayMap = useMemo(() => {
    const m = new Map<string, typeof holidays[0]>();
    holidays.forEach(h => m.set(h.date, h));
    return m;
  }, [holidays]);

  const shiftTypeMap = useMemo(() => {
    const m = new Map<number, { id: number; name: string; abbreviation: string; color: string; default_hours: number }>();
    shiftTypes.forEach(st => m.set(st.id, st));
    return m;
  }, [shiftTypes]);

  const scheduleMap = useMemo(() => {
    const m = new Map<number, Map<string, Schedule>>();
    schedules.forEach(s => {
      const dateKey = s.schedule_date.includes('T')
        ? fmt(parseLocal(s.schedule_date.split('T')[0]))
        : s.schedule_date;
      if (!m.has(s.staff_user_id)) m.set(s.staff_user_id, new Map());
      m.get(s.staff_user_id)!.set(dateKey, s);
    });
    return m;
  }, [schedules]);

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

  const shiftRange = (days: number) => {
    const s = parseLocal(startDate);
    const e = parseLocal(endDate);
    s.setDate(s.getDate() + days);
    e.setDate(e.getDate() + days);
    setStartDate(fmt(s));
    setEndDate(fmt(e));
  };

  const resetToToday = () => { setStartDate(makeStart()); setEndDate(makeEnd()); };

  const doAssign = useCallback(async (staffId: number, shiftTypeId: number, date: string) => {
    if (!activeDepartment) return;
    const st = shiftTypeMap.get(shiftTypeId);
    if (!st) return;

    const optimistic: Schedule = {
      id: Date.now(),
      staff_user_id: staffId,
      shift_type_id: shiftTypeId,
      schedule_date: date,
      department: activeDepartment,
      notes: null,
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      shift_name: st.name,
      shift_abbr: st.abbreviation,
      shift_color: st.color,
      staff_name: staff.find(s => s.id === staffId)?.name || '',
      staff_role: staff.find(s => s.id === staffId)?.profession || '',
      profile_picture: staff.find(s => s.id === staffId)?.profile_picture || null,
    };

    setSchedules(prev => [...prev, optimistic]);
    setEditingCell(null);

    try {
      await createScheduleApi({ staffUserId: staffId, shiftTypeId, scheduleDate: date, department: activeDepartment });
      await refreshSchedules(false);
    } catch (err) {
      console.error('Schedule save error:', err);
      setSchedules(prev => prev.filter(s => s.id !== optimistic.id));
    }
  }, [activeDepartment, refreshSchedules, shiftTypeMap, staff, setSchedules]);

  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);

  const handleCellClick = useCallback((staffId: number, date: string, cellEl: HTMLElement) => {
    if (!canEdit) return;
    const key = `${staffId}-${date}`;
    if (selectedShiftId) {
      doAssign(staffId, selectedShiftId, date);
    } else {
      if (editingCell === key) {
        setEditingCell(null);
        setDropdownPos(null);
      } else {
        const rect = cellEl.getBoundingClientRect();
        setEditingCell(key);
        setDropdownPos({ top: rect.bottom + 4, left: rect.left });
      }
    }
  }, [canEdit, selectedShiftId, editingCell, doAssign]);

  const handleAssignFromDropdown = useCallback((staffId: number, shiftTypeId: number, date: string) => {
    setEditingCell(null);
    setDropdownPos(null);
    doAssign(staffId, shiftTypeId, date);
  }, [doAssign]);

  const handleDelete = useCallback(async (scheduleId: number) => {
    if (!confirm('Remove this shift?')) return;
    setSchedules(prev => prev.filter(s => s.id !== scheduleId));
    try {
      await deleteScheduleApi(scheduleId);
      await refreshSchedules(false);
    } catch (err) {
      console.error('Delete error:', err);
      await refreshSchedules(false);
    }
  }, [refreshSchedules, setSchedules]);

  const loadChangeLog = useCallback(async () => {
    try {
      const log = await getChangeLogApi(activeDepartment, startDate, endDate);
      setChangeLog(log);
      setShowChangeLog(true);
    } catch {}
  }, [activeDepartment, startDate, endDate]);

  const handleExportPng = useCallback(async () => {
    const grid = document.getElementById('schedule-grid');
    if (!grid) return;
    try {
      const html2canvas = (await import('html2canvas')).default;

      // Temporarily expand grid to full scroll size for complete capture
      const prevOverflow = grid.style.overflow;
      const prevWidth = grid.style.width;
      const prevHeight = grid.style.height;
      grid.style.overflow = 'visible';
      grid.style.width = grid.scrollWidth + 'px';
      grid.style.height = grid.scrollHeight + 'px';

      // Remove truncation from staff names so full names are captured
      const truncatedEls = grid.querySelectorAll('.truncate');
      const prevClasses: string[] = [];
      truncatedEls.forEach((el, i) => {
        prevClasses[i] = el.className;
        el.className = el.className.replace(/truncate/g, '').trim();
        (el as HTMLElement).style.whiteSpace = 'normal';
        (el as HTMLElement).style.overflow = 'visible';
        (el as HTMLElement).style.textOverflow = 'unset';
      });

      // Widen the staff name column
      const innerGrid = grid.querySelector('[style*="grid-template-columns"]') as HTMLElement | null;
      const prevGridCols = innerGrid?.style.gridTemplateColumns;
      const prevGridMinWidth = innerGrid?.style.minWidth;
      if (innerGrid) {
        innerGrid.style.gridTemplateColumns = `minmax(220px, 260px) repeat(${dates.length}, minmax(60px, 1fr))`;
        innerGrid.style.minWidth = `${220 + dates.length * 60}px`;
      }

      const canvas = await html2canvas(grid, {
        backgroundColor: '#ffffff',
        scale: 2,
        width: grid.scrollWidth,
        height: grid.scrollHeight,
        windowWidth: grid.scrollWidth,
        windowHeight: grid.scrollHeight,
      });

      // Restore original styles
      grid.style.overflow = prevOverflow;
      grid.style.width = prevWidth;
      grid.style.height = prevHeight;
      truncatedEls.forEach((el, i) => {
        el.className = prevClasses[i];
        (el as HTMLElement).style.whiteSpace = '';
        (el as HTMLElement).style.overflow = '';
        (el as HTMLElement).style.textOverflow = '';
      });
      if (innerGrid) {
        innerGrid.style.gridTemplateColumns = prevGridCols || '';
        innerGrid.style.minWidth = prevGridMinWidth || '';
      }

      const link = document.createElement('a');
      link.download = `schedule-${startDate}-to-${endDate}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch { alert('Export failed. Use browser print (Ctrl+P).'); }
  }, [startDate, endDate, dates.length]);

  const handleExportExcel = useCallback(() => {
    try {
    const colCount = dates.length + 1;

    let html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8">
<!--[if gte mso 9]><xml>
<x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>Schedule</x:Name>
<x:WorksheetOptions>
  <x:DoNotDisplayGridlines/>
  <x:FreezePanes/>
  <x:FrozenNoSplit/>
  <x:SplitHorizontal>2</x:SplitHorizontal>
  <x:SplitVertical>1</x:SplitVertical>
  <x:TopRowBottomPane>2</x:TopRowBottomPane>
  <x:LeftColumnRightPane>1</x:LeftColumnRightPane>
</x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head><body>
<table>`;

    // ── Title row ──
    html += `<tr><td colspan="${colCount}" style="font-family:Calibri,sans-serif;background:#003153;color:white;padding:12px 14px;font-size:14pt;font-weight:800;letter-spacing:-0.02em;border:none">Staff Schedule</td></tr>`;
    html += `<tr><td colspan="${colCount}" style="font-family:Calibri,sans-serif;background:#004a7a;color:rgba(255,255,255,0.7);padding:4px 14px 8px;font-size:9pt;font-weight:400;border:none">${activeDepartment || 'All Departments'} &bull; ${formatEthiopianDate(gregorianToEthiopian(parseLocal(startDate)))} — ${formatEthiopianDate(gregorianToEthiopian(parseLocal(endDate)))} (${dates.length} days)</td></tr>`;

    // ── Column header row ──
    html += '<tr>';
    html += '<th style="font-family:Calibri,sans-serif;font-size:9pt;color:#9ca3af;text-align:left;padding:8px 10px;border-bottom:2px solid #e5e7eb;background:#f9fafb;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;vertical-align:bottom">STAFF</th>';
    dates.forEach(d => {
      const eth = gregorianToEthiopian(d);
      const wd = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
      const mname = ETHIOPIAN_MONTHS[eth.month - 1]?.substring(0, 3).toUpperCase() || '';
      const isTd = isToday(d);
      const isWe = isWeekend(d);
      const isHo = isHoliday(d);
      let thBg = '#ffffff';
      let thBorderLeft = '1px solid #f3f4f6';
      let txtColor = '#374151';
      let subColor = '#9ca3af';
      if (isTd) { thBg = '#e0f7fa'; thBorderLeft = '3px solid #00b8d4'; txtColor = '#006b7a'; subColor = '#006b7a'; }
      else if (isWe) { thBg = '#e2e8f0'; thBorderLeft = '1px solid #cbd5e1'; txtColor = '#475569'; subColor = '#475569'; }
      else if (isHo) { thBg = '#fef3c7'; thBorderLeft = '1px solid #fde68a'; txtColor = '#92400e'; subColor = '#92400e'; }
      html += `<th style="font-family:Calibri,sans-serif;text-align:center;padding:6px 4px;border-bottom:2px solid #e5e7eb;border-left:${thBorderLeft};background:${thBg};vertical-align:bottom">
        <div style="font-size:7pt;font-weight:700;color:${subColor};text-transform:uppercase;letter-spacing:0.06em">${wd}</div>
        <div style="font-size:14pt;font-weight:800;color:${txtColor};line-height:1.2">${eth.day}</div>
        <div style="font-size:7pt;font-weight:600;color:${subColor};text-transform:uppercase;letter-spacing:0.04em">${mname}</div>
      </th>`;
    });
    html += '</tr>';

    // ── Staff rows grouped by profession ──
    groupedStaff.forEach((profStaff, profession) => {
      html += `<tr><td colspan="${colCount}" style="font-family:Calibri,sans-serif;background:#f9fafb;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:6px 10px;font-size:10pt;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em">${profession} <span style="font-weight:400;color:#9ca3af;text-transform:none;letter-spacing:0">(${profStaff.length})</span></td></tr>`;

      profStaff.forEach(s => {
        const assigns = scheduleMap.get(s.id) || new Map();
        const initials = s.name?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || '?';
        html += `<tr>`;
        // Staff cell with avatar circle
        html += `<td style="font-family:Calibri,sans-serif;background:white;border-bottom:1px solid #f3f4f6;padding:6px 10px;text-align:left;white-space:nowrap">
          <table cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="width:32px;height:32px;background:#003153;border-radius:50%;text-align:center;vertical-align:middle;color:white;font-size:10pt;font-weight:700;padding:0;margin:0">${initials}</td>
            <td style="padding-left:8px;vertical-align:middle;line-height:1.2">
              <div style="font-size:10pt;font-weight:600;color:#111827">${s.name}</div>
              ${s.staff_role ? `<div style="font-size:8pt;font-weight:400;color:#9ca3af">${s.staff_role}</div>` : ''}
            </td>
          </tr></table>
        </td>`;
        // Day cells
        dates.forEach(d => {
          const assignment = assigns.get(ds(d));
          const isTd = isToday(d);
          const isWe = isWeekend(d);
          const isHo = isHoliday(d);
          if (assignment) {
            // Shift assigned — cell background IS the shift color
            html += `<td style="font-family:Calibri,sans-serif;text-align:center;padding:5px 3px;vertical-align:middle;border-bottom:1px solid #d1d5db;border-left:1px solid #d1d5db;background:${assignment.shift_color};min-width:52px">
              <b style="font-size:9pt;color:#ffffff">${assignment.shift_abbr}</b>
            </td>`;
          } else {
            // Empty cell — show weekend/hoday/today shading
            let cellBg = '#ffffff';
            let cellBorderLeft = '1px solid #e5e7eb';
            if (isTd) { cellBg = '#e0f7fa'; cellBorderLeft = '3px solid #00b8d4'; }
            else if (isWe) { cellBg = '#e2e8f0'; cellBorderLeft = '1px solid #cbd5e1'; }
            else if (isHo) { cellBg = '#fef3c7'; cellBorderLeft = '1px solid #fde68a'; }
            html += `<td style="font-family:Calibri,sans-serif;text-align:center;padding:5px 3px;vertical-align:middle;border-bottom:1px solid #e5e7eb;border-left:${cellBorderLeft};background:${cellBg};min-width:52px"></td>`;
          }
        });
        html += '</tr>';
      });
    });

    html += '</table></body></html>';

    const blob = new Blob(['\ufeff', html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `staff-schedule-${activeDepartment || 'all'}-${startDate}-to-${endDate}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    } catch (err) { console.error('Excel export failed:', err); alert('Excel export failed. Try browser print (Ctrl+P) or use the PNG export.'); }
  }, [dates, groupedStaff, scheduleMap, startDate, endDate, activeDepartment]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') { setEditingCell(null); setDropdownPos(null); } };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!editingCell) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.shift-dropdown') && !target.closest('[data-schedule-cell]')) {
        setEditingCell(null);
        setDropdownPos(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editingCell]);

  const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
  const isHoliday = (d: Date) => holidayMap.has(fmt(d));
  const isToday = (d: Date) => fmt(d) === fmt(today);
  const ds = (d: Date) => fmt(d);

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between max-w-[1800px] mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#003153] rounded-xl flex items-center justify-center shadow-sm">
              <CalendarDays className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">Staff Schedule</h1>
              <p className="text-[11px] text-gray-500">{activeDepartment || 'All Departments'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canEditBase && (
              <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg p-1 gap-0.5">
                {shiftTypes.map(st => (
                  <button key={st.id}
                    onClick={() => setSelectedShiftId(selectedShiftId === st.id ? null : st.id)}
                    disabled={locked}
                    className={`px-2.5 py-1.5 text-[11px] font-bold rounded-md transition-all ${
                      locked ? 'opacity-40 cursor-not-allowed text-gray-400' :
                      selectedShiftId === st.id ? 'text-white shadow-md scale-105' : 'hover:bg-white hover:shadow-sm text-gray-600'
                    }`}
                    style={selectedShiftId === st.id && !locked ? { backgroundColor: st.color } : {}}>
                    {st.abbreviation}
                  </button>
                ))}
                <div className="w-px h-5 bg-gray-200 mx-0.5" />
                <button
                  onClick={() => setLocked(l => !l)}
                  className={`p-1.5 rounded-md transition-all ${locked ? 'text-amber-500 opacity-40 hover:opacity-100' : 'text-gray-300 opacity-0 hover:opacity-60 hover:text-gray-500'}`}
                  title={locked ? 'Unlock schedule' : 'Lock schedule'}>
                  {locked ? <Lock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                </button>
              </div>
            )}
            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg p-0.5">
              <button onClick={handleExportPng} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded-md transition-colors" title="Export as PNG image">
                <Download className="w-4 h-4" />
              </button>
              <button onClick={handleExportExcel} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-white rounded-md transition-colors" title="Export as Excel spreadsheet">
                <FileText className="w-4 h-4" />
              </button>
            </div>
            <button onClick={loadChangeLog} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="Change history">
              <History className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

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
            <select value={filterRole} onChange={e => { setFilterRole(e.target.value); setFilterStaffId(undefined); }}
              className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white">
              <option value="">All Roles</option>
              {professions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={filterStaffId || ''} onChange={e => setFilterStaffId(e.target.value ? parseInt(e.target.value) : undefined)}
              className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white">
              <option value="">All Staff</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Active selection bar */}
      {selectedShiftId && canEdit && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-1.5 flex-shrink-0">
          <div className="max-w-[1800px] mx-auto flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: shiftTypeMap.get(selectedShiftId)?.color }} />
            <span className="text-xs font-medium text-blue-800">
              {shiftTypeMap.get(selectedShiftId)?.name} selected — click any empty cell to assign
            </span>
            <button onClick={() => setSelectedShiftId(null)} className="ml-auto text-blue-600 hover:text-blue-800">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-hidden px-4 py-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[#003153] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-gray-400 font-medium">Loading schedule...</span>
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
          <div id="schedule-grid" className="bg-white rounded-2xl shadow-sm border border-gray-200/80 h-full overflow-auto">
            <div style={{ display: 'grid', gridTemplateColumns: `minmax(180px, 200px) repeat(${dates.length}, minmax(60px, 1fr))`, minWidth: `${180 + dates.length * 60}px` }}>

              {/* Header row */}
              <div className="sticky top-0 left-0 z-30 bg-gradient-to-b from-gray-50 to-white px-4 py-3 border-b border-gray-200 flex items-end">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Staff</span>
              </div>
              {dates.map((d, i) => {
                const wd = d.toLocaleDateString('en-US', { weekday: 'short' });
                const eth = gregorianToEthiopian(d);
                const mname = ETHIOPIAN_MONTHS[eth.month - 1]?.substring(0, 3) || '';
                const we = isWeekend(d);
                const ho = isHoliday(d);
                const td = isToday(d);
                return (
                  <div key={i}
                    className={`text-center px-1 py-2 border-b border-l ${
                      td ? 'bg-[#00b8d4]/20 border-l-[3px] border-l-[#00b8d4]' :
                      we ? 'bg-slate-200/70 border-l-slate-300' :
                      ho ? 'bg-amber-200/60 border-l-amber-300' :
                      'bg-white border-l-gray-100'
                    }`}
                    title={ho ? holidayMap.get(ds(d))?.name : undefined}>
                    <div className={`text-[9px] font-bold uppercase tracking-wide ${td ? 'text-[#006b7a]' : we ? 'text-slate-500' : ho ? 'text-amber-700' : 'text-gray-500'}`}>{wd}</div>
                    <div className={`text-lg font-black leading-tight ${td ? 'text-[#006b7a]' : we ? 'text-slate-700' : ho ? 'text-amber-800' : 'text-gray-800'}`}>{eth.day}</div>
                    <div className={`text-[8px] font-semibold uppercase tracking-wider ${td ? 'text-[#006b7a]/70' : we ? 'text-slate-500/80' : ho ? 'text-amber-600/80' : 'text-gray-400'}`}>{mname}</div>
                  </div>
                );
              })}

              {/* Staff rows */}
              {Array.from(groupedStaff.entries()).map(([profession, profStaff]) => (
                <React.Fragment key={profession}>
                  {/* Group header */}
                  <div style={{ gridColumn: '1 / -1' }} className="bg-gradient-to-r from-gray-50 to-transparent px-4 py-2 border-t border-b border-gray-200 flex items-center">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{profession}</span>
                    <span className="text-[11px] font-medium text-gray-400 ml-1.5">({profStaff.length})</span>
                  </div>

                  {profStaff.map((s) => {
                    const assigns = scheduleMap.get(s.id) || new Map();
                    return (
                      <React.Fragment key={s.id}>
                        {/* Staff name cell */}
                        <div className="sticky left-0 z-10 bg-white px-3 py-2 border-b border-gray-100 flex items-center gap-2.5 hover:bg-gray-50/50 transition-colors">
                          {s.profile_picture ? (
                            <img src={s.profile_picture} alt="" className="w-8 h-8 rounded-xl object-cover ring-2 ring-white shadow-sm flex-shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#003153] to-[#004a7a] text-white flex items-center justify-center text-[11px] font-bold shadow-sm flex-shrink-0">
                              {s.name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-gray-800 truncate leading-tight">{s.name}</div>
                            {s.staff_role && <div className="text-[9px] text-gray-400 truncate">{s.staff_role}</div>}
                          </div>
                        </div>
                        {/* Schedule cells */}
                        {dates.map((d, di) => {
                          const key = ds(d);
                          const cellKey = `${s.id}-${key}`;
                          const assignment = assigns.get(key);
                          const we = isWeekend(d);
                          const ho = isHoliday(d);
                          const td = isToday(d);
                          return (
                            <div key={di}
                              data-schedule-cell={cellKey}
                              className={`border-b border-l p-1 flex items-center justify-center min-h-[44px] transition-colors ${
                                td ? 'bg-[#00b8d4]/[0.12] border-l-[3px] border-l-[#00b8d4]/60' :
                                we ? 'bg-slate-200/50 border-l-slate-300/60' :
                                ho ? 'bg-amber-200/40 border-l-amber-300/60' :
                                'border-l-gray-100 hover:bg-gray-50'
                              }`}>
                              {assignment ? (
                                <div className="group/cell relative">
                                  <div className="px-2 py-1.5 rounded-lg text-[10px] font-bold text-white shadow-sm cursor-default hover:shadow-md transition-shadow"
                                    style={{ backgroundColor: assignment.shift_color }}
                                    title={`${assignment.shift_name}`}>
                                    {assignment.shift_abbr}
                                  </div>
                                  {canEdit && (
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(assignment.id); }}
                                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full items-center justify-center shadow opacity-0 group-hover/cell:flex hover:bg-red-600 transition-all">
                                      <X className="w-2.5 h-2.5 text-white" />
                                    </button>
                                  )}
                                </div>
                              ) : canEdit ? (
                                <button
                                  onClick={(e) => handleCellClick(s.id, key, e.currentTarget)}
                                  className="w-full h-full min-h-[36px] flex items-center justify-center rounded-lg border border-transparent hover:border-dashed hover:border-[#00b8d4]/30 hover:bg-[#00b8d4]/5 transition-all"
                                  title={selectedShiftId ? `Assign ${shiftTypeMap.get(selectedShiftId)?.name}` : 'Click to assign'}>
                                  <Plus className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                              ) : (
                                <div className="w-full h-full min-h-[36px]" />
                              )}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
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

      {/* Legend */}
      <div className="bg-white border-t border-gray-200/80 px-4 py-2.5 flex-shrink-0">
        <div className="max-w-[1800px] mx-auto flex items-center gap-5 flex-wrap">
          <div className="flex items-center gap-3.5 text-[10px] text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-md bg-[#00b8d4]/25 border-2 border-[#00b8d4]" /> Today
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-md bg-slate-300 border border-slate-400" /> Weekend
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-md bg-amber-200 border border-amber-400" /> Holiday
            </span>
          </div>
          <div className="h-4 w-px bg-gray-200" />
          <div className="flex items-center gap-2.5">
            {shiftTypes.map(st => (
              <span key={st.id} className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-600">
                <span className="w-3 h-3 rounded-md shadow-sm" style={{ backgroundColor: st.color }} />
                {st.abbreviation}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Shift Type Dropdown (portal-style, fixed position) */}
      {editingCell && dropdownPos && (
        <div
          className="shift-dropdown fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200 p-2 min-w-[180px]"
          style={{ top: dropdownPos.top, left: Math.min(dropdownPos.left, window.innerWidth - 200) }}
        >
          <div className="text-[10px] text-gray-400 font-medium px-2 pb-1.5 border-b border-gray-100 mb-1">Select Shift</div>
          <div className="grid grid-cols-2 gap-1">
            {shiftTypes.map(st => (
              <button
                key={st.id}
                onClick={() => {
                  const parts = editingCell.split('-');
                  const staffId = parseInt(parts[0]);
                  const date = parts.slice(1).join('-');
                  handleAssignFromDropdown(staffId, st.id, date);
                }}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-gray-100 transition-colors text-left"
              >
                <span className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center text-[8px] font-bold text-white"
                  style={{ backgroundColor: st.color }}>
                  {st.abbreviation.charAt(0)}
                </span>
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-gray-800 leading-tight">{st.name}</span>
                  <span className="text-[9px] text-gray-400">{st.abbreviation}</span>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => { setEditingCell(null); setDropdownPos(null); }}
            className="w-full mt-1.5 text-[10px] text-gray-400 hover:text-gray-600 py-1 text-center"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Change Log Modal */}
      {showChangeLog && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowChangeLog(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-gray-500" />
                <h3 className="text-sm font-bold text-gray-900">Change History</h3>
              </div>
              <button onClick={() => setShowChangeLog(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {changeLog.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">No changes recorded.</p>
              ) : (
                <div className="space-y-2">
                  {changeLog.map(entry => (
                    <div key={entry.id} className="flex items-start gap-3 px-4 py-3 bg-gray-50 rounded-xl">
                      <div className="text-[11px] text-gray-800">
                        <span className="font-semibold">{entry.changed_by_name || 'System'}</span>
                        {' '}{entry.action === 'create' ? 'assigned' : entry.action === 'delete' ? 'removed' : 'changed'}{' '}
                        <span className="font-medium">{entry.staff_name}</span> on {entry.schedule_date}
                        <div className="flex items-center gap-1 mt-1">
                          {entry.old_shift_name && (
                            <>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white" style={{ backgroundColor: entry.old_shift_color }}>{entry.old_shift_abbr}</span>
                              <span className="text-gray-400 text-[10px]">&rarr;</span>
                            </>
                          )}
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white" style={{ backgroundColor: entry.new_shift_color }}>{entry.new_shift_abbr}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 mt-1">{new Date(entry.changed_at).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Database records - searchable table of all form submissions with filtering
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Search, Calendar, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';
import ExcelJS from 'exceljs';
import { EthiopianDateDisplay } from '../../components/shared/date/EthiopianDateDisplay';
import { CustomSelect } from '../../components/shared/CustomSelect';
import { ethiopianStringToGregorianString, ETHIOPIAN_MONTHS, gregorianToEthiopian, ethiopianToGregorian, formatEthiopianDate, isValidEthiopianDate, EthiopianDate } from '../../utils/ethiopianCalendar';
import { apiGet } from '../../api';

function resolveApiBaseForFetch() {
  const configured = (import.meta as any)?.env?.VITE_API_URL || (import.meta as any)?.env?.VITE_API_BASE as string | undefined;
  if (configured) {
    return configured.startsWith('http') ? configured : configured.startsWith('/') ? configured : `/${configured}`;
  }
  if (typeof window !== 'undefined' && window.location?.pathname?.startsWith('/csms')) {
    return '/csms/api';
  }
  return '/api';
}

// Ethiopian calendar date picker that outputs DD-MM-YYYY format
function EthiopianDatePicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState<EthiopianDate>(() => {
    if (value) {
      const parts = value.split(/[^0-9]+/).filter(Boolean);
      if (parts.length === 3) {
        let d: number, m: number, y: number;
        if (/^\d{4}$/.test(parts[0])) { y = +parts[0]; m = +parts[1]; d = +parts[2]; }
        else { d = +parts[0]; m = +parts[1]; y = +parts[2]; }
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return { year: y, month: m, day: d };
      }
    }
    return gregorianToEthiopian(new Date());
  });

  const toEthStr = (e: EthiopianDate) => `${String(e.day).padStart(2, '0')}-${String(e.month).padStart(2, '0')}-${e.year}`;
  const gregPreview = (() => {
    try {
      if (!isValidEthiopianDate(temp)) return null;
      const g = ethiopianToGregorian(temp);
      return `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, '0')}-${String(g.getDate()).padStart(2, '0')}`;
    } catch { return null; }
  })();

  const days = Array.from({ length: temp.month === 13 ? (temp.year % 4 === 3 ? 6 : 5) : 30 }, (_, i) => i + 1);
  const years = Array.from({ length: 100 }, (_, i) => temp.year - 50 + i);

  const apply = (next?: EthiopianDate) => {
    const d = next || temp;
    if (isValidEthiopianDate(d)) {
      onChange(toEthStr(d));
      setOpen(false);
    }
  };

  return (
    <div className="w-full relative">
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <div className="relative">
        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
        <input
          type="text"
          readOnly
          value={value || ''}
          onClick={() => setOpen(true)}
          placeholder="DD-MM-YYYY"
          className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer bg-white"
        />
      </div>
      {value && gregPreview && <div className="text-xs text-gray-500 mt-1">Gregorian: {gregPreview}</div>}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl p-4 w-80">
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Day</label>
                <select value={temp.day} onChange={e => setTemp({ ...temp, day: +e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                  {days.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Month</label>
                <select value={temp.month} onChange={e => setTemp({ ...temp, month: +e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                  {ETHIOPIAN_MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Year</label>
                <select value={temp.year} onChange={e => setTemp({ ...temp, year: +e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div className="text-xs text-gray-500 text-center mb-3 pb-2 border-t pt-2">{formatEthiopianDate(temp, 'long')}</div>
            <div className="flex gap-2">
              <button onClick={() => { onChange(''); setOpen(false); }} className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Clear</button>
              <button onClick={() => apply()} className="flex-1 px-3 py-1.5 text-sm bg-[#003153] text-white rounded-lg hover:bg-[#00223b]">Apply</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Simple Ethiopian to Gregorian conversion (approximate, for filtering)
function ethiopianToGregorian(ethYear: number, ethMonth: number, ethDay: number): [number, number, number] {
  // Ethiopian New Year is September 11 (Gregorian) or September 12 in Gregorian leap years
  // Removed unused gregorianEpoch
  const ethiopianEpoch = 1724220;
  const jdn =
    ethDay +
    30 * (ethMonth - 1) +
    365 * (ethYear - 1) +
    Math.floor(ethYear / 4) +
    ethiopianEpoch - 1;
  // Convert JDN to Gregorian
  let r = 4 * (jdn + 68569) / 146097;
  r = Math.floor(r);
  let a = jdn + 68569 - Math.floor((146097 * r + 3) / 4);
  let b = 4000 * (a + 1) / 1461001;
  b = Math.floor(b);
  let c = a - Math.floor(1461 * b / 4) + 31;
  let d = 80 * c / 2447;
  d = Math.floor(d);
  const day = c - Math.floor(2447 * d / 80);
  const e = Math.floor(d / 11);
  const month = d + 2 - 12 * e;
  const year = 100 * (r - 49) + b + e;
  return [year, month, day];
}

function escape(str: any) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Removed unused toEthiopian function

// ethDate accepted formats (Ethiopian):
// - DD-MM-YYYY
// - DD/MM/YYYY
// - YYYY-MM-DD
// - YYYY/MM/DD
// Auto-detects whether first token is year or day based on 4-digit check
function toGregorianDateFromEthiopianInput(ethDate: string): Date | null {
  if (!ethDate) return null;
  const raw = String(ethDate).trim();
  // Try numeric forms first
  const tokens = raw.split(/[^0-9]+/).filter(Boolean);
  let d: number | null = null, m: number | null = null, y: number | null = null;
  if (tokens.length === 3) {
    if (/^\d{4}$/.test(tokens[0])) {
      y = Number(tokens[0]); m = Number(tokens[1]); d = Number(tokens[2]);
    } else {
      d = Number(tokens[0]); m = Number(tokens[1]); y = Number(tokens[2]);
    }
  }
  // If numeric parsing failed, try long month formats like 'Tikimt 20, 2018' or '20 Tikimt 2018'
  if (d === null || m === null || y === null || [d as any, m as any, y as any].some((n: any) => isNaN(Number(n)))) {
    const months = ETHIOPIAN_MONTHS.map(s => s.toLowerCase());
    const monthRegex = months.join('|');
    const r1 = new RegExp(`^\\s*(${monthRegex})\\s+(\\d{1,2}),?\\s*(\\d{4})\\s*$`, 'i');
    const r2 = new RegExp(`^\\s*(\\d{1,2})\\s+(${monthRegex}),?\\s*(\\d{4})\\s*$`, 'i');
    let mName: string | null = null, dayStr: string | null = null, yearStr: string | null = null;
    let match = raw.match(r1);
    if (match) {
      mName = match[1]; dayStr = match[2]; yearStr = match[3];
    } else {
      match = raw.match(r2);
      if (match) {
        dayStr = match[1]; mName = match[2]; yearStr = match[3];
      }
    }
    if (mName && dayStr && yearStr) {
      const idx = months.indexOf(mName.toLowerCase());
      if (idx >= 0) {
        m = idx + 1; d = Number(dayStr); y = Number(yearStr);
      }
    }
  }
  const yy = Number(y), mm = Number(m), dd = Number(d);
  if ([yy, mm, dd].some(n => isNaN(n) || !isFinite(n))) return null;
  try {
    // Build canonical DD/MM/YYYY for utils
    const ethStr = `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${yy}`;
    const gregStr = ethiopianStringToGregorianString(ethStr);
    if (!gregStr) return null;
    const dObj = new Date(gregStr);
    return isNaN(dObj.getTime()) ? null : dObj;
  } catch {
    return null;
  }
}


export const DatabaseRecords = () => {
  const { user } = useAuth() || { user: null };
  const isAdmin = (user?.role || '').toLowerCase() === 'admin';
  const [records, setRecords] = useState<any[]>([]);
  // Only show dynamic form records
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [viewRecord, setViewRecord] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const PAGE_SIZE = pageSize;
  const [smartQuery, setSmartQuery] = useState<string>('');
  const [totalServerRecords, setTotalServerRecords] = useState(0);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ fetched: 0, total: 0 });

  // Enforce non-admin max page size to 1000
  useEffect(() => {
    if (!isAdmin && pageSize > 1000) {
      setPageSize(1000);
      setPage(1);
    }
  }, [isAdmin, pageSize]);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Build template options from submissions so dropdown is never empty
  const submissionTemplates = useMemo(() => {
    const map = new Map<string, { id: string; name: string; department?: string }>();
    for (const rec of records) {
      const rawId = rec?.template_id ?? rec?.form_id ?? rec?.formId;
      // Prefer numeric id when available, otherwise fall back to template_name so dropdown is always populated
      const id: string | undefined = rawId != null ? String(rawId) : (rec?.template_name ? String(rec.template_name) : undefined);
      if (!id) continue;
      const name: string = rec?.template_name ?? `Form ${id}`;
      const department: string | undefined = rec?.template_department ?? rec?.department;
      if (!map.has(id)) {
        map.set(id, { id, name, department });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [records]);

  // Helper: record matches current template selection
  const matchesSelectedTemplate = (rec: any): boolean => {
    if (!selectedTemplateId) return true;
    // Match by numeric id if selected is numeric
    const isNumeric = /^\d+$/.test(selectedTemplateId);
    if (isNumeric) {
      const rid = rec?.template_id ?? rec?.form_id ?? rec?.formId;
      return String(rid ?? '') === selectedTemplateId;
    }
    // Otherwise match by template name
    const name: string = rec?.template_name ?? '';
    return String(name || '').toLowerCase() === selectedTemplateId.toLowerCase();
  };

  // Build department options based on selected template
  const relatedDepartments = useMemo(() => {
    const set = new Set<string>();
    for (const rec of records) {
      if (!matchesSelectedTemplate(rec)) continue;
      const dep: string | undefined = rec?.template_department ?? rec?.submitted_by_department ?? rec?.department;
      if (dep) set.add(String(dep));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [records, selectedTemplateId]);

  // Reset department if it no longer exists under the selected template
  useEffect(() => {
    if (selectedDepartment && !relatedDepartments.includes(selectedDepartment)) {
      setSelectedDepartment('');
    }
  }, [relatedDepartments, selectedDepartment]);

  // Build user options based on selected template and department
  const relatedUsers = useMemo(() => {
    const set = new Set<string>();
    for (const rec of records) {
      if (!matchesSelectedTemplate(rec)) continue;
      if (selectedDepartment) {
        const dep: string | undefined = rec?.template_department ?? rec?.submitted_by_department ?? rec?.department;
        if (!dep || String(dep) !== selectedDepartment) continue;
      }
      const userVal: string | undefined = rec?.submitted_by ?? rec?.created_by ?? rec?.createdBy ?? rec?.submittedBy ?? rec?.user;
      if (userVal) set.add(String(userVal));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [records, selectedTemplateId, selectedDepartment]);

  // Reset user if it no longer exists under the selected template/department
  useEffect(() => {
    if (selectedUser && !relatedUsers.includes(selectedUser)) {
      setSelectedUser('');
    }
  }, [relatedUsers, selectedUser]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, dateFrom, dateTo, selectedTemplateId, selectedDepartment, selectedUser]);

  // Fetch records from backend API (server-side paginated where supported)
  useEffect(() => {
    const fetchRecords = async () => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, string> = {};
        if (selectedTemplateId) {
          const maybeNum = Number(selectedTemplateId);
          if (!isNaN(maybeNum) && isFinite(maybeNum)) {
            params.formId = selectedTemplateId;
          }
        }
        if (searchTerm) params.search = searchTerm;
        if (selectedDepartment) params.department = selectedDepartment;
        if (selectedUser) params.user = selectedUser;
        if (dateFrom) {
          const fromDate = toGregorianDateFromEthiopianInput(dateFrom);
          if (fromDate && !isNaN(fromDate.getTime())) {
            const y = fromDate.getFullYear();
            const m = String(fromDate.getMonth() + 1).padStart(2, '0');
            const d = String(fromDate.getDate()).padStart(2, '0');
            params.dateFrom = `${y}-${m}-${d}`;
          }
        }
        if (dateTo) {
          const toDate = toGregorianDateFromEthiopianInput(dateTo);
          if (toDate && !isNaN(toDate.getTime())) {
            const y = toDate.getFullYear();
            const m = String(toDate.getMonth() + 1).padStart(2, '0');
            const d = String(toDate.getDate()).padStart(2, '0');
            params.dateTo = `${y}-${m}-${d}`;
          }
        }
        params.limit = String(PAGE_SIZE);
        params.page = String(page);
        if (!isAdmin && user?.department) params.department = String(user.department);
        if (!isAdmin && user?.id) params.parentUserId = String(user.id);

        const qs = new URLSearchParams(params).toString();
        const data = await apiGet(`/form-submissions?${qs}`);
        setRecords(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setError(err.message || 'Error fetching records');
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, [searchTerm, dateFrom, dateTo, user, selectedTemplateId, page, refreshKey, selectedDepartment, selectedUser]);

  // Helper: Ethiopian string DD-MM-YYYY from Gregorian Date
  const toEthInput = (g: Date): string => {
    const eth = gregorianToEthiopian(g);
    const dd = String(eth.day).padStart(2, '0');
    const mm = String(eth.month).padStart(2, '0');
    const yy = String(eth.year);
    return `${dd}-${mm}-${yy}`;
  };

  // Apply Smart Search: parses Ethiopian date range or free text (MRN/name handled by backend search)
  const applySmartSearch = () => {
    const q = String(smartQuery || '').trim();
    if (!q) return;
    // Reset current filters
    setSearchTerm('');
    setDateFrom('');
    setDateTo('');

    // last:Nd or last:Nm
    const lastMatch = q.match(/^last\s*:\s*(\d+)\s*([dm])$/i);
    if (lastMatch) {
      const n = Number(lastMatch[1]);
      const unit = lastMatch[2].toLowerCase();
      const now = new Date();
      const from = new Date(now);
      if (unit === 'd') from.setDate(now.getDate() - (n - 1));
      else if (unit === 'm') from.setMonth(now.getMonth() - (n - 1));
      setDateFrom(toEthInput(from));
      setDateTo(toEthInput(now));
      setPage(1);
      return;
    }

    // Range with '-' in between: try parse two Ethiopian dates (long or numeric)
    const parts = q.split(/\s*-\s*/);
    if (parts.length === 2) {
      const g1 = toGregorianDateFromEthiopianInput(parts[0]);
      const g2 = toGregorianDateFromEthiopianInput(parts[1]);
      if (g1 && g2) {
        const from = g1.getTime() <= g2.getTime() ? g1 : g2;
        const to = g1.getTime() <= g2.getTime() ? g2 : g1;
        setDateFrom(toEthInput(from));
        setDateTo(toEthInput(to));
        setPage(1);
        return;
      }
    }

    // Single date: Ethiopian long or numeric
    const g1 = toGregorianDateFromEthiopianInput(q);
    if (g1) {
      setDateFrom(toEthInput(g1));
      setDateTo(toEthInput(g1));
      setPage(1);
      return;
    }

    // Everything else (MRN, patient name, free text) → general search
    setSearchTerm(q);
    setPage(1);
  };

  let baseRecords: any[] = records;

  // Filter by selected template if set (client-side for non-numeric template names)
  let filteredRecords = baseRecords;
  if (selectedTemplateId) {
    const selectedNum = Number(selectedTemplateId);
    const isNumericSel = !isNaN(selectedNum) && isFinite(selectedNum);
    filteredRecords = filteredRecords.filter((rec: any) => {
      const recId = rec?.template_id ?? rec?.form_id ?? rec?.formId;
      const recName = rec?.template_name;
      if (isNumericSel) {
        return Number(recId) === selectedNum;
      }
      return typeof recName === 'string' && recName.toLowerCase() === selectedTemplateId.toLowerCase();
    });
  }
  // Filter by selected department (client-side for dropdown)
  if (selectedDepartment) {
    filteredRecords = filteredRecords.filter((rec: any) => {
      const dept = rec?.template_department || rec?.submitted_by_department || rec?.department;
      return typeof dept === 'string' && dept.toLowerCase() === selectedDepartment.toLowerCase();
    });
  }
  // Filter by selected user (client-side for dropdown)
  if (selectedUser) {
    filteredRecords = filteredRecords.filter((rec: any) => {
      const userName = rec?.submitted_by || rec?.created_by || rec?.createdBy || rec?.submittedBy || rec?.user;
      return typeof userName === 'string' && userName.toLowerCase() === selectedUser.toLowerCase();
    });
  }
  // Sort by newest for stable display
  filteredRecords = filteredRecords
    .slice()
    .sort((a, b) => {
      const aDate = new Date(a.submitted_at || a.created_at || 0).getTime();
      const bDate = new Date(b.submitted_at || b.created_at || 0).getTime();
      return bDate - aDate;
    });

  // Helper to get stable record id
  const getRecordId = (rec: any, idx: number): string => {
    const base = rec?.id ?? `${rec?.template_id ?? rec?.form_id ?? rec?.formId ?? 'form'}_${rec?.submitted_at ?? rec?.created_at ?? rec?.createdAt ?? rec?.timestamp ?? idx}`;
    return String(base);
  };

  // selection helpers (defined later after dateFilteredRecords)
  const toggleRow = (rec: any, idx: number) => {
    const id = getRecordId(rec, idx);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  // Core table columns only — full form answers are available via the View modal.
  // (Previously every form_data key was a column, producing an unwieldy header.)
  let allKeys: string[] = ['id', 'template_name', 'template_department', 'submitted_by', 'submitted_at'];

  // Server-side pagination: backend handles date/search/MRN filtering
  const totalAfterFilter = totalServerRecords || filteredRecords.length;
  const displayedRecords = filteredRecords;
  const hasNextPage = displayedRecords.length === PAGE_SIZE;

  const isAllSelected = displayedRecords.length > 0 && displayedRecords.every((rec: any, idx: number) => selectedIds.has(getRecordId(rec, idx)));
  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (isAllSelected) {
        displayedRecords.forEach((rec: any, idx: number) => next.delete(getRecordId(rec, idx)));
      } else {
        displayedRecords.forEach((rec: any, idx: number) => next.add(getRecordId(rec, idx)));
      }
      return next;
    });
  };

  const exportToCSV = async () => {
    if (filteredRecords.length === 0) return;
    const ok = window.confirm(`Export ${filteredRecords.length} record(s) to Excel?`);
    if (!ok) return;

    const { gregorianToEthiopian, formatEthiopianDate, gregorianToEthiopianDateTime } = await import('../../utils/ethiopianCalendar');

    // Collect all unique form_data keys across all records
    const formDataKeysSet = new Set<string>();
    filteredRecords.forEach(rec => {
      if (rec.form_data && typeof rec.form_data === 'object') {
        Object.keys(rec.form_data).forEach(k => formDataKeysSet.add(k));
      }
    });
    const formDataKeys = Array.from(formDataKeysSet);

    const metaColumns = ['#', 'Template', 'Department', 'Submitted By', 'Role', 'Profession', 'Gregorian Date', 'Ethiopian Date'];
    const allColumns = [...metaColumns, ...formDataKeys];

    const wb = new ExcelJS.Workbook();
    wb.creator = 'ISBAR-CSMS';
    wb.created = new Date();
    const ws = wb.addWorksheet('Records', {
      views: [{ state: 'frozen', ySplit: 2 }],
      properties: { defaultColWidth: 14 },
    });

    // ── Title row ──
    const titleRow = ws.addRow([`ISBAR Records Export — ${filteredRecords.length} records — ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`]);
    ws.mergeCells(titleRow.number, 1, titleRow.number, allColumns.length);
    titleRow.height = 32;
    titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1F2937' } };
    titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } };

    // ── Header row ──
    const headerRow = ws.addRow(allColumns);
    headerRow.height = 28;
    headerRow.eachCell((cell, colNum) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF09B8A0' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Calibri' };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF067D6A' } },
        bottom: { style: 'medium', color: { argb: 'FF067D6A' } },
        left: { style: 'thin', color: { argb: 'FF067D6A' } },
        right: { style: 'thin', color: { argb: 'FF067D6A' } },
      };
    });

    // ── Data rows ──
    const ETH_GREEN = 'FF09B8A0';
    const GRAY_50 = 'FFF9FAFB';
    const GRAY_100 = 'FFF3F4F6';
    const GRAY_600 = 'FF4B5563';
    const GRAY_800 = 'FF1F2937';

    filteredRecords.forEach((rec, rowIdx) => {
      const fd = rec.form_data && typeof rec.form_data === 'object' ? rec.form_data : {};
      const submittedAt = rec.submitted_at || rec.submittedAt || rec.created_at || '';

      let gregDate = '';
      let ethDate = '';
      if (submittedAt) {
        try {
          const d = new Date(new Date(submittedAt).getTime() + 3 * 3600 * 1000);
          if (!isNaN(d.getTime())) {
            gregDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
              ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            const eth = gregorianToEthiopian(d);
            ethDate = formatEthiopianDate(eth, 'long');
          }
        } catch { gregDate = String(submittedAt); }
      }

      const rowNum = rowIdx + 1;
      const values = [
        rowNum,
        rec.template_name ?? '',
        rec.template_department ?? rec.submitted_by_department ?? '',
        rec.submitted_by_name ?? rec.submitted_by ?? '',
        rec.submitted_by ?? '',
        rec.submitted_by_profession ?? '',
        gregDate,
        ethDate,
        ...formDataKeys.map(k => {
          const v = fd[k];
          if (v === null || v === undefined) return '';
          if (typeof v === 'object') return JSON.stringify(v);
          return String(v);
        }),
      ];

      const row = ws.addRow(values);
      const isEven = rowIdx % 2 === 0;
      row.height = 22;

      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.font = { size: 10, name: 'Calibri', color: { argb: GRAY_800 } };
        cell.alignment = { vertical: 'middle', wrapText: true };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFF3F4F6' } },
          right: { style: 'thin', color: { argb: 'FFF3F4F6' } },
        };

        // Alternating row background
        if (isEven) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_50 } };
        }

        // Row number column — green text
        if (colNum === 1) {
          cell.font = { size: 10, name: 'Calibri', color: { argb: ETH_GREEN }, bold: true };
          cell.alignment = { horizontal: 'center' };
        }

        // Template column — bold
        if (colNum === 2) {
          cell.font = { size: 10, name: 'Calibri', bold: true, color: { argb: GRAY_800 } };
        }

        // Gregorian date — gray
        if (colNum === 7) {
          cell.font = { size: 9, name: 'Calibri', color: { argb: GRAY_600 } };
        }

        // Ethiopian date — brand green italic
        if (colNum === 8) {
          cell.font = { size: 9, name: 'Calibri', italic: true, color: { argb: ETH_GREEN } };
        }
      });
    });

    // ── Auto-fit column widths ──
    ws.columns.forEach((col, idx) => {
      if (!col) return;
      let maxLen = 8;
      col.eachCell({ includeEmpty: false }, (cell) => {
        const val = String(cell.value ?? '');
        maxLen = Math.max(maxLen, Math.min(val.length + 3, 45));
      });
      // Fixed widths for known columns
      if (idx === 0) col.width = 5;   // #
      if (idx === 1) col.width = 24;  // Template
      if (idx === 2) col.width = 16;  // Department
      if (idx === 3) col.width = 16;  // Submitted By Name
      if (idx === 4) col.width = 14;  // Submitted By
      if (idx === 5) col.width = 14;  // Profession
      if (idx === 6) col.width = 22;  // Gregorian Date
      if (idx === 7) col.width = 24;  // Ethiopian Date
      else if (idx >= 8) col.width = maxLen;
    });

    // ── Bottom border on last row ──
    const lastRow = ws.lastRow;
    if (lastRow) {
      lastRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          ...cell.border,
          bottom: { style: 'medium', color: { argb: ETH_GREEN } },
        };
      });
    }

    // ── Auto-filter on header ──
    ws.autoFilter = {
      from: { row: 2, column: 1 },
      to: { row: 2, column: allColumns.length },
    };

    const fileName = `ISBAR_Records_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    // Collect ids of currently displayed records that are selected and have a real numeric/string id
    const idsToDelete: string[] = [];
    displayedRecords.forEach((rec: any, idx: number) => {
      const selKey = getRecordId(rec, idx);
      if (selectedIds.has(selKey) && rec?.id != null) idsToDelete.push(String(rec.id));
    });
    if (idsToDelete.length === 0) return;
    const ok = window.confirm(`Delete ${idsToDelete.length} record(s) permanently?`);
    if (!ok) return;
    try {
      // Perform deletes sequentially to simplify error handling
      for (const id of idsToDelete) {
        const res = await fetch(`/api/form-submissions/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(await res.text());
      }
      // Clear selection and refresh list
      setSelectedIds(new Set());
      setRefreshKey(k => k + 1);
    } catch (e: any) {
      alert('Failed to delete some records: ' + (e?.message || e));
    }
  };

  const handleDelete = async (id: string) => {
    if (!id) return;
    const ok = window.confirm('Delete this record permanently?');
    if (!ok) return;
    try {
      const res = await fetch(`/api/form-submissions/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      setRefreshKey(k => k + 1);
    } catch (e: any) {
      alert('Failed to delete: ' + (e?.message || e));
    }
  };

  // Refetch templates after activation (listen for custom event or poll, or add a button if needed)
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#003153] rounded-xl">
            <Search className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">ISBAR Records Database</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              View and search all handover records for{' '}
              {user?.role === 'admin' ? 'all departments' : user?.department || 'General'}
            </p>
          </div>
        </div>
      </div>

      {/* Selection Actions and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="space-y-4">
          {/* Row: Template */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <input type="checkbox" className="h-4 w-4" checked={isAllSelected} onChange={toggleSelectAll} />
              <button onClick={exportToCSV} disabled={filteredRecords.length === 0} className={`px-3 py-2 rounded-lg border ${filteredRecords.length === 0 ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>Export</button>
              <button onClick={deleteSelected} disabled={selectedIds.size === 0} className={`px-3 py-2 rounded-lg text-white ${selectedIds.size === 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'}`}>Delete selected</button>
            </div>
            <div className="w-full">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Template</label>
              <CustomSelect
                value={selectedTemplateId}
                onChange={setSelectedTemplateId}
                options={[
                  { value: '', label: 'All Templates' },
                  ...submissionTemplates.map(t => ({
                    value: t.id, label: `${t.name}${t.department ? ` (${t.department})` : ''}`
                  })),
                ]}
              />
            </div>
            <div className="w-40">
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Per page</label>
              <CustomSelect
                value={String(pageSize)}
                onChange={(v) => { setPageSize(Number(v)); setPage(1); }}
                options={[
                  { value: '50', label: '50' },
                  { value: '100', label: '100' },
                  { value: '200', label: '200' },
                  { value: '500', label: '500' },
                  { value: '1000', label: '1000' },
                  ...(isAdmin ? [{ value: '5000', label: '5000' }, { value: '10000', label: '10000' }] : []),
                ]}
              />
            </div>
          </div>
          {/* Row: Department (options related to selected template) */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <input type="checkbox" className="h-4 w-4" checked={isAllSelected} onChange={toggleSelectAll} />
              <button onClick={exportToCSV} disabled={filteredRecords.length === 0} className={`px-3 py-2 rounded-lg border ${filteredRecords.length === 0 ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>Export</button>
              <button onClick={deleteSelected} disabled={selectedIds.size === 0} className={`px-3 py-2 rounded-lg text-white ${selectedIds.size === 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'}`}>Delete selected</button>
            </div>
            <div className="w-full">
              <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
              <CustomSelect
                value={selectedDepartment}
                onChange={setSelectedDepartment}
                options={[
                  { value: '', label: 'All Departments' },
                  ...relatedDepartments.map(dep => ({ value: dep, label: dep })),
                ]}
              />
            </div>
          </div>
          {/* Row: User (options related to selected template and department) */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <input type="checkbox" className="h-4 w-4" checked={isAllSelected} onChange={toggleSelectAll} />
              <button onClick={exportToCSV} disabled={filteredRecords.length === 0} className={`px-3 py-2 rounded-lg border ${filteredRecords.length === 0 ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>Export</button>
              <button onClick={deleteSelected} disabled={selectedIds.size === 0} className={`px-3 py-2 rounded-lg text-white ${selectedIds.size === 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'}`}>Delete selected</button>
            </div>
            <div className="w-full">
              <label className="block text-xs font-medium text-gray-600 mb-1">User</label>
              <CustomSelect
                value={selectedUser}
                onChange={setSelectedUser}
                options={[
                  { value: '', label: 'All Users' },
                  ...relatedUsers.map(u => ({ value: u, label: u })),
                ]}
              />
            </div>
          </div>
          {/* Row: Search */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <input type="checkbox" className="h-4 w-4" checked={isAllSelected} onChange={toggleSelectAll} />
              <button onClick={exportToCSV} className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Export</button>
              <button onClick={deleteSelected} disabled={selectedIds.size === 0} className={`px-3 py-2 rounded-lg text-white ${selectedIds.size === 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'}`}>Delete selected</button>
            </div>
            <div className="w-full">
              <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="text" placeholder="Search by MRN, patient name, template..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
            </div>
          </div>
          {/* Row: Date From (Eth) */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <input type="checkbox" className="h-4 w-4" checked={isAllSelected} onChange={toggleSelectAll} />
              <button onClick={exportToCSV} className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Export</button>
              <button onClick={deleteSelected} disabled={selectedIds.size === 0} className={`px-3 py-2 rounded-lg text-white ${selectedIds.size === 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'}`}>Delete selected</button>
            </div>
            <EthiopianDatePicker label="Date From (Eth)" value={dateFrom} onChange={setDateFrom} />
          </div>
          {/* Row: Date To (Eth) */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <input type="checkbox" className="h-4 w-4" checked={isAllSelected} onChange={toggleSelectAll} />
              <button onClick={exportToCSV} className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Export</button>
              <button onClick={deleteSelected} disabled={selectedIds.size === 0} className={`px-3 py-2 rounded-lg text-white ${selectedIds.size === 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'}`}>Delete selected</button>
            </div>
            <EthiopianDatePicker label="Date To (Eth)" value={dateTo} onChange={setDateTo} />
          </div>
          {/* Row: Quick Ranges */}
          <div className="flex flex-wrap items-center gap-2">
            <button className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50" onClick={() => {
              const now = new Date();
              const from = new Date(now); from.setDate(now.getDate() - 6);
              setDateFrom(toEthInput(from)); setDateTo(toEthInput(now)); setPage(1);
            }}>Last week</button>
            <button className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50" onClick={() => {
              const now = new Date();
              const from = new Date(now); from.setDate(now.getDate() - 29);
              setDateFrom(toEthInput(from)); setDateTo(toEthInput(now)); setPage(1);
            }}>Last month</button>
            {isAdmin && <>
              <button className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50" onClick={() => {
                const now = new Date();
                const from = new Date(now); from.setFullYear(now.getFullYear() - 1);
                setDateFrom(toEthInput(from)); setDateTo(toEthInput(now)); setPage(1);
              }}>Last year</button>
              <button className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50" onClick={() => {
                setDateFrom(''); setDateTo(''); setPage(1);
              }}>All time</button>
              <div className="w-px h-5 bg-gray-300 mx-1"></div>
              <button
                className={`px-3 py-1.5 rounded border ${batchLoading ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'border-brand text-brand hover:bg-brand-50'}`}
                disabled={batchLoading}
                onClick={async () => {
                  setBatchLoading(true);
                  setBatchProgress({ fetched: 0, total: 0 });
                  try {
                    const params: Record<string, string> = {};
                    if (selectedTemplateId) {
                      const maybeNum = Number(selectedTemplateId);
                      if (!isNaN(maybeNum) && isFinite(maybeNum)) params.formId = selectedTemplateId;
                    }
                    if (searchTerm) params.search = searchTerm;
                    if (dateFrom) {
                      const g = toGregorianDateFromEthiopianInput(dateFrom);
                      if (g) {
                        const y = g.getFullYear(); const m = String(g.getMonth() + 1).padStart(2, '0'); const d = String(g.getDate()).padStart(2, '0');
                        params.dateFrom = `${y}-${m}-${d}`;
                      }
                    }
                    if (dateTo) {
                      const g = toGregorianDateFromEthiopianInput(dateTo);
                      if (g) {
                        const y = g.getFullYear(); const m = String(g.getMonth() + 1).padStart(2, '0'); const d = String(g.getDate()).padStart(2, '0');
                        params.dateTo = `${y}-${m}-${d}`;
                      }
                    }
                    const BATCH_SIZE = 500;
                    const apiBase = resolveApiBaseForFetch();
                    const url = `${apiBase}/form-submissions`;
                    const buildQuery = (obj: Record<string, string>) => url + '?' + new URLSearchParams(obj).toString();

                    // First fetch to get total count
                    const firstRes = await fetch(buildQuery({ ...params, limit: String(BATCH_SIZE), page: '1' }));
                    if (!firstRes.ok) throw new Error('Failed to fetch records');
                    const totalCount = parseInt(firstRes.headers.get('X-Total-Count') || '0');
                    const firstData = await firstRes.json();
                    if (!Array.isArray(firstData)) throw new Error('Unexpected response');

                    const allRecords: any[] = [...firstData];
                    setBatchProgress({ fetched: firstData.length, total: totalCount });

                    // Use cursor-based pagination for remaining pages
                    let cursor = firstRes.headers.get('X-Next-Cursor') || '';
                    const seenIds = new Set(firstData.map((r: any) => r.id));

                    while (cursor) {
                      const res = await fetch(buildQuery({ ...params, cursor, limit: String(BATCH_SIZE) }));
                      if (!res.ok) break;
                      const pageData = await res.json();
                      if (!Array.isArray(pageData) || pageData.length === 0) break;
                      let added = 0;
                      for (const rec of pageData) {
                        if (!seenIds.has(rec.id)) { seenIds.add(rec.id); allRecords.push(rec); added++; }
                      }
                      setBatchProgress({ fetched: allRecords.length, total: totalCount });
                      cursor = res.headers.get('X-Next-Cursor') || '';
                      if (added === 0 || !cursor) break;
                      await new Promise(r => setTimeout(r, 0));
                    }

                    setRecords(allRecords);
                    setTotalServerRecords(allRecords.length);
                    setPage(1);
                  } catch (e: any) {
                    setError(e?.message || 'Batch load failed');
                  } finally {
                    setBatchLoading(false);
                  }
                }}
              >
                {batchLoading ? `Loading… ${batchProgress.fetched}/${batchProgress.total}` : 'Load all'}
              </button>
            </>}
          </div>
        </div>
        <div className="mt-4 text-sm text-gray-500 text-right">
          <span className="font-medium text-gray-900">{totalAfterFilter}</span> records found
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-xl shadow-sm p-4 overflow-x-auto">
        {loading ? (
          <div className="p-8 space-y-3">
            <div className="h-4 bg-gray-100 rounded w-1/3 mb-4" />
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-3 bg-gray-50 rounded w-16" />
                <div className="h-3 bg-gray-50 rounded w-32" />
                <div className="h-3 bg-gray-50 rounded w-24" />
                <div className="h-3 bg-gray-50 rounded w-20" />
                <div className="h-3 bg-gray-50 rounded w-28" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center p-8">
            <h3 className="text-lg font-medium text-red-600 mb-2">{error}</h3>
          </div>
        ) : displayedRecords.length === 0 ? (
          <div className="text-center p-8">
            <Search className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No records found</h3>
            <p className="text-gray-500">Try adjusting your search criteria or date filter.</p>
          </div>
        ) : (
          <table className="min-w-full border text-xs">
            <thead className="bg-[#003153]">
              <tr>
                <th className="px-2 py-2 border-b border-[#003153]/60 w-8">
                  <input type="checkbox" checked={isAllSelected} onChange={toggleSelectAll} />
                </th>
                {allKeys.map(key => {
                  const labelMap: Record<string, string> = {
                    'submitted_by': 'Submitted By (User)',
                    'submitted_at': 'Submitted At',
                    'template_name': 'Template',
                    'template_department': 'Department',
                    'id': 'ID'
                  };
                  return <th key={key} className="px-2 py-2 border-b border-[#003153]/60 text-left text-[10px] font-bold uppercase tracking-wider text-white/80 whitespace-nowrap">{labelMap[key] || escape(key)}</th>;
                })}
                <th className="px-2 py-2 border-b border-[#003153]/60 text-left text-[10px] font-bold uppercase tracking-wider text-white/80">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayedRecords.map((record, idx) => (
                <tr key={record.id || idx} className="hover:bg-blue-50/50 transition-colors">
                  <td className="px-2 py-2 border-b border-gray-100 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(getRecordId(record, idx))}
                      onChange={() => toggleRow(record, idx)}
                    />
                  </td>
                  {allKeys.map(key => {
                    let value;
                    if (key in record) {
                      value = record[key];
                    } else if (record.form_data && key in record.form_data) {
                      value = record.form_data[key];
                    } else {
                      value = '';
                    }
                    const isSubmittedAt = String(key).toLowerCase() === 'submitted_at';
                    const submittedRaw = isSubmittedAt
                      ? (record.submitted_at || record.submittedAt || record.updated_at || record.updatedAt || record.created_at || record.createdAt || record.date || record.timestamp)
                      : null;
                    const isSubmittedBy = String(key).toLowerCase() === 'submitted_by';
                    const cellContent = isSubmittedAt
                      ? (submittedRaw ? <EthiopianDateDisplay date={submittedRaw as any} format="long" /> : '—')
                      : isSubmittedBy
                        ? escape(record.submitted_by_name || record.submitted_by || value)
                        : Array.isArray(value)
                          ? value.join(', ')
                          : typeof value === 'object' && value !== null
                            ? <span className="text-gray-400">[object]</span>
                            : escape(value);
                    const titleText = isSubmittedAt
                      ? (submittedRaw ? undefined : '—')
                      : isSubmittedBy
                        ? (record.submitted_by_name ? `${record.submitted_by_name} (${record.submitted_by})` : value)
                        : Array.isArray(value)
                          ? value.join(', ')
                          : typeof value === 'object' && value !== null
                            ? JSON.stringify(value)
                            : escape(value);
                    return (
                      <td key={key} className="px-2 py-2 border-b border-gray-100 truncate max-w-xs" title={titleText as any}>
                        {cellContent}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 border-b border-gray-100 whitespace-nowrap">
                    <button className="text-blue-600 hover:underline mr-2" onClick={() => setViewRecord(record)}>View</button>
                    <button className="text-red-600 hover:underline" onClick={() => handleDelete(record.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {/* Pagination controls */}
        <div className="mt-3 flex items-center justify-between text-sm">
          <div className="text-gray-600">Page {page}</div>
          <div className="flex items-center gap-1">
            <button className="px-2 py-1 border rounded disabled:opacity-50" onClick={() => setPage(1)} disabled={page <= 1}><ChevronsLeft className="w-4 h-4" /></button>
            <button className="px-2 py-1 border rounded disabled:opacity-50" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}><ChevronLeft className="w-4 h-4" /></button>
            <button className="px-2 py-1 border rounded disabled:opacity-50" onClick={() => setPage(p => p + 1)} disabled={!hasNextPage}><ChevronRight className="w-4 h-4" /></button>
            <button className="px-2 py-1 border rounded disabled:opacity-50" onClick={() => setPage(p => p + 10)} disabled={!hasNextPage}><ChevronsRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* View Record Modal */}
      {viewRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4 sm:p-6">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl relative max-h-[90vh] flex flex-col">
            <div className="sticky top-0 bg-white border-b rounded-t-lg pl-6 pr-12 py-3">
              <h3 className="text-xl font-bold">ISBAR Record Details</h3>
              <button
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-2xl"
                onClick={() => setViewRecord(null)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              {/* Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-sm">
                <div>
                  <div className="text-gray-500">Template</div>
                  <div className="font-medium text-gray-900">{viewRecord?.template_name || '—'}</div>
                </div>
                <div>
                  <div className="text-gray-500">Department</div>
                  <div className="font-medium text-gray-900">{viewRecord?.template_department || viewRecord?.submitted_by_department || '—'}</div>
                </div>
                <div>
                  <div className="text-gray-500">Submitted By</div>
                  <div className="font-medium text-gray-900">{viewRecord?.submitted_by_name || viewRecord?.submitted_by || '—'}</div>
                </div>
                <div>
                  <div className="text-gray-500">Submitted At</div>
                  <div className="font-medium text-gray-900">{viewRecord?.submitted_at ? <EthiopianDateDisplay date={viewRecord.submitted_at} format="long" /> : '—'}</div>
                </div>
              </div>

              {/* Form Fields */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Form Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(viewRecord?.form_data || {}).map(([key, val]) => (
                    <div key={key} className="border rounded-lg p-3 bg-gray-50">
                      <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">{key}</div>
                      <div className="text-sm text-gray-900 break-words">
                        {Array.isArray(val)
                          ? (val as any[]).join(', ')
                          : typeof val === 'boolean'
                            ? (val ? 'Yes' : 'No')
                            : val === null || val === undefined
                              ? '—'
                              : typeof val === 'object'
                                ? <code className="text-xs">{JSON.stringify(val)}</code>
                                : String(val)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

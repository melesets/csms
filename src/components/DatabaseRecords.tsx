import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import IsbarLoader from './IsbarLoader';
import { Search, Calendar, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';
import { EthiopianDateDisplay } from './EthiopianDateDisplay';
import { ethiopianStringToGregorianString, ETHIOPIAN_MONTHS, gregorianToEthiopian, formatEthiopianDate } from '../utils/ethiopianCalendar';

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
  if (d === null || m === null || y === null || [d as any,m as any,y as any].some((n: any) => isNaN(Number(n)))) {
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
    const ethStr = `${String(dd).padStart(2,'0')}/${String(mm).padStart(2,'0')}/${yy}`;
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
  // Removed resourceRecords, only dynamic records are used
  // Only show dynamic form records
  const [searchTerm, setSearchTerm] = useState('');
  const [mrnSearch, setMrnSearch] = useState('');
  // Remove stability filter
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [viewRecord, setViewRecord] = useState<any | null>(null);
  const [rawRecord, setRawRecord] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const PAGE_SIZE = pageSize;
  const [smartQuery, setSmartQuery] = useState<string>('');
  const [deepRecords, setDeepRecords] = useState<any[] | null>(null);
  const [deepLoading, setDeepLoading] = useState(false);
  const [deepPageFetched, setDeepPageFetched] = useState(0);

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
  }, [searchTerm, mrnSearch, dateFrom, dateTo, selectedTemplateId, selectedDepartment, selectedUser]);

  // Clear deep search cache when filters change
  useEffect(() => {
    setDeepRecords(null);
    setDeepPageFetched(0);
  }, [searchTerm, mrnSearch, dateFrom, dateTo, selectedTemplateId, selectedDepartment, selectedUser, pageSize]);

  // Fetch records from backend API (server-side paginated where supported)
  useEffect(() => {
    const fetchRecords = async () => {
      setLoading(true);
      setError(null);
      try {
        let url = '/api/form-submissions';
        const params: Record<string, string> = {};
        if (selectedTemplateId) {
          // Only pass numeric formId to backend if selection is numeric; otherwise rely on client-side filter
          const maybeNum = Number(selectedTemplateId);
          if (!isNaN(maybeNum) && isFinite(maybeNum)) {
            params.formId = selectedTemplateId;
          }
        }
        if (searchTerm) params.search = searchTerm;
        if (mrnSearch) params.mrn = mrnSearch;
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
        // Pagination params (server-side). Backend may ignore; client will still cap as fallback.
        const filtersActive = Boolean(searchTerm || mrnSearch || dateFrom || dateTo);
        params.limit = String(PAGE_SIZE);
        params.page = String(page);
        // Server-side scoping for non-admins
        if (!isAdmin && user?.department) params.department = String(user.department);
        if (!isAdmin && user?.profession) params.profession = String(user.profession);

        // Helpers to try page-based first, then offset-based as compatibility fallback
        const buildQuery = (obj: Record<string,string>) => url + '?' + new URLSearchParams(obj).toString();
        const fetchWithQuery = async (queryObj: Record<string, string>) => {
          const res = await fetch(buildQuery(queryObj));
          if (!res.ok) throw new Error('Failed to fetch records');
          return await res.json();
        };

        // Try standard page-based pagination
        let data: any[] = await fetchWithQuery({ ...params, page: String(page), limit: String(PAGE_SIZE) });
        // If requesting page > 1 returns empty (or identical set length as page 1 repeatedly), try offset fallback
        if (page > 1 && (!Array.isArray(data) || data.length === 0)) {
          const offset = String((page - 1) * PAGE_SIZE);
          const altParams = { ...params };
          delete (altParams as any).page;
          (altParams as any).offset = offset;
          (altParams as any).limit = String(PAGE_SIZE);
          const alt = await fetchWithQuery(altParams);
          if (Array.isArray(alt) && alt.length > 0) {
            data = alt;
          }
        }

        // Client-side safety net: enforce department and profession, if present
        const dept = user?.department ? String(user.department).toLowerCase() : null;
        const prof = user?.profession ? String(user.profession).toLowerCase() : null;
        const deptScoped = (isAdmin || !dept)
          ? data
          : data.filter((rec: any) =>
              [rec.template_department, rec.submitted_by_department, rec.department]
                .map((v: any) => (v ? String(v).toLowerCase() : ''))
                .includes(String(dept).toLowerCase())
            );

        const finalScoped = (!prof || isAdmin)
          ? deptScoped
          : deptScoped.filter((rec: any) => {
              const tp = rec.template_profession ? String(rec.template_profession).toLowerCase() : null;
              const sp = rec.submitted_by_profession ? String(rec.submitted_by_profession).toLowerCase() : null;
              // Template profession null means applies to all; submission profession null is legacy, allow only if template matches
              const templateOk = !tp || tp === prof;
              const submissionOk = !sp || sp === prof;
              return templateOk && submissionOk;
            });

        setRecords(finalScoped);
      } catch (err: any) {
        setError(err.message || 'Error fetching records');
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, [searchTerm, mrnSearch, dateFrom, dateTo, user, selectedTemplateId, page, refreshKey]);

  // Helper: Ethiopian string DD-MM-YYYY from Gregorian Date
  const toEthInput = (g: Date): string => {
    const eth = gregorianToEthiopian(g);
    const dd = String(eth.day).padStart(2, '0');
    const mm = String(eth.month).padStart(2, '0');
    const yy = String(eth.year);
    return `${dd}-${mm}-${yy}`;
  };

  // Apply Smart Search: parses MRN, Ethiopian date range, or free text
  const applySmartSearch = () => {
    const q = String(smartQuery || '').trim();
    if (!q) return;
    // Reset current filters
    setMrnSearch('');
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

    // Numeric looks like MRN (>=4 digits)
    if (/^\d{4,}$/.test(q)) {
      setMrnSearch(q);
      setPage(1);
      return;
    }

    // Fallback: general text search
    setSearchTerm(q);
    setPage(1);
  };

  let baseRecords: any[] = records;
  if (deepRecords) baseRecords = deepRecords;

  // Filter by selected template if set
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
      // Non-numeric selection: match by template_name (case-insensitive)
      return typeof recName === 'string' && recName.toLowerCase() === selectedTemplateId.toLowerCase();
    });
  }
  // Filter by selected department
  if (selectedDepartment) {
    filteredRecords = filteredRecords.filter((rec: any) => {
      const dept = rec?.template_department || rec?.submitted_by_department || rec?.department;
      return typeof dept === 'string' && dept.toLowerCase() === selectedDepartment.toLowerCase();
    });
  }
  // Filter by selected user
  if (selectedUser) {
    filteredRecords = filteredRecords.filter((rec: any) => {
      const userName = rec?.submitted_by || rec?.created_by || rec?.createdBy || rec?.submittedBy || rec?.user;
      return typeof userName === 'string' && userName.toLowerCase() === selectedUser.toLowerCase();
    });
  }
  // Sort by newest for stable display; server already limits to 50 if supported
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
  // Always show these columns for dynamic records:
  // id, template_name, template_department, submitted_by, submitted_at, ...form_data fields
  // Get all unique keys from form_data fields for dynamic records
  let allKeys: string[] = [];
  const formDataKeys = Array.from(
    records.reduce((set: Set<string>, rec: any) => {
      if (rec.form_data && typeof rec.form_data === 'object') {
        Object.keys(rec.form_data).forEach(k => set.add(k));
      }
      return set;
    }, new Set<string>())
  );
  allKeys = [
    'id',
    'template_name',
    'template_department',
    'submitted_by',
    'submitted_at',
    ...formDataKeys
  ];

  // Frontend date filtering as a fallback, using submitted_at/created_at field and Gregorian range
  let dateFilteredRecords = filteredRecords;
  if (dateFrom || dateTo) {
    let fromDate: Date | null = null;
    let toDate: Date | null = null;
    if (dateFrom) {
      fromDate = toGregorianDateFromEthiopianInput(dateFrom);
      if (fromDate) fromDate.setHours(0, 0, 0, 0);
    }
    if (dateTo) {
      toDate = toGregorianDateFromEthiopianInput(dateTo);
      if (toDate) toDate.setHours(23, 59, 59, 999);
    }
    dateFilteredRecords = filteredRecords.filter((rec: any) => {
      // Prefer submitted_at, then created_at/createdAt/timestamp and other common fields
      const dateField = rec.submitted_at || rec.submittedAt || rec.updated_at || rec.updatedAt || rec.created_at || rec.createdAt || rec.date || rec.timestamp;
      if (!dateField) {
        console.log('Record missing date field:', rec);
        return false;
      }
      const recordDate = new Date(dateField);
      // console.log('Filtering:', { dateField, recordDate, fromDate, toDate });
      let fromOK = true, toOK = true;
      if (fromDate) fromOK = recordDate >= fromDate;
      if (toDate) toOK = recordDate <= toDate;
      return fromOK && toOK;
    });
  }
  // Client-side general search fallback if backend ignores 'search'
  let textFilteredRecords = dateFilteredRecords;
  if (searchTerm) {
    const q = String(searchTerm).trim().toLowerCase();
    textFilteredRecords = dateFilteredRecords.filter((rec: any) => {
      const inTopLevel = Object.values(rec || {}).some((v: any) =>
        typeof v === 'string' && v.toLowerCase().includes(q)
      );
      const fd = rec?.form_data && typeof rec.form_data === 'object' ? rec.form_data : null;
      const inForm = fd ? Object.values(fd).some((v: any) =>
        (typeof v === 'string' && v.toLowerCase().includes(q)) ||
        (Array.isArray(v) && v.join(', ').toLowerCase().includes(q))
      ) : false;
      // Also search Ethiopian long date representation of submitted_at
      let inEthiopianSubmittedAt = false;
      const dtRaw = rec.submitted_at || rec.submittedAt || rec.created_at || rec.createdAt || rec.timestamp;
      if (dtRaw) {
        const dObj = new Date(dtRaw);
        if (!isNaN(dObj.getTime())) {
          const eth = gregorianToEthiopian(dObj);
          const longStr = formatEthiopianDate(eth, 'long').toLowerCase();
          inEthiopianSubmittedAt = longStr.includes(q);
        }
      }
      return inTopLevel || inForm || inEthiopianSubmittedAt;
    });
  }

  // Client-side MRN fallback filter if backend ignores mrn param
  let mrnFilteredRecords = textFilteredRecords;
  if (mrnSearch) {
    const norm = (s: any) => String(s ?? '').trim().toLowerCase();
    mrnFilteredRecords = textFilteredRecords.filter((rec: any) => {
      const direct = rec.MRN ?? rec.mrn ?? rec.patient_mrn ?? rec.patientMrn ?? rec._mrn;
      const fromForm = rec.form_data ? (
        rec.form_data.MRN ?? rec.form_data.mrn ?? rec.form_data.patient_mrn ?? rec.form_data.patientMrn ?? rec.form_data._mrn
      ) : undefined;
      const val = norm(direct ?? fromForm);
      return val.includes(norm(mrnSearch));
    });
  }

  // Determine if server likely paginated (page > 1 and result size <= PAGE_SIZE)
  const serverPaginated = page > 1 && mrnFilteredRecords.length <= PAGE_SIZE;
  // Client-side pagination fallback when server doesn't paginate
  const totalAfterFilter = mrnFilteredRecords.length;
  const startIdx = (page - 1) * PAGE_SIZE;
  const endIdx = startIdx + PAGE_SIZE;
  const displayedRecords = serverPaginated ? mrnFilteredRecords : mrnFilteredRecords.slice(startIdx, endIdx);
  const hasNextPage = serverPaginated ? (displayedRecords.length === PAGE_SIZE) : (endIdx < totalAfterFilter);

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

  const exportToCSV = () => {
    if (dateFilteredRecords.length === 0) return;
    const ok = window.confirm(`Export ${dateFilteredRecords.length} currently displayed record(s) to CSV?`);
    if (!ok) return;
    const keys = Object.keys(dateFilteredRecords[0]);
    const csvRows = [keys.join(',')];
    dateFilteredRecords.forEach(rec => {
      csvRows.push(keys.map(k => JSON.stringify(rec[k] ?? '')).join(','));
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'records_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">ISBAR Records Database</h2>
          <p className="text-gray-600">
            View and search all handover records for{' '}
            {user?.role === 'admin' ? 'all departments' : user?.department || 'General'}
          </p>
        </div>
      </div>

      {/* Selection Actions and Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="space-y-4">
          {/* Row: Template */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <input type="checkbox" className="h-4 w-4" checked={isAllSelected} onChange={toggleSelectAll} />
              <button onClick={exportToCSV} disabled={dateFilteredRecords.length === 0} className={`px-3 py-2 rounded-lg border ${dateFilteredRecords.length === 0 ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>Export</button>
              <button onClick={deleteSelected} disabled={selectedIds.size === 0} className={`px-3 py-2 rounded-lg text-white ${selectedIds.size === 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'}`}>Delete selected</button>
            </div>
            <div className="w-full">
              <label className="block text-xs font-medium text-gray-600 mb-1">Template</label>
              <select value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
                <option value="">All Templates</option>
                {submissionTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}{t.department ? ` (${t.department})` : ''}</option>
                ))}
              </select>
            </div>
            <div className="w-40">
              <label className="block text-xs font-medium text-gray-600 mb-1">Per page</label>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
                {isAdmin && <option value={5000}>5000</option>}
                {isAdmin && <option value={10000}>10000</option>}
              </select>
            </div>
          </div>
          {/* Row: Department (options related to selected template) */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <input type="checkbox" className="h-4 w-4" checked={isAllSelected} onChange={toggleSelectAll} />
              <button onClick={exportToCSV} disabled={dateFilteredRecords.length === 0} className={`px-3 py-2 rounded-lg border ${dateFilteredRecords.length === 0 ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>Export</button>
              <button onClick={deleteSelected} disabled={selectedIds.size === 0} className={`px-3 py-2 rounded-lg text-white ${selectedIds.size === 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'}`}>Delete selected</button>
            </div>
            <div className="w-full">
              <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
              <select value={selectedDepartment} onChange={e => setSelectedDepartment(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
                <option value="">All Departments</option>
                {relatedDepartments.map(dep => (
                  <option key={dep} value={dep}>{dep}</option>
                ))}
              </select>
            </div>
          </div>
          {/* Row: User (options related to selected template and department) */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <input type="checkbox" className="h-4 w-4" checked={isAllSelected} onChange={toggleSelectAll} />
              <button onClick={exportToCSV} disabled={dateFilteredRecords.length === 0} className={`px-3 py-2 rounded-lg border ${dateFilteredRecords.length === 0 ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>Export</button>
              <button onClick={deleteSelected} disabled={selectedIds.size === 0} className={`px-3 py-2 rounded-lg text-white ${selectedIds.size === 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'}`}>Delete selected</button>
            </div>
            <div className="w-full">
              <label className="block text-xs font-medium text-gray-600 mb-1">User</label>
              <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white">
                <option value="">All Users</option>
                {relatedUsers.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
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
                <input type="text" placeholder="Search by any field..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
            </div>
            <div className="w-full">
              <label className="block text-xs font-medium text-gray-600 mb-1">MRN</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Enter MRN..."
                  value={mrnSearch}
                  onChange={e => setMrnSearch(e.target.value)}
                  className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
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
            <div className="w-full">
              <label className="block text-xs font-medium text-gray-600 mb-1">Date From (Eth)</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="text" placeholder="DD-MM-YYYY" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              {dateFrom && (() => {
                const [d, m, y] = dateFrom.split('-').map(Number);
                if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
                  try {
                    const [gy, gm, gd] = ethiopianToGregorian(y, m, d);
                    return (
                      <div className="text-xs text-gray-500 mt-1">Gregorian: {`${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`}</div>
                    );
                  } catch {}
                }
                return null;
              })()}
            </div>
          </div>
          {/* Row: Date To (Eth) */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <input type="checkbox" className="h-4 w-4" checked={isAllSelected} onChange={toggleSelectAll} />
              <button onClick={exportToCSV} className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Export</button>
              <button onClick={deleteSelected} disabled={selectedIds.size === 0} className={`px-3 py-2 rounded-lg text-white ${selectedIds.size === 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'}`}>Delete selected</button>
            </div>
            <div className="w-full">
              <label className="block text-xs font-medium text-gray-600 mb-1">Date To (Eth)</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="text" placeholder="DD-MM-YYYY" value={dateTo} onChange={e => setDateTo(e.target.value)} className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              {dateTo && (() => {
                const [d, m, y] = dateTo.split('-').map(Number);
                if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
                  try {
                    const [gy, gm, gd] = ethiopianToGregorian(y, m, d);
                    return (
                      <div className="text-xs text-gray-500 mt-1">Gregorian: {`${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`}</div>
                    );
                  } catch {}
                }
                return null;
              })()}
            </div>
          </div>
          {/* Row: Quick Ranges */}
          <div className="flex flex-wrap items-center gap-2">
            <button className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50" onClick={() => {
              const now = new Date();
              const from = new Date(now); from.setDate(now.getDate() - 6);
              setDateFrom(toEthInput(from)); setDateTo(toEthInput(now)); setSearchTerm(''); setMrnSearch(''); setPage(1);
            }}>Last 7 days</button>
            <button className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50" onClick={() => {
              const now = new Date();
              const from = new Date(now); from.setDate(now.getDate() - 29);
              setDateFrom(toEthInput(from)); setDateTo(toEthInput(now)); setSearchTerm(''); setMrnSearch(''); setPage(1);
            }}>Last 30 days</button>
            <button className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50" onClick={() => {
              const now = new Date();
              setDateFrom(toEthInput(now)); setDateTo(toEthInput(now)); setPage(1);
            }}>Today</button>
            <button
              className={`px-3 py-1.5 rounded border ${deepLoading ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'border-blue-300 text-blue-700 hover:bg-blue-50'}`}
              disabled={deepLoading}
              onClick={async () => {
                setDeepLoading(true);
                setDeepRecords(null);
                setDeepPageFetched(0);
                try {
                  // Build server params from current filters
                  const params: Record<string, string> = {};
                  if (selectedTemplateId) {
                    const maybeNum = Number(selectedTemplateId);
                    if (!isNaN(maybeNum) && isFinite(maybeNum)) params.formId = selectedTemplateId;
                  }
                  if (searchTerm) params.search = searchTerm;
                  if (mrnSearch) params.mrn = mrnSearch;
                  if (dateFrom) {
                    const g = toGregorianDateFromEthiopianInput(dateFrom);
                    if (g) {
                      const y = g.getFullYear(); const m = String(g.getMonth()+1).padStart(2,'0'); const d = String(g.getDate()).padStart(2,'0');
                      params.dateFrom = `${y}-${m}-${d}`;
                    }
                  }
                  if (dateTo) {
                    const g = toGregorianDateFromEthiopianInput(dateTo);
                    if (g) {
                      const y = g.getFullYear(); const m = String(g.getMonth()+1).padStart(2,'0'); const d = String(g.getDate()).padStart(2,'0');
                      params.dateTo = `${y}-${m}-${d}`;
                    }
                  }
                  params.limit = String(PAGE_SIZE);
                  // Fetch all pages until empty
                  const url = '/api/form-submissions';
                  const buildQuery = (obj: Record<string,string>) => url + '?' + new URLSearchParams(obj).toString();
                  const fetchWithQuery = async (obj: Record<string,string>) => {
                    const res = await fetch(buildQuery(obj));
                    if (!res.ok) throw new Error('Failed to fetch records');
                    return await res.json();
                  };
                  const out: any[] = [];
                  const seen = new Set<string>();
                  const keyOf = (rec: any) => String(rec?.id ?? `${rec?.template_id ?? rec?.form_id ?? 'form'}_${rec?.submitted_at ?? rec?.created_at ?? rec?.timestamp ?? ''}`);
                  const MAX_PAGES = 2000;
                  for (let pg = 1; pg <= MAX_PAGES; pg++) {
                    setDeepPageFetched(pg);
                    let pageData: any[] = await fetchWithQuery({ ...params, page: String(pg) });
                    if (!Array.isArray(pageData) || pageData.length === 0) {
                      // Try offset fallback
                      const offset = String((pg - 1) * PAGE_SIZE);
                      const altParams: Record<string,string> = { ...params };
                      delete (altParams as any).page;
                      (altParams as any).offset = offset;
                      pageData = await fetchWithQuery(altParams);
                      if (!Array.isArray(pageData) || pageData.length === 0) break;
                    }
                    let added = 0;
                    for (const rec of pageData) {
                      const k = keyOf(rec);
                      if (!seen.has(k)) { seen.add(k); out.push(rec); added++; }
                    }
                    if (added === 0) break;
                    if (pageData.length < PAGE_SIZE) break;
                  }
                  setDeepRecords(out);
                  setPage(1);
                } catch (e) {
                  console.error(e);
                } finally {
                  setDeepLoading(false);
                }
              }}
            >
              {deepLoading ? `Deep searching… page ${deepPageFetched}` : 'Deep Search (fetch all pages)'}
            </button>
          </div>
        </div>
        <div className="mt-4 text-sm text-gray-500 text-right">
          <span className="font-medium text-gray-900">{totalAfterFilter}</span> records found
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-xl shadow-sm p-4 overflow-x-auto">
        {loading ? (
          <div className="text-center p-8">
            <div className="flex items-center justify-center">
              <IsbarLoader message="Loading records..." size={72} />
            </div>
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
            <thead className="bg-gray-100">
              <tr>
                <th className="px-2 py-1 border w-8">
                  <input type="checkbox" checked={isAllSelected} onChange={toggleSelectAll} />
                </th>
                {allKeys.map(key => (
                  <th key={key} className="px-2 py-1 border">{escape(key)}</th>
                ))}
                <th className="px-2 py-1 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedRecords.map((record, idx) => (
                <tr key={record.id || idx} className="hover:bg-blue-50">
                  <td className="px-2 py-1 border text-center">
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
                    const cellContent = isSubmittedAt
                      ? (submittedRaw ? <EthiopianDateDisplay date={submittedRaw as any} format="long" /> : '—')
                      : Array.isArray(value)
                        ? value.join(', ')
                        : typeof value === 'object' && value !== null
                          ? <span className="text-gray-400">[object]</span>
                          : escape(value);
                    const titleText = isSubmittedAt
                      ? (submittedRaw ? undefined : '—')
                      : Array.isArray(value)
                        ? value.join(', ')
                        : typeof value === 'object' && value !== null
                          ? JSON.stringify(value)
                          : escape(value);
                    return (
                      <td key={key} className="px-2 py-1 border truncate max-w-xs" title={titleText as any}>
                        {cellContent}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 border whitespace-nowrap">
                    <button className="text-blue-600 hover:underline mr-2" onClick={() => setViewRecord(record)}>View</button>
                    <button className="text-purple-600 hover:underline mr-2" onClick={() => setRawRecord(record)}>Raw</button>
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

      {/* Raw JSON Modal */}
      {rawRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4 sm:p-6">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl relative max-h-[90vh] flex flex-col">
            <div className="sticky top-0 bg-white border-b rounded-t-lg pl-6 pr-12 py-3">
              <h3 className="text-xl font-bold">Raw JSON</h3>
              <button
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-2xl"
                onClick={() => setRawRecord(null)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <div className="p-6 overflow-auto">
              <pre className="bg-gray-100 rounded p-4 text-xs overflow-x-auto">
                {JSON.stringify(rawRecord, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
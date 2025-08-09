
import { useState, useEffect } from 'react';
// Fetch all active templates for dropdown filter
function useTemplates(department?: string) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [refresh, setRefresh] = useState(0);
  // Expose a function to trigger refresh
  const refetch = () => setRefresh(r => r + 1);
  useEffect(() => {
    if (department) {
      fetch('/api/form-templates')
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          if (Array.isArray(data)) {
            setTemplates(data.filter((t: any) => t.department === department && t.is_active).map((t: any) => ({
              ...t,
              id: t.id.toString(),
              fields: typeof t.fields === 'string' ? JSON.parse(t.fields) : (t.fields || []),
              sections: t.sections === null ? [] : (typeof t.sections === 'string' ? JSON.parse(t.sections) : (t.sections || []))
            })));
          } else {
            setTemplates([]);
          }
        });
    } else {
      setTemplates([]);
    }
  }, [department, refresh]);
  return [templates, refetch] as const;
}
import { useAuth } from '../hooks/useAuth';
import IsbarLoader from './IsbarLoader';
import { Search, Calendar } from 'lucide-react';
import { toEthiopian as toEthDate } from 'ethiopian-date';

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

// ethDate: 'DD-MM-YYYY' (Ethiopian)
function toGregorianDateFromEthiopianInput(ethDate: string): Date | null {
  if (!ethDate) return null;
  const [d, m, y] = ethDate.split('-').map(Number);
  if ([y, m, d].some(isNaN)) return null;
  try {
    const [gy, gm, gd] = ethiopianToGregorian(y, m, d);
    return new Date(gy, gm - 1, gd);
  } catch {
    return null;
  }
}


export const DatabaseRecords = () => {
  const { user } = useAuth() || { user: null };
  const [records, setRecords] = useState<any[]>([]);
  // Removed resourceRecords, only dynamic records are used
  // Only show dynamic form records
  const [searchTerm, setSearchTerm] = useState('');
  // Remove stability filter
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [viewRecord, setViewRecord] = useState<any | null>(null);
  const [rawRecord, setRawRecord] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [templates, refetchTemplates] = useTemplates(user?.department);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  // Fetch records from backend API
  useEffect(() => {
    const fetchRecords = async () => {
      setLoading(true);
      setError(null);
      try {
        let url = '/api/form-submissions';
        let params: any = {};
        if (selectedTemplateId) {
          params.formId = selectedTemplateId;
        }
        if (searchTerm) params.search = searchTerm;
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
        // Avoid passing department param due to backend filter issues; rely on strict client-side filter below
        // if (user && user.department && user.role !== 'admin') params.department = user.department;
        const query = Object.keys(params).length
          ? '?' + new URLSearchParams(params).toString()
          : '';
        const fullUrl = url + query;
        console.log('Fetching dynamic form submissions from:', fullUrl);
        const res = await fetch(fullUrl);
        if (!res.ok) throw new Error('Failed to fetch records');
        const data = await res.json();
        // Enforce department scoping on the client as a safety net
        const isAdmin = user?.role === 'admin';
        const dept = user?.department;
        const scoped = Array.isArray(data)
          ? (isAdmin || !dept)
            ? data
            : data.filter((rec: any) =>
                rec?.template_department === dept ||
                rec?.submitted_by_department === dept ||
                rec?.department === dept
              )
          : [];
        setRecords(scoped);
      } catch (err: any) {
        setError(err.message || 'Error fetching records');
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, [searchTerm, dateFrom, dateTo, user, selectedTemplateId]);

  let baseRecords: any[] = records;

  // Filter by selected template if set
  let filteredRecords = baseRecords;
  if (selectedTemplateId) {
    filteredRecords = filteredRecords.filter(
      (rec: any) => rec.template_id === Number(selectedTemplateId)
    );
  }
  // Always show only the latest 50 records (by submitted_at or created_at desc)
  filteredRecords = filteredRecords
    .slice()
    .sort((a, b) => {
      const aDate = new Date(a.submitted_at || a.created_at || 0).getTime();
      const bDate = new Date(b.submitted_at || b.created_at || 0).getTime();
      return bDate - aDate;
    })
    .slice(0, 50);
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

  // Frontend date filtering as a fallback, using created_at field and Gregorian range
  let dateFilteredRecords = filteredRecords;
  const hasActiveFilter = Boolean(dateFrom || dateTo || searchTerm);
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
      // Use created_at, createdAt, or timestamp
      const dateField = rec.created_at || rec.createdAt || rec.timestamp;
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
  // Limit to 50 records if no filters are active
  if (!hasActiveFilter && dateFilteredRecords.length > 50) {
    dateFilteredRecords = dateFilteredRecords.slice(0, 50);
  }

  const exportToCSV = () => {
    if (dateFilteredRecords.length === 0) return;
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

  const handleDelete = (id: string) => {
    // Implement your delete logic here
    alert('Delete record with id: ' + id);
    refetchTemplates(); // Refetch templates after delete (if needed)
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
        <button
          onClick={exportToCSV}
          className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg ml-4"
        >
          Export CSV
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex flex-wrap gap-4 mb-4">
        {/* Template filter dropdown */}
        {/* Template filter dropdown */}
        <div className="flex items-center gap-2">
          <label className="font-medium text-gray-700">Template:</label>
          <select
            value={selectedTemplateId}
            onChange={e => setSelectedTemplateId(e.target.value)}
            className="border rounded px-2 py-1"
          >
            <option value="">All Templates</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
          {/* Removed Show: dropdown and recordType selector */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {/* Stability filter removed */}
          {/* Date From (Ethiopian) */}
          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="DD-MM-YYYY (Eth)"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {dateFrom && (() => {
              const [d, m, y] = dateFrom.split('-').map(Number);
              if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
                try {
                  const [gy, gm, gd] = ethiopianToGregorian(y, m, d);
                  return (
                    <div className="text-xs text-gray-500 mt-1">
                      Gregorian: {`${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`}
                    </div>
                  );
                } catch {}
              }
              return null;
            })()}
          </div>
          {/* Date To (Ethiopian) */}
          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="DD-MM-YYYY (Eth)"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {dateTo && (() => {
              const [d, m, y] = dateTo.split('-').map(Number);
              if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
                try {
                  const [gy, gm, gd] = ethiopianToGregorian(y, m, d);
                  return (
                    <div className="text-xs text-gray-500 mt-1">
                      Gregorian: {`${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`}
                    </div>
                  );
                } catch {}
              }
              return null;
            })()}
          </div>
          <div className="text-sm text-gray-500 flex items-center">
            <span className="font-medium text-gray-900">{filteredRecords.length}</span> records found
          </div>
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
        ) : dateFilteredRecords.length === 0 ? (
          <div className="text-center p-8">
            <Search className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No records found</h3>
            <p className="text-gray-500">Try adjusting your search criteria or date filter.</p>
          </div>
        ) : (
          <table className="min-w-full border text-xs">
            <thead className="bg-gray-100">
              <tr>
                {allKeys.map(key => (
                  <th key={key} className="px-2 py-1 border">{escape(key)}</th>
                ))}
                <th className="px-2 py-1 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {dateFilteredRecords.map((record, idx) => (
                <tr key={record.id || idx} className="hover:bg-blue-50">
                  {allKeys.map(key => {
                    let value;
                    if (key in record) {
                      value = record[key];
                    } else if (record.form_data && key in record.form_data) {
                      value = record.form_data[key];
                    } else {
                      value = '';
                    }
                    return (
                      <td key={key} className="px-2 py-1 border truncate max-w-xs" title={
                        Array.isArray(value)
                          ? value.join(', ')
                          : typeof value === 'object' && value !== null
                            ? JSON.stringify(value)
                            : escape(value)
                      }>
                        {Array.isArray(value)
                          ? value.join(', ')
                          : typeof value === 'object' && value !== null
                            ? <span className="text-gray-400">[object]</span>
                            : escape(value)}
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
      </div>

      {/* View Record Modal */}
      {viewRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-2xl"
              onClick={() => setViewRecord(null)}
            >
              &times;
            </button>
            <h3 className="text-xl font-bold mb-4">ISBAR Record Details</h3>
            <pre className="bg-gray-100 rounded p-4 text-xs overflow-x-auto max-h-96">
              {JSON.stringify(viewRecord, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Raw JSON Modal */}
      {rawRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-2xl"
              onClick={() => setRawRecord(null)}
            >
              &times;
            </button>
            <h3 className="text-xl font-bold mb-4">Raw Record Data</h3>
            <pre className="bg-gray-100 rounded p-4 text-xs overflow-x-auto max-h-96">
              {JSON.stringify(rawRecord, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
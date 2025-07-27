
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Search, Filter, Calendar } from 'lucide-react';
import { toEthiopian as toEthDate, toGregorian } from 'ethiopian-date';

function escape(str: any) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toEthiopian(year: number, month: number, day: number): [number, number, number] {
  const eth = toEthDate(year, month, day);
  if (eth && typeof eth === 'object' && 'year' in eth && 'month' in eth && 'day' in eth) {
    return [eth.year, eth.month, eth.day];
  }
  if (Array.isArray(eth) && eth.length === 3) {
    return eth;
  }
  return [NaN, NaN, NaN];
}

function toGregorianDateFromEthiopianInput(ethDate: string): Date | null {
  // ethDate: 'DD-MM-YYYY' (Ethiopian)
  if (!ethDate) return null;
  const [d, m, y] = ethDate.split('-').map(Number);
  if ([y, m, d].some(isNaN)) return null;
  try {
    // toGregorian returns [year, month, day] in Gregorian
    const [gy, gm, gd] = toGregorian(y, m, d);
    // JS Date: month is 0-based
    return new Date(gy, gm - 1, gd);
  } catch {
    return null;
  }
}


export const DatabaseRecords = () => {
  const { user } = useAuth() || { user: null };
  const [records, setRecords] = useState<any[]>([]);
  const [resourceRecords, setResourceRecords] = useState<any[]>([]);
  const [recordType, setRecordType] = useState<'dynamic' | 'resource'>('dynamic');
  const [searchTerm, setSearchTerm] = useState('');
  // Remove stability filter
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [viewRecord, setViewRecord] = useState<any | null>(null);
  const [rawRecord, setRawRecord] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch records from backend API
  useEffect(() => {
    const fetchRecords = async () => {
      setLoading(true);
      setError(null);
      try {
        let url = '';
        let params: any = {};
        if (recordType === 'dynamic') {
          url = '/api/isbar-records';
        } else if (recordType === 'resource') {
          url = '/api/resources';
        } else {
          // For 'all', fetch both and merge
          const [dynRes, resRes] = await Promise.all([
            fetch('/api/records').then(r => r.json()),
            fetch('/api/resources').then(r => r.json()),
          ]);
          setRecords(dynRes);
          setResourceRecords(resRes);
          setLoading(false);
          return;
        }
        if (searchTerm) params.search = searchTerm;
        // Convert Ethiopian date input to Gregorian YYYY-MM-DD string for backend filtering
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
        if (user && user.department && user.role !== 'admin') params.department = user.department;
        const query = Object.keys(params).length
          ? '?' + new URLSearchParams(params).toString()
          : '';
        const fullUrl = url + query;
        console.log('Fetching records from:', fullUrl, 'user.department:', user?.department);
        const res = await fetch(fullUrl);
        if (!res.ok) throw new Error('Failed to fetch records');
        const data = await res.json();
        if (recordType === 'dynamic') setRecords(data);
        else setResourceRecords(data);
      } catch (err: any) {
        setError(err.message || 'Error fetching records');
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, [recordType, searchTerm, dateFrom, dateTo, user]);

  let baseRecords: any[] = [];
  if (recordType === 'dynamic') baseRecords = records;
  else if (recordType === 'resource') baseRecords = resourceRecords;
  else baseRecords = [...records, ...resourceRecords];

  const filteredRecords = baseRecords;
  // Only show columns for fields present in the dynamic form data (not standard ISBAR fields unless present)
  // If recordType is 'dynamic', use only keys from dynamic records
  // If 'resource', use resource keys; if 'all', use union
  let allKeys: string[] = [];
  if (recordType === 'dynamic') {
    allKeys = Array.from(records.reduce((set: Set<string>, rec: any) => {
      Object.keys(rec).forEach(k => set.add(k));
      return set;
    }, new Set<string>()));
  } else if (recordType === 'resource') {
    allKeys = Array.from(resourceRecords.reduce((set: Set<string>, rec: any) => {
      Object.keys(rec).forEach(k => set.add(k));
      return set;
    }, new Set<string>()));
  } else {
    allKeys = Array.from(filteredRecords.reduce((set: Set<string>, rec: any) => {
      Object.keys(rec).forEach(k => set.add(k));
      return set;
    }, new Set<string>()));
  }

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
  };

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
          <div className="flex items-center gap-2">
            <label className="font-medium text-gray-700">Show:</label>
            <select
              value={recordType}
              onChange={e => setRecordType(e.target.value as 'dynamic' | 'resource')}
              className="border rounded px-2 py-1"
            >
              <option value="dynamic">Dynamic Form Records</option>
              <option value="resource">Resource Management Records</option>
            </select>
          </div>
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
                  const [gy, gm, gd] = toGregorian(y, m, d);
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
                  const [gy, gm, gd] = toGregorian(y, m, d);
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Loading records...</h3>
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
                  {allKeys.map(key => (
                    <td key={key} className="px-2 py-1 border truncate max-w-xs" title={escape(record[key])}>
                      {typeof record[key] === 'object' && record[key] !== null
                        ? <span className="text-gray-400">[object]</span>
                        : escape(record[key])}
                    </td>
                  ))}
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
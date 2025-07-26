import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, Calendar } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export const DatabaseRecords = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStability, setFilterStability] = useState<'All' | 'Stable' | 'Unstable' | 'Critical'>('All');
  const [dateFilter, setDateFilter] = useState('');
  const [viewRecord, setViewRecord] = useState<any | null>(null);
  const [rawRecord, setRawRecord] = useState<any | null>(null);


  // Helper to fetch records
  const fetchRecords = () => {
    if (user?.department) {
      const url =
        user.role === 'admin'
          ? '/api/isbar-records'
          : `/api/isbar-records?department=${encodeURIComponent(user.department)}`;
      fetch(url)
        .then(res => (res.ok ? res.json() : []))
        .then(data => setRecords(data || []));
    }
  };

  useEffect(() => {
    fetchRecords();
    // Listen for custom event to refresh records
    const handler = () => fetchRecords();
    window.addEventListener('records-updated', handler);
    return () => window.removeEventListener('records-updated', handler);
  }, [user?.department, user?.role]);

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      setRecords(prev => prev.filter(r => r.id !== id));
    }
  };

  const escape = (str: any) => {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const get = (obj: any, ...keys: string[]) => {
    for (const k of keys) {
      if (obj && obj[k] !== undefined) return obj[k];
    }
    return '';
  };

  const filteredRecords = records.filter(record => {
    const matchesDepartment =
      user?.role === 'admin' || get(record, 'department') === user?.department;

    const matchesSearch =
      get(record, 'patientName', 'patient_name')?.toLowerCase()?.includes(searchTerm.toLowerCase()) ||
      get(record, 'nurseName', 'nurse_name')?.toLowerCase()?.includes(searchTerm.toLowerCase()) ||
      get(record, 'bedNumber', 'bed_number')?.toLowerCase()?.includes(searchTerm.toLowerCase());

    const matchesStability =
      filterStability === 'All' || get(record, 'stability') === filterStability;

    const matchesDate =
      !dateFilter ||
      new Date(get(record, 'timestamp')).toDateString() ===
        new Date(dateFilter).toDateString();

    return matchesDepartment && matchesSearch && matchesStability && matchesDate;
  });

  // List of standard ISBAR columns to hide
  const standardISBAR = [
    'id', 'age', 'mrn', 'shift', 'bedNumber', 'nurseName', 'situation', 'stability',
    'assessment', 'background', 'vitalSigns', 'patientName', 'recommendation',
    'timestamp', 'department'
  ];
  
  // Only show dynamic fields (not in standard ISBAR columns)
  const allKeys = Array.from(
    filteredRecords.reduce((set: Set<string>, rec: any) => {
      Object.keys(rec).forEach(k => {
        if (!standardISBAR.includes(k)) set.add(k);
      });
      return set;
    }, new Set<string>())
  );

  // Handler to reset/clear the table records
  const handleResetTable = () => setRecords([]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">ISBAR Records Database</h2>
          <p className="text-gray-600">
            View and search all handover records for{' '}
            {user?.role === 'admin' ? 'all departments' : user?.department}
          </p>
        </div>
        <button
          onClick={handleResetTable}
          className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg ml-4"
        >
          Reset Table
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search patients, nurses, beds..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={filterStability}
              onChange={(e) => setFilterStability(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="All">All Stability</option>
              <option value="Stable">Stable</option>
              <option value="Unstable">Unstable</option>
              <option value="Critical">Critical</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="text-sm text-gray-500 flex items-center">
            <span className="font-medium text-gray-900">{filteredRecords.length}</span>{' '}
            records found
          </div>
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-xl shadow-sm p-4 overflow-x-auto">
        {filteredRecords.length === 0 ? (
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
              {filteredRecords.map((record, idx) => (
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

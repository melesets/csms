import React, { useState } from 'react';
import { Search, Filter, Download, Calendar } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { ISBARRecord } from '../types';
import { mockISBARRecords } from '../data/mockData';

export const DatabaseRecords = () => {
  const { user } = useAuth();
  const [records, setRecords] = useLocalStorage<ISBARRecord[]>('isbar_records', mockISBARRecords);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStability, setFilterStability] = useState<'All' | 'Stable' | 'Unstable' | 'Critical'>('All');
  const [dateFilter, setDateFilter] = useState('');
  const [viewRecord, setViewRecord] = useState<ISBARRecord | null>(null);
  // Delete record by id
  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      setRecords(records.filter(r => r.id !== id));
    }
  };

  // Filter records by department for non-admin users
  const filteredRecords = records.filter(record => {
    const matchesDepartment = user?.role === 'admin' || record.department === user?.department;
    const matchesSearch = record.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.nurseName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.bedNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStability = filterStability === 'All' || record.stability === filterStability;
    const matchesDate = !dateFilter || new Date(record.timestamp).toDateString() === new Date(dateFilter).toDateString();
    
    return matchesDepartment && matchesSearch && matchesStability && matchesDate;
  });

  const exportToCSV = () => {
    const headers = [
      'Timestamp',
      'Patient Name',
      'Age',
      'MRN',
      'Bed Number',
      'Department',
      'Nurse Name',
      'Shift',
      'Stability',
      'Situation',
      'Background',
      'Assessment',
      'Recommendation',
      'Temperature',
      'Heart Rate',
      'Blood Pressure',
      'Respiratory Rate',
      'O2 Saturation'
    ];

    const csvData = filteredRecords.map(record => [
      new Date(record.timestamp).toLocaleString(),
      record.patientName,
      record.age,
      record.mrn,
      record.bedNumber,
      record.department,
      record.nurseName,
      record.shift,
      record.stability,
      record.situation,
      record.background,
      record.assessment,
      record.recommendation,
      record.vitalSigns.temperature,
      record.vitalSigns.heartRate,
      record.vitalSigns.bloodPressure,
      record.vitalSigns.respiratoryRate,
      record.vitalSigns.oxygenSaturation
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `isbar_records_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">ISBAR Records Database</h2>
          <p className="text-gray-600 mt-1">
            View and search all handover records for {user?.role === 'admin' ? 'all departments' : user?.department}
          </p>
        </div>
        <button
          onClick={exportToCSV}
          className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg flex items-center transition-colors"
        >
          <Download className="w-5 h-5 mr-2" />
          Export CSV
        </button>
      </div>

      {/* Search and Filter */}
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
              onChange={(e) => setFilterStability(e.target.value as 'All' | 'Stable' | 'Unstable' | 'Critical')}
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
            <span className="font-medium text-gray-900">{filteredRecords.length}</span> records found
          </div>
        </div>
      </div>


      {/* Normal Table Layout with Actions */}
      <div className="bg-white rounded-xl shadow-sm p-4 overflow-x-auto">
        <table className="min-w-full border text-xs">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-2 py-1 border">Timestamp</th>
              <th className="px-2 py-1 border">Patient</th>
              <th className="px-2 py-1 border">Age</th>
              <th className="px-2 py-1 border">MRN</th>
              <th className="px-2 py-1 border">Bed</th>
              <th className="px-2 py-1 border">Stability</th>
              <th className="px-2 py-1 border">Department</th>
              <th className="px-2 py-1 border">Nurse</th>
              <th className="px-2 py-1 border">Shift</th>
              <th className="px-2 py-1 border">Temp</th>
              <th className="px-2 py-1 border">HR</th>
              <th className="px-2 py-1 border">BP</th>
              <th className="px-2 py-1 border">RR</th>
              <th className="px-2 py-1 border">O2 Sat</th>
              <th className="px-2 py-1 border">Situation</th>
              <th className="px-2 py-1 border">Background</th>
              <th className="px-2 py-1 border">Assessment</th>
              <th className="px-2 py-1 border">Recommendation</th>
              <th className="px-2 py-1 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map(record => (
              <tr key={record.id} className="hover:bg-blue-50">
                <td className="px-2 py-1 border">{new Date(record.timestamp).toLocaleString()}</td>
                <td className="px-2 py-1 border font-semibold">{record.patientName}</td>
                <td className="px-2 py-1 border">{record.age}</td>
                <td className="px-2 py-1 border">{record.mrn}</td>
                <td className="px-2 py-1 border">{record.bedNumber}</td>
                <td className="px-2 py-1 border">{record.stability}</td>
                <td className="px-2 py-1 border">{record.department}</td>
                <td className="px-2 py-1 border">{record.nurseName}</td>
                <td className="px-2 py-1 border">{record.shift}</td>
                <td className="px-2 py-1 border">{record.vitalSigns.temperature}</td>
                <td className="px-2 py-1 border">{record.vitalSigns.heartRate}</td>
                <td className="px-2 py-1 border">{record.vitalSigns.bloodPressure}</td>
                <td className="px-2 py-1 border">{record.vitalSigns.respiratoryRate}</td>
                <td className="px-2 py-1 border">{record.vitalSigns.oxygenSaturation}</td>
                <td className="px-2 py-1 border truncate max-w-xs">{record.situation}</td>
                <td className="px-2 py-1 border truncate max-w-xs">{record.background}</td>
                <td className="px-2 py-1 border truncate max-w-xs">{record.assessment}</td>
                <td className="px-2 py-1 border truncate max-w-xs">{record.recommendation}</td>
                <td className="px-2 py-1 border whitespace-nowrap">
                  <button
                    className="text-blue-600 hover:underline mr-2"
                    onClick={() => setViewRecord(record)}
                  >
                    View
                  </button>
                  <button
                    className="text-red-600 hover:underline"
                    onClick={() => handleDelete(record.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* View Modal */}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p><span className="font-semibold">Patient:</span> {viewRecord.patientName}</p>
                <p><span className="font-semibold">Age:</span> {viewRecord.age}</p>
                <p><span className="font-semibold">MRN:</span> {viewRecord.mrn}</p>
                <p><span className="font-semibold">Bed:</span> {viewRecord.bedNumber}</p>
                <p><span className="font-semibold">Department:</span> {viewRecord.department}</p>
                <p><span className="font-semibold">Nurse:</span> {viewRecord.nurseName}</p>
                <p><span className="font-semibold">Shift:</span> {viewRecord.shift}</p>
                <p><span className="font-semibold">Stability:</span> {viewRecord.stability}</p>
                <p><span className="font-semibold">Timestamp:</span> {new Date(viewRecord.timestamp).toLocaleString()}</p>
              </div>
              <div>
                <p><span className="font-semibold">Temperature:</span> {viewRecord.vitalSigns.temperature}°C</p>
                <p><span className="font-semibold">Heart Rate:</span> {viewRecord.vitalSigns.heartRate} bpm</p>
                <p><span className="font-semibold">BP:</span> {viewRecord.vitalSigns.bloodPressure}</p>
                <p><span className="font-semibold">RR:</span> {viewRecord.vitalSigns.respiratoryRate}</p>
                <p><span className="font-semibold">O2 Sat:</span> {viewRecord.vitalSigns.oxygenSaturation}%</p>
              </div>
            </div>
            <div className="mt-4">
              <h4 className="font-semibold">Situation</h4>
              <p className="bg-gray-50 rounded p-2 mb-2">{viewRecord.situation}</p>
              <h4 className="font-semibold">Background</h4>
              <p className="bg-gray-50 rounded p-2 mb-2">{viewRecord.background}</p>
              <h4 className="font-semibold">Assessment</h4>
              <p className="bg-gray-50 rounded p-2 mb-2">{viewRecord.assessment}</p>
              <h4 className="font-semibold">Recommendation</h4>
              <p className="bg-gray-50 rounded p-2">{viewRecord.recommendation}</p>
            </div>
          </div>
        </div>
      )}

      {filteredRecords.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Search className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No records found</h3>
          <p className="text-gray-500">
            Try adjusting your search criteria or date filter.
          </p>
        </div>
      )}
    </div>
  );
};
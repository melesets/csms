// Attendance reports - daily/weekly staff attendance summaries
import React, { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../../api';
import {
  formatEthiopianDate,
} from '../../utils/ethiopianCalendar';
import {
  BarChart3,
  Calendar,
  Download,
  Building2,
  Users,
  Clock,
  TrendingUp,
} from 'lucide-react';

interface AttendanceRow {
  id: string;
  username: string;
  name: string;
  department: string;
  profession: string;
  total_shifts: string;
  total_hours: string;
  active_shifts: string;
}

export const AttendanceReports = () => {
  const [data, setData] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (department) params.set('department', department);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate + 'T23:59:59');

      const result: AttendanceRow[] = await apiGet(`/shifts/attendance-report?${params}`);
      setData(result);
      const depts = [...new Set(result.map(r => r.department).filter(Boolean))].sort();
      setDepartments(depts);
    } catch (err) {
      console.error('Failed to fetch attendance report:', err);
    } finally {
      setLoading(false);
    }
  }, [department, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePeriodChange = (p: 'daily' | 'weekly' | 'monthly') => {
    setPeriod(p);
    const now = new Date();
    const start = new Date();
    if (p === 'daily') start.setDate(now.getDate() - 1);
    else if (p === 'weekly') start.setDate(now.getDate() - 7);
    else start.setMonth(now.getMonth() - 1);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(now.toISOString().slice(0, 10));
  };

  const totalShifts = data.reduce((sum, r) => sum + parseInt(r.total_shifts || '0'), 0);
  const totalHours = data.reduce((sum, r) => sum + parseFloat(r.total_hours || '0'), 0);
  const activeStaff = data.reduce((sum, r) => sum + parseInt(r.active_shifts || '0'), 0);

  const deptSummary = data.reduce((acc, r) => {
    if (!acc[r.department]) acc[r.department] = { staff: 0, totalShifts: 0, totalHours: 0 };
    acc[r.department].staff++;
    acc[r.department].totalShifts += parseInt(r.total_shifts || '0');
    acc[r.department].totalHours += parseFloat(r.total_hours || '0');
    return acc;
  }, {} as Record<string, { staff: number; totalShifts: number; totalHours: number }>);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-[#003153] rounded-xl flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Attendance Reports</h1>
            <p className="text-sm text-gray-500">Staff attendance summaries</p>
          </div>
        </div>
        <div className="flex gap-2">
          {(['daily', 'weekly', 'monthly'] as const).map(p => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                period === p
                  ? 'bg-[#003153] text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Date Range</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#003153] focus:border-transparent"
          />
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#003153] focus:border-transparent"
          />
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={department}
              onChange={e => setDepartment(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-[#003153] focus:border-transparent"
            >
              <option value="">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-[#003153]" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Staff</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{data.length}</p>
          <p className="text-xs text-gray-500 mt-1">{activeStaff} currently active</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-[#003153]" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Shifts</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{totalShifts}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-[#003153]" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Hours</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{totalHours.toFixed(1)}</p>
        </div>
      </div>

      {/* Department breakdown */}
      {Object.keys(deptSummary).length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Department Breakdown</h3>
          <div className="space-y-3">
            {Object.entries(deptSummary).sort((a, b) => b[1].totalHours - a[1].totalHours).map(([dept, stats]) => {
              const maxHours = Math.max(...Object.values(deptSummary).map(s => s.totalHours));
              const pct = maxHours > 0 ? (stats.totalHours / maxHours) * 100 : 0;
              return (
                <div key={dept}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-700">{dept}</span>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{stats.staff} staff</span>
                      <span className="font-semibold text-[#003153]">{stats.totalHours.toFixed(1)}h</span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#003153] rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Staff detail table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900">Individual Attendance</h3>
        </div>
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-[#003153] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading report...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center">
            <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">No attendance data for this period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Staff</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Department</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Shifts</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Hours</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-gray-900">{row.name}</p>
                      <p className="text-xs text-gray-500">{row.profession}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-700">{row.department}</td>
                    <td className="px-5 py-3 font-semibold text-gray-900">{row.total_shifts}</td>
                    <td className="px-5 py-3 font-semibold text-[#003153]">{parseFloat(row.total_hours).toFixed(1)}h</td>
                    <td className="px-5 py-3">
                      {parseInt(row.active_shifts) > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Active
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

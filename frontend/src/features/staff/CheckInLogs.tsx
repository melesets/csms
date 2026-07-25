// Check-in logs - admin view of all staff check-in/out history with filters
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { apiGet } from '../../api';
import {
  formatEthiopianDate,
  formatEthiopianTime,
} from '../../utils/ethiopianCalendar';
import {
  Clock,
  LogIn,
  LogOut,
  Filter,
  ChevronLeft,
  ChevronRight,
  Search,
  RefreshCw,
  Users,
  Building2,
  Calendar,
} from 'lucide-react';

interface CheckInLog {
  id: string;
  user_id: string;
  username: string;
  profession: string;
  ward: string;
  shift_name: string;
  start_time: string;
  end_time: string | null;
  is_active: boolean;
  department: string;
  duration_hours: number;
}

interface LogsResponse {
  logs: CheckInLog[];
  total: number;
  page: number;
  totalPages: number;
}

const formatDuration = (hours: number | null) => {
  if (!hours) return '—';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export const CheckInLogs = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<CheckInLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [department, setDepartment] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '50');
      if (department) params.set('department', department);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate + 'T23:59:59');

      const data: LogsResponse = await apiGet(`/shifts/check-in-logs?${params}`);
      setLogs(data.logs);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to fetch check-in logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, department, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    const depts = new Set<string>();
    logs.forEach(l => { if (l.department) depts.add(l.department); });
    if (depts.size > 0) setDepartments([...depts].sort());
  }, [logs]);

  const filteredLogs = searchQuery
    ? logs.filter(l =>
        l.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.profession?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.ward?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : logs;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-[#003153] rounded-xl flex items-center justify-center">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Check-In Logs</h1>
            <p className="text-sm text-gray-500">Staff attendance history</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="font-semibold text-[#003153]">{total}</span> total records
          <button
            onClick={fetchLogs}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search staff..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#003153] focus:border-transparent"
            />
          </div>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={department}
              onChange={e => { setDepartment(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-[#003153] focus:border-transparent"
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#003153] focus:border-transparent"
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#003153] focus:border-transparent"
            />
          </div>
          <button
            onClick={() => { setDepartment(''); setStartDate(''); setEndDate(''); setSearchQuery(''); setPage(1); }}
            className="px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-[#003153] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">No check-in records found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Staff</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Department</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Shift</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Check In</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Check Out</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Duration</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredLogs.map(log => {
                    const checkInDate = new Date(log.start_time);
                    const checkOutDate = log.end_time ? new Date(log.end_time) : null;
                    return (
                      <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-semibold text-gray-900">{log.username}</p>
                            <p className="text-xs text-gray-500">{log.profession}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{log.department}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                            {log.shift_name}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-gray-700">
                            <LogIn className="w-3.5 h-3.5 text-emerald-500" />
                            <div>
                              <p className="text-xs">{formatEthiopianDate(checkInDate, 'long')}</p>
                              <p className="text-xs text-gray-500">{formatEthiopianTime(checkInDate, 'short')}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {checkOutDate ? (
                            <div className="flex items-center gap-1.5 text-gray-700">
                              <LogOut className="w-3.5 h-3.5 text-orange-500" />
                              <div>
                                <p className="text-xs">{formatEthiopianDate(checkOutDate, 'long')}</p>
                                <p className="text-xs text-gray-500">{formatEthiopianTime(checkOutDate, 'short')}</p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700 font-medium">
                          {formatDuration(log.duration_hours)}
                        </td>
                        <td className="px-4 py-3">
                          {log.is_active ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-500">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                              Completed
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  Page {page} of {totalPages} ({total} records)
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

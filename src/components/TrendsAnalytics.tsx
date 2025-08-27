import { useState, useMemo, useEffect } from 'react';
import { TrendingUp, Users, Activity, Calendar, BarChart3, PieChart, RefreshCw, Download, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export const TrendsAnalytics = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'quarter'>('month');
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>(
    user?.role === 'admin' ? (user?.department || 'All') : (user?.department || '')
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Fetch real form submissions from backend
  useEffect(() => {
    const fetchRecords = async () => {
      try {
        setLoading(true);
        setError(null);
        let url = '/api/form-submissions';
        const dept = user?.role === 'admin' ? selectedDepartment : (user?.department || '');
        const params = new URLSearchParams();
        if (dept && dept !== 'All') {
          params.set('department', dept);
        }
        if (timeframe) {
          params.set('timeframe', timeframe);
        }
        const qs = params.toString();
        if (qs) url += `?${qs}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setRecords(Array.isArray(data) ? data : []);
        } else {
          setRecords([]);
          setError('Failed to load analytics data.');
        }
      } catch (err) {
        console.error('Error fetching records:', err);
        setRecords([]);
        setError('Network error while loading analytics data.');
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, [user, selectedDepartment, timeframe, refreshTick]);

  // Load departments for admin department selector
  useEffect(() => {
    const loadDepartments = async () => {
      if (user?.role !== 'admin') return;
      try {
        const res = await fetch('/api/departments');
        const list = res.ok ? await res.json() : [];
        setDepartments(['All', ...(Array.isArray(list) ? list : [])]);
      } catch (e) {
        setDepartments(['All']);
      }
    };
    loadDepartments();
  }, [user]);

  // Filter records by department (client-side fallback)
  const filteredRecords = (() => {
    if (user?.role === 'admin') {
      if (selectedDepartment && selectedDepartment !== 'All') {
        return records.filter(r => (r.template_department || r.department) === selectedDepartment);
      }
      return records;
    }
    // Non-admin: always scope to user's department
    return records.filter(r => (r.template_department || r.department) === user?.department);
  })();

  const analytics = useMemo(() => {
    const now = new Date();
    const timeframeDays = timeframe === 'week' ? 7 : timeframe === 'month' ? 30 : 90;
    const cutoffDate = new Date(now.getTime() - (timeframeDays * 24 * 60 * 60 * 1000));
    
    const timeFrameRecords = filteredRecords.filter(record => 
      new Date(record.submitted_at || record.created_at) >= cutoffDate
    );

    // Stability trends from form data
    const stabilityTrends = timeFrameRecords.reduce((acc, record) => {
      const stability = record.form_data?.stability || record.form_data?.['Patient Stability'] || 'Unknown';
      acc[stability] = (acc[stability] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Department trends (for admin)
    const departmentTrends = user?.role === 'admin' 
      ? timeFrameRecords.reduce((acc, record) => {
          const dept = record.template_department || 'Unknown';
          acc[dept] = (acc[dept] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      : {};

    // Template trends
    const templateTrends = timeFrameRecords.reduce((acc, record) => {
      const template = record.template_name || 'Unknown';
      acc[template] = (acc[template] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Daily activity for the last 30 days
    // Build date -> count map first for O(n) aggregation
    const countsByDate: Record<string, number> = {};
    for (const rec of timeFrameRecords) {
      const d = new Date(rec.submitted_at || rec.created_at);
      const key = d.toDateString();
      countsByDate[key] = (countsByDate[key] || 0) + 1;
    }
    const dailyActivity = [] as { date: string; count: number }[];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toDateString();
      dailyActivity.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count: countsByDate[key] || 0,
      });
    }

    // Average vital signs from form data
    const vitalStats = timeFrameRecords.reduce((acc, record) => {
      const formData = record.form_data || {};
      const temp = formData.temperature || formData['Temperature'] || formData['Body Temperature'];
      const hr = formData.heartRate || formData['Heart Rate'] || formData['Pulse'];
      const o2 = formData.oxygenSaturation || formData['Oxygen Saturation'] || formData['SpO2'];
      
      if (temp && !isNaN(Number(temp))) {
        acc.temperature.sum += Number(temp);
        acc.temperature.count++;
      }
      if (hr && !isNaN(Number(hr))) {
        acc.heartRate.sum += Number(hr);
        acc.heartRate.count++;
      }
      if (o2 && !isNaN(Number(o2))) {
        acc.oxygenSaturation.sum += Number(o2);
        acc.oxygenSaturation.count++;
      }
      return acc;
    }, {
      temperature: { sum: 0, count: 0 },
      heartRate: { sum: 0, count: 0 },
      oxygenSaturation: { sum: 0, count: 0 }
    });

    return {
      totalRecords: timeFrameRecords.length,
      stabilityTrends,
      departmentTrends,
      templateTrends,
      dailyActivity,
      avgTemperature: vitalStats.temperature.count > 0 ? (vitalStats.temperature.sum / vitalStats.temperature.count).toFixed(1) : 'N/A',
      avgHeartRate: vitalStats.heartRate.count > 0 ? Math.round(vitalStats.heartRate.sum / vitalStats.heartRate.count) : 'N/A',
      avgOxygenSaturation: vitalStats.oxygenSaturation.count > 0 ? Math.round(vitalStats.oxygenSaturation.sum / vitalStats.oxygenSaturation.count) : 'N/A'
    };
  }, [filteredRecords, timeframe, user?.role]);

  // Helpers: refresh and export CSV for current timeframe/filters
  const handleRefresh = () => {
    setRefreshTick((prev) => prev + 1);
  };

  const getTimeFrameRecords = () => {
    const now = new Date();
    const timeframeDays = timeframe === 'week' ? 7 : timeframe === 'month' ? 30 : 90;
    const cutoffDate = new Date(now.getTime() - (timeframeDays * 24 * 60 * 60 * 1000));
    return filteredRecords.filter(record => new Date(record.submitted_at || record.created_at) >= cutoffDate);
  };

  const handleExportCSV = () => {
    const data = getTimeFrameRecords();
    if (!data.length) return;
    const flatten = (obj: any, prefix = ''): any => {
      return Object.keys(obj || {}).reduce((acc: any, key) => {
        const val = (obj as any)[key];
        const k = prefix ? `${prefix}.${key}` : key;
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          Object.assign(acc, flatten(val, k));
        } else {
          acc[k] = val;
        }
        return acc;
      }, {});
    };
    const rows: Record<string, any>[] = data.map((r: any) => ({
      id: r.id,
      date: r.submitted_at || r.created_at,
      department: r.template_department || r.department || '',
      template: r.template_name || '',
      stability: r.form_data?.stability || r.form_data?.['Patient Stability'] || '',
      ...flatten(r.form_data || {}, 'form')
    }));
    const headerSet: Set<string> = rows.reduce<Set<string>>((set: Set<string>, row: Record<string, any>) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set<string>());
    const headers: string[] = Array.from(headerSet);
    const csv = [
      headers.join(','),
      ...rows.map(row => headers.map(h => {
        const val = row[h] ?? '';
        const s = String(val).replace(/"/g, '""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
      }).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics_${timeframe}_${selectedDepartment || user?.department || 'dept'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStabilityColor = (stability: string) => {
    switch (stability.toLowerCase()) {
      case 'stable':
        return 'bg-green-500';
      case 'unstable':
        return 'bg-yellow-500';
      case 'critical':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getDepartmentColor = (index: number) => {
    const colors = ['bg-blue-500', 'bg-purple-500', 'bg-indigo-500', 'bg-pink-500', 'bg-teal-500'];
    return colors[index % colors.length];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analytics & Trends</h2>
          <p className="text-gray-600 mt-1">
            Clinical insights and patterns for {user?.role === 'admin' ? (selectedDepartment === 'All' ? 'all departments' : selectedDepartment) : user?.department}
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          {user?.role === 'admin' && (
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              title="Filter by department"
            >
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}
          <Calendar className="h-4 w-4 text-gray-400" />
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as 'week' | 'month' | 'quarter')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="quarter">Last 90 Days</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 inline-flex items-center"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExportCSV}
            disabled={loading || analytics.totalRecords === 0}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 inline-flex items-center"
            title="Export CSV"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          <AlertCircle className="w-5 h-5 mt-0.5" />
          <div>
            <div className="font-medium">Error</div>
            <div className="text-sm">{error}</div>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
          <span className="text-gray-600">Loading analytics...</span>
        </div>
      )}

      {/* Overview Stats */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Records</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{analytics.totalRecords}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-100">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Temperature</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{analytics.avgTemperature}°C</p>
              </div>
              <div className="p-3 rounded-lg bg-red-100">
                <Activity className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Heart Rate</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{analytics.avgHeartRate} bpm</p>
              </div>
              <div className="p-3 rounded-lg bg-green-100">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg O2 Saturation</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{analytics.avgOxygenSaturation}%</p>
              </div>
              <div className="p-3 rounded-lg bg-purple-100">
                <Activity className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Stability Trends */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Patient Stability</h3>
              <PieChart className="w-5 h-5 text-gray-400" />
            </div>
            
            <div className="space-y-4">
              {(Object.entries(analytics.stabilityTrends) as [string, number][]).map(([stability, count]) => {
                const percentage = analytics.totalRecords > 0 
                  ? ((count / analytics.totalRecords) * 100).toFixed(1) 
                  : 0;
                return (
                  <div key={stability} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`w-4 h-4 rounded-full mr-3 ${getStabilityColor(stability)}`}></div>
                      <span className="text-sm font-medium text-gray-900">{stability}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-gray-900">{count}</span>
                      <span className="text-xs text-gray-500 ml-2">({percentage}%)</span>
                    </div>
                  </div>
                );
              })}
              {Object.keys(analytics.stabilityTrends).length === 0 && (
                <div className="text-center text-gray-500 py-4">No stability data available</div>
              )}
            </div>
          </div>

          {/* Template Distribution */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Form Templates</h3>
              <Users className="w-5 h-5 text-gray-400" />
            </div>
            
            <div className="space-y-4">
              {(Object.entries(analytics.templateTrends) as [string, number][]).slice(0, 5).map(([template, count], index) => {
                const percentage = analytics.totalRecords > 0 
                  ? ((count / analytics.totalRecords) * 100).toFixed(1) 
                  : 0;
                return (
                  <div key={template} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`w-4 h-4 rounded-full mr-3 ${getDepartmentColor(index)}`}></div>
                      <span className="text-sm font-medium text-gray-900 truncate" title={template}>
                        {template.length > 20 ? template.substring(0, 20) + '...' : template}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-gray-900">{count}</span>
                      <span className="text-xs text-gray-500 ml-2">({percentage}%)</span>
                    </div>
                  </div>
                );
              })}
              {Object.keys(analytics.templateTrends).length === 0 && (
                <div className="text-center text-gray-500 py-4">No template data available</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Department Trends (Admin Only) */}
      {!loading && user?.role === 'admin' && Object.keys(analytics.departmentTrends).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Department Activity</h3>
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(Object.entries(analytics.departmentTrends) as [string, number][]).map(([department, count], index) => {
              const percentage = analytics.totalRecords > 0 
                ? ((count / analytics.totalRecords) * 100).toFixed(1) 
                : 0;
              return (
                <div key={department} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">{department}</span>
                    <div className={`w-3 h-3 rounded-full ${getDepartmentColor(index)}`}></div>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{count}</div>
                  <div className="text-xs text-gray-500">{percentage}% of total</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Daily Activity Chart */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Daily Activity (Last 30 Days)</h3>
          <TrendingUp className="w-5 h-5 text-gray-400" />
        </div>
        
        <div className="flex items-end space-x-1 h-40">
          {(() => {
            const maxCount = Math.max(...analytics.dailyActivity.map(d => d.count), 1);
            return analytics.dailyActivity.map((day, index) => {
              const height = (day.count / maxCount) * 100;
              return (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div 
                    className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                    style={{ height: `${height}%` }}
                    title={`${day.date}: ${day.count} records`}
                  ></div>
                  <div className="text-xs text-gray-500 mt-2 text-center truncate w-full">
                    {day.date}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
};
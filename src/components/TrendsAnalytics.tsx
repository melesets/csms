import React, { useState, useMemo, useEffect } from 'react';
import { TrendingUp, Users, Activity, Calendar, BarChart3, PieChart } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export const TrendsAnalytics = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'quarter'>('month');

  // Fetch real form submissions from backend
  useEffect(() => {
    const fetchRecords = async () => {
      try {
        let url = '/api/form-submissions';
        if (user?.role !== 'admin' && user?.department) {
          url += `?department=${encodeURIComponent(user.department)}`;
        }
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setRecords(data);
        }
      } catch (err) {
        console.error('Error fetching records:', err);
        setRecords([]);
      }
    };
    fetchRecords();
  }, [user]);

  // Filter records by department for non-admin users
  const filteredRecords = user?.role === 'admin' 
    ? records 
    : records.filter(record => record.template_department === user?.department);

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
    const dailyActivity = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayRecords = timeFrameRecords.filter(record => {
        const recordDate = new Date(record.submitted_at || record.created_at);
        return recordDate.toDateString() === date.toDateString();
      });
      dailyActivity.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count: dayRecords.length
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
            Clinical insights and patterns for {user?.role === 'admin' ? 'all departments' : user?.department}
          </p>
        </div>
        <div className="flex items-center space-x-2">
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
        </div>
      </div>

      {/* Overview Stats */}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stability Trends */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Patient Stability</h3>
            <PieChart className="w-5 h-5 text-gray-400" />
          </div>
          
          <div className="space-y-4">
            {Object.entries(analytics.stabilityTrends).map(([stability, count]) => {
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
            {Object.entries(analytics.templateTrends).slice(0, 5).map(([template, count], index) => {
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

      {/* Department Trends (Admin Only) */}
      {user?.role === 'admin' && Object.keys(analytics.departmentTrends).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Department Activity</h3>
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(analytics.departmentTrends).map(([department, count], index) => {
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
          {analytics.dailyActivity.map((day, index) => {
            const maxCount = Math.max(...analytics.dailyActivity.map(d => d.count), 1);
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
          })}
        </div>
      </div>
    </div>
  );
};
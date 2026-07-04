// Trends analytics - charts and statistics for clinical data analysis
import { useState, useMemo, useEffect, useRef } from 'react';
import { TrendingUp, Users, Activity, Calendar, BarChart3, PieChart, RefreshCw, Download, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { gregorianToEthiopian, formatEthiopianDate } from '../../utils/ethiopianCalendar';

export const TrendsAnalytics = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month' | 'quarter'>('month');
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
        const [res, resResources] = await Promise.all([
          fetch(url),
          fetch('/api/resources')
        ]);
        if (res.ok) {
          const data = await res.json();
          setRecords(Array.isArray(data) ? data : []);
        } else {
          setRecords([]);
          setError('Failed to load analytics data.');
        }
        if (resResources.ok) {
          const rdata = await resResources.json();
          setResources(Array.isArray(rdata) ? rdata : []);
        } else {
          setResources([]);
        }
      } catch (err) {
        console.error('Error fetching records:', err);
        setRecords([]);
        setError('Network error while loading analytics data.');
        setResources([]);
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
    const timeframeDays = timeframe === 'today' ? 0 : timeframe === 'week' ? 7 : timeframe === 'month' ? 30 : 90;
    const cutoffDate = timeframe === 'today' 
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) // Start of today
      : new Date(now.getTime() - (timeframeDays * 24 * 60 * 60 * 1000));
    
    const timeFrameRecords = filteredRecords.filter(record => 
      new Date(record.submitted_at || record.created_at) >= cutoffDate
    );

    // Normalize stability into stable/unstable/critical buckets
    const normalizeStability = (val: unknown): 'stable' | 'unstable' | 'critical' => {
      const s = String(val ?? '').trim().toLowerCase();
      if (!s || s === 'unknown') return 'stable';
      if (/sub[-\s]?critical/.test(s) || /\bamber\b/.test(s) || /\byellow\b/.test(s) || /\bcode\s*yellow\b/.test(s)) return 'unstable';
      if (/\bunstable\b/.test(s)) return 'unstable';
      if (/\bcritical\b/.test(s) || /\bcode\s*red\b/.test(s) || s === 'red' || s === 'r') return 'critical';
      if (/stabl/.test(s) || /\bcode\s*green\b/.test(s) || s === 'green' || s === 'g') return 'stable';
      const n = Number(s);
      if (!isNaN(n)) {
        if (n >= 3) return 'critical';
        if (n === 2) return 'unstable';
        return 'stable';
      }
      return 'stable';
    };

    // Extract best-effort stability value from a record's form_data by checking common fields and scanning string fields
    const extractStabilityValue = (formData: any): string => {
      if (!formData || typeof formData !== 'object') return '';
      const candidates = [
        'stability', 'Stability', 'patient_stability', 'Patient Stability', 'Patient stability',
        'status', 'Status', 'patientStatus', 'Patient Status',
        'triage', 'Triage', 'acuity', 'Acuity', 'code', 'Code'
      ];
      for (const key of candidates) {
        const v = formData?.[key];
        if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
      }
      // Fallback: scan all primitive string fields for stability-like keywords
      for (const [, v] of Object.entries(formData)) {
        if (v && typeof v === 'string') {
          const s = v.toLowerCase();
          if (/\bcritical\b|\bunstable\b|sub[-\s]?critical|\bcode\s*(red|yellow|green)\b|\bred\b|\byellow\b|\bgreen\b/.test(s)) {
            return v;
          }
        }
      }
      return '';
    };

    // Stability trends from form data (raw aggregation for the right-hand list)
    const stabilityTrends = timeFrameRecords.reduce((acc, record) => {
      const raw = extractStabilityValue(record.form_data);
      const normalized = normalizeStability(raw);
      acc[normalized] = (acc[normalized] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Derived counts for critical and subcritical (unstable)
    let criticalCount = 0;
    let subcriticalCount = 0;
    for (const rec of timeFrameRecords) {
      const raw = extractStabilityValue(rec.form_data);
      const norm = normalizeStability(raw);
      if (norm === 'critical') criticalCount++;
      else if (norm === 'unstable') subcriticalCount++;
    }

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

    // Daily activity series (Stable/Subcritical/Critical) for the last 30 days with Ethiopian labels
    // Build date -> {stable, subcritical, critical} map
    const byDate: Record<string, { stable: number; subcritical: number; critical: number; total: number }> = {};
    for (const rec of timeFrameRecords) {
      const d = new Date(rec.submitted_at || rec.created_at);
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString();
      const raw = extractStabilityValue(rec.form_data);
      const norm = normalizeStability(raw);
      if (!byDate[key]) byDate[key] = { stable: 0, subcritical: 0, critical: 0, total: 0 };
      byDate[key][norm === 'unstable' ? 'subcritical' : (norm as 'stable' | 'critical')] += 1 as any;
      byDate[key].total += 1;
    }
    const dailyLabels: string[] = [];
    const dailyStable: number[] = [];
    const dailySubcritical: number[] = [];
    const dailyCritical: number[] = [];
    const dailyTotal: number[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const key = date.toISOString();
      const eth = gregorianToEthiopian(date);
      const label = formatEthiopianDate(eth, 'short');
      dailyLabels.push(label);
      const bucket = byDate[key] || { stable: 0, subcritical: 0, critical: 0, total: 0 };
      dailyStable.push(bucket.stable);
      dailySubcritical.push(bucket.subcritical);
      dailyCritical.push(bucket.critical);
      dailyTotal.push(bucket.total);
    }

    // Inventory metrics: expired drugs and stock-out counts (scoped to department)
    const scopedResources = (() => {
      const dept = (user?.role === 'admin') ? (selectedDepartment || '') : (user?.department || '');
      const arr = Array.isArray(resources) ? resources : [];
      if (dept && dept !== 'All') return arr.filter((r: any) => String(r.department || '').toLowerCase() === String(dept).toLowerCase());
      return arr;
    })();
    
    // Helpers for robustness across naming variations
    const isDrugItem = (item: any): boolean => {
      const type = String(item?.type ?? item?.Type ?? item?.category ?? item?.Category ?? '').toLowerCase();
      return type.includes('drug') || type.includes('med') || type.includes('pharm');
    };
    const getExpiryDate = (item: any): Date | null => {
      const raw = item?.expiry_date;
      if (!raw) return null;
      const d = new Date(raw as any);
      return isNaN(d.getTime()) ? null : d;
    };
    const getQuantity = (item: any): number | null => {
      const qRaw = item?.quantity ?? item?.qty ?? item?.current_quantity ?? item?.currentQuantity;
      const q = Number(qRaw);
      return isNaN(q) ? null : q;
    };
    const getStandard = (item: any): number | null => {
      const sRaw = item?.standard_quantity ?? item?.standard ?? item?.min_required ?? item?.minRequired;
      const s = Number(sRaw);
      return isNaN(s) ? null : s;
    };

    const expiredCount = scopedResources.reduce((acc: number, r: any) => {
      if (!isDrugItem(r)) return acc; // only drugs for expiry
      const q = getQuantity(r);
      if (q === null || q <= 0) return acc; // exclude zero-qty items from expired
      const d = getExpiryDate(r);
      if (d && d < now) return acc + 1;
      return acc;
    }, 0);
    const stockOutCount = scopedResources.reduce((acc: number, r: any) => {
      const q = getQuantity(r);
      const s = getStandard(r);
      if (q === null) return acc;
      const isLowStock = (!Number.isNaN(q) && (
        q <= 0 || (s !== null && !Number.isNaN(s) ? (q < 2 && s >= 2) : (q < 2))
      ));
      return isLowStock ? acc + 1 : acc;
    }, 0);

    return {
      totalRecords: timeFrameRecords.length,
      stabilityTrends,
      departmentTrends,
      templateTrends,
      dailyActivity: dailyLabels.map((label, idx) => ({ date: label, count: dailyTotal[idx] })),
      dailySeries: {
        labels: dailyLabels,
        stable: dailyStable,
        subcritical: dailySubcritical,
        critical: dailyCritical,
      },
      criticalCount,
      subcriticalCount,
      expiredCount,
      stockOutCount,
    };
  }, [filteredRecords, timeframe, user?.role, selectedDepartment, resources]);

  // Helpers: refresh and export CSV for current timeframe/filters
  const handleRefresh = () => {
    setRefreshTick((prev) => prev + 1);
  };

  const getTimeFrameRecords = () => {
    const now = new Date();
    const timeframeDays = timeframe === 'today' ? 0 : timeframe === 'week' ? 7 : timeframe === 'month' ? 30 : 90;
    const cutoffDate = timeframe === 'today' 
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) // Start of today
      : new Date(now.getTime() - (timeframeDays * 24 * 60 * 60 * 1000));
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
      case 'subcritical':
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
            onChange={(e) => setTimeframe(e.target.value as 'today' | 'week' | 'month' | 'quarter')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="today">Today</option>
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
                <p className="text-sm font-medium text-gray-600">Critical Patients</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{analytics.criticalCount}</p>
              </div>
              <div className="p-3 rounded-lg bg-red-100">
                <Activity className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Subcritical Patients</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{analytics.subcriticalCount}</p>
              </div>
              <div className="p-3 rounded-lg bg-green-100">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Expired Drugs</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{analytics.expiredCount}</p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-100">
                <Activity className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Stock-Out Drugs</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{analytics.stockOutCount}</p>
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
        {(() => {
          const labels = analytics.dailySeries?.labels || [];
          const stable = analytics.dailySeries?.stable || [];
          const subcritical = analytics.dailySeries?.subcritical || [];
          const critical = analytics.dailySeries?.critical || [];
          const allValues = [...stable, ...subcritical, ...critical];
          const maxVal = Math.max(...allValues, 1);
          const containerRef = useRef<HTMLDivElement>(null);
          const [w, setW] = useState(0);
          const h = 220;
          const pad = { l: 36, r: 16, t: 16, b: 36 };
          useEffect(() => {
            const update = () => setW(containerRef.current ? containerRef.current.clientWidth : 0);
            update();
            window.addEventListener('resize', update);
            return () => window.removeEventListener('resize', update);
          }, []);
          const innerW = Math.max(0, w - pad.l - pad.r);
          const innerH = h - pad.t - pad.b;
          const xFor = (i: number) => pad.l + (labels.length <= 1 ? 0 : (i / (labels.length - 1)) * innerW);
          const yFor = (v: number) => pad.t + (1 - (v / maxVal)) * innerH;
          const toPath = (arr: number[]) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(v).toFixed(1)}`).join(' ');
          const [hover, setHover] = useState<number | null>(null);
          const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const x = e.clientX - rect.left;
            if (innerW <= 0 || labels.length <= 1) { setHover(null); return; }
            const rel = Math.max(0, Math.min(1, (x - pad.l) / innerW));
            const idx = Math.round(rel * (labels.length - 1));
            setHover(idx);
          };
          const onLeave = () => setHover(null);
          return (
            <div ref={containerRef} className="relative w-full">
              <svg width={w} height={h} className="block" onMouseMove={onMove} onMouseLeave={onLeave}>
                <rect x={pad.l} y={pad.t} width={innerW} height={innerH} fill="#ffffff" stroke="#e5e7eb" />
                {/* Y gridlines */}
                {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
                  <g key={i}>
                    <line x1={pad.l} y1={pad.t + (1 - t) * innerH} x2={pad.l + innerW} y2={pad.t + (1 - t) * innerH} stroke="#f3f4f6" />
                    <text x={pad.l - 6} y={pad.t + (1 - t) * innerH + 3} fontSize="10" textAnchor="end" fill="#6b7280">{Math.round(t * maxVal)}</text>
                  </g>
                ))}
                {/* Lines */}
                <path d={toPath(stable)} fill="none" stroke="#22c55e" strokeWidth={2} />
                <path d={toPath(subcritical)} fill="none" stroke="#f59e0b" strokeWidth={2} />
                <path d={toPath(critical)} fill="none" stroke="#ef4444" strokeWidth={2} />
                {/* Points (for accessibility) */}
                {stable.map((v, i) => (<circle key={`s-${i}`} cx={xFor(i)} cy={yFor(v)} r={2} fill="#22c55e" />))}
                {subcritical.map((v, i) => (<circle key={`u-${i}`} cx={xFor(i)} cy={yFor(v)} r={2} fill="#f59e0b" />))}
                {critical.map((v, i) => (<circle key={`c-${i}`} cx={xFor(i)} cy={yFor(v)} r={2} fill="#ef4444" />))}
                {/* X labels */}
                {labels.map((lab, i) => (
                  <text key={`xl-${i}`} x={xFor(i)} y={h - 10} fontSize="10" textAnchor="middle" fill="#6b7280">{lab}</text>
                ))}
                {/* Hover line */}
                {hover !== null && hover >= 0 && hover < labels.length && (
                  <line x1={xFor(hover)} y1={pad.t} x2={xFor(hover)} y2={pad.t + innerH} stroke="#9ca3af" strokeDasharray="3,3" />
                )}
                {/* Legend */}
                <g>
                  <circle cx={pad.l} cy={14} r={4} fill="#22c55e" />
                  <text x={pad.l + 8} y={18} fontSize="11" fill="#374151">Stable</text>
                  <circle cx={pad.l + 74} cy={14} r={4} fill="#f59e0b" />
                  <text x={pad.l + 82} y={18} fontSize="11" fill="#374151">Subcritical</text>
                  <circle cx={pad.l + 170} cy={14} r={4} fill="#ef4444" />
                  <text x={pad.l + 178} y={18} fontSize="11" fill="#374151">Critical</text>
                </g>
              </svg>
              {/* Tooltip */}
              {hover !== null && (
                <div
                  className="absolute pointer-events-none bg-white shadow rounded px-2 py-1 text-xs text-gray-700 border"
                  style={{ left: Math.max(0, Math.min(w - 140, xFor(hover) - 60)), top: 0 }}
                >
                  <div className="font-medium text-gray-900 mb-1">{labels[hover]}</div>
                  <div className="flex items-center gap-2"><span className="inline-block w-2 h-2 rounded-full" style={{background:'#22c55e'}}></span>Stable: {stable[hover] ?? 0}</div>
                  <div className="flex items-center gap-2"><span className="inline-block w-2 h-2 rounded-full" style={{background:'#f59e0b'}}></span>Subcritical: {subcritical[hover] ?? 0}</div>
                  <div className="flex items-center gap-2"><span className="inline-block w-2 h-2 rounded-full" style={{background:'#ef4444'}}></span>Critical: {critical[hover] ?? 0}</div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
};

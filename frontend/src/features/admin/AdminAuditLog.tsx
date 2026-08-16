// Admin Activity Log - complete hospital audit trail across all data sources (no shift check-ins/outs — those are on the Check-in Log page)
// - Full-record view with date-range retrieval (month, year, custom) and filters
// - Real analytics: totals, daily trend, activity by type, top people & departments
// - Manual cleanup: delete records in a range to free database memory
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiGet } from '../../api';
import { EthiopianDateTimeDisplay, EthiopianDateDisplay } from '../../components/shared';
import { gregorianToEthiopian, formatEthiopianDate } from '../../utils/ethiopianCalendar';
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  ScrollText, RefreshCw, FileText, Package, ClipboardCheck, Shield,
  UserPlus, Search, ChevronDown, ChevronRight, Trash2, CalendarRange, Filter,
  Users, Building2, Activity, AlertTriangle, CheckCircle2, X, TrendingUp, Layers
} from 'lucide-react';
import EthiopianDatePicker from '../scheduling/EthiopianDatePicker';
import { ActivityFeed } from '../staff/ActivityFeed';
import { useDepartments } from '../../hooks/useDepartments';

type TypeKey = 'all' | 'submissions' | 'resources' | 'inventory' | 'admin' | 'staff';

interface AuditRecord {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  person: string;
  department: string | null;
  shift: string | null;
  timestamp: string;
}

interface StatsResponse {
  total: number;
  byType: Record<string, number>;
  daily: { date: string; count: number }[];
  topUsers: { name: string; count: number }[];
  topDepts: { name: string; count: number }[];
}

const PAGE_SIZE = 25;

/* ─── Colors (matches Analytics page palette) ─────────── */
const C = {
  navy: '#003153', navyDark: '#002640',
  indigo: '#6366f1', blue: '#3b82f6', purple: '#8b5cf6',
  pink: '#ec4899', teal: '#14b8a6', amber: '#f59e0b',
  emerald: '#10b981', red: '#ef4444', slate: '#94a3b8',
};
const TYPE_COLORS: Record<string, string> = {
  submissions: C.blue, resources: C.indigo, inventory: C.emerald,
  admin: C.purple, staff: C.amber,
};

const TYPE_META: Record<string, { label: string; icon: any; badge: string }> = {
  submissions: { label: 'Reports', icon: FileText, badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  resources: { label: 'Inventory Updates', icon: Package, badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  inventory: { label: 'Inventory Reports', icon: ClipboardCheck, badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  admin: { label: 'Admin Actions', icon: Shield, badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  staff: { label: 'Staff Registered', icon: UserPlus, badge: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const PRESETS: { id: string; label: string; days: number | null }[] = [
  { id: '7d', label: '7D', days: 7 },
  { id: '30d', label: '1M', days: 30 },
  { id: '90d', label: '3M', days: 90 },
  { id: '180d', label: '6M', days: 180 },
  { id: '365d', label: '1Y', days: 365 },
  { id: 'all', label: 'All', days: null },
];

const toDateInput = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return toDateInput(d); };

/* ─── Stat Card (same style as Analytics) ─────────────── */
function StatCard({ icon: Icon, label, value, bg, iconColor, sub }: {
  icon: any; label: string; value: number | string; bg: string; iconColor: string; sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider truncate">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-[11px] text-gray-400 mt-1 truncate">{sub}</p>}
        </div>
        <div className={`p-2 rounded-lg shrink-0 ${bg}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 text-white text-xs rounded-xl px-3 py-2 shadow-xl border border-gray-700">
      <p className="font-semibold mb-1 text-gray-300">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || p.fill }} />
          <span className="text-gray-400">{p.name}:</span>
          <span className="font-bold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function Section({ title, icon: Icon, children, action, className = '' }: {
  title: string; icon: any; children: React.ReactNode; action?: React.ReactNode; className?: string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:shadow-gray-100/60 transition-shadow duration-300 ${className}`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50/50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-gray-100 rounded-lg"><Icon className="w-4 h-4 text-gray-500" /></div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {action}
          {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </div>
      </button>
      {open && <div className="px-6 pb-6">{children}</div>}
    </div>
  );
}

export default function AdminAuditLog() {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [preset, setPreset] = useState('30d');
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(toDateInput(new Date()));
  const [typeSel, setTypeSel] = useState<TypeKey>('all');
  const [deptSel, setDeptSel] = useState('');
  const [personSel, setPersonSel] = useState('');
  const [search, setSearch] = useState('');

  const [deptOptions, setDeptOptions] = useState<string[]>([]);
  const [personOptions, setPersonOptions] = useState<string[]>([]);

  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  // ── Service unit activity feed ───────────────────────
  const { departments } = useDepartments();
  const [feedDept, setFeedDept] = useState('All');

  // ── Cleanup (delete) state ────────────────────────────
  const [delFrom, setDelFrom] = useState(daysAgo(30));
  const [delTo, setDelTo] = useState(toDateInput(new Date()));
  const [delType, setDelType] = useState<TypeKey>('all');
  const [delPreview, setDelPreview] = useState<StatsResponse | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const showToast = useCallback((ok: boolean, msg: string) => {
    setToast({ ok, msg });
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (typeSel !== 'all') p.set('type', typeSel);
    if (deptSel) p.set('department', deptSel);
    if (personSel) p.set('person', personSel);
    return p;
  }, [from, to, typeSel, deptSel, personSel]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams(queryParams);
      if (search) p.set('search', search);
      p.set('limit', String(PAGE_SIZE));
      p.set('offset', String((page - 1) * PAGE_SIZE));
      const data = await apiGet(`/activity/admin/all?${p}`);
      setRecords(data.records || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to load activity records:', err);
      showToast(false, 'Failed to load activity records');
    } finally {
      setLoading(false);
    }
  }, [queryParams, search, page, showToast]);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const data = await apiGet(`/activity/admin/stats?${queryParams}`);
      setStats(data);
    } catch (err) {
      console.error('Failed to load activity stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, [queryParams]);

  const fetchOptions = useCallback(async () => {
    try {
      const p = new URLSearchParams(queryParams);
      p.set('limit', '1000');
      p.set('offset', '0');
      const data = await apiGet(`/activity/admin/all?${p}`);
      const rows: AuditRecord[] = data.records || [];
      setDeptOptions([...new Set(rows.map(r => r.department).filter(Boolean) as string[])].sort());
      setPersonOptions([...new Set(rows.map(r => r.person).filter(Boolean))].sort());
    } catch { /* non-critical */ }
  }, [queryParams]);

  useEffect(() => { fetchRecords(); fetchStats(); fetchOptions(); }, [fetchRecords, fetchStats, fetchOptions]);

  // Live monitoring — auto-refresh records & stats every 30 seconds
  useEffect(() => {
    const iv = window.setInterval(() => { fetchRecords(); fetchStats(); }, 30000);
    return () => window.clearInterval(iv);
  }, [fetchRecords, fetchStats]);

  const applyPreset = (id: string) => {
    setPreset(id);
    const p = PRESETS.find(x => x.id === id);
    if (p && p.days !== null) {
      setFrom(daysAgo(p.days));
      setTo(toDateInput(new Date()));
    } else {
      setFrom('');
      setTo('');
    }
    setPage(1);
  };

  const clearFilters = () => {
    setPreset('30d'); setFrom(daysAgo(30)); setTo(toDateInput(new Date()));
    setTypeSel('all'); setDeptSel(''); setPersonSel(''); setSearch(''); setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const previewDelete = async () => {
    setPreviewing(true);
    setDelPreview(null);
    try {
      const p = new URLSearchParams();
      if (delFrom) p.set('from', delFrom);
      if (delTo) p.set('to', delTo);
      if (delType !== 'all') p.set('type', delType);
      const data = await apiGet(`/activity/admin/stats?${p}`);
      setDelPreview(data);
    } catch (err) {
      showToast(false, 'Failed to preview deletion');
    } finally {
      setPreviewing(false);
    }
  };

  const executeDelete = async () => {
    setDeleting(true);
    try {
      const body = JSON.stringify({
        from: delFrom || undefined,
        to: delTo || undefined,
        type: delType === 'all' ? 'all' : delType,
      });
      const res = await fetch('/api/activity/admin/records', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Delete failed');
      showToast(true, `Deleted ${data.total} record(s) to free memory`);
      setShowConfirm(false);
      setDelPreview(null);
      fetchRecords(); fetchStats();
    } catch (err: any) {
      showToast(false, err?.message || 'Delete failed');
      setShowConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  /* ─── Chart data ────────────────────────────────────── */
  const dailyData = useMemo(() => (stats?.daily || []).map(d => ({
    date: formatEthiopianDate(gregorianToEthiopian(new Date(`${d.date}T00:00:00`)), 'short'),
    count: d.count,
  })), [stats]);

  const typeData = useMemo(() => Object.entries(TYPE_META).map(([k, m]) => ({
    name: m.label,
    count: stats?.byType?.[k] || 0,
    color: TYPE_COLORS[k],
  })), [stats]);

  const userData = useMemo(() => (stats?.topUsers || []).map(u => ({ ...u })), [stats]);
  const deptData = useMemo(() => (stats?.topDepts || []).map(d => ({ ...d })), [stats]);

  const rangeLabel = preset === 'all'
    ? 'All time'
    : `${from || 'start'} → ${to || 'now'}`;

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold text-white ${toast.ok ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#003153] rounded-xl">
            <ScrollText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Activity Log</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Reports, inventory, admin & staff actions — {rangeLabel} · check-ins/outs on the Check-in Log page
              {total > 0 && <span className="ml-2 text-xs font-semibold text-[#003153]">{total} records</span>}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {PRESETS.map(p => (
              <button key={p.id} onClick={() => applyPreset(p.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${preset === p.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5 block">From</label>
            <EthiopianDatePicker value={from} onChange={v => { setFrom(v); setPreset('custom'); setPage(1); }} />
          </div>
          <span className="text-xs text-gray-400 mt-5">→</span>
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5 block">To</label>
            <EthiopianDatePicker value={to} onChange={v => { setTo(v); setPreset('custom'); setPage(1); }} />
          </div>
          <button onClick={() => { fetchRecords(); fetchStats(); }} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors" title="Refresh now">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
          <span className="text-[10px] text-gray-400 font-medium">auto-refresh 30s</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search what / who / where..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              onKeyDown={e => { if (e.key === 'Enter') fetchRecords(); }}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm font-medium bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#003153]/20 focus:border-[#003153]/40 transition-all"
            />
          </div>
          <select value={typeSel} onChange={e => { setTypeSel(e.target.value as TypeKey); setPage(1); }}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium bg-gray-50 text-gray-700">
            <option value="all">All Types</option>
            {Object.entries(TYPE_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
          <select value={deptSel} onChange={e => { setDeptSel(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium bg-gray-50 text-gray-700 min-w-[140px]">
            <option value="">All Departments</option>
            {deptOptions.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={personSel} onChange={e => { setPersonSel(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium bg-gray-50 text-gray-700 min-w-[140px]">
            <option value="">All People</option>
            {personOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {(search || typeSel !== 'all' || deptSel || personSel || preset !== '30d') && (
            <button onClick={clearFilters}
              className="px-3 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 text-xs font-semibold transition-colors">
              <Filter className="w-3.5 h-3.5 inline mr-1" />Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Service unit activity feed */}
      <Section title="Service Unit Activity Feed" icon={Activity}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
            <select value={feedDept} onChange={e => setFeedDept(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium bg-white text-gray-700 min-w-[200px]">
              <option value="All">All Departments & Service Units</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <p className="text-[11px] text-gray-400">
            Session-based activity feed (last 14 days) — same feed and logic as the staff pages.
          </p>
        </div>
        <ActivityFeed department={feedDept} />
      </Section>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Layers} label="Total Actions" value={stats?.total ?? 0}
          bg="bg-[#003153]/5" iconColor="text-[#003153]" sub={`${typeData.reduce((a, t) => a + t.count, 0)} across all sources`} />
        <StatCard icon={FileText} label="Reports" value={stats?.byType?.submissions ?? 0}
          bg="bg-blue-50" iconColor="text-blue-500" />
        <StatCard icon={Package} label="Inventory Updates" value={stats?.byType?.resources ?? 0}
          bg="bg-indigo-50" iconColor="text-indigo-500" />
        <StatCard icon={ClipboardCheck} label="Inventory Reports" value={stats?.byType?.inventory ?? 0}
          bg="bg-emerald-50" iconColor="text-emerald-500" sub={`${stats?.byType?.admin ?? 0} admin actions · ${stats?.byType?.staff ?? 0} staff registered`} />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Section title="Daily Activity" icon={TrendingUp} className="lg:col-span-2">
          {loadingStats || !stats ? (
            <div className="h-60 bg-gray-50 rounded-2xl animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="gNav" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.navy} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={C.navy} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
                <Tooltip content={<Tip />} />
                <Area type="monotone" dataKey="count" name="Actions" stroke={C.navy} fill="url(#gNav)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Section>

        <Section title="Activity by Type" icon={Layers}>
          {loadingStats || !stats ? (
            <div className="h-60 bg-gray-50 rounded-2xl animate-pulse" />
          ) : typeData.every(t => t.count === 0) ? (
            <p className="text-sm text-gray-400 py-10 text-center">No activity in range</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, typeData.length * 36)}>
              <BarChart data={typeData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} tickLine={false} axisLine={false} width={120} />
                <Tooltip content={<Tip />} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="count" name="Actions" radius={[0, 6, 6, 0]} barSize={14}>
                  {typeData.map((t, i) => <Cell key={i} fill={t.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Section title="Top People" icon={Users}>
          {loadingStats || !stats ? (
            <div className="h-56 bg-gray-50 rounded-2xl animate-pulse" />
          ) : userData.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">No activity yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(190, userData.length * 34)}>
              <BarChart data={userData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} tickLine={false} axisLine={false} width={130} />
                <Tooltip content={<Tip />} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="count" name="Actions" radius={[0, 6, 6, 0]} barSize={14}>
                  {userData.map((_, i) => <Cell key={i} fill={[C.blue, C.purple, C.indigo, C.teal, C.amber][i % 5]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        <Section title="Top Departments" icon={Building2}>
          {loadingStats || !stats ? (
            <div className="h-56 bg-gray-50 rounded-2xl animate-pulse" />
          ) : deptData.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">No activity yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(190, deptData.length * 34)}>
              <BarChart data={deptData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} tickLine={false} axisLine={false} width={110} />
                <Tooltip content={<Tip />} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="count" name="Actions" radius={[0, 6, 6, 0]} barSize={14}>
                  {deptData.map((_, i) => <Cell key={i} fill={[C.emerald, C.teal, C.indigo, C.blue, C.pink][i % 5]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>

      {/* Records table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">All Records</h3>
          <span className="text-xs font-semibold text-gray-400">{total} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/70 text-[10px] uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3 font-semibold">Date & Time</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Person</th>
                <th className="px-4 py-3 font-semibold">Department</th>
                <th className="px-4 py-3 font-semibold">Shift</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8"><div className="h-24 bg-gray-50 rounded-xl animate-pulse" /></td></tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <div className="mx-auto w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-2">
                      <Activity className="w-5 h-5 text-gray-300" />
                    </div>
                    <p className="text-sm font-semibold text-gray-500">No records found</p>
                    <p className="text-xs text-gray-400 mt-1">Try adjusting the filters or date range.</p>
                  </td>
                </tr>
              ) : records.map(r => {
                const meta = TYPE_META[r.type] || { label: r.type, icon: Activity, badge: 'bg-gray-50 text-gray-600 border-gray-200' };
                const Icon = meta.icon;
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-xs font-semibold text-gray-800">
                        <EthiopianDateDisplay date={r.timestamp} format="long" />
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        <EthiopianDateTimeDisplay date={r.timestamp} showTime format="short" size="xs" />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${meta.badge}`}>
                        <Icon className="w-3 h-3" />{meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{r.title}</div>
                      {r.detail && <div className="text-xs text-gray-500 mt-0.5 max-w-[320px] truncate">{r.detail}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-gray-600 whitespace-nowrap">{r.person}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{r.department || '—'}</td>
                    <td className="px-4 py-3">
                      {r.shift ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">{r.shift}</span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <span className="text-[10px] text-gray-400 font-medium">Page {Math.min(page, totalPages)} of {totalPages}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                ← Previous
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manual cleanup */}
      <Section title="Database Cleanup" icon={Trash2}
        action={<span className="text-[10px] font-semibold text-red-500 bg-red-50 px-2 py-1 rounded-full border border-red-100">Free storage</span>}>
        <p className="text-xs text-gray-500 mb-4">Permanently delete old activity records in a date range to free database memory.</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">Records Type</label>
            <select value={delType} onChange={e => setDelType(e.target.value as TypeKey)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium bg-gray-50 text-gray-700">
              <option value="all">All Types</option>
              {Object.entries(TYPE_META).filter(([k]) => k !== 'staff').map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">From</label>
            <EthiopianDatePicker value={delFrom} onChange={setDelFrom} />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 block">To</label>
            <EthiopianDatePicker value={delTo} onChange={setDelTo} />
          </div>
          <button onClick={previewDelete} disabled={previewing || (!delFrom && !delTo)}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-40">
            <Search className="w-4 h-4" />{previewing ? 'Previewing...' : 'Preview Count'}
          </button>
          <button onClick={() => { if (delPreview) setShowConfirm(true); }}
            disabled={!delPreview || deleting}
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 inline-flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
            <Trash2 className="w-4 h-4" />Delete Records
          </button>
        </div>

        <div className="mt-4 flex gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#003153]/5 text-[#003153] border border-[#003153]/10">
            <CalendarRange className="w-3 h-3" /> Range: {delFrom || 'beginning'} → {delTo || 'now'}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-gray-50 text-gray-500 border border-gray-200">
            <Activity className="w-3 h-3" /> Currently previewed: {delPreview?.total ?? '—'} record(s)
          </span>
        </div>

        {delPreview && (
          <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-xs font-bold text-gray-700 mb-2">Preview — this many record(s) will be permanently deleted:</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(TYPE_META).filter(([k]) => k !== 'staff').map(([k, m]) => (
                <span key={k} className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${m.badge}`}>
                  {m.label}: {delPreview.byType?.[k] || 0}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-red-500 font-medium mt-3 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> This action cannot be undone. Staff accounts are never deleted here.
            </p>
          </div>
        )}
      </Section>

      {/* Delete confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 bg-red-50 border-b border-red-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-red-700 flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Confirm Deletion
              </h3>
              <button onClick={() => setShowConfirm(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-white transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-700">
                Delete <strong className="text-red-600">{delPreview?.total ?? 0} record(s)</strong> from{' '}
                <strong>{delFrom || 'beginning'}</strong> to <strong>{delTo || 'now'}</strong>
                {delType !== 'all' ? ` (${TYPE_META[delType]?.label})` : ' (all types)'}?
              </p>
              <p className="text-xs text-red-500 font-medium mt-3 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 shrink-0" /> Permanent — deleted data cannot be recovered.
              </p>
              <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-200">
                <button onClick={() => setShowConfirm(false)} disabled={deleting}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors">
                  Cancel
                </button>
                <button onClick={executeDelete} disabled={deleting}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 inline-flex items-center gap-2 transition-colors disabled:opacity-40">
                  {deleting ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Deleting...</>
                  ) : (
                    <><Trash2 className="w-4 h-4" />Yes, Delete {delPreview?.total || ''}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
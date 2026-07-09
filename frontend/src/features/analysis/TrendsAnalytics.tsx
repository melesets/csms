// Advanced Trends Analytics - professional clinical data analysis with recharts
import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart as RePie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, Activity, Calendar, RefreshCw, Download, AlertCircle,
  ArrowUpRight, ArrowDownRight, Minus, Clock, Layers, Package,
  ChevronDown, ChevronRight, Stethoscope, Users, Bed, BarChart3
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { useAuth } from '../../hooks/useAuth';
import { gregorianToEthiopian, formatEthiopianDate } from '../../utils/ethiopianCalendar';

/* ─── Colors ──────────────────────────────────────────── */
const C = {
  green: '#10b981', greenLight: '#d1fae5',
  amber: '#f59e0b', amberLight: '#fef3c7',
  red: '#ef4444', redLight: '#fee2e2',
  indigo: '#6366f1', indigoLight: '#e0e7ff',
  blue: '#3b82f6', blueLight: '#dbeafe',
  purple: '#8b5cf6', purpleLight: '#ede9fe',
  pink: '#ec4899', pinkLight: '#fce7f3',
  teal: '#14b8a6', tealLight: '#ccfbf1',
  slate: '#94a3b8',
};
const PIE_COLORS = [C.green, C.amber, C.red, C.slate];

/* ─── Stat Card ───────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, trend, trendLabel, bg, iconColor, sub }: {
  icon: any; label: string; value: number | string;
  trend?: 'up' | 'down' | 'flat'; trendLabel?: string;
  bg: string; iconColor: string; sub?: string;
}) {
  const trendStyles = {
    up: 'text-red-600 bg-red-50',
    down: 'text-emerald-600 bg-emerald-50',
    flat: 'text-gray-400 bg-gray-50',
  };
  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-gray-100/80 transition-all duration-300 group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
          <p className="text-3xl font-extrabold text-gray-900 mt-1.5 tracking-tight">{value}</p>
          {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${bg} group-hover:scale-110 transition-transform`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full ${trendStyles[trend]}`}>
            <TrendIcon className="w-3 h-3" />
            {trendLabel}
          </span>
          <span className="text-[10px] text-gray-300">vs prev period</span>
        </div>
      )}
    </div>
  );
}

/* ─── Custom Tooltip ──────────────────────────────────── */
function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 text-white text-xs rounded-xl px-3 py-2 shadow-xl border border-gray-700">
      <p className="font-semibold mb-1 text-gray-300">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-gray-400">{p.name}:</span>
          <span className="font-bold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Section Card ────────────────────────────────────── */
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

/* ─── Main Component ──────────────────────────────────── */
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

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        setLoading(true); setError(null);
        let url = '/api/form-submissions';
        const dept = user?.role === 'admin' ? selectedDepartment : (user?.department || '');
        const params = new URLSearchParams();
        if (dept && dept !== 'All') params.set('department', dept);
        if (timeframe) params.set('timeframe', timeframe);
        const qs = params.toString(); if (qs) url += `?${qs}`;
        const [res, resR] = await Promise.all([fetch(url), fetch('/api/resources')]);
        if (res.ok) { const d = await res.json(); setRecords(Array.isArray(d) ? d : []); }
        else { setRecords([]); setError('Failed to load analytics data.'); }
        if (resR.ok) { const r = await resR.json(); setResources(Array.isArray(r) ? r : []); }
        else setResources([]);
      } catch { setRecords([]); setError('Network error.'); setResources([]); }
      finally { setLoading(false); }
    };
    fetchRecords();
  }, [user, selectedDepartment, timeframe, refreshTick]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    fetch('/api/departments').then(r => r.ok ? r.json() : []).then(l => setDepartments(['All', ...(Array.isArray(l) ? l : [])])).catch(() => setDepartments(['All']));
  }, [user]);

  const filteredRecords = useMemo(() => {
    if (user?.role === 'admin') {
      if (selectedDepartment && selectedDepartment !== 'All') return records.filter(r => (r.template_department || r.department) === selectedDepartment);
      return records;
    }
    return records.filter(r => (r.template_department || r.department) === user?.department);
  }, [records, user, selectedDepartment]);

  const analytics = useMemo(() => {
    const now = new Date();
    const days = timeframe === 'today' ? 0 : timeframe === 'week' ? 7 : timeframe === 'month' ? 30 : 90;
    const cutoff = timeframe === 'today' ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : new Date(now.getTime() - days * 86400000);
    const prevCutoff = new Date(cutoff.getTime() - days * 86400000);

    const cur = filteredRecords.filter(r => new Date(r.submitted_at || r.created_at) >= cutoff);
    const prev = filteredRecords.filter(r => { const d = new Date(r.submitted_at || r.created_at); return d >= prevCutoff && d < cutoff; });

    const norm = (v: unknown): 'stable' | 'unstable' | 'critical' => {
      const s = String(v ?? '').trim().toLowerCase();
      if (!s) return 'stable';
      if (/sub[-\s]?critical|\bamber\b|\byellow\b|\bcode\s*yellow\b|\bunstable\b/.test(s)) return 'unstable';
      if (/\bcritical\b|\bcode\s*red\b|\bred\b/.test(s)) return 'critical';
      if (/stabl|\bcode\s*green\b|\bgreen\b/.test(s)) return 'stable';
      const n = Number(s); if (!isNaN(n)) return n >= 3 ? 'critical' : n === 2 ? 'unstable' : 'stable';
      return 'stable';
    };

    const getStab = (fd: any): string => {
      if (!fd || typeof fd !== 'object') return '';
      for (const k of ['stability', 'Stability', 'patient_stability', 'Patient Stability', 'status', 'Status', 'triage']) {
        const v = fd?.[k]; if (v != null && String(v).trim()) return String(v);
      }
      for (const [, v] of Object.entries(fd)) {
        if (typeof v === 'string' && /\bcritical\b|\bunstable\b|\bcode\s*(red|yellow|green)\b/.test(v.toLowerCase())) return v;
      }
      return '';
    };

    const countByStab = (arr: any[]) => arr.reduce((a, r) => { const n = norm(getStab(r.form_data)); a[n] = (a[n] || 0) + 1; return a; }, {} as Record<string, number>);
    const curStab = countByStab(cur);
    const prevStab = countByStab(prev);

    let crit = 0, sub = 0, prevCrit = 0, prevSub = 0;
    cur.forEach(r => { const n = norm(getStab(r.form_data)); if (n === 'critical') crit++; else if (n === 'unstable') sub++; });
    prev.forEach(r => { const n = norm(getStab(r.form_data)); if (n === 'critical') prevCrit++; else if (n === 'unstable') prevSub++; });

    const deptTrends = user?.role === 'admin'
      ? cur.reduce((a, r) => { const d = r.template_department || 'Unknown'; a[d] = (a[d] || 0) + 1; return a; }, {} as Record<string, number>) : {};

    const tplTrends = cur.reduce((a, r) => { const t = r.template_name || 'Unknown'; a[t] = (a[t] || 0) + 1; return a; }, {} as Record<string, number>);

    // Daily stacked
    const byDate: Record<string, Record<string, number>> = {};
    cur.forEach(r => {
      const d = new Date(r.submitted_at || r.created_at); d.setHours(0, 0, 0, 0);
      const key = d.toISOString(); const n = norm(getStab(r.form_data));
      if (!byDate[key]) byDate[key] = { stable: 0, unstable: 0, critical: 0 };
      byDate[key][n]++;
    });
    const dailyData: any[] = [];
    const dDays = timeframe === 'today' ? 1 : days;
    for (let i = dDays - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      const eth = gregorianToEthiopian(d);
      const b = byDate[d.toISOString()] || { stable: 0, unstable: 0, critical: 0 };
      dailyData.push({ date: formatEthiopianDate(eth, 'short'), Stable: b.stable, Subcritical: b.unstable, Critical: b.critical, Total: b.stable + b.unstable + b.critical });
    }

    // Hourly
    const hourly = Array.from({ length: 24 }, (_, i) => ({ hour: `${String(i).padStart(2, '0')}:00`, count: 0 }));
    cur.forEach(r => { const h = new Date(r.submitted_at || r.created_at).getHours(); hourly[h].count++; });

    // Heatmap: day x hour
    const heatRaw: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    cur.forEach(r => { const d = new Date(r.submitted_at || r.created_at); heatRaw[d.getDay()][d.getHours()]++; });
    const heatMax = Math.max(...heatRaw.flat(), 1);

    // Resource metrics
    const scopedR = (() => {
      const dept = user?.role === 'admin' ? (selectedDepartment || '') : (user?.department || '');
      const arr = Array.isArray(resources) ? resources : [];
      if (dept && dept !== 'All') return arr.filter((r: any) => String(r.department || '').toLowerCase() === dept.toLowerCase());
      return arr;
    })();
    const isDrug = (r: any) => { const t = String(r?.type ?? r?.Type ?? r?.category ?? '').toLowerCase(); return t.includes('drug') || t.includes('med'); };
    const gQ = (r: any) => { const q = Number(r?.quantity ?? r?.qty); return isNaN(q) ? null : q; };
    const gS = (r: any) => { const s = Number(r?.standard_quantity ?? r?.standard); return isNaN(s) ? null : s; };
    const gE = (r: any) => { const d = new Date(r?.expiry_date); return isNaN(d.getTime()) ? null : d; };
    const expired = scopedR.reduce((a: number, r: any) => isDrug(r) && gQ(r) !== null && gQ(r)! > 0 && gE(r) && gE(r)! < now ? a + 1 : a, 0);
    const stockOut = scopedR.reduce((a: number, r: any) => { const q = gQ(r); const s = gS(r); return q !== null && (q <= 0 || (s !== null && q < 2 && s >= 2)) ? a + 1 : a; }, 0);
    const lowStock = scopedR.reduce((a: number, r: any) => { const q = gQ(r); const s = gS(r); return q !== null && s !== null && q > 0 && q < s ? a + 1 : a; }, 0);

    // Stability pie
    const stabilityPie = Object.entries(curStab).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));

    // Template bar
    const tplBar = Object.entries(tplTrends).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name: name.length > 18 ? name.slice(0, 18) + '…' : name, count }));

    // Dept bar
    const deptBar = Object.entries(deptTrends).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));

    // Hourly peak
    const peakHour = hourly.reduce((best, h) => h.count > best.count ? h : best, hourly[0]);

    const trendCalc = (c: number, p: number): { dir: 'up' | 'down' | 'flat'; label: string } => {
      if (p === 0) return { dir: c > 0 ? 'up' : 'flat', label: c > 0 ? '+100%' : '0%' };
      const pct = ((c - p) / p * 100).toFixed(0);
      if (c > p) return { dir: 'up', label: `+${pct}%` };
      if (c < p) return { dir: 'down', label: `${pct}%` };
      return { dir: 'flat', label: '0%' };
    };

    return {
      total: cur.length, prevTotal: prev.length,
      crit, sub, prevCrit, prevSub,
      curStab, stabilityPie,
      deptBar, tplBar,
      dailyData, hourly, heatRaw, heatMax,
      expired, stockOut, lowStock, totalResources: scopedR.length,
      peakHour: peakHour?.hour || '—',
      trend: trendCalc,
    };
  }, [filteredRecords, timeframe, user?.role, selectedDepartment, resources]);

  const handleRefresh = useCallback(() => setRefreshTick(p => p + 1), []);

  const handleExport = useCallback(async () => {
    const now = new Date();
    const days = timeframe === 'today' ? 0 : timeframe === 'week' ? 7 : timeframe === 'month' ? 30 : 90;
    const cutoff = timeframe === 'today' ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : new Date(now.getTime() - days * 86400000);
    const data = filteredRecords.filter(r => new Date(r.submitted_at || r.created_at) >= cutoff);
    if (!data.length) return;

    const GREEN = 'FF09B8A0';
    const GREEN_DARK = 'FF067D6A';
    const GRAY_BG = 'FFF9FAFB';
    const WHITE = 'FFFFFFFF';
    const headerStyle: Partial<ExcelJS.Style> = {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } },
      font: { bold: true, color: { argb: WHITE }, size: 10, name: 'Calibri' },
      alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { argb: GREEN_DARK } },
        bottom: { style: 'medium', color: { argb: GREEN_DARK } },
        left: { style: 'thin', color: { argb: GREEN_DARK } },
        right: { style: 'thin', color: { argb: GREEN_DARK } },
      },
    };
    const borderAll: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FFE5E7EB' } };
    const cellBorder = { top: borderAll, bottom: borderAll, left: borderAll, right: borderAll };

    const wb = new ExcelJS.Workbook();
    wb.creator = 'ISBAR-CSMS';
    wb.created = now;
    const tfLabel = timeframe === 'today' ? 'Today' : timeframe === 'week' ? 'Last 7 Days' : timeframe === 'month' ? 'Last 30 Days' : 'Last 90 Days';
    const dateLabel = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

    // ── Flat helper ──
    const flat = (o: any, p = ''): any =>
      Object.keys(o || {}).reduce((a, k) => {
        const v = o[k]; const kp = p ? `${p}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(a, flat(v, kp)); else a[kp] = v; return a;
      }, {});

    // ── Sheet 1: All Submissions ──
    const formDataKeysSet = new Set<string>();
    data.forEach(r => {
      if (r.form_data && typeof r.form_data === 'object') Object.keys(r.form_data).forEach(k => formDataKeysSet.add(k));
    });
    const formDataKeys = Array.from(formDataKeysSet);
    const metaCols = ['#', 'ID', 'Department', 'Template', 'Submitted By', 'Role', 'Date'];
    const allCols = [...metaCols, ...formDataKeys];

    const ws1 = wb.addWorksheet('Submissions', { views: [{ state: 'frozen', ySplit: 2 }], properties: { defaultColWidth: 14 } });
    const title1 = ws1.addRow([`Submissions — ${data.length} records · ${tfLabel} · ${dateLabel}`]);
    ws1.mergeCells(title1.number, 1, title1.number, allCols.length);
    title1.height = 32;
    title1.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1F2937' } };
    title1.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    title1.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } };

    const hdr1 = ws1.addRow(allCols);
    hdr1.height = 28;
    hdr1.eachCell(c => { Object.assign(c, headerStyle); c.border = cellBorder; });

    data.forEach((r: any, i) => {
      const fd = r.form_data && typeof r.form_data === 'object' ? r.form_data : {};
      const d = r.submitted_at ? new Date(r.submitted_at) : null;
      const dateStr = d && !isNaN(d.getTime())
        ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
          d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        : '';
      const row = [i + 1, r.id, r.template_department || '', r.template_name || '', r.submitted_by || r.staff_name || '', r.submitted_role || '', dateStr];
      formDataKeys.forEach(k => row.push(String(fd[k] ?? '')));
      const rowObj = ws1.addRow(row);
      rowObj.eachCell(c => { c.border = cellBorder; c.alignment = { vertical: 'middle', wrapText: true }; });
      if (i % 2 === 0) rowObj.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_BG } }; });
    });
    ws1.columns.forEach(c => { c.width = 14; });

    // ── Sheet 2: Stability Summary ──
    const norm = (v: unknown): string => {
      const s = String(v ?? '').trim().toLowerCase();
      if (!s) return 'Stable';
      if (/sub[-\s]?critical|\bamber\b|\byellow\b|\bcode\s*yellow\b|\bunstable\b/.test(s)) return 'Subcritical';
      if (/\bcritical\b|\bcode\s*red\b|\bred\b/.test(s)) return 'Critical';
      return 'Stable';
    };
    const getStab = (fd: any): string => {
      if (!fd || typeof fd !== 'object') return '';
      for (const k of ['stability', 'Stability', 'patient_stability', 'Patient Stability', 'status', 'Status', 'triage']) {
        const v = fd?.[k]; if (v != null && String(v).trim()) return String(v);
      }
      return '';
    };
    const stable = data.filter(r => norm(getStab(r.form_data)) === 'Stable');
    const sub = data.filter(r => norm(getStab(r.form_data)) === 'Subcritical');
    const crit = data.filter(r => norm(getStab(r.form_data)) === 'Critical');

    const ws2 = wb.addWorksheet('Stability Summary');
    const title2 = ws2.addRow(['Patient Stability Summary']);
    ws2.mergeCells(title2.number, 1, title2.number, 4);
    title2.height = 30;
    title2.getCell(1).font = { bold: true, size: 13, color: { argb: 'FF1F2937' } };
    title2.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } };

    const hdr2 = ws2.addRow(['Status', 'Count', 'Percentage', 'Avg Forms/Patient']);
    hdr2.height = 26;
    hdr2.eachCell(c => { Object.assign(c, headerStyle); c.border = cellBorder; });

    const stabRows = [
      ['Stable', stable.length, data.length ? `${(stable.length / data.length * 100).toFixed(1)}%` : '0%', stable.length ? (stable.reduce((a, r) => a + Object.keys(r.form_data || {}).length, 0) / stable.length).toFixed(1) : '0'],
      ['Subcritical', sub.length, data.length ? `${(sub.length / data.length * 100).toFixed(1)}%` : '0%', sub.length ? (sub.reduce((a, r) => a + Object.keys(r.form_data || {}).length, 0) / sub.length).toFixed(1) : '0'],
      ['Critical', crit.length, data.length ? `${(crit.length / data.length * 100).toFixed(1)}%` : '0%', crit.length ? (crit.reduce((a, r) => a + Object.keys(r.form_data || {}).length, 0) / crit.length).toFixed(1) : '0'],
      ['Total', data.length, '100%', data.length ? (data.reduce((a, r) => a + Object.keys(r.form_data || {}).length, 0) / data.length).toFixed(1) : '0'],
    ];
    stabRows.forEach((row, i) => {
      const r = ws2.addRow(row);
      r.eachCell(c => { c.border = cellBorder; c.alignment = { vertical: 'middle', horizontal: 'center' }; });
      if (i % 2 === 0) r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_BG } }; });
    });
    ws2.getColumn(1).width = 16; ws2.getColumn(2).width = 10; ws2.getColumn(3).width = 14; ws2.getColumn(4).width = 20;

    // ── Sheet 3: Resource Status ──
    const scopedR = (() => {
      const dept = user?.role === 'admin' ? (selectedDepartment || '') : (user?.department || '');
      const arr = Array.isArray(resources) ? resources : [];
      if (dept && dept !== 'All') return arr.filter((r: any) => String(r.department || '').toLowerCase() === dept.toLowerCase());
      return arr;
    })();
    const ws3 = wb.addWorksheet('Resources');
    const title3 = ws3.addRow([`Resource Status — ${scopedR.length} items · ${tfLabel}`]);
    ws3.mergeCells(title3.number, 1, title3.number, 8);
    title3.height = 30;
    title3.getCell(1).font = { bold: true, size: 13, color: { argb: 'FF1F2937' } };
    title3.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } };

    const hdr3 = ws3.addRow(['#', 'Name', 'Type', 'Department', 'Quantity', 'Standard', 'Expiry Date', 'Status']);
    hdr3.height = 26;
    hdr3.eachCell(c => { Object.assign(c, headerStyle); c.border = cellBorder; });

    const today = new Date();
    scopedR.forEach((r: any, i) => {
      const q = Number(r.quantity ?? r.qty); const s = Number(r.standard_quantity ?? r.standard);
      const exp = new Date(r.expiry_date); const expValid = !isNaN(exp.getTime());
      let status = 'OK';
      if (!isNaN(q) && q <= 0) status = 'Stock Out';
      else if (expValid && exp < today) status = 'Expired';
      else if (expValid && (exp.getTime() - today.getTime()) / 86400000 <= 30) status = 'Near Expiry';
      else if (!isNaN(q) && !isNaN(s) && s > 0 && q < s) status = 'Low Stock';
      const row = [i + 1, r.name || '', r.type || r.Type || '', r.department || '', isNaN(q) ? '' : q, isNaN(s) ? '' : s, expValid ? exp.toLocaleDateString('en-GB') : '', status];
      const rowObj = ws3.addRow(row);
      rowObj.eachCell(c => { c.border = cellBorder; c.alignment = { vertical: 'middle', wrapText: true }; });
      if (i % 2 === 0) rowObj.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_BG } }; });
    });
    ws3.columns.forEach((c, i) => { c.width = [4, 22, 16, 16, 12, 12, 14, 14][i] || 14; });

    // ── Sheet 4: Department Breakdown ──
    const deptMap: Record<string, { total: number; stable: number; sub: number; crit: number }> = {};
    data.forEach(r => {
      const dept = r.template_department || 'Unknown';
      if (!deptMap[dept]) deptMap[dept] = { total: 0, stable: 0, sub: 0, crit: 0 };
      deptMap[dept].total++;
      const n = norm(getStab(r.form_data));
      if (n === 'Stable') deptMap[dept].stable++; else if (n === 'Subcritical') deptMap[dept].sub++; else deptMap[dept].crit++;
    });
    const ws4 = wb.addWorksheet('Departments');
    const title4 = ws4.addRow(['Department Breakdown']);
    ws4.mergeCells(title4.number, 1, title4.number, 6);
    title4.height = 30;
    title4.getCell(1).font = { bold: true, size: 13, color: { argb: 'FF1F2937' } };
    title4.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } };

    const hdr4 = ws4.addRow(['Department', 'Total', 'Stable', 'Subcritical', 'Critical', 'Stability Rate']);
    hdr4.height = 26;
    hdr4.eachCell(c => { Object.assign(c, headerStyle); c.border = cellBorder; });

    Object.entries(deptMap).sort((a, b) => b[1].total - a[1].total).forEach(([dept, v], i) => {
      const rate = v.total ? `${(v.stable / v.total * 100).toFixed(1)}%` : '0%';
      const row = [dept, v.total, v.stable, v.sub, v.crit, rate];
      const rowObj = ws4.addRow(row);
      rowObj.eachCell(c => { c.border = cellBorder; c.alignment = { vertical: 'middle', horizontal: 'center' }; });
      if (i % 2 === 0) rowObj.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_BG } }; });
    });
    ws4.columns.forEach((c, i) => { c.width = [22, 10, 10, 14, 10, 16][i] || 14; });

    // ── Save ──
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `analytics_${timeframe}.xlsx`; a.click();
    URL.revokeObjectURL(url);
  }, [filteredRecords, timeframe, user?.role, selectedDepartment, resources]);

  if (loading) return (
    <div className="space-y-6">
      <div className="h-8 bg-gray-100 rounded w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-28 bg-gray-50 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="h-72 bg-gray-50 rounded-2xl" />
        <div className="h-72 bg-gray-50 rounded-2xl lg:col-span-2" />
      </div>
    </div>
  );

  const t = (c: number, p: number) => analytics.trend(c, p);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Analytics & Trends</h2>
          <p className="text-sm text-gray-400 mt-1">
            {user?.role === 'admin' ? (selectedDepartment === 'All' ? 'All departments' : selectedDepartment) : user?.department}
            {' · '}
            {timeframe === 'today' ? 'Today' : timeframe === 'week' ? 'Last 7 days' : timeframe === 'month' ? 'Last 30 days' : 'Last 90 days'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {user?.role === 'admin' && (
            <select value={selectedDepartment} onChange={e => setSelectedDepartment(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          <div className="flex bg-gray-100 rounded-xl p-0.5">
            {([['today', 'Today'], ['week', '7D'], ['month', '30D'], ['quarter', '90D']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setTimeframe(v)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${timeframe === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                {l}
              </button>
            ))}
          </div>
          <button onClick={handleRefresh} className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
          <button onClick={handleExport} disabled={analytics.total === 0}
            className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-600 disabled:opacity-40 inline-flex items-center gap-1.5 transition-colors">
            <Download className="w-4 h-4" />Export
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Layers} label="Total Submissions" value={analytics.total}
          {...(() => { const tr = t(analytics.total, analytics.prevTotal); return { trend: tr.dir, trendLabel: tr.label }; })()}
          bg="bg-indigo-50" iconColor="text-indigo-500" sub={`${analytics.totalResources} resources tracked`} />
        <StatCard icon={Activity} label="Critical Patients" value={analytics.crit}
          {...(() => { const tr = t(analytics.crit, analytics.prevCrit); return { trend: tr.dir, trendLabel: tr.label }; })()}
          bg="bg-red-50" iconColor="text-red-500" />
        <StatCard icon={AlertCircle} label="Subcritical" value={analytics.sub}
          {...(() => { const tr = t(analytics.sub, analytics.prevSub); return { trend: tr.dir, trendLabel: tr.label }; })()}
          bg="bg-amber-50" iconColor="text-amber-500" />
        <StatCard icon={Package} label="Expired Drugs" value={analytics.expired}
          bg="bg-orange-50" iconColor="text-orange-500" sub={`${analytics.stockOut} stock-out · ${analytics.lowStock} low`} />
      </div>

      {/* Stability Pie + Daily Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Section title="Patient Stability" icon={BarChart3}>
          <div className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={220}>
              <RePie>
                <Pie data={analytics.stabilityPie} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  innerRadius={55} outerRadius={85} paddingAngle={4} strokeWidth={0}>
                  {analytics.stabilityPie.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<Tip />} />
              </RePie>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2">
              {analytics.stabilityPie.map((s: any, i: number) => (
                <div key={s.name} className="flex items-center gap-1.5 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-gray-600">{s.name}</span>
                  <span className="font-bold text-gray-900">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Daily Trend" icon={TrendingUp} className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={analytics.dailyData}>
              <defs>
                <linearGradient id="gStable" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.green} stopOpacity={0.3} /><stop offset="100%" stopColor={C.green} stopOpacity={0} /></linearGradient>
                <linearGradient id="gSub" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.amber} stopOpacity={0.3} /><stop offset="100%" stopColor={C.amber} stopOpacity={0} /></linearGradient>
                <linearGradient id="gCrit" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.red} stopOpacity={0.3} /><stop offset="100%" stopColor={C.red} stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={30} />
              <Tooltip content={<Tip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Area type="monotone" dataKey="Stable" stroke={C.green} fill="url(#gStable)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="Subcritical" stroke={C.amber} fill="url(#gSub)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="Critical" stroke={C.red} fill="url(#gCrit)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Section>
      </div>

      {/* Template + Hourly */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Submissions by Template" icon={Stethoscope}>
          <ResponsiveContainer width="100%" height={Math.max(200, analytics.tplBar.length * 36)}>
            <BarChart data={analytics.tplBar} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} tickLine={false} axisLine={false} width={140} />
              <Tooltip content={<Tip />} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="count" fill={C.indigo} radius={[0, 6, 6, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </Section>

        <Section title="Hourly Distribution" icon={Clock}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={analytics.hourly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={2} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={30} />
              <Tooltip content={<Tip />} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="count" fill={C.indigo} radius={[4, 4, 0, 0]} barSize={14}>
                {analytics.hourly.map((_: any, i: number) => (
                  <Cell key={i} fill={i === parseInt(analytics.peakHour) ? C.red : C.indigo} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[11px] text-gray-400 text-center mt-2">Peak hour: <span className="font-bold text-gray-600">{analytics.peakHour}</span></p>
        </Section>
      </div>

      {/* Department (admin) + Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {user?.role === 'admin' && analytics.deptBar.length > 0 && (
          <Section title="Department Activity" icon={Users}>
            <ResponsiveContainer width="100%" height={Math.max(200, analytics.deptBar.length * 36)}>
              <BarChart data={analytics.deptBar} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} tickLine={false} axisLine={false} width={120} />
                <Tooltip content={<Tip />} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={20}>
                  {analytics.deptBar.map((_: any, i: number) => (
                    <Cell key={i} fill={[C.blue, C.purple, C.indigo, C.pink, C.teal, C.amber, '#06b6d4', '#f43f5e'][i % 8]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Section>
        )}

        <Section title="Weekly Activity Heatmap" icon={BarChart3}
          className={user?.role !== 'admin' ? 'lg:col-span-2' : ''}>
          <div className="overflow-x-auto">
            <div className="min-w-[500px]">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, di) => (
                <div key={day} className="flex items-center gap-1 mb-1">
                  <span className="text-[10px] text-gray-400 w-7 text-right shrink-0 font-medium">{day}</span>
                  <div className="flex gap-px flex-1">
                    {analytics.heatRaw[di].map((v, hi) => {
                      const t = v / analytics.heatMax;
                      const bg = t === 0 ? 'bg-gray-50' : t < 0.2 ? 'bg-emerald-100' : t < 0.4 ? 'bg-emerald-200' : t < 0.6 ? 'bg-emerald-400' : t < 0.8 ? 'bg-emerald-500' : 'bg-emerald-700';
                      return <div key={hi} className={`flex-1 h-4 rounded-sm ${bg} transition-colors cursor-default`} title={`${v} submissions`} />;
                    })}
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-1 mt-2">
                <span className="text-[10px] text-gray-400 w-7" />
                <div className="flex gap-0.5 flex-1 text-[8px] text-gray-400">
                  {Array.from({ length: 24 }, (_, i) => <span key={i} className="flex-1 text-center">{i % 3 === 0 ? `${i}h` : ''}</span>)}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-1.5 mt-3">
            <span className="text-[10px] text-gray-400">Less</span>
            {['bg-gray-50', 'bg-emerald-100', 'bg-emerald-200', 'bg-emerald-400', 'bg-emerald-500', 'bg-emerald-700'].map((c, i) => (
              <span key={i} className={`w-3 h-3 rounded-sm ${c}`} />
            ))}
            <span className="text-[10px] text-gray-400">More</span>
          </div>
        </Section>
      </div>
    </div>
  );
};

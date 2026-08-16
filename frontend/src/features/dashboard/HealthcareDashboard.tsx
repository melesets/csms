// Main dashboard - displays hospital overview with patients, staff, resources, and activity
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useShift } from '../../hooks/useShift';
import { useSearch } from '../../hooks/useSearch';
import { ExpandablePatientCard } from '../patients';
import { PatientDetailPage } from '../patients/PatientDetailPage';
import { IsbarLoader, DashboardSection } from '../../components/shared';
import { DepartmentStaffPanel } from '../staff';
import { EthiopianDateDisplay } from '../../components/shared/date/EthiopianDateDisplay';
import { EthiopianDateTimeDisplay } from '../../components/shared/date/EthiopianDateTimeDisplay';
import {
  gregorianToEthiopian,
  gregorianToEthiopianTime,
  formatEthiopianDate,
  formatEthiopianTime,
} from '../../utils/ethiopianCalendar';
import {
  Bed,
  Clock,
  Package,
  Activity,
  Plus,
  Minus,
  Check,
  ChevronDown,
  ChevronRight,
  X,
  Flag,
  AlertTriangle,
  MinusCircle,
  Shield,
  Tag,
  FileText,
  LayoutGrid,
  List,
  TableProperties,
  Stethoscope,
  Users,
  Brain
} from 'lucide-react';
import { DepartmentActivityTimeline, ShiftActivityPanel } from '../shifts';
import AIDashboard from '../ai/AIDashboard';
import { PROFESSIONS } from '../../types/auth';

// Helper functions moved outside of the component
const safeParseJSON = (s: string, fallback: unknown) => {
  try { return JSON.parse(s); }
  catch { return fallback; }
};

// getByKeySmart function moved inside the component

const parseDateSafe = (iso: string): Date => {
  if (!iso) return new Date(NaN);
  const s = String(iso).trim();
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    return new Date(s.replace(' ', 'T'));
  }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?/);
  if (m) {
    const [, y, mo, da, h, mi, se, frac] = m;
    const ms = frac ? Math.round(Number('0.' + frac) * 1000) : 0;
    return new Date(Number(y), Number(mo) - 1, Number(da), Number(h), Number(mi), Number(se || '0'), ms);
  }
  return new Date(s.replace(' ', 'T'));
};

const prettifyLabel = (key: string): string => {
  if (!key) return '';
  const spaced = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
  return spaced
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

/* ── Custom-tab record preview helpers ────────────────────────────────
 * Audit-style forms store every section header and timestamp as regular
 * fields, which makes raw previews look like a wall of repeated text.
 * These helpers filter that noise out and render Yes/No/NA answers as badges. */

const ETH_MONTHS_SRC = '(?:Meskerem|Tikimt|Hidar|Tahsas|Tir|Yekatit|Megabit|Miazia|Ginbot|Sene|Hamle|Nehase|Pagume)';
const ETH_DATE_RE = new RegExp(`^${ETH_MONTHS_SRC} \\d{1,2}, \\d{4}$`);
const ETH_DATETIME_RE = new RegExp(`^${ETH_MONTHS_SRC} \\d{1,2}, \\d{4} \\d{1,2}:\\d{2} (?:ማታ|ቀትር|Day|Night)$`);

// True when a value is an Ethiopian date/datetime string (e.g. "Nehase 8, 2018 3:51 ማታ")
const isEthiopianDateValue = (v: unknown): boolean => {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  return ETH_DATE_RE.test(s) || ETH_DATETIME_RE.test(s);
};

// Section headers ("ADARE GENERAL HOSPITAL ... AUDIT TOOL") are long labels without a question mark.
// Only values under such keys are treated as section timestamps — real date fields ("Date of Birth",
// "Assessment Date") keep their values visible.
const isHeadingLikeKey = (k: string): boolean => k.trim().length > 25 && !k.includes('?');

// Format any stored value for display: strings, numbers, booleans, arrays, and coded objects.
const formatValue = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.map(formatValue).filter(Boolean).join(', ');
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    // Coded concept value e.g. { display: 'Cough', code: 'MA01.0', system: 'ICD-11' }
    if (o.display !== undefined) {
      return o.code !== undefined ? `${String(o.display)} (${String(o.code)})` : String(o.display);
    }
    const parts = Object.entries(o)
      .filter(([, val]) => val !== null && val !== undefined && val !== '')
      .map(([k, val]) => `${prettifyLabel(k)}: ${formatValue(val)}`);
    return parts.join(' · ');
  }
  return String(v);
};

const SKIP_INTERNAL_KEYS = new Set(['id', 'patientid', 'patient_id', 'created_at', 'updated_at', '__typename']);
const EMPTY_ANSWER_VALUES = new Set(['', 'null', 'undefined', '-', '[]']);

// Filter form_data into clean display entries, extracting section-header timestamps separately.
// showAllFields: ignore the extraFields whitelist so form updates (added indicators) appear automatically.
const cleanFormEntries = (
  fd: Record<string, unknown>,
  opts: { extraFields?: string[]; exclude?: (string | undefined)[]; showAllFields?: boolean } = {}
) => {
  const entries: [string, unknown][] = [];
  const timestamps: string[] = [];
  const excluded = new Set((opts.exclude || []).filter(Boolean));
  for (const [k, v] of Object.entries(fd || {})) {
    if (SKIP_INTERNAL_KEYS.has(k.toLowerCase())) continue;
    if (excluded.has(k)) continue;
    if (!opts.showAllFields && opts.extraFields && opts.extraFields.length > 0 && !opts.extraFields.includes(k)) continue;
    if (v === null || v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (isHeadingLikeKey(k) && isEthiopianDateValue(v)) { timestamps.push(v); continue; }
    const s = typeof v === 'string' ? v.trim() : formatValue(v);
    if (!s || EMPTY_ANSWER_VALUES.has(s.toLowerCase())) continue;
    if (s.toLowerCase() === k.toLowerCase()) continue; // placeholder echo of the label
    entries.push([k, v]);
  }
  return { entries, timestamps };
};

const getAnswerTone = (value: unknown): 'yes' | 'no' | 'na' | 'text' => {
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  const s = String(value ?? '').trim().toLowerCase();
  if (['yes', 'true'].includes(s)) return 'yes';
  if (['no', 'false'].includes(s)) return 'no';
  if (['na', 'n/a', 'not applicable'].includes(s)) return 'na';
  return 'text';
};

// Colored pill for Yes/No/NA answers (falls back to plain text)
const AnswerBadge: React.FC<{ value: unknown }> = ({ value }) => {
  const tone = getAnswerTone(value);
  if (tone === 'yes') {
    return <span className="shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">Yes</span>;
  }
  if (tone === 'no') {
    return <span className="shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 text-[10px] font-bold">No</span>;
  }
  if (tone === 'na') {
    return <span className="shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 text-[10px] font-bold">N/A</span>;
  }
  const text = formatValue(value);
  if (text.length > 60) {
    return <span className="max-w-[55%] text-right text-xs font-medium text-gray-700 leading-snug">{text}</span>;
  }
  return <span className="shrink-0 max-w-[45%] text-right text-xs font-medium text-gray-700 truncate" title={text}>{text}</span>;
};

// Circular icon indicator for checklist-style answer rows
const AnswerIcon: React.FC<{ value: unknown }> = ({ value }) => {
  const tone = getAnswerTone(value);
  if (tone === 'yes') {
    return <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5"><Check className="w-3 h-3 text-emerald-600" strokeWidth={3} /></span>;
  }
  if (tone === 'no') {
    return <span className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5"><X className="w-3 h-3 text-red-500" strokeWidth={3} /></span>;
  }
  if (tone === 'na') {
    return <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5"><Minus className="w-3 h-3 text-gray-400" strokeWidth={3} /></span>;
  }
  return <span className="w-5 h-5 rounded-full bg-[#003153]/5 border border-[#003153]/10 flex items-center justify-center shrink-0 mt-0.5"><FileText className="w-2.5 h-2.5 text-[#003153]/50" /></span>;
};

// Animated circular compliance score
const ScoreRing: React.FC<{ pct: number }> = ({ pct }) => {
  const r = 20;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative w-12 h-12 shrink-0">
      <svg viewBox="0 0 48 48" className="w-12 h-12 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#e5e7eb" strokeWidth="5" />
        <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} className="transition-all duration-700 ease-out" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-extrabold text-gray-900">{pct}%</span>
    </div>
  );
};

// Compute Yes/No/NA audit stats for a record — shared by every view style.
// Returns pct = null when the record has no Yes/No/NA answers (so no score UI shows).
const getAuditStats = (fd: Record<string, unknown>, excludeKeys: (string | undefined)[]) => {
  const { entries } = cleanFormEntries(fd, { exclude: excludeKeys });
  const tones = entries.map(([, v]) => getAnswerTone(v));
  const yesCount = tones.filter(t => t === 'yes').length;
  const noCount = tones.filter(t => t === 'no').length;
  const naCount = tones.filter(t => t === 'na').length;
  const answeredTotal = yesCount + noCount + naCount;
  const pct = answeredTotal ? Math.round((yesCount / answeredTotal) * 100) : null;
  return { entries, yesCount, noCount, naCount, answeredTotal, pct };
};

// Small colored score pill for table/list/card views (hidden when no Yes/No/NA answers)
const ScorePill: React.FC<{ pct: number | null }> = ({ pct }) => {
  if (pct === null) return null;
  const cls = pct >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : pct >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-red-50 text-red-600 border-red-200';
  return (
    <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold ${cls}`} title="Compliance score">
      {pct}%
    </span>
  );
};

// Full-width modern record card used by the stack view
const StackRecordCard: React.FC<{
  sub: Record<string, unknown>;
  primary: string;
  secondary: string;
  status: string;
  identifier: string;
  nurse: string;
  extraFields: string[];
  excludeKeys: (string | undefined)[];
  fmtTimestamp: (sub: Record<string, unknown>) => string;
  chipLabels?: { secondary?: string; identifier?: string; nurse?: string };
}> = ({ sub, primary, secondary, status, identifier, nurse, extraFields, excludeKeys, fmtTimestamp, chipLabels }) => {
  const fd = (sub.form_data as Record<string, unknown>) || {};
  const [expanded, setExpanded] = useState(false);
  // showAllFields: new indicators added to the template after this tab was configured still appear
  const { entries, timestamps } = cleanFormEntries(fd, { extraFields, exclude: excludeKeys, showAllFields: true });
  const recordedAt = timestamps[timestamps.length - 1] || null;
  const isAudit = entries.some(([, v]) => getAnswerTone(v) !== 'text');

  const tones = entries.map(([, v]) => getAnswerTone(v));
  const yesCount = tones.filter(t => t === 'yes').length;
  const noCount = tones.filter(t => t === 'no').length;
  const naCount = tones.filter(t => t === 'na').length;
  const answeredTotal = yesCount + noCount + naCount;
  const pct = answeredTotal ? Math.round((yesCount / answeredTotal) * 100) : 0;

  const headerChips = [
    ...(secondary ? [{ label: chipLabels?.secondary || 'Department', value: secondary }] : []),
    ...(identifier ? [{ label: chipLabels?.identifier || 'Identifier', value: identifier }] : []),
    ...(nurse ? [{ label: chipLabels?.nurse || 'Nurse', value: nurse }] : []),
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md hover:border-gray-300 transition-all">
      {/* Header — light frosted navy */}
      <div className="px-5 py-4 bg-gradient-to-br from-[#003153]/[0.07] via-[#0a4a7a]/[0.04] to-[#0d6aa8]/[0.07] border-b border-[#003153]/10 relative">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,49,83,0.7) 1px, transparent 0)', backgroundSize: '18px 18px' }}
        />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-[#003153] flex items-center justify-center shrink-0 shadow-sm">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-gray-900 font-semibold text-[15px] leading-snug truncate">{primary}</p>
              <p className="text-gray-500 text-[11px] mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-gray-400" /> {fmtTimestamp(sub)}
              </p>
            </div>
          </div>
          {status && (
            <span className="shrink-0 px-3 py-1 rounded-full bg-[#003153]/10 border border-[#003153]/15 text-[#003153] text-[10px] font-bold tracking-wide uppercase">
              {status}
            </span>
          )}
        </div>
      </div>

      {/* Score summary — always visible */}
      {answeredTotal > 0 && (
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gradient-to-r from-white via-gray-50/50 to-white">
          <div className="flex items-center gap-4">
            <ScoreRing pct={pct} />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1.5">Compliance Score</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold">
                  <Check className="w-3 h-3" strokeWidth={3} /> {yesCount} Yes
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100 text-[10px] font-bold">
                  <X className="w-3 h-3" strokeWidth={3} /> {noCount} No
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 text-[10px] font-bold">
                  <Minus className="w-3 h-3" strokeWidth={3} /> {naCount} N/A
                </span>
              </div>
            </div>
          </div>
          <div className="mt-3 h-1.5 rounded-full overflow-hidden flex bg-gray-100">
            {answeredTotal > 0 && (
              <>
                <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${(yesCount / answeredTotal) * 100}%` }} />
                <div className="h-full bg-red-400 transition-all duration-700" style={{ width: `${(noCount / answeredTotal) * 100}%` }} />
                <div className="h-full bg-gray-300 transition-all duration-700" style={{ width: `${(naCount / answeredTotal) * 100}%` }} />
              </>
            )}
          </div>
        </div>
      )}

      {/* Meta chips */}
      {(headerChips.length > 0 || recordedAt) && (
        <div className="px-5 py-2.5 bg-gray-50/70 border-b border-gray-100 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {headerChips.map((chip, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-[11px]">
              <span className="text-gray-400 font-medium">{chip.label}:</span>
              <span className="font-semibold text-[#003153]">{chip.value}</span>
            </span>
          ))}
          {recordedAt && (
            <span className="inline-flex items-center gap-1.5 text-[11px]">
              <span className="text-gray-400 font-medium">Recorded:</span>
              <span className="font-semibold text-gray-700">{recordedAt}</span>
            </span>
          )}
        </div>
      )}

      {/* Answers — collapsible checklist */}
      {expanded ? (
        <div className="px-4 py-3">
          {entries.length > 0 ? (
            <div>
              {entries.map(([k, v]) => (
                <div key={k} className="flex items-start gap-3 py-2 px-2 -mx-1 rounded-lg hover:bg-gray-50/80 transition-colors">
                  <AnswerIcon value={v} />
                  <span className="flex-1 text-xs text-gray-700 leading-snug min-w-0" title={prettifyLabel(k)}>{prettifyLabel(k)}</span>
                  <AnswerBadge value={v} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic text-center py-3">No data recorded</p>
          )}
          <button
            onClick={() => setExpanded(false)}
            className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-gray-100 text-[11px] font-semibold text-gray-500 hover:bg-gray-50 hover:text-[#003153] transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5 rotate-180 transition-transform duration-200" />
            Show less
          </button>
        </div>
      ) : (
        <div className="px-4 py-3">
          <button
            onClick={() => setExpanded(true)}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-dashed border-gray-200 text-[11px] font-semibold text-gray-500 hover:bg-gray-50 hover:text-[#003153] hover:border-[#003153]/30 transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200" />
            {isAudit
              ? `View ${entries.length} answer${entries.length !== 1 ? 's' : ''}`
              : `View ${entries.length} detail${entries.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  );
};

// Horizontal list row that expands to reveal the full record checklist
const ListRecordRow: React.FC<{
  sub: Record<string, unknown>;
  primary: string;
  secondary: string;
  status: string;
  identifier: string;
  excludeKeys: (string | undefined)[];
  fmtTimestamp: (sub: Record<string, unknown>) => string;
}> = ({ sub, primary, secondary, status, identifier, excludeKeys, fmtTimestamp }) => {
  const fd = (sub.form_data as Record<string, unknown>) || {};
  const [expanded, setExpanded] = useState(false);
  const { entries } = cleanFormEntries(fd, { exclude: excludeKeys, showAllFields: true });
  const { pct } = getAuditStats(fd, excludeKeys);
  const isAudit = entries.some(([, v]) => getAnswerTone(v) !== 'text');

  return (
    <div className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all overflow-hidden">
      <div className="flex items-center gap-3 p-3.5 hover:bg-gray-50/70 transition-colors cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#003153] to-[#0d6aa8] flex items-center justify-center shrink-0 shadow-sm">
          <FileText className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 text-sm truncate">{primary}</span>
            {status && <AnswerBadge value={status} />}
            {identifier && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600 shrink-0">{identifier}</span>}
          </div>
          {secondary && <p className="text-xs text-gray-500 truncate mt-0.5">{secondary}</p>}
        </div>
        <ScorePill pct={pct} />
        <span className="text-[10px] text-gray-400 whitespace-nowrap shrink-0 hidden sm:inline">{fmtTimestamp(sub)}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/40">
          <div className="px-4 py-3">
            {entries.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                {entries.map(([k, v]) => (
                  <div key={k} className="flex items-start gap-3 py-1.5">
                    <AnswerIcon value={v} />
                    <span className="flex-1 text-xs text-gray-700 leading-snug min-w-0" title={prettifyLabel(k)}>{prettifyLabel(k)}</span>
                    <AnswerBadge value={v} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic text-center py-2">No data recorded</p>
            )}
          </div>
          <button
            onClick={() => setExpanded(false)}
            className="w-full flex items-center justify-center gap-1.5 py-2 border-t border-gray-100 text-[11px] font-semibold text-gray-500 hover:bg-gray-50 hover:text-[#003153] transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5 rotate-180 transition-transform duration-200" />
            {isAudit ? 'Hide answers' : 'Hide details'}
          </button>
        </div>
      )}
    </div>
  );
};


interface PatientHandover {
  id: string;
  patientName: string;
  mrn: string;
  bedNumber: string;
  department: string;
  stability: 'stable' | 'unstable' | 'critical';
  lastHandover: string;
  assignedNurse: string;
  assignedPhysician?: string;
  assignedMidwife?: string;
  diagnosis: string;
  age: number;
  gender: 'M' | 'F';
  shift: 'Morning' | 'Evening' | 'Night' | null;
  formData?: Record<string, unknown>;
  fieldLabels?: Record<string, string>;
  highlights?: { label: string; value: unknown }[];
}

interface ResourceStatus {
  category: string;
  totalItems: number;
  lowStock: number;
  lastUpdated: string;
  shift: 'day' | 'night';
}

interface DashboardMapping {
  id?: string | number;
  formTemplateId?: number | string;
  formTemplateName?: string;
  department: string;
  departments?: string[];
  dashboardType?: 'patient' | 'resource';
  displayName?: string;
  identifier?: string;
  profession?: string;
  cardFields?: {
    primary?: string;
    secondary?: string;
    status?: string;
    identifier?: string;
    nurse?: string;
    extraFields?: string[];
    statusValueMap?: Record<string, string>;
  };
  groupByField?: string;
  isEnabled?: boolean;
  sortOrder?: number;
  currentTemplateName?: string;
  templateIsActive?: boolean;
  fields?: unknown[];
  sections?: unknown[];
  __labelMap?: Record<string, string>;
}

interface User {
  id: string | number;
  name?: string;
  username: string;
  department?: string;
  role?: string;
  profession?: 'General Practitioner' | 'Senior Physician' | 'Midwifery' | 'Nurse' | 'Admin' | 'Laboratory' | 'Pharmacy' | 'Radiology' | 'Other Coordinators' | string;
}

interface Report {
  id: string | number;
  staffName: string;
  date: string;
  resources: unknown[];
  co_signers?: string[];
}

interface Round {
  id: string | number;
  staffName: string;
  date: string;
  title: string;
  agenda: { label: string; value: string }[];
}

interface Resource {
  [key: string]: unknown;
}

interface HandoverBriefing {
  patientStatus: 'Stable' | 'Watch' | 'Critical';
  changesDuringShift: string;
  lastAction: string;
  pendingTask: string;
  pendingTaskTime: string;
  riskWarning: string;
  nightSafetyNote?: string;
  created_at: string;
  predecessor_name?: string;
  handover_data?: Record<string, unknown>;
}

export const HealthcareDashboard: React.FC<{ onNavigate?: (page: string) => void }> = ({ onNavigate }) => {
  const normalizeShift = (s: unknown): 'Morning' | 'Evening' | 'Night' | null => {
    const v = String(s || '').trim().toLowerCase();
    if (!v) return null;
    if (v === 'morning' || v === 'am' || v === 'day' || v === 'm') return 'Morning';
    if (v === 'evening' || v === 'pm' || v === 'e') return 'Evening';
    if (v === 'night' || v === 'n') return 'Night';
    if (v.includes('morning') || v.includes('am')) return 'Morning';
    if (v.includes('evening') || v.includes('pm')) return 'Evening';
    if (v.includes('night')) return 'Night';
    if (v.startsWith('m')) return 'Morning';
    if (v.startsWith('e')) return 'Evening';
    if (v.startsWith('n')) return 'Night';
    return null;
  };

  const { user, getUserDepartmentFilter, impersonate } = useAuth();
  const { shift, setShift, shiftContext } = useShift();
  const { query } = useSearch();
  const [patients, setPatients] = useState<PatientHandover[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientHandover | null>(null);
  const [resourceStatus, setResourceStatus] = useState<ResourceStatus[]>([]);
  const [roundsByShift, setRoundsByShift] = useState<{ Morning: Round[]; Evening: Round[]; Night: Round[] }>({ Morning: [], Evening: [], Night: [] });
  const [roundMappedTemplates, setRoundMappedTemplates] = useState<string[]>([]);
  const [reportsByShift, setReportsByShift] = useState<{ Morning: Report[]; Evening: Report[]; Night: Report[] }>({ Morning: [], Evening: [], Night: [] });
  const [expandedResourceShift, setExpandedResourceShift] = useState<'Morning' | 'Evening' | 'Night' | null>(null);
  const [expandedRoundShift, setExpandedRoundShift] = useState<'Morning' | 'Evening' | 'Night' | null>(null);
  const [recentHandovers, setRecentHandovers] = useState<Record<string, unknown>[]>([]);
  const [handoverBriefing, setHandoverBriefing] = useState<HandoverBriefing | null>(null);
  const { activeSession } = useShift();
  const [expandAll, setExpandAll] = useState(false);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [mostRecentShift, setMostRecentShift] = useState<'Morning' | 'Evening' | 'Night' | null>(null);
  const [mostRecentRoundShift, setMostRecentRoundShift] = useState<'Morning' | 'Evening' | 'Night' | null>(null);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [impersonateUserId, setImpersonateUserId] = useState<string>('');
  const [impersonateRoleFilter, setImpersonateRoleFilter] = useState<string>('');
  const [impersonateProfFilter, setImpersonateProfFilter] = useState<string>('');
  const [patientMappings, setPatientMappings] = useState<DashboardMapping[]>([]);
  const [resourceMappings, setResourceMappings] = useState<DashboardMapping[]>([]);
  const [dynamicSections, setDynamicSections] = useState<Record<string, { mappings: DashboardMapping[]; submissions: Record<string, unknown>[] }>>({});
  const [allFormSubmissions, setAllFormSubmissions] = useState<Record<string, unknown>[]>([]);
  const [activeTab, setActiveTab] = useState('patients');
  const [filterDept, setFilterDept] = useState<string>('');
  const [filterUser, setFilterUser] = useState<string>('');
  const [timeWindow, setTimeWindow] = useState<'8' | '16' | '24'>('24');
  const [patientPage, setPatientPage] = useState(1);
  const PATIENTS_PER_PAGE = 24;

  // Reset patient page when filters change
  useEffect(() => { setPatientPage(1); }, [filterDept, filterUser, timeWindow, query]);

  // Custom tabs for admin
  interface CustomTab {
    id: string;
    name: string;
    displayName: string;
    templateId: string;
    templateName: string;
    department: string;
    departments: string[];
    profession: string;
    professions?: string[];
    dashboardType: 'patient' | 'resource';
    groupByField: string;
    viewStyle: 'card' | 'table' | 'list' | 'stack';
    retention: 'forever' | '24h' | '12h' | '8h';
    cardFields: {
      primary: string;
      secondary: string;
      status: string;
      identifier: string;
      nurse?: string;
      extraFields?: string[];
    };
  }
  const [customTabs, setCustomTabs] = useState<CustomTab[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/custom-tabs');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const sanitized = (Array.isArray(data) ? data : []).map((t: any) => ({
          ...t,
          id: String(t.id),
          templateId: t.templateId != null ? String(t.templateId) : '',
          viewStyle: ['card', 'table', 'list', 'stack'].includes(t.viewStyle) ? t.viewStyle : 'card',
        }));
        setCustomTabs(sanitized);
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const getByKeySmart = (data: Record<string, unknown>, key?: string, labelMap?: Record<string, string>) => {
    if (!data || !key) return undefined;
    if (data[key] !== undefined) return data[key];
    const lowerKey = String(key).toLowerCase();

    // Check if key exists with different case
    const actualKey = Object.keys(data).find(k => k.toLowerCase() === lowerKey);
    if (actualKey) return data[actualKey];

    // Check label map if provided
    if (labelMap) {
      const mappedKey = Object.entries(labelMap).find(([_, v]) => v === key)?.[0];
      if (mappedKey) return data[mappedKey];
    }

    return undefined;
  };

  const processPatientHandovers = useCallback((submissions: Record<string, unknown>[], effectiveMappings: DashboardMapping[]): PatientHandover[] => {
    const normalizeStability = (val: unknown): 'stable' | 'unstable' | 'critical' => {
      const s = String(val || '').trim().toLowerCase();
      if (!s) return 'stable';
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

    // removed unused extract*Name helpers to satisfy lints

    const findMappedFieldKey = (labelMap: Record<string, string> | undefined, candidates: string[]) => {
      if (!labelMap) return undefined;
      const entries = Object.entries(labelMap || {});
      for (const [k, lbl] of entries) {
        const norm = String(lbl || '').toLowerCase();
        for (const c of candidates) {
          if (norm.includes(c.toLowerCase())) return k;
        }
      }
      return undefined;
    };

    const latestByMRN = new Map<string, Record<string, unknown>>();

    (submissions || []).slice().sort((a: Record<string, unknown>, b: Record<string, unknown>) => parseDateSafe(b.submitted_at as string).getTime() - parseDateSafe(a.submitted_at as string).getTime())
      .forEach((sub: Record<string, unknown>) => {
        const fd = (sub.form_data as Record<string, unknown>) || {};
        const mapping = (effectiveMappings || []).find((m: DashboardMapping) => {
          const idMatch = m.formTemplateId != null && sub.template_id != null && String(m.formTemplateId) === String(sub.template_id);
          const nameMatch = (m.formTemplateName) && sub.template_name && String(m.formTemplateName).toLowerCase() === String(sub.template_name).toLowerCase();
          return idMatch || nameMatch;
        });

        // Determine MRN for this submission — use mapping if available, otherwise raw form data
        const labelMap = (mapping as DashboardMapping)?.__labelMap || {};
        const mrn = mapping
          ? String(getByKeySmart(fd, (mapping as DashboardMapping)?.cardFields?.secondary, labelMap) || fd.mrn || fd.MRN || fd['MRN'] || 'N/A')
          : String(fd.mrn || fd.MRN || fd['MRN'] || fd.patient_mrn || fd.patientMrn || 'N/A');

        // Since submissions are sorted latest-first, the first one we find for an MRN is the winner
        if (!latestByMRN.has(mrn) || mrn === 'N/A') {
          // Store both the submission and its mapping for card generation
          latestByMRN.set(mrn === 'N/A' ? `NA-${Math.random()}` : mrn, { sub, mapping: mapping || null });
        }
      });

    const cards: PatientHandover[] = [];

    latestByMRN.forEach(({ sub, mapping }: any) => {
      const fd = (sub.form_data as Record<string, unknown>) || {};
      const labelMap = (mapping as DashboardMapping)?.__labelMap || {};

      const name = getByKeySmart(fd, (mapping as DashboardMapping)?.cardFields?.primary, labelMap) || fd.patientName || fd['Patient name'] || fd.patient_name || (sub.patientName || 'Unknown Patient');
      const mrn = getByKeySmart(fd, (mapping as DashboardMapping)?.cardFields?.secondary, labelMap) || fd.mrn || fd.MRN || fd['MRN'] || 'N/A';
      const bed = getByKeySmart(fd, (mapping as DashboardMapping)?.cardFields?.identifier, labelMap) || fd.bedNumber || fd['Bed Number'] || fd.bed_number || 'N/A';
      const stabilityRaw = getByKeySmart(fd, (mapping as DashboardMapping)?.cardFields?.status, labelMap) || fd.stability || fd['Patient Stability'] || 'stable';
      const stabilityResolved = normalizeStability(stabilityRaw);

      const shiftFromData = getByKeySmart(fd, 'shift');
      let shiftName = normalizeShift(shiftFromData);

      if (!shiftName) {
        const bd = sub.submitted_at as string;
        if (bd) {
          const d = parseDateSafe(bd);
          const h = d.getHours();
          if (!isNaN(h)) {
            if (h >= 6 && h < 14) shiftName = 'Morning';
            else if (h >= 14 && h < 22) shiftName = 'Evening';
            else shiftName = 'Night';
          }
        }
      }

      const card: PatientHandover = {
        id: String(sub.id || `${sub.template_id ?? sub.template_name}-${Math.random().toString(36).slice(2, 8)}`),
        patientName: String(name),
        mrn: String(mrn),
        bedNumber: String(bed),
        department: (sub.template_department || user?.department || 'General') as string,
        stability: stabilityResolved,
        shift: shiftName,
        lastHandover: sub.submitted_at as string,
        assignedNurse: (() => {
          const mapped = findMappedFieldKey(labelMap, ['nurse', 'name of nurse']);
          if (mapped) return String(getByKeySmart(fd, mapped, labelMap) || sub.submitted_by_name || sub.submitted_by || 'Unknown');
          return String(sub.submitted_by_name || sub.submitted_by || 'Unknown');
        })(),
        assignedPhysician: (() => {
          const mapped = findMappedFieldKey(labelMap, ['physician', 'doctor']);
          if (mapped) return String(getByKeySmart(fd, mapped, labelMap) || '');
          return undefined;
        })(),
        assignedMidwife: (() => {
          const mapped = findMappedFieldKey(labelMap, ['midwife']);
          if (mapped) return String(getByKeySmart(fd, mapped, labelMap) || '');
          return undefined;
        })(),
        diagnosis: (fd.diagnosis || fd.background || fd.situation || 'Not specified') as string,
        age: (fd.age || 0) as number,
        gender: (fd.gender || fd.sex || 'N/A') as 'M' | 'F',
        formData: fd,
        fieldLabels: labelMap || {},
        highlights: []
      };

      cards.push(card);
    });

    return cards;
  }, [user]);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const departmentFilter = getUserDepartmentFilter();
      const prof = user?.profession ? `?profession=${encodeURIComponent(user.profession)}` : '';
      const deptParam = departmentFilter ? `?department=${encodeURIComponent(departmentFilter)}` : '';

      // Fire ALL independent requests in parallel
      const [briefingRes, patientRes, resourceRes, subsRes, resRes, reportsRes] = await Promise.all([
        activeSession && user
          ? fetch(`/api/shifts/handover/${encodeURIComponent(activeSession.ward)}/${encodeURIComponent(user.profession || user.role)}`).catch(() => null)
          : Promise.resolve(null),
        departmentFilter
          ? fetch(`/api/dashboard-mappings/by-department/${encodeURIComponent(departmentFilter)}/patient${prof}`).catch(() => null)
          : Promise.resolve(null),
        departmentFilter
          ? fetch(`/api/dashboard-mappings/by-department/${encodeURIComponent(departmentFilter)}/resource${prof}`).catch(() => null)
          : Promise.resolve(null),
        fetch(`/api/form-submissions?limit=2000${departmentFilter ? `&department=${encodeURIComponent(departmentFilter)}` : ''}${user?.role !== 'admin' && user?.role !== 'superadmin' && user?.id ? `&parentUserId=${user.id}` : ''}`),
        fetch(`/api/resources${departmentFilter ? `?department=${encodeURIComponent(departmentFilter)}` : ''}`),
        fetch(`/api/inventory-reports${departmentFilter ? `?department=${encodeURIComponent(departmentFilter)}` : ''}`),
      ]);

      // Process briefing
      if (briefingRes && briefingRes.ok) {
        const data = await briefingRes.json();
        setHandoverBriefing(data?.handover_data ? { ...data.handover_data, created_at: data.created_at, predecessor_name: data.from_username } : null);
      } else {
        setHandoverBriefing(null);
      }

      let patientRaw: DashboardMapping[] = [];
      let resourceRaw: DashboardMapping[] = [];
      if (departmentFilter) {
        patientRaw = patientRes && patientRes.ok ? await patientRes.json() : [];
        resourceRaw = resourceRes && resourceRes.ok ? await resourceRes.json() : [];
      } else {
        const res = await fetch('/api/dashboard-mappings');
        const all = res.ok ? await res.json() : [];
        const isEnabled = (m: DashboardMapping) => m.isEnabled !== false;
        const isActiveTemplate = (m: DashboardMapping) => m.templateIsActive !== false;
        patientRaw = (all || []).filter((m: DashboardMapping) => {
          const type = m.dashboardType;
          return type === 'patient' && isEnabled(m) && isActiveTemplate(m);
        });
        resourceRaw = (all || []).filter((m: DashboardMapping) => {
          const type = m.dashboardType;
          return type === 'resource' && isEnabled(m) && isActiveTemplate(m);
        });
      }

      const normalize = (arr: DashboardMapping[]): DashboardMapping[] => (arr || []).map((m: DashboardMapping) => {
        const parsedFields = typeof m.fields === 'string' ? safeParseJSON(m.fields, []) : (m.fields || []);
        const parsedSections = typeof m.sections === 'string' ? safeParseJSON(m.sections, []) : (m.sections || []);
        const labelMap: Record<string, string> = {};
        interface Field {
          name?: string;
          id?: string;
          label?: string;
          fields?: Field[];
        }
        const addLabels = (flds: Field[], parentLabel?: string) => {
          (flds || []).forEach((f: Field) => {
            const nm = f?.name || f?.id;
            const lb = f?.label || nm;
            if (nm) labelMap[String(nm)] = parentLabel ? `${parentLabel} > ${lb}` : String(lb);
            if (Array.isArray(f?.fields)) addLabels(f.fields, String(lb));
          });
        };
        addLabels(parsedFields as Field[]);
        return {
          ...m,
          fields: parsedFields,
          sections: parsedSections,
          __labelMap: labelMap,
          cardFields: m.cardFields || {},
        } as DashboardMapping;
      });

      const patientMappingsNormalized = normalize(patientRaw);
      const resourceMappingsNormalized = normalize(resourceRaw);

      setPatientMappings(patientMappingsNormalized);
      setResourceMappings(resourceMappingsNormalized);

      let submissions = subsRes.ok ? await subsRes.json() : [];
      const resources = resRes.ok ? await resRes.json() : [];
      const reports = reportsRes.ok ? await reportsRes.json() : [];

      if ((departmentFilter && (!Array.isArray(submissions) || submissions.length === 0))) {
        try {
          const allRes = await fetch(`/api/form-submissions${user?.role !== 'admin' && user?.role !== 'superadmin' && user?.id ? `?parentUserId=${user.id}` : ''}`);
          const allSubs = allRes.ok ? await allRes.json() : [];
          const allowedTemplateIds = new Set(
            (patientMappingsNormalized || [])
              .map(m => m.formTemplateId)
              .filter((v) => v !== undefined && v !== null)
              .map((v) => String(v))
          );
          const allowedTemplateNames = new Set(
            (patientMappingsNormalized || [])
              .map(m => m.formTemplateName)
              .filter((v) => !!v)
              .map((v) => String(v).toLowerCase())
          );

          submissions = (allSubs || []).filter((s: Record<string, unknown>) => {
            const deptOk = !departmentFilter || (String(s.template_department || s.department || '').toLowerCase() === String(departmentFilter).toLowerCase());
            if (!deptOk) return false;
            const tid = s.template_id != null ? String(s.template_id) : null;
            const tname = s.template_name ? String(s.template_name).toLowerCase() : null;
            return (tid && allowedTemplateIds.has(tid)) || (tname && allowedTemplateNames.has(tname));
          });
        } catch {
          // ignore fallback errors
        }
      }

      const roundMappings = ([...(patientMappingsNormalized || []), ...(resourceMappingsNormalized || [])]).filter((m: DashboardMapping) => {
        const ident = (m.identifier || '').trim().toLowerCase();
        const disp = (m.displayName || '').trim().toLowerCase();
        const tname = (m.formTemplateName || '').trim().toLowerCase();
        return ident === 'round' || disp.includes('round') || tname.includes('round');
      });
      setRoundMappedTemplates(roundMappings.map((m: DashboardMapping) => m.formTemplateName ?? 'Unnamed'));

      const roundTemplateIdSet = new Set(
        roundMappings
          .map((m: DashboardMapping) => m.formTemplateId)
          .filter((v) => v !== undefined && v !== null)
          .map((v) => String(v))
      );
      const roundTemplateNameSet = new Set(
        roundMappings
          .map((m: DashboardMapping) => m.formTemplateName)
          .filter((v) => !!v)
          .map((v) => String(v).toLowerCase())
      );

      // Only keep submissions that correspond to mapped patient templates
      const allowedTemplateIds = new Set(
        (patientMappingsNormalized || [])
          .map(m => m.formTemplateId)
          .filter((v) => v !== undefined && v !== null)
          .map((v) => String(v))
      );
      const allowedTemplateNames = new Set(
        (patientMappingsNormalized || [])
          .map(m => m.formTemplateName)
          .filter((v) => !!v)
          .map((v) => String(v).toLowerCase())
      );

      const hasMappings = allowedTemplateIds.size > 0 || allowedTemplateNames.size > 0;
      const patientSubmissions = (submissions || []).filter((s: Record<string, unknown>) => {
        const tid = s.template_id != null ? String(s.template_id) : null;
        const tname = s.template_name ? String(s.template_name).toLowerCase() : null;
        const isRound = (tid && roundTemplateIdSet.has(tid)) || (tname && roundTemplateNameSet.has(tname));
        if (isRound) return false;
        // If mappings exist, only allow mapped templates
        if (hasMappings) {
          return (tid && allowedTemplateIds.has(tid)) || (tname && allowedTemplateNames.has(tname));
        }
        // No mappings configured — include any submission that looks like patient data
        const fd = (s.form_data as Record<string, unknown>) || {};
        const hasMrn = fd.mrn || fd.MRN || fd['MRN'] || fd.patient_mrn || fd.patientMrn;
        const hasName = fd.patientName || fd['Patient name'] || fd.patient_name || fd['Patient Name'];
        return !!(hasMrn || hasName);
      });

      const patientData = processPatientHandovers(patientSubmissions, patientMappingsNormalized);
      setPatients(patientData);
      setRecentHandovers(patientSubmissions.slice(0, 5));

      const resourceData = processResourceStatus(resources, departmentFilter);
      setResourceStatus(resourceData);

      const effectiveDeptRaw = (filterDept && String(filterDept).trim()) || departmentFilter || (user?.department ? String(user.department) : '');
      const effectiveDept = String(effectiveDeptRaw || '').trim().toLowerCase();
      const deptScopedReports = (reports || []).filter((r: Record<string, unknown>) => {
        if (!effectiveDept) return true;
        const rDept = String(r.department || '').trim().toLowerCase();
        return rDept === effectiveDept;
      });
      const byShift = { Morning: [] as Report[], Evening: [] as Report[], Night: [] as Report[] };
      deptScopedReports.forEach((r: Record<string, unknown>) => {
        const reportData: Report = {
          id: r.id as string,
          staffName: (r.staff_name || r.staffName || r.staffname || 'Unknown') as string,
          date: (r.date || r.created_at || r.updated_at) as string,
          resources: (r.resources || []) as unknown[],
          co_signers: (r.co_signers || []) as string[],
        };
        let shiftName = normalizeShift(r.shift);
        if (!shiftName) {
          const d = parseDateSafe(reportData.date);
          const h = d.getHours();
          if (!isNaN(h)) {
            if (h >= 6 && h < 14) shiftName = 'Morning';
            else if (h >= 14 && h < 22) shiftName = 'Evening';
            else shiftName = 'Night';
          } else {
            shiftName = 'Morning';
          }
        }
        byShift[shiftName].push(reportData);
      });
      setReportsByShift(byShift);
      type SN = 'Morning' | 'Evening' | 'Night';
      const invCandidates: { shift: SN; date: Date }[] = [];
      (['Morning', 'Evening', 'Night'] as const).forEach((sn: SN) => {
        const it = byShift[sn][0];
        if (it && it.date) {
          const d = parseDateSafe(it.date);
          if (!isNaN(d.getTime())) invCandidates.push({ shift: sn, date: d });
        }
      });
      if (invCandidates.length > 0) {
        invCandidates.sort((a, b) => b.date.getTime() - a.date.getTime());
        setMostRecentShift(invCandidates[0].shift);
      } else {
        setMostRecentShift(null);
      }

      if (roundMappings.length > 0) {
        const bestDate = (s: Record<string, unknown>): string => (s?.submitted_at || s?.submittedAt || s?.date || s?.updated_at || s?.created_at || s?.updatedAt) as string;

        const roundSubs = (submissions || []).filter((s: Record<string, unknown>) => {
          const tid = s.template_id != null ? String(s.template_id) : null;
          const tname = s.template_name ? String(s.template_name).toLowerCase() : null;
          const templateMatch = (tid && roundTemplateIdSet.has(tid)) || (tname && roundTemplateNameSet.has(tname));
          const deptOk = !departmentFilter || (String(s.template_department || s.department || '').toLowerCase() === String(departmentFilter).toLowerCase());

          if (!templateMatch || !deptOk) return false;

          const submissionDate = bestDate(s);
          if (!submissionDate) return false;

          const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          return parseDateSafe(submissionDate) > twentyFourHoursAgo;
        });

        const toShift = (iso: string): 'Morning' | 'Evening' | 'Night' => {
          const d = parseDateSafe(iso);
          const h = d.getHours();
          if (h >= 7 && h < 15) return 'Morning';
          if (h >= 15 && h < 23) return 'Evening';
          return 'Night';
        };

        const getSubmissionShift = (sub: Record<string, unknown>): 'Morning' | 'Evening' | 'Night' | null => {
          const fd = (sub.form_data as Record<string, unknown>) || {};
          const shiftFromData = getByKeySmart(fd, 'shift');
          let shiftName = normalizeShift(shiftFromData);

          if (!shiftName) {
            const bd = bestDate(sub);
            if (bd) {
              shiftName = toShift(bd);
            }
          }
          return shiftName;
        };

        const roundsGrouped: { Morning: Round[]; Evening: Round[]; Night: Round[] } = { Morning: [], Evening: [], Night: [] };
        (roundSubs || []).forEach((sub: Record<string, unknown>) => {
          const shiftName = getSubmissionShift(sub);

          if (!shiftName) {
            console.error("Could not determine shift for submission:", sub);
            return;
          }

          const fd = (sub.form_data as Record<string, unknown>) || {};
          const bd = bestDate(sub);

          const mapping = roundMappings.find((m: DashboardMapping) => {
            const idMatch = m.formTemplateId != null && sub.template_id != null && String(m.formTemplateId) === String(sub.template_id);
            const nameMatch = m.formTemplateName && sub.template_name && String(m.formTemplateName).toLowerCase() === String(sub.template_name).toLowerCase();
            return idMatch || nameMatch;
          });
          const labelMap = mapping ? (mapping as DashboardMapping).__labelMap : {};
          const agenda = Object.entries(fd)
            .filter(([k, v]) => {
              const val = Array.isArray(v) ? v.join(', ').trim() : String(v ?? '').trim();
              if (!val) return false;
              const skipKeys = new Set(['id', 'patientId', 'patientName', 'mrn', 'bed', 'bedNumber', 'stability', 'department', 'submitted_by', 'submitted_by_name', 'created_at', 'updated_at'].map(s => s.toLowerCase()));
              if (skipKeys.has(String(k).toLowerCase())) return false;
              // Filter out extremely long field names (AI-generated content leaked as field name)
              if (String(k).length > 80) return false;
              return true;
            })
            .map(([k, v]) => ({
              label: (labelMap as Record<string, string>)[k] || prettifyLabel(String(k)),
              value: Array.isArray(v) ? v.join(', ') : String(v)
            }))
            .sort((a: { label: string }, b: { label: string }) => String(a.label).localeCompare(String(b.label), undefined, { sensitivity: 'base' }));

          const nurseFromAgenda = (agenda.find((ln: { label: string }) => String(ln.label || '').toLowerCase().includes('nurse'))?.value || '').toString().trim();
          const staffResolved = nurseFromAgenda || sub.submitted_by_name || sub.submitted_by || 'Unknown';

          roundsGrouped[shiftName].push({
            id: sub.id as string,
            staffName: staffResolved as string,
            date: bd,
            title: sub.template_name as string,
            agenda
          });
        });

        for (const shift in roundsGrouped) {
          roundsGrouped[shift as keyof typeof roundsGrouped].sort((a: Round, b: Round) => {
            const dateA = parseDateSafe(a.date || '');
            const dateB = parseDateSafe(b.date || '');
            return dateB.getTime() - dateA.getTime();
          });
        }

        setRoundsByShift(roundsGrouped);

        const latestOverall = (roundSubs || []).reduce((acc: { sub: Record<string, unknown>; t: Date } | null, cur: Record<string, unknown>) => {
          const dCur = parseDateSafe(bestDate(cur));
          if (!acc) return !isNaN(dCur.getTime()) ? { sub: cur, t: dCur } : acc;
          return (!isNaN(dCur.getTime()) && dCur > acc.t) ? { sub: cur, t: dCur } : acc;
        }, null as null | { sub: Record<string, unknown>; t: Date });

        if (latestOverall) {
          const shiftOfLatest = getSubmissionShift(latestOverall.sub);
          setMostRecentRoundShift(shiftOfLatest);
        } else {
          setMostRecentRoundShift(null);
        }
      } else {
        setRoundsByShift({ Morning: [], Evening: [], Night: [] });
        setMostRecentRoundShift(null);
      }

      // Build dynamic sections for any identifier that isn't round/audit/sca/isbar or a custom tab
      const allMappingsList = [...(patientMappingsNormalized || []), ...(resourceMappingsNormalized || [])];
      const customTabNames = new Set(customTabs.map((t: any) => (t.name || '').toLowerCase()));
      const identGroups: Record<string, { mappings: DashboardMapping[]; submissions: Record<string, unknown>[] }> = {};
      allMappingsList.forEach((m: DashboardMapping) => {
        const ident = (m.identifier || '').trim().toLowerCase();
        if (!ident || ident === 'round' || ident === 'audit' || ident === 'sca' || ident === 'isbar') return;
        if (customTabNames.has(ident)) return;
        if (!identGroups[ident]) identGroups[ident] = { mappings: [], submissions: [] };
        identGroups[ident].mappings.push(m);
      });
      Object.entries(identGroups).forEach(([ident, group]) => {
        const templateIds = new Set(group.mappings.map(m => String(m.formTemplateId)));
        const templateNames = new Set(group.mappings.map(m => (m.formTemplateName || '').toLowerCase()).filter(Boolean));
        group.submissions = (submissions || []).filter((s: Record<string, unknown>) => {
          const tid = s.template_id != null ? String(s.template_id) : null;
          const tname = s.template_name ? String(s.template_name).toLowerCase() : null;
          const deptOk = !departmentFilter || (String(s.template_department || s.department || '').toLowerCase() === String(departmentFilter).toLowerCase());
          return deptOk && ((tid && templateIds.has(tid)) || (tname && templateNames.has(tname)));
        });
      });
      setDynamicSections(identGroups);

      // Fetch all submissions (unfiltered) for custom tabs
      try {
        const allSubsRes = await fetch(`/api/form-submissions${user?.role !== 'admin' && user?.role !== 'superadmin' && user?.id ? `?parentUserId=${user.id}` : ''}`);
        if (allSubsRes.ok) {
          const allSubsData = await allSubsRes.json();
          setAllFormSubmissions(Array.isArray(allSubsData) ? allSubsData : []);
        }
      } catch { /* silent */ }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, allUsers, getUserDepartmentFilter, filterDept, processPatientHandovers, customTabs]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, fetchDashboardData]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await fetch('/api/users');
        if (!res.ok) return;
        const list = await res.json();
        const filtered = (list || []).filter((u: User) => String(u.username) !== String(user?.username));
        setAllUsers(filtered);
      } catch {
        // silent fail
      }
    };
    loadUsers();
  }, [user?.role, user?.username]);

  useEffect(() => {
    const handleRefresh = () => {
      if (user) {
        fetchDashboardData();
      }
    };

    const invHandler = handleRefresh as EventListener;
    window.addEventListener('inventory_report_saved', invHandler);
    window.addEventListener('dashboard_refresh', invHandler);

    return () => {
      window.removeEventListener('inventory_report_saved', invHandler);
      window.removeEventListener('dashboard_refresh', invHandler);
    };
  }, [user, fetchDashboardData]);

  const handleRemoveTab = async (tabId: string) => {
    setCustomTabs(prev => prev.filter(t => t.id !== tabId));
    if (activeTab === tabId) setActiveTab('patients');
    try { await fetch(`/api/custom-tabs/${tabId}`, { method: 'DELETE' }); } catch { /* silent */ }
  };

  const processResourceStatus = (resources: Resource[], department: string | null): ResourceStatus[] => {
    if (!resources.length) return [];

    const filteredResources = department
      ? resources.filter(r => r.department === department)
      : resources;

    const drugResources = filteredResources.filter(r => r.type === 'Drug');
    const equipmentResources = filteredResources.filter(r => r.type === 'Equipment');

    const calculateLowStock = (items: Resource[]) =>
      items.filter(item => {
        const percentage = (item.standard_quantity as number) > 0
          ? ((item.quantity as number) / (item.standard_quantity as number)) * 100
          : 0;
        return percentage < 30;
      }).length;

    return [
      {
        category: 'Medications',
        totalItems: drugResources.length,
        lowStock: calculateLowStock(drugResources),
        lastUpdated: new Date().toISOString(),
        shift: new Date().getHours() < 18 ? 'day' : 'night'
      },
      {
        category: 'Equipment',
        totalItems: equipmentResources.length,
        lowStock: calculateLowStock(equipmentResources),
        lastUpdated: new Date().toISOString(),
        shift: new Date().getHours() < 18 ? 'day' : 'night'
      }
    ];
  };

  const toggleExpandAll = () => {
    setExpandAll(!expandAll);
  };

  const isNurseOrMidwife = user?.profession === 'Nurse' || user?.profession === 'Midwifery';
  const isSeniorPhysicianOrGP = user?.profession === 'Senior Physician' || user?.profession === 'General Practitioner';

  if (loading) {
    return <IsbarLoader overlay size={96} />;
  }

  const isWithinLastNHours = (iso: string, hours: number) => {
    const t = parseDateSafe(iso).getTime();
    if (isNaN(t)) return true;
    return Date.now() - t <= hours * 60 * 60 * 1000;
  };

  const matchesQuery = (p: PatientHandover) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const hay = [p.patientName, p.mrn, p.bedNumber, p.assignedNurse, p.diagnosis, p.department]
      .filter(Boolean)
      .map((s) => String(s).toLowerCase())
      .join(' ');
    return hay.includes(q);
  };

  const filteredByTimeShift = patients
    .filter(p => {
      const timeOk = isWithinLastNHours(p.lastHandover, Number(timeWindow));
      return timeOk;
    });

  const filteredByDept = filterDept
    ? filteredByTimeShift.filter(p => String(p.department || '').toLowerCase() === String(filterDept).toLowerCase())
    : filteredByTimeShift;
  const filteredByUser = filterUser
    ? filteredByDept.filter(p => {
      const pool = [p.assignedNurse, p.assignedPhysician, p.assignedMidwife].filter(Boolean).map(v => String(v).toLowerCase());
      return pool.includes(String(filterUser).toLowerCase());
    })
    : filteredByDept;
  const visiblePatients = filteredByUser.filter(matchesQuery);

  try {
    // Debug logging can be re-enabled if needed
  } catch {
    // ignore console errors
  }

  const departmentOptions = Array.from(new Set(patients.map(p => p.department).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b)));
  const userOptions = Array.from(
    new Set(
      patients.flatMap(p => [p.assignedNurse, p.assignedPhysician, p.assignedMidwife])
        .filter(Boolean)
        .map(v => String(v))
    )
  ).sort((a, b) => a.localeCompare(b));

  // If a patient is selected, show the detail page instead of the dashboard
  if (selectedPatient) {
    return <PatientDetailPage patient={selectedPatient} onBack={() => setSelectedPatient(null)} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#003153] flex items-center justify-center shadow-sm">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-sm text-gray-400">Hospital overview, patients, staff & activity</p>
          </div>
        </div>
      </div>

      {/* Shift Safety Briefing & AI Insights */}
      {handoverBriefing && (
        <div className={`rounded-2xl shadow-lg border-2 overflow-hidden ${handoverBriefing.patientStatus === 'Critical' ? 'border-red-500 bg-red-50/30' :
          handoverBriefing.patientStatus === 'Watch' ? 'border-amber-500 bg-amber-50/30' :
            'border-green-500 bg-green-50/30'
          }`}>
          <div className={`px-6 py-3 flex items-center justify-between ${handoverBriefing.patientStatus === 'Critical' ? 'bg-red-500 text-white' :
            handoverBriefing.patientStatus === 'Watch' ? 'bg-amber-500 text-white' :
              'bg-green-500 text-white'
            }`}>
            <div className="flex items-center gap-2 font-bold">
              <Shield className="w-5 h-5" />
              <span>Shift Safety Briefing: {activeSession?.ward}</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm font-medium opacity-90">
                Briefing from: {new Date(new Date(handoverBriefing.created_at).getTime() + 3 * 3600 * 1000).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Ward Stability</span>
              <div className={`flex items-center gap-2 text-lg font-black uppercase ${handoverBriefing.patientStatus === 'Critical' ? 'text-red-600' :
                handoverBriefing.patientStatus === 'Watch' ? 'text-amber-600' :
                  'text-green-600'
                }`}>
                <div className={`w-3 h-3 rounded-full animate-pulse ${handoverBriefing.patientStatus === 'Critical' ? 'bg-red-600' :
                  handoverBriefing.patientStatus === 'Watch' ? 'bg-amber-600' :
                    'bg-green-600'
                  }`} />
                {handoverBriefing.patientStatus}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Pending Action</span>
              <div className="bg-white/80 rounded-xl p-3 border border-blue-100">
                <p className="text-sm font-bold text-gray-900 line-clamp-2">{handoverBriefing.pendingTask}</p>
                <div className="flex items-center gap-1 mt-1 text-xs text-blue-600 font-bold">
                  <Clock className="w-3 h-3" />
                  Due by: {handoverBriefing.pendingTaskTime}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Clinical Risk/Warning</span>
              <div className="bg-white/80 rounded-xl p-3 border border-red-100">
                <p className="text-sm font-bold text-red-600">{handoverBriefing.riskWarning || 'No explicit risks reported.'}</p>
              </div>
            </div>
          </div>

          <div className="bg-white/50 px-6 py-3 border-t border-gray-100 flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2 text-xs text-gray-500 italic">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Recent Changes: {handoverBriefing.changesDuringShift}</span>
            </div>
            {handoverBriefing.nightSafetyNote && (
              <div className="ml-auto flex items-center gap-2 text-xs font-bold text-indigo-800">
                <Shield className="w-4 h-4" />
                Night Protocol: {handoverBriefing.nightSafetyNote}
              </div>
            )}

            {/* Render any extra dynamic fields */}
            {Object.entries(handoverBriefing.handover_data || {}).map(([key, val]) => {
              const skip = ['patientStatus', 'changesDuringShift', 'lastAction', 'pendingTask', 'pendingTaskTime', 'riskWarning', 'nightSafetyNote', 'timestamp'];
              if (skip.includes(key) || !val) return null;
              return (
                <div key={key} className="flex items-center gap-2 text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                  <span className="font-bold opacity-70 uppercase">{prettifyLabel(key)}:</span>
                  <span className="font-medium text-gray-800">{String(val)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      {(() => {
        const allReports = Object.values(reportsByShift).flat().filter(Boolean);
        const allRounds = Object.values(roundsByShift).flat().filter(Boolean);
        const now = Date.now();
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
        const inventoryReportsCount = allReports.filter((report: any) => {
          const reportTime = new Date(new Date(report.date).getTime() + 3 * 3600 * 1000).getTime();
          return (now - reportTime) < TWENTY_FOUR_HOURS;
        }).length;
        const tabs = [
          ...(user?.role === 'admin' ? [{ id: 'admin', label: 'Admin', icon: Shield, count: 0 }] : []),
          { id: 'patients', label: 'Patients', icon: Bed, count: visiblePatients.length },
          { id: 'ai-dashboard', label: 'AI Dashboard', icon: Brain, count: 0 },
          { id: 'staff', label: 'Active Staff', icon: Users, count: 0 },
          ...(resourceMappings.length > 0 && (user?.role === 'admin' || user?.profession === 'Nurse' || user?.profession === 'Midwifery') ? [{ id: 'resources', label: 'Resources', icon: Package, count: resourceStatus.length }] : []),
          ...(isNurseOrMidwife && inventoryReportsCount > 0 ? [{ id: 'inventory', label: 'Inventory', icon: Package, count: inventoryReportsCount }] : []),
          ...(isNurseOrMidwife ? [{ id: 'rounds', label: 'Nursing Round', icon: Stethoscope, count: allRounds.length }] : []),
          ...Object.entries(dynamicSections).map(([ident, group]) => ({
            id: `dynamic-${ident}`,
            label: ident.charAt(0).toUpperCase() + ident.slice(1),
            icon: Tag,
            count: group.submissions.length,
          })),
          ...customTabs
            .filter(ct => {
              const isAdminUser = user?.role === 'admin' || user?.role === 'superadmin';
              if (isAdminUser) return true;
              const userDept = String(user?.department || '').trim().toLowerCase();
              const ctDept = String(ct.department || '').trim().toLowerCase();
              const ctDepts = (ct.departments || []).map(d => String(d).trim().toLowerCase()).filter(Boolean);
              const deptRestricted = !!(ctDept || ctDepts.length > 0);
              const deptOk = !deptRestricted || (userDept && (ctDepts.length > 0 ? ctDepts.includes(userDept) : userDept === ctDept));
              if (!deptOk) return false;
              const ctProfs = (ct.professions?.length ? ct.professions : (ct.profession ? [ct.profession] : [])).map(p => String(p).trim().toLowerCase()).filter(Boolean);
              if (ctProfs.length > 0) {
                const userProf = String(user?.profession || '').trim().toLowerCase();
                if (!userProf || !ctProfs.includes(userProf)) return false;
              }
              return true;
            })
            .map(ct => ({
              id: ct.id,
              label: ct.displayName || ct.name,
              icon: Tag,
              count: 0,
              templateId: ct.templateId,
              removable: true,
            })),
        ];
        if (tabs.length <= 1 && customTabs.length === 0) return null;
        return (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-1 flex gap-1 overflow-x-auto items-center">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-[#003153] text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                  {(tab as any).removable && user?.role === 'admin' && (
                    <span
                      onClick={(e) => { e.stopPropagation(); handleRemoveTab(tab.id); }}
                      className={`ml-0.5 -mr-1 p-0.5 rounded-full transition-colors ${isActive ? 'hover:bg-white/20 text-white/70 hover:text-white' : 'hover:bg-red-100 text-gray-400 hover:text-red-600'}`}
                    >
                      <X className="w-3 h-3" />
                    </span>
                  )}
                </button>
              );
            })}
            {user?.role === 'admin' && (
              <button
                onClick={() => onNavigate?.('custom-tabs')}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all whitespace-nowrap border border-dashed border-gray-300"
              >
                <Plus className="w-4 h-4" />
                <span>Add Tab</span>
              </button>
            )}
          </div>
        );
      })()}

      {/* Admin Tab */}
      {activeTab === 'admin' && user?.role === 'admin' && (
        <div className="space-y-4">
          {/* Log in as */}
          <DashboardSection
            title="Log in as"
            icon={<Shield className="w-5 h-5 text-[#003153]" />}
          >
            <div className="flex flex-col md:flex-row md:items-end gap-3">
              <div className="flex-1 min-w-[180px]">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5 block">Role</label>
                <select
                  value={impersonateRoleFilter}
                  onChange={e => { setImpersonateRoleFilter(e.target.value); setImpersonateProfFilter(''); setImpersonateUserId(''); }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium bg-gray-50 hover:bg-white hover:border-gray-300 focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-all duration-200 cursor-pointer"
                >
                  <option value="">All Roles</option>
                  <option value="staff">Staff</option>
                  <option value="user">Users</option>
                  <option value="viewer">Viewers</option>
                </select>
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5 block">Profession</label>
                <select
                  value={impersonateProfFilter}
                  onChange={e => { setImpersonateProfFilter(e.target.value); setImpersonateUserId(''); }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium bg-gray-50 hover:bg-white hover:border-gray-300 focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-all duration-200 cursor-pointer"
                >
                  <option value="">All Professions</option>
                  {(() => {
                    const byRole = allUsers.filter(u => !impersonateRoleFilter || u.role === impersonateRoleFilter);
                    const profs = [...new Set(byRole.map(u => u.profession).filter(Boolean))];
                    return profs.map(p => <option key={p} value={p}>{p}</option>);
                  })()}
                </select>
              </div>
              <div className="flex-1 min-w-[220px]">
                <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5 block">User</label>
                <select
                  value={impersonateUserId}
                  onChange={e => setImpersonateUserId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium bg-gray-50 hover:bg-white hover:border-gray-300 focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-all duration-200 cursor-pointer"
                >
                  <option value="">Select user...</option>
                  {allUsers
                    .filter(u => !impersonateRoleFilter || u.role === impersonateRoleFilter)
                    .filter(u => !impersonateProfFilter || u.profession === impersonateProfFilter)
                    .map((u: User) => (
                      <option key={u.id} value={String(u.id)}>
                        {u.name || u.username} {u.department ? `• ${u.department}` : ''}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (!impersonateUserId || !impersonate) return;
                    const ok = await impersonate({ userId: impersonateUserId });
                    if (ok) {
                      window.location.reload();
                    }
                  }}
                  disabled={!impersonateUserId}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700 transition-colors"
                  title="Log in as this user (replaces your session)"
                >
                  Login As
                </button>
                <button
                  onClick={() => setImpersonateUserId('')}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          </DashboardSection>

          {/* Filters */}
          <DashboardSection
            title="Dashboard Filters"
            icon={<Activity className="w-5 h-5 text-[#003153]" />}
            actions={
              <button
                onClick={() => { setFilterDept(''); setFilterUser(''); setTimeWindow('24'); setShift('All'); }}
                className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Clear Filters
              </button>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Department</label>
                <select
                  value={filterDept}
                  onChange={e => setFilterDept(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#003153] focus:border-transparent bg-gray-50 text-sm"
                >
                  <option value="">All Departments</option>
                  {departmentOptions.map(dep => (
                    <option key={dep} value={String(dep)}>{String(dep)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">User</label>
                <select
                  value={filterUser}
                  onChange={e => setFilterUser(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#003153] focus:border-transparent bg-gray-50 text-sm"
                >
                  <option value="">All Users</option>
                  {userOptions.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Time Window</label>
                <select
                  value={timeWindow}
                  onChange={e => setTimeWindow(e.target.value as '8' | '16' | '24')}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#003153] focus:border-transparent bg-gray-50 text-sm"
                >
                  <option value="8">Last 8 hours</option>
                  <option value="16">Last 16 hours</option>
                  <option value="24">Last 24 hours</option>
                </select>
              </div>
            </div>
          </DashboardSection>
        </div>
      )}

      {/* Patients Tab */}
      {activeTab === 'patients' && (
      <DashboardSection
        title={`${(patientMappings.length === 1 ? (patientMappings[0].displayName || 'Patients') : 'Active Patients')} (${visiblePatients.length})`}
        icon={<Bed className="w-5 h-5 text-blue-600" />}
        actions={patients.length > 0 ? (
          <button
            onClick={toggleExpandAll}
            disabled={visiblePatients.length > 50}
            className={`text-sm font-medium py-2 px-3 rounded-lg border transition-colors flex items-center ${
              visiblePatients.length > 50
                ? 'text-gray-400 border-gray-200 bg-gray-50 cursor-not-allowed'
                : 'text-gray-600 border-gray-300 hover:bg-gray-50 hover:text-gray-800'
            }`}
            title={visiblePatients.length > 50 ? 'Expand All is disabled for 50+ patients for performance' : ''}
          >
            {expandAll ? (
              <>
                <Minus className="w-4 h-4 mr-1" />
                Collapse All
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-1" />
                Expand All
              </>
            )}
          </button>
        ) : null}
      >
        {visiblePatients.length === 0 ? (
          <div className="text-center py-12">
            <Bed className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Patients</h3>
            <p className="text-gray-600">No patient handovers found for your department.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {visiblePatients.slice(0, patientPage * PATIENTS_PER_PAGE).map((patient) => (
                <div
                  key={patient.id}
                  onDoubleClick={() => setSelectedPatient(patient)}
                  className="cursor-pointer"
                  title="Double-click to view patient details"
                >
                  <ExpandablePatientCard patient={patient} />
                </div>
              ))}
            </div>
            {/* Pagination Controls */}
            {visiblePatients.length > PATIENTS_PER_PAGE && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Showing <span className="font-semibold text-gray-900">{Math.min(patientPage * PATIENTS_PER_PAGE, visiblePatients.length)}</span> of <span className="font-semibold text-gray-900">{visiblePatients.length}</span> patients
                </p>
                <div className="flex items-center gap-2">
                  {patientPage > 1 && (
                    <button
                      onClick={() => { setPatientPage(1); }}
                      className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      First
                    </button>
                  )}
                  {patientPage > 1 && (
                    <button
                      onClick={() => { setPatientPage(p => Math.max(1, p - 1)); }}
                      className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Previous
                    </button>
                  )}
                  <span className="text-sm text-gray-500 px-2">
                    Page {patientPage} of {Math.ceil(visiblePatients.length / PATIENTS_PER_PAGE)}
                  </span>
                  {patientPage * PATIENTS_PER_PAGE < visiblePatients.length && (
                    <button
                      onClick={() => setPatientPage(p => p + 1)}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-[#003153] rounded-lg hover:bg-[#002240] transition-colors"
                    >
                      Load More
                    </button>
                  )}
                  {patientPage * PATIENTS_PER_PAGE < visiblePatients.length && (
                    <button
                      onClick={() => setPatientPage(Math.ceil(visiblePatients.length / PATIENTS_PER_PAGE))}
                      className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Last
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </DashboardSection>
      )}

      {/* AI Dashboard Tab */}
      {activeTab === 'ai-dashboard' && (
        <AIDashboard />
      )}

      {/* Active Staff Tab */}
      {activeTab === 'staff' && (
        <DepartmentStaffPanel />
      )}

      {/* Resources Tab */}
      {activeTab === 'resources' && (resourceMappings.length > 0 && (
          user?.role === 'admin' ||
          user?.profession === 'Nurse' ||
          user?.profession === 'Midwifery'
        )) && (
          <DashboardSection
            title={(resourceMappings.length === 1 ? (resourceMappings[0].displayName || 'Resources') : 'Resource Handover Status')}
            icon={<Package className="w-5 h-5 text-green-600" />}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {resourceStatus.map((resource, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900">{resource.category}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${resource.lowStock > 0
                      ? 'bg-red-100 text-red-800'
                      : 'bg-green-100 text-green-800'
                      }`}>
                      {resource.shift.toUpperCase()} SHIFT
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Items:</span>
                      <span className="font-medium">{resource.totalItems}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Low Stock:</span>
                      <span className={`font-medium ${resource.lowStock > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                        {resource.lowStock}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Last Updated:</span>
                      <span>{new Date(new Date(resource.lastUpdated).getTime() + 3 * 3600 * 1000).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </DashboardSection>
        )
      }

      {/* Inventory Tab */}
      {activeTab === 'inventory' && isNurseOrMidwife && (() => {
        const now = Date.now();
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
        const allReports = Object.values(reportsByShift).flat().filter(Boolean)
          .filter((report: any) => {
            const reportTime = new Date(new Date(report.date).getTime() + 3 * 3600 * 1000).getTime();
            return (now - reportTime) < TWENTY_FOUR_HOURS;
          })
          .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const invSearchLower = query.trim().toLowerCase();

        const resourceBadges = (item: any) => {
          const qty = Number(item.quantity ?? 0);
          const std = Number(item.standard_quantity ?? item.standard ?? NaN);
          const expiry = item.expiry_date || item.expiry;
          const badges: { label: string; cls: string; icon: React.ReactNode }[] = [];
          if (expiry) {
            const d = new Date(new Date(expiry).getTime() + 3 * 3600 * 1000);
            if (!isNaN(d.getTime())) {
              const nowDate = new Date();
              const diffDays = Math.ceil((d.getTime() - nowDate.getTime()) / 86400000);
              if (d < nowDate) badges.push({ label: 'Expired', cls: 'bg-red-100 text-red-700', icon: <Flag className="w-3 h-3" /> });
              else if (diffDays <= 7) badges.push({ label: 'Near Expiry', cls: 'bg-amber-100 text-amber-700', icon: <AlertTriangle className="w-3 h-3" /> });
            }
          }
          const isLow = !isNaN(qty) && (qty <= 0 || (!isNaN(std) && std >= 2 && qty < 2));
          if (isLow) badges.push({ label: 'Low Stock', cls: 'bg-orange-100 text-orange-700', icon: <MinusCircle className="w-3 h-3" /> });
          return badges;
        };

        const filterResource = (item: any) => {
          if (!invSearchLower) return true;
          const fields = [item.name, item.type, item.unit, item.batch_number, item.batch, String(item.quantity ?? ''), String(item.standard_quantity ?? item.standard ?? '')];
          return fields.some(f => f && String(f).toLowerCase().includes(invSearchLower));
        };

        const renderResources = (resources: unknown) => {
          if (!resources) return null;
          if (Array.isArray(resources)) {
            const filtered = resources.filter(filterResource);
            if (filtered.length === 0) return invSearchLower ? <p className="text-sm text-gray-500 text-center py-4">No items match search</p> : <p className="text-sm text-gray-500 text-center py-4">No inventory items</p>;
            return (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] text-gray-400 uppercase tracking-wider">
                      <th className="px-3 py-2 font-semibold">Name</th>
                      <th className="px-3 py-2 font-semibold">Type</th>
                      <th className="px-3 py-2 font-semibold text-right">Qty</th>
                      <th className="px-3 py-2 font-semibold">Unit</th>
                      <th className="px-3 py-2 font-semibold">Expiry</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item: any, idx: number) => {
                      const badges = resourceBadges(item);
                      return (
                        <tr key={idx} className="hover:bg-gray-50/80 rounded-lg transition-colors border-b border-gray-100 last:border-b-0">
                          <td className="px-3 py-2 font-medium text-gray-800">{item.name || '-'}</td>
                          <td className="px-3 py-2 text-gray-400">{item.type || '-'}</td>
                          <td className="px-3 py-2 font-semibold text-gray-900 text-right">{item.quantity ?? '-'}</td>
                          <td className="px-3 py-2 text-gray-400">{item.unit || '-'}</td>
                          <td className="px-3 py-2 text-gray-400">
                            {item.expiry_date || item.expiry ? (
                              <EthiopianDateDisplay date={new Date(new Date(item.expiry_date || item.expiry).getTime() + 3 * 3600 * 1000)} format="amharic" />
                            ) : '-'}
                          </td>
                          <td className="px-3 py-2">
                            {badges.length > 0 ? (
                              <div className="flex flex-wrap items-center gap-1">
                                {badges.map((b, bi) => (
                                  <span key={bi} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${b.cls}`}>
                                    <span className="mr-0.5">{b.icon}</span>{b.label}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700">OK</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          }
          const entries = Object.entries(resources as Record<string, unknown>);
          const filteredEntries = invSearchLower ? entries.filter(([k, v]) => k.toLowerCase().includes(invSearchLower) || String(v).toLowerCase().includes(invSearchLower)) : entries;
          if (filteredEntries.length === 0) return invSearchLower ? <p className="text-sm text-gray-500 text-center py-4">No items match search</p> : <p className="text-sm text-gray-500 text-center py-4">No inventory items</p>;
          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredEntries.map(([key, val]) => (
                <div key={key} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-sm">
                  <span className="text-gray-700 font-medium">{key}</span>
                  <span className="text-gray-900">{String(val ?? '-')}</span>
                </div>
              ))}
            </div>
          );
        };

        const getInitials = (name: string) => {
          if (!name) return '??';
          const parts = name.trim().split(/\s+/);
          return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0].substring(0, 2).toUpperCase();
        };

        const timeAgo = (date: string) => {
          const reportTime = new Date(new Date(date).getTime() + 3 * 3600 * 1000).getTime();
          const diffMs = now - reportTime;
          const minutes = Math.floor(diffMs / 60000);
          if (minutes < 1) return 'Just now';
          if (minutes < 60) return `${minutes} minutes ago`;
          const hours = Math.floor(minutes / 60);
          if (hours === 1) return '1 hour ago';
          if (hours < 24) return `${hours} hours ago`;
          return `${Math.floor(hours / 24)} days ago`;
        };

        return (
          <DashboardSection
            title="Inventory Timeline"
            icon={<Package className="w-5 h-5 text-green-600" />}
            subtitle={`${allReports.length} record${allReports.length !== 1 ? 's' : ''}`}
          >
            <div className="space-y-3">
              {allReports.length > 0 ? (
                allReports.map((report: any, idx: number) => {
                  const reportId = report.id || `report-${idx}`;
                  const isExpanded = expandedReport === reportId;
                  const itemCount = Array.isArray(report.resources) ? report.resources.length : Object.keys(report.resources || {}).length;
                  const displayNumber = allReports.length - idx;
                  return (
                    <div key={reportId} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-all duration-200">
                      <button
                        onClick={() => setExpandedReport(isExpanded ? null : reportId)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/50 transition-colors"
                      >
                        <span className="text-[11px] font-bold text-gray-400 shrink-0 w-5 text-right">#{displayNumber}</span>
                        <div className="w-10 h-10 rounded-xl bg-[#003153] flex items-center justify-center text-white font-bold text-sm shrink-0">
                          {getInitials(report.staffName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900">{report.staffName || 'Unknown'}</span>
                            {Array.isArray(report.co_signers) && report.co_signers.length > 0 && (
                              <span className="text-[10px] text-[#003153] bg-[#003153]/5 px-1.5 py-0.5 rounded font-medium">
                                +{report.co_signers.length} co-sign{report.co_signers.length > 1 ? 'ers' : ''}
                              </span>
                            )}
                            <span className="text-[10px] font-bold text-gray-400">{itemCount} items</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-gray-500">{timeAgo(report.date)}</span>
                            <span className="text-gray-300">·</span>
                            <span className="text-[11px] text-gray-400">
                              <EthiopianDateTimeDisplay date={new Date(new Date(report.date).getTime() + 3 * 3600 * 1000)} showTime format="long" />
                            </span>
                          </div>
                          {Array.isArray(report.co_signers) && report.co_signers.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1 mt-1">
                              {report.co_signers.map((name: string, i: number) => (
                                <span key={i} className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-md">
                                  <span className="w-3.5 h-3.5 rounded bg-gray-300 flex items-center justify-center text-[7px] font-bold text-white">{name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}</span>
                                  {name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                          {renderResources(report.resources)}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <h3 className="text-sm font-semibold text-gray-600">No Inventory Reports</h3>
                  <p className="text-xs text-gray-400 mt-1">No reports in the last 24 hours.</p>
                </div>
              )}
            </div>
          </DashboardSection>
        );
      })()}

      {/* Nursing Round Tab */}
      {activeTab === 'rounds' && isNurseOrMidwife && (() => {
        const allRounds = Object.values(roundsByShift).flat().filter(Boolean).sort((a, b) => new Date(b.date || Date.now()).getTime() - new Date(a.date || Date.now()).getTime());
        return (
          <DashboardSection
            title="Nursing Rounds"
            icon={<Stethoscope className="w-5 h-5 text-indigo-600" />}
          >
            {roundMappedTemplates.length > 0 && allRounds.length === 0 && (
              <div className="mb-4 p-3.5 border border-amber-200 bg-amber-50 text-sm text-amber-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-semibold">Round mapping configured:</span> {roundMappedTemplates.join(', ')}. No rounds submitted yet.
                </div>
                <button
                  className="inline-flex items-center px-3 py-1.5 rounded-lg bg-[#003153] text-white font-medium text-xs hover:bg-[#002640] transition-colors"
                   onClick={() => { window.location.href = '#/csms'; }}
                  type="button"
                >
                  Start Round
                </button>
              </div>
            )}
            <div className="space-y-4">
              {allRounds.length > 0 ? (
                allRounds.map((round, idx) => {
                  const filtered = (round.agenda || []).filter((item: { value: string }) => item.value && item.value.trim());
                  // Split into header fields (patient info) and body fields (clinical observations)
                  const headerKeys = new Set(['patient name', 'patient', 'age', 'gender', 'sex', 'bed number', 'bed', 'bn', 'mrn', 'shift', 'department']);
                  const headerItems = filtered.filter((item: { label: string }) => headerKeys.has(item.label.toLowerCase()));
                  const bodyItems = filtered.filter((item: { label: string }) => !headerKeys.has(item.label.toLowerCase()));
                  return (
                    <div key={round.id || idx} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                      {/* Header */}
                      <div className="px-5 py-3 bg-indigo-50/60 border-b border-indigo-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center">
                            <Stethoscope className="w-4 h-4 text-indigo-600" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{round.staffName || 'Unknown'}</p>
                            <div className="text-[11px] text-gray-500">
                              <EthiopianDateTimeDisplay date={new Date(new Date(round.date).getTime() + 3 * 3600 * 1000)} showTime format="long" showIcon={true} size="xs" />
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-indigo-700 bg-indigo-100/80 px-2.5 py-1 rounded-full">
                          {round.title || 'Nursing Round'}
                        </span>
                      </div>

                      <div className="px-5 py-4">
                        {/* Patient Info Row */}
                        {headerItems.length > 0 && (
                          <div className="flex flex-wrap items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                            {headerItems.map((item: { label: string; value: string }, i: number) => (
                              <span key={i} className="inline-flex items-center gap-1.5 text-xs">
                                <span className="font-semibold text-gray-700">{item.label}:</span>
                                <span className="font-bold text-indigo-700">{item.value}</span>
                                {i < headerItems.length - 1 && <span className="text-gray-300 mx-1">|</span>}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Clinical Observations — Bullet List */}
                        {bodyItems.length > 0 && (
                          <div className="space-y-2">
                            {bodyItems.map((item: { label: string; value: string }, i: number) => (
                              <div key={i} className="flex items-start gap-2.5 text-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                                <div>
                                  <span className="font-semibold text-gray-800">{item.label}</span>
                                  <span className="text-gray-600 ml-1.5">{item.value}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {filtered.length === 0 && (
                          <p className="text-xs text-gray-400 italic text-center py-2">No clinical data recorded</p>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <Stethoscope className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <h3 className="text-sm font-semibold text-gray-600">No Nursing Rounds</h3>
                  <p className="text-xs text-gray-400 mt-1">Rounds submitted by staff will appear here.</p>
                </div>
              )}
            </div>
          </DashboardSection>
        );
      })()}

      {/* Dynamic sections for custom identifiers */}
      {Object.entries(dynamicSections).map(([ident, group]) => (
        activeTab === `dynamic-${ident}` && (
        <DashboardSection
          key={ident}
          title={`${ident.charAt(0).toUpperCase() + ident.slice(1)} (${group.submissions.length})`}
          icon={<Tag className="w-5 h-5 text-indigo-600" />}
        >
          {group.submissions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Tag className="mx-auto h-10 w-10 text-gray-400 mb-3" />
              <p className="font-medium">No submissions for "{ident}"</p>
              <p className="text-sm mt-1">Submissions will appear here when forms with this identifier are submitted.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.submissions.map((sub) => {
                const fd = (sub.form_data as Record<string, unknown>) || {};
                const mapping = group.mappings.find((m) => {
                  const idMatch = m.formTemplateId != null && sub.template_id != null && String(m.formTemplateId) === String(sub.template_id);
                  const nameMatch = m.formTemplateName && sub.template_name && String(m.formTemplateName).toLowerCase() === String(sub.template_name).toLowerCase();
                  return idMatch || nameMatch;
                });
                const labelMap = mapping ? (mapping as DashboardMapping).__labelMap : {};
                const str = (v: unknown) => (v !== undefined && v !== null && String(v).trim() !== '' ? String(v) : '');
                const primary = str(fd[mapping?.cardFields?.primary])
                  || str(fd['Patient Name']) || str(fd['patient name']) || str(fd.patientName) || str(fd.name)
                  || str(mapping?.cardFields?.identifier && fd[mapping.cardFields.identifier]) || str(fd.MRN) || str(fd.mrn)
                  || str(sub.submitted_by_name) || 'Record';
                const secondary = str(fd[mapping?.cardFields?.secondary]) || str(fd.department) || '';
                const status = str(fd[mapping?.cardFields?.status]) || '';
                return (
                  <div key={sub.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-gray-900 text-sm">{String(primary)}</h4>
                      {status && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {String(status)}
                        </span>
                      )}
                    </div>
                    {secondary && <p className="text-xs text-gray-500 mb-2">{String(secondary)}</p>}
                    <div className="space-y-1 mt-3 pt-3 border-t border-gray-100">
                      {Object.entries(fd)
                        .filter(([k]) => {
                          const skip = new Set(['id', 'patientId', 'created_at', 'updated_at']);
                          return !skip.has(k.toLowerCase());
                        })
                        .slice(0, 6)
                        .map(([k, v]) => (
                          <div key={k} className="flex justify-between text-xs">
                            <span className="text-gray-500 truncate">{(labelMap as Record<string, string>)[k] || prettifyLabel(k)}:</span>
                            <span className="text-gray-900 font-medium truncate ml-2">{String(v ?? '')}</span>
                          </div>
                        ))}
                    </div>
                    <div className="mt-3 text-[10px] text-gray-400 text-right">
                      {sub.submitted_at ? (() => {
                        const d = new Date(new Date(String(sub.submitted_at)).getTime() + 3 * 3600 * 1000);
                        return `${formatEthiopianDate(gregorianToEthiopian(d), 'long')} ${formatEthiopianTime(gregorianToEthiopianTime(d), 'short')}`;
                      })() : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DashboardSection>
        )
      ))}

      {/* Custom Tabs Content */}
      {customTabs
        .filter(ct => {
          const isAdminUser = user?.role === 'admin' || user?.role === 'superadmin';
          if (isAdminUser) return true;
          const userDept = String(user?.department || '').trim().toLowerCase();
          const ctDept = String(ct.department || '').trim().toLowerCase();
          const ctDepts = (ct.departments || []).map(d => String(d).trim().toLowerCase()).filter(Boolean);
          const deptRestricted = !!(ctDept || ctDepts.length > 0);
          const deptOk = !deptRestricted || (userDept && (ctDepts.length > 0 ? ctDepts.includes(userDept) : userDept === ctDept));
          if (!deptOk) return false;
          const ctProfs = (ct.professions?.length ? ct.professions : (ct.profession ? [ct.profession] : [])).map(p => String(p).trim().toLowerCase()).filter(Boolean);
          if (ctProfs.length > 0) {
            const userProf = String(user?.profession || '').trim().toLowerCase();
            if (!userProf || !ctProfs.includes(userProf)) return false;
          }
          return true;
        })
        .map(ct => (
        activeTab === ct.id && (
          <DashboardSection
            key={ct.id}
            title={ct.displayName || ct.name}
            icon={<Tag className="w-5 h-5 text-indigo-600" />}
          >
            {(() => {
              const tid = ct.templateId;
              const tname = ct.templateName.toLowerCase();
              const ctDept = (ct.department || '').toLowerCase();
              const ctDepts = (ct.departments || []).map(d => d.toLowerCase());
              const ctProfs = (ct.professions?.length ? ct.professions : (ct.profession ? [ct.profession] : [])).map(p => p.toLowerCase());
              const retentionMs = ct.retention === '24h' ? 24 * 60 * 60 * 1000 : ct.retention === '12h' ? 12 * 60 * 60 * 1000 : ct.retention === '8h' ? 8 * 60 * 60 * 1000 : 0;
              const now = Date.now();
              const filtered = (allFormSubmissions || []).filter((s: Record<string, unknown>) => {
                const sTid = s.template_id != null ? String(s.template_id) : null;
                const sTname = s.template_name ? String(s.template_name).toLowerCase() : null;
                const tplMatch = (sTid === tid) || (sTname === tname);
                if (!tplMatch) return false;
                if (ctDept || ctDepts.length > 0) {
                  const sDept = String(s.template_department || s.department || '').toLowerCase();
                  const deptOk = ctDepts.length > 0 ? ctDepts.includes(sDept) : sDept === ctDept;
                  if (!deptOk) return false;
                }
                if (ctProfs.length > 0) {
                  const sProf = String(s.profession || s.template_profession || '').toLowerCase();
                  if (sProf && !ctProfs.includes(sProf)) return false;
                }
                if (retentionMs > 0 && s.submitted_at) {
                  const subTime = new Date(String(s.submitted_at)).getTime();
                  if (now - subTime > retentionMs) return false;
                }
                return true;
              });
              const cardFields = ct.cardFields || {};
              const viewStyle = ct.viewStyle || 'card';
              if (filtered.length === 0) {
                return (
                  <div className="text-center py-8 text-gray-500">
                    <Tag className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                    <p className="font-medium">No submissions for "{ct.displayName || ct.name}"</p>
                    <p className="text-sm mt-1">Submissions from "{ct.templateName}" will appear here.</p>
                  </div>
                );
              }
              const groups: Record<string, Record<string, unknown>[]> = {};
              if (ct.groupByField) {
                filtered.forEach(sub => {
                  const fd = (sub.form_data as Record<string, unknown>) || {};
                  const key = String(fd[ct.groupByField] || 'Ungrouped');
                  if (!groups[key]) groups[key] = [];
                  groups[key].push(sub);
                });
              } else {
                groups['__all__'] = filtered;
              }
              const groupEntries = Object.entries(groups);
              const fmtTimestamp = (sub: Record<string, unknown>) => {
                if (!sub.submitted_at) return '';
                const d = new Date(new Date(String(sub.submitted_at)).getTime() + 3 * 3600 * 1000);
                return `${formatEthiopianDate(gregorianToEthiopian(d), 'long')} ${formatEthiopianTime(gregorianToEthiopianTime(d), 'short')}`;
              };
              const getFields = (sub: Record<string, unknown>) => {
                const fd = (sub.form_data as Record<string, unknown>) || {};
                const str = (v: unknown) => (v !== undefined && v !== null && String(v).trim() !== '' ? String(v) : '');
                const primary = str(cardFields.primary && fd[cardFields.primary])
                  || str(fd['Patient Name']) || str(fd['patient name']) || str(fd.patientName) || str(fd.name)
                  || str(cardFields.identifier && fd[cardFields.identifier]) || str(fd.MRN) || str(fd.mrn)
                  || str(sub.submitted_by_name) || 'Record';
                const secondary = str(cardFields.secondary && fd[cardFields.secondary]) || str(fd.department) || '';
                const status = str(cardFields.status && fd[cardFields.status]) || '';
                const identifier = str(cardFields.identifier && fd[cardFields.identifier]) || str(fd.MRN) || str(fd.mrn) || '';
                const extraFields = cardFields.extraFields || [];
                return { fd, primary, secondary, status, identifier, extraFields };
              };
              const renderGroupHeader = (groupName: string, count: number) => (
                ct.groupByField && groupEntries.length > 1 ? (
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-400" />
                    {groupName}
                    <span className="text-xs font-normal text-gray-400">({count})</span>
                  </h4>
                ) : null
              );
              if (viewStyle === 'table') {
                const allFieldKeys = (() => {
                  const keys = new Set<string>();
                  if (cardFields.primary) keys.add(cardFields.primary);
                  if (cardFields.secondary) keys.add(cardFields.secondary);
                  if (cardFields.status) keys.add(cardFields.status);
                  if (cardFields.identifier) keys.add(cardFields.identifier);
                  filtered.forEach(sub => {
                    const fd = (sub.form_data as Record<string, unknown>) || {};
                    Object.keys(fd).forEach(k => {
                      if (!['id', 'patientId', 'created_at', 'updated_at'].includes(k.toLowerCase())) keys.add(k);
                    });
                  });
                  return Array.from(keys).slice(0, 8);
                })();
                const excludeKeys = [cardFields.primary, cardFields.secondary, cardFields.status, cardFields.identifier, cardFields.nurse];
                return (
                  <div className="space-y-6">
                    {groupEntries.map(([groupName, subs]) => (
                      <div key={groupName}>
                        {renderGroupHeader(groupName, subs.length)}
                        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gradient-to-r from-[#003153] via-[#0a4a7a] to-[#0d6aa8]">
                                <th className="px-3 py-3 text-left text-xs font-semibold text-white/80">#</th>
                                {allFieldKeys.map(k => (
                                  <th key={k} className="px-3 py-3 text-left text-xs font-semibold text-white/80">{prettifyLabel(k)}</th>
                                ))}
                                <th className="px-3 py-3 text-left text-xs font-semibold text-white/80">Score</th>
                                <th className="px-3 py-3 text-left text-xs font-semibold text-white/80">Submitted</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                              {subs.map((sub, idx) => {
                                const { fd } = getFields(sub);
                                const { pct } = getAuditStats(fd, excludeKeys);
                                return (
                                  <tr key={sub.id} className="hover:bg-gray-50/80 transition-colors">
                                    <td className="px-3 py-2.5 text-gray-400 text-xs">{idx + 1}</td>
                                    {allFieldKeys.map(k => (
                                      <td key={k} className="px-3 py-2.5 text-xs max-w-[200px]">
                                        <AnswerBadge value={fd[k]} />
                                      </td>
                                    ))}
                                    <td className="px-3 py-2.5"><ScorePill pct={pct} /></td>
                                    <td className="px-3 py-2.5 text-gray-500 text-xs whitespace-nowrap">{fmtTimestamp(sub)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }
              if (viewStyle === 'list') {
                return (
                  <div className="space-y-6">
                    {groupEntries.map(([groupName, subs]) => (
                      <div key={groupName}>
                        {renderGroupHeader(groupName, subs.length)}
                        <div className="space-y-2">
                          {subs.map((sub) => {
                            const { fd, primary, secondary, status, identifier } = getFields(sub);
                            return (
                              <ListRecordRow
                                key={sub.id}
                                sub={sub}
                                primary={String(primary)}
                                secondary={String(secondary)}
                                status={String(status)}
                                identifier={String(identifier)}
                                excludeKeys={[cardFields.primary, cardFields.secondary, cardFields.status, cardFields.identifier, cardFields.nurse]}
                                fmtTimestamp={fmtTimestamp}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }
              if (viewStyle === 'stack') {
                return (
                  <div className="space-y-6">
                    {groupEntries.map(([groupName, subs]) => (
                      <div key={groupName}>
                        {renderGroupHeader(groupName, subs.length)}
                        <div className="space-y-4">
                          {subs.map((sub) => {
                            const { fd, primary, secondary, status, identifier, extraFields } = getFields(sub);
                            return (
                              <StackRecordCard
                                key={sub.id}
                                sub={sub}
                                primary={String(primary)}
                                secondary={String(secondary)}
                                status={String(status)}
                                identifier={String(identifier)}
                                nurse={String(cardFields.nurse && fd[cardFields.nurse] ? fd[cardFields.nurse] : '')}
                                extraFields={extraFields}
                                excludeKeys={[cardFields.primary, cardFields.secondary, cardFields.status, cardFields.identifier, cardFields.nurse]}
                                fmtTimestamp={fmtTimestamp}
                                chipLabels={{
                                  secondary: cardFields.secondary ? prettifyLabel(cardFields.secondary) : 'Department',
                                  identifier: cardFields.identifier ? prettifyLabel(cardFields.identifier) : 'Identifier',
                                  nurse: cardFields.nurse ? prettifyLabel(cardFields.nurse) : 'Nurse',
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }
              return (
                <div className="space-y-6">
                  {groupEntries.map(([groupName, subs]) => (
                    <div key={groupName}>
                      {renderGroupHeader(groupName, subs.length)}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {subs.map((sub) => {
                          const { fd, primary, secondary, status, identifier, extraFields } = getFields(sub);
                          const excludeKeys = [cardFields.primary, cardFields.secondary, cardFields.status, cardFields.identifier, cardFields.nurse];
                          const { pct } = getAuditStats(fd, excludeKeys);
                          return (
                            <div key={sub.id} className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col transition-all hover:shadow-lg hover:shadow-gray-100/80 hover:border-gray-300">
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-10 h-10 bg-gradient-to-br from-[#003153] to-[#0d6aa8] rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                                    <FileText className="w-5 h-5 text-white" />
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className="font-semibold text-gray-900 text-sm leading-tight truncate">{String(primary)}</h4>
                                    {secondary && <p className="text-xs text-gray-500 truncate mt-0.5">{String(secondary)}</p>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <ScorePill pct={pct} />
                                  {status && <AnswerBadge value={status} />}
                                  {identifier && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600 shrink-0">
                                      {String(identifier)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="space-y-1.5 mt-2 pt-3 border-t border-gray-100 flex-1">
                                {cleanFormEntries(fd, {
                                  extraFields,
                                  exclude: excludeKeys,
                                }).entries
                                  .slice(0, extraFields.length > 0 ? extraFields.length : 6)
                                  .map(([k, v]) => (
                                    <div key={k} className="flex items-center gap-2 text-xs">
                                      <AnswerIcon value={v} />
                                      <span className="text-gray-500 truncate min-w-0">{prettifyLabel(k)}:</span>
                                      <AnswerBadge value={v} />
                                    </div>
                                  ))}
                              </div>
                              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                                <span className="text-[10px] text-gray-400">{fmtTimestamp(sub)}</span>
                                <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </DashboardSection>
        )
      ))}
    </div>
  );
};

export default HealthcareDashboard;

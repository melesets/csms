import React, { useState, useEffect, useCallback } from 'react';
import { EthiopianDateDisplay } from './EthiopianDateDisplay';
import { gregorianToEthiopian, formatEthiopianDate } from '../utils/ethiopianCalendar';
import IsbarLoader from './IsbarLoader';
import { 
  Bed, 
  User, 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  Heart,
  Activity,
  ChevronDown,
  FileText,
  MapPin
} from 'lucide-react';

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
  formData?: Record<string, unknown>;
  fieldLabels?: Record<string, string>;
}

interface ExpandablePatientCardProps {
  patient: PatientHandover;
}

export const ExpandablePatientCard: React.FC<ExpandablePatientCardProps> = ({
  patient,
}) => {
  const [expandLevel, setExpandLevel] = useState(0); // 0: collapsed, 1: basic, 2: full
  const detailsRef = React.useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  // Load full submission history on expand
  const [history, setHistory] = useState<Record<string, unknown>[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const getInitials = (name: string) => {
    const parts = String(name || '').split(' ').filter(Boolean);
    const first = parts[0]?.[0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  };

  const getPatientGenderCode = (): '' | 'M' | 'F' => {
    const primaryFd: Record<string, unknown> = patient.formData || {};
    const latestHandoverFd: Record<string, unknown> = (history && history[0] && (history[0] as any).form_data) ? ((history[0] as any).form_data as Record<string, unknown>) : {};
    const sources: Record<string, unknown>[] = [primaryFd, latestHandoverFd];

    const getByKeys = (keys: string[]): unknown => {
      for (const src of sources) {
        for (const k of Object.keys(src)) {
          const kl = k.toLowerCase();
          if (keys.some(t => kl === t.toLowerCase())) return (src as any)[k];
        }
      }
      return undefined;
    };

    const getByLabelContains = (phrases: string[]): unknown => {
      const labels = patient.fieldLabels || {};
      const entries = Object.entries(labels);
      for (const [key, lbl] of entries) {
        const l = String(lbl || '').toLowerCase();
        if (phrases.some(p => l.includes(p.toLowerCase()))) {
          for (const src of sources) {
            if (key in src) return (src as any)[key];
            const ci = Object.keys(src).find(k => k.toLowerCase() === key.toLowerCase());
            if (ci) return (src as any)[ci];
          }
        }
      }
      return undefined;
    };

    const raw = getByKeys(['gender','sex','patient_gender','patient_sex']) ?? getByLabelContains(['gender','sex']);
    if (raw === undefined || raw === null) return '';
    const s = String(raw).trim().toLowerCase();
    if (!s) return '';
    if (s.startsWith('f') || s.includes('female') || s === 'girl' || s === 'woman' || s === 'f') return 'F';
    if (s.startsWith('m') || s.includes('male') || s === 'boy' || s === 'man' || s === 'm') return 'M';
    return '';
  };

  // Derive patient age text from form data with priorities:
  // 1) Explicit Age field (by key or label), parsing values like '2 months', '3 days', '4y'
  // 2) DOB fields -> compute y/m/d
  // 3) Separate age fields (years/months/days)
  // 4) Fallback to patient.age
  const getPatientAgeText = (): string => {
    const primaryFd: Record<string, unknown> = patient.formData || {};
    const latestHandoverFd: Record<string, unknown> = (history && history[0] && (history[0] as any).form_data) ? ((history[0] as any).form_data as Record<string, unknown>) : {};
    const sources: Record<string, unknown>[] = [primaryFd, latestHandoverFd];

    const getByKeys = (keys: string[]): unknown => {
      for (const src of sources) {
        for (const k of Object.keys(src)) {
          const kl = k.toLowerCase();
          if (keys.some(t => kl === t.toLowerCase())) return (src as any)[k];
        }
      }
      return undefined;
    };

    const getByLabelContains = (phrases: string[]): unknown => {
      const labels = patient.fieldLabels || {};
      const entries = Object.entries(labels);
      for (const [key, lbl] of entries) {
        const l = String(lbl || '').toLowerCase();
        if (phrases.some(p => l.includes(p.toLowerCase()))) {
          for (const src of sources) {
            if (key in src) return (src as any)[key];
            const ci = Object.keys(src).find(k => k.toLowerCase() === key.toLowerCase());
            if (ci) return (src as any)[ci];
          }
        }
      }
      return undefined;
    };

    const parseNum = (v: unknown): number | null => {
      const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
      return isNaN(n) ? null : n;
    };

    const parseAgeText = (v: unknown): { unit: 'y'|'m'|'d', value: number } | null => {
      const s = String(v ?? '').trim().toLowerCase();
      if (!s) return null;
      // Match number (int/float) followed by unit keywords or shorthand
      const m = s.match(/([0-9]*\.?[0-9]+)\s*(years?|yrs?|y|months?|mos?|m|days?|d)/);
      if (m) {
        const num = Number(m[1]);
        const unitRaw = m[2];
        if (!isNaN(num)) {
          if (/^y/.test(unitRaw)) return { unit: 'y', value: Math.floor(num) };
          if (/^m/.test(unitRaw)) return { unit: 'm', value: Math.floor(num) };
          if (/^d/.test(unitRaw)) return { unit: 'd', value: Math.floor(num) };
        }
      }
      // If only a number provided, assume years
      const onlyNum = parseNum(s);
      if (onlyNum !== null) return { unit: 'y', value: Math.floor(onlyNum) };
      return null;
    };

    // 1) Prefer explicit 'Age' field (by key or label)
    const ageExplicit = getByKeys(['age']) ?? getByLabelContains(['age']);
    const parsedExplicit = parseAgeText(ageExplicit);
    if (parsedExplicit) return `${parsedExplicit.value}${parsedExplicit.unit}`;

    // 2) DOB if present
    const dobRaw = getByKeys(['dob','date_of_birth','dateofbirth','birthdate','birth_date']);
    const now = new Date();
    if (dobRaw) {
      const dob = parseDateSafe(String(dobRaw));
      if (!isNaN(dob.getTime())) {
        let years = now.getFullYear() - dob.getFullYear();
        const hasHadBirthday = (now.getMonth() > dob.getMonth()) || (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
        if (!hasHadBirthday) years -= 1;

        if (years >= 1) return `${years}y`;

        // Months for infants
        let months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
        if (now.getDate() < dob.getDate()) months -= 1;
        if (months >= 1) return `${months}m`;

        // Days for neonates
        const msPerDay = 1000 * 60 * 60 * 24;
        const days = Math.max(0, Math.floor((now.getTime() - dob.getTime()) / msPerDay));
        return `${days}d`;
      }
    }

    // 3) Separate age fields
    const ageYr = parseNum(getByKeys(['age','age_years','ageyrs','patient_age','age (years)']));
    if (ageYr !== null) return `${Math.floor(ageYr)}y`;
    const ageMo = parseNum(getByKeys(['age_months','age (months)','months']));
    if (ageMo !== null) return `${Math.floor(ageMo)}m`;
    const ageDy = parseNum(getByKeys(['age_days','age (days)','days']));
    if (ageDy !== null) return `${Math.floor(ageDy)}d`;

    // 4) Fallback to provided patient.age
    if (typeof patient.age === 'number' && !isNaN(patient.age)) return `${Math.floor(patient.age)}y`;
    return '';
  };

  const parseDateSafe = (iso: string | number | Date | null | undefined): Date => {
    // Accept Date objects directly
    if (!iso) return new Date(NaN);
    if (iso instanceof Date) return iso;
    // Numeric epochs (seconds or milliseconds)
    if (typeof iso === 'number' && !isNaN(iso)) {
      return iso < 1e12 ? new Date(iso * 1000) : new Date(iso);
    }
    const s = String(iso).trim();
    // If looks like a pure number string, try numeric parse
    if (/^\d+$/.test(s)) {
      const n = Number(s);
      return n < 1e12 ? new Date(n * 1000) : new Date(n);
    }
    // If explicit timezone is provided, trust native parse
    if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
      return new Date(s.replace(' ', 'T'));
    }
    // If no timezone, try to parse as local ISO-like string
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?/);
    if (m) {
      const [, y, mo, da, h, mi, se, frac] = m;
      const ms = frac ? Math.round(Number('0.' + frac) * 1000) : 0;
      return new Date(Number(y), Number(mo) - 1, Number(da), Number(h), Number(mi), Number(se || '0'), ms);
    }
    // Fallback: try native parse, then try appending Z (UTC) if result is invalid or in future
    const direct = new Date(s.replace(' ', 'T'));
    if (!isNaN(direct.getTime())) return direct;
    const withZ = new Date((s.replace(' ', 'T')) + 'Z');
    if (!isNaN(withZ.getTime())) return withZ;
    return new Date(NaN);
  };

  const timeAgo = (iso: string | number | Date | null | undefined) => {
    try {
      // Normalize to Date
      const dt = parseDateSafe(iso);
      if (isNaN(dt.getTime())) return 'Just now';

      // If parsed date is in the future by more than 60s, try treating as UTC
      const now = Date.now();
      if (dt.getTime() - now > 60 * 1000) {
        // try append Z
        const alt = parseDateSafe(String(iso) + 'Z');
        if (!isNaN(alt.getTime()) && alt.getTime() <= now) {
          return timeAgo(alt);
        }
      }

      const deltaMs = Math.max(0, now - dt.getTime());
      const seconds = Math.floor(deltaMs / 1000);
      if (seconds < 60) return 'Just now';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
      const days = Math.floor(hours / 24);
      return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    } catch {
      return 'Just now';
    }
  };

  useEffect(() => {
    if (detailsRef.current) {
      // Use setTimeout to ensure DOM has updated before measuring
      const timeoutId = setTimeout(() => {
        if (detailsRef.current) {
          setContentHeight(detailsRef.current.scrollHeight);
        }
      }, 10); // Small delay to ensure DOM updates
      
      return () => clearTimeout(timeoutId);
    }
  }, [expandLevel, patient, history]);

  const getStabilityIcon = (stability: string) => {
    switch (stability) {
      case 'critical': return <AlertTriangle className="w-3 h-3" />;
      case 'unstable': return <Activity className="w-3 h-3" />;
      case 'subcritical': return <Activity className="w-3 h-3" />;
      case 'stable': return <CheckCircle className="w-3 h-3" />;
      default: return <Heart className="w-3 h-3" />;
    }
  };

  // Derive Patient Condition (Critical, Subcritical, Stable) strictly from explicit field across sources; fallback only if missing
  const getPatientCondition = (): 'critical' | 'subcritical' | 'stable' => {
    const primaryFd: Record<string, unknown> = patient.formData || {};
    const latestHandoverFd: Record<string, unknown> = (history && history[0] && (history[0] as any).form_data) ? ((history[0] as any).form_data as Record<string, unknown>) : {};
    const sources: Record<string, unknown>[] = [primaryFd, latestHandoverFd];
    const labels = patient.fieldLabels || {};

    const normalizeKey = (k: string) => String(k || '').toLowerCase().replace(/[\s_-]+/g, '');
    const targets = new Set(['patientcondition']);

    // Helper: find a key in a given source by normalized key name
    const findKeyIn = (src: Record<string, unknown>): string | undefined => {
      for (const k of Object.keys(src || {})) {
        if (targets.has(normalizeKey(k))) return k;
      }
      return undefined;
    };

    // First try label mapping to a concrete key in primary source
    const labelMappedKey = (() => {
      for (const [k, lbl] of Object.entries(labels || {})) {
        const l = String(lbl || '').toLowerCase();
        if (l.includes('patient condition')) return k;
      }
      return undefined;
    })();

    let raw: unknown = undefined;
    // Prefer label-mapped key in primary
    if (labelMappedKey && labelMappedKey in primaryFd) raw = (primaryFd as any)[labelMappedKey];
    // Otherwise scan sources for normalized key match
    if (raw === undefined) {
      for (const src of sources) {
        const key = findKeyIn(src);
        if (key) { raw = (src as any)[key]; break; }
      }
    }
    // Accept value only if exact - map form values to display values
    if (raw !== undefined && raw !== null) {
      const norm = String(raw).trim().toLowerCase();
      if (norm === 'critical') return 'critical';
      if (norm === 'subcritical' || norm === 'unstable' || norm === 'sub-critical') return 'subcritical';
      if (norm === 'stable') return 'stable';
    }
    // Fallback: existing stability only if already exact
    switch ((patient.stability || '').toLowerCase()) {
      case 'critical':
        return 'critical';
      case 'subcritical':
      case 'unstable':
        return 'subcritical';
      case 'stable':
        return 'stable';
      default:
        return 'stable';
    }
  };

  const getStabilityBadgeClasses = (stability: string) => {
    switch (stability) {
      case 'critical':
        return 'bg-red-600/20 text-red-300 border-red-500';
      case 'unstable':
        return 'bg-yellow-500/20 text-yellow-200 border-yellow-400';
      case 'subcritical':
        return 'bg-yellow-500/20 text-yellow-200 border-yellow-400';
      case 'stable':
        return 'bg-green-600/20 text-green-300 border-green-500';
      default:
        return 'bg-white/10 text-white border-white/30';
    }
  };

  const toggleBasicExpanded = () => {
    setExpandLevel(prev => prev === 0 ? 1 : 0); // toggle between collapsed and basic
  };

  const toggleFullExpanded = () => {
    setExpandLevel(prev => prev === 2 ? 1 : 2); // toggle between basic and full
  };

  const matchesPatient = useCallback((fd: Record<string, unknown>) => {
    // Prefer MRN match across common variants
    const mrnCandidates = [fd?.mrn, fd?.MRN, fd?.['MRN'], fd?._mrn, fd?.patient_mrn, fd?.patientMrn];
    const mrnMatch = mrnCandidates.some((v) => v !== undefined && String(v).trim() === String(patient.mrn).trim());
    if (mrnMatch) return true;
    // Fallback: patient name match when MRN is absent or inconsistent (case-insensitive)
    const nameCandidates = [fd?.patientName, fd?.['Patient name'], fd?.patient_name];
    const nameMatch = nameCandidates.some((v) => v !== undefined && String(v).trim().toLowerCase() === String(patient.patientName).trim().toLowerCase());
    return nameMatch;
  }, [patient.mrn, patient.patientName]);

  const loadHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      setHistoryError(null);
      // Fetch all submissions (across all departments) to show complete history for this patient
      const res = await fetch('/api/form-submissions');
      const data: Record<string, unknown>[] = res.ok ? await res.json() : [];
      // Only include ISBAR patient handover submissions; exclude rounds and audits
      const isHandoverTemplate = (name: unknown) => {
        const n = String(name || '').toLowerCase();
        if (!n) return false;
        if (n.includes('round') || n.includes('audit')) return false;
        return n.includes('handover') || n.includes('isbar');
      };

      const filtered = (data || []).filter((s: Record<string, unknown>) => {
        const fd = (s?.form_data as Record<string, unknown>) || {};
        return matchesPatient(fd) && isHandoverTemplate(s?.template_name);
      }).sort((a: Record<string, unknown>, b: Record<string, unknown>) => new Date(b.submitted_at as string).getTime() - new Date(a.submitted_at as string).getTime());
      setHistory(filtered);
    } catch {
      setHistory([]);
      setHistoryError('Failed to load submission history');
    } finally {
      setLoadingHistory(false);
    }
  }, [matchesPatient]);

  useEffect(() => {
    if (expandLevel === 2 && history === null) {
      loadHistory();
    }
  }, [expandLevel, history, loadHistory]);

  const renderHistory = () => {
    if (loadingHistory) {
      return (
        <div className="py-2">
          <IsbarLoader message="Loading history..." size={56} />
        </div>
      );
    }
    if (historyError) {
      return <div className="text-xs text-red-600">{historyError}</div>;
    }
    if (!history) return null;
    if (history.length === 0) {
      return <div className="text-xs text-gray-500">No previous submissions found.</div>;
    }

    const pretty = (key: string) => {
      if (patient.fieldLabels && patient.fieldLabels[key]) return patient.fieldLabels[key];
      return key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    };
    const renderValue = (val: unknown) => {
      if (Array.isArray(val)) return val.join(', ');
      if (typeof val === 'object' && val !== null) return JSON.stringify(val);
      return String(val);
    };

    return (
      <div className="space-y-3">
        {history.slice(0, 1).map((sub: Record<string, unknown>, idx: number) => {
          const fd = (sub.form_data as Record<string, unknown>) || {};
          const entries = Object.entries(fd).filter(([, v]) => v !== undefined && v !== null && v !== '');
          return (
            <div key={sub.id as string || idx} className="bg-white border border-gray-200 rounded-md p-2">
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-700 font-medium">{sub.template_name as string || 'Submission'}</div>
                <div className="text-[10px] text-gray-500">
                  <EthiopianDateDisplay date={parseDateSafe(sub.submitted_at as string)} format="long" /> • {sub.submitted_by_name as string || sub.submitted_by as string || 'Unknown'}
                </div>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-1">
                {entries.map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between border-t border-gray-100 pt-1">
                    <span className="text-[10px] text-gray-500 mr-2 truncate max-w-[50%]">{pretty(k)}</span>
                    <span className="text-[11px] text-gray-800 text-right break-all max-w-[50%]">{renderValue(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {history.length > 1 && (
          <div className="text-center">
            <span className="text-[10px] text-white/60">
              {history.length - 1} more record{history.length > 2 ? 's' : ''} available
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-[#003153] bg-[#003153] text-white shadow-sm hover:shadow-md transition-shadow duration-200 h-fit">
      {/* Compact Card Header - Always Visible */}
      <div className="p-3">
        {/* Patient Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="p-1.5 bg-white/10 rounded-md">
            <Bed className="w-4 h-4 text-white" />
          </div>
          {(() => { const cond = getPatientCondition(); return (
          <div className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${getStabilityBadgeClasses(cond)}`}>
            <div className="flex items-center">
              {getStabilityIcon(cond)}
              <span className="ml-1">{cond === 'critical' ? 'Critical' : cond === 'subcritical' ? 'Subcritical' : 'Stable'}</span>
            </div>
          </div>
          ); })()}
        </div>

        {/* Patient Basic Info */}
        <div className="space-y-1.5">
          <div className="flex items-center flex-wrap gap-2 min-w-0">
            <div className="font-semibold text-white text-sm leading-tight uppercase break-words whitespace-normal">
              {patient.patientName}
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/20">
              Bed {patient.bedNumber}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/20">
              MRN {patient.mrn}
            </span>
          </div>
          
          <div className="flex items-center justify-between text-[11px] text-white/80">
            <span>{(() => { const age = getPatientAgeText(); const g = getPatientGenderCode(); return g ? `${age}, ${g}` : age; })()}</span>
            <span title={(() => { const d = parseDateSafe(patient.lastHandover); if (isNaN(d.getTime())) return 'Unknown'; const eth = gregorianToEthiopian(d); return formatEthiopianDate(eth, 'long'); })()}>
              {timeAgo(patient.lastHandover)}
            </span>
          </div>
        </div>

        {/* Assigned clinician area - only render when mapping/submission supplies a clinician */}
        {(patient.assignedPhysician || patient.assignedMidwife || patient.assignedNurse) && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
          <div className="flex items-center text-[11px] text-white/80 gap-2">
            {patient.assignedPhysician ? (
              <>
                <div className="w-6 h-6 rounded-full bg-white/10 text-white border border-white/20 flex items-center justify-center text-[10px] font-semibold">
                  {getInitials(patient.assignedPhysician)}
                </div>
                <span className="truncate">{patient.assignedPhysician}</span>
              </>
            ) : patient.assignedMidwife ? (
              <>
                <div className="w-6 h-6 rounded-full bg-white/10 text-white border border-white/20 flex items-center justify-center text-[10px] font-semibold">
                  {getInitials(patient.assignedMidwife)}
                </div>
                <span className="truncate">{patient.assignedMidwife}</span>
              </>
            ) : (
              <>
                <div className="w-6 h-6 rounded-full bg-white/10 text-white border border-white/20 flex items-center justify-center text-[10px] font-semibold">
                  {getInitials(patient.assignedNurse)}
                </div>
                <span className="truncate">{patient.assignedNurse}</span>
              </>
            )}
          </div>

          {/* Basic Expand/Collapse Button */}
          <button
            onClick={toggleBasicExpanded}
            aria-expanded={expandLevel > 0}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
            title={expandLevel > 0 ? 'Collapse' : 'Expand basic info'}
          >
            <ChevronDown className={`w-4 h-4 text-white/80 transition-transform ${expandLevel > 0 ? 'rotate-180' : ''}`} />
          </button>
        </div>
        )}
      </div>

      {/* Expanded Details - Animated */}
      <div
        className={`border-t border-white/10 bg-white/5 overflow-hidden transition-all duration-300 ${expandLevel > 0 ? 'opacity-100' : 'opacity-0'}`}
        style={{ maxHeight: expandLevel > 0 ? contentHeight + 16 : 0 }}
      >
        <div ref={detailsRef} className="p-4 space-y-4">
            {/* Level 1: Basic Info - Always shown when expanded */}
            {expandLevel >= 1 && (
              <>
                {/* Department */}
                <div>
                  <label className="text-[10px] font-medium text-white/80 uppercase tracking-wide">
                    Department
                  </label>
                  <div className="mt-1 flex items-center">
                    <MapPin className="w-3 h-3 text-white/80 mr-2" />
                    <span className="text-xs text-white">{patient.department}</span>
                  </div>
                </div>

                {/* Patient Details */}
                <div>
                  <label className="text-[10px] font-medium text-white/80 uppercase tracking-wide">
                    Patient Info
                  </label>
                  <div className="mt-1 space-y-1">
                    <div className="flex items-center">
                      <User className="w-3 h-3 text-white/80 mr-2" />
                      <span className="text-xs text-white">
                        {(() => { const age = getPatientAgeText(); const g = getPatientGenderCode(); if (!g) return age; return `${age}, ${g === 'M' ? 'Male' : 'Female'}`; })()}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <FileText className="w-3 h-3 text-white/80 mr-2" />
                      <span className="text-xs text-white">MRN: {patient.mrn}</span>
                    </div>
                  </div>
                </div>

                {/* Last Handover */}
                <div>
                  <label className="text-[10px] font-medium text-white/80 uppercase tracking-wide">
                    Last Handover
                  </label>
                  <div className="mt-1 flex items-center">
                    <Clock className="w-3 h-3 text-white/80 mr-2" />
                    <span className="text-xs text-white" title={(() => { const d = parseDateSafe(patient.lastHandover); if (isNaN(d.getTime())) return 'Unknown'; const eth = gregorianToEthiopian(d); return formatEthiopianDate(eth, 'long'); })()}>
                      {timeAgo(patient.lastHandover)}
                    </span>
                  </div>
                </div>

                {/* Show Details Button - Only shown at level 1 */}
                {expandLevel === 1 && (
                  <div className="pt-3 border-t border-white/10">
                    <button
                      onClick={toggleFullExpanded}
                      className="w-full px-3 py-2 text-[11px] text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors flex items-center justify-center gap-2"
                    >
                      <span>Show Details</span>
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Level 2: Full Details - Only shown on second expand */}
            {expandLevel >= 2 && (
              <>
                {/* Handover History */}
                <div className="pt-2 border-t border-white/10">
                  <label className="text-[10px] font-medium text-white/80 uppercase tracking-wide">
                    Handover History
                  </label>
                  <div className="mt-2">
                    {renderHistory()}
                  </div>
                </div>

                {/* Hide Details Button - Only shown at level 2 */}
                <div className="pt-3 border-t border-white/10">
                  <button
                    onClick={toggleFullExpanded}
                    className="w-full px-3 py-2 text-[11px] text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Hide Details</span>
                    <ChevronDown className="w-3 h-3 rotate-180" />
                  </button>
                </div>

                <div className="text-[10px] text-white/70 text-center pt-2">
                  ID: {patient.id}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
  );
};

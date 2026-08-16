// Expandable patient card - shows patient summary with inline handover form
import React, { useState, useEffect, useCallback } from 'react';
import { EthiopianDateDisplay } from '../../components/shared';
import { gregorianToEthiopian, formatEthiopianDate } from '../../utils/ethiopianCalendar';
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
  MapPin,
  Shield
} from 'lucide-react';
import { useShift } from '../../hooks/useShift';
import { useAuth } from '../../hooks/useAuth';
import { DynamicHandoverForm } from './DynamicHandoverForm';
import { FormTemplate } from '../../types/formBuilder';

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
  const [expandedHistoryIdx, setExpandedHistoryIdx] = useState<number>(0); // most recent open by default

  // Load full submission submissionHistory on expand
  const [submissionHistory, setSubmissionHistory] = useState<Record<string, unknown>[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submissionHistoryError, setSubmissionHistoryError] = useState<string | null>(null);
  const [isSubmittingHandover, setIsSubmittingHandover] = useState(false);

  const { activeSession, shift: currentShiftName } = useShift();
  const { user } = useAuth();
  const [showHandoverForm, setShowHandoverForm] = useState(false);

  const handleDynamicHandoverSuccess = async (formData: any, template: FormTemplate, reporterInfo?: any) => {
    setIsSubmittingHandover(true);
    try {
      const handoverPayload = {
        fromUserId: reporterInfo?.id || user?.id,
        ward: activeSession?.ward,
        profession: reporterInfo?.profession || user?.profession || user?.role,
        shiftName: currentShiftName,
        mrn: patient.mrn,
        handoverData: {
          ...formData, // Use the dynamic form data
          patientStatus: formData.stability || formData.patientStatus || patient.stability,
          timestamp: new Date().toISOString()
        }
      };

      const handoverPromise = fetch('/api/shifts/handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(handoverPayload)
      });

      const submissionPromise = fetch('/api/form-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: template.id,
          template_name: template.name,
          template_department: activeSession?.ward || '',
          form_data: {
            ...formData,
            patientName: patient.patientName,
            mrn: patient.mrn,
            bedNumber: patient.bedNumber
          },
          submitted_by: reporterInfo?.username || user?.username,
          submitted_by_name: reporterInfo?.name || user?.name || user?.username,
          submitted_by_department: reporterInfo?.department || activeSession?.ward || '',
          submitted_by_profession: reporterInfo?.profession || user?.profession || user?.role,
          shift_session_id: activeSession?.id || null
        })
      });

      const [resH] = await Promise.all([handoverPromise, submissionPromise]);

      if (resH.ok) {
        setShowHandoverForm(false);
        loadHistory(); // Refresh submissionHistory
        window.dispatchEvent(new CustomEvent('dashboard_refresh'));
      }
    } catch (err) {
      console.error('Failed to submit dynamic handover:', err);
    } finally {
      setIsSubmittingHandover(false);
    }
  };

  const getInitials = (name: string) => {
    const parts = String(name || '').split(' ').filter(Boolean);
    const first = parts[0]?.[0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  };

  const getPatientGenderCode = (): '' | 'M' | 'F' => {
    const primaryFd: Record<string, unknown> = patient.formData || {};
    const latestHandoverFd: Record<string, unknown> = (submissionHistory && submissionHistory[0] && (submissionHistory[0] as any).form_data) ? ((submissionHistory[0] as any).form_data as Record<string, unknown>) : {};
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

    const raw = getByKeys(['gender', 'sex', 'patient_gender', 'patient_sex']) ?? getByLabelContains(['gender', 'sex']);
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
    const latestHandoverFd: Record<string, unknown> = (submissionHistory && submissionHistory[0] && (submissionHistory[0] as any).form_data) ? ((submissionHistory[0] as any).form_data as Record<string, unknown>) : {};
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

    const parseAgeText = (v: unknown): { unit: 'y' | 'm' | 'd', value: number } | null => {
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
    const dobRaw = getByKeys(['dob', 'date_of_birth', 'dateofbirth', 'birthdate', 'birth_date']);
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
    const ageYr = parseNum(getByKeys(['age', 'age_years', 'ageyrs', 'patient_age', 'age (years)']));
    if (ageYr !== null) return `${Math.floor(ageYr)}y`;
    const ageMo = parseNum(getByKeys(['age_months', 'age (months)', 'months']));
    if (ageMo !== null) return `${Math.floor(ageMo)}m`;
    const ageDy = parseNum(getByKeys(['age_days', 'age (days)', 'days']));
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

      // Apply UTC+3 offset for Ethiopia
      dt.setTime(dt.getTime() + 3 * 3600 * 1000);

      // If parsed date is in the future by more than 60s, try treating as UTC
      const now = Date.now();
      if (dt.getTime() - now > 60 * 1000) {
        // try append Z
        const alt = parseDateSafe(String(iso) + 'Z');
        if (!isNaN(alt.getTime())) {
          alt.setTime(alt.getTime() + 3 * 3600 * 1000);
          if (alt.getTime() <= now) {
            return timeAgo(alt);
          }
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
  }, [expandLevel, patient, submissionHistory]);

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
    const latestHandoverFd: Record<string, unknown> = (submissionHistory && submissionHistory[0] && (submissionHistory[0] as any).form_data) ? ((submissionHistory[0] as any).form_data as Record<string, unknown>) : {};
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
      setSubmissionHistoryError(null);
      // Fetch all submissions (across all departments) to show complete submissionHistory for this patient
      const params = new URLSearchParams();
      if (user?.role !== 'admin' && user?.role !== 'superadmin' && user?.id) {
        params.set('parentUserId', String(user.id));
      }
      const qs = params.toString();
      const res = await fetch(`/api/form-submissions${qs ? `?${qs}` : ''}`);
      const data: Record<string, unknown>[] = res.ok ? await res.json() : [];
      // Exclude rounds and audits, but include all patient-matched submissions
      const isExcluded = (name: unknown) => {
        const n = String(name || '').toLowerCase();
        return n.includes('round') || n.includes('audit');
      };

      const filtered = (data || []).filter((s: Record<string, unknown>) => {
        const fd = (s?.form_data as Record<string, unknown>) || {};
        return matchesPatient(fd) && !isExcluded(s?.template_name);
      }).sort((a: Record<string, unknown>, b: Record<string, unknown>) => new Date(b.submitted_at as string).getTime() - new Date(a.submitted_at as string).getTime());
      setSubmissionHistory(filtered);
      setExpandedHistoryIdx(0); // most recent open by default
    } catch {
      setSubmissionHistory([]);
      setSubmissionHistoryError('Failed to load submission submissionHistory');
    } finally {
      setLoadingHistory(false);
    }
  }, [matchesPatient]);

  useEffect(() => {
    if (expandLevel === 2 && submissionHistory === null) {
      loadHistory();
    }
  }, [expandLevel, submissionHistory, loadHistory]);

  const renderHistory = () => {
    if (loadingHistory) {
      return (
        <div className="py-2 space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-6 h-6 bg-white/10 rounded-full" />
              <div className="flex-1">
                <div className="h-2 bg-white/10 rounded w-2/3 mb-1" />
                <div className="h-1.5 bg-white/5 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      );
    }
    if (submissionHistoryError) {
      return <div className="text-xs text-red-400">{submissionHistoryError}</div>;
    }
    if (!submissionHistory) return null;
    if (submissionHistory.length === 0) {
      return <div className="text-xs text-white/50">No previous handover records found.</div>;
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

    // First registration = oldest submission
    const firstSub = submissionHistory[submissionHistory.length - 1];
    const firstDate = firstSub?.submitted_at as string;

    return (
      <div className="space-y-0 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
        {/* First Registration */}
        {firstDate && (
          <div className="flex items-center gap-2 mb-3 px-2 py-1.5 bg-indigo-500/15 rounded-lg border border-indigo-400/20">
            <Shield className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
            <div className="text-[10px] text-indigo-200">
              <span className="font-semibold">First Registered: </span>
              <EthiopianDateDisplay date={parseDateSafe(firstDate)} format="long" />
              <span className="text-white/40 ml-1">({timeAgo(firstDate)})</span>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="relative pl-4">
          {/* Vertical line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/15" />

          {submissionHistory.map((sub: Record<string, unknown>, idx: number) => {
            const fd = (sub.form_data as Record<string, unknown>) || {};
            const entries = Object.entries(fd).filter(([, v]) => v !== undefined && v !== null && v !== '');
            const isOpen = expandedHistoryIdx === idx;
            const submitterName = String(sub.submitted_by_name || sub.submitted_by || 'Unknown');
            const stabilityField = fd.stability || fd.patientStatus || fd.patientCondition || fd['Patient Stability'] || fd['Patient Condition'];

            return (
              <div key={sub.id as string || idx} className="relative mb-2">
                {/* Timeline dot */}
                <div className={`absolute -left-4 top-2.5 w-3 h-3 rounded-full border-2 ${idx === 0 ? 'bg-indigo-400 border-indigo-300' : 'bg-white/20 border-white/30'}`} />

                {/* Card */}
                <div
                  className={`ml-2 rounded-lg border transition-colors cursor-pointer ${isOpen ? 'bg-white/10 border-indigo-400/30' : 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20'}`}
                  onClick={() => setExpandedHistoryIdx(isOpen ? -1 : idx)}
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${idx === 0 ? 'text-indigo-300' : 'text-white/60'}`}>#{submissionHistory.length - idx}</span>
                      <span className="text-[11px] text-white/90 font-medium truncate">{submitterName}</span>
                      {stabilityField && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${String(stabilityField).toLowerCase() === 'critical' ? 'bg-red-500/20 text-red-300' : String(stabilityField).toLowerCase() === 'unstable' || String(stabilityField).toLowerCase() === 'subcritical' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300'}`}>
                          {String(stabilityField)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[9px] text-white/40 italic">
                        <EthiopianDateDisplay date={parseDateSafe(sub.submitted_at as string)} format="short" />
                      </span>
                      <ChevronDown className={`w-3 h-3 text-white/50 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isOpen && (
                    <div className="px-3 pb-3 pt-1 border-t border-white/5">
                      <div className="text-[9px] text-white/30 mb-2">
                        {sub.template_name as string || 'Submission'} • <EthiopianDateDisplay date={parseDateSafe(sub.submitted_at as string)} format="long" />
                      </div>
                      <div className="grid grid-cols-1 gap-1">
                        {entries.map(([k, v]) => (
                          <div key={k} className="flex items-start justify-between border-t border-white/5 pt-1">
                            <span className="text-[10px] text-white/40 mr-2 truncate max-w-[45%]">{pretty(k)}</span>
                            <span className="text-[10px] text-white/90 text-right break-all max-w-[55%]">{renderValue(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
          {(() => {
            const cond = getPatientCondition(); return (
              <div className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${getStabilityBadgeClasses(cond)}`}>
                <div className="flex items-center">
                  {getStabilityIcon(cond)}
                  <span className="ml-1">{cond === 'critical' ? 'Critical' : cond === 'subcritical' ? 'Subcritical' : 'Stable'}</span>
                </div>
              </div>
            );
          })()}
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

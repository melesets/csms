import React, { useState, useEffect } from 'react';
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
  Stethoscope,
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
  diagnosis: string;
  age: number;
  gender: 'M' | 'F';
  formData?: Record<string, any>;
  fieldLabels?: Record<string, string>;
}

interface ExpandablePatientCardProps {
  patient: PatientHandover;
  onNewHandover: () => void;
}

export const ExpandablePatientCard: React.FC<ExpandablePatientCardProps> = ({
  patient,
  onNewHandover
}) => {
  const [expandLevel, setExpandLevel] = useState(0); // 0: collapsed, 1: basic, 2: full
  const detailsRef = React.useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  // Load full submission history on expand
  const [history, setHistory] = useState<any[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const getInitials = (name: string) => {
    const parts = String(name || '').split(' ').filter(Boolean);
    const first = parts[0]?.[0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  };

  const parseDateSafe = (iso: string): Date => {
    if (!iso) return new Date(NaN);
    const s = String(iso).trim();
    // If explicit timezone is provided, trust native parse
    if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
      return new Date(s.replace(' ', 'T'));
    }
    // If no timezone, treat as local time (common from many backends)
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?/);
    if (m) {
      const [, y, mo, da, h, mi, se, frac] = m as any;
      const ms = frac ? Math.round(Number('0.' + frac) * 1000) : 0;
      return new Date(Number(y), Number(mo) - 1, Number(da), Number(h), Number(mi), Number(se || '0'), ms);
    }
    // Fallback to native parsing after normalizing space to T
    return new Date(s.replace(' ', 'T'));
  };

  const timeAgo = (iso: string) => {
    const t = parseDateSafe(iso).getTime();
    if (isNaN(t)) return '';
     const deltaMs = Date.now() - t;
    const delta = Math.max(0, deltaMs);
    const seconds = Math.floor(delta / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    const days = Math.floor(hours / 24);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
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

  const getStabilityColor = (stability: string) => {
    switch (stability) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'unstable': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'stable': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStabilityIcon = (stability: string) => {
    switch (stability) {
      case 'critical': return <AlertTriangle className="w-3 h-3" />;
      case 'unstable': return <Activity className="w-3 h-3" />;
      case 'stable': return <CheckCircle className="w-3 h-3" />;
      default: return <Heart className="w-3 h-3" />;
    }
  };

  const getStabilityBadgeClasses = (stability: string) => {
    switch (stability) {
      case 'critical':
        return 'bg-red-600/20 text-red-300 border-red-500';
      case 'unstable':
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

  const renderAllSubmittedData = () => {
    const data = patient.formData || {};
    const entries = Object.entries(data)
      .filter(([_, v]) => v !== undefined && v !== null && v !== '')
      .sort((a, b) => {
        const la = (patient.fieldLabels?.[a[0]] || a[0]).toLowerCase();
        const lb = (patient.fieldLabels?.[b[0]] || b[0]).toLowerCase();
        return la.localeCompare(lb);
      });

    if (entries.length === 0) return null;

    const pretty = (key: string) => {
      if (patient.fieldLabels && patient.fieldLabels[key]) return patient.fieldLabels[key];
      return key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    };

    const renderValue = (val: any) => {
      if (Array.isArray(val)) return val.join(', ');
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    };

    return (
      <div>
        <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
          All Submitted Information
        </label>
        <div className="mt-2 space-y-1">
          {entries.map(([key, value]) => (
            <div key={key} className="flex items-start justify-between bg-white border border-gray-200 rounded px-2 py-1">
              <span className="text-xs text-gray-600 mr-3 truncate max-w-[50%]">{pretty(key)}</span>
              <span className="text-xs text-gray-900 text-right break-all max-w-[50%]">{renderValue(value)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const matchesPatient = (fd: any) => {
    // Prefer MRN match across common variants
    const mrnCandidates = [fd?.mrn, fd?.MRN, fd?.['MRN'], fd?._mrn, fd?.patient_mrn, fd?.patientMrn];
    const mrnMatch = mrnCandidates.some((v) => v !== undefined && String(v).trim() === String(patient.mrn).trim());
    if (mrnMatch) return true;
    // Fallback: patient name match when MRN is absent or inconsistent (case-insensitive)
    const nameCandidates = [fd?.patientName, fd?.['Patient name'], fd?.patient_name];
    const nameMatch = nameCandidates.some((v) => v !== undefined && String(v).trim().toLowerCase() === String(patient.patientName).trim().toLowerCase());
    return nameMatch;
  };

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      setHistoryError(null);
      // Fetch all submissions (across all departments) to show complete history for this patient
      const res = await fetch('/api/form-submissions');
      const data = res.ok ? await res.json() : [];
      const filtered = (data || []).filter((s: any) => {
        const fd = s?.form_data || {};
        return matchesPatient(fd);
      }).sort((a: any, b: any) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
      setHistory(filtered);
    } catch (e: any) {
      setHistory([]);
      setHistoryError('Failed to load submission history');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (expandLevel === 2 && history === null) {
      loadHistory();
    }
  }, [expandLevel]);

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
    const renderValue = (val: any) => {
      if (Array.isArray(val)) return val.join(', ');
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    };

    return (
      <div className="space-y-3">
        {history.slice(0, 1).map((sub: any, idx: number) => {
          const fd = sub.form_data || {};
          const entries = Object.entries(fd).filter(([_, v]) => v !== undefined && v !== null && v !== '');
          return (
            <div key={sub.id || idx} className="bg-white border border-gray-200 rounded-md p-2">
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-700 font-medium">{sub.template_name || 'Submission'}</div>
                <div className="text-[10px] text-gray-500">{parseDateSafe(sub.submitted_at).toLocaleString()} • {sub.submitted_by_name || sub.submitted_by || 'Unknown'}</div>
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
          <div className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${getStabilityBadgeClasses(patient.stability)}`}>
            <div className="flex items-center">
              {getStabilityIcon(patient.stability)}
              <span className="ml-1 capitalize">{patient.stability}</span>
            </div>
          </div>
        </div>

        {/* Patient Basic Info */}
        <div className="space-y-1.5">
          <div className="flex items-center flex-wrap gap-2">
            <div className="font-semibold text-white text-sm leading-tight truncate uppercase">
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
            <span>{patient.age}y, {patient.gender}</span>
            <span>{timeAgo(patient.lastHandover)}</span>
          </div>
        </div>

        {/* Assigned Nurse */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
          <div className="flex items-center text-[11px] text-white/80 gap-2">
            <div className="w-6 h-6 rounded-full bg-white/10 text-white border border-white/20 flex items-center justify-center text-[10px] font-semibold">
              {getInitials(patient.assignedNurse)}
            </div>
            <span className="truncate">{patient.assignedNurse}</span>
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
                        {patient.age}y, {patient.gender === 'M' ? 'Male' : 'Female'}
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
                    <span className="text-xs text-white">
                      {parseDateSafe(patient.lastHandover).toLocaleString()}
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
                {/* Submission History */}
                <div className="pt-2 border-t border-white/10">
                  <label className="text-[10px] font-medium text-white/80 uppercase tracking-wide">
                    Submission History
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

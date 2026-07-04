// Patient detail page - full patient view with history and handover options
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { EthiopianDateDisplay, IsbarLoader } from '../../components/shared';
import { gregorianToEthiopian, formatEthiopianDate } from '../../utils/ethiopianCalendar';
import {
  Bed, User, Clock, AlertTriangle, CheckCircle, Heart, Activity,
  ChevronDown, ChevronLeft, FileText, MapPin, Shield, Calendar,
  ArrowLeft, ClipboardList, Users
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

interface PatientDetailPageProps {
  patient: PatientHandover;
  onBack: () => void;
}

const parseDateSafe = (iso: string | number | Date | null | undefined): Date => {
  if (!iso) return new Date(NaN);
  if (iso instanceof Date) return iso;
  if (typeof iso === 'number' && !isNaN(iso)) {
    return iso < 1e12 ? new Date(iso * 1000) : new Date(iso);
  }
  const s = String(iso).trim();
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return n < 1e12 ? new Date(n * 1000) : new Date(n);
  }
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    return new Date(s.replace(' ', 'T'));
  }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?/);
  if (m) {
    const [, y, mo, da, h, mi, se, frac] = m;
    const ms = frac ? Math.round(Number('0.' + frac) * 1000) : 0;
    return new Date(Number(y), Number(mo) - 1, Number(da), Number(h), Number(mi), Number(se || '0'), ms);
  }
  const direct = new Date(s.replace(' ', 'T'));
  if (!isNaN(direct.getTime())) return direct;
  const withZ = new Date((s.replace(' ', 'T')) + 'Z');
  if (!isNaN(withZ.getTime())) return withZ;
  return new Date(NaN);
};

const timeAgo = (iso: string | number | Date | null | undefined) => {
  try {
    const dt = parseDateSafe(iso);
    if (isNaN(dt.getTime())) return 'Just now';
    const now = Date.now();
    if (dt.getTime() - now > 60 * 1000) {
      const alt = parseDateSafe(String(iso) + 'Z');
      if (!isNaN(alt.getTime()) && alt.getTime() <= now) return timeAgo(alt);
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

export const PatientDetailPage: React.FC<PatientDetailPageProps> = ({ patient, onBack }) => {
  const { user } = useAuth();
  const [submissionHistory, setSubmissionHistory] = useState<Record<string, unknown>[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number>(0);

  const matchesPatient = useCallback((fd: Record<string, unknown>) => {
    const mrnCandidates = [fd?.mrn, fd?.MRN, fd?.['MRN'], fd?._mrn, fd?.patient_mrn, fd?.patientMrn];
    const mrnMatch = mrnCandidates.some((v) => v !== undefined && String(v).trim() === String(patient.mrn).trim());
    if (mrnMatch) return true;
    const nameCandidates = [fd?.patientName, fd?.['Patient name'], fd?.patient_name];
    const nameMatch = nameCandidates.some((v) => v !== undefined && String(v).trim().toLowerCase() === String(patient.patientName).trim().toLowerCase());
    return nameMatch;
  }, [patient.mrn, patient.patientName]);

  const loadHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const res = await fetch('/api/form-submissions');
      const data: Record<string, unknown>[] = res.ok ? await res.json() : [];
      const isExcluded = (name: unknown) => {
        const n = String(name || '').toLowerCase();
        return n.includes('round') || n.includes('audit');
      };
      const filtered = (data || []).filter((s: Record<string, unknown>) => {
        const fd = (s?.form_data as Record<string, unknown>) || {};
        return matchesPatient(fd) && !isExcluded(s?.template_name);
      }).sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        new Date(b.submitted_at as string).getTime() - new Date(a.submitted_at as string).getTime()
      );
      setSubmissionHistory(filtered);
      setExpandedIdx(0);
    } catch {
      setSubmissionHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [matchesPatient]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const fd = patient.formData || {};
  const labels = patient.fieldLabels || {};

  const findVal = (keys: string[]): unknown => {
    for (const k of keys) {
      if (fd[k] !== undefined && fd[k] !== null && fd[k] !== '') return fd[k];
      // Try case-insensitive
      const ci = Object.keys(fd).find(fk => fk.toLowerCase() === k.toLowerCase());
      if (ci && fd[ci] !== undefined && fd[ci] !== null && fd[ci] !== '') return fd[ci];
    }
    return '';
  };

  const pretty = (key: string) => {
    if (labels[key]) return labels[key];
    return key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const renderValue = (val: unknown) => {
    if (Array.isArray(val)) return val.join(', ');
    if (typeof val === 'object' && val !== null) return JSON.stringify(val);
    return String(val);
  };

  const getStabilityColor = (s: string) => {
    const n = String(s || '').toLowerCase();
    if (n === 'critical') return 'text-red-600 bg-red-50 border-red-200';
    if (n === 'unstable' || n === 'subcritical') return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  const getStabilityIcon = (s: string) => {
    const n = String(s || '').toLowerCase();
    if (n === 'critical') return <AlertTriangle className="w-5 h-5 text-red-500" />;
    if (n === 'unstable' || n === 'subcritical') return <Activity className="w-5 h-5 text-amber-500" />;
    return <CheckCircle className="w-5 h-5 text-green-500" />;
  };

  const firstSub = submissionHistory && submissionHistory.length > 0
    ? submissionHistory[submissionHistory.length - 1]
    : null;
  const totalHandovers = submissionHistory?.length || 0;

  // Unique handover contributors
  const uniqueContributors = submissionHistory
    ? Array.from(new Set(submissionHistory.map(s => String(s.submitted_by_name || s.submitted_by || 'Unknown'))))
    : [];

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStabilityColor(patient.stability)}`}>
          {patient.stability.charAt(0).toUpperCase() + patient.stability.slice(1)}
        </span>
      </div>
        {/* Patient Header Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-[#003153] to-[#004a7c] px-6 py-5 text-white">
            <div className="flex items-center gap-5">
              {/* Patient Avatar - profile placeholder */}
              <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center shrink-0 overflow-hidden">
                <svg viewBox="0 0 200 200" className="w-14 h-14" xmlns="http://www.w3.org/2000/svg">
                  {/* Background circle */}
                  <circle cx="100" cy="100" r="98" fill="#9ca3af" />
                  {/* Hair / head */}
                  <ellipse cx="100" cy="70" rx="45" ry="48" fill="#6b7280" />
                  {/* Ears */}
                  <ellipse cx="58" cy="80" rx="8" ry="14" fill="#6b7280" />
                  <ellipse cx="142" cy="80" rx="8" ry="14" fill="#6b7280" />
                  {/* Neck */}
                  <rect x="82" y="108" width="36" height="28" rx="8" fill="#9ca3af" />
                  {/* Shoulders / clothing */}
                  <path d="M20 200c0-35 25-55 55-60 5-1 10 3 15 5s10 5 20 5 15-3 20-5 10-6 15-5c30 5 55 25 55 60" fill="#6b7280" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold tracking-tight">{patient.patientName}</h1>
                <div className="flex items-center gap-3 mt-2 text-sm text-white/80">
                  <span className="flex items-center gap-1"><Bed className="w-4 h-4" /> Bed {patient.bedNumber}</span>
                  <span className="flex items-center gap-1"><FileText className="w-4 h-4" /> MRN {patient.mrn}</span>
                  <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {patient.department}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {getStabilityIcon(patient.stability)}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100 border-b border-gray-100">
            <div className="px-4 py-3 text-center">
              <div className="text-xs text-gray-500 font-medium">Age / Gender</div>
              <div className="text-sm font-semibold text-gray-900 mt-0.5">
                {findVal(['age', 'Age']) || patient.age || '—'}
                {(() => {
                  const g = findVal(['gender', 'sex', 'Gender']);
                  return g ? `, ${String(g).charAt(0).toUpperCase() === 'M' ? 'Male' : 'Female'}` : '';
                })()}
              </div>
            </div>
            <div className="px-4 py-3 text-center">
              <div className="text-xs text-gray-500 font-medium">Diagnosis</div>
              <div className="text-sm font-semibold text-gray-900 mt-0.5 truncate" title={patient.diagnosis}>
                {patient.diagnosis || '—'}
              </div>
            </div>
            <div className="px-4 py-3 text-center">
              <div className="text-xs text-gray-500 font-medium">Last Handover</div>
              <div className="text-sm font-semibold text-gray-900 mt-0.5" title={(() => {
                const d = parseDateSafe(patient.lastHandover);
                if (isNaN(d.getTime())) return '';
                const eth = gregorianToEthiopian(d);
                return formatEthiopianDate(eth, 'long');
              })()}>
                {timeAgo(patient.lastHandover)}
              </div>
            </div>
            <div className="px-4 py-3 text-center">
              <div className="text-xs text-gray-500 font-medium">Assigned Nurse</div>
              <div className="text-sm font-semibold text-gray-900 mt-0.5 truncate">
                {patient.assignedNurse || '—'}
              </div>
            </div>
          </div>

          {/* Assigned clinicians */}
          {(patient.assignedPhysician || patient.assignedMidwife) && (
            <div className="px-6 py-3 flex items-center gap-4 text-sm text-gray-600 border-b border-gray-100">
              <Users className="w-4 h-4 text-gray-400" />
              {patient.assignedPhysician && <span>Physician: <strong>{patient.assignedPhysician}</strong></span>}
              {patient.assignedMidwife && <span>Midwife: <strong>{patient.assignedMidwife}</strong></span>}
            </div>
          )}
        </div>

        {/* Registration & Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* First Registration */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-indigo-500" />
              <h3 className="text-sm font-semibold text-gray-900">First Registered</h3>
            </div>
            {firstSub ? (
              <div>
                <div className="text-lg font-bold text-gray-900">
                  <EthiopianDateDisplay date={parseDateSafe(firstSub.submitted_at as string)} format="long" />
                </div>
                <div className="text-xs text-gray-500 mt-1">{timeAgo(firstSub.submitted_at as string)}</div>
                <div className="text-xs text-gray-500 mt-1">
                  by {String(firstSub.submitted_by_name || firstSub.submitted_by || 'Unknown')}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-400">Loading...</div>
            )}
          </div>

          {/* Handover Stats */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList className="w-5 h-5 text-indigo-500" />
              <h3 className="text-sm font-semibold text-gray-900">Handover Summary</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total handovers</span>
                <span className="font-semibold text-gray-900">{totalHandovers}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Unique contributors</span>
                <span className="font-semibold text-gray-900">{uniqueContributors.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Current status</span>
                <span className={`font-semibold ${patient.stability === 'critical' ? 'text-red-600' : patient.stability === 'unstable' ? 'text-amber-600' : 'text-green-600'}`}>
                  {patient.stability.charAt(0).toUpperCase() + patient.stability.slice(1)}
                </span>
              </div>
            </div>
          </div>

          {/* Contributors */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-indigo-500" />
              <h3 className="text-sm font-semibold text-gray-900">Handover Contributors</h3>
            </div>
            <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
              {uniqueContributors.length > 0 ? uniqueContributors.map((name, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold shrink-0">
                    {name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-gray-700 truncate">{name}</span>
                </div>
              )) : (
                <div className="text-sm text-gray-400">No records yet</div>
              )}
            </div>
          </div>
        </div>

        {/* Handover Timeline */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-500" />
              <h2 className="text-base font-semibold text-gray-900">Handover Timeline</h2>
            </div>
            <span className="text-xs text-gray-500">{totalHandovers} records</span>
          </div>

          <div className="p-6">
            {loadingHistory ? (
              <div className="py-8 flex justify-center">
                <IsbarLoader message="Loading handover history..." size={64} />
              </div>
            ) : !submissionHistory || submissionHistory.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No handover records found</p>
              </div>
            ) : (
              <div className="relative pl-8">
                {/* Vertical timeline line */}
                <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-200" />

                {submissionHistory.map((sub: Record<string, unknown>, idx: number) => {
                  const subFd = (sub.form_data as Record<string, unknown>) || {};
                  const entries = Object.entries(subFd).filter(([, v]) => v !== undefined && v !== null && v !== '');
                  const isOpen = expandedIdx === idx;
                  const submitterName = String(sub.submitted_by_name || sub.submitted_by || 'Unknown');
                  const stabilityField = subFd.stability || subFd.patientStatus || subFd.patientCondition || subFd['Patient Stability'] || subFd['Patient Condition'];
                  const isMostRecent = idx === 0;

                  return (
                    <div key={sub.id as string || idx} className="relative mb-4">
                      {/* Timeline dot */}
                      <div className={`absolute -left-8 top-4 w-4 h-4 rounded-full border-2 z-10 ${
                        isMostRecent ? 'bg-indigo-500 border-indigo-400 ring-4 ring-indigo-100' :
                        isOpen ? 'bg-indigo-400 border-indigo-300' : 'bg-white border-gray-300'
                      }`} />

                      {/* Card */}
                      <div
                        className={`rounded-xl border transition-all cursor-pointer ${
                          isOpen
                            ? 'bg-white border-indigo-200 shadow-md'
                            : 'bg-gray-50 border-gray-200 hover:bg-white hover:border-gray-300 hover:shadow-sm'
                        }`}
                        onClick={() => setExpandedIdx(isOpen ? -1 : idx)}
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              isMostRecent ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                              #{submissionHistory.length - idx}
                            </span>
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold shrink-0">
                              {submitterName.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">{submitterName}</div>
                              <div className="text-xs text-gray-500">
                                <EthiopianDateDisplay date={parseDateSafe(sub.submitted_at as string)} format="short" />
                                <span className="ml-2 text-gray-400">{timeAgo(sub.submitted_at as string)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {stabilityField && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                String(stabilityField).toLowerCase() === 'critical' ? 'bg-red-100 text-red-700' :
                                String(stabilityField).toLowerCase() === 'unstable' || String(stabilityField).toLowerCase() === 'subcritical'
                                  ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                              }`}>
                                {String(stabilityField)}
                              </span>
                            )}
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                          </div>
                        </div>

                        {/* Expanded content */}
                        {isOpen && (
                          <div className="px-5 pb-5 pt-2 border-t border-gray-100">
                            <div className="text-xs text-gray-400 mb-3 flex items-center gap-2">
                              <FileText className="w-3 h-3" />
                              {sub.template_name as string || 'Submission'} • <EthiopianDateDisplay date={parseDateSafe(sub.submitted_at as string)} format="long" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                              {entries.map(([k, v]) => (
                                <div key={k} className="flex items-start justify-between py-1.5 border-b border-gray-50">
                                  <span className="text-xs text-gray-500 mr-2 shrink-0 max-w-[45%]">{pretty(k)}</span>
                                  <span className="text-xs text-gray-900 text-right break-words max-w-[55%]">{renderValue(v)}</span>
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
            )}
          </div>
        </div>
    </div>
  );
};

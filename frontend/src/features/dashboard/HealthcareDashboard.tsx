// Main dashboard - displays hospital overview with patients, staff, resources, and activity
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useShift } from '../../hooks/useShift';
import { useSearch } from '../../hooks/useSearch';
import { useAI } from '../../hooks/useAI';
import { ExpandablePatientCard } from '../patients';
import { PatientDetailPage } from '../patients/PatientDetailPage';
import { IsbarLoader, DashboardSection } from '../../components/shared';
import { DepartmentStaffPanel } from '../staff';
import { EthiopianDateDisplay } from '../../components/shared/date/EthiopianDateDisplay';
import {
  Bed,
  Clock,
  Package,
  Activity,
  Plus,
  Minus,
  ChevronDown,
  ChevronRight,
  Flag,
  AlertTriangle,
  MinusCircle,
  Shield,
  Sparkles
} from 'lucide-react';
import { DepartmentActivityTimeline, ShiftActivityPanel } from '../shifts';

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
  form_template_id?: number | string;
  formTemplateName?: string;
  form_template_name?: string;
  department: string;
  dashboardType?: 'patient' | 'resource';
  dashboard_type?: 'patient' | 'resource';
  displayName?: string;
  display_name?: string;
  cardFields?: {
    primary?: string;
    secondary?: string;
    status?: string;
    identifier?: string;
  };
  card_fields?: {
    primary?: string;
    secondary?: string;
    status?: string;
    identifier?: string;
  };
  groupByField?: string;
  group_by_field?: string;
  isEnabled?: boolean;
  is_enabled?: boolean;
  sortOrder?: number;
  sort_order?: number;
  current_template_name?: string;
  template_is_active?: boolean;
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

export const HealthcareDashboard: React.FC = () => {
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

  const { user, getUserDepartmentFilter, impersonate, activeOperator, setActiveOperator } = useAuth();
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
  const [recentAuditsByMrn, setRecentAuditsByMrn] = useState<Record<string, Record<string, unknown>[]>>({});
  const [handoverBriefing, setHandoverBriefing] = useState<HandoverBriefing | null>(null);
  const { activeSession } = useShift();
  const { ask, loading: aiLoading, online } = useAI();
  const [aiInsights, setAiInsights] = useState<{ text: string, timestamp: Date } | null>(null);

  const [openMrn, setOpenMrn] = useState<string | null>(null);
  const [expandAll, setExpandAll] = useState(false);
  const [mostRecentShift, setMostRecentShift] = useState<'Morning' | 'Evening' | 'Night' | null>(null);
  const [mostRecentRoundShift, setMostRecentRoundShift] = useState<'Morning' | 'Evening' | 'Night' | null>(null);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [impersonateUserId, setImpersonateUserId] = useState<string>('');
  const [patientMappings, setPatientMappings] = useState<DashboardMapping[]>([]);
  const [resourceMappings, setResourceMappings] = useState<DashboardMapping[]>([]);
  const [filterDept, setFilterDept] = useState<string>('');
  const [filterUser, setFilterUser] = useState<string>('');
  const [timeWindow, setTimeWindow] = useState<'8' | '16' | '24'>('24');

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
          const nameMatch = (m.formTemplateName || m.form_template_name) && sub.template_name && String(m.formTemplateName || m.form_template_name).toLowerCase() === String(sub.template_name).toLowerCase();
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

      // Fetch latest handover briefing for active session
      if (activeSession && user) {
        try {
          const resBriefing = await fetch(`/api/shifts/handover/${encodeURIComponent(activeSession.ward)}/${encodeURIComponent(user.profession || user.role)}`);
          if (resBriefing.ok) {
            const data = await resBriefing.json();
            if (data && data.handover_data) {
              setHandoverBriefing({
                ...data.handover_data,
                created_at: data.created_at,
                predecessor_name: data.from_username // Should probably add this to the API response or join it
              });
            } else {
              setHandoverBriefing(null);
            }
          }
        } catch (err) {
          console.error("Failed to fetch handover briefing:", err);
        }
      }

      let patientRaw: DashboardMapping[] = [];
      let resourceRaw: DashboardMapping[] = [];
      if (departmentFilter) {
        const prof = user?.profession ? `?profession=${encodeURIComponent(user.profession)}` : '';
        const [resPatient, resResource] = await Promise.all([
          fetch(`/api/dashboard-mappings/by-department/${encodeURIComponent(departmentFilter)}/patient${prof}`),
          fetch(`/api/dashboard-mappings/by-department/${encodeURIComponent(departmentFilter)}/resource${prof}`),
        ]);
        patientRaw = resPatient.ok ? await resPatient.json() : [];
        resourceRaw = resResource.ok ? await resResource.json() : [];
      } else {
        const res = await fetch('/api/dashboard-mappings');
        const all = res.ok ? await res.json() : [];
        const isEnabled = (m: DashboardMapping) => (typeof m.is_enabled === 'boolean' ? m.is_enabled : m.isEnabled) !== false;
        const isActiveTemplate = (m: DashboardMapping) => (typeof m.template_is_active === 'boolean' ? m.template_is_active : true);
        patientRaw = (all || []).filter((m: DashboardMapping) => {
          const type = m.dashboard_type || m.dashboardType;
          return type === 'patient' && isEnabled(m) && isActiveTemplate(m);
        });
        resourceRaw = (all || []).filter((m: DashboardMapping) => {
          const type = m.dashboard_type || m.dashboardType;
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
          cardFields: m.cardFields || m.card_fields || {},
        } as DashboardMapping;
      });

      const patientMappingsNormalized = normalize(patientRaw);
      const resourceMappingsNormalized = normalize(resourceRaw);

      setPatientMappings(patientMappingsNormalized);
      setResourceMappings(resourceMappingsNormalized);

      let submissionsUrl = '/api/form-submissions';
      const subsParams: string[] = [];
      if (departmentFilter) subsParams.push(`department=${encodeURIComponent(departmentFilter)}`);
      if (user?.profession) subsParams.push(`profession=${encodeURIComponent(user.profession)}`);
      if (subsParams.length) submissionsUrl += `?${subsParams.join('&')}`;

      const [submissionsRes, resourcesRes, reportsRes] = await Promise.all([
        fetch(submissionsUrl),
        fetch('/api/resources'),
        fetch(`/api/inventory-reports${departmentFilter ? `?department=${encodeURIComponent(departmentFilter)}` : ''}`)
      ]);

      let submissions = submissionsRes.ok ? await submissionsRes.json() : [];

      if ((departmentFilter && (!Array.isArray(submissions) || submissions.length === 0))) {
        try {
          const allRes = await fetch('/api/form-submissions');
          const allSubs = allRes.ok ? await allRes.json() : [];
          const allowedTemplateIds = new Set(
            (patientMappingsNormalized || [])
              .map(m => m.formTemplateId ?? (m as DashboardMapping).form_template_id)
              .filter((v) => v !== undefined && v !== null)
              .map((v) => String(v))
          );
          const allowedTemplateNames = new Set(
            (patientMappingsNormalized || [])
              .map(m => m.formTemplateName ?? (m as DashboardMapping).form_template_name)
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

      const resources = resourcesRes.ok ? await resourcesRes.json() : [];
      const reports = reportsRes.ok ? await reportsRes.json() : [];

      const roundMappings = ([...(patientMappingsNormalized || []), ...(resourceMappingsNormalized || [])]).filter((m: DashboardMapping) => {
        const ident = String((m as any).identifier || '').trim().toLowerCase();
        const disp = String(m.displayName || m.display_name || '').trim().toLowerCase();
        const tname = String(m.formTemplateName || (m as DashboardMapping).form_template_name || '').trim().toLowerCase();
        return ident === 'round' || disp === 'round' || tname.includes('round');
      });
      setRoundMappedTemplates(roundMappings.map((m: DashboardMapping) => m.formTemplateName ?? (m as DashboardMapping).form_template_name ?? 'Unnamed'));

      const roundTemplateIdSet = new Set(
        roundMappings
          .map((m: DashboardMapping) => m.formTemplateId ?? (m as DashboardMapping).form_template_id)
          .filter((v) => v !== undefined && v !== null)
          .map((v) => String(v))
      );
      const roundTemplateNameSet = new Set(
        roundMappings
          .map((m: DashboardMapping) => m.formTemplateName ?? (m as DashboardMapping).form_template_name)
          .filter((v) => !!v)
          .map((v) => String(v).toLowerCase())
      );

      // Only keep submissions that correspond to mapped patient templates
      const allowedTemplateIds = new Set(
        (patientMappingsNormalized || [])
          .map(m => m.formTemplateId ?? (m as DashboardMapping).form_template_id)
          .filter((v) => v !== undefined && v !== null)
          .map((v) => String(v))
      );
      const allowedTemplateNames = new Set(
        (patientMappingsNormalized || [])
          .map(m => m.formTemplateName ?? (m as DashboardMapping).form_template_name)
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
          staffName: (r.staff_name || r.staffName || 'Unknown') as string,
          date: (r.date || r.created_at || r.updated_at) as string,
          resources: (r.resources || []) as unknown[]
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
        const existing = byShift[shiftName][0];
        if (!existing) {
          byShift[shiftName] = [reportData];
        } else {
          const dNew = parseDateSafe(reportData.date);
          const dOld = parseDateSafe(existing.date);
          if (dNew > dOld) byShift[shiftName] = [reportData];
        }
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

          const sixteenHoursAgo = new Date(Date.now() - 16 * 60 * 60 * 1000);
          return parseDateSafe(submissionDate) > sixteenHoursAgo;
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
            const nameMatch = (m.formTemplateName || (m as DashboardMapping).form_template_name) && sub.template_name && String(m.formTemplateName || (m as DashboardMapping).form_template_name).toLowerCase() === String(sub.template_name).toLowerCase();
            return idMatch || nameMatch;
          });
          const labelMap = mapping ? (mapping as DashboardMapping).__labelMap : {};
          const agenda = Object.entries(fd)
            .filter(([k, v]) => {
              const val = Array.isArray(v) ? v.join(', ').trim() : String(v ?? '').trim();
              if (!val) return false;
              const skipKeys = new Set(['id', 'patientId', 'patientName', 'mrn', 'bed', 'bedNumber', 'stability', 'department', 'submitted_by', 'submitted_by_name', 'created_at', 'updated_at'].map(s => s.toLowerCase()));
              return !skipKeys.has(String(k).toLowerCase());
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

      // Build Senior Chart Audit list (last 24 hours), grouped by MRN, for department-scoped view
      const auditMappings = ([...(patientMappingsNormalized || []), ...(resourceMappingsNormalized || [])]).filter((m: DashboardMapping) => {
        const ident = String((m as any).identifier || '').trim().toLowerCase();
        const disp = String(m.displayName || m.display_name || '').trim().toLowerCase();
        const tname = String(m.formTemplateName || (m as DashboardMapping).form_template_name || '').trim().toLowerCase();
        const hay = `${ident} ${disp} ${tname}`;
        return hay.includes('audit') || hay.includes('senior chart') || hay.includes('chart audit') || hay.includes('sca');
      });
      {
        // IMPORTANT: The main submissions fetch may include a profession filter (e.g., GP),
        // which would exclude Senior-submitted audits. To avoid that, build a pool for audits
        // that is department-scoped but NOT profession-scoped.
        let auditPool: Record<string, unknown>[] = submissions || [];
        const deptFilterRaw = getUserDepartmentFilter();
        const hadProfessionFilter = !!user?.profession;
        try {
          if (deptFilterRaw) {
            const auditUrl = `/api/form-submissions?department=${encodeURIComponent(deptFilterRaw)}`;
            const resAudit = await fetch(auditUrl);
            if (resAudit.ok) {
              const deptSubs = await resAudit.json();
              if (Array.isArray(deptSubs) && deptSubs.length >= (auditPool?.length || 0)) {
                auditPool = deptSubs;
              }
            }
          } else if (hadProfessionFilter) {
            // No explicit department, but we still want a broader pool without profession filter
            const resAll = await fetch('/api/form-submissions');
            if (resAll.ok) {
              const all = await resAll.json();
              if (Array.isArray(all) && all.length >= (auditPool?.length || 0)) {
                auditPool = all;
              }
            }
          }
        } catch {
          // ignore audit pool broadening failures; fall back to existing submissions
        }
        const auditTemplateIdSet = new Set(
          auditMappings
            .map((m: DashboardMapping) => m.formTemplateId ?? (m as DashboardMapping).form_template_id)
            .filter((v) => v !== undefined && v !== null)
            .map((v) => String(v))
        );
        const auditTemplateNameSet = new Set(
          auditMappings
            .map((m: DashboardMapping) => m.formTemplateName ?? (m as DashboardMapping).form_template_name)
            .filter((v) => !!v)
            .map((v) => String(v).toLowerCase())
        );
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const bestDate = (s: Record<string, unknown>): string => (s?.submitted_at || s?.submittedAt || s?.date || s?.updated_at || s?.created_at || s?.updatedAt) as string;
        // Reuse dept filter, possibly overridden for GP to mirror Senior dept
        let deptFilter = deptFilterRaw;
        if (user?.profession === 'General Practitioner') {
          const seniors = (allUsers || []).filter(u => u.profession === 'Senior Physician' && u.department);
          // Prefer a senior whose dept matches GP's own dept; otherwise take the first senior's dept
          const match = seniors.find(s => String(s.department || '').toLowerCase() === String(deptFilterRaw || '').toLowerCase());
          const seniorDept = (match?.department || seniors[0]?.department || deptFilterRaw) ?? null;
          deptFilter = seniorDept;
        }
        const normDept = (x: unknown) => String(x ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
        // Compute all audits in last 24h regardless of department (for debug)
        const auditSubsAll = (auditPool || []).filter((s: Record<string, unknown>) => {
          const tid = s.template_id != null ? String(s.template_id) : null;
          const tname = s.template_name ? String(s.template_name).toLowerCase() : null;
          const nameHasAudit = !!(tname && (tname.includes('audit') || tname.includes('senior chart') || tname.includes('chart audit') || tname.includes('sca')));
          const templateMatch = (tid && auditTemplateIdSet.has(tid)) || (tname && auditTemplateNameSet.has(tname)) || nameHasAudit;
          if (!templateMatch) return false;
          const dStr = bestDate(s);
          if (!dStr) return false;
          const d = parseDateSafe(dStr);
          if (!(d > twentyFourHoursAgo)) return false;
          return true;
        });
        const auditSubs = auditSubsAll.filter((s: Record<string, unknown>) => {
          if (!deptFilter) return true;
          const fd = (s.form_data as Record<string, unknown>) || {};
          const mapping = auditMappings.find((m: DashboardMapping) => {
            const idMatch = m.formTemplateId != null && s.template_id != null && String(m.formTemplateId) === String(s.template_id);
            const nameMatch = (m.formTemplateName || (m as DashboardMapping).form_template_name) && s.template_name && String(m.formTemplateName || (m as DashboardMapping).form_template_name).toLowerCase() === String(s.template_name).toLowerCase();
            return idMatch || nameMatch;
          });
          const labelMap = mapping ? (mapping as DashboardMapping).__labelMap : {};
          const subDept = (s as any).template_department || (s as any).department || getByKeySmart(fd, 'department', labelMap) || (fd as any).department || '';
          return normDept(subDept) === normDept(deptFilter);
        });
        // Group by MRN
        const grouped: Record<string, Record<string, unknown>[]> = {};
        auditSubs.forEach((s: Record<string, unknown>) => {
          const fd = (s.form_data as Record<string, unknown>) || {};
          const mapping = auditMappings.find((m: DashboardMapping) => {
            const idMatch = m.formTemplateId != null && s.template_id != null && String(m.formTemplateId) === String(s.template_id);
            const nameMatch = (m.formTemplateName || (m as DashboardMapping).form_template_name) && s.template_name && String(m.formTemplateName || (m as DashboardMapping).form_template_name).toLowerCase() === String(s.template_name).toLowerCase();
            return idMatch || nameMatch;
          });
          const labelMap = mapping ? (mapping as DashboardMapping).__labelMap : {};
          const mrn = (getByKeySmart(fd, 'mrn', labelMap) || fd.mrn || fd.MRN || fd['MRN'] || 'N/A') as string;
          const key = String(mrn || 'N/A');
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(s);
        });
        // Sort each MRN group by date desc
        Object.values(grouped).forEach((arr) => arr.sort((a, b) => parseDateSafe(bestDate(b)).getTime() - parseDateSafe(bestDate(a)).getTime()));
        // Remove groups with missing MRN
        const cleaned: Record<string, Record<string, unknown>[]> = {};
        Object.entries(grouped).forEach(([k, v]) => {
          const kk = String(k || '').trim();
          if (!kk || kk.toLowerCase() === 'n/a' || kk === 'undefined' || kk === 'null') return;
          cleaned[kk] = v;
        });
        setRecentAuditsByMrn(cleaned);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, allUsers, getUserDepartmentFilter, filterDept, processPatientHandovers]);

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
    return <IsbarLoader overlay message="Loading ISBAR Dashboard..." size={96} />;
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
              <button
                onClick={async () => {
                  if (aiLoading) return;
                  try {
                    const dataToAnalyze = {
                      patients: visiblePatients.map(p => ({ name: p.patientName, stability: p.stability, diagnosis: p.diagnosis, department: p.department })),
                      briefing: handoverBriefing
                    };
                    const res = await ask('shift-insights', dataToAnalyze);
                    setAiInsights({ text: res.text, timestamp: new Date() });
                  } catch (err) {
                    console.error('Failed to generate insights', err);
                  }
                }}
                disabled={aiLoading}
                className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors disabled:opacity-50"
              >
                <Sparkles size={14} />
                {aiLoading ? 'Analyzing...' : 'AI Insights'}
              </button>
              <div className="text-sm font-medium opacity-90">
                Briefing from: {new Date(handoverBriefing.created_at).toLocaleString()}
              </div>
            </div>
          </div>

          {aiInsights && (
            <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-800 font-bold">
                  <Sparkles size={16} />
                  <span>AI Shift Insights</span>
                  {!online && <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded uppercase tracking-wider ml-2">Offline Mode</span>}
                </div>
                <button onClick={() => setAiInsights(null)} className="text-indigo-400 hover:text-indigo-600 text-xs">Dismiss</button>
              </div>
              <p className="text-sm text-indigo-900 whitespace-pre-wrap leading-relaxed">{aiInsights.text}</p>
            </div>
          )}

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

      {/* Embedded Department Staff Check-in Panel */}
      <DepartmentStaffPanel />

      {
        user?.role === 'admin' && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex flex-col md:flex-row md:items-end gap-3">
              <div className="flex-1 min-w-[240px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">Log in as</label>
                <select
                  value={impersonateUserId}
                  onChange={e => setImpersonateUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="">Select a user…</option>
                  {allUsers.map((u: User) => (
                    <option key={u.id} value={String(u.id)}>
                      {u.name || u.username} {u.department ? `• ${u.department}` : ''} {u.role ? `• ${u.role}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (!impersonateUserId || !setActiveOperator) return;
                    const targetLocal = allUsers.find(u => String(u.id) === String(impersonateUserId));
                    if (targetLocal) {
                      setActiveOperator(targetLocal);
                    }
                  }}
                  disabled={!impersonateUserId}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
                  title="Operate as this user in the background (Nested mode)"
                >
                  Set Operator
                </button>
                <button
                  onClick={async () => {
                    if (!impersonateUserId || !impersonate) return;
                    const ok = await impersonate({ userId: impersonateUserId });
                    if (ok) {
                      window.location.reload();
                    }
                  }}
                  disabled={!impersonateUserId}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700"
                  title="Fully log in as this user and swap out permissions (True Login)"
                >
                  Full Login As...
                </button>
                <button
                  onClick={() => {
                    setImpersonateUserId('');
                    if (setActiveOperator) setActiveOperator(null);
                  }}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Clear Operator
                </button>
              </div>
            </div>
          </div>
        )
      }
      {
        user?.role === 'admin' && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
                <select
                  value={filterDept}
                  onChange={e => setFilterDept(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="">All Departments</option>
                  {departmentOptions.map(dep => (
                    <option key={dep} value={String(dep)}>{String(dep)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">User</label>
                <select
                  value={filterUser}
                  onChange={e => setFilterUser(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="">All Users</option>
                  {userOptions.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Time Window</label>
                <select
                  value={timeWindow}
                  onChange={e => setTimeWindow(e.target.value as '8' | '16' | '24')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="8">Last 8 hours</option>
                  <option value="16">Last 16 hours</option>
                  <option value="24">Last 24 hours</option>
                </select>
              </div>
              <div className="flex gap-2 md:justify-end">
                <button
                  onClick={() => { setFilterDept(''); setFilterUser(''); setTimeWindow('24'); setShift('All'); }}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        )
      }

      <DashboardSection
        title={`${(patientMappings.length === 1 ? (patientMappings[0].displayName || patientMappings[0].display_name || 'Patients') : 'Active Patients')} (${visiblePatients.length})`}
        icon={<Bed className="w-5 h-5 text-blue-600" />}
        actions={patients.length > 0 ? (
          <button
            onClick={toggleExpandAll}
            className="text-gray-600 hover:text-gray-800 text-sm font-medium py-2 px-3 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors flex items-center"
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visiblePatients.map((patient) => (
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
        )}
      </DashboardSection>

      {
        (resourceMappings.length > 0 && (
          user?.role === 'admin' ||
          user?.profession === 'Nurse' ||
          user?.profession === 'Midwifery'
        )) && (
          <DashboardSection
            title={(resourceMappings.length === 1 ? (resourceMappings[0].displayName || resourceMappings[0].display_name || 'Resources') : 'Resource Handover Status')}
            icon={<Package className="w-5 h-5 text-green-600" />}
            actions={(
              <button
                onClick={() => window.location.href = '#/resources'}
                className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Update Inventory
              </button>
            )}
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
                      <span>{new Date(resource.lastUpdated).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </DashboardSection>
        )
      }

      {
        isNurseOrMidwife ? (
          <ShiftActivityPanel
            shiftContext={shiftContext}
            reportsByShift={reportsByShift}
            roundsByShift={roundsByShift}
            roundMappedTemplates={roundMappedTemplates}
            mostRecentShift={mostRecentShift}
            mostRecentRoundShift={mostRecentRoundShift}
          />
        ) : null
      }
      <DashboardSection
        title="Ward Activity & Individual Monitoring"
        icon={<Activity className="w-5 h-5 text-purple-600" />}
        collapsible
        defaultCollapsed
      >
        <DepartmentActivityTimeline />
      </DashboardSection>
    </div>
  );
};

export default HealthcareDashboard;

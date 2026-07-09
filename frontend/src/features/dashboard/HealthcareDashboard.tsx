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
import { EthiopianDateTimeDisplay } from '../../components/shared/date/EthiopianDateTimeDisplay';
import {
  Bed,
  Clock,
  Package,
  Activity,
  Plus,
  Minus,
  ChevronDown,
  ChevronRight,
  X,
  Flag,
  AlertTriangle,
  MinusCircle,
  Shield,
  Sparkles,
  Tag,
  ClipboardCheck,
  LayoutGrid,
  Stethoscope,
  Users,
  Brain
} from 'lucide-react';
import { DepartmentActivityTimeline, ShiftActivityPanel } from '../shifts';
import { AIPatientDashboard } from '../ai/AIPatientDashboard';
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
    dashboardType: 'patient' | 'resource';
    groupByField: string;
    cardFields: {
      primary: string;
      secondary: string;
      status: string;
      identifier: string;
      nurse?: string;
      extraFields?: string[];
    };
  }
  const [customTabs, setCustomTabs] = useState<CustomTab[]>(() => {
    try { return JSON.parse(localStorage.getItem('isbar_custom_tabs') || '[]'); } catch { return []; }
  });
  const [showAddTabModal, setShowAddTabModal] = useState(false);
  const [newTab, setNewTab] = useState<Partial<CustomTab>>({});
  const [availableTemplates, setAvailableTemplates] = useState<{ id: string; name: string; department: string; fields: any[]; sections: any[] }[]>([]);
  const [tabModalStep, setTabModalStep] = useState<'basic' | 'fields'>('basic');

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
        fetch(`/api/form-submissions${deptParam ? (deptParam.includes('?') ? deptParam : `?${deptParam.slice(1)}`) + (user?.profession ? `${deptParam.includes('?') ? '&' : '?'}profession=${encodeURIComponent(user.profession)}` : '') : user?.profession ? `?profession=${encodeURIComponent(user.profession)}` : ''}`),
        fetch('/api/resources'),
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
          const allRes = await fetch('/api/form-submissions');
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

      // Build Senior Chart Audit list (last 24 hours), grouped by MRN, for department-scoped view
      const auditMappings = ([...(patientMappingsNormalized || []), ...(resourceMappingsNormalized || [])]).filter((m: DashboardMapping) => {
        const ident = (m.identifier || '').trim().toLowerCase();
        const disp = (m.displayName || '').trim().toLowerCase();
        const tname = (m.formTemplateName || '').trim().toLowerCase();
        const hay = `${ident} ${disp} ${tname}`;
        return ident === 'audit' || ident === 'sca' || hay.includes('audit') || hay.includes('senior chart') || hay.includes('sca');
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
            .map((m: DashboardMapping) => m.formTemplateId)
            .filter((v) => v !== undefined && v !== null)
            .map((v) => String(v))
        );
        const auditTemplateNameSet = new Set(
          auditMappings
            .map((m: DashboardMapping) => m.formTemplateName)
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
            const nameMatch = m.formTemplateName && s.template_name && String(m.formTemplateName).toLowerCase() === String(s.template_name).toLowerCase();
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
            const nameMatch = m.formTemplateName && s.template_name && String(m.formTemplateName).toLowerCase() === String(s.template_name).toLowerCase();
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

      // Build dynamic sections for any identifier that isn't round/audit/sca/isbar or a custom tab
      const allMappingsList = [...(patientMappingsNormalized || []), ...(resourceMappingsNormalized || [])];
      let customTabNames: Set<string>;
      try { customTabNames = new Set(JSON.parse(localStorage.getItem('isbar_custom_tabs') || '[]').map((t: any) => (t.name || '').toLowerCase())); } catch { customTabNames = new Set(); }
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
        const allSubsRes = await fetch('/api/form-submissions');
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

  // Persist custom tabs to localStorage
  useEffect(() => {
    localStorage.setItem('isbar_custom_tabs', JSON.stringify(customTabs));
  }, [customTabs]);

  const openAddTabModal = async () => {
    setNewTab({
      name: '',
      displayName: '',
      templateId: '',
      templateName: '',
      department: user?.department || '',
      departments: user?.department ? [user.department] : [],
      profession: '',
      dashboardType: 'patient',
      groupByField: '',
      cardFields: { primary: '', secondary: '', status: '', identifier: '', nurse: '', extraFields: [] },
    });
    setTabModalStep('basic');
    setShowAddTabModal(true);
    try {
      const res = await fetch('/api/form-templates');
      if (res.ok) {
        const templates = await res.json();
        setAvailableTemplates((templates || []).map((t: any) => ({
          id: String(t.id),
          name: t.name || t.title || `Template ${t.id}`,
          department: t.department || '',
          fields: typeof t.fields === 'string' ? JSON.parse(t.fields) : (t.fields || []),
          sections: t.sections === null ? [] : (typeof t.sections === 'string' ? JSON.parse(t.sections) : (t.sections || [])),
        })));
      }
    } catch { /* silent */ }
  };

  const getTabFieldOptions = () => {
    const tpl = availableTemplates.find(t => t.id === newTab.templateId);
    if (!tpl) return [];
    const options: { value: string; label: string }[] = [];
    const seen = new Set<string>();
    (tpl.fields || []).forEach((field: any) => {
      const value = field?.name || field?.id || '';
      const label = field?.label || field?.name || field?.id || 'Unnamed Field';
      if (value && !seen.has(value)) { options.push({ value, label }); seen.add(value); }
      if (field?.fields && Array.isArray(field.fields)) {
        field.fields.forEach((subField: any) => {
          const sv = subField?.name || subField?.id || '';
          const sl = `${label} > ${subField?.label || subField?.name || subField?.id || 'Subfield'}`;
          if (sv && !seen.has(sv)) { options.push({ value: sv, label: sl }); seen.add(sv); }
        });
      }
    });
    return options;
  };

  const getAllDepartments = () => {
    const set = new Set<string>();
    availableTemplates.forEach(t => t.department && set.add(t.department));
    return Array.from(set).sort();
  };

  const handleAddTab = () => {
    if (!newTab.name?.trim() || !newTab.templateId) return;
    const tpl = availableTemplates.find(t => t.id === newTab.templateId);
    const tab: CustomTab = {
      id: `custom-${Date.now()}`,
      name: newTab.name.trim(),
      displayName: newTab.displayName?.trim() || newTab.name.trim(),
      templateId: newTab.templateId,
      templateName: tpl?.name || '',
      department: newTab.department || tpl?.department || '',
      departments: newTab.departments || [],
      profession: newTab.profession || '',
      dashboardType: newTab.dashboardType || 'patient',
      groupByField: newTab.groupByField || '',
      cardFields: newTab.cardFields || { primary: '', secondary: '', status: '', identifier: '', nurse: '', extraFields: [] },
    };
    setCustomTabs(prev => [...prev, tab]);
    setShowAddTabModal(false);
    setActiveTab(tab.id);
  };

  const handleRemoveTab = (tabId: string) => {
    setCustomTabs(prev => prev.filter(t => t.id !== tabId));
    if (activeTab === tabId) setActiveTab('patients');
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

      {/* Department Staff is rendered in the Active Staff tab below */}

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
                  className="px-4 py-2 rounded-lg bg-brand text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-600"
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

      {/* Tab Navigation */}
      {(() => {
        const allReports = Object.values(reportsByShift).flat().filter(Boolean);
        const allRounds = Object.values(roundsByShift).flat().filter(Boolean);
        const tabs = [
          { id: 'patients', label: 'Patients', icon: Bed, count: visiblePatients.length },
          { id: 'ai-analytics', label: 'AI Analytics', icon: Brain, count: 0 },
          { id: 'staff', label: 'Active Staff', icon: Users, count: 0 },
          ...(Object.keys(recentAuditsByMrn).length > 0 ? [{ id: 'audit', label: 'Audit', icon: ClipboardCheck, count: Object.keys(recentAuditsByMrn).length }] : []),
          ...(resourceMappings.length > 0 && (user?.role === 'admin' || user?.profession === 'Nurse' || user?.profession === 'Midwifery') ? [{ id: 'resources', label: 'Resources', icon: Package, count: resourceStatus.length }] : []),
          ...(isNurseOrMidwife && allReports.length > 0 ? [{ id: 'inventory', label: 'Inventory', icon: Package, count: allReports.length }] : []),
          ...(isNurseOrMidwife ? [{ id: 'rounds', label: 'Nursing Round', icon: Stethoscope, count: allRounds.length }] : []),
          ...Object.entries(dynamicSections).map(([ident, group]) => ({
            id: `dynamic-${ident}`,
            label: ident.charAt(0).toUpperCase() + ident.slice(1),
            icon: Tag,
            count: group.submissions.length,
          })),
          ...customTabs.map(ct => ({
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
          <div className="bg-white rounded-xl shadow-sm p-1 flex gap-1 overflow-x-auto items-center">
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
                onClick={openAddTabModal}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all whitespace-nowrap border border-dashed border-gray-300"
              >
                <Plus className="w-4 h-4" />
                <span>Add Tab</span>
              </button>
            )}
          </div>
        );
      })()}

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
                      className="px-3 py-1.5 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand-600 transition-colors"
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

      {/* Active Staff Tab */}
      {activeTab === 'staff' && (
        <DepartmentStaffPanel />
      )}

      {/* Senior Chart Audit Tab */}
      {activeTab === 'audit' && Object.keys(recentAuditsByMrn).length > 0 && (
        <DashboardSection
          title={`Senior Chart Audit (${Object.keys(recentAuditsByMrn).length} MRNs)`}
          icon={<ClipboardCheck className="w-5 h-5 text-amber-600" />}
        >
          <div className="space-y-4">
            {Object.entries(recentAuditsByMrn).map(([mrn, subs]) => (
              <div key={mrn} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setOpenMrn(openMrn === mrn ? null : mrn)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-900">MRN: {mrn}</span>
                    <span className="text-sm text-gray-500">{subs.length} audit{subs.length !== 1 ? 's' : ''}</span>
                  </div>
                  {openMrn === mrn ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                </button>
                {openMrn === mrn && (
                  <div className="p-4 space-y-3">
                    {subs.map((sub) => {
                      const fd = (sub.form_data as Record<string, unknown>) || {};
                      const bestDate = sub.submitted_at || sub.submittedAt || sub.date || sub.created_at;
                      return (
                        <div key={sub.id} className="border border-gray-100 rounded-lg p-3 bg-white">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-900">{sub.template_name as string || 'Audit'}</span>
                            <span className="text-xs text-gray-500">{bestDate ? new Date(String(bestDate)).toLocaleString() : ''}</span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {Object.entries(fd).slice(0, 8).map(([k, v]) => (
                              <div key={k} className="text-xs">
                                <span className="text-gray-500">{prettifyLabel(k)}: </span>
                                <span className="text-gray-900 font-medium">{String(v ?? '')}</span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 text-xs text-gray-400">
                            Submitted by: {sub.submitted_by_name || sub.submitted_by || 'Unknown'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </DashboardSection>
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

      {/* Inventory Tab */}
      {activeTab === 'inventory' && isNurseOrMidwife && (() => {
        const allReports = Object.values(reportsByShift).flat().filter(Boolean).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const invSearchLower = query.trim().toLowerCase();

        const resourceBadges = (item: any) => {
          const qty = Number(item.quantity ?? 0);
          const std = Number(item.standard_quantity ?? item.standard ?? NaN);
          const expiry = item.expiry_date || item.expiry;
          const badges: { label: string; cls: string; icon: React.ReactNode }[] = [];
          if (expiry) {
            const d = new Date(expiry);
            if (!isNaN(d.getTime())) {
              const now = new Date();
              const diffDays = Math.ceil((d.getTime() - now.getTime()) / 86400000);
              if (d < now) badges.push({ label: 'Expired', cls: 'bg-red-100 text-red-700', icon: <Flag className="w-3 h-3" /> });
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
          // Array format: [{ name, quantity, unit, type, ... }]
          if (Array.isArray(resources)) {
            const filtered = resources.filter(filterResource);
            if (filtered.length === 0) return invSearchLower ? <p className="text-sm text-gray-500 text-center py-4">No items match search</p> : <p className="text-sm text-gray-500 text-center py-4">No inventory items</p>;
            return (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-2 font-semibold">Name</th>
                      <th className="px-4 py-2 font-semibold">Type</th>
                      <th className="px-4 py-2 font-semibold">Qty</th>
                      <th className="px-4 py-2 font-semibold">Unit</th>
                      <th className="px-4 py-2 font-semibold">Standard</th>
                      <th className="px-4 py-2 font-semibold">Expiry</th>
                      <th className="px-4 py-2 font-semibold">Batch</th>
                      <th className="px-4 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((item: any, idx: number) => {
                      const badges = resourceBadges(item);
                      return (
                        <tr key={idx} className="hover:bg-gray-50/50">
                          <td className="px-4 py-2 font-medium text-gray-800">{item.name || '-'}</td>
                          <td className="px-4 py-2 text-gray-500">{item.type || '-'}</td>
                          <td className="px-4 py-2 font-semibold text-gray-900">{item.quantity ?? '-'}</td>
                          <td className="px-4 py-2 text-gray-500">{item.unit || '-'}</td>
                          <td className="px-4 py-2 text-gray-500">{item.standard_quantity ?? item.standard ?? '-'}</td>
                          <td className="px-4 py-2 text-gray-500">
                            {item.expiry_date || item.expiry ? (
                              <EthiopianDateDisplay date={item.expiry_date || item.expiry} format="short" />
                            ) : '-'}
                          </td>
                          <td className="px-4 py-2 text-gray-500">{item.batch_number ?? item.batch ?? '-'}</td>
                          <td className="px-4 py-2">
                            {badges.length > 0 ? (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {badges.map((b, bi) => (
                                  <span key={bi} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${b.cls}`}>
                                    <span className="mr-1">{b.icon}</span>{b.label}
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
          // Object format: { "DATABASE_URL": "67 Vial", ... }
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
        return (
          <DashboardSection
            title="Resource Inventory"
            icon={<Package className="w-5 h-5 text-green-600" />}
          >
            <div className="space-y-4">
              {allReports.length > 0 ? (
                allReports.map((report, idx) => (
                  <div key={report.id || idx} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div className="px-4 py-3 bg-green-50/50 border-b border-green-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                          <Package className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{report.staffName}</p>
                          <p className="text-xs text-gray-500">{new Date(report.date).toLocaleString()}</p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-green-100 text-green-700">
                        {Array.isArray(report.resources) ? report.resources.length : Object.keys(report.resources || {}).length} items
                      </span>
                    </div>
                    <div className="p-3">
                      {renderResources(report.resources)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <h3 className="text-sm font-semibold text-gray-600">No Inventory Reports</h3>
                  <p className="text-xs text-gray-400 mt-1">Inventory reports submitted will appear here.</p>
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
                  className="inline-flex items-center px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-medium text-xs hover:bg-indigo-700 transition-colors"
                  onClick={() => { window.location.href = '#/isbar'; }}
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
                const primary = fd[mapping?.cardFields?.primary] || fd.patientName || fd.name || sub.template_name || 'Untitled';
                const secondary = fd[mapping?.cardFields?.secondary] || fd.department || '';
                const status = fd[mapping?.cardFields?.status] || '';
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
                      {sub.submitted_at ? new Date(String(sub.submitted_at)).toLocaleString() : ''}
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
      {customTabs.map(ct => (
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
              const ctProf = (ct.profession || '').toLowerCase();
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
                if (ctProf) {
                  const sProf = String(s.profession || s.template_profession || '').toLowerCase();
                  if (sProf && sProf !== ctProf) return false;
                }
                return true;
              });
              const cardFields = ct.cardFields || {};
              if (filtered.length === 0) {
                return (
                  <div className="text-center py-8 text-gray-500">
                    <Tag className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                    <p className="font-medium">No submissions for "{ct.displayName || ct.name}"</p>
                    <p className="text-sm mt-1">Submissions from "{ct.templateName}" will appear here.</p>
                  </div>
                );
              }
              // Group by field
              const groups: Record<string, Record<string, unknown>[]> = {};
              if (ct.groupByField) {
                filtered.forEach(sub => {
                  const fd = (sub.form_data as Record<string, unknown>) || {};
                  const key = String(fd[ct.groupByField] || sub.template_name || 'Ungrouped');
                  if (!groups[key]) groups[key] = [];
                  groups[key].push(sub);
                });
              } else {
                groups['__all__'] = filtered;
              }
              const groupEntries = Object.entries(groups);
              return (
                <div className="space-y-6">
                  {groupEntries.map(([groupName, subs]) => (
                    <div key={groupName}>
                      {ct.groupByField && groupEntries.length > 1 && (
                        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-400" />
                          {groupName}
                          <span className="text-xs font-normal text-gray-400">({subs.length})</span>
                        </h4>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {subs.map((sub) => {
                          const fd = (sub.form_data as Record<string, unknown>) || {};
                          const primary = (cardFields.primary && fd[cardFields.primary]) || fd.patientName || fd.name || sub.template_name || 'Untitled';
                          const secondary = (cardFields.secondary && fd[cardFields.secondary]) || fd.department || '';
                          const status = (cardFields.status && fd[cardFields.status]) || '';
                          const identifier = (cardFields.identifier && fd[cardFields.identifier]) || '';
                          const extraFields = cardFields.extraFields || [];
                          return (
                            <div key={sub.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow bg-white">
                              <div className="flex items-start justify-between mb-2">
                                <h4 className="font-semibold text-gray-900 text-sm leading-tight">{String(primary)}</h4>
                                {status && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 shrink-0 ml-2">
                                    {String(status)}
                                  </span>
                                )}
                              </div>
                              {identifier && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600 mb-1">
                                  {String(identifier)}
                                </span>
                              )}
                              {secondary && <p className="text-xs text-gray-500 mb-2">{String(secondary)}</p>}
                              <div className="space-y-1 mt-3 pt-3 border-t border-gray-100">
                                {Object.entries(fd)
                                  .filter(([k]) => !['id', 'patientId', 'created_at', 'updated_at'].includes(k.toLowerCase()))
                                  .filter(([k]) => extraFields.length === 0 || extraFields.includes(k))
                                  .slice(0, extraFields.length > 0 ? extraFields.length : 6)
                                  .map(([k, v]) => (
                                    <div key={k} className="flex justify-between text-xs">
                                      <span className="text-gray-500 truncate">{prettifyLabel(k)}:</span>
                                      <span className="text-gray-900 font-medium truncate ml-2">{String(v ?? '')}</span>
                                    </div>
                                  ))}
                              </div>
                              <div className="mt-3 text-[10px] text-gray-400 text-right">
                                {sub.submitted_at ? new Date(String(sub.submitted_at)).toLocaleString() : ''}
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

      {/* AI Analytics Tab */}
      {activeTab === 'ai-analytics' && (
        <AIPatientDashboard />
      )}

      {/* Add Custom Tab Modal */}
      {showAddTabModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-bold text-gray-900">Add Custom Tab</h3>
                <p className="text-xs text-gray-500 mt-0.5">Step {tabModalStep === 'basic' ? '1' : '2'} of 2 — {tabModalStep === 'basic' ? 'Basic Settings' : 'Field Mapping'}</p>
              </div>
              <button onClick={() => setShowAddTabModal(false)} className="text-gray-400 hover:text-gray-600 transition p-1.5 rounded-full hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-gray-100 shrink-0">
              <div className={`h-full bg-brand transition-all duration-300 ${tabModalStep === 'basic' ? 'w-1/2' : 'w-full'}`} />
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {tabModalStep === 'basic' ? (
                <>
                  {/* Tab Name */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Tab Name *</label>
                    <input
                      type="text"
                      value={newTab.name || ''}
                      onChange={e => {
                        const name = e.target.value;
                        setNewTab(prev => ({
                          ...prev,
                          name,
                          displayName: prev.displayName === prev.name || !prev.displayName ? name : prev.displayName,
                        }));
                      }}
                      placeholder="e.g. Maternity, Lab Results, Pharmacy..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">This becomes the identifier tag in dashboard mapping.</p>
                  </div>

                  {/* Display Name */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Display Name</label>
                    <input
                      type="text"
                      value={newTab.displayName || ''}
                      onChange={e => setNewTab(prev => ({ ...prev, displayName: e.target.value }))}
                      placeholder="Shown as section title (defaults to tab name)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    />
                  </div>

                  {/* Form Template */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Form Template *</label>
                    <select
                      value={newTab.templateId || ''}
                      onChange={e => {
                        const tplId = e.target.value;
                        const tpl = availableTemplates.find(t => t.id === tplId);
                        setNewTab(prev => ({
                          ...prev,
                          templateId: tplId,
                          templateName: tpl?.name || '',
                          department: tpl?.department || prev.department || '',
                          departments: tpl?.department ? [tpl.department] : prev.departments || [],
                        }));
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white"
                    >
                      <option value="">Select a template...</option>
                      {availableTemplates.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.department})</option>
                      ))}
                    </select>
                    {availableTemplates.length === 0 && (
                      <p className="text-xs text-gray-400 mt-1">Loading templates...</p>
                    )}
                  </div>

                  {/* Dashboard Type */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Dashboard Type</label>
                    <div className="flex gap-2">
                      {(['patient', 'resource'] as const).map(dt => (
                        <button
                          key={dt}
                          type="button"
                          onClick={() => setNewTab(prev => ({ ...prev, dashboardType: dt }))}
                          className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                            newTab.dashboardType === dt
                              ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {dt === 'patient' ? 'Patient Handover' : 'Resource Handover'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Department */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Department</label>
                    <select
                      value={newTab.department || ''}
                      onChange={e => {
                        const dep = e.target.value;
                        const current = newTab.departments || [];
                        const next = dep ? (current.includes(dep) ? current : [dep, ...current.filter(d => d !== dep)]) : current.filter(d => d !== newTab.department);
                        setNewTab(prev => ({ ...prev, department: dep, departments: next }));
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white"
                    >
                      <option value="">All Departments</option>
                      {getAllDepartments().map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    {/* Multi-department checkboxes */}
                    {getAllDepartments().length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {getAllDepartments().map(d => {
                          const checked = (newTab.departments || []).includes(d);
                          return (
                            <label key={d} className={`inline-flex items-center px-2 py-1 rounded-md border text-[11px] font-medium cursor-pointer transition-colors ${checked ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                              <input type="checkbox" className="sr-only" checked={checked}
                                onChange={() => {
                                  const current = newTab.departments || [];
                                  const next = checked ? current.filter(x => x !== d) : [...current, d];
                                  setNewTab(prev => ({ ...prev, departments: next }));
                                }}
                              />
                              {d}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Profession */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Profession</label>
                    <select
                      value={newTab.profession || ''}
                      onChange={e => setNewTab(prev => ({ ...prev, profession: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white"
                    >
                      <option value="">All Professions</option>
                      {PROFESSIONS.map(p => (<option key={p} value={p}>{p}</option>))}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  {/* Step 2: Field Mapping */}
                  {/* Group By */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Group Records By</label>
                    <select
                      value={newTab.groupByField || ''}
                      onChange={e => setNewTab(prev => ({ ...prev, groupByField: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white"
                    >
                      <option value="">No grouping (flat list)</option>
                      {getTabFieldOptions().map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                    </select>
                    <p className="text-[11px] text-gray-400 mt-1">Records will be grouped by this field (e.g. patient MRN, department).</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Primary Field */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Primary Field (Title) *</label>
                      <select
                        value={newTab.cardFields?.primary || ''}
                        onChange={e => setNewTab(prev => ({ ...prev, cardFields: { ...prev.cardFields!, primary: e.target.value } }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white"
                      >
                        <option value="">Select field...</option>
                        {getTabFieldOptions().map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                      </select>
                    </div>
                    {/* Secondary Field */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Secondary Field (Subtitle)</label>
                      <select
                        value={newTab.cardFields?.secondary || ''}
                        onChange={e => setNewTab(prev => ({ ...prev, cardFields: { ...prev.cardFields!, secondary: e.target.value } }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white"
                      >
                        <option value="">Select field...</option>
                        {getTabFieldOptions().map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Status Field */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Status Field (Badge)</label>
                      <select
                        value={newTab.cardFields?.status || ''}
                        onChange={e => setNewTab(prev => ({ ...prev, cardFields: { ...prev.cardFields!, status: e.target.value } }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white"
                      >
                        <option value="">Select field...</option>
                        {getTabFieldOptions().map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                      </select>
                    </div>
                    {/* Identifier Field */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Identifier Field (Bed/ID)</label>
                      <select
                        value={newTab.cardFields?.identifier || ''}
                        onChange={e => setNewTab(prev => ({ ...prev, cardFields: { ...prev.cardFields!, identifier: e.target.value } }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white"
                      >
                        <option value="">Select field...</option>
                        {getTabFieldOptions().map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                      </select>
                    </div>
                  </div>

                  {/* Nurse Field */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Nurse Name Field</label>
                    <select
                      value={newTab.cardFields?.nurse || ''}
                      onChange={e => setNewTab(prev => ({ ...prev, cardFields: { ...prev.cardFields!, nurse: e.target.value } }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white"
                    >
                      <option value="">Select field...</option>
                      {getTabFieldOptions().map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                    </select>
                  </div>

                  {/* Extra Fields */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Extra Fields (expanded card details)</label>
                    <select multiple
                      value={newTab.cardFields?.extraFields || []}
                      onChange={e => {
                        const values = Array.from((e.target as HTMLSelectElement).selectedOptions).map(o => o.value);
                        setNewTab(prev => ({ ...prev, cardFields: { ...prev.cardFields!, extraFields: values } }));
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm h-28 bg-white"
                    >
                      {getTabFieldOptions().map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                    </select>
                    <p className="text-[11px] text-gray-400 mt-1">Hold Ctrl/Cmd to select multiple fields to display on each card.</p>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-between shrink-0">
              {tabModalStep === 'fields' ? (
                <button
                  onClick={() => setTabModalStep('basic')}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm font-medium"
                >
                  Back
                </button>
              ) : (
                <div />
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddTabModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm font-medium"
                >
                  Cancel
                </button>
                {tabModalStep === 'basic' ? (
                  <button
                    onClick={() => setTabModalStep('fields')}
                    disabled={!newTab.name?.trim() || !newTab.templateId}
                    className="px-4 py-2 rounded-lg bg-brand text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-600 text-sm font-medium"
                  >
                    Next: Field Mapping
                  </button>
                ) : (
                  <button
                    onClick={handleAddTab}
                    disabled={!newTab.cardFields?.primary}
                    className="px-4 py-2 rounded-lg bg-brand text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-600 text-sm font-medium"
                  >
                    Add Tab
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HealthcareDashboard;

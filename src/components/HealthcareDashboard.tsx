import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { ExpandablePatientCard } from './ExpandablePatientCard';
import IsbarLoader from './IsbarLoader';
import DashboardSection from './common/DashboardSection';
import { useShift } from '../hooks/useShift';
import { 
  Bed, 
  Clock, 
  Package,
  Activity,
  FileText,
  Plus,
  Minus,
  ChevronDown,
  ChevronRight,
  Flag,
  AlertTriangle,
  MinusCircle
} from 'lucide-react';
import { useSearch } from '../hooks/useSearch';

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

export const HealthcareDashboard: React.FC = () => {
  const { user, getUserDepartmentFilter, impersonate } = useAuth();
  const { shift, setShift } = useShift();
  const { query } = useSearch();
  const [patients, setPatients] = useState<PatientHandover[]>([]);
  const [resourceStatus, setResourceStatus] = useState<ResourceStatus[]>([]);
  const [roundsByShift, setRoundsByShift] = useState<{ Morning: Round[]; Evening: Round[]; Night: Round[] }>({ Morning: [], Evening: [], Night: [] });
  const [roundMappedTemplates, setRoundMappedTemplates] = useState<string[]>([]);
  const [reportsByShift, setReportsByShift] = useState<{ Morning: Report[]; Evening: Report[]; Night: Report[] }>({ Morning: [], Evening: [], Night: [] });
  const [expandedResourceShift, setExpandedResourceShift] = useState<'Morning' | 'Evening' | 'Night' | null>(null);
  const [expandedRoundShift, setExpandedRoundShift] = useState<'Morning' | 'Evening' | 'Night' | null>(null);
  const [recentHandovers, setRecentHandovers] = useState<Record<string, unknown>[]>([]);
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

    const extractNurseName = (data: Record<string, unknown>, labelMap?: Record<string, string>): string | undefined => {
      if (!data) return undefined;
      const candidates = ['Name of the nurse', 'Name of nurse', 'nurseName', 'nurse', 'assignedNurse', 'nurse_name', 'submitted_nurse'];
      for (const key of candidates) {
        const val = getByKeySmart(data, key, labelMap) ?? data[key as keyof typeof data];
        if (val !== undefined && val !== null && String(val).trim() !== '') return String(val);
      }
      return undefined;
    };

    const extractPhysicianName = (data: Record<string, unknown>, labelMap?: Record<string, string>): string | undefined => {
      if (!data) return undefined;
      const candidates = ['Name of Physician', 'physicianName', 'physician', 'doctorName', 'doctor', 'assignedPhysician', 'physician_name'];
      for (const key of candidates) {
        const val = getByKeySmart(data, key, labelMap) ?? data[key as keyof typeof data];
        if (val !== undefined && val !== null && String(val).trim() !== '') return String(val);
      }
      return undefined;
    };

    const extractMidwifeName = (data: Record<string, unknown>, labelMap?: Record<string, string>): string | undefined => {
      if (!data) return undefined;
      const candidates = ['Name of Midwife', 'midwifeName', 'midwife', 'assignedMidwife', 'midwife_name'];
      for (const key of candidates) {
        const val = getByKeySmart(data, key, labelMap) ?? data[key as keyof typeof data];
        if (val !== undefined && val !== null && String(val).trim() !== '') return String(val);
      }
      return undefined;
    };

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

    const cards: PatientHandover[] = [];

    (submissions || []).slice().sort((a: Record<string, unknown>, b: Record<string, unknown>) => parseDateSafe(b.submitted_at as string).getTime() - parseDateSafe(a.submitted_at as string).getTime())
      .forEach((sub: Record<string, unknown>) => {
        const fd = (sub.form_data as Record<string, unknown>) || {};
        const mapping = (effectiveMappings || []).find((m: DashboardMapping) => {
          const idMatch = m.formTemplateId != null && sub.template_id != null && String(m.formTemplateId) === String(sub.template_id);
          const nameMatch = (m.formTemplateName || m.form_template_name) && sub.template_name && String(m.formTemplateName || m.form_template_name).toLowerCase() === String(sub.template_name).toLowerCase();
          return idMatch || nameMatch;
        });
        const labelMap = mapping ? (mapping as DashboardMapping).__labelMap : {};

        const name = getByKeySmart(fd, (mapping as DashboardMapping)?.cardFields?.primary, labelMap) || fd.patientName || fd['Patient name'] || fd.patient_name || (sub.patientName || 'Unknown Patient');
        const mrn = getByKeySmart(fd, (mapping as DashboardMapping)?.cardFields?.secondary, labelMap) || fd.mrn || fd.MRN || fd['MRN'] || 'N/A';
        const bed = getByKeySmart(fd, (mapping as DashboardMapping)?.cardFields?.identifier, labelMap) || fd.bedNumber || fd['Bed Number'] || fd.bed_number || 'N/A';
        const stabilityRaw = getByKeySmart(fd, (mapping as DashboardMapping)?.cardFields?.status, labelMap) || fd.stability || fd['Patient Stability'] || 'stable';
        const stabilityResolved = normalizeStability(stabilityRaw);

        const card: PatientHandover = {
          id: String(sub.id || `${sub.template_id ?? sub.template_name}-${Math.random().toString(36).slice(2,8)}`),
          patientName: String(name),
          mrn: String(mrn),
          bedNumber: String(bed),
          department: (sub.template_department || user?.department || 'General') as string,
          stability: stabilityResolved,
          lastHandover: sub.submitted_at as string,
          assignedNurse: (() => {
            if (mapping) {
              const mapped = findMappedFieldKey(labelMap, ['nurse', 'name of nurse']);
              if (mapped) return String(getByKeySmart(fd, mapped, labelMap) || sub.submitted_by_name || sub.submitted_by || 'Unknown');
              return String(sub.submitted_by_name || sub.submitted_by || 'Unknown');
            }
            return String(extractNurseName(fd, labelMap) || sub.submitted_by_name || sub.submitted_by || 'Unknown');
          })(),
          assignedPhysician: (() => {
            if (mapping) {
              const mapped = findMappedFieldKey(labelMap, ['physician', 'doctor']);
              if (mapped) return String(getByKeySmart(fd, mapped, labelMap) || '');
              return undefined;
            }
            return extractPhysicianName(fd, labelMap) || undefined;
          })(),
          assignedMidwife: (() => {
            if (mapping) {
              const mapped = findMappedFieldKey(labelMap, ['midwife']);
              if (mapped) return String(getByKeySmart(fd, mapped, labelMap) || '');
              return undefined;
            }
            return extractMidwifeName(fd, labelMap) || undefined;
          })(),
          diagnosis: (fd.diagnosis || fd.background || fd.situation || 'Not specified') as string,
          age: (fd.age || Math.floor(Math.random() * 80) + 20) as number,
          gender: (fd.gender || fd.sex || (Math.random() > 0.5 ? 'M' : 'F')) as 'M' | 'F',
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
        const addLabels = (flds: unknown[], parentLabel?: string) => {
          (flds || []).forEach((f: Record<string, unknown>) => {
            const nm = f?.name || f?.id;
            const lb = f?.label || nm;
            if (nm) labelMap[nm as string] = parentLabel ? `${parentLabel} > ${lb}` : lb as string;
            if (Array.isArray(f?.fields)) addLabels(f.fields, lb as string);
          });
        };
        addLabels(parsedFields as unknown[]);
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
      if (departmentFilter) {
        submissionsUrl += `?department=${encodeURIComponent(departmentFilter)}`;
      }

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
        const ident = String((m as DashboardMapping).identifier || '').trim().toLowerCase();
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

      const patientSubmissions = (submissions || []).filter((s: Record<string, unknown>) => {
        const tid = s.template_id != null ? String(s.template_id) : null;
        const tname = s.template_name ? String(s.template_name).toLowerCase() : null;
        const isRound = (tid && roundTemplateIdSet.has(tid)) || (tname && roundTemplateNameSet.has(tname));
        return !isRound;
      });

      const patientData = processPatientHandovers(patientSubmissions, patientMappingsNormalized);
      setPatients(patientData);
      setRecentHandovers(patientSubmissions.slice(0, 5));

      const resourceData = processResourceStatus(resources, departmentFilter);
      setResourceStatus(resourceData);

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
      (['Morning','Evening','Night'] as const).forEach((sn: SN) => {
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
        const roundSubs = (submissions || []).filter((s: Record<string, unknown>) => {
          const tid = s.template_id != null ? String(s.template_id) : null;
          const tname = s.template_name ? String(s.template_name).toLowerCase() : null;
          const templateMatch = (tid && roundTemplateIdSet.has(tid)) || (tname && roundTemplateNameSet.has(tname));
          const deptOk = !departmentFilter || (String(s.template_department || s.department || '').toLowerCase() === String(departmentFilter).toLowerCase());
          return templateMatch && deptOk;
        });

        const bestDate = (s: Record<string, unknown>): string => (s?.submitted_at || s?.submittedAt || s?.date || s?.updated_at || s?.created_at || s?.updatedAt) as string;

        const toShift = (iso: string): 'Morning' | 'Evening' | 'Night' => {
          const d = parseDateSafe(iso);
          const h = d.getHours();
          if (h >= 7 && h < 15) return 'Morning';
          if (h >= 15 && h < 23) return 'Evening'; // Corrected from 'Night'
          return 'Night';
        };

        const roundsGrouped: { Morning: Round[]; Evening: Round[]; Night: Round[] } = { Morning: [], Evening: [], Night: [] };
        (roundSubs || []).forEach((sub: Record<string, unknown>) => {
          const fd = (sub.form_data as Record<string, unknown>) || {};
          const bd = bestDate(sub); // Define bd early so it's always available

          // --- DEBUGGING SHIFT LOGIC ---
          const shiftFromData = getByKeySmart(fd, 'shift');
          console.log(`[Debug] Shift from data for submission ${sub.id}:`, shiftFromData);
          
          let shiftName = normalizeShift(shiftFromData);
          console.log(`[Debug] Normalized shift for submission ${sub.id}:`, shiftName);
          
          // Fallback to time-based calculation if shift not in data
          if (!shiftName) {
            shiftName = toShift(bd);
            console.log(`[Debug] Fallback shift for submission ${sub.id}:`, shiftName);
          }
          // --- END DEBUGGING ---

          if (!shiftName) {
            console.error("Could not determine shift for submission:", sub);
            return; // Skip this submission if we can't determine a shift
          }

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
              const skipKeys = new Set(['id','patientId','patientName','mrn','bed','bedNumber','stability','department','submitted_by','submitted_by_name','created_at','updated_at'].map(s => s.toLowerCase()));
              return !skipKeys.has(String(k).toLowerCase());
            })
            .map(([k, v]) => ({
              label: (labelMap as Record<string, string>)[k] || prettifyLabel(String(k)),
              value: Array.isArray(v) ? v.join(', ') : String(v)
            }))
            .sort((a: {label:string}, b: {label:string}) => String(a.label).localeCompare(String(b.label), undefined, { sensitivity: 'base' }));

            const nurseFromAgenda = (agenda.find((ln: {label:string}) => String(ln.label || '').toLowerCase().includes('nurse'))?.value || '').toString().trim();
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
            const dateA = parseDateSafe(a.date || (a as Record<string, unknown>).updated_at as string || (a as Record<string, unknown>).created_at as string);
            const dateB = parseDateSafe(b.date || (b as Record<string, unknown>).updated_at as string || (b as Record<string, unknown>).created_at as string);
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
          const shiftOfLatest = toShift(bestDate(latestOverall.sub));
          setMostRecentRoundShift(shiftOfLatest);
        } else {
          setMostRecentRoundShift(null);
        }
      } else {
        setRoundsByShift({ Morning: [], Evening: [], Night: [] });
        setMostRecentRoundShift(null);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, getUserDepartmentFilter, filterDept, processPatientHandovers]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, fetchDashboardData]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        if (user?.role !== 'admin') return;
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

  if (loading) {
    return <IsbarLoader overlay message="Loading ISBAR Dashboard..." size={96} />;
  }

  const isWithinLastNHours = (iso: string, hours: number) => {
    const t = parseDateSafe(iso).getTime();
    if (isNaN(t)) return true;
    return Date.now() - t <= hours * 60 * 60 * 1000;
  };

  const fitsShift = (iso: string) => {
    if (shift === 'All') return true;
  const d = parseDateSafe(iso);
  if (isNaN(d.getTime())) return true;
    const hour = d.getHours();
    if (shift === 'Morning') return hour >= 6 && hour < 14;
    if (shift === 'Evening') return hour >= 14 && hour < 22;
    return hour >= 22 || hour < 6;
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
    .filter(p => isWithinLastNHours(p.lastHandover, Number(timeWindow)) && fitsShift(p.lastHandover));

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
    console.debug('Dashboard Debug:', {
      totalPatients: patients.length,
      recentHandovers: recentHandovers.length,
      filteredByTimeShift: filteredByTimeShift.length,
      visiblePatients: visiblePatients.length,
      samplePatients: patients.slice(0,5).map(p => ({ id: p.id, name: p.patientName, last: p.lastHandover })),
      sampleFiltered: filteredByTimeShift.slice(0,5).map(p => ({ id: p.id, name: p.patientName, last: p.lastHandover })),
    });
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

  return (
    <div className="space-y-6">
      {user?.role === 'admin' && (
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
                  if (!impersonateUserId) return;
                  const ok = await impersonate({ userId: impersonateUserId });
                  if (ok) {
                    window.location.reload();
                  }
                }}
                disabled={!impersonateUserId}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
              >
                Log in as
              </button>
              <button
                onClick={() => setImpersonateUserId('')}
                className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
      {user?.role === 'admin' && (
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
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Shift</label>
              <select
                value={shift}
                onChange={e => setShift(e.target.value as ShiftType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="All">All Shifts</option>
                <option value="Morning">Morning</option>
                <option value="Evening">Evening</option>
                <option value="Night">Night</option>
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
      )}
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
              <ExpandablePatientCard
                key={patient.id}
                patient={patient}
              />
            ))}
          </div>
        )}
      </DashboardSection>

      {(resourceMappings.length > 0 && (
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
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    resource.lowStock > 0 
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
                    <span className={`font-medium ${
                      resource.lowStock > 0 ? 'text-red-600' : 'text-green-600'
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
      )}

      {isNurseOrMidwife ? (
        <>
        <DashboardSection
          title="Resource Inventory"
          icon={<Package className="w-5 h-5 text-green-600" />}
        >
          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {(['Morning','Evening','Night'] as const).map(shiftName => {
              const list = reportsByShift[shiftName];
              const latest = list[0];
              const isLatest = mostRecentShift === shiftName;
              return (
                <div key={shiftName} className={`border rounded-lg p-3 relative border-gray-200 bg-gray-50`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="text-sm font-semibold text-gray-800 whitespace-nowrap">{shiftName} Shift</div>
                      {isLatest && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700">
                          <Clock className="w-3 h-3 text-green-600" />
                          Latest
                        </span>
                      )}
                    </div>
                    {latest && (
                      <span className={`text-xs text-gray-500`}>
                        {new Date(latest.date).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  <div className={`text-xs mt-1 text-gray-600`}>
                    {latest ? (
                      <>Saved by {latest.staffName} on {new Date(latest.date).toLocaleDateString()}</>
                    ) : (
                      <>No reports yet</>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="space-y-3 mb-6">
            {(['Morning','Evening','Night'] as const).map(shiftName => {
              const isOpen = expandedResourceShift === shiftName;
              const list = reportsByShift[shiftName];
              return (
                <div key={`accordion-${shiftName}`} className={`border rounded-lg border-gray-200`}>
                  <button
                    className={`w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 bg-white`}
                    onClick={() => setExpandedResourceShift(isOpen ? null : shiftName)}
                  >
                    <div className="flex items-center gap-2">
                      {isOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                      <span className={`text-sm font-medium text-gray-800`}>
                        {shiftName} Reports
                      </span>
                      <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700`}>
                        {list.length}
                      </span>
                    </div>
                    {list[0] && (
                      <span className={`text-xs text-gray-500`}>
                        {new Date(list[0].date).toLocaleString()} • {list[0].staffName}
                      </span>
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-3">
                      {list.length === 0 ? (
                        <div className="text-xs text-gray-500 py-2">No reports for this shift yet.</div>
                      ) : (
                        <div>
                          {list.map((report: Report) => (
                            <div key={report.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
                                <div className="text-sm font-medium text-gray-800">
                                  Current Report - Saved by {report.staffName}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {new Date(report.date).toLocaleString()}
                                </div>
                              </div>
                              
                              {Array.isArray(report.resources) && report.resources.length > 0 ? (
                                <div className="overflow-x-auto">
                                  <table className="min-w-full border border-gray-200 bg-white rounded">
                                    <thead>
                                      <tr className="bg-gray-50 text-left text-xs text-gray-600 uppercase">
                                        <th className="px-3 py-2 border-b">Name</th>
                                        <th className="px-3 py-2 border-b">Type</th>
                                        <th className="px-3 py-2 border-b">Quantity</th>
                                        <th className="px-3 py-2 border-b">Standard</th>
                                        <th className="px-3 py-2 border-b">Unit</th>
                                        <th className="px-3 py-2 border-b">Expiry</th>
                                        <th className="px-3 py-2 border-b">Batch</th>
                                        <th className="px-3 py-2 border-b">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                      {(report.resources as Resource[]).map((item: Resource, idx: number) => (
                                        <tr key={`${report.id}-${idx}`} className="hover:bg-gray-50">
                                          <td className="px-3 py-2 border-b">{item.name as string || '-'}</td>
                                          <td className="px-3 py-2 border-b">{item.type as string || '-'}</td>
                                          <td className="px-3 py-2 border-b">{item.quantity as string || '-'}</td>
                                          <td className="px-3 py-2 border-b">{(item.standard_quantity || item.standard) as string || '-'}</td>
                                          <td className="px-3 py-2 border-b">{item.unit as string || '-'}</td>
                                          <td className="px-3 py-2 border-b">
                                            {item.expiry_date ? new Date(item.expiry_date as string).toLocaleDateString() : (item.expiry as string || '-')}
                                          </td>
                                          <td className="px-3 py-2 border-b">{(item.batch_number || item.batch) as string || '-'}</td>
                                          <td className="px-3 py-2 border-b">
                                            {(() => {
                                              const qtyNum = Number(item.quantity);
                                              const stdNumRaw = (item.standard_quantity ?? item.standard);
                                              const stdNum = stdNumRaw !== undefined && stdNumRaw !== null ? Number(stdNumRaw) : NaN;
                                              const isLowStock = !isNaN(qtyNum) && (!isNaN(stdNum) ? (qtyNum < 2 && stdNum >= 2) : (qtyNum < 2));
                                              let isExpired = false;
                                              let isNearExpired = false;
                                              const expiry = item.expiry_date || item.expiry;
                                              if (expiry) {
                                                const d = new Date(expiry as string);
                                                if (!isNaN(d.getTime())) {
                                                  const now = new Date();
                                                  const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                                                  isExpired = d < now;
                                                  isNearExpired = !isExpired && diffDays >= 0 && diffDays <= 7;
                                                }
                                              }
                                              const badges: JSX.Element[] = [];
                                              if (isExpired) badges.push(
                                                <span key="expired" className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                                  <Flag className="w-3 h-3 mr-1" />
                                                  Expired
                                                </span>
                                              );
                                              if (isNearExpired) badges.push(
                                                <span key="near" className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                                  Near Expired
                                                </span>
                                              );
                                              if (isLowStock) badges.push(
                                                <span key="low" className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                                                  <MinusCircle className="w-3 h-3 mr-1" />
                                                  Low Stock
                                                </span>
                                              );
                                              return badges.length ? (
                                                <div className="flex flex-wrap items-center gap-2">{badges}</div>
                                              ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                  OK
                                                </span>
                                              );
                                              })()}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="text-center py-4 text-gray-500 text-sm">
                                  No inventory items in this report
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DashboardSection>

        <DashboardSection
          title="Round"
          icon={<Clock className="w-5 h-5 text-green-600" />}
        >
          {((roundsByShift.Morning.length + roundsByShift.Evening.length + roundsByShift.Night.length === 0) && roundMappedTemplates.length > 0) && (
            <div className="mb-3 p-3 border border-yellow-200 bg-yellow-50 text-sm text-yellow-800 rounded">
              Round mapping configured for: {roundMappedTemplates.join(', ')}. No rounds submitted yet.
              <button
                className="ml-2 inline-flex items-center px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => { window.location.href = '#/isbar'; }}
                type="button"
              >
                Start Round
              </button>
            </div>
          )}
          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {(['Morning','Evening','Night'] as const).map(shiftName => {
              const list = roundsByShift[shiftName];
              const latest = list[0];
              const isLatest = mostRecentRoundShift === shiftName;
              return (
                <div key={`round-summary-${shiftName}`} className={`border rounded-lg p-3 bg-gray-50 border-gray-200`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="text-sm font-semibold text-gray-800 whitespace-nowrap">{shiftName} Shift</div>
                      {isLatest && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700">
                          <Clock className="w-3 h-3 text-green-600" />
                          Latest
                        </span>
                      )}
                    </div>
                    {latest && (
                      <span className={`text-xs text-gray-500`}>{new Date(latest.date || (latest as Record<string, unknown>).created_at as string || Date.now()).toLocaleTimeString()}</span>
                    )}
                  </div>
                  <div className={`text-xs mt-1 text-gray-600`}>
                    {latest ? (
                      <>Saved by {(latest.staffName || (latest as Record<string, unknown>).staff_name || 'Unknown')} on {new Date(latest.date || (latest as Record<string, unknown>).created_at as string || Date.now()).toLocaleDateString()}</>
                    ) : (
                      <>No rounds yet</>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-3 mb-6">
            {(['Morning','Evening','Night'] as const).map(shiftName => {
              const isOpen = expandedRoundShift === shiftName;
              const list = roundsByShift[shiftName];
              return (
                <div key={`round-accordion-${shiftName}`} className={`border rounded-lg border-gray-200`}>
                  <button
                    className={`w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 bg-white`}
                    onClick={() => setExpandedRoundShift(isOpen ? null : shiftName)}
                  >
                    <div className="flex items-center gap-2">
                      {isOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                      <span className={`text-sm font-medium text-gray-800`}>{shiftName} Round</span>
                    </div>
                    {list[0] && (
                      <span className={`text-xs text-gray-500`}>
                        {new Date(list[0].date || (list[0] as Record<string, unknown>).created_at as string || Date.now()).toLocaleString()} • {list[0].staffName || (list[0] as Record<string, unknown>).staff_name}
                      </span>
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-3">
                      {list.length === 0 ? (
                        <div className="text-xs text-gray-500 py-2">No rounds for this shift yet.</div>
                      ) : (
                        <div className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                          <div className="text-xs text-gray-500 mb-2">Minute Book</div>
                          <div className="space-y-2">
                            {list.map((patient: Round) => (
                              <div key={patient.id} className="bg-white rounded-md px-3 py-2 shadow-sm border border-gray-100">
                                <div className="flex items-center justify-between">
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium text-gray-800 truncate">
                                      {patient.title || 'Nursing Round'}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      By {patient.staffName || 'Unknown'} • {new Date(patient.date || (patient as Record<string, unknown>).created_at as string || Date.now()).toLocaleString()}
                                    </div>
                                  </div>
                                </div>
                                {Array.isArray(patient.agenda) && patient.agenda.length > 0 && (
                                  <div className="mt-2 border-t border-gray-100 pt-2">
                                    <ul className="space-y-1">
                                      {patient.agenda.map((ln: {label: string, value: string}, idx: number) => (
                                        <li key={idx} className="text-sm">
                                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 mr-2 align-middle"></span>
                                          <span className="font-medium text-gray-700">{ln.label}:</span>{' '}
                                          <span className="text-gray-700">{String(ln.value)}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DashboardSection>
        </>
      ) : (
      <DashboardSection
        title="Recent Handover Activity"
        icon={<Activity className="w-5 h-5 text-purple-600" />}
      >
        <div className="space-y-3">
          {recentHandovers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No recent handover activity
            </div>
          ) : (
            recentHandovers.map((handover, index) => {
              const formData = (handover.form_data as Record<string, unknown>) || {};
              const patientName = formData.patientName || formData['Patient name'] || 'Unknown Patient';
              const mrn = formData.mrn || formData.MRN || 'N/A';
              
              return (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg mr-3">
                      <FileText className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 text-sm">
                        {handover.template_name as string || 'Patient Handover'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {patientName as string} (MRN: {mrn as string}) • by {handover.submitted_by_name as string || handover.submitted_by as string}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {parseDateSafe(handover.submitted_at as string).toLocaleString()}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DashboardSection>
      )}
    </div>
  );
};
import React, { useState, useEffect } from 'react';
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
  // Full raw form data from the latest submission (for expanded view)
  formData?: Record<string, any>;
  // Label mapping from template fields for nicer display
  fieldLabels?: Record<string, string>;
  highlights?: { label: string; value: any }[];
}

interface ResourceStatus {
  category: string;
  totalItems: number;
  lowStock: number;
  lastUpdated: string;
  shift: 'day' | 'night';
}

// Admin-defined dashboard mapping
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
// Optional: parsed template fields/sections and label map (from backend join)
  fields?: any[];
  sections?: any[];
  __labelMap?: Record<string, string>;
}

export const HealthcareDashboard: React.FC = () => {
  const { user, getUserDepartmentFilter } = useAuth();
  const { shift } = useShift();
  const { query } = useSearch();
  const [patients, setPatients] = useState<PatientHandover[]>([]);
  const [resourceStatus, setResourceStatus] = useState<ResourceStatus[]>([]);
  const [resourceItems, setResourceItems] = useState<any[]>([]);
  const [roundsByShift, setRoundsByShift] = useState<{ Morning: any[]; Evening: any[]; Night: any[] }>({ Morning: [], Evening: [], Night: [] });
  const [roundMappedTemplates, setRoundMappedTemplates] = useState<string[]>([]);
  const [reportsByShift, setReportsByShift] = useState<{ Morning: any[]; Evening: any[]; Night: any[] }>({ Morning: [], Evening: [], Night: [] });
  const [expandedResourceShift, setExpandedResourceShift] = useState<'Morning' | 'Evening' | 'Night' | null>(null);
  const [expandedRoundShift, setExpandedRoundShift] = useState<'Morning' | 'Evening' | 'Night' | null>(null);
  const [mostRecentShift, setMostRecentShift] = useState<'Morning' | 'Evening' | 'Night' | null>(null);
  const [recentHandovers, setRecentHandovers] = useState<any[]>([]);
  const [expandAll, setExpandAll] = useState(false);
  const [stats, setStats] = useState({
    totalPatients: 0,
    criticalPatients: 0,
    pendingHandovers: 0,
    completedToday: 0
  });
  const [loading, setLoading] = useState(true);
  const [patientMappings, setPatientMappings] = useState<DashboardMapping[]>([]);
  const [resourceMappings, setResourceMappings] = useState<DashboardMapping[]>([]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  // Listen for inventory report saves to refresh dashboard
  useEffect(() => {
    const handleRefresh = () => {
      if (user) {
        fetchDashboardData();
      }
    };
    
    window.addEventListener('inventory_report_saved', handleRefresh);
    window.addEventListener('dashboard_refresh', handleRefresh);
    
    return () => {
      window.removeEventListener('inventory_report_saved', handleRefresh);
      window.removeEventListener('dashboard_refresh', handleRefresh);
    };
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const departmentFilter = getUserDepartmentFilter();

      // Fetch dashboard mappings depending on user's department (patient + resource)
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
        // Admin: fetch all and split by type with enabled/active filtering
        const res = await fetch('/api/dashboard-mappings');
        const all = res.ok ? await res.json() : [];
        const isEnabled = (m: any) => (typeof m.is_enabled === 'boolean' ? m.is_enabled : m.isEnabled) !== false;
        const isActiveTemplate = (m: any) => (typeof m.template_is_active === 'boolean' ? m.template_is_active : true);
        patientRaw = (all || []).filter((m: any) => {
          const type = m.dashboard_type || m.dashboardType;
          return type === 'patient' && isEnabled(m) && isActiveTemplate(m);
        });
        resourceRaw = (all || []).filter((m: any) => {
          const type = m.dashboard_type || m.dashboardType;
          return type === 'resource' && isEnabled(m) && isActiveTemplate(m);
        });
      }

      // Normalize card_fields structure to object and parse template fields for labels
      const normalize = (arr: any[]): DashboardMapping[] => (arr || []).map((m: any) => {
        const parsedFields = typeof m.fields === 'string' ? safeParseJSON(m.fields, []) : (m.fields || []);
        const parsedSections = typeof m.sections === 'string' ? safeParseJSON(m.sections, []) : (m.sections || []);
        const labelMap: Record<string, string> = {};
        const addLabels = (flds: any[], parentLabel?: string) => {
          (flds || []).forEach((f: any) => {
            const nm = f?.name || f?.id;
            const lb = f?.label || nm;
            if (nm) labelMap[nm] = parentLabel ? `${parentLabel} > ${lb}` : lb;
            if (Array.isArray(f?.fields)) addLabels(f.fields, lb);
          });
        };
        addLabels(parsedFields);
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

      // Fetch form submissions (patient handovers)
      let submissionsUrl = '/api/form-submissions';
      if (departmentFilter) {
        submissionsUrl += `?department=${encodeURIComponent(departmentFilter)}`;
      }

      const [submissionsRes, resourcesRes, reportsRes] = await Promise.all([
        fetch(submissionsUrl),
        fetch('/api/resources'), // Still needed for resource status calculations
        fetch(`/api/inventory-reports${departmentFilter ? `?department=${encodeURIComponent(departmentFilter)}` : ''}`)
      ]);

      let submissions = submissionsRes.ok ? await submissionsRes.json() : [];

      // Fallback: if department-filtered endpoint returns no submissions,
      // fetch all and filter client-side by department and patient mappings
      if ((departmentFilter && (!Array.isArray(submissions) || submissions.length === 0))) {
        try {
          const allRes = await fetch('/api/form-submissions');
          const allSubs = allRes.ok ? await allRes.json() : [];
          const allowedTemplateIds = new Set(
            (patientMappingsNormalized || [])
              .map(m => m.formTemplateId ?? (m as any).form_template_id)
              .filter((v: any) => v !== undefined && v !== null)
              .map((v: any) => String(v))
          );
          const allowedTemplateNames = new Set(
            (patientMappingsNormalized || [])
              .map(m => m.formTemplateName ?? (m as any).form_template_name)
              .filter((v: any) => !!v)
              .map((v: any) => String(v).toLowerCase())
          );

          submissions = (allSubs || []).filter((s: any) => {
            const deptOk = !departmentFilter || (String(s.template_department || s.department || '').toLowerCase() === String(departmentFilter).toLowerCase());
            if (!deptOk) return false;
            const tid = s.template_id != null ? String(s.template_id) : null;
            const tname = s.template_name ? String(s.template_name).toLowerCase() : null;
            return (tid && allowedTemplateIds.has(tid)) || (tname && allowedTemplateNames.has(tname));
          });
        } catch (e) {
          // ignore fallback errors; keep submissions as is
        }
      }

      const resources = resourcesRes.ok ? await resourcesRes.json() : [];
      const reports = reportsRes.ok ? await reportsRes.json() : [];

      // Process patient data from form submissions using mappings if available
      const patientData = processPatientHandovers(submissions, patientMappingsNormalized);
      setPatients(patientData);
      setRecentHandovers(submissions.slice(0, 5));

      // Process resource status
      const resourceData = processResourceStatus(resources, departmentFilter);
      setResourceStatus(resourceData);

      // Group reports by shift - each shift should have only one report (backend handles overwrite)
      const byShift = { Morning: [] as any[], Evening: [] as any[], Night: [] as any[] };
      (reports || []).forEach((r: any) => {
        const reportData = {
          id: r.id,
          staffName: r.staff_name || 'Unknown',
          date: r.created_at || r.date,
          resources: r.resources || []
        };
        
        if (r.shift === 'Morning') {
          byShift.Morning = [reportData];
        } else if (r.shift === 'Evening') {
          byShift.Evening = [reportData];
        } else if (r.shift === 'Night') {
          byShift.Night = [reportData];
        }
      });
      setReportsByShift(byShift as any);

      // Collect resources only from the current shift reports (no duplicates)
      const currentShiftResources: any[] = [];
      (['Morning', 'Evening', 'Night'] as const).forEach(shiftName => {
        const shiftReport = byShift[shiftName][0];
        if (shiftReport && Array.isArray(shiftReport.resources)) {
          // Only add resources from this shift's current report
          currentShiftResources.push(...shiftReport.resources);
        }
      });
      
      // Filter by department if needed
      const filteredShiftResources = departmentFilter 
        ? currentShiftResources.filter((r: any) => String(r.department || '') === String(departmentFilter))
        : currentShiftResources;
      
      setResourceItems(filteredShiftResources);

      // Build Rounds from dashboard mappings identified as "Round" via identifier or display name
      const roundMappings = ([...(patientMappingsNormalized || []), ...(resourceMappingsNormalized || [])]).filter((m: any) => {
        const ident = String((m as any).identifier || '').trim().toLowerCase();
        const name = String(m.displayName || m.display_name || '').trim().toLowerCase();
        return ident === 'round' || name === 'round';
      });
      setRoundMappedTemplates(roundMappings.map((m: any) => m.formTemplateName ?? (m as any).form_template_name ?? 'Unnamed'));

      if (roundMappings.length > 0) {
        const allowedRoundTemplateIds = new Set(
          roundMappings
            .map((m: any) => m.formTemplateId ?? (m as any).form_template_id)
            .filter((v: any) => v !== undefined && v !== null)
            .map((v: any) => String(v))
        );
        const allowedRoundTemplateNames = new Set(
          roundMappings
            .map((m: any) => m.formTemplateName ?? (m as any).form_template_name)
            .filter((v: any) => !!v)
            .map((v: any) => String(v).toLowerCase())
        );

        const roundSubs = (submissions || []).filter((s: any) => {
          const tid = s.template_id != null ? String(s.template_id) : null;
          const tname = s.template_name ? String(s.template_name).toLowerCase() : null;
          const templateMatch = (tid && allowedRoundTemplateIds.has(tid)) || (tname && allowedRoundTemplateNames.has(tname));
          const deptOk = !departmentFilter || (String(s.template_department || s.department || '').toLowerCase() === String(departmentFilter).toLowerCase());
          return templateMatch && deptOk;
        });

        const toShift = (iso: string): 'Morning' | 'Evening' | 'Night' => {
          const d = parseDateSafe(iso);
          const h = d.getHours();
          if (h >= 6 && h < 14) return 'Morning';
          if (h >= 14 && h < 22) return 'Evening';
          return 'Night';
        };

        const roundsGrouped: { Morning: any[]; Evening: any[]; Night: any[] } = { Morning: [], Evening: [], Night: [] };
        roundSubs
          .sort((a: any, b: any) => parseDateSafe(b.submitted_at).getTime() - parseDateSafe(a.submitted_at).getTime())
          .forEach((sub: any) => {
            const shiftName = toShift(sub.submitted_at);
            roundsGrouped[shiftName].push({
              id: sub.id,
              staffName: sub.submitted_by_name || sub.submitted_by || 'Unknown',
              date: sub.submitted_at,
              title: sub.template_name
            });
          });
        setRoundsByShift(roundsGrouped);
      } else {
        setRoundsByShift({ Morning: [], Evening: [], Night: [] });
      }

      // Determine which shift has the most recent save
      let latestShift: 'Morning' | 'Evening' | 'Night' | null = null;
      let latestDate: Date | null = null;
      
      (['Morning', 'Evening', 'Night'] as const).forEach(shiftName => {
        const shiftReport = byShift[shiftName][0];
        if (shiftReport) {
          const reportDate = new Date(shiftReport.date);
          if (!latestDate || reportDate > latestDate) {
            latestDate = reportDate;
            latestShift = shiftName;
          }
        }
      });
      
      setMostRecentShift(latestShift);

      // Calculate statistics
      const today = new Date().toDateString();
      const todayHandovers = submissions.filter((s: any) => 
        parseDateSafe(s.submitted_at).toDateString() === today
      );

      setStats({
        totalPatients: patientData.length,
        criticalPatients: patientData.filter(p => p.stability === 'critical').length,
        pendingHandovers: Math.floor(patientData.length * 0.1), // Mock pending
        completedToday: todayHandovers.length
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Safe JSON parse helper
  const safeParseJSON = (s: any, fallback: any) => {
    try { return typeof s === 'string' ? JSON.parse(s) : s; } catch { return fallback; }
  };

  // Robust date parser: if timezone is present, trust it; otherwise treat as local time (consistent with patient cards)
  const parseDateSafe = (iso: string): Date => {
    if (!iso) return new Date(NaN);
    const s = String(iso).trim();
    if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
      return new Date(s.replace(' ', 'T'));
    }
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?/);
    if (m) {
      const [, y, mo, da, h, mi, se, frac] = m as any;
      const ms = frac ? Math.round(Number('0.' + frac) * 1000) : 0;
      return new Date(Number(y), Number(mo) - 1, Number(da), Number(h), Number(mi), Number(se || '0'), ms);
    }
    return new Date(s.replace(' ', 'T'));
  };

  const processPatientHandovers = (submissions: any[], effectiveMappings: DashboardMapping[]): PatientHandover[] => {
    // Helper to safely get value by key from form data
    const getVal = (data: any, key?: string) => {
      if (!key) return undefined;
      if (!data) return undefined;
      return data[key];
    };

    const normalizeStability = (val: any): 'stable' | 'unstable' | 'critical' => {
      const s = String(val || '').trim().toLowerCase();
      if (!s) return 'stable';
      // Text-based hints
      if (s.includes('crit') || s === 'red' || s === 'r' || s === 'code red') return 'critical';
      if (s.includes('unst') || s.includes('subcrit') || s.includes('yellow') || s === 'yello' || s === 'yelow' || s === 'amber' || s === 'code yellow') return 'unstable';
      if (s.includes('stabl') || s === 'green' || s === 'g' || s === 'code green') return 'stable';
      // Numeric/score heuristics (optional): map high numbers to critical
      const n = Number(s);
      if (!isNaN(n)) {
        if (n >= 3) return 'critical';
        if (n === 2) return 'unstable';
        return 'stable';
      }
      return 'stable';
    };

    // Smart field resolver: try exact key, case-insensitive match, and label fallback
    const getByKeySmart = (data: any, key?: string, labelMap?: Record<string, string>) => {
      if (!data || !key) return undefined;
      // 1) Exact key
      if (data[key] !== undefined) return data[key];
      // 2) Case-insensitive key
      const lowerKey = String(key).toLowerCase();
      const ciKey = Object.keys(data).find(k => k.toLowerCase() === lowerKey);
      if (ciKey) return data[ciKey];
      // 3) Label-based fallback: if key actually equals a label, find the matching field name
      if (labelMap) {
        const entry = Object.entries(labelMap).find(([fieldName, label]) => String(label).toLowerCase() === String(key).toLowerCase());
        if (entry) {
          const [fieldName] = entry;
          if (data[fieldName] !== undefined) return data[fieldName];
          // case-insensitive for that field name too
          const ciFromLabel = Object.keys(data).find(k => k.toLowerCase() === String(fieldName).toLowerCase());
          if (ciFromLabel) return data[ciFromLabel];
        }
      }
      return undefined;
    };

    const extractNurseName = (data: any, labelMap?: Record<string, string>): string | undefined => {
      if (!data) return undefined;
      const candidates = [
        // Explicit form label variations
        'Name of the nurse', 'Name of The Nurse', 'Name of the Nurse', 'name of the nurse',
        'Name of nurse', 'Name of Nurse', 'name of nurse',
        // Common field names
        'nurseName', 'nurse', 'assignedNurse', 'assigned_nurse', 'nurse_name',
        // Other label variants
        'Nurse Name', 'Nurse', 'Assigned Nurse', 'assigned nurse',
        // Additional potential keys used in forms
        'submitted_nurse', 'submitter_nurse'
      ];
      for (const key of candidates) {
        const val = getByKeySmart(data, key, labelMap) ?? data[key as keyof typeof data];
        if (val !== undefined && val !== null && String(val).trim() !== '') return String(val);
      }
      return undefined;
    };

    const results: Record<string, PatientHandover> = {};

    if (effectiveMappings && effectiveMappings.length > 0) {
      // Build per-mapping latest entries grouped by mapping.groupByField
      for (const mapping of effectiveMappings) {
        const tmplId = (mapping.formTemplateId ?? mapping.form_template_id) as any;
        const tmplName = mapping.formTemplateName ?? mapping.form_template_name;
        const groupBy = mapping.groupByField || mapping.group_by_field;
        const fields = mapping.cardFields || mapping.card_fields || {};

        const relevant = submissions.filter((s: any) => {
          if (tmplId != null && s.template_id != null) {
            // Loose equality to handle string/number mismatch
            // eslint-disable-next-line eqeqeq
            if (s.template_id == tmplId) return true;
          }
          if (tmplName && s.template_name) {
            return String(s.template_name).toLowerCase() === String(tmplName).toLowerCase();
          }
          return false;
        });

        const latestByGroup = new Map<string, any>();
        for (const sub of relevant) {
          const fd = sub.form_data || {};
          const groupVal = getVal(fd, groupBy) || getVal(fd, fields.secondary) || getVal(fd, fields.identifier) || sub.id;
          const key = String(groupVal);
          const prev = latestByGroup.get(key);
          if (!prev || parseDateSafe(sub.submitted_at).getTime() > parseDateSafe(prev.submitted_at).getTime()) {
            latestByGroup.set(key, sub);
          }
        }

        // Map to PatientHandover shape
        for (const [key, sub] of latestByGroup.entries()) {
          const fd = sub.form_data || {};
          const labelMap = (mapping as any).__labelMap as Record<string, string> | undefined;
          const name = getByKeySmart(fd, fields.primary, labelMap) || fd.patientName || fd['Patient name'] || fd.patient_name || 'Unknown Patient';
          const mrn = getByKeySmart(fd, fields.secondary, labelMap) || fd.mrn || fd.MRN || fd['MRN'] || 'N/A';
          const bed = getByKeySmart(fd, fields.identifier, labelMap) || fd.bedNumber || fd['Bed Number'] || fd.bed_number || 'N/A';
          const stabilityRaw = getByKeySmart(fd, fields.status, labelMap) || fd.stability || fd['Patient Stability'] || 'stable';
          const statusMap = (fields as any).statusValueMap || (fields as any).status_value_map || null;
          let stabilityResolved: 'stable' | 'unstable' | 'critical' = normalizeStability(stabilityRaw);
          if (statusMap && typeof statusMap === 'object') {
            const entries = Object.entries(statusMap);
            const hit = entries.find(([k]) => String(k).trim().toLowerCase() === String(stabilityRaw).trim().toLowerCase());
            if (hit) {
              const mapped = String(hit[1]).trim().toLowerCase();
              if (mapped === 'critical') stabilityResolved = 'critical';
              else if (mapped === 'unstable') stabilityResolved = 'unstable';
              else if (mapped === 'stable') stabilityResolved = 'stable';
            }
          }

          // Build highlights from mapping extraFields (optional)
          const extra = ((fields as any).extraFields || (fields as any).extra_fields || []) as string[];
          const highlights: { label: string; value: any }[] = [];
          if (Array.isArray(extra)) {
            extra.forEach((fname) => {
              const val = getByKeySmart(fd, fname, labelMap);
              if (val !== undefined && val !== null && val !== '') {
                const label = (labelMap && labelMap[fname]) ? labelMap[fname] : String(fname);
                highlights.push({ label, value: Array.isArray(val) ? val.join(', ') : (typeof val === 'object' ? JSON.stringify(val) : String(val)) });
              }
            });
          }

          const card: PatientHandover = {
            id: `${tmplId ?? tmplName}-${key}`,
            patientName: String(name),
            mrn: String(mrn),
            bedNumber: String(bed),
            department: sub.template_department || user?.department || 'General',
            stability: stabilityResolved,
            lastHandover: sub.submitted_at,
            assignedNurse: extractNurseName(fd, labelMap) || sub.submitted_by_name || sub.submitted_by || 'Unknown',
            diagnosis: fd.diagnosis || fd.background || fd.situation || 'Not specified',
            age: fd.age || Math.floor(Math.random() * 80) + 20,
            gender: Math.random() > 0.5 ? 'M' : 'F',
            formData: fd,
            fieldLabels: (mapping as any).__labelMap || {},
            highlights
          };

          results[card.id] = card;
        }
      }

      return Object.values(results);
    }

    // Fallback to legacy heuristic when no mappings are configured
    const patientMap = new Map<string, PatientHandover>();
    const isbarSubmissions = submissions.filter((submission) => { 
      const templateName = submission.template_name || ""; 
      return templateName.toUpperCase().includes("ISBAR"); 
    });

    isbarSubmissions.forEach((submission) => {
      const formData = submission.form_data || {};
      const patientName = formData.patientName || formData['Patient name'] || formData.patient_name || 'Unknown Patient';
      const mrn = formData.mrn || formData.MRN || formData['MRN'] || 'N/A';
      const bedNumber = formData.bedNumber || formData['Bed Number'] || formData.bed_number || 'N/A';
      const stability = formData.stability || formData['Patient Stability'] || 'stable';

      if (mrn !== 'N/A' && patientName !== 'Unknown Patient') {
        const patientKey = `${mrn}-${bedNumber}`;
        
        if (!patientMap.has(patientKey) || 
            parseDateSafe(submission.submitted_at).getTime() > parseDateSafe(patientMap.get(patientKey)!.lastHandover).getTime()) {
          
          patientMap.set(patientKey, {
            id: patientKey,
            patientName,
            mrn,
            bedNumber,
            department: submission.template_department || user?.department || 'General',
            stability: String(stability).toLowerCase() as 'stable' | 'unstable' | 'critical',
            lastHandover: submission.submitted_at,
            assignedNurse: extractNurseName(formData) || submission.submitted_by_name || submission.submitted_by || 'Unknown',
            diagnosis: formData.diagnosis || formData.background || formData.situation || 'Not specified',
            age: formData.age || Math.floor(Math.random() * 80) + 20, // Mock age if not provided
            gender: Math.random() > 0.5 ? 'M' : 'F' // Mock gender if not provided
          });
        }
      }
    });

    return Array.from(patientMap.values());
  };

  const processResourceStatus = (resources: any[], department: string | null): ResourceStatus[] => {
    if (!resources.length) return [];

    const filteredResources = department 
      ? resources.filter(r => r.department === department)
      : resources;

    const drugResources = filteredResources.filter(r => r.type === 'Drug');
    const equipmentResources = filteredResources.filter(r => r.type === 'Equipment');

    const calculateLowStock = (items: any[]) => 
      items.filter(item => {
        const percentage = item.standard_quantity > 0 
          ? (item.quantity / item.standard_quantity) * 100 
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

  const getProfessionalGreeting = () => {
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
    
    let roleTitle = '';
    switch (user?.role) {
      case 'admin': roleTitle = 'Administrator'; break;
      case 'user': roleTitle = 'Healthcare Professional'; break;
      case 'staff': roleTitle = 'Staff Member'; break;
      default: roleTitle = 'Healthcare Professional';
    }

    return `${timeGreeting}, ${roleTitle} ${user?.name}`;
  };

  const toggleExpandAll = () => {
    setExpandAll(!expandAll);
  };

  const isNurseOrMidwife = user?.profession === 'Nurse' || user?.profession === 'Midwifery';

  if (loading) {
    return <IsbarLoader overlay message="Loading ISBAR Dashboard..." size={96} />;
  }

  // Derive visible patients: last 24h and by shift
  const isWithinLast24Hours = (iso: string) => {
    const t = parseDateSafe(iso).getTime();
    if (isNaN(t)) return false;
    return Date.now() - t <= 24 * 60 * 60 * 1000;
  };

  const fitsShift = (iso: string) => {
    if (shift === 'All') return true;
    const d = parseDateSafe(iso);
    if (isNaN(d.getTime())) return false;
    const hour = d.getHours();
    if (shift === 'Morning') return hour >= 6 && hour < 14;
    if (shift === 'Evening') return hour >= 14 && hour < 22;
    return hour >= 22 || hour < 6;
  };

  const matchesQuery = (p: any) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const hay = [p.patientName, p.mrn, p.bedNumber, p.assignedNurse, p.diagnosis, p.department]
      .filter(Boolean)
      .map((s: any) => String(s).toLowerCase())
      .join(' ');
    return hay.includes(q);
  };

  const filteredByTimeShift = patients
    .filter(p => isWithinLast24Hours(p.lastHandover) && fitsShift(p.lastHandover));
  const visiblePatients = filteredByTimeShift.filter(matchesQuery);

  return (
    <div className="space-y-6">
      {/* Patient List with Expandable Cards */}
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
                onNewHandover={() => {}}
                expanded={expandAll}
              />
            ))}
          </div>
        )}
      </DashboardSection>

      {/* Resource Handover Status - visible to Admin always, Nurses and Midwives; hidden for GP and Senior */}
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

      {/* Inventory Table for Nurses/Midwives; otherwise show Recent Activity */}
      {isNurseOrMidwife ? (
        <>
        <DashboardSection
          title="Resource Inventory"
          icon={<Package className="w-5 h-5 text-green-600" />}
        >
          {/* Shift summary header with most recent indicator */}
          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {(['Morning','Evening','Night'] as const).map(shiftName => {
              const list = reportsByShift[shiftName];
              const latest = list[0];
              const isRecent = mostRecentShift === shiftName;
              return (
                <div key={shiftName} className={`border rounded-lg p-3 relative ${
                  isRecent 
                    ? 'border-green-300 bg-green-50' 
                    : 'border-gray-200 bg-gray-50'
                }`}>
                  {isRecent && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className={`text-sm font-semibold ${
                      isRecent ? 'text-green-800' : 'text-gray-800'
                    }`}>
                      {shiftName} Shift
                      {isRecent && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                          Latest
                        </span>
                      )}
                    </div>
                    {latest && (
                      <span className={`text-xs ${isRecent ? 'text-green-600' : 'text-gray-500'}`}>
                        {new Date(latest.date).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  <div className={`text-xs mt-1 ${isRecent ? 'text-green-700' : 'text-gray-600'}`}>
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

          {/* Accordion by shift with expand/collapse */}
          <div className="space-y-3 mb-6">
            {(['Morning','Evening','Night'] as const).map(shiftName => {
              const isOpen = expandedResourceShift === shiftName;
              const list = reportsByShift[shiftName];
              const isRecent = mostRecentShift === shiftName;
              return (
                <div key={`accordion-${shiftName}`} className={`border rounded-lg ${
                  isRecent ? 'border-green-300' : 'border-gray-200'
                }`}>
                  <button
                    className={`w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 ${
                      isRecent ? 'bg-green-50' : 'bg-white'
                    }`}
                    onClick={() => setExpandedResourceShift(isOpen ? null : shiftName)}
                  >
                    <div className="flex items-center gap-2">
                      {isOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                      <span className={`text-sm font-medium ${
                        isRecent ? 'text-green-800' : 'text-gray-800'
                      }`}>
                        {shiftName} Reports
                      </span>
                      <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                        isRecent 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {list.length}
                      </span>
                      {isRecent && (
                        <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-green-500 text-white">
                          Latest
                        </span>
                      )}
                    </div>
                    {list[0] && (
                      <span className={`text-xs ${isRecent ? 'text-green-600' : 'text-gray-500'}`}>
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
                          {list.map((report: any) => (
                            <div key={report.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                              {/* Report Header */}
                              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
                                <div className="text-sm font-medium text-gray-800">
                                  Current Report - Saved by {report.staffName}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {new Date(report.date).toLocaleString()}
                                </div>
                              </div>
                              
                              {/* Inventory Items Table */}
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
                                      {report.resources.map((item: any, idx: number) => (
                                        <tr key={`${report.id}-${idx}`} className="hover:bg-gray-50">
                                          <td className="px-3 py-2 border-b">{item.name || '-'}</td>
                                          <td className="px-3 py-2 border-b">{item.type || '-'}</td>
                                          <td className="px-3 py-2 border-b">{item.quantity || '-'}</td>
                                          <td className="px-3 py-2 border-b">{item.standard_quantity || item.standard || '-'}</td>
                                          <td className="px-3 py-2 border-b">{item.unit || '-'}</td>
                                          <td className="px-3 py-2 border-b">
                                            {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : (item.expiry || '-')}
                                          </td>
                                          <td className="px-3 py-2 border-b">{item.batch_number || item.batch || '-'}</td>
                                          <td className="px-3 py-2 border-b">
                                            {(() => {
                                              const qtyNum = Number(item.quantity);
                                              const isLowStock = !isNaN(qtyNum) && qtyNum < 2;
                                              let isExpired = false;
                                              let isNearExpired = false;
                                              const expiry = item.expiry_date || item.expiry;
                                              if (expiry) {
                                                const d = new Date(expiry as any);
                                                if (!isNaN(d.getTime())) {
                                                  const now = new Date();
                                                  const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                                                  isExpired = d < now;
                                                  isNearExpired = !isExpired && diffDays >= 0 && diffDays <= 7;
                                                }
                                              }
                                              const badges: any[] = [];
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
                                                <span className="text-gray-400">-</span>
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
              return (
                <div key={`round-summary-${shiftName}`} className="border rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-gray-800">
                      {shiftName} Shift
                    </div>
                    {latest && (
                      <span className="text-xs text-gray-500">
                        {new Date(latest.date || latest.created_at || Date.now()).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  <div className="text-xs mt-1 text-gray-600">
                    {latest ? (
                      <>Saved by {(latest.staffName || latest.staff_name || 'Unknown')} on {new Date(latest.date || latest.created_at || Date.now()).toLocaleDateString()}</>
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
                <div key={`round-accordion-${shiftName}`} className="border rounded-lg border-gray-200">
                  <button
                    className="w-full flex items-center justify-between px-4 py-2 bg-white hover:bg-gray-50"
                    onClick={() => setExpandedRoundShift(isOpen ? null : shiftName)}
                  >
                    <div className="flex items-center gap-2">
                      {isOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                      <span className="text-sm font-medium text-gray-800">
                        {shiftName} Rounds
                      </span>
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                        {list.length}
                      </span>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-3">
                      {list.length === 0 ? (
                        <div className="text-xs text-gray-500 py-2">No rounds for this shift yet.</div>
                      ) : (
                        <div className="border border-gray-100 rounded-lg p-3 bg-gray-50 text-sm text-gray-700">
                          {/* Placeholder for round details */}
                          Round details coming soon.
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
              const formData = handover.form_data || {};
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
                        {handover.template_name || 'Patient Handover'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {patientName} (MRN: {mrn}) • by {handover.submitted_by_name || handover.submitted_by}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {parseDateSafe(handover.submitted_at).toLocaleString()}
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
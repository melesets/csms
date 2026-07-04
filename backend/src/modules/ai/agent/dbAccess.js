// =============================================================================
// |Adare AI AGENT — Database Access Layer
// =============================================================================
// Safe, read-only database queries for providing live context to the AI agent.
// Only SELECT on known tables. Rows capped at 200. All mutations blocked.
// =============================================================================

import pool from '../../../config/database.js';

const ALLOWED_DB_TABLES = [
  'users',
  'form_templates',
  'form_submissions',
  'isbar_records',
  'department_staff',
  'resources',
  'inventory_reports',
  'dashboard_mappings',
  'terminology_codes',
  'clinical_handovers',
  'shift_sessions',
  'activity',
];

const DANGEROUS_SQL_KEYWORDS = [
  'drop', 'delete', 'insert', 'update', 'alter', 'create', 'truncate',
  'grant', 'revoke', 'execute', 'exec', 'call', 'pragma', 'attach',
  'detach', ' vacuum ', ' reindex ', ' replace ', ' copy ',
];

function isSafeSql(query = '') {
  const normalized = query.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized.startsWith('select')) return false;
  for (const kw of DANGEROUS_SQL_KEYWORDS) {
    if (normalized.includes(kw)) return false;
  }
  const tableRefs = ALLOWED_DB_TABLES.filter(t => normalized.includes(t.toLowerCase()));
  if (tableRefs.length === 0) return false;
  return true;
}

/**
 * Execute a safe read-only query.
 * @param {string} sql   - SELECT query
 * @param {Array}  params - Query parameters
 * @returns {Array} rows (max 200)
 */
export async function safeQuery(sql, params = []) {
  if (!isSafeSql(sql)) {
    throw new Error('Query rejected: only SELECT statements on known tables are allowed.');
  }
  const result = await pool.query(sql, Array.isArray(params) ? params : []);
  return result.rows.slice(0, 200);
}

/**
 * Look up MRN by patient name in form submissions.
 */
export async function lookupMrnByName(name) {
  if (!name || name.length < 3) return null;
  try {
    const result = await safeQuery(
      `SELECT DISTINCT form_data->>'mrn' as mrn
       FROM form_submissions
       WHERE (form_data->>'patientName' ILIKE $1 OR form_data->>'Patient name' ILIKE $1 OR form_data->>'patient_name' ILIKE $1)
       AND form_data->>'mrn' IS NOT NULL
       LIMIT 1`,
      [`%${name}%`],
    );
    return result[0]?.mrn || null;
  } catch (err) {
    console.error('[|Adare] lookupMrnByName error:', err.message);
    return null;
  }
}

/**
 * Fetch full patient history by MRN.
 */
export async function fetchPatientHistory(mrn) {
  if (!mrn || String(mrn).trim() === '') return '';
  let context = '';

  try {
    // 1. Patient profile
    const profile = await safeQuery(
      `SELECT form_data, submitted_at, template_name
       FROM form_submissions
       WHERE form_data->>'mrn' = $1 OR form_data->>'MRN' = $1 OR form_data->>'patient_mrn' = $1
       ORDER BY submitted_at DESC LIMIT 1`,
      [mrn],
    );
    if (profile.length > 0) {
      const d = profile[0].form_data;
      context += `\n[PATIENT PROFILE - MRN: ${mrn}]\n`;
      context += `- Name: ${d.patientName || d['Patient name'] || 'Unknown'}\n`;
      context += `- Age/Gender: ${d.age || '—'} / ${d.gender || '—'}\n`;
      context += `- Bed: ${d.bedNumber || '—'} | Dept: ${d.department || '—'}\n`;
      context += `- Allergies: ${d.allergies || 'None recorded'}\n`;
      context += `- Primary Diagnosis: ${d.diagnosis || 'Not specified'}\n`;
    }

    // 2. ISBAR Handovers
    const handovers = await safeQuery(
      `SELECT shift_name, profession, handover_data, created_at
       FROM clinical_handovers WHERE mrn = $1
       ORDER BY created_at DESC LIMIT 5`,
      [mrn],
    );
    if (handovers.length > 0) {
      context += '\n[RECENT ISBAR HANDOVERS]\n';
      handovers.forEach(r => {
        const d = typeof r.handover_data === 'string' ? JSON.parse(r.handover_data) : r.handover_data;
        context += `- ${new Date(r.created_at).toLocaleString()} (${r.shift_name}, ${r.profession}):\n`;
        if (d.situation) context += `   S: ${d.situation}\n`;
        if (d.background) context += `   B: ${d.background}\n`;
        if (d.assessment) context += `   A: ${d.assessment}\n`;
        if (d.recommendation) context += `   R: ${d.recommendation}\n`;
      });
    }

    // 3. Vital sign trends
    const vitals = await safeQuery(
      `SELECT form_data->>'temperature' as temp, form_data->>'heartRate' as hr,
              form_data->>'bloodPressure' as bp, form_data->>'respiratoryRate' as rr,
              form_data->>'oxygenSaturation' as spo2, submitted_at
       FROM form_submissions
       WHERE (form_data->>'mrn' = $1 OR form_data->>'MRN' = $1)
       AND (form_data->>'temperature' IS NOT NULL OR form_data->>'heartRate' IS NOT NULL)
       ORDER BY submitted_at DESC LIMIT 10`,
      [mrn],
    );
    if (vitals.length > 0) {
      context += '\n[VITAL SIGN TRENDS (Recent → Oldest)]\n';
      vitals.forEach(v => {
        const time = new Date(v.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const date = new Date(v.submitted_at).toLocaleDateString();
        context += `- ${date} ${time}: T:${v.temp || '—'} HR:${v.hr || '—'} BP:${v.bp || '—'} RR:${v.rr || '—'} SpO2:${v.spo2 || '—'}%\n`;
      });
    }

    // 4. Other clinical data
    const misc = await safeQuery(
      `SELECT template_name, form_data, submitted_at
       FROM form_submissions
       WHERE form_data->>'mrn' = $1 OR form_data->>'MRN' = $1
       ORDER BY submitted_at DESC LIMIT 5`,
      [mrn],
    );
    if (misc.length > 0) {
      context += '\n[OTHER RELEVANT RECORDS]\n';
      misc.forEach(r => {
        const d = typeof r.form_data === 'string' ? JSON.parse(r.form_data) : r.form_data;
        context += `- ${r.template_name} (${new Date(r.submitted_at).toLocaleDateString()}):\n`;
        Object.keys(d)
          .filter(k => !['patientName','mrn','age','bedNumber','department','temperature','heartRate','bloodPressure','respiratoryRate','oxygenSaturation'].includes(k)
            && typeof d[k] === 'string' && d[k].length > 5)
          .slice(0, 5)
          .forEach(k => { context += `   ${k}: ${d[k]}\n`; });
      });
    }
  } catch (err) {
    console.error('[|Adare] fetchPatientHistory error:', err.message);
  }

  return context;
}

/**
 * Auto-detect database-related questions and fetch relevant context.
 * Returns a formatted string with live data sections.
 */
export async function fetchDatabaseContext(message = '') {
  const lower = message.toLowerCase();
  const sections = [];

  const kw = {
    patient:     /\b(patient|record|mrn|admission|handover|isbar|submission|bed|ward|discharge|diagnosis|vital|clinical)\b/,
    staff:       /\b(staff|user|employee|nurse|doctor|clinician|worker|team|on.?duty|person|member|people|account|profile)\b/,
    resource:    /\b(resource|inventory|equipment|drug|supply|stock|item|medicine|material|expire|shortage)\b/,
    template:    /\b(template|form|assessment|checklist|survey|questionnaire|field|section)\b/,
    terminology: /\b(code|terminology|icd|loinc|snomed|procedure|classification|coding)\b/,
    department:  /\b(department|dept|unit|ward|section|division|area|floor)\b/,
    shift:       /\b(shift|duty|roster|schedule|morning|evening|night|session|activity|handover)\b/,
    dashboard:   /\b(dashboard|mapping|card|widget|overview|summary|report|statistic|metric|count|how many|total|number|list|show|display|all)\b/,
    general:     /\b(system|database|data|app|application|hospital|adare|info|information|status|what|which|where|who|when|how|recent|latest|current|available|active)\b/,
  };

  const isDbQuestion = Object.values(kw).some(r => r.test(lower));
  if (!isDbQuestion) return '';

  // ── General overview ────────────────────────────────────────────────────
  try {
    const counts = await safeQuery(
      `SELECT
         (SELECT count(*) FROM users) as users_count,
         (SELECT count(*) FROM form_templates) as templates_count,
         (SELECT count(*) FROM form_submissions) as submissions_count,
         (SELECT count(*) FROM isbar_records) as isbar_count,
         (SELECT count(*) FROM resources) as resources_count,
         (SELECT count(*) FROM inventory_reports) as inventory_reports_count,
         (SELECT count(*) FROM terminology_codes) as terminology_count,
         (SELECT count(*) FROM dashboard_mappings) as dashboard_mappings_count,
         (SELECT count(*) FROM department_staff) as dept_staff_count`
    );
    if (counts.length) {
      const c = counts[0];
      sections.push(`[DATABASE OVERVIEW — Record Counts]\n` +
        `- Users/Staff: ${c.users_count}\n- Form Templates: ${c.templates_count}\n` +
        `- Form Submissions: ${c.submissions_count}\n- ISBAR Records: ${c.isbar_count}\n` +
        `- Resources: ${c.resources_count}\n- Inventory Reports: ${c.inventory_reports_count}\n` +
        `- Terminology Codes: ${c.terminology_count}\n- Dashboard Mappings: ${c.dashboard_mappings_count}\n` +
        `- Department Staff: ${c.dept_staff_count}`);
    }
  } catch (e) { console.error('[|Adare] DB overview error:', e.message); }

  // ── Departments ──────────────────────────────────────────────────────────
  if (kw.department.test(lower) || kw.dashboard.test(lower) || kw.general.test(lower)) {
    try {
      const depts = await safeQuery(
        `SELECT DISTINCT department FROM users WHERE department IS NOT NULL AND department != '' ORDER BY department`
      );
      if (depts.length) sections.push(`[DEPARTMENTS]\n${depts.map(d => `- ${d.department}`).join('\n')}`);
      const ds = await safeQuery(
        `SELECT department, count(*) as count FROM department_staff GROUP BY department ORDER BY department`
      );
      if (ds.length) sections.push(`[DEPARTMENT STAFF COUNTS]\n${ds.map(d => `- ${d.department}: ${d.count} staff`).join('\n')}`);
    } catch (e) { console.error('[|Adare] departments error:', e.message); }
  }

  // ── Patients / Records ──────────────────────────────────────────────────
  if (kw.patient.test(lower) || kw.dashboard.test(lower)) {
    try {
      const submissions = await safeQuery(
        `SELECT id, template_name, submitted_by, submitted_at, form_data->>'patientName' as patient_name, form_data->>'mrn' as mrn
         FROM form_submissions ORDER BY submitted_at DESC LIMIT 10`
      );
      if (submissions.length) sections.push(`[RECENT FORM SUBMISSIONS]\n${submissions.map(s =>
        `- ID ${s.id}: ${s.template_name || 'Form'} | Patient: ${s.patient_name || 'N/A'} | MRN: ${s.mrn || 'N/A'} | By: ${s.submitted_by || 'N/A'} | ${new Date(s.submitted_at).toLocaleDateString()}`
      ).join('\n')}`);
      const isbar = await safeQuery(
        `SELECT id, department, form_data->>'patientName' as patient_name, form_data->>'mrn' as mrn, created_at
         FROM isbar_records ORDER BY created_at DESC LIMIT 10`
      );
      if (isbar.length) sections.push(`[RECENT ISBAR RECORDS]\n${isbar.map(r =>
        `- ID ${r.id}: Dept ${r.department || 'General'} | Patient: ${r.patient_name || 'N/A'} | MRN: ${r.mrn || 'N/A'} | ${new Date(r.created_at).toLocaleDateString()}`
      ).join('\n')}`);
    } catch (e) { console.error('[|Adare] patients error:', e.message); }
  }

  // ── Staff ────────────────────────────────────────────────────────────────
  if (kw.staff.test(lower) || kw.dashboard.test(lower)) {
    try {
      const staff = await safeQuery(
        `SELECT id, name, username, role, department, profession, isactive FROM users ORDER BY created_at DESC LIMIT 15`
      );
      if (staff.length) sections.push(`[STAFF / USERS]\n${staff.map(s =>
        `- ${s.name || s.username} | Role: ${s.role} | Dept: ${s.department || '—'} | Profession: ${s.profession || '—'} | Active: ${s.isactive}`
      ).join('\n')}`);
    } catch (e) { console.error('[|Adare] staff error:', e.message); }
  }

  // ── Shifts / Activity ────────────────────────────────────────────────────
  if (kw.shift.test(lower) || kw.staff.test(lower)) {
    try {
      const shifts = await safeQuery(
        `SELECT id, user_id, shift_name, start_time, end_time, is_active FROM shift_sessions ORDER BY start_time DESC LIMIT 10`
      );
      if (shifts.length) sections.push(`[RECENT SHIFT SESSIONS]\n${shifts.map(s =>
        `- ID ${s.id} | User ${s.user_id} | ${s.shift_name} | ${s.start_time || 'N/A'} → ${s.end_time || 'ongoing'} | Active: ${s.is_active}`
      ).join('\n')}`);
    } catch (e) { console.error('[|Adare] shifts error:', e.message); }
    try {
      const activity = await safeQuery(
        `SELECT id, user_id, action, entity_type, entity_id, created_at FROM activity ORDER BY created_at DESC LIMIT 10`
      );
      if (activity.length) sections.push(`[RECENT ACTIVITY LOG]\n${activity.map(a =>
        `- ${a.action} on ${a.entity_type || 'N/A'} #${a.entity_id || 'N/A'} by user ${a.user_id} | ${new Date(a.created_at).toLocaleString()}`
      ).join('\n')}`);
    } catch (e) { console.error('[|Adare] activity error:', e.message); }
  }

  // ── Resources / Inventory ────────────────────────────────────────────────
  if (kw.resource.test(lower) || kw.dashboard.test(lower)) {
    try {
      const resources = await safeQuery(
        `SELECT id, name, type, quantity, standard_quantity, unit, department, expiry_date FROM resources ORDER BY department, name LIMIT 20`
      );
      if (resources.length) sections.push(`[RESOURCES / INVENTORY]\n${resources.map(r =>
        `- ${r.name} (${r.type}) | Qty: ${r.quantity} ${r.unit} (Standard: ${r.standard_quantity}) | Dept: ${r.department} | Exp: ${r.expiry_date || 'N/A'}`
      ).join('\n')}`);
      const reports = await safeQuery(
        `SELECT id, shift, staffName, department, date FROM inventory_reports ORDER BY date DESC LIMIT 5`
      );
      if (reports.length) sections.push(`[RECENT INVENTORY REPORTS]\n${reports.map(r =>
        `- ${r.shift} shift | By: ${r.staffName} | Dept: ${r.department} | ${new Date(r.date).toLocaleDateString()}`
      ).join('\n')}`);
    } catch (e) { console.error('[|Adare] resources error:', e.message); }
  }

  // ── Form Templates ───────────────────────────────────────────────────────
  if (kw.template.test(lower) || kw.dashboard.test(lower)) {
    try {
      const templates = await safeQuery(
        `SELECT id, name, department, description, is_active, version, created_at FROM form_templates ORDER BY created_at DESC LIMIT 10`
      );
      if (templates.length) sections.push(`[FORM TEMPLATES]\n${templates.map(t =>
        `- ${t.name} | Dept: ${t.department} | Active: ${t.is_active} | v${t.version || 1} | ${new Date(t.created_at).toLocaleDateString()}`
      ).join('\n')}`);
    } catch (e) { console.error('[|Adare] templates error:', e.message); }
  }

  // ── Terminology ──────────────────────────────────────────────────────────
  if (kw.terminology.test(lower)) {
    try {
      const codes = await safeQuery(
        `SELECT id, system, code, display, category FROM terminology_codes WHERE is_active = true ORDER BY system, code LIMIT 15`
      );
      if (codes.length) sections.push(`[TERMINOLOGY CODES]\n${codes.map(c =>
        `- [${c.system}] ${c.code}: ${c.display} ${c.category ? '(' + c.category + ')' : ''}`
      ).join('\n')}`);
    } catch (e) { console.error('[|Adare] terminology error:', e.message); }
  }

  // ── Dashboard Mappings ───────────────────────────────────────────────────
  if (kw.dashboard.test(lower)) {
    try {
      const mappings = await safeQuery(
        `SELECT id, form_template_name, department, dashboard_type, display_name, is_enabled FROM dashboard_mappings ORDER BY department LIMIT 10`
      );
      if (mappings.length) sections.push(`[DASHBOARD MAPPINGS]\n${mappings.map(m =>
        `- ${m.display_name} | Template: ${m.form_template_name} | Dept: ${m.department} | Type: ${m.dashboard_type} | Enabled: ${m.is_enabled}`
      ).join('\n')}`);
    } catch (e) { console.error('[|Adare] dashboard error:', e.message); }
  }

  return sections.join('\n\n');
}

export default { safeQuery, lookupMrnByName, fetchPatientHistory, fetchDatabaseContext };

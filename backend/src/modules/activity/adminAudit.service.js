// Admin audit service - unified full-record activity log, analytics, and manual cleanup
// Sources: form_submissions | resources | inventory_reports | admin_activity_log | users
// NOTE: shift check-ins/outs are intentionally excluded — they live on the Check-in Log page.
import pool from '../../config/database.js';

export const ACTIVITY_SOURCES = ['submissions', 'resources', 'inventory', 'admin', 'staff'];

/**
 * Log a privileged/admin action to the admin_activity_log table.
 * @param {Object} params
 * @param {string} params.action    - e.g. 'delete', 'toggle', 'create'
 * @param {string} params.module    - e.g. 'dashboard-mappings', 'users', 'resources'
 * @param {string} [params.targetId] - ID of the affected record
 * @param {string} [params.detail]   - human-readable description
 * @param {string} params.performedBy - username from req.user
 * @param {string} [params.ip]       - client IP address
 */
export async function logAdminAction({ action, module: mod, targetId, detail, performedBy, ip }) {
  try {
    await pool.query(
      `INSERT INTO admin_activity_log (action, module, target_id, detail, performed_by, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [action, mod, targetId || null, detail || null, performedBy || 'unknown', ip || null]
    );
  } catch (err) {
    console.error('[AdminAudit] Failed to log action:', err.message);
  }
}

/**
 * Fetch recent admin activity (for the admin Activity Log page).
 * Login/logout entries are excluded (kept in DB for security).
 * @param {number} limit - max rows to return (default 50)
 */
export async function getRecentActivity(limit = 50) {
  const result = await pool.query(
    `SELECT id, action, module, target_id, detail, performed_by, ip_address, created_at
     FROM admin_activity_log
     WHERE module <> 'auth'
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

const cleanStr = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

// form_submissions.submitted_at and inventory_reports.date are stored as UTC
// wall-clock values (clients send `toISOString()`), while resources.updated_at,
// admin_activity_log.created_at and users.created_at come from DB `now()` (EAT
// wall clock). Shift the first two to EAT wall time so every record displays
// consistent Ethiopian local time, like the rest of the app.
const toEAT = (v) => {
  if (!v) return v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : new Date(d.getTime() + 3 * 3600 * 1000).toISOString();
};

function rangeParams(from, to) {
  // Columns are `timestamp without time zone` (local time) except admin_activity_log (timestamptz)
  return {
    from: from ? `${from}T00:00:00` : null,
    to: to ? `${to}T23:59:59` : null,
  };
}

/**
 * Fetch normalized records from all selected sources with filters.
 */
export async function fetchRecords({ from, to, type, department, person } = {}) {
  const typeFilter = cleanStr(type);
  const deptFilter = cleanStr(department);
  const personFilter = cleanStr(person);
  const { from: fromTs, to: toTs } = rangeParams(cleanStr(from), cleanStr(to));
  const sources = typeFilter && typeFilter !== 'all' ? [typeFilter] : ACTIVITY_SOURCES;
  const records = [];

  if (sources.includes('submissions')) {
    const cond = [];
    const params = [];
    if (fromTs) { params.push(fromTs); cond.push(`fs.submitted_at >= $${params.length}`); }
    if (toTs) { params.push(toTs); cond.push(`fs.submitted_at <= $${params.length}`); }
    if (deptFilter) { params.push(deptFilter); cond.push(`LOWER(fs.template_department) = LOWER($${params.length})`); }
    if (personFilter) { params.push(personFilter); cond.push(`(LOWER(fs.submitted_by_name) = LOWER($${params.length}) OR LOWER(fs.submitted_by) = LOWER($${params.length}))`); }
    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT fs.id, fs.template_name, fs.form_data, fs.submitted_at, fs.submitted_by_name, fs.submitted_by,
              fs.template_department, fs.submitted_by_department, fs.submitted_by_profession, ss.shift_name
       FROM form_submissions fs LEFT JOIN shift_sessions ss ON fs.shift_session_id::text = ss.id::text
       ${where} ORDER BY fs.submitted_at DESC`,
      params
    );
    rows.forEach(r => records.push({
      id: `submissions-${r.id}`,
      type: 'submissions',
      title: r.template_name || 'Report Submitted',
      detail: `Patient: ${r.form_data?.patientName || r.form_data?.patient_name || 'N/A'} (MRN: ${r.form_data?.mrn || r.form_data?.MRN || 'N/A'})`,
      person: r.submitted_by_name || r.submitted_by || 'Unknown',
      department: r.template_department || r.submitted_by_department || null,
      shift: r.shift_name || null,
      timestamp: toEAT(r.submitted_at),
      profession: r.submitted_by_profession || null,
    }));
  }

  if (sources.includes('resources')) {
    const cond = [];
    const params = [];
    if (fromTs) { params.push(fromTs); cond.push(`r.updated_at >= $${params.length}`); }
    if (toTs) { params.push(toTs); cond.push(`r.updated_at <= $${params.length}`); }
    if (deptFilter) { params.push(deptFilter); cond.push(`LOWER(r.department) = LOWER($${params.length})`); }
    if (personFilter) { params.push(personFilter); cond.push(`(LOWER(r.last_updated_by_name) = LOWER($${params.length}) OR LOWER(r.last_updated_by) = LOWER($${params.length}))`); }
    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT r.id, r.name, r.type, r.quantity, r.unit, r.batch_number, r.department, r.updated_at,
              r.last_updated_by_name, r.last_updated_by, ss.shift_name, u_staff.name AS u_name
       FROM resources r
       LEFT JOIN shift_sessions ss ON r.shift_session_id::text = ss.id::text
       LEFT JOIN users u_staff ON (u_staff.username = r.last_updated_by
            OR u_staff.id::text = r.last_updated_by
            OR LOWER(COALESCE(r.last_updated_by_name, '')) = LOWER(u_staff.name))
       ${where} ORDER BY r.updated_at DESC`,
      params
    );
    rows.forEach(r => {
      // Only actual updates count as activity — bulk-seeded rows have no actor
      if (r.last_updated_by || r.last_updated_by_name) records.push({
        id: `resources-${r.id}`,
        type: 'resources',
        title: `Inventory: ${r.name}`,
        detail: `Qty ${r.quantity} ${r.unit}${r.batch_number ? ` · Batch ${r.batch_number}` : ''}`,
        person: r.last_updated_by_name || r.u_name || r.last_updated_by || 'Unknown',
        department: r.department || null,
        shift: r.shift_name || null,
        timestamp: r.updated_at,
        profession: null,
      });
    });
  }

  if (sources.includes('inventory')) {
    const cond = [];
    const params = [];
    if (fromTs) { params.push(fromTs); cond.push(`ir.date >= $${params.length}`); }
    if (toTs) { params.push(toTs); cond.push(`ir.date <= $${params.length}`); }
    if (deptFilter) { params.push(deptFilter); cond.push(`LOWER(ir.department) = LOWER($${params.length})`); }
    if (personFilter) { params.push(personFilter); cond.push(`LOWER(ir.staffname) = LOWER($${params.length})`); }
    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT ir.id, ir.shift, ir.staffname, ir.department, ir.date, ir.resources, ss.shift_name AS session_shift_name
       FROM inventory_reports ir LEFT JOIN shift_sessions ss ON ir.shift_session_id::text = ss.id::text
       ${where} ORDER BY ir.date DESC`,
      params
    );
    rows.forEach(r => records.push({
      id: `inventory-${r.id}`,
      type: 'inventory',
      title: 'Inventory Report',
      detail: `${Array.isArray(r.resources) ? r.resources.length : (r.resources ? Object.keys(r.resources).length : 0)} item(s) recorded`,
      person: r.staffname || 'Unknown',
      department: r.department || null,
      shift: r.session_shift_name || r.shift || null,
      timestamp: toEAT(r.date),
      profession: null,
    }));
  }

  if (sources.includes('admin')) {
    const cond = ["module <> 'auth'"]; // login/logout noise hidden from the Activity Log (kept in DB for security)
    const params = [];
    if (fromTs) { params.push(fromTs); cond.push(`created_at >= $${params.length}::timestamptz`); }
    if (toTs) { params.push(toTs); cond.push(`created_at <= $${params.length}::timestamptz`); }
    if (personFilter) { params.push(personFilter); cond.push(`LOWER(performed_by) = LOWER($${params.length})`); }
    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT id, action, module, target_id, detail, performed_by, ip_address, created_at
       FROM admin_activity_log ${where} ORDER BY created_at DESC`,
      params
    );
    rows.forEach(r => records.push({
      id: `admin-${r.id}`,
      type: 'admin',
      title: `${r.action || 'action'} · ${r.module || 'module'}`,
      detail: r.detail || null,
      person: r.performed_by || 'Unknown',
      department: null,
      shift: null,
      timestamp: r.created_at,
      profession: null,
    }));
  }

  if (sources.includes('staff')) {
    const cond = [];
    const params = [];
    if (fromTs) { params.push(fromTs); cond.push(`u.created_at >= $${params.length}`); }
    if (toTs) { params.push(toTs); cond.push(`u.created_at <= $${params.length}`); }
    if (deptFilter) { params.push(deptFilter); cond.push(`LOWER(u.department) = LOWER($${params.length})`); }
    if (personFilter) { params.push(personFilter); cond.push(`(LOWER(u.name) = LOWER($${params.length}) OR LOWER(u.username) = LOWER($${params.length}) OR LOWER(u.created_by) = LOWER($${params.length}))`); }
    const where = cond.length ? `AND ${cond.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.username, u.profession, u.department, u.created_at, u.created_by,
              u_creator.name AS creator_name
       FROM users u
       LEFT JOIN users u_creator ON (u_creator.username = u.created_by OR u_creator.id::text = u.created_by)
       WHERE u.role = 'staff' ${where} ORDER BY u.created_at DESC`,
      params
    );
    rows.forEach(r => records.push({
      id: `staff-${r.id}`,
      type: 'staff',
      title: `Staff Registered: ${r.name}`,
      detail: `${r.profession || 'No profession'} — account created`,
      person: r.creator_name || r.created_by || 'System',
      department: r.department || null,
      shift: null,
      timestamp: r.created_at,
      profession: r.profession || null,
    }));
  }

  return records;
}

/**
 * Paginated unified record list (admin full-record view).
 */
export async function getAllRecords({ from, to, type, department, person, search, limit = 50, offset = 0 } = {}) {
  let records = await fetchRecords({ from, to, type, department, person });
  records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const q = cleanStr(search);
  if (q) {
    const needle = q.toLowerCase();
    records = records.filter(r =>
      `${r.title} ${r.detail || ''} ${r.person} ${r.department || ''}`.toLowerCase().includes(needle)
    );
  }

  const total = records.length;
  return { records: records.slice(offset, offset + limit), total };
}

/**
 * Real analytics across the full record set in range.
 */
export async function getStats({ from, to, type, department, person } = {}) {
  const records = await fetchRecords({ from, to, type, department, person });

  const byType = {};
  const byUser = {};
  const byDept = {};
  const byDay = {};

  records.forEach(r => {
    byType[r.type] = (byType[r.type] || 0) + 1;
    if (r.person) byUser[r.person] = (byUser[r.person] || 0) + 1;
    if (r.department) byDept[r.department] = (byDept[r.department] || 0) + 1;
    const t = new Date(r.timestamp).getTime();
    if (!isNaN(t)) {
      const d = new Date(t);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      byDay[key] = (byDay[key] || 0) + 1;
    }
  });

  const days = 30;
  const daily = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    daily.push({ date: key, count: byDay[key] || 0 });
  }

  const topUsers = Object.entries(byUser)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const topDepts = Object.entries(byDept)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return { total: records.length, byType, daily, topUsers, topDepts };
}

/**
 * Manually delete records in a range to free database memory.
 * 'staff' source is intentionally not deletable here (accounts);
 * use User Management to deactivate staff instead.
 */
export async function deleteRecords({ from, to, type, department, person, performedBy, ip } = {}) {
  const typeFilter = cleanStr(type);
  const deptFilter = cleanStr(department);
  const personFilter = cleanStr(person);
  const fromVal = cleanStr(from);
  const toVal = cleanStr(to);
  const { from: fromTs, to: toTs } = rangeParams(fromVal, toVal);

  if (!fromTs && !toTs) {
    return { error: 'A date range is required for deletion.', status: 400 };
  }
  if (typeFilter && typeFilter === 'staff') {
    return { error: 'Staff accounts cannot be deleted here — use User Management instead.', status: 400 };
  }

  const sources = typeFilter && typeFilter !== 'all' ? [typeFilter] : ['submissions', 'resources', 'inventory', 'admin'];
  const deleted = {};

  const runDelete = async (sql, params, key) => {
    const result = await pool.query(sql, params);
    deleted[key] = result.rowCount || 0;
  };

  const buildConds = (prefixes) => {
    // prefixes = { from: 'col', to: 'col', dept: 'col', person: 'col', person2?: 'col' }
    const cond = [];
    const params = [];
    const fromCol = prefixes.from || prefixes.from2;
    const toCol = prefixes.to || prefixes.to2;
    if (fromTs && fromCol) { params.push(fromTs); cond.push(`${fromCol} >= $${params.length}`); }
    if (toTs && toCol) { params.push(toTs); cond.push(`${toCol} <= $${params.length}`); }
    if (deptFilter && prefixes.dept) { params.push(deptFilter); cond.push(`LOWER(${prefixes.dept}) = LOWER($${params.length})`); }
    if (personFilter && prefixes.person) { params.push(personFilter); cond.push(`LOWER(${prefixes.person}) = LOWER($${params.length})`); }
    if (personFilter && prefixes.person2) { params.push(personFilter); cond.push(`LOWER(${prefixes.person2}) = LOWER($${params.length})`); }
    return { cond, params };
  };

  if (sources.includes('submissions')) {
    const { cond, params } = buildConds({ from: 'submitted_at', to: 'submitted_at', dept: 'template_department', person: 'submitted_by_name', person2: 'submitted_by' });
    await runDelete(`DELETE FROM form_submissions WHERE ${cond.join(' AND ')}`, params, 'submissions');
  }

  if (sources.includes('resources')) {
    const { cond, params } = buildConds({ from: 'updated_at', to: 'updated_at', dept: 'department', person: 'last_updated_by_name', person2: 'last_updated_by' });
    await runDelete(`DELETE FROM resources WHERE ${cond.join(' AND ')}`, params, 'resources');
  }

  if (sources.includes('inventory')) {
    const { cond, params } = buildConds({ from: 'date', to: 'date', dept: 'department', person: 'staffname' });
    await runDelete(`DELETE FROM inventory_reports WHERE ${cond.join(' AND ')}`, params, 'inventory');
  }

  if (sources.includes('admin')) {
    const cond = [];
    const params = [];
    if (fromTs) { params.push(fromTs); cond.push(`created_at >= $${params.length}::timestamptz`); }
    if (toTs) { params.push(toTs); cond.push(`created_at <= $${params.length}::timestamptz`); }
    if (personFilter) { params.push(personFilter); cond.push(`LOWER(performed_by) = LOWER($${params.length})`); }
    await runDelete(`DELETE FROM admin_activity_log WHERE ${cond.join(' AND ')}`, params, 'admin');
  }

  const total = Object.values(deleted).reduce((a, b) => a + b, 0);
  const deets = `${fromVal || 'beginning'} → ${toVal || 'now'}${deptFilter ? ` · dept: ${deptFilter}` : ''}${personFilter ? ` · person: ${personFilter}` : ''}`;
  try {
    await pool.query(
      `INSERT INTO admin_activity_log (action, module, target_id, detail, performed_by, ip_address)
       VALUES ('delete', 'activity_records', $1, $2, $3, $4)`,
      [range(deleted), `Deleted ${total} record(s) (${deets})`, performedBy || 'admin', ip || null]
    );
  } catch { /* logging must not break the operation */ }

  return { deleted, total };
}
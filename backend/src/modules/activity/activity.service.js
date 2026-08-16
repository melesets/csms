// Activity service - queries user and department activity feeds
import pool from '../../config/database.js';

function diffResources(prevResources, currResources) {
  const prev = new Map((prevResources || []).map(r => [String(r.id), r]));
  const changes = [];
  (currResources || []).forEach(r => {
    const before = prev.get(String(r.id));
    if (!before) return;
    const qtyChanged = Number(before.quantity) !== Number(r.quantity);
    const expChanged = String(before.expiry_date || '') !== String(r.expiry_date || '');
    if (qtyChanged || expChanged) {
      changes.push({
        id: r.id, name: r.name, type: r.type, unit: r.unit,
        qtyBefore: qtyChanged ? before.quantity : null,
        qtyAfter: qtyChanged ? r.quantity : null,
        expBefore: expChanged ? before.expiry_date : null,
        expAfter: expChanged ? r.expiry_date : null,
      });
    }
  });
  return changes;
}

export async function getUserActivity(username) {
  const userResult = await pool.query(
    `SELECT id, username, name FROM users
     WHERE LOWER(username) = LOWER($1) OR LOWER(name) = LOWER($1) OR id::text = $1
     LIMIT 1`,
    [username]
  );
  const staffUser = userResult.rows[0] || null;
  const resolvedUsername = staffUser ? staffUser.username : username;
  const resolvedId = staffUser ? String(staffUser.id) : '';
  const resolvedName = staffUser ? staffUser.name : username;

  const submissionsResult = await pool.query(
    `SELECT fs.id, fs.template_name, fs.submitted_at, fs.submitted_by_name, fs.form_data, fs.shift_session_id, ss.shift_name
     FROM form_submissions fs
     LEFT JOIN shift_sessions ss ON fs.shift_session_id::text = ss.id::text
     WHERE fs.submitted_by = $1 OR fs.submitted_by = $2 OR LOWER(COALESCE(fs.submitted_by_name, '')) = LOWER($3)
     ORDER BY fs.submitted_at DESC LIMIT 50`,
    [resolvedUsername, resolvedId, resolvedName]
  );
  const resourcesResult = await pool.query(
    `SELECT r.id, r.name, r.type, r.quantity, r.unit, r.batch_number, r.expiry_date, r.department, r.updated_at, r.last_updated_by, r.last_updated_by_name, r.shift_session_id, ss.shift_name
     FROM resources r
     LEFT JOIN shift_sessions ss ON r.shift_session_id::text = ss.id::text
     WHERE LOWER(r.last_updated_by) = LOWER($1) OR r.last_updated_by = $2 OR LOWER(COALESCE(r.last_updated_by_name, '')) = LOWER($3)
     ORDER BY r.updated_at DESC LIMIT 50`,
    [resolvedUsername, resolvedId, resolvedName]
  );
  const reportsResult = await pool.query(
    `SELECT ir.id, ir.shift, ir.staffname AS "staffName", ir.date, ir.shift_session_id, ir.resources, ir.co_signers, ir.department, ss.shift_name as session_shift_name
     FROM inventory_reports ir
     LEFT JOIN shift_sessions ss ON ir.shift_session_id::text = ss.id::text
     WHERE LOWER(ir.staffname) = LOWER($1) OR LOWER(ir.staffname) = LOWER($3) OR ir.staffname = $2
     ORDER BY ir.date DESC LIMIT 50`,
    [resolvedUsername, resolvedId, resolvedName]
  );
  const shiftsResult = await pool.query(
    `SELECT id, username, profession, ward, shift_name, start_time, end_time
     FROM shift_sessions
     WHERE username = $1
     ORDER BY start_time DESC LIMIT 50`,
    [resolvedUsername]
  );
  const staffResult = await pool.query(
    `SELECT id, name, username, profession, department, created_at, created_by
     FROM users
     WHERE created_by = $1
     ORDER BY created_at DESC LIMIT 50`,
    [resolvedUsername]
  );

  const allReportsResult = await pool.query(
    `SELECT id, date, resources FROM inventory_reports
     WHERE LOWER(staffname) = LOWER($1) OR LOWER(staffname) = LOWER($2) OR staffname = $3
     ORDER BY date ASC`,
    [resolvedUsername, resolvedName, resolvedId]
  );
  const prevReportByDate = new Map();
  for (let i = 1; i < allReportsResult.rows.length; i++) {
    prevReportByDate.set(allReportsResult.rows[i].id, allReportsResult.rows[i - 1].resources);
  }

  return {
    submissions: (submissionsResult.rows || []).map(row => ({
      ...row,
      patient_name: row.form_data?.patientName || row.form_data?.patient_name || 'N/A',
      mrn: row.form_data?.mrn || row.form_data?.MRN || 'N/A',
      submitted_by: row.submitted_by_name || resolvedUsername,
      staff_username: resolvedUsername,
      shift_name: row.shift_name || 'Unknown',
    })),
    resourceUpdates: resourcesResult.rows.map(r => ({
      ...r, date: r.updated_at, submitted_by: r.last_updated_by_name || r.last_updated_by || 'Unknown', staff_username: resolvedUsername, shift_name: r.shift_name || 'Unknown',
    })),
    inventoryReports: reportsResult.rows.map(ir => ({
      ...ir,
      submitted_by: ir.staffName || ir.staffname || 'Unknown',
      staff_username: resolvedUsername,
      shift_name: ir.shift_name || ir.session_shift_name || ir.shift || 'Unknown',
      changes: diffResources(prevReportByDate.get(ir.id), ir.resources),
    })),
    shiftEvents: shiftsResult.rows || [],
    staffCreated: staffResult.rows.map(s => ({
      ...s, submitted_by: s.created_by || 'Unknown',
    })),
  };
}

export async function getDepartmentActivity(department, parentUserId) {
  const staffJoin = (table, byCol, nameCol) => `
    LEFT JOIN users u_staff ON u_staff.role = 'staff'
      AND (u_staff.username = ${table}.${byCol}
           OR u_staff.id::text = ${table}.${byCol}
           OR LOWER(COALESCE(${table}.${nameCol}, '')) = LOWER(u_staff.name))`;

  let submissionsQuery = `SELECT fs.id, fs.template_name, fs.submitted_at, fs.submitted_by_name, fs.form_data, fs.shift_session_id, ss.shift_name,
    u_staff.username AS staff_username, u_staff.name AS staff_name
    FROM form_submissions fs LEFT JOIN shift_sessions ss ON fs.shift_session_id::text = ss.id::text
    ${staffJoin('fs', 'submitted_by', 'submitted_by_name')}`;
  let resourcesQuery = `SELECT r.id, r.name, r.type, r.quantity, r.unit, r.batch_number, r.expiry_date, r.department, r.updated_at, r.last_updated_by, r.shift_session_id, ss.shift_name,
    u_staff.username AS staff_username, u_staff.name AS staff_name
    FROM resources r LEFT JOIN shift_sessions ss ON r.shift_session_id::text = ss.id::text
    ${staffJoin('r', 'last_updated_by', 'last_updated_by_name')}`;
  let reportsQuery = `SELECT ir.id, ir.shift, ir.staffname AS "staffName", ir.date, ir.shift_session_id, ir.resources, ir.co_signers, ir.department, ss.shift_name as session_shift_name,
    u_staff.username AS staff_username, u_staff.name AS staff_name
    FROM inventory_reports ir LEFT JOIN shift_sessions ss ON ir.shift_session_id::text = ss.id::text
    ${staffJoin('ir', 'staffname', 'staffname')}`;
  let shiftsQuery = `SELECT id, username, profession, ward, shift_name, start_time, end_time
    FROM shift_sessions`;
  let staffQuery = `SELECT id, name, username, profession, department, created_at, created_by
    FROM users WHERE role = 'staff'`;

  const submissionsParams = [];
  const resourcesParams = [];
  const reportsParams = [];
  const shiftsParams = [];
  const staffParams = [];
  const submissionsConditions = [];
  const resourcesConditions = [];
  const reportsConditions = [];
  const shiftsConditions = [];
  const staffConditions = [];

  if (department !== 'All') {
    submissionsConditions.push('LOWER(fs.template_department) = LOWER($' + (submissionsParams.length + 1) + ')');
    resourcesConditions.push('LOWER(r.department) = LOWER($' + (resourcesParams.length + 1) + ')');
    reportsConditions.push('LOWER(ir.department) = LOWER($' + (reportsParams.length + 1) + ')');
    shiftsConditions.push('LOWER(ward) = LOWER($' + (shiftsParams.length + 1) + ')');
    staffConditions.push('LOWER(department) = LOWER($' + (staffParams.length + 1) + ')');
    submissionsParams.push(department);
    resourcesParams.push(department);
    reportsParams.push(department);
    shiftsParams.push(department);
    staffParams.push(department);
  }

  if (parentUserId) {
    submissionsConditions.push(`(fs.submitted_by IN (SELECT username FROM users WHERE parent_user_id = $${submissionsParams.length + 1}) OR fs.submitted_by = (SELECT username FROM users WHERE id = $${submissionsParams.length + 1}))`);
    submissionsParams.push(parentUserId);
    shiftsConditions.push(`(username IN (SELECT username FROM users WHERE parent_user_id = $${shiftsParams.length + 1}) OR username = (SELECT username FROM users WHERE id = $${shiftsParams.length + 1}))`);
    shiftsParams.push(parentUserId);
    staffConditions.push(`(created_by IN (SELECT username FROM users WHERE parent_user_id = $${staffParams.length + 1}) OR created_by = (SELECT username FROM users WHERE id = $${staffParams.length + 1}))`);
    staffParams.push(parentUserId);
  }

  if (submissionsConditions.length) submissionsQuery += ' WHERE ' + submissionsConditions.join(' AND ');
  if (resourcesConditions.length) resourcesQuery += ' WHERE ' + resourcesConditions.join(' AND ');
  if (reportsConditions.length) reportsQuery += ' WHERE ' + reportsConditions.join(' AND ');
  if (shiftsConditions.length) shiftsQuery += ' WHERE ' + shiftsConditions.join(' AND ');
  if (staffConditions.length) staffQuery += ' AND ' + staffConditions.join(' AND ');

  const [submissionsResult, resourcesResult, reportsResult, shiftsResult, staffResult] = await Promise.all([
    pool.query(submissionsQuery + ' ORDER BY fs.submitted_at DESC LIMIT 50', submissionsParams),
    pool.query(resourcesQuery + ' ORDER BY r.updated_at DESC LIMIT 50', resourcesParams),
    pool.query(reportsQuery + ' ORDER BY ir.date DESC LIMIT 50', reportsParams),
    pool.query(shiftsQuery + ' ORDER BY start_time DESC LIMIT 50', shiftsParams),
    pool.query(staffQuery + ' ORDER BY created_at DESC LIMIT 50', staffParams),
  ]);

  const allReportsResult = await pool.query(
    `SELECT ir.id, ir.date, ir.resources FROM inventory_reports ir
     ${reportsConditions.length ? 'WHERE ' + reportsConditions.join(' AND ') : ''}
     ORDER BY ir.date ASC`,
    reportsParams
  );
  const prevReportByDate = new Map();
  for (let i = 1; i < allReportsResult.rows.length; i++) {
    prevReportByDate.set(allReportsResult.rows[i].id, allReportsResult.rows[i - 1].resources);
  }

  return {
    submissions: submissionsResult.rows.map(row => ({
      ...row,
      patient_name: row.form_data?.patientName || row.form_data?.patient_name || 'N/A',
      mrn: row.form_data?.mrn || row.form_data?.MRN || 'N/A',
      submitted_by: row.submitted_by_name || row.submitted_by || 'Unknown',
    })),
    resourceUpdates: resourcesResult.rows.map(r => ({
      ...r,
      submitted_by: r.last_updated_by_name || r.last_updated_by || 'Unknown',
    })),
    inventoryReports: reportsResult.rows.map(ir => ({
      ...ir,
      submitted_by: ir.staffName || ir.staffname || ir.submitted_by || 'Unknown',
      shift_name: ir.shift_name || ir.session_shift_name || ir.shift || 'Unknown',
      changes: diffResources(prevReportByDate.get(ir.id), ir.resources),
    })),
    shiftEvents: shiftsResult.rows || [],
    staffCreated: staffResult.rows.map(s => ({
      ...s, submitted_by: s.created_by || 'Unknown',
    })),
  };
}

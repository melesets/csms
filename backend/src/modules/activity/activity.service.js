// Activity service - queries user and department activity feeds
import pool from '../../config/database.js';

export async function getUserActivity(username) {
  const submissionsResult = await pool.query(
    `SELECT fs.id, fs.template_name, fs.submitted_at, fs.submitted_by_name, fs.form_data, ss.shift_name
     FROM form_submissions fs
     LEFT JOIN shift_sessions ss ON fs.shift_session_id::text = ss.id::text
     WHERE fs.submitted_by = $1 
     ORDER BY fs.submitted_at DESC LIMIT 20`,
    [username]
  );
  const resourcesResult = await pool.query(
    `SELECT r.id, r.name, r.type, r.quantity, r.unit, r.updated_at, r.last_updated_by, ss.shift_name
     FROM resources r
     LEFT JOIN shift_sessions ss ON r.shift_session_id::text = ss.id::text
     WHERE r.last_updated_by = $1 
     ORDER BY r.updated_at DESC LIMIT 20`,
    [username]
  );

  return {
    submissions: (submissionsResult.rows || []).map(row => ({
      ...row,
      patient_name: row.form_data?.patientName || row.form_data?.patient_name || 'N/A',
      mrn: row.form_data?.mrn || row.form_data?.MRN || 'N/A',
      submitted_by: row.submitted_by_name || username,
      shift_name: row.shift_name || 'Unknown',
    })),
    resourceUpdates: resourcesResult.rows.map(r => ({
      ...r, date: r.updated_at, submitted_by: r.last_updated_by, shift_name: r.shift_name || 'Unknown',
    })),
  };
}

export async function getDepartmentActivity(department) {
  let submissionsQuery = `SELECT fs.id, fs.template_name, fs.submitted_at, fs.submitted_by_name, fs.form_data, ss.shift_name
    FROM form_submissions fs LEFT JOIN shift_sessions ss ON fs.shift_session_id::text = ss.id::text`;
  let resourcesQuery = `SELECT r.id, r.name, r.type, r.quantity, r.unit, r.updated_at, r.last_updated_by, ss.shift_name
    FROM resources r LEFT JOIN shift_sessions ss ON r.shift_session_id::text = ss.id::text`;
  let reportsQuery = `SELECT ir.id, ir.shift, ir."staffName", ir.date, ir.shift_session_id, ss.shift_name as session_shift_name
    FROM inventory_reports ir LEFT JOIN shift_sessions ss ON ir.shift_session_id::text = ss.id::text`;

  const params = [];
  if (department !== 'All') {
    submissionsQuery += ' WHERE fs.template_department = $1';
    resourcesQuery += ' WHERE r.department = $1';
    reportsQuery += ' WHERE ir.department = $1';
    params.push(department);
  }

  const [submissionsResult, resourcesResult, reportsResult] = await Promise.all([
    pool.query(submissionsQuery + ' ORDER BY fs.submitted_at DESC LIMIT 30', params),
    pool.query(resourcesQuery + ' ORDER BY r.updated_at DESC LIMIT 30', params),
    pool.query(reportsQuery + ' ORDER BY ir.date DESC LIMIT 30', params),
  ]);

  return {
    submissions: submissionsResult.rows.map(row => ({
      ...row,
      patient_name: row.form_data?.patientName || row.form_data?.patient_name || 'N/A',
      mrn: row.form_data?.mrn || row.form_data?.MRN || 'N/A',
    })),
    resourceUpdates: resourcesResult.rows,
    inventoryReports: reportsResult.rows,
  };
}

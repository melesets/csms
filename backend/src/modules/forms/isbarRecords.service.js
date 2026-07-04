// ISBAR records service - saves and queries ISBAR form submissions
// Handles isbar_records table for structured handover data

import pool from '../../config/database.js';

export async function saveIsbarRecord(data) {
  const { department, submitted_by, submitted_by_name, shift_session_id } = data;
  const result = await pool.query(
    'INSERT INTO isbar_records (department, form_data, submitted_by, submitted_by_name, shift_session_id, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *',
    [department || 'General', data, submitted_by || null, submitted_by_name || null, shift_session_id || null]
  );
  return result.rows[0];
}

export async function findIsbarRecords(filters) {
  const { department, mrn } = filters;
  let query = 'SELECT * FROM isbar_records';
  const conditions = [];
  const params = [];

  if (department) {
    conditions.push('department = $' + (params.length + 1));
    params.push(department);
  }
  if (mrn) {
    conditions.push(`form_data->>'mrn' = $${params.length + 1}`);
    params.push(mrn);
  }
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY created_at DESC';
  const result = await pool.query(query, params);
  return result.rows.map(row => row.form_data);
}

// Form submissions service - CRUD for dynamic form data
// Manages form_submissions table operations with filtering and pagination

import pool from '../../config/database.js';

export async function createSubmission(data) {
  const {
    template_id, template_name, template_department, form_data,
    submitted_by, submitted_by_name, submitted_by_department,
    submitted_by_profession, submitted_at, shift_session_id,
  } = data;

  const result = await pool.query(
    `INSERT INTO form_submissions (
      template_id, template_name, template_department, form_data,
      submitted_by, submitted_by_name, submitted_by_department,
      submitted_by_profession, submitted_at, shift_session_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [
      template_id, template_name, template_department, JSON.stringify(form_data),
      submitted_by, submitted_by_name, submitted_by_department,
      submitted_by_profession || null, submitted_at || new Date().toISOString(),
      shift_session_id || null,
    ]
  );
  return result.rows[0];
}

export async function findSubmissions(filters) {
  const { formId, department, user, limit, timeframe, profession } = filters;

  let query = `
    SELECT s.*, t.name as template_name, t.department as template_department, t.profession as template_profession
    FROM form_submissions s
    LEFT JOIN form_templates t ON s.template_id = t.id
    WHERE 1=1
  `;
  const params = [];
  let idx = 1;

  if (formId) {
    query += ` AND s.template_id = $${idx++}`;
    params.push(formId);
  }
  if (department) {
    query += ` AND (s.template_department = $${idx} OR t.department = $${idx + 1})`;
    params.push(department, department);
    idx += 2;
  }
  if (user) {
    query += ` AND s.submitted_by = $${idx++}`;
    params.push(user);
  }
  if (profession) {
    query += ` AND (s.submitted_by_profession = $${idx} AND (t.profession = $${idx} OR t.profession IS NULL))`;
    params.push(profession);
    idx += 1;
  }
  if (timeframe) {
    const tf = String(timeframe).toLowerCase();
    const days = tf === 'week' ? 7 : tf === 'month' ? 30 : tf === 'quarter' ? 90 : null;
    if (days) {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      query += ` AND s.submitted_at >= $${idx++}`;
      params.push(cutoff.toISOString());
    }
  }

  query += ' ORDER BY s.submitted_at DESC';
  if (limit) {
    query += ` LIMIT $${idx++}`;
    params.push(parseInt(limit));
  }

  const result = await pool.query(query, params);
  return result.rows;
}

export async function findSubmissionById(id) {
  const result = await pool.query(
    `SELECT s.*, t.name as template_name, t.department as template_department
     FROM form_submissions s
     LEFT JOIN form_templates t ON s.template_id = t.id
     WHERE s.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

export async function updateSubmission(id, data) {
  const { form_data, shift_session_id } = data;
  const result = await pool.query(
    'UPDATE form_submissions SET form_data = $1, shift_session_id = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
    [JSON.stringify(form_data), shift_session_id || null, id]
  );
  return result.rows[0] || null;
}

export async function deleteSubmission(id) {
  const result = await pool.query('DELETE FROM form_submissions WHERE id = $1 RETURNING *', [id]);
  return result.rows.length > 0;
}

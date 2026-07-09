// Form submissions service - CRUD for dynamic form data
// Manages form_submissions table operations with filtering and pagination

import pool from '../../config/database.js';

function stripAIContent(form_data) {
  if (!form_data || typeof form_data !== 'object') return form_data;
  const cleaned = {};
  for (const [k, v] of Object.entries(form_data)) {
    if (k.length > 200) continue;
    if (/^#{2,3}\s/.test(k)) continue;
    if (k.includes('|Adare') || k.includes('Clinical Summary') || k.includes('Urgent Assessment')) continue;
    if (typeof v === 'string' && v.length > 2000 && (v.includes('|Adare') || v.includes('Clinical Summary'))) continue;
    cleaned[k] = v;
  }
  return cleaned;
}

export async function createSubmission(data) {
  const {
    template_id, template_name, template_department, form_data,
    submitted_by, submitted_by_name, submitted_by_department,
    submitted_by_profession, submitted_at, shift_session_id,
  } = data;

  const cleanedFormData = stripAIContent(form_data);

  const result = await pool.query(
    `INSERT INTO form_submissions (
      template_id, template_name, template_department, form_data,
      submitted_by, submitted_by_name, submitted_by_department,
      submitted_by_profession, submitted_at, shift_session_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [
      template_id, template_name, template_department, JSON.stringify(cleanedFormData),
      submitted_by, submitted_by_name, submitted_by_department,
      submitted_by_profession || null, submitted_at || new Date().toISOString(),
      shift_session_id || null,
    ]
  );
  return result.rows[0];
}

export async function findSubmissions(filters) {
  const { formId, department, user, limit, timeframe, profession, dateFrom, dateTo, search, mrn, page, offset, cursor } = filters;

  const baseWhere = [];
  const baseParams = [];
  let idx = 1;

  if (formId) {
    baseWhere.push(`s.template_id = $${idx++}`);
    baseParams.push(formId);
  }
  if (department) {
    baseWhere.push(`(s.template_department = $${idx} OR t.department = $${idx + 1})`);
    baseParams.push(department, department);
    idx += 2;
  }
  if (user) {
    baseWhere.push(`s.submitted_by = $${idx++}`);
    baseParams.push(user);
  }
  if (profession) {
    baseWhere.push(`(s.submitted_by_profession = $${idx} AND (t.profession = $${idx} OR t.profession IS NULL))`);
    baseParams.push(profession);
    idx += 1;
  }
  if (timeframe) {
    const tf = String(timeframe).toLowerCase();
    const days = tf === 'today' ? 0 : tf === 'week' ? 7 : tf === 'month' ? 30 : tf === 'quarter' ? 90 : tf === 'year' ? 365 : tf === '5year' ? 1825 : null;
    if (days !== null) {
      const cutoff = days === 0 ? new Date() : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      baseWhere.push(`s.submitted_at >= $${idx++}`);
      baseParams.push(cutoff.toISOString());
    }
  }
  if (dateFrom) {
    baseWhere.push(`s.submitted_at >= $${idx++}`);
    baseParams.push(dateFrom);
  }
  if (dateTo) {
    baseWhere.push(`s.submitted_at <= $${idx++}`);
    baseParams.push(dateTo + 'T23:59:59.999Z');
  }
  if (search) {
    baseWhere.push(`(
      s.form_data::text ILIKE $${idx}
      OR s.submitted_by ILIKE $${idx}
      OR s.submitted_by_name ILIKE $${idx}
      OR s.template_name ILIKE $${idx}
      OR s.form_data->>'MRN' ILIKE $${idx}
      OR s.form_data->>'mrn' ILIKE $${idx}
      OR s.form_data->>'patient_mrn' ILIKE $${idx}
      OR s.form_data->>'patientName' ILIKE $${idx}
      OR s.form_data->>'patientname' ILIKE $${idx}
    )`);
    baseParams.push(`%${search}%`);
    idx += 1;
  }
  if (mrn) {
    baseWhere.push(`(s.form_data->>'MRN' ILIKE $${idx} OR s.form_data->>'mrn' ILIKE $${idx} OR s.form_data->>'patient_mrn' ILIKE $${idx} OR s.form_data->>'patientMrn' ILIKE $${idx})`);
    baseParams.push(`%${mrn}%`);
    idx += 1;
  }

  const whereClause = baseWhere.length > 0 ? 'WHERE ' + baseWhere.join(' AND ') : '';
  const joinClause = 'LEFT JOIN form_templates t ON s.template_id = t.id';

  // Cursor-based pagination (keyset) — efficient for large offsets
  if (cursor) {
    const cursorQuery = `
      SELECT s.*, t.name as template_name, t.department as template_department, t.profession as template_profession
      FROM form_submissions s ${joinClause}
      ${whereClause ? whereClause + ' AND' : 'WHERE'} s.submitted_at < $${idx++}
      ORDER BY s.submitted_at DESC
      LIMIT $${idx++}
    `;
    const cursorParams = [...baseParams, cursor, Math.min(parseInt(limit) || 100, 1000)];
    const result = await pool.query(cursorQuery, cursorParams);
    return { data: result.rows, total: -1, cursor: result.rows.length > 0 ? result.rows[result.rows.length - 1].submitted_at : null };
  }

  // Standard offset-based pagination
  let countQuery = `SELECT COUNT(*)::int as total FROM form_submissions s ${joinClause} ${whereClause}`;
  const countResult = await pool.query(countQuery, baseParams);
  const total = countResult.rows[0]?.total || 0;

  let dataQuery = `
    SELECT s.*, t.name as template_name, t.department as template_department, t.profession as template_profession
    FROM form_submissions s ${joinClause}
    ${whereClause}
    ORDER BY s.submitted_at DESC
  `;

  const effectiveLimit = Math.min(parseInt(limit) || 50, 10000);
  if (offset) {
    dataQuery += ` LIMIT $${idx++} OFFSET $${idx++}`;
    baseParams.push(effectiveLimit, parseInt(offset));
  } else if (page) {
    const pageNum = Math.max(1, parseInt(page) || 1);
    const skip = (pageNum - 1) * effectiveLimit;
    dataQuery += ` LIMIT $${idx++} OFFSET $${idx++}`;
    baseParams.push(effectiveLimit, skip);
  } else if (limit) {
    dataQuery += ` LIMIT $${idx++}`;
    baseParams.push(effectiveLimit);
  }

  const result = await pool.query(dataQuery, baseParams);
  return { data: result.rows, total, page: parseInt(page) || 1, limit: effectiveLimit };
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

// Form templates service - CRUD for dynamic form templates with department/profession filtering

import pool from '../../config/database.js';

let hasDepartmentsColCache = null;
async function hasDepartmentsColumn() {
  if (hasDepartmentsColCache !== null) return hasDepartmentsColCache;
  try {
    const q = `SELECT 1 FROM information_schema.columns WHERE table_name = 'form_templates' AND column_name = 'departments' LIMIT 1`;
    const r = await pool.query(q);
    hasDepartmentsColCache = r.rowCount > 0;
    return hasDepartmentsColCache;
  } catch {
    hasDepartmentsColCache = false;
    return false;
  }
}

export async function findAllTemplates(department, profession) {
  let query = 'SELECT * FROM form_templates';
  const conditions = [];
  const params = [];
  const hasDepts = await hasDepartmentsColumn();

  if (department) {
    if (hasDepts) {
      conditions.push(`(department = $${params.length + 1} OR $${params.length + 1} = ANY(departments))`);
    } else {
      conditions.push(`department = $${params.length + 1}`);
    }
    params.push(department);
  }
  if (profession) {
    const p = String(profession).toLowerCase().trim();
    let aliases = [p];
    if (['gp', 'g.p', 'general practitioner'].includes(p)) {
      aliases = ['gp', 'g.p', 'general practitioner', 'general-practitioner'];
    } else if (['sp', 'senior', 'senior physician', 'physician'].includes(p)) {
      aliases = ['sp', 'senior', 'senior physician', 'senior-physician', 'physician'];
    } else if (['nurse', 'nursing'].includes(p)) {
      aliases = ['nurse', 'nursing'];
    } else if (['midwife', 'midwifery'].includes(p)) {
      aliases = ['midwife', 'midwifery'];
    }
    conditions.push(`LOWER(profession) = ANY($${params.length + 1})`);
    params.push(aliases);
  }
  if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY created_at DESC';
  const result = await pool.query(query, params);
  return result.rows;
}

export async function findActiveTemplate(department, profession) {
  const hasDepts = await hasDepartmentsColumn();
  let result;
  if (profession) {
    if (hasDepts) {
      result = await pool.query(
        `SELECT * FROM form_templates WHERE (department = $1 OR $1 = ANY(departments)) AND is_active = true AND (profession = $2 OR profession IS NULL) ORDER BY (profession IS NULL) ASC LIMIT 1`,
        [department, profession]
      );
    } else {
      result = await pool.query(
        `SELECT * FROM form_templates WHERE department = $1 AND is_active = true AND (profession = $2 OR profession IS NULL) ORDER BY (profession IS NULL) ASC LIMIT 1`,
        [department, profession]
      );
    }
  } else {
    if (hasDepts) {
      result = await pool.query('SELECT * FROM form_templates WHERE (department = $1 OR $1 = ANY(departments)) AND is_active = true LIMIT 1', [department]);
    } else {
      result = await pool.query('SELECT * FROM form_templates WHERE department = $1 AND is_active = true LIMIT 1', [department]);
    }
  }
  return result.rows[0] || null;
}

export async function createTemplate(data) {
  const hasDepts = await hasDepartmentsColumn();
  const departments = Array.isArray(data.departments) ? data.departments.filter(d => !!d) : (data.department ? [data.department] : null);
  const primaryDepartment = departments?.[0] || data.department || null;

  let result;
  if (hasDepts) {
    result = await pool.query(
      `INSERT INTO form_templates (name, department, departments, profession, description, fields, sections, is_active, created_by, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [data.name, primaryDepartment, departments, data.profession ?? null, data.description || '', JSON.stringify(data.fields || []), JSON.stringify(data.sections || []), data.isActive !== undefined ? data.isActive : true, data.createdBy || 'admin', data.version || 1]
    );
  } else {
    result = await pool.query(
      `INSERT INTO form_templates (name, department, profession, description, fields, sections, is_active, created_by, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [data.name, primaryDepartment, data.profession ?? null, data.description || '', JSON.stringify(data.fields || []), JSON.stringify(data.sections || []), data.isActive !== undefined ? data.isActive : true, data.createdBy || 'admin', data.version || 1]
    );
  }
  return result.rows[0];
}

export async function updateTemplate(id, data) {
  const hasDepts = await hasDepartmentsColumn();
  const departments = Array.isArray(data.departments) ? data.departments.filter(d => !!d) : (data.department ? [data.department] : null);
  const primaryDepartment = (departments && departments[0]) || data.department || null;

  let result;
  if (hasDepts) {
    result = await pool.query(
      `UPDATE form_templates SET name = COALESCE($1, name), department = COALESCE($2, department), departments = COALESCE($3, departments),
       profession = COALESCE($4, profession), description = COALESCE($5, description), fields = COALESCE($6, fields),
       sections = COALESCE($7, sections), is_active = COALESCE($8, is_active), version = COALESCE($9, version), updated_at = NOW()
       WHERE id = $10 RETURNING *`,
      [data.name ?? null, primaryDepartment, departments ?? null, data.profession ?? null, data.description ?? null,
       data.fields !== undefined ? JSON.stringify(data.fields) : null, data.sections !== undefined ? JSON.stringify(data.sections) : null,
       data.isActive !== undefined ? data.isActive : null, data.version !== undefined ? data.version : null, id]
    );
  } else {
    result = await pool.query(
      `UPDATE form_templates SET name = COALESCE($1, name), department = COALESCE($2, department), profession = COALESCE($3, profession),
       description = COALESCE($4, description), fields = COALESCE($5, fields), sections = COALESCE($6, sections),
       is_active = COALESCE($7, is_active), version = COALESCE($8, version), updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [data.name ?? null, primaryDepartment, data.profession ?? null, data.description ?? null,
       data.fields !== undefined ? JSON.stringify(data.fields) : null, data.sections !== undefined ? JSON.stringify(data.sections) : null,
       data.isActive !== undefined ? data.isActive : null, data.version !== undefined ? data.version : null, id]
    );
  }
  return result.rows[0] || null;
}

export async function setActive(id) {
  await pool.query('UPDATE form_templates SET is_active = true WHERE id = $1', [id]);
  const result = await pool.query('SELECT * FROM form_templates WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function deleteTemplate(id) {
  const result = await pool.query('DELETE FROM form_templates WHERE id = $1 RETURNING *', [id]);
  return result.rows.length > 0;
}

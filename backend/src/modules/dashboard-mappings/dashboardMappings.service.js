import pool from '../../config/database.js';

const createTableQuery = `
  CREATE TABLE IF NOT EXISTS dashboard_mappings (
    id SERIAL PRIMARY KEY,
    form_template_id INTEGER REFERENCES form_templates(id) ON DELETE CASCADE,
    form_template_name VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL,
    departments TEXT[],
    profession VARCHAR(50),
    dashboard_type VARCHAR(20) NOT NULL CHECK (dashboard_type IN ('patient', 'resource')),
    display_name VARCHAR(255) NOT NULL,
    identifier VARCHAR(100),
    card_fields JSONB NOT NULL DEFAULT '{}',
    group_by_field VARCHAR(100),
    is_enabled BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
`;

let tableInitialized = false;

async function ensureTable() {
  if (tableInitialized) return;
  try {
    await pool.query(createTableQuery);
    await pool.query(`ALTER TABLE IF EXISTS dashboard_mappings ADD COLUMN IF NOT EXISTS profession VARCHAR(50);`);
    await pool.query(`ALTER TABLE IF EXISTS dashboard_mappings ADD COLUMN IF NOT EXISTS departments TEXT[];`);
    await pool.query(`ALTER TABLE IF EXISTS dashboard_mappings ADD COLUMN IF NOT EXISTS identifier VARCHAR(100);`);
    tableInitialized = true;
  } catch (err) {
    console.error('Error creating dashboard_mappings table:', err.message);
  }
}

ensureTable();

function toCamel(row) {
  if (!row) return row;
  return {
    id: row.id,
    formTemplateId: row.form_template_id,
    formTemplateName: row.form_template_name,
    department: row.department,
    departments: row.departments,
    profession: row.profession,
    dashboardType: row.dashboard_type,
    displayName: row.display_name,
    identifier: row.identifier,
    cardFields: row.card_fields,
    groupByField: row.group_by_field,
    isEnabled: row.is_enabled,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    currentTemplateName: row.current_template_name,
    templateIsActive: row.template_is_active,
    fields: row.fields,
    sections: row.sections,
  };
}

export async function findAllMappings() {
  const result = await pool.query(`
    SELECT dm.*, ft.name as current_template_name, ft.is_active as template_is_active
    FROM dashboard_mappings dm
    LEFT JOIN form_templates ft ON dm.form_template_id = ft.id
    ORDER BY dm.sort_order, dm.created_at DESC
  `);
  return result.rows.map(toCamel);
}

export async function findByDepartment(department, type, profession) {
  let query = `
    SELECT dm.*, ft.name as current_template_name, ft.fields, ft.sections
    FROM dashboard_mappings dm
    LEFT JOIN form_templates ft ON dm.form_template_id = ft.id
    WHERE (dm.department = $1 OR ($1 = ANY(dm.departments))) AND dm.is_enabled = true AND ft.is_active = true
  `;
  const params = [department];
  let idx = 2;
  if (type && (type === 'patient' || type === 'resource')) {
    query += ` AND dm.dashboard_type = $${idx++}`;
    params.push(type);
  }
  if (profession) {
    query += ` AND (dm.profession IS NULL OR dm.profession = $${idx++})`;
    params.push(profession);
  }
  query += ' ORDER BY dm.sort_order, dm.created_at DESC';
  const result = await pool.query(query, params);
  return result.rows.map(toCamel);
}

export async function createMapping(data) {
  const {
    formTemplateId, formTemplateName, department, departments, profession,
    dashboardType, displayName, identifier, cardFields, groupByField,
    isEnabled = true, sortOrder = 0,
  } = data;

  const primaryDepartment = department || (Array.isArray(departments) ? departments[0] : null);

  const result = await pool.query(`
    INSERT INTO dashboard_mappings (
      form_template_id, form_template_name, department, departments, profession, dashboard_type,
      display_name, identifier, card_fields, group_by_field, is_enabled, sort_order
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *
  `, [
    formTemplateId, formTemplateName, primaryDepartment, (Array.isArray(departments) ? departments : null),
    profession ?? null, dashboardType, displayName, identifier ?? null,
    JSON.stringify(cardFields), groupByField, isEnabled, sortOrder,
  ]);
  return toCamel(result.rows[0]);
}

export async function updateMapping(id, data) {
  const {
    formTemplateId, formTemplateName, department, departments, profession,
    dashboardType, displayName, identifier, cardFields, groupByField,
    isEnabled, sortOrder,
  } = data;

  const result = await pool.query(`
    UPDATE dashboard_mappings SET
      form_template_id = COALESCE($1, form_template_id),
      form_template_name = COALESCE($2, form_template_name),
      department = COALESCE($3, department),
      departments = COALESCE($4, departments),
      profession = COALESCE($5, profession),
      dashboard_type = COALESCE($6, dashboard_type),
      display_name = COALESCE($7, display_name),
      identifier = COALESCE($8, identifier),
      card_fields = COALESCE($9, card_fields),
      group_by_field = COALESCE($10, group_by_field),
      is_enabled = COALESCE($11, is_enabled),
      sort_order = COALESCE($12, sort_order),
      updated_at = NOW()
    WHERE id = $13
    RETURNING *
  `, [
    formTemplateId, formTemplateName, department, (Array.isArray(departments) ? departments : null),
    profession, dashboardType, displayName, identifier ?? null,
    cardFields ? JSON.stringify(cardFields) : null, groupByField, isEnabled, sortOrder, id,
  ]);
  return toCamel(result.rows[0]) || null;
}

export async function deleteMapping(id) {
  const result = await pool.query('DELETE FROM dashboard_mappings WHERE id = $1 RETURNING id', [id]);
  return result.rows.length > 0;
}

export async function toggleMapping(id) {
  const result = await pool.query(`
    UPDATE dashboard_mappings SET is_enabled = NOT is_enabled, updated_at = NOW()
    WHERE id = $1 RETURNING *
  `, [id]);
  return toCamel(result.rows[0]) || null;
}

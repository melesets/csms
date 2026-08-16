// Custom dashboard tabs - persisted server-side so all users/browsers see the same tabs.
// Previously stored only in browser localStorage, which made tabs invisible to other
// accounts (e.g. admin) and other browsers/devices.

import pool from '../../config/database.js';

const createTableQuery = `
  CREATE TABLE IF NOT EXISTS custom_tabs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    template_id VARCHAR(50),
    template_name VARCHAR(255),
    department VARCHAR(100),
    departments TEXT[],
    profession VARCHAR(50),
    professions TEXT[],
    dashboard_type VARCHAR(20) DEFAULT 'patient',
    group_by_field VARCHAR(100),
    view_style VARCHAR(20) DEFAULT 'card',
    retention VARCHAR(20) DEFAULT 'forever',
    card_fields JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
`;

let tableInitialized = false;

async function ensureTable() {
  if (tableInitialized) return;
  try {
    await pool.query(createTableQuery);
    tableInitialized = true;
  } catch (err) {
    console.error('Error creating custom_tabs table:', err.message);
  }
}

ensureTable();

function toCamel(row) {
  if (!row) return row;
  return {
    id: String(row.id),
    name: row.name,
    displayName: row.display_name,
    templateId: row.template_id != null ? String(row.template_id) : '',
    templateName: row.template_name,
    department: row.department,
    departments: row.departments || [],
    profession: row.profession || '',
    professions: row.professions || [],
    dashboardType: row.dashboard_type,
    groupByField: row.group_by_field || '',
    viewStyle: row.view_style,
    retention: row.retention,
    cardFields: row.card_fields || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findAllTabs() {
  const result = await pool.query(`
    SELECT * FROM custom_tabs
    ORDER BY created_at ASC, id ASC
  `);
  return result.rows.map(toCamel);
}

export async function createTab(data) {
  const {
    name, displayName, templateId, templateName, department, departments,
    profession, professions, dashboardType, groupByField, viewStyle,
    retention, cardFields,
  } = data;

  const result = await pool.query(`
    INSERT INTO custom_tabs (
      name, display_name, template_id, template_name, department, departments,
      profession, professions, dashboard_type, group_by_field, view_style,
      retention, card_fields
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *
  `, [
    name, displayName || name, templateId != null ? String(templateId) : null, templateName || null,
    department || null, (Array.isArray(departments) ? departments : null),
    profession || null, (Array.isArray(professions) ? professions : null),
    dashboardType || 'patient', groupByField || null,
    ['card', 'table', 'list', 'stack'].includes(viewStyle) ? viewStyle : 'card',
    retention || 'forever', JSON.stringify(cardFields || {}),
  ]);
  return toCamel(result.rows[0]);
}

export async function updateTab(id, data) {
  const {
    name, displayName, templateId, templateName, department, departments,
    profession, professions, dashboardType, groupByField, viewStyle,
    retention, cardFields,
  } = data;

  const result = await pool.query(`
    UPDATE custom_tabs SET
      name = COALESCE($2, name),
      display_name = COALESCE($3, display_name),
      template_id = COALESCE($4, template_id),
      template_name = COALESCE($5, template_name),
      department = COALESCE($6, department),
      departments = COALESCE($7, departments),
      profession = COALESCE($8, profession),
      professions = COALESCE($9, professions),
      dashboard_type = COALESCE($10, dashboard_type),
      group_by_field = COALESCE($11, group_by_field),
      view_style = COALESCE($12, view_style),
      retention = COALESCE($13, retention),
      card_fields = COALESCE($14, card_fields),
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [
    id,
    name, displayName, templateId != null ? String(templateId) : null, templateName || null,
    department || null, (Array.isArray(departments) ? departments : null),
    profession || null, (Array.isArray(professions) ? professions : null),
    dashboardType || 'patient', groupByField || null,
    ['card', 'table', 'list', 'stack'].includes(viewStyle) ? viewStyle : 'card',
    retention || 'forever', cardFields ? JSON.stringify(cardFields) : null,
  ]);
  return toCamel(result.rows[0]) || null;
}

export async function deleteTab(id) {
  const result = await pool.query('DELETE FROM custom_tabs WHERE id = $1 RETURNING id', [id]);
  return result.rows.length > 0;
}
import express from 'express';
import { Pool } from 'pg';

const router = express.Router();

// Initialize pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:1954@localhost:1212/ISBAR',
});

// Create dashboard_mappings table if it doesn't exist
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

// Initialize table
pool.query(createTableQuery).catch(err => {
  console.error('Error creating dashboard_mappings table:', err);
});

// Ensure profession and departments columns exist for existing tables
pool.query(`ALTER TABLE IF EXISTS dashboard_mappings ADD COLUMN IF NOT EXISTS profession VARCHAR(50);`).catch(err => {
  console.error('Error ensuring profession column on dashboard_mappings:', err);
});
pool.query(`ALTER TABLE IF EXISTS dashboard_mappings ADD COLUMN IF NOT EXISTS departments TEXT[];`).catch(err => {
  console.error('Error ensuring departments column on dashboard_mappings:', err);
});
pool.query(`ALTER TABLE IF EXISTS dashboard_mappings ADD COLUMN IF NOT EXISTS identifier VARCHAR(100);`).catch(err => {
  console.error('Error ensuring identifier column on dashboard_mappings:', err);
});

// GET all dashboard mappings
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT dm.*, ft.name as current_template_name, ft.is_active as template_is_active
      FROM dashboard_mappings dm
      LEFT JOIN form_templates ft ON dm.form_template_id = ft.id
      ORDER BY dm.sort_order, dm.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching dashboard mappings:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET dashboard mappings by department and type
router.get('/by-department/:department/:type?', async (req, res) => {
  try {
    const { department, type } = req.params;
    const { profession } = req.query;
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
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching dashboard mappings by department:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST create new dashboard mapping
router.post('/', async (req, res) => {
  try {
    const {
      formTemplateId,
      formTemplateName,
      department,
      departments,
      profession,
      dashboardType,
      displayName,
      identifier,
      cardFields,
      groupByField,
      isEnabled = true,
      sortOrder = 0
    } = req.body;

    // Validate required fields (allow either single department or departments list)
    if (!formTemplateId || !formTemplateName || (!department && !(Array.isArray(departments) && departments.length > 0)) || !dashboardType || !displayName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const primaryDepartment = department || (Array.isArray(departments) ? departments[0] : null);

    // Validate dashboard type
    if (!['patient', 'resource'].includes(dashboardType)) {
      return res.status(400).json({ error: 'Invalid dashboard type' });
    }

    const result = await pool.query(`
      INSERT INTO dashboard_mappings (
        form_template_id, form_template_name, department, departments, profession, dashboard_type,
        display_name, identifier, card_fields, group_by_field, is_enabled, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      formTemplateId, formTemplateName, primaryDepartment, (Array.isArray(departments) ? departments : null), profession ?? null, dashboardType,
      displayName, identifier ?? null, JSON.stringify(cardFields), groupByField, isEnabled, sortOrder
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating dashboard mapping:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update dashboard mapping
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      formTemplateId,
      formTemplateName,
      department,
      departments,
      profession,
      dashboardType,
      displayName,
      identifier,
      cardFields,
      groupByField,
      isEnabled,
      sortOrder
    } = req.body;

    // Validate dashboard type if provided
    if (dashboardType && !['patient', 'resource'].includes(dashboardType)) {
      return res.status(400).json({ error: 'Invalid dashboard type' });
    }

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
      formTemplateId, formTemplateName, department, (Array.isArray(departments) ? departments : null), profession,
      dashboardType, displayName, identifier ?? null, cardFields ? JSON.stringify(cardFields) : null, groupByField,
      isEnabled, sortOrder, id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dashboard mapping not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating dashboard mapping:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE dashboard mapping
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM dashboard_mappings WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dashboard mapping not found' });
    }

    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error('Error deleting dashboard mapping:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH toggle mapping status
router.patch('/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      UPDATE dashboard_mappings 
      SET is_enabled = NOT is_enabled, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dashboard mapping not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error toggling dashboard mapping status:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
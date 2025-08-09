import express from 'express';
import { Pool } from 'pg';
const router = express.Router();

// Use environment variables for DB connection
const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
});

// GET all templates with optional department filtering
router.get('/', async (req, res) => {
  try {
    const { department, profession } = req.query;
    let query = 'SELECT * FROM form_templates';
    const conditions = [];
    const params = [];
    
    if (department) {
      conditions.push(`department = $${params.length + 1}`);
      params.push(department);
    }
    if (profession) {
      // Return templates that either target the profession or are for all (NULL)
      conditions.push(`(profession IS NULL OR profession = $${params.length + 1})`);
      params.push(profession);
    }
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Form templates error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET active template for a department
router.get('/department/:department/active-template', async (req, res) => {
  const { department } = req.params;
  const { profession } = req.query;
  try {
    let result;
    if (profession) {
      // Prefer a profession-specific active template; fallback to general (NULL profession)
      result = await pool.query(
        `SELECT * FROM form_templates 
         WHERE department = $1 AND is_active = true AND (profession = $2 OR profession IS NULL)
         ORDER BY (profession IS NULL) ASC
         LIMIT 1`,
        [department, profession]
      );
    } else {
      result = await pool.query(
        'SELECT * FROM form_templates WHERE department = $1 AND is_active = true LIMIT 1',
        [department]
      );
    }
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active template found for this department.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: Save a new template
router.post('/', async (req, res) => {
  const template = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO form_templates (name, department, profession, description, fields, sections, is_active, created_by, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        template.name,
        template.department,
        template.profession ?? null,
        template.description || '',
        JSON.stringify(template.fields || []),
        JSON.stringify(template.sections || []),
        template.isActive !== undefined ? template.isActive : true,
        template.createdBy || 'admin',
        template.version || 1
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT: Update an existing template
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const template = req.body || {};
  try {
    const result = await pool.query(
      `UPDATE form_templates 
       SET 
         name = COALESCE($1, name),
         department = COALESCE($2, department),
         profession = COALESCE($3, profession),
         description = COALESCE($4, description),
         fields = COALESCE($5, fields),
         sections = COALESCE($6, sections),
         is_active = COALESCE($7, is_active),
         version = COALESCE($8, version),
         updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        template.name ?? null,
        template.department ?? null,
        template.profession ?? null,
        template.description ?? null,
        (template.fields !== undefined ? JSON.stringify(template.fields) : null),
        (template.sections !== undefined ? JSON.stringify(template.sections) : null),
        (template.isActive !== undefined ? template.isActive : null),
        (template.version !== undefined ? template.version : null),
        id
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH: Set a template as active and deactivate others for the department
router.patch('/:id/set-active', async (req, res) => {
  const { id } = req.params;
  try {
    // Get the template to activate
    const templateResult = await pool.query('SELECT * FROM form_templates WHERE id = $1', [id]);
    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    // Only activate the selected template, do not deactivate others
    await pool.query('UPDATE form_templates SET is_active = true WHERE id = $1', [id]);
    // Return the now-active template
    const activeResult = await pool.query('SELECT * FROM form_templates WHERE id = $1', [id]);
    res.json(activeResult.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE: Remove a template by id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM form_templates WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
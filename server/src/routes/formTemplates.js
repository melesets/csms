
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

// GET active template for a department
router.get('/department/:department/active-template', async (req, res) => {
  const { department } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM form_templates WHERE department = $1 AND is_active = true LIMIT 1',
      [department]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active template found for this department.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
// PATCH: Set a template as active and deactivate others for the department
router.patch('/:id/set-active', async (req, res) => {
  const { id } = req.params;
  try {
    // Get the template to activate
    const templateResult = await pool.query('SELECT * FROM form_templates WHERE id = $1', [id]);
    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    const department = templateResult.rows[0].department;
    // Deactivate all templates for the department
    await pool.query('UPDATE form_templates SET is_active = false WHERE department = $1', [department]);
    // Activate the selected template
    await pool.query('UPDATE form_templates SET is_active = true WHERE id = $1', [id]);
    // Return the now-active template
    const activeResult = await pool.query('SELECT * FROM form_templates WHERE id = $1', [id]);
    res.json(activeResult.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// POST: Save a new template
router.post('/', async (req, res) => {
  const template = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO form_templates (name, department, description, fields, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        template.name,
        template.department,
        template.description || '',
        JSON.stringify(template.fields || []),
        template.isActive !== undefined ? template.isActive : true
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

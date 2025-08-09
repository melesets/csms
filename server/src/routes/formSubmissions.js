import express from 'express';
import { Pool } from 'pg';
const router = express.Router();

const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
});

// POST: Submit a new form record
router.post('/', async (req, res) => {
  const { 
    template_id, 
    template_name,
    template_department,
    form_data, 
    submitted_by,
    submitted_by_name,
    submitted_by_department,
    submitted_at
  } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO form_submissions (
        template_id, 
        template_name,
        template_department,
        form_data, 
        submitted_by,
        submitted_by_name,
        submitted_by_department,
        submitted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        template_id, 
        template_name,
        template_department,
        JSON.stringify(form_data), 
        submitted_by,
        submitted_by_name,
        submitted_by_department,
        submitted_at || new Date().toISOString()
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: Fetch submissions with filtering
router.get('/', async (req, res) => {
  const { formId, department, user, limit } = req.query;
  
  try {
    let query = `
      SELECT s.*, t.name as template_name, t.department as template_department
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
      // Use proper parameter placeholders for both comparisons and advance index correctly
      query += ` AND (s.template_department = ${idx} OR t.department = ${idx + 1})`;
      params.push(department, department);
      idx += 2;
    }

    if (user) {
      query += ` AND s.submitted_by = $${idx++}`;
      params.push(user);
    }

    query += ' ORDER BY s.submitted_at DESC';

    if (limit) {
      query += ` LIMIT $${idx++}`;
      params.push(parseInt(limit));
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: Get submission by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT s.*, t.name as template_name, t.department as template_department
       FROM form_submissions s
       LEFT JOIN form_templates t ON s.template_id = t.id
       WHERE s.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT: Update submission
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { form_data } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE form_submissions SET form_data = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [JSON.stringify(form_data), id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE: Delete submission
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query(
      'DELETE FROM form_submissions WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    res.json({ success: true, message: 'Submission deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
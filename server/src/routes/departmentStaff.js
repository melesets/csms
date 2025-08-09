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

// GET all department staff
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM department_staff ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST new department staff
router.post('/', async (req, res) => {
  const { name, role, department } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO department_staff (name, role, department, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [name, role, department]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update department staff
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, role, department } = req.body;
  try {
    const result = await pool.query(
      'UPDATE department_staff SET name = $1, role = $2, department = $3, updated_at = NOW() WHERE id = $4 RETURNING *',
      [name, role, department, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE department staff
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM department_staff WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
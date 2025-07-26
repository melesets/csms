const inventoryReportsRouter = require('./routes/inventoryReports');

// ...existing code...
app.use('/api/inventory-reports', inventoryReportsRouter);

// ...existing code...

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
// Mount formTemplates router (ESM import)
import formTemplatesRouter from './routes/formTemplates.js';
app.use('/api/form-templates', formTemplatesRouter);

// PostgreSQL connection
// ...existing code...

// --- Resource Management API ---
// Get all resources
app.get('/api/resources', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM resources ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new resource
app.post('/api/resources', async (req, res) => {
  const { name, type, quantity, standard_quantity, unit, expiry_date, batch_number } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO resources (name, type, quantity, standard_quantity, unit, expiry_date, batch_number) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [name, type, quantity, standard_quantity, unit, expiry_date, batch_number]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a resource
app.put('/api/resources/:id', async (req, res) => {
  const { id } = req.params;
  const { name, type, quantity, standard_quantity, unit, expiry_date, batch_number } = req.body;
  try {
    const result = await pool.query(
      'UPDATE resources SET name=$1, type=$2, quantity=$3, standard_quantity=$4, unit=$5, expiry_date=$6, batch_number=$7 WHERE id=$8 RETURNING *',
      [name, type, quantity, standard_quantity, unit, expiry_date, batch_number, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Resource not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a resource
app.delete('/api/resources/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM resources WHERE id=$1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Resource not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user
app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { username, password, email, role } = req.body;
  try {
    const result = await pool.query(
      'UPDATE users SET username=$1, password=$2, email=$3, role=$4 WHERE id=$5 RETURNING id, username, email, role, created_at',
      [username, password, email, role, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user
app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM users WHERE id=$1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update form
app.put('/api/forms/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, schema } = req.body;
  try {
    const result = await pool.query(
      'UPDATE forms SET name=$1, description=$2, schema=$3 WHERE id=$4 RETURNING *',
      [name, description, schema, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Form not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete form
app.delete('/api/forms/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM forms WHERE id=$1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Form not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update record
app.put('/api/records/:id', async (req, res) => {
  const { id } = req.params;
  const { form_id, user_id, data } = req.body;
  try {
    const result = await pool.query(
      'UPDATE records SET form_id=$1, user_id=$2, data=$3 WHERE id=$4 RETURNING *',
      [form_id, user_id, data, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete record
app.delete('/api/records/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM records WHERE id=$1 RETURNING id', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/isbar_db',
});

app.get('/', (req, res) => {
  res.send('ISBAR Backend Server Running');
});

// Test database connection endpoint
app.get('/api/test-db', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, message: 'Database connection successful.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// User Management
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, email, role, created_at FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Department Staff Management
app.get('/api/department-staff', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM department_staff');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Add department staff
app.post('/api/department-staff', async (req, res) => {
  const { name, department, role } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO department_staff (name, department, role) VALUES ($1, $2, $3) RETURNING *',
      [name, department, role]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  const { username, password, email, role } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO users (username, password, email, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role, created_at',
      [username, password, email, role || 'user']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Form Management
app.get('/api/forms', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM forms');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/forms', async (req, res) => {
  const { name, description, schema, created_by } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO forms (name, description, schema, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, description, schema, created_by]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Record Management
app.get('/api/records', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM records');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/records', async (req, res) => {
  const { form_id, user_id, data } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO records (form_id, user_id, data) VALUES ($1, $2, $3) RETURNING *',
      [form_id, user_id, data]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

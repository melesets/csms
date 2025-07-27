// ...existing code...
// ...existing code...

// ...existing code...

// ...existing code...


import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import inventoryReportsRouter from './routes/inventoryReports.js';
import formTemplatesRouter from './routes/formTemplates.js';

dotenv.config();

// Initialize pool BEFORE any route/database usage
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/isbar_db',
});

const app = express();
const port = process.env.PORT || 5000;

// --- ISBAR Dynamic Records API ---
// Place this after app and pool are initialized
const isbarRecordsRouter = express.Router();

// Save a dynamic ISBAR record (entire form as JSONB)
isbarRecordsRouter.post('/', async (req, res) => {
  try {
    const { department } = req.body;
    // Save the entire record as JSONB for flexibility
    const result = await pool.query(
      'INSERT INTO isbar_records (department, form_data, created_at) VALUES ($1, $2, NOW()) RETURNING *',
      [department || 'General', req.body]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error saving ISBAR record:', err);
    console.error('Request body:', req.body);
    res.status(500).json({ error: err.message, details: err });
  }
});

// Get ISBAR records (optionally filter by department)
isbarRecordsRouter.get('/', async (req, res) => {
  try {
    const { department } = req.query;
    let query = 'SELECT * FROM isbar_records';
    let params = [];
    if (department) {
      query += ' WHERE department = $1';
      params.push(department);
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    // Return the form_data field as the record
    res.json(result.rows.map(row => row.form_data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.use(cors());
app.use(express.json());
app.use('/api/isbar-records', isbarRecordsRouter);
app.use('/api/inventory-reports', inventoryReportsRouter);
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

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('Login attempt:', { username, password });
  try {
    const result = await pool.query(
      'SELECT id, username, role, name, created_at, isActive FROM users WHERE username = $1 AND password = $2',
      [username, password]
    );
    console.log('Login query result:', result.rows);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    const user = result.rows[0];
    if (user.isactive === false) {
      return res.status(403).json({ error: 'User is not active' });
    }
    // Remove password and isActive from response
    const { password: _pw, isactive, ...userData } = user;
    // Ensure role is present and lowercased for consistency
    const role = (user.role || '').toLowerCase();
    // Add default permissions based on role (customize as needed)
    let permissions = [];
    switch (role) {
      case 'admin':
        permissions = [
          { module: 'dashboard', actions: ['view'] },
          { module: 'isbar', actions: ['view', 'create', 'edit', 'delete'] },
          { module: 'staff', actions: ['view', 'create', 'edit', 'delete'] },
          { module: 'resources', actions: ['view', 'create', 'edit', 'delete'] },
          { module: 'database', actions: ['view', 'export'] },
          { module: 'trends', actions: ['view'] },
          { module: 'form-builder', actions: ['view', 'create', 'edit', 'delete'] },
          { module: 'user-management', actions: ['view', 'create', 'edit', 'delete'] }
        ];
        break;
      case 'staff':
        permissions = [
          { module: 'dashboard', actions: ['view'] },
          { module: 'forms', actions: ['edit'] }
        ];
        break;
      case 'viewer':
        permissions = [
          { module: 'dashboard', actions: ['view'] }
        ];
        break;
      case 'user':
        permissions = [
          { module: 'dashboard', actions: ['view'] },
          { module: 'isbar', actions: ['view'] },
          { module: 'staff', actions: ['view'] },
          { module: 'resources', actions: ['view'] },
          { module: 'database', actions: ['view'] },
          { module: 'trends', actions: ['view'] },
          { module: 'form-builder', actions: ['view'] },
          { module: 'user-management', actions: [] }
        ];
        break;
      default:
        permissions = [];
    }
    const finalUser = { ...userData, role, permissions };
    console.log('Login response user object:', finalUser);
    res.json(finalUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
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

  // Ensure admin user exists (username: quality, password: isbar1954)
  (async () => {
    try {
      const adminCheck = await pool.query(
        "SELECT id FROM users WHERE username = 'quality'"
      );
      if (adminCheck.rows.length === 0) {
        await pool.query(
          `INSERT INTO users (username, password, role, name, isActive, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          ['quality', 'isbar1954', 'admin', 'Quality Admin', true]
        );
        console.log('Admin user "quality" created with password "isbar1954"');
      } else {
        console.log('Admin user "quality" already exists.');
      }
    } catch (err) {
      console.error('Error ensuring admin user exists:', err);
    }
  })();
});

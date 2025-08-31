// ...existing code...
// ...existing code...
// ...existing code...

// ...existing code...

// ...existing code...


import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './pool.js';
import inventoryReportsRouter from './routes/inventoryReports.js';
import formTemplatesRouter from './routes/formTemplates.js';
import formSubmissionsRouter from './routes/formSubmissions.js';
import departmentStaffRouter from './routes/departmentStaff.js';
import patientDataRouter from './routes/patientData.js';
import dashboardMappingsRouter from './routes/dashboardMappings.js';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Shared pool imported from ./pool.js
// Readiness flag: API routes will return 503 until DB is ready
let isReady = false;

async function checkDbOnce() {
  await pool.query('SELECT 1');
}

function startDbReadinessProbe({ intervalMs = 3000 } = {}) {
  const timer = setInterval(async () => {
    try {
      await checkDbOnce();
      isReady = true;
      clearInterval(timer);
      console.log('[Readiness] Database connection established. Service is ready.');
      if (typeof process !== 'undefined' && typeof process.send === 'function') {
        try { process.send('ready'); } catch {}
      }
    } catch (err) {
      console.log('[Readiness] Waiting for database...', err?.message || err);
    }
  }, intervalMs);
}

// Ensure form_templates has profession column to support profession-specific templates
(async () => {
  try {
    await pool.query(`ALTER TABLE IF EXISTS form_templates ADD COLUMN IF NOT EXISTS profession VARCHAR(50);`);
    console.log('Ensured form_templates.profession column exists');
  } catch (err) {
    console.error('Error ensuring form_templates.profession column:', err);
  }
})();

// Ensure form_submissions has submitted_by_profession to support profession-specific filtering
(async () => {
  try {
    await pool.query(`ALTER TABLE IF EXISTS form_submissions ADD COLUMN IF NOT EXISTS submitted_by_profession VARCHAR(50);`);
    console.log('Ensured form_submissions.submitted_by_profession column exists');
  } catch (err) {
    console.error('Error ensuring form_submissions.submitted_by_profession column:', err);
  }
})();

const app = express();
// Rewrite support: allow frontend served under /isbar to call /isbar/api/*
// by rewriting it to /api/* so existing API routes work.
app.use((req, _res, next) => {
  if (req.url.startsWith('/isbar/api/')) {
    req.url = req.url.replace('/isbar/api/', '/api/');
  } else if (req.url === '/isbar/api') {
    req.url = '/api';
  }
  next();
});
// Get form templates for a department
app.get('/api/form-templates/department/:department', async (req, res) => {
  const { department } = req.params;
  const { profession } = req.query;
  try {
    // If profession is provided, include templates with matching profession OR templates with NULL profession (apply to all)
    let query = 'SELECT * FROM form_templates WHERE department = $1 AND is_active = true';
    const params = [department];
    if (profession) {
      query += ' AND (profession IS NULL OR profession = $2)';
      params.push(profession);
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
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
    const { department, mrn } = req.query;
    let query = 'SELECT * FROM isbar_records';
    let conditions = [];
    let params = [];
    if (department) {
      conditions.push('department = $' + (params.length + 1));
      params.push(department);
    }
    if (mrn) {
      // form_data is a JSONB column, so we can filter by mrn key
      conditions.push(`form_data->>'mrn' = $${params.length + 1}`);
      params.push(mrn);
    }
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows.map(row => row.form_data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.use(cors());
app.use(express.json());

// Gate all API routes until DB is ready, but allow health and test-db
app.use('/api', (req, res, next) => {
  if (isReady) return next();
  if (req.path === '/test-db' || req.path === '/health') return next();
  return res.status(503).json({ error: 'Service is initializing. Please try again shortly.' });
});

// Health endpoints
app.get('/api/health', async (req, res) => {
  try {
    if (!isReady) return res.status(503).json({ ready: false });
    await checkDbOnce();
    return res.json({ ready: true });
  } catch (e) {
    return res.status(503).json({ ready: false, error: String(e?.message || e) });
  }
});
app.use('/api/isbar-records', isbarRecordsRouter);
app.use('/api/inventory-reports', inventoryReportsRouter);
app.use('/api/form-templates', formTemplatesRouter);
app.use('/api/form-submissions', formSubmissionsRouter);
app.use('/api/department-staff', departmentStaffRouter);
app.use('/api/patient-data', patientDataRouter);
app.use('/api/dashboard-mappings', dashboardMappingsRouter);

// --- Serve built frontend (no Nginx needed) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../../dist');

console.log('[Static] Serving frontend from:', distPath);

// Serve static assets under /isbar
app.use('/isbar', express.static(distPath));
// Ensure exact /isbar redirects to /isbar/
app.get('/isbar', (req, res) => res.redirect('/isbar/'));
// SPA fallback: route all /isbar/* to index.html
app.get('/isbar/*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});
// Convenience: redirect root to /isbar/
app.get('/', (req, res) => res.redirect('/isbar/'));

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
  // department should be provided by the frontend or inferred from the logged-in user
  const { name, type, quantity, standard_quantity, unit, expiry_date, batch_number, department } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO resources (name, type, quantity, standard_quantity, unit, expiry_date, batch_number, department) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [name, type, quantity, standard_quantity, unit, expiry_date, batch_number, department]
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
  const { username, password, email, role, name, department, isActive, profession } = req.body;
  try {
    const result = await pool.query(
      `UPDATE users SET 
         username = COALESCE($1, username),
         password = COALESCE($2, password),
         email = COALESCE($3, email),
         role = COALESCE($4, role),
         name = COALESCE($5, name),
         department = COALESCE($6, department),
         isActive = COALESCE($7, isActive),
         profession = COALESCE($8, profession)
       WHERE id = $9
       RETURNING id, username, name, email, role, department, profession, COALESCE(isActive, isactive, true) AS "isActive", created_at AS "createdAt"`,
      [username ?? null, password ?? null, email ?? null, role ?? null, name ?? null, department ?? null, isActive ?? null, profession ?? null, id]
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

// Departments list endpoint (distinct departments across tables)
app.get('/api/departments', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT department FROM (
        SELECT department FROM users
        UNION
        SELECT department FROM resources
        UNION
        SELECT department FROM department_staff
        UNION
        SELECT department FROM form_templates
        UNION
        SELECT department FROM dashboard_mappings
      ) t
      WHERE department IS NOT NULL AND department <> ''
      ORDER BY department
    `);
    res.json(result.rows.map(r => r.department));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User Management
// Create user
app.post('/api/users', async (req, res) => {
  const { username, password, name, role, department, isActive, permissions, profession } = req.body;
  if (!username || !password || !name || !role || !department) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO users (username, password, name, role, department, isActive, permissions, profession, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING id, username, name, role, department, isActive, permissions, profession, created_at',
      [username, password, name, role, department, isActive ?? true, permissions ? JSON.stringify(permissions) : null, profession ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         id,
         username,
         name,
         email,
         role,
         department,
         profession,
         COALESCE(isActive, isactive, true) AS "isActive",
         created_at AS "createdAt"
       FROM users`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user by id
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
  const { username, password, profession } = req.body;
  console.log('Login attempt:', { username, password, profession });
  try {
    const result = await pool.query(
      'SELECT id, username, role, name, department, profession, created_at, isActive FROM users WHERE username = $1 AND password = $2',
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
    // Enforce profession match when provided
    if (profession && user.profession && String(profession).trim() !== String(user.profession).trim()) {
      return res.status(403).json({ error: 'Profession mismatch' });
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
    const finalUser = { ...userData, role, department: user.department, profession: user.profession, permissions };
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
  // Start readiness probe for PM2 wait_ready and API gating
  startDbReadinessProbe({ intervalMs: 3000 });

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

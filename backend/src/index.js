// Main Express server entry point - initializes DB, middleware, and routes
// Sets up CORS, JSON parsing, static file serving, and mounts all API routes.
// Includes health check and database readiness probe endpoints.

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './config/database.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requireAuth } from './middleware/auth.js';
import { startAuditCleanup } from './modules/admin/admin.service.js';

dotenv.config({ override: true });

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
    } catch (err) {
      console.log('[Readiness] Waiting for database...', err?.message || err);
    }
  }, intervalMs);
}

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use('/uploads/profiles', (req, res, next) => {
  res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  res.set('ETag', '');
  next();
}, express.static(path.join(__dirname, '../uploads/profiles'), { maxAge: '7d', etag: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/', (req, res) => {
  res.send('ISBAR Backend is Running! Access API at /api/');
});

app.use(requireAuth);
app.use(routes);

app.get('/api/test-db', async (req, res) => {
  try {
    if (!isReady) return res.status(503).json({ success: false, error: 'Database initializing' });
    await pool.query('SELECT 1');
    res.json({ success: true, message: 'Database connection successful.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    res.json({
      status: 'online',
      db_check: isReady ? 'connected' : 'waiting',
      ready: isReady,
      time: isReady ? (await pool.query('SELECT NOW()')).rows[0].now : null,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', db_check: 'failed', error: err.message });
  }
});

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  startDbReadinessProbe({ intervalMs: 3000 });
  startAuditCleanup();
});

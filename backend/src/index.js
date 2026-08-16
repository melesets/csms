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
import { autoCheckoutExpiredSessions } from './modules/shifts/shifts.service.js';
import { deduplicateShiftTypes } from './modules/scheduling/scheduling.service.js';
import fs from 'fs';

dotenv.config({ override: true });

let isReady = false;

async function checkDbOnce() {
  await pool.query('SELECT 1');
}

function splitSQL(sql) {
  const stmts = [];
  let current = '';
  let inDollar = false;
  let i = 0;
  while (i < sql.length) {
    if (sql[i] === '$' && sql[i + 1] === '$') {
      inDollar = !inDollar;
      current += '$$';
      i += 2;
      continue;
    }
    if (!inDollar && sql[i] === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++;
      continue;
    }
    if (!inDollar && sql[i] === ';') {
      const s = current.trim();
      if (s) stmts.push(s);
      current = '';
      i++;
      continue;
    }
    current += sql[i];
    i++;
  }
  const last = current.trim();
  if (last) stmts.push(last);
  return stmts;
}

async function runAutoMigrations() {
  // Ensure migrations tracking table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const { rows: applied } = await pool.query('SELECT filename FROM _migrations ORDER BY id');
  const appliedSet = new Set(applied.map(r => r.filename));

  const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  // If no migrations tracked yet, check if tables already exist
  // and seed the tracking table to skip already-applied files
  if (appliedSet.size === 0) {
    const { rows: tables } = await pool.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
    );
    const existingTables = new Set(tables.map(t => t.tablename));
    // If key tables exist, mark all current files as applied (they were run before tracking)
    if (existingTables.has('users') || existingTables.has('schedules')) {
      for (const file of files) {
        await pool.query('INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING', [file]);
        appliedSet.add(file);
      }
      console.log('[Migration] Seeded tracking table with existing migrations');
      return;
    }
  }

  for (const file of files) {
    if (appliedSet.has(file)) continue;

    const raw = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const statements = splitSQL(raw);
    let appliedCount = 0;
    for (const stmt of statements) {
      try {
        await pool.query(stmt);
        appliedCount++;
      } catch (err) {
        console.error(`[Migration] Statement error in ${file}: ${err.message}`);
      }
    }
    await pool.query('INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING', [file]);
    console.log(`[Migration] Applied ${file} (${appliedCount}/${statements.length} statements)`);
  }
}

function startDbReadinessProbe({ intervalMs = 3000 } = {}) {
  const timer = setInterval(async () => {
    try {
      await checkDbOnce();
      isReady = true;
      clearInterval(timer);
      console.log('[Readiness] Database connection established. Service is ready.');
      await runAutoMigrations();
      await deduplicateShiftTypes();
    } catch (err) {
      console.log('[Readiness] Waiting for database...', err?.message || err);
    }
  }, intervalMs);
}

const app = express();
const port = process.env.PORT || 3777;
const isProduction = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.join(__dirname, '../../frontend/dist');

// Serve uploads under both /csms/uploads and /uploads
app.use('/uploads/profiles', (req, res, next) => {
  res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  res.set('ETag', '');
  next();
}, express.static(path.join(__dirname, '../uploads/profiles'), { maxAge: '7d', etag: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/csms/uploads', express.static(path.join(__dirname, '../uploads')));

if (isProduction) {
  // Serve frontend assets under /csms/
  // index.html must never be long-cached (always revalidate so new bundles are picked up on other computers)
  app.use('/csms', (req, res, next) => {
    if (req.path === '/' || req.path === '/index.html') {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    next();
  });
  app.use('/csms', express.static(frontendDist, { maxAge: '1y', etag: true, index: 'index.html' }));
}

// Root redirect in production
app.get('/', (req, res) => {
  if (isProduction) {
    return res.redirect(301, '/csms/');
  }
  res.send('ISBAR Backend is Running! Access API at /api/');
});

// Public endpoints (no auth required)
const healthHandler = async (req, res) => {
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
};
const testDbHandler = async (req, res) => {
  try {
    if (!isReady) return res.status(503).json({ success: false, error: 'Database initializing' });
    await pool.query('SELECT 1');
    res.json({ success: true, message: 'Database connection successful.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
app.get('/api/test-db', testDbHandler);
app.get('/api/health', healthHandler);
app.get('/csms/api/test-db', testDbHandler);
app.get('/csms/api/health', healthHandler);

if (isProduction) {
  // SPA fallback - serves index.html for all /csms/* routes (except API and uploads)
  app.get('/csms/*', (req, res, next) => {
    if (req.path.startsWith('/csms/api/') || req.path.startsWith('/csms/uploads/')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use(requireAuth);
app.use(routes);

// In production, also mount all API routes under /csms/api
if (isProduction) {
  app.use('/csms', routes);
}

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  startDbReadinessProbe({ intervalMs: 3000 });
  startAuditCleanup();
  startAutoCheckout();
});

/**
 * Start the auto-checkout background job.
 * Checks every 60 seconds for staff sessions that have exceeded their shift duration.
 * - TID: auto-checkout after >8 hours
 * - BID: auto-checkout after >12 hours
 * - 24H: auto-checkout after >24 hours
 * - 36H: auto-checkout after >36 hours
 * - 48H: auto-checkout after >48 hours
 */
function startAutoCheckout() {
  const CHECK_INTERVAL_MS = 60 * 1000; // Check every 60 seconds
  
  // Initial check after 30 seconds of server startup
  setTimeout(async () => {
    console.log('[AutoCheckout] Running initial check...');
    const result = await autoCheckoutExpiredSessions();
    if (result.checkedOut > 0) {
      console.log(`[AutoCheckout] Initial check: ${result.checkedOut} session(s) auto-checked out`);
    }
  }, 30 * 1000);

  // Recurring check every 60 seconds
  setInterval(async () => {
    const result = await autoCheckoutExpiredSessions();
    if (result.checkedOut > 0) {
      console.log(`[AutoCheckout] Periodic check: ${result.checkedOut} session(s) auto-checked out`);
    }
  }, CHECK_INTERVAL_MS);

  console.log(`[AutoCheckout] Background job started (interval: ${CHECK_INTERVAL_MS / 1000}s)`);
}

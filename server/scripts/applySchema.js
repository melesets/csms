import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../src/pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applySqlFile(filePath) {
  const sql = await fs.readFile(filePath, 'utf-8');
  if (!sql || !sql.trim()) {
    console.log(`[Skip] Empty SQL file: ${filePath}`);
    return;
  }
  console.log(`[Apply] Executing SQL from: ${filePath}`);
  try {
    await pool.query(sql);
    console.log(`[OK] Applied: ${path.basename(filePath)}`);
  } catch (err) {
    console.error(`[ERROR] Failed applying ${path.basename(filePath)}:`, err.message);
    throw err;
  }
}

async function main() {
  // Resolve SQL files relative to server root
  const serverRoot = path.resolve(__dirname, '..');
  const files = [
    path.join(serverRoot, 'isbar_schema.sql'),
    path.join(serverRoot, 'isbar_schema_templates.sql'),
  ];

  console.log('[Info] Using DATABASE_URL or PG* vars from .env loaded via pool.js');
  for (const f of files) {
    try {
      await applySqlFile(f);
    } catch (e) {
      console.error('[Abort] Stopping due to error.');
      process.exitCode = 1;
      return;
    }
  }

  try {
    // quick smoke check: ensure a trivial query runs
    await pool.query('SELECT 1');
    console.log('[Done] All schema files applied successfully.');
  } catch (e) {
    console.error('[Warn] Post-apply health check failed:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
}

main();

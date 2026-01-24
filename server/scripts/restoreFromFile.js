import fs from 'fs/promises';
import path from 'path';
import { Client } from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load env from server/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

function buildConn({ database }) {
  const url = process.env.DATABASE_URL;
  if (url) {
    // Override database name if provided
    if (database) {
      const u = new URL(url);
      u.pathname = `/${database}`;
      return { connectionString: u.toString() };
    }
    return { connectionString: url };
  }
  return {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    database: database || process.env.PGDATABASE || 'postgres',
  };
}

async function ensureDatabase(dbName) {
  const admin = new Client(buildConn({ database: 'postgres' }));
  await admin.connect();
  try {
    const res = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (res.rowCount === 0) {
      console.log(`[CreateDB] Creating database: ${dbName}`);
      await admin.query(`CREATE DATABASE "${dbName}"`);
    } else {
      console.log(`[CreateDB] Database already exists: ${dbName}`);
    }
  } finally {
    await admin.end();
  }
}

async function restoreSql({ filePath, targetDb }) {
  const sql = await fs.readFile(filePath, 'utf-8');
  console.log(`[Restore] Executing SQL file (${(new Intl.NumberFormat()).format(sql.length)} bytes) into DB: ${targetDb}`);
  const client = new Client(buildConn({ database: targetDb }));
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('[Restore] Completed successfully');
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error('[Restore] Failed:', e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

async function main() {
  const filePath = process.argv[2];
  const targetDb = process.argv[3] || 'ISBAR_restored';
  if (!filePath) {
    console.error('Usage: node scripts/restoreFromFile.js <backup.sql> [TargetDbName]');
    process.exit(1);
  }
  await ensureDatabase(targetDb);
  await restoreSql({ filePath, targetDb });
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});

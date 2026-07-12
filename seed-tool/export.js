import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load from seed-tool/.env first, fallback to parent ISBAR_4/.env
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Source DB: ISBAR_4 production
const sourcePool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '1212'),
  database: process.env.PGDATABASE || 'ISBAR_restored',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '1954',
});

const TABLES = [
  'users',
  'form_templates',
  'resources',
  'department_staff',
  'dashboard_mappings',
];

async function exportTable(pool, tableName) {
  try {
    const result = await pool.query(`SELECT * FROM ${tableName}`);
    console.log(`  [OK] ${tableName}: ${result.rowCount} rows`);
    return result.rows;
  } catch (err) {
    console.warn(`  [SKIP] ${tableName}: ${err.message}`);
    return [];
  }
}

async function main() {
  console.log('=== ISBAR_4 Data Export ===\n');
  console.log(`Source DB: ${process.env.PGDATABASE}@${process.env.PGHOST}:${process.env.PGPORT}\n`);

  const data = {};
  for (const table of TABLES) {
    data[table] = await exportTable(sourcePool, table);
  }

  const outPath = path.join(__dirname, 'export.json');
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log(`\nExported to: ${outPath}`);

  await sourcePool.end();
}

main().catch(err => {
  console.error('Export failed:', err);
  process.exit(1);
});

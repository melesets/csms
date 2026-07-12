import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Only need TARGET_PG* vars (pointing to your new app's DB)
dotenv.config({ path: path.join(__dirname, '.env') });

// Target DB: your new app's database
const targetPool = new Pool({
  host: process.env.TARGET_PGHOST || process.env.PGHOST || 'localhost',
  port: parseInt(process.env.TARGET_PGPORT || process.env.PGPORT || '5432'),
  database: process.env.TARGET_PGDATABASE || process.env.PGDATABASE || 'csms',
  user: process.env.TARGET_PGUSER || process.env.PGUSER || 'postgres',
  password: process.env.TARGET_PGPASSWORD || process.env.PGPASSWORD || '',
});

const exportPath = path.join(__dirname, 'export.json');

if (!fs.existsSync(exportPath)) {
  console.error('export.json not found. Run "npm run export" first.');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));

// Map ISBAR_4 table names to your new app's table names
const TABLE_MAP = {
  users: 'users',
  form_templates: 'form_templates',
  resources: 'resources',
  department_staff: 'department_staff',
  dashboard_mappings: 'dashboard_mappings',
};

function escapeLiteral(val, colName) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
  // Handle TEXT[] columns — convert JSON arrays to PostgreSQL array syntax
  if (colName === 'departments' && Array.isArray(val)) {
    return `ARRAY[${val.map(v => `'${String(v).replace(/'/g, "''")}'`).join(',')}]`;
  }
  return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
}

async function buildFormTemplateIdMap(pool, exportTemplates) {
  // exportTemplates: rows from export.json form_templates (old IDs, old names)
  // Build: oldId → name from export, then name → newId from DB
  const oldIdToName = {};
  for (const t of exportTemplates) {
    oldIdToName[t.id] = t.name;
  }
  const nameToNewId = {};
  const res = await pool.query('SELECT id, name FROM form_templates');
  for (const r of res.rows) {
    nameToNewId[r.name] = r.id;
  }
  return { oldIdToName, nameToNewId };
}

function remapFormTemplateIds(rows, idMap) {
  return rows.map(r => {
    const name = idMap.oldIdToName[r.form_template_id];
    if (name && idMap.nameToNewId[name] !== undefined) {
      return { ...r, form_template_id: idMap.nameToNewId[name] };
    }
    return null; // couldn't resolve
  }).filter(Boolean);
}

async function getTableColumns(pool, tableName) {
  const res = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
    [tableName]
  );
  return new Set(res.rows.map(r => r.column_name));
}

async function insertRows(pool, targetTable, rows) {
  if (!rows || rows.length === 0) {
    console.log(`  [SKIP] ${targetTable}: no data`);
    return;
  }

  const dbCols = await getTableColumns(pool, targetTable);
  const cols = Object.keys(rows[0]).filter(c => c !== 'id' && dbCols.has(c));
  const colList = cols.join(', ');
  const skipped = Object.keys(rows[0]).filter(c => c !== 'id' && !dbCols.has(c));
  if (skipped.length) console.log(`  [INFO] ${targetTable}: skipped columns not in DB: ${skipped.join(', ')}`);

  // Auto-generate emails for users with null email (email is NOT NULL)
  const workingRows = targetTable === 'users'
    ? rows.map((r, i) => ({ ...r, email: r.email || r.email === '' ? r.email : `${r.username || 'user' + i}@placeholder.local` }))
    : rows;

  let inserted = 0;
  for (const row of workingRows) {
    const values = cols.map(c => escapeLiteral(row[c], c)).join(', ');
    const sql = `INSERT INTO ${targetTable} (${colList}) VALUES (${values}) ON CONFLICT DO NOTHING`;
    try {
      await pool.query(sql);
      inserted++;
    } catch (err) {
      console.warn(`  [WARN] ${targetTable} row ${row.id || ''}: ${err.message}`);
    }
  }
  console.log(`  [OK] ${targetTable}: inserted ${inserted}/${rows.length} rows`);
}

async function main() {
  console.log('=== ISBAR Data Seeder ===\n');
  const db = process.env.TARGET_PGDATABASE || process.env.PGDATABASE || 'csms';
  const host = process.env.TARGET_PGHOST || process.env.PGHOST || 'localhost';
  const port = process.env.TARGET_PGPORT || process.env.PGPORT || '5432';
  console.log(`Target DB: ${db}@${host}:${port}\n`);

  console.log('Clearing existing data...');
  const tables = ['dashboard_mappings', 'department_staff', 'form_submissions', 'form_templates', 'resources', 'users'];
  for (const t of tables) {
    try {
      await targetPool.query(`TRUNCATE TABLE ${t} CASCADE`);
      console.log(`  [OK] Truncated ${t}`);
    } catch (err) {
      console.warn(`  [WARN] Could not truncate ${t}: ${err.message}`);
    }
  }
  console.log('');

  // Reset sequences so IDs start from 1
  for (const t of ['users', 'form_templates', 'resources', 'department_staff', 'dashboard_mappings']) {
    try {
      await targetPool.query(`ALTER SEQUENCE ${t}_id_seq RESTART WITH 1`);
    } catch (_) {}
  }

  for (const [srcTable, targetTable] of Object.entries(TABLE_MAP)) {
    if (targetTable === 'dashboard_mappings') {
      const idMap = await buildFormTemplateIdMap(targetPool, data.form_templates);
      const resolved = remapFormTemplateIds(data[srcTable], idMap);
      console.log(`  [INFO] ${targetTable}: remapped ${resolved.length}/${data[srcTable].length} rows (resolved form_template_id)`);
      await insertRows(targetPool, targetTable, resolved);
    } else {
      await insertRows(targetPool, targetTable, data[srcTable]);
    }
  }

  console.log('\nDone!');
  await targetPool.end();
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});

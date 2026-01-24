import pool from '../src/pool.js';

async function exec(sql) {
  await pool.query(sql);
}

async function ensureTables() {
  // form_templates (non-destructive)
  await exec(`
    CREATE TABLE IF NOT EXISTS form_templates (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      department VARCHAR(100) NOT NULL,
      description TEXT,
      fields JSONB NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // inventory_reports (non-destructive)
  await exec(`
    CREATE TABLE IF NOT EXISTS inventory_reports (
      id SERIAL PRIMARY KEY,
      shift VARCHAR(16) NOT NULL CHECK (shift IN ('Morning', 'Evening', 'Night')),
      staffName VARCHAR(100) NOT NULL,
      staffId INTEGER NOT NULL,
      department VARCHAR(100) NOT NULL,
      date TIMESTAMP NOT NULL,
      resources JSONB NOT NULL
    );
  `);

  // users (non-destructive)
  await exec(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      email VARCHAR(100) UNIQUE,
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      name VARCHAR(100),
      department VARCHAR(100),
      profession VARCHAR(50),
      isActive BOOLEAN,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // forms (non-destructive)
  await exec(`
    CREATE TABLE IF NOT EXISTS forms (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      schema JSONB NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // isbar_records (non-destructive, do NOT drop existing data)
  await exec(`
    CREATE TABLE IF NOT EXISTS isbar_records (
      id SERIAL PRIMARY KEY,
      department VARCHAR(100),
      form_data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

async function ensureColumns() {
  // Add columns used by app, if missing
  await exec(`ALTER TABLE IF EXISTS form_templates ADD COLUMN IF NOT EXISTS profession VARCHAR(50);`);
  await exec(`ALTER TABLE IF EXISTS form_submissions ADD COLUMN IF NOT EXISTS submitted_by_profession VARCHAR(50);`);
}

async function main() {
  try {
    await ensureTables();
    await ensureColumns();
    await pool.query('SELECT 1');
    console.log('[Safe Schema] Ensured tables/columns exist without dropping data.');
  } catch (e) {
    console.error('[Safe Schema] Error:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end().catch(()=>{});
  }
}

main();

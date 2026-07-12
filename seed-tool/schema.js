import { Pool } from 'pg';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const targetPool = new Pool({
  host: process.env.TARGET_PGHOST || 'localhost',
  port: parseInt(process.env.TARGET_PGPORT || '5432'),
  database: process.env.TARGET_PGDATABASE || 'new_app_db',
  user: process.env.TARGET_PGUSER || 'postgres',
  password: process.env.TARGET_PGPASSWORD || '',
});

const SCHEMA_SQL = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(100) UNIQUE,
  role VARCHAR(20) DEFAULT 'user',
  name VARCHAR(100),
  department VARCHAR(100),
  profession VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  permissions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Form templates table
CREATE TABLE IF NOT EXISTS form_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  department VARCHAR(100),
  departments TEXT[],
  profession VARCHAR(50),
  description TEXT DEFAULT '',
  fields JSONB DEFAULT '[]'::jsonb,
  sections JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_by VARCHAR(100) DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Resources table (drugs & equipment)
CREATE TABLE IF NOT EXISTS resources (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) CHECK (type IN ('Drug', 'Equipment')),
  quantity INTEGER DEFAULT 0,
  standard_quantity INTEGER,
  unit VARCHAR(20),
  expiry_date DATE,
  batch_number VARCHAR(50),
  department VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Department staff table
CREATE TABLE IF NOT EXISTS department_staff (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(50),
  department VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Dashboard mappings table
CREATE TABLE IF NOT EXISTS dashboard_mappings (
  id SERIAL PRIMARY KEY,
  form_template_id INTEGER REFERENCES form_templates(id) ON DELETE CASCADE,
  form_template_name VARCHAR(255),
  department VARCHAR(100),
  departments TEXT[],
  profession VARCHAR(50),
  dashboard_type VARCHAR(20) CHECK (dashboard_type IN ('patient', 'resource')),
  display_name VARCHAR(255),
  identifier VARCHAR(100),
  card_fields JSONB DEFAULT '[]'::jsonb,
  group_by_field VARCHAR(100),
  is_enabled BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_form_templates_department ON form_templates(department);
CREATE INDEX IF NOT EXISTS idx_form_templates_departments ON form_templates USING GIN(departments);
CREATE INDEX IF NOT EXISTS idx_form_templates_profession ON form_templates(profession);
CREATE INDEX IF NOT EXISTS idx_resources_department ON resources(department);
CREATE INDEX IF NOT EXISTS idx_department_staff_department ON department_staff(department);
CREATE INDEX IF NOT EXISTS idx_dashboard_mappings_department ON dashboard_mappings(department);
`;

async function main() {
  console.log('=== Creating Schema ===\n');
  console.log(`Target: ${process.env.TARGET_PGDATABASE}@${process.env.TARGET_PGHOST}:${process.env.TARGET_PGPORT}\n`);

  try {
    await targetPool.query(SCHEMA_SQL);
    console.log('All tables and indexes created successfully.');
  } catch (err) {
    console.error('Schema creation failed:', err.message);
  }

  await targetPool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

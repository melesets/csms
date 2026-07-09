// Migration: Create AI patient analysis tables
import pool from '../src/config/database.js';

async function migrate() {
  try {
    console.log('Creating patient_embeddings table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS patient_embeddings (
        id SERIAL PRIMARY KEY,
        mrn VARCHAR(64) NOT NULL,
        patient_name VARCHAR(256),
        department VARCHAR(128),
        summary TEXT NOT NULL,
        embedding JSONB,
        analysis JSONB DEFAULT '{}',
        vitals_trend JSONB DEFAULT '{}',
        risk_level VARCHAR(32) DEFAULT 'stable',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_patient_embeddings_mrn ON patient_embeddings(mrn);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_patient_embeddings_dept ON patient_embeddings(department);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_patient_embeddings_risk ON patient_embeddings(risk_level);
    `);

    console.log('patient_embeddings table created.');

    console.log('Creating patient_vitals_history table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS patient_vitals_history (
        id SERIAL PRIMARY KEY,
        mrn VARCHAR(64) NOT NULL,
        vital_type VARCHAR(64) NOT NULL,
        value_numeric NUMERIC,
        value_text VARCHAR(128),
        unit VARCHAR(32),
        recorded_at TIMESTAMP DEFAULT NOW(),
        submission_id INTEGER
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_vitals_mrn ON patient_vitals_history(mrn);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_vitals_type ON patient_vitals_history(vital_type);
    `);

    console.log('patient_vitals_history table created.');
    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();

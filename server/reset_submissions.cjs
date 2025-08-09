const { Pool } = require('pg');

// Prefer env vars (PGUSER, PGHOST, PGDATABASE, PGPASSWORD, PGPORT),
// fallback to a known local connection string if not provided
const connectionString = process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING || 'postgresql://postgres:1954@localhost:1212/ISBAR';

const pool = new Pool({ connectionString });

async function resetFormSubmissions() {
  try {
    console.log('Connecting to database...');
    await pool.query('SELECT 1');

    const before = await pool.query('SELECT COUNT(*)::int AS count FROM form_submissions');
    console.log(`Rows before: ${before.rows[0].count}`);

    console.log('Truncating form_submissions and resetting identity...');
    await pool.query('TRUNCATE TABLE form_submissions RESTART IDENTITY CASCADE');

    const after = await pool.query('SELECT COUNT(*)::int AS count FROM form_submissions');
    console.log(`Rows after: ${after.rows[0].count}`);

    console.log('✅ form_submissions reset complete.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error resetting form_submissions:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

resetFormSubmissions();


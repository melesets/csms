const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
});

async function activateISBAR() {
  try {
    console.log('Activating ISBAR form...');
    const result = await pool.query("UPDATE form_templates SET is_active = true WHERE UPPER(name) LIKE '%ISBAR%'");
    console.log('Updated', result.rowCount, 'ISBAR forms to active');
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

activateISBAR();
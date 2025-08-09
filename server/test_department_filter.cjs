const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
});

async function testDepartmentFilter() {
  try {
    console.log('=== TESTING DEPARTMENT FILTERING ===');
    
    console.log('\n1. ALL ACTIVE TEMPLATES:');
    const allActive = await pool.query('SELECT id, name, department, is_active FROM form_templates WHERE is_active = true ORDER BY department, name');
    allActive.rows.forEach(t => {
      console.log(`  - ${t.name} (${t.department})`);
    });
    
    console.log('\n2. MEDICAL WARD TEMPLATES ONLY:');
    const medicalWard = await pool.query('SELECT id, name, department, is_active FROM form_templates WHERE department = $1 AND is_active = true', ['Medical Ward']);
    medicalWard.rows.forEach(t => {
      console.log(`  - ${t.name} (${t.department})`);
    });
    
    console.log('\n3. NICU TEMPLATES ONLY:');
    const nicu = await pool.query('SELECT id, name, department, is_active FROM form_templates WHERE department = $1 AND is_active = true', ['NICU']);
    nicu.rows.forEach(t => {
      console.log(`  - ${t.name} (${t.department})`);
    });
    
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

testDepartmentFilter();
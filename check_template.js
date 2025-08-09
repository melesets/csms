const { Pool } = require('pg');
require('dotenv').config({ path: './server/.env' });

const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
});

async function checkTemplate() {
  try {
    console.log('Checking for ADARE GENERAL HOSPITAL ISBAR template...');
    const result = await pool.query(
      "SELECT * FROM form_templates WHERE name ILIKE $1",
      ['%ADARE%GENERAL%HOSPITAL%ISBAR%']
    );
    
    if (result.rows.length > 0) {
      console.log('Found templates:');
      result.rows.forEach(template => {
        console.log('ID:', template.id);
        console.log('Name:', template.name);
        console.log('Department:', template.department);
        console.log('Is Active:', template.is_active);
        console.log('Created At:', template.created_at);
        console.log('---');
      });
    } else {
      console.log('No ADARE GENERAL HOSPITAL ISBAR template found.');
      console.log('\nChecking all templates in database:');
      const allTemplates = await pool.query('SELECT id, name, department, is_active FROM form_templates ORDER BY created_at DESC');
      if (allTemplates.rows.length === 0) {
        console.log('No templates found in database.');
      } else {
        allTemplates.rows.forEach(template => {
          console.log(`ID: ${template.id} | Name: ${template.name} | Dept: ${template.department} | Active: ${template.is_active}`);
        });
      }
    }
    
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkTemplate();
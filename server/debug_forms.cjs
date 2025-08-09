const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
});

async function debugForms() {
  try {
    console.log('=== DEBUGGING FORMS ISSUE ===\n');
    
    // Check all form templates
    console.log('1. ALL FORM TEMPLATES:');
    const allTemplates = await pool.query('SELECT id, name, department, is_active FROM form_templates ORDER BY created_at DESC');
    console.log(`Found ${allTemplates.rows.length} templates:`);
    allTemplates.rows.forEach(template => {
      console.log(`  - ID: ${template.id} | Name: "${template.name}" | Dept: "${template.department}" | Active: ${template.is_active}`);
    });
    
    console.log('\n2. ACTIVE TEMPLATES ONLY:');
    const activeTemplates = await pool.query('SELECT id, name, department FROM form_templates WHERE is_active = true ORDER BY created_at DESC');
    console.log(`Found ${activeTemplates.rows.length} active templates:`);
    activeTemplates.rows.forEach(template => {
      console.log(`  - ID: ${template.id} | Name: "${template.name}" | Dept: "${template.department}"`);
    });
    
    console.log('\n3. MEDICAL WARD TEMPLATES:');
    const medicalWardTemplates = await pool.query('SELECT id, name, department, is_active FROM form_templates WHERE department = $1', ['Medical Ward']);
    console.log(`Found ${medicalWardTemplates.rows.length} Medical Ward templates:`);
    medicalWardTemplates.rows.forEach(template => {
      console.log(`  - ID: ${template.id} | Name: "${template.name}" | Active: ${template.is_active}`);
    });
    
    console.log('\n4. TEMPLATES WITH "ISBAR" IN NAME:');
    const isbarTemplates = await pool.query('SELECT id, name, department, is_active FROM form_templates WHERE UPPER(name) LIKE $1', ['%ISBAR%']);
    console.log(`Found ${isbarTemplates.rows.length} ISBAR templates:`);
    isbarTemplates.rows.forEach(template => {
      console.log(`  - ID: ${template.id} | Name: "${template.name}" | Dept: "${template.department}" | Active: ${template.is_active}`);
    });
    
    console.log('\n5. FORM SUBMISSIONS:');
    const submissions = await pool.query('SELECT id, template_name, template_department, submitted_at FROM form_submissions ORDER BY submitted_at DESC LIMIT 5');
    console.log(`Found ${submissions.rows.length} recent submissions:`);
    submissions.rows.forEach(submission => {
      console.log(`  - Template: "${submission.template_name}" | Dept: "${submission.template_department}" | Date: ${submission.submitted_at}`);
    });
    
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

debugForms();
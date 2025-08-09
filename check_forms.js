const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:1954@localhost:1212/ISBAR'
});

async function findISBARForm() {
  try {
    console.log('🔍 Searching for your ISBAR V.2 form...');
    
    // Check all form templates
    const allForms = await pool.query('SELECT * FROM form_templates ORDER BY created_at DESC');
    console.log(`\n📋 Total forms in database: ${allForms.rows.length}`);
    
    allForms.rows.forEach((form, index) => {
      console.log(`${index + 1}. ID: ${form.id} | Name: "${form.name}" | Dept: ${form.department} | Active: ${form.is_active}`);
    });
    
    // Look specifically for ISBAR forms
    const isbarForms = await pool.query("SELECT * FROM form_templates WHERE UPPER(name) LIKE '%ISBAR%' ORDER BY created_at DESC");
    console.log(`\n🎯 ISBAR forms found: ${isbarForms.rows.length}`);
    
    if (isbarForms.rows.length > 0) {
      isbarForms.rows.forEach(form => {
        console.log(`✅ FOUND: "${form.name}" (ID: ${form.id}) - Active: ${form.is_active}`);
        console.log(`   Created: ${form.created_at}`);
        console.log(`   Department: ${form.department}`);
        console.log(`   Fields: ${form.fields ? JSON.parse(form.fields).length : 0} fields`);
        console.log(`   Sections: ${form.sections ? JSON.parse(form.sections).length : 0} sections`);
      });
    } else {
      console.log('❌ No ISBAR forms found in database');
    }
    
    // Check form submissions to see if ISBAR V.2 was used
    const submissions = await pool.query("SELECT DISTINCT template_name FROM form_submissions WHERE UPPER(template_name) LIKE '%ISBAR%'");
    console.log(`\n📝 ISBAR submissions found: ${submissions.rows.length}`);
    submissions.rows.forEach(sub => {
      console.log(`   - "${sub.template_name}"`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

findISBARForm();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:1954@localhost:1212/ISBAR'
});

async function findISBARSubmissions() {
  try {
    console.log('🔍 Searching for ISBAR submissions...');
    
    // Check all submissions
    const allSubmissions = await pool.query('SELECT id, template_name, submitted_at FROM form_submissions ORDER BY submitted_at DESC LIMIT 20');
    console.log(`\n📋 Recent submissions: ${allSubmissions.rows.length}`);
    
    allSubmissions.rows.forEach((sub, index) => {
      console.log(`${index + 1}. "${sub.template_name}" - ${sub.submitted_at}`);
    });
    
    // Look for any ISBAR-related submissions
    const isbarSubmissions = await pool.query("SELECT * FROM form_submissions WHERE UPPER(template_name) LIKE '%ISBAR%' ORDER BY submitted_at DESC");
    console.log(`\n🎯 ISBAR submissions found: ${isbarSubmissions.rows.length}`);
    
    if (isbarSubmissions.rows.length > 0) {
      isbarSubmissions.rows.forEach((sub, index) => {
        console.log(`✅ FOUND ISBAR SUBMISSION ${index + 1}:`);
        console.log(`   Template: "${sub.template_name}"`);
        console.log(`   Submitted: ${sub.submitted_at}`);
        console.log(`   By: ${sub.submitted_by_name || sub.submitted_by}`);
        console.log(`   Form Data Keys: ${Object.keys(sub.form_data || {}).join(', ')}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

findISBARSubmissions();
import pg from 'pg';
const ib = new pg.Pool({user:'postgres',password:'1954',host:'localhost',port:1212,database:'ISBAR'});
const cs = new pg.Pool({user:'postgres',password:'1954',host:'localhost',port:1212,database:'csms'});

async function check() {
  // All ISBAR templates
  const ibT = await ib.query('SELECT id, name, department FROM form_templates ORDER BY id');
  console.log('=== ALL ISBAR TEMPLATES ===');
  for (const t of ibT.rows) {
    const cnt = await ib.query('SELECT COUNT(*) as n FROM form_submissions WHERE template_id=$1', [t.id]);
    console.log(`  id=${t.id} | ${t.name} | ${t.department} | ${cnt.rows[0].n} submissions`);
  }

  // All CSMS templates
  const csT = await cs.query('SELECT id, name, department FROM form_templates ORDER BY id');
  console.log('\n=== ALL CSMS TEMPLATES ===');
  for (const t of csT.rows) {
    const cnt = await cs.query('SELECT COUNT(*) as n FROM form_submissions WHERE template_id=$1', [t.id]);
    console.log(`  id=${t.id} | ${t.name} | ${t.department} | ${cnt.rows[0].n} submissions`);
  }

  // ISBAR total per department
  console.log('\n=== ISBAR SUBMISSIONS BY DEPARTMENT ===');
  const ibDept = await ib.query('SELECT template_department, COUNT(*) as n FROM form_submissions GROUP BY template_department ORDER BY n DESC');
  ibDept.rows.forEach(r => console.log(`  ${r.template_department}: ${r.n}`));

  // CSMS total per department
  console.log('\n=== CSMS SUBMISSIONS BY DEPARTMENT ===');
  const csDept = await cs.query('SELECT template_department, COUNT(*) as n FROM form_submissions GROUP BY template_department ORDER BY n DESC');
  csDept.rows.forEach(r => console.log(`  ${r.template_department}: ${r.n}`));

  // Compare totals
  const ibTotal = await ib.query('SELECT COUNT(*) as n FROM form_submissions');
  const csTotal = await cs.query('SELECT COUNT(*) as n FROM form_submissions');
  console.log(`\nISBAR total: ${ibTotal.rows[0].n}`);
  console.log(`CSMS total: ${csTotal.rows[0].n}`);
  console.log(`Difference: ${ibTotal.rows[0].n - csTotal.rows[0].n}`);

  await ib.end();
  await cs.end();
}

check();

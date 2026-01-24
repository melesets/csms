import pool from '../src/pool.js';

async function getCount(table) {
  try {
    const res = await pool.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
    return res.rows[0]?.count ?? 0;
  } catch (e) {
    return `error: ${e.message}`;
  }
}

async function main() {
  const info = {};
  try {
    await pool.query('SELECT 1');
    info.connected = true;
  } catch (e) {
    info.connected = false;
    info.error = e.message;
  }
  info.database_url = process.env.DATABASE_URL || null;
  info.pg = {
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    user: process.env.PGUSER,
    db: process.env.PGDATABASE
  };

  info.counts = {};
  for (const t of ['users','form_templates','forms','isbar_records','department_staff','resources','dashboard_mappings','form_submissions']) {
    info.counts[t] = await getCount(t);
  }

  console.log(JSON.stringify(info, null, 2));
  await pool.end().catch(()=>{});
}

main().catch(err => { console.error(err); process.exit(1); });

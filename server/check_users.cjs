const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:1954@localhost:1212/ISBAR';
const pool = new Pool({ connectionString });

// Users to check (case-insensitive match on username OR name; email if provided)
const targets = [
  { username: 'Kalkidan', email: 'kal123@gamil.com', role: 'user', department: 'NICU' },
  { username: 'quality', email: 'quality@isbar.local', role: 'admin', department: 'Quality' },
  { username: 'milla', email: 'million@gmail.com', role: 'user', department: 'Surgery' },
  { username: 'ale', role: 'user', department: 'Obstetrics Unit' },
  { username: 'seni', role: 'user', department: 'Medical Ward' },
  { username: 'beki', role: 'user', department: 'Pediatrics Ward' },
  { username: 'addi', role: 'user', department: 'ICU' },
  { username: 'mintA', email: 'minto@gmail.com', role: 'user', department: 'Medical Ward' },
];

(async () => {
  try {
    const res = await pool.query('SELECT id, username, name, email, role, department, isActive, created_at FROM users');
    const users = res.rows;

    const found = [];
    const missing = [];

    for (const t of targets) {
      const hit = users.find(u =>
        (u.username && String(u.username).toLowerCase() === String(t.username).toLowerCase()) ||
        (u.name && String(u.name).toLowerCase() === String(t.username).toLowerCase()) ||
        (t.email && u.email && String(u.email).toLowerCase() === String(t.email).toLowerCase())
      );
      if (hit) {
        found.push({ target: t, db: hit });
      } else {
        missing.push(t);
      }
    }

    console.log('\n=== Users in DB (matches) ===');
    for (const f of found) {
      const u = f.db;
      console.log(`- ${u.username || u.name} | email: ${u.email || 'N/A'} | role: ${u.role} | dept: ${u.department || 'N/A'} | active: ${u.isactive ?? u.isActive ?? 'N/A'} | created: ${u.created_at || 'N/A'}`);
    }

    console.log('\n=== Missing Users ===');
    for (const m of missing) {
      console.log(`- ${m.username} | email: ${m.email || 'N/A'} | role: ${m.role} | dept: ${m.department}`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error checking users:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();

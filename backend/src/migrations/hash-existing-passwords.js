// Migration script: hash all existing plain-text passwords in the users table
// Run once: node src/migrations/hash-existing-passwords.js
// Safe to re-run — skips already-hashed passwords (starting with $2)

import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE,
});

async function migrate() {
  console.log('[Migration] Hashing plain-text passwords...');
  const { rows } = await pool.query(`SELECT id, username, password FROM users`);

  let updated = 0;
  for (const user of rows) {
    if (!user.password || user.password.startsWith('$2')) {
      continue; // already hashed or no password
    }
    const hash = await bcrypt.hash(user.password, 10);
    await pool.query(`UPDATE users SET password = $1 WHERE id = $2`, [hash, user.id]);
    console.log(`  ✓ Hashed password for user "${user.username}" (id=${user.id})`);
    updated++;
  }

  console.log(`[Migration] Done. Updated ${updated} of ${rows.length} users.`);
  await pool.end();
}

migrate().catch((err) => {
  console.error('[Migration] Failed:', err.message);
  process.exit(1);
});

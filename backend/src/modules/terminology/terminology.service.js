// Terminology service - search and import medical terminology codes

import pool from '../../config/database.js';

export async function searchTerminology(q, system, limit, subset) {
  const limits = parseInt(limit) || 50;
  const result = await pool.query(
    `SELECT system, code, display, category, datatype, units FROM terminology_codes 
     WHERE is_active = true 
     AND ($1::text IS NULL OR system = $1)
     AND ($2::text IS NULL OR display ILIKE '%' || $2 || '%' OR code ILIKE '%' || $2 || '%')
     AND ($3::text IS NULL OR category = $3)
     ORDER BY display ASC LIMIT $4`,
    [system || null, q || null, subset || null, limits]
  );
  return result.rows;
}

export async function importTerminology(codes) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const code of codes) {
      await client.query(
        `INSERT INTO terminology_codes (system, code, display) VALUES ($1, $2, $3) ON CONFLICT (system, code) DO NOTHING`,
        [code.system, code.code, code.display]
      );
    }
    await client.query('COMMIT');
    return { success: true, count: codes.length };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

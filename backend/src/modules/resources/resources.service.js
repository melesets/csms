// Resources service - CRUD for hospital resource inventory
// Manages resources table for tracking supplies and equipment

import pool from '../../config/database.js';

export async function findAllResources(department) {
  if (department) {
    const { rows } = await pool.query('SELECT * FROM resources WHERE LOWER(department) = LOWER($1) ORDER BY id DESC', [department]);
    return rows;
  }
  const result = await pool.query('SELECT * FROM resources ORDER BY id DESC');
  return result.rows;
}

export async function createResource(data) {
  const { name, type, quantity, standard_quantity, unit, expiry_date, batch_number, department, last_updated_by, last_updated_by_name, shift_session_id, last_updated_by_id } = data;
  const result = await pool.query(
    'INSERT INTO resources (name, type, quantity, standard_quantity, unit, expiry_date, batch_number, department, last_updated_by, last_updated_by_name, shift_session_id, last_updated_by_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *',
    [name, type, quantity, standard_quantity, unit, expiry_date, batch_number, department, last_updated_by || null, last_updated_by_name || null, shift_session_id || null, last_updated_by_id || null]
  );
  return result.rows[0];
}

export async function updateResource(id, data) {
  const { name, type, quantity, standard_quantity, unit, expiry_date, batch_number, last_updated_by, last_updated_by_name, shift_session_id, last_updated_by_id } = data;
  const result = await pool.query(
    'UPDATE resources SET name=$1, type=$2, quantity=$3, standard_quantity=$4, unit=$5, expiry_date=$6, batch_number=$7, last_updated_by=$8, last_updated_by_name=$9, shift_session_id=$10, last_updated_by_id=$11 WHERE id=$12 RETURNING *',
    [name, type, quantity, standard_quantity, unit, expiry_date, batch_number, last_updated_by || null, last_updated_by_name || null, shift_session_id || null, last_updated_by_id || null, id]
  );
  return result.rows[0] || null;
}

export async function deleteResource(id) {
  const result = await pool.query('DELETE FROM resources WHERE id=$1 RETURNING id', [id]);
  return result.rows.length > 0;
}

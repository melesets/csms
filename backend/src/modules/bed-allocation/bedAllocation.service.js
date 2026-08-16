// Bed allocation service - manage beds and staff-to-bed assignments per department
import pool from '../../config/database.js';

export async function getBeds(department) {
  let query = `SELECT id, name, department, is_active, created_by AS "createdBy", created_at AS "createdAt"
               FROM beds WHERE 1=1`;
  const params = [];
  if (department) {
    params.push(department);
    query += ` AND LOWER(department) = LOWER($${params.length})`;
  }
  query += ` ORDER BY is_active DESC, id ASC`;
  const { rows } = await pool.query(query, params);
  return rows;
}

export async function createBed(data) {
  const { name, department, createdBy } = data;
  const { rows } = await pool.query(
    `INSERT INTO beds (name, department, created_by) VALUES ($1, $2, $3)
     ON CONFLICT (department, name) DO UPDATE SET is_active = TRUE
     RETURNING id, name, department, is_active, created_by AS "createdBy", created_at AS "createdAt"`,
    [name.trim(), department, createdBy || null]
  );
  return rows[0];
}

export async function updateBed(id, data) {
  const { name, isActive } = data;
  const { rows } = await pool.query(
    `UPDATE beds SET name = COALESCE($2, name), is_active = COALESCE($3, is_active)
     WHERE id = $1
     RETURNING id, name, department, is_active, created_by AS "createdBy", created_at AS "createdAt"`,
    [id, name ? name.trim() : null, isActive === undefined ? null : isActive]
  );
  return rows[0] || null;
}

export async function deleteBed(id) {
  const { rowCount } = await pool.query('DELETE FROM beds WHERE id = $1', [id]);
  return rowCount > 0;
}

export async function getBedAllocations({ department, startDate, endDate }) {
  const conditions = ['ba.department = $1', 'ba.allocation_date >= $2', 'ba.allocation_date <= $3'];
  const params = [department, startDate, endDate];
  const { rows } = await pool.query(
    `SELECT ba.id, ba.bed_id AS "bedId", ba.staff_user_id AS "staffUserId",
            TO_CHAR(ba.allocation_date, 'YYYY-MM-DD') AS "allocationDate",
            ba.department, ba.created_at AS "createdAt",
            b.name AS "bedName",
            u.name AS "staffName", u.profession AS "staffRole", u.profile_picture
     FROM bed_allocations ba
     JOIN beds b ON b.id = ba.bed_id
     JOIN users u ON u.id = ba.staff_user_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY ba.allocation_date ASC, b.name ASC`,
    params
  );
  return rows;
}

export async function createBedAllocation(data) {
  const { bedId, staffUserId, allocationDate, department, createdBy } = data;
  const { rows } = await pool.query(
    `INSERT INTO bed_allocations (bed_id, staff_user_id, allocation_date, department, created_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (staff_user_id, allocation_date, department)
     DO UPDATE SET bed_id = $1, created_by = $5, created_at = NOW()
     RETURNING id, bed_id AS "bedId", staff_user_id AS "staffUserId",
               TO_CHAR(allocation_date, 'YYYY-MM-DD') AS "allocationDate",
               department, created_by AS "createdBy", created_at AS "createdAt"`,
    [bedId, staffUserId, allocationDate, department, createdBy || null]
  );
  return rows[0];
}

export async function deleteBedAllocation(id) {
  const { rowCount } = await pool.query('DELETE FROM bed_allocations WHERE id = $1', [id]);
  return rowCount > 0;
}

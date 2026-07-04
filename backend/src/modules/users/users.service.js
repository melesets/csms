// Users service - CRUD operations for user management
import pool from '../../config/database.js';
import bcrypt from 'bcryptjs';

export async function findAllUsers(department) {
  let query = `
    SELECT 
      u.id, u.username, u.name, u.email, u.role, u.department, u.profession, u.permissions, 
      u.isactive AS "isActive", u.created_at AS "createdAt", u.created_by AS "createdBy",
      u.has_pin, u.shift_type AS "shiftType",
      ss.shift_name AS "currentShift",
      ss.start_time AS "shiftStartTime",
      ss.is_active AS "isOnDuty"
    FROM users u
    LEFT JOIN shift_sessions ss ON u.username = ss.username AND ss.is_active = true
  `;
  const params = [];
  if (department) {
    query += ' WHERE u.department = $1';
    params.push(department);
  }
  query += ' ORDER BY u.created_at DESC';
  const result = await pool.query(query, params);
  return result.rows.map(row => ({
    ...row,
    permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions) : (row.permissions || []),
  }));
}

export async function createUser(data) {
  const { username, password, pin, name, email, role, department, isActive, permissions, profession, createdBy, shiftType } = data;
  
  let pinHash = null;
  let hasPin = false;
  if (pin && String(pin).length === 4) {
    pinHash = await bcrypt.hash(String(pin), 10);
    hasPin = true;
  }

  const result = await pool.query(
    `INSERT INTO users (username, password, pin_hash, has_pin, name, email, role, department, isactive, permissions, profession, created_by, shift_type, created_at) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()) 
     RETURNING id, username, name, email, role, department, isactive AS "isActive", has_pin, permissions, profession, shift_type AS "shiftType", created_by AS "createdBy", created_at AS "createdAt"`,
    [username, password, pinHash, hasPin, name, email ?? null, role, department, isActive ?? true, permissions ? JSON.stringify(permissions) : null, profession ?? null, createdBy ?? null, shiftType ?? 'TID']
  );

  const user = result.rows[0];
  if (typeof user.permissions === 'string') user.permissions = JSON.parse(user.permissions);
  return user;
}

export async function updateUser(id, data) {
  const { username, password, pin, removePin, email, role, name, department, isActive, profession, permissions, shiftType } = data;

  let pinHashUpdate = null;
  let hasPinUpdate = null;
  if (removePin) {
    pinHashUpdate = null;
    hasPinUpdate = false;
  } else if (pin && String(pin).length === 4) {
    pinHashUpdate = await bcrypt.hash(String(pin), 10);
    hasPinUpdate = true;
  }

  const result = await pool.query(
    `UPDATE users SET 
      username = COALESCE($1, username),
      password = COALESCE($2, password),
      email = COALESCE($3, email),
      role = COALESCE($4, role),
      name = COALESCE($5, name),
      department = COALESCE($6, department),
      isactive = COALESCE($7, isactive),
      profession = COALESCE($8, profession),
      permissions = COALESCE($9, permissions),
      shift_type = COALESCE($10, shift_type),
      pin_hash = CASE WHEN $11::boolean = true THEN null WHEN $12::text IS NOT NULL THEN $12::text ELSE pin_hash END,
      has_pin = CASE WHEN $11::boolean = true THEN false WHEN $13::boolean IS NOT NULL THEN $13::boolean ELSE has_pin END
    WHERE id = $14
    RETURNING id, username, name, email, role, department, profession, permissions, shift_type AS "shiftType", isactive AS "isActive", has_pin, created_at AS "createdAt", created_by AS "createdBy"`,
    [username ?? null, password ?? null, email ?? null, role ?? null, name ?? null, department ?? null, isActive ?? null, profession ?? null, permissions ? JSON.stringify(permissions) : null, shiftType ?? null, removePin ? true : false, pinHashUpdate, hasPinUpdate, id]
  );

  if (result.rows.length === 0) return null;
  const user = result.rows[0];
  if (typeof user.permissions === 'string') user.permissions = JSON.parse(user.permissions);
  return user;
}

export async function deleteUser(id) {
  const result = await pool.query('DELETE FROM users WHERE id=$1 RETURNING id', [id]);
  return result.rows.length > 0;
}

export async function setPin(id, pin) {
  const pinHash = await bcrypt.hash(pin, 10);
  const result = await pool.query(
    'UPDATE users SET pin_hash = $1, has_pin = TRUE WHERE id = $2 RETURNING id, username, name, has_pin',
    [pinHash, id]
  );
  return result.rows[0] || null;
}

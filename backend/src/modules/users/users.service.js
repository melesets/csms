// Users service - CRUD operations for user management
import pool from '../../config/database.js';
import bcrypt from 'bcryptjs';

export async function findAllUsers(department, parentId) {
  let query = `
    SELECT 
      u.id, u.username, u.name, u.email, u.role, u.department, u.profession, u.permissions, 
      u.isactive AS "isActive", u.created_at AS "createdAt", u.created_by AS "createdBy",
      u.parent_user_id AS "parentUserId",
      u.has_pin, u.shift_type AS "shiftType",
      ss.shift_name AS "currentShift",
      ss.start_time AS "shiftStartTime",
      ss.is_active AS "isOnDuty"
    FROM users u
    LEFT JOIN shift_sessions ss ON u.username = ss.username AND ss.is_active = true
  `;
  const params = [];
  const conditions = [];
  
  if (department) {
    conditions.push(`u.department = $${params.length + 1}`);
    params.push(department);
  }
  if (parentId) {
    conditions.push(`u.parent_user_id = $${params.length + 1}`);
    params.push(parentId);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY u.created_at DESC';
  const result = await pool.query(query, params);
  return result.rows.map(row => ({
    ...row,
    permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions) : (row.permissions || []),
  }));
}

export async function findStaffByParentId(parentUserId) {
  const result = await pool.query(
    `SELECT 
      u.id, u.username, u.name, u.email, u.role, u.department, u.profession,
      u.isactive AS "isActive", u.has_pin, u.parent_user_id AS "parentUserId",
      u.created_at AS "createdAt",
      ss.shift_name AS "currentShift",
      ss.is_active AS "isOnDuty"
    FROM users u
    LEFT JOIN shift_sessions ss ON u.username = ss.username AND ss.is_active = true
    WHERE u.parent_user_id = $1 AND u.role = 'staff'
    ORDER BY u.name`,
    [parentUserId]
  );
  return result.rows;
}

export async function createUser(data) {
  const { username, password, pin, name, email, role, department, isActive, permissions, profession, createdBy, shiftType, parentUserId } = data;
  
  // Hash password with bcrypt (10 salt rounds)
  const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

  let pinHash = null;
  let hasPin = false;
  if (pin && String(pin).length === 4) {
    pinHash = await bcrypt.hash(String(pin), 10);
    hasPin = true;
  }

  const result = await pool.query(
    `INSERT INTO users (username, password, pin_hash, has_pin, name, email, role, department, isactive, permissions, profession, created_by, shift_type, parent_user_id, created_at) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW()) 
     RETURNING id, username, name, email, role, department, isactive AS "isActive", has_pin, permissions, profession, shift_type AS "shiftType", created_by AS "createdBy", parent_user_id AS "parentUserId", created_at AS "createdAt"`,
    [username, hashedPassword, pinHash, hasPin, name, email ?? null, role, department, isActive ?? true, permissions ? JSON.stringify(permissions) : null, profession ?? null, createdBy ?? null, shiftType ?? '8H', parentUserId ?? null]
  );

  const user = result.rows[0];
  if (typeof user.permissions === 'string') user.permissions = JSON.parse(user.permissions);
  return user;
}

export async function updateUser(id, data) {
  const { username, password, pin, removePin, email, role, name, department, isActive, profession, permissions, shiftType, parentUserId } = data;

  // Hash password if provided
  const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

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
      parent_user_id = COALESCE($15, parent_user_id),
      pin_hash = CASE WHEN $11::boolean = true THEN null WHEN $12::text IS NOT NULL THEN $12::text ELSE pin_hash END,
      has_pin = CASE WHEN $11::boolean = true THEN false WHEN $13::boolean IS NOT NULL THEN $13::boolean ELSE has_pin END
    WHERE id = $14
    RETURNING id, username, name, email, role, department, profession, permissions, shift_type AS "shiftType", isactive AS "isActive", has_pin, parent_user_id AS "parentUserId", created_at AS "createdAt", created_by AS "createdBy"`,
    [username ?? null, hashedPassword, email ?? null, role ?? null, name ?? null, department ?? null, isActive ?? null, profession ?? null, permissions ? JSON.stringify(permissions) : null, shiftType ?? null, removePin ? true : false, pinHashUpdate, hasPinUpdate, id, parentUserId ?? null]
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

export async function verifyPassword(userId, password) {
  const result = await pool.query('SELECT id, password FROM users WHERE id = $1 AND isactive = TRUE', [userId]);
  if (result.rows.length === 0) return { valid: false, error: 'User not found' };
  const valid = await bcrypt.compare(password, result.rows[0].password);
  return { valid, error: valid ? null : 'Invalid password' };
}

export async function resetStaffPin(staffId, newPin, verifierId) {
  // Verify the verifier has authority over this staff member
  const verifierResult = await pool.query('SELECT role, department, parent_user_id FROM users WHERE id = $1 AND isactive = TRUE', [verifierId]);
  if (verifierResult.rows.length === 0) return { error: 'Verifier not found', status: 404 };
  const verifier = verifierResult.rows[0];

  const staffResult = await pool.query('SELECT id, parent_user_id, department FROM users WHERE id = $1 AND role = \'staff\'', [staffId]);
  if (staffResult.rows.length === 0) return { error: 'Staff not found', status: 404 };
  const staff = staffResult.rows[0];

  // admin/superadmin can reset anyone
  if (verifier.role !== 'admin' && verifier.role !== 'superadmin') {
    // user (department head) can only reset their own staff
    if (verifier.role === 'user') {
      if (staff.parent_user_id !== verifierId) {
        return { error: 'You can only reset PINs for staff assigned to you', status: 403 };
      }
    } else {
      return { error: 'Unauthorized', status: 403 };
    }
  }

  const pinHash = await bcrypt.hash(String(newPin), 10);
  const result = await pool.query(
    'UPDATE users SET pin_hash = $1, has_pin = TRUE WHERE id = $2 AND role = \'staff\' RETURNING id, username, name, has_pin',
    [pinHash, staffId]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

export async function setPin(id, pin) {
  const pinHash = await bcrypt.hash(pin, 10);
  const result = await pool.query(
    'UPDATE users SET pin_hash = $1, has_pin = TRUE WHERE id = $2 RETURNING id, username, name, has_pin',
    [pinHash, id]
  );
  return result.rows[0] || null;
}

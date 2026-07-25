// Authentication service - user lookup and permission defaults
import pool from '../../config/database.js';

export async function findUserByUsername(username) {
  const result = await pool.query(
    `SELECT id, username, password, name, email, role, department, profession, isactive, permissions, created_by, has_pin, pin_hash
     FROM users WHERE username = $1`,
    [username]
  );
  return result.rows[0] || null;
}

export async function findUserById(id) {
  const result = await pool.query(
    `SELECT id, username, name, email, role, department, profession, isactive, permissions, created_by, has_pin
     FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

export function getDefaultPermissions(role) {
  if (role === 'admin' || role === 'superadmin') {
    return [
      { module: 'dashboard', actions: ['view'] },
      { module: 'isbar', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'staff', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'resources', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'database', actions: ['view', 'export'] },
      { module: 'trends', actions: ['view'] },
      { module: 'scheduling', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'form-builder', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'user-management', actions: ['view', 'create', 'edit', 'delete'] },
    ];
  }
  if (role === 'user') {
    return [
      { module: 'dashboard', actions: ['view'] },
      { module: 'isbar', actions: ['view', 'create'] },
      { module: 'staff', actions: ['view'] },
      { module: 'resources', actions: ['view'] },
      { module: 'database', actions: ['view'] },
      { module: 'trends', actions: ['view'] },
      { module: 'scheduling', actions: ['view', 'create', 'edit'] },
      { module: 'forms', actions: ['edit'] },
    ];
  }
  if (role === 'staff') {
    return [
      { module: 'dashboard', actions: ['view'] },
      { module: 'scheduling', actions: ['view'] },
      { module: 'forms', actions: ['edit'] },
    ];
  }
  return [
    { module: 'dashboard', actions: ['view'] },
    { module: 'isbar', actions: ['view', 'create'] },
    { module: 'forms', actions: ['edit'] },
  ];
}

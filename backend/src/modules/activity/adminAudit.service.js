// Admin audit log service - records privileged actions for compliance and debugging
import pool from '../../config/database.js';

/**
 * Log an admin action to the admin_activity_log table.
 * @param {Object} params
 * @param {string} params.action    - e.g. 'delete', 'toggle', 'create'
 * @param {string} params.module    - e.g. 'dashboard-mappings', 'users', 'resources'
 * @param {string} [params.targetId] - ID of the affected record
 * @param {string} [params.detail]   - human-readable description
 * @param {string} params.performedBy - username from req.user
 * @param {string} [params.ip]       - client IP address
 */
export async function logAdminAction({ action, module: mod, targetId, detail, performedBy, ip }) {
  try {
    await pool.query(
      `INSERT INTO admin_activity_log (action, module, target_id, detail, performed_by, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [action, mod, targetId || null, detail || null, performedBy || 'unknown', ip || null]
    );
  } catch (err) {
    console.error('[AdminAudit] Failed to log action:', err.message);
  }
}

/**
 * Fetch recent admin activity (for admin dashboard).
 * @param {number} limit - max rows to return (default 50)
 */
export async function getRecentActivity(limit = 50) {
  const result = await pool.query(
    `SELECT id, action, module, target_id, detail, performed_by, ip_address, created_at
     FROM admin_activity_log
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

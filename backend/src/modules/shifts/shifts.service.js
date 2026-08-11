// Shifts service - shift calculation, check-in/out, handovers, and staff actions
import pool from '../../config/database.js';
import bcrypt from 'bcryptjs';

// Max hours per shift type before auto-checkout
const SHIFT_MAX_HOURS = {
  TID: 8,
  BID: 12,
  '24H': 24,
  '36H': 36,
  '48H': 48,
};

export function getShiftName(date, shiftType = 'TID') {
  const eatTime = new Date(date.getTime() + (3 * 3600 * 1000));
  const hour = eatTime.getUTCHours();

  if (shiftType === 'BID') {
    if (hour >= 7 && hour < 19) return 'Day Shift (BID)';
    return 'Night Shift (BID)';
  }
  if (shiftType === '24H' || shiftType === '36H' || shiftType === '48H') {
    return `${shiftType} On-Call`;
  }
  if (hour >= 7 && hour < 13) return 'Morning (TID)';
  if (hour >= 13 && hour < 19) return 'Afternoon (TID)';
  return 'Night (TID)';
}

/**
 * Auto-checkout expired staff sessions based on their department's shift type.
 * Runs periodically as a background job.
 * 
 * Logic:
 * - TID: auto-checkout after >8 hours
 * - BID: auto-checkout after >12 hours
 * - 24H: auto-checkout after >24 hours
 * - 36H: auto-checkout after >36 hours
 * - 48H: auto-checkout after >48 hours
 */
export async function autoCheckoutExpiredSessions() {
  try {
    // Find all active sessions with their user's department
    const activeSessions = await pool.query(`
      SELECT ss.id AS session_id, ss.user_id, ss.start_time, u.department, u.username
      FROM shift_sessions ss
      JOIN users u ON ss.user_id = u.id
      WHERE ss.is_active = TRUE AND u.isactive = TRUE
    `);

    if (activeSessions.rows.length === 0) return { checkedOut: 0 };

    let checkedOut = 0;
    const now = new Date();

    for (const session of activeSessions.rows) {
      // Get the department's shift type from the parent user (role='user') in the same department
      const deptConfig = await pool.query(
        "SELECT shift_type FROM users WHERE role = 'user' AND department = $1 LIMIT 1",
        [session.department]
      );
      const shiftType = deptConfig.rows[0]?.shift_type || 'TID';
      const maxHours = SHIFT_MAX_HOURS[shiftType] || 8;

      // Calculate session duration in hours
      const startTime = new Date(session.start_time);
      const durationMs = now.getTime() - startTime.getTime();
      const durationHours = durationMs / (1000 * 60 * 60);

      // Auto-checkout if exceeded max hours
      if (durationHours > maxHours) {
        await pool.query(
          'UPDATE shift_sessions SET end_time = NOW(), is_active = FALSE WHERE id = $1',
          [session.session_id]
        );
        await pool.query(
          'UPDATE users SET active_shift_id = NULL WHERE id = $1 AND active_shift_id = $2',
          [session.user_id, session.session_id]
        );
        checkedOut++;
        console.log(`[AutoCheckout] ${session.username} (session ${session.session_id}) auto-checked out after ${durationHours.toFixed(1)}h (max: ${maxHours}h, shift: ${shiftType})`);
      }
    }

    return { checkedOut };
  } catch (err) {
    console.error('[AutoCheckout] Error:', err.message);
    return { checkedOut: 0, error: err.message };
  }
}

export async function getShiftContext() {
  const now = new Date();
  return { current: getShiftName(now), isHandoverWindow: false, minutesToHandover: null };
}

export async function checkIn(data) {
  const { userId, username, profession, ward } = data;
  const now = new Date();
  const shiftName = getShiftName(now);

  const existingSession = await pool.query(
    'SELECT id FROM shift_sessions WHERE user_id = $1 AND is_active = TRUE LIMIT 1',
    [userId]
  );
  if (existingSession.rows.length > 0) {
    return { sessionId: existingSession.rows[0].id, shiftName };
  }

  const lastSession = await pool.query(
    'SELECT username, user_id FROM shift_sessions WHERE ward = $1 AND profession = $2 ORDER BY start_time DESC LIMIT 1',
    [ward, profession]
  );

  let handoverRequired = false;
  let predecessor = null;
  if (lastSession.rows.length > 0 && lastSession.rows[0].user_id !== userId) {
    handoverRequired = true;
    predecessor = lastSession.rows[0].username;
  }

  const result = await pool.query(
    `INSERT INTO shift_sessions (user_id, username, profession, ward, shift_name, start_time, is_active) 
     VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING id`,
    [userId, username, profession, ward, shiftName, now]
  );

  const sessionId = result.rows[0].id;
  await pool.query('UPDATE users SET active_shift_id = $1 WHERE id = $2', [sessionId, userId]);

  return { sessionId, shiftName, handoverRequired, predecessor };
}

export async function checkOut(data) {
  const { userId, sessionId } = data;
  await pool.query(
    'UPDATE shift_sessions SET end_time = NOW(), is_active = FALSE WHERE id = $1 AND user_id = $2',
    [sessionId, userId]
  );
  await pool.query('UPDATE users SET active_shift_id = NULL WHERE id = $1', [userId]);
  return { success: true };
}

export async function submitHandover(data) {
  const { fromUserId, toUserId, ward, profession, shiftName, handoverData, mrn } = data;
  const result = await pool.query(
    `INSERT INTO clinical_handovers (from_user_id, to_user_id, ward, profession, shift_name, handover_data, mrn) 
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [fromUserId, toUserId, ward, profession, shiftName, JSON.stringify(handoverData), mrn || null]
  );
  return result.rows[0];
}

export async function getLatestHandover(ward, profession, mrn) {
  let query = 'SELECT h.*, u.username as from_username FROM clinical_handovers h JOIN users u ON h.from_user_id = u.id';
  const conditions = ['h.ward = $1', 'h.profession = $2'];
  const params = [ward, profession];

  if (mrn) {
    conditions.push(`h.mrn = $${params.length + 1}`);
    params.push(mrn);
  } else {
    conditions.push('h.mrn IS NULL');
  }

  query += ' WHERE ' + conditions.join(' AND ') + ' ORDER BY h.created_at DESC LIMIT 1';
  const result = await pool.query(query, params);
  return result.rows[0] || null;
}

export async function getCheckInLogs(filters = {}) {
  const { startDate, endDate, department, staffId, page = 1, limit = 50, parentUserId } = filters;
  const params = [];
  const conditions = [];

  if (startDate) {
    params.push(startDate);
    conditions.push(`ss.start_time >= $${params.length}`);
  }
  if (endDate) {
    params.push(endDate);
    conditions.push(`ss.start_time <= $${params.length}`);
  }
  if (department) {
    params.push(department);
    conditions.push(`u.department = $${params.length}`);
  }
  if (staffId) {
    params.push(staffId);
    conditions.push(`ss.user_id = $${params.length}`);
  }
  if (parentUserId) {
    params.push(parentUserId);
    conditions.push(`(u.parent_user_id = $${params.length} OR u.id = $${params.length})`);
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const offset = (page - 1) * limit;

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM shift_sessions ss JOIN users u ON ss.user_id = u.id ${whereClause}`,
    params
  );

  params.push(limit, offset);
  const result = await pool.query(
    `SELECT ss.id, ss.user_id, ss.username, ss.profession, ss.ward, ss.shift_name,
            ss.start_time, ss.end_time, ss.is_active, u.department,
            CASE WHEN ss.end_time IS NOT NULL
              THEN EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 3600
              ELSE EXTRACT(EPOCH FROM (NOW() - ss.start_time)) / 3600
            END AS duration_hours
     FROM shift_sessions ss
     JOIN users u ON ss.user_id = u.id
     ${whereClause}
     ORDER BY ss.start_time DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    logs: result.rows,
    total: parseInt(countResult.rows[0].count),
    page,
    totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
  };
}

export async function getAttendanceReport(filters = {}) {
  const { startDate, endDate, department, parentUserId } = filters;
  const params = [];
  const conditions = [];

  if (startDate) {
    params.push(startDate);
    conditions.push(`ss.start_time >= $${params.length}`);
  }
  if (endDate) {
    params.push(endDate);
    conditions.push(`ss.start_time <= $${params.length}`);
  }
  if (department) {
    params.push(department);
    conditions.push(`u.department = $${params.length}`);
  }
  if (parentUserId) {
    params.push(parentUserId);
    conditions.push(`(u.parent_user_id = $${params.length} OR u.id = $${params.length})`);
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const result = await pool.query(
    `SELECT u.id, u.username, u.name, u.department, u.profession,
            COUNT(ss.id) AS total_shifts,
            COALESCE(SUM(
              CASE WHEN ss.end_time IS NOT NULL
                THEN EXTRACT(EPOCH FROM (ss.end_time - ss.start_time)) / 3600
                ELSE EXTRACT(EPOCH FROM (NOW() - ss.start_time)) / 3600
              END
            ), 0) AS total_hours,
            COUNT(CASE WHEN ss.is_active = TRUE THEN 1 END) AS active_shifts
     FROM users u
     LEFT JOIN shift_sessions ss ON u.id = ss.user_id
     ${whereClause ? whereClause + ' AND' : 'WHERE'} u.role = 'staff' AND u.isactive = TRUE
     GROUP BY u.id, u.username, u.name, u.department, u.profession
     ORDER BY u.department, u.name`,
    params
  );

  return result.rows;
}

export async function getActiveStaff(department) {
  let query = `
    SELECT u.id, u.username, u.name, u.profession, u.department, u.has_pin, u.profile_picture,
           ss.id AS session_id, ss.shift_name, ss.start_time
    FROM users u
    LEFT JOIN shift_sessions ss ON u.id = ss.user_id AND ss.is_active = TRUE
    WHERE u.role = 'staff' AND u.isactive = TRUE
  `;
  const params = [];
  if (department) {
    params.push(department);
    query += ` AND u.department = $${params.length}`;
  }
  query += ' ORDER BY u.department ASC, u.name ASC';
  const result = await pool.query(query, params);
  return result.rows;
}

export async function staffAction(data) {
  const { userId, pin, action, ward, shiftName, bypassPin } = data;

  const userResult = await pool.query('SELECT pin_hash, department FROM users WHERE id = $1 AND isactive = TRUE', [userId]);
  if (userResult.rows.length === 0) return { error: 'User not found', status: 404 };

  const { pin_hash: pinHash, department: userDept } = userResult.rows[0];

  const deptConfigResult = await pool.query(
    "SELECT shift_type FROM users WHERE role = 'user' AND department = $1 LIMIT 1",
    [userDept]
  );
  const deptShiftType = deptConfigResult.rows[0]?.shift_type || 'TID';

  if (!bypassPin) {
    if (!pinHash) return { error: 'No PIN set for this staff member and PIN bypass is off.', status: 403 };
    if (!pin || pin.length !== 4) return { error: '4-digit PIN required', status: 400 };
    const match = await bcrypt.compare(pin, pinHash);
    if (!match) return { error: 'Invalid PIN', status: 401 };
  }

  if (action === 'check-in') {
    const now = new Date();
    const sName = shiftName || getShiftName(now, deptShiftType);
    await pool.query('UPDATE shift_sessions SET end_time = NOW(), is_active = FALSE WHERE user_id = $1 AND is_active = TRUE', [userId]);
    const result = await pool.query(
      `INSERT INTO shift_sessions (user_id, username, profession, ward, shift_name, start_time, is_active) 
       SELECT id, username, profession, $1, $2, $3, TRUE FROM users WHERE id = $4 RETURNING id`,
      [ward, sName, now, userId]
    );
    const sessionId = result.rows[0].id;
    await pool.query('UPDATE users SET active_shift_id = $1 WHERE id = $2', [sessionId, userId]);
    return { success: true, sessionId };
  } else if (action === 'check-out') {
    await pool.query('UPDATE shift_sessions SET end_time = NOW(), is_active = FALSE WHERE user_id = $1 AND is_active = TRUE', [userId]);
    await pool.query('UPDATE users SET active_shift_id = NULL WHERE id = $1', [userId]);
    return { success: true };
  }
  return { error: 'Invalid action', status: 400 };
}

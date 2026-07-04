// Unit auth service - unit management, PIN verification, shift windows, and unit sessions
import pool from '../../config/database.js';
import bcrypt from 'bcryptjs';

export async function getCurrentShiftContext(unitId) {
  const now = new Date();
  const localHour = now.getHours();

  const { rows: windows } = await pool.query(
    'SELECT * FROM shift_windows WHERE unit_id = $1 ORDER BY start_hour',
    [unitId]
  );
  if (!windows.length) {
    if (localHour >= 7 && localHour < 15) return { current: 'Morning', isHandoverWindow: false, minutesToHandover: null };
    if (localHour >= 15 && localHour < 23) return { current: 'Evening', isHandoverWindow: false, minutesToHandover: null };
    return { current: 'Night', isHandoverWindow: false, minutesToHandover: null };
  }

  for (let i = 0; i < windows.length; i++) {
    const w = windows[i];
    const next = windows[(i + 1) % windows.length];
    const hw = w.handover_window_minutes;
    let inShift;
    if (w.start_hour > w.end_hour) {
      inShift = localHour >= w.start_hour || localHour < w.end_hour;
    } else {
      inShift = localHour >= w.start_hour && localHour < w.end_hour;
    }
    if (inShift) {
      const nowMinutes = localHour * 60 + now.getMinutes();
      const endMinutes = w.end_hour * 60;
      let minutesToHandover = endMinutes - nowMinutes;
      if (minutesToHandover < 0) minutesToHandover += 24 * 60;
      return { current: w.shift_name, incoming: next.shift_name, isHandoverWindow: minutesToHandover <= hw, minutesToHandover, handoverWindowMinutes: hw };
    }
  }
  return { current: 'Unknown', isHandoverWindow: false, minutesToHandover: null };
}

export async function listUnits() {
  const { rows } = await pool.query('SELECT id, name, description, department FROM service_units WHERE is_active = TRUE ORDER BY name');
  return rows;
}

export async function createUnit(data) {
  const { name, description, department, pin } = data;
  const pin_hash = pin ? await bcrypt.hash(String(pin), 10) : null;
  const { rows } = await pool.query(
    `INSERT INTO service_units (name, description, department, pin_hash) VALUES ($1, $2, $3, $4) RETURNING id, name, description, department`,
    [name, description || null, department || null, pin_hash]
  );
  const shifts = [
    { name: 'Morning', start: 7, end: 15 },
    { name: 'Evening', start: 15, end: 23 },
    { name: 'Night', start: 23, end: 7 },
  ];
  for (const s of shifts) {
    await pool.query(
      `INSERT INTO shift_windows (unit_id, shift_name, start_hour, end_hour, handover_window_minutes) VALUES ($1, $2, $3, $4, 30) ON CONFLICT DO NOTHING`,
      [rows[0].id, s.name, s.start, s.end]
    );
  }
  return rows[0];
}

export async function updateUnit(id, data) {
  const { name, description, department, pin, is_active } = data;
  let pin_hash = undefined;
  if (pin) pin_hash = await bcrypt.hash(String(pin), 10);
  const fields = [];
  const values = [];
  let idx = 1;
  if (name !== undefined) { fields.push(`name=$${idx++}`); values.push(name); }
  if (description !== undefined) { fields.push(`description=$${idx++}`); values.push(description); }
  if (department !== undefined) { fields.push(`department=$${idx++}`); values.push(department); }
  if (pin_hash !== undefined) { fields.push(`pin_hash=$${idx++}`); values.push(pin_hash); }
  if (is_active !== undefined) { fields.push(`is_active=$${idx++}`); values.push(is_active); }
  if (!fields.length) return null;
  values.push(id);
  const { rows } = await pool.query(`UPDATE service_units SET ${fields.join(', ')} WHERE id=$${idx} RETURNING id, name, description, department, is_active`, values);
  return rows[0] || null;
}

export async function verifyPin(unitId, pin) {
  const { rows } = await pool.query('SELECT * FROM service_units WHERE id = $1 AND is_active = TRUE', [unitId]);
  if (!rows.length) return { error: 'Unit not found', status: 404 };
  const unit = rows[0];
  if (unit.pin_hash) {
    const ok = await bcrypt.compare(String(pin), unit.pin_hash);
    if (!ok) return { error: 'Incorrect unit PIN', status: 401 };
  }
  const { rows: staff } = await pool.query(
    `SELECT u.id, u.name, u.username, u.profession, u.role, sp.is_active AS has_pin, us.is_active AS is_checked_in
     FROM users u
     JOIN staff_pins sp ON sp.user_id = u.id AND sp.unit_id = $1 AND sp.is_active = TRUE
     LEFT JOIN unit_sessions us ON us.user_id = u.id AND us.unit_id = $1 AND us.is_active = TRUE
     WHERE u.department = $2 OR u.department IS NULL ORDER BY u.name`,
    [unitId, unit.department]
  );
  const shiftCtx = await getCurrentShiftContext(unitId);
  return { unit: { id: unit.id, name: unit.name, department: unit.department }, staff, shiftContext: shiftCtx };
}

export async function staffLogin(data) {
  const { unitId, staffId, pin } = data;
  const { rows: pinRows } = await pool.query('SELECT * FROM staff_pins WHERE user_id = $1 AND unit_id = $2 AND is_active = TRUE', [staffId, unitId]);
  if (!pinRows.length) return { error: 'No PIN set for this staff in this unit', status: 401 };
  const ok = await bcrypt.compare(String(pin), pinRows[0].pin_hash);
  if (!ok) return { error: 'Incorrect PIN', status: 401 };
  const { rows: userRows } = await pool.query('SELECT id, name, username, role, profession, department FROM users WHERE id = $1', [staffId]);
  if (!userRows.length) return { error: 'User not found', status: 404 };
  const shiftCtx = await getCurrentShiftContext(unitId);
  const { rows: sessionRows } = await pool.query(`INSERT INTO unit_sessions (user_id, unit_id, shift_name) VALUES ($1, $2, $3) RETURNING id`, [staffId, unitId, shiftCtx.current]);
  return { user: userRows[0], unitId, sessionId: sessionRows[0].id, shiftContext: shiftCtx };
}

export async function staffCheckout(sessionId) {
  await pool.query('UPDATE unit_sessions SET checked_out = NOW(), is_active = FALSE WHERE id = $1', [sessionId]);
  return { success: true };
}

export async function getUnitStaff(unitId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.username, u.profession, us.shift_name, us.checked_in
     FROM unit_sessions us JOIN users u ON u.id = us.user_id
     WHERE us.unit_id = $1 AND us.is_active = TRUE ORDER BY us.checked_in DESC`,
    [unitId]
  );
  return rows;
}

export async function getUnitActivity(unitId, limit = 50) {
  const { rows: unit } = await pool.query('SELECT department FROM service_units WHERE id = $1', [unitId]);
  const dept = unit[0]?.department;
  const { rows: submissions } = await pool.query(
    `SELECT fs.id, fs.template_name, fs.submitted_by_name, fs.submitted_at, fs.form_data, 'submission' AS activity_type
     FROM form_submissions fs
     WHERE ($1::text IS NULL OR LOWER(fs.template_department) = LOWER($1))
     ORDER BY fs.submitted_at DESC LIMIT $2`,
    [dept, limit]
  );
  return { submissions };
}

export async function setStaffPin(data) {
  const { userId, unitId, pin } = data;
  const pin_hash = await bcrypt.hash(String(pin), 10);
  await pool.query(
    `INSERT INTO staff_pins (user_id, unit_id, pin_hash) VALUES ($1, $2, $3) ON CONFLICT (user_id, unit_id) DO UPDATE SET pin_hash=$3, is_active=TRUE`,
    [userId, unitId, pin_hash]
  );
  return { success: true };
}

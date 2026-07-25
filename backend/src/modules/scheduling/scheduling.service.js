import pool from '../../config/database.js';

// ── Deduplicate shift_types on startup ───────────────────────────────────
export const deduplicateShiftTypes = async () => {
  try {
    await pool.query(`
      DELETE FROM shift_types a USING shift_types b
      WHERE a.name = b.name
        AND COALESCE(a.department,'') = COALESCE(b.department,'')
        AND a.id > b.id
    `);
    const { rowCount } = await pool.query('SELECT 1 FROM shift_types LIMIT 1');
    if (rowCount === 0) {
      const defaults = [
        ['Day', 'DAY', '#09b8a0', 8, 1],
        ['Night', 'NGT', '#1a1a2e', 8, 2],
        ['Evening', 'EVE', '#e67e22', 8, 3],
        ['Off', 'OFF', '#95a5a6', 0, 4],
        ['On-Call', 'ONC', '#3498db', 12, 5],
        ['Leave', 'LVE', '#e74c3c', 0, 6]
      ];
      for (const [name, abbr, color, hours, order] of defaults) {
        await pool.query(
          'INSERT INTO shift_types (name, abbreviation, color, default_hours, sort_order) VALUES ($1,$2,$3,$4,$5)',
          [name, abbr, color, hours, order]
        );
      }
      console.log('[Scheduling] Seeded 6 default shift types');
    }
  } catch {}
};

// ── Departments List ─────────────────────────────────────────────────────

export const getDepartments = async () => {
  const { rows } = await pool.query(
    `SELECT DISTINCT department FROM users WHERE department IS NOT NULL AND department != '' AND isactive = TRUE ORDER BY department`
  );
  return rows.map(r => r.department);
};

// ── Staff for Scheduling ────────────────────────────────────────────────

export const getSchedulingStaff = async ({ department, userId, userRole }) => {
  let query;
  let params;

  if (userRole === 'admin' || userRole === 'superadmin') {
    if (department) {
      query = `SELECT id, name, username, profession, department, profile_picture FROM users WHERE role = 'staff' AND isactive = TRUE AND LOWER(department) = LOWER($1) ORDER BY name`;
      params = [department];
    } else {
      query = `SELECT id, name, username, profession, department, profile_picture FROM users WHERE role = 'staff' AND isactive = TRUE ORDER BY name`;
      params = [];
    }
  } else {
    query = `SELECT id, name, username, profession, department, profile_picture FROM users
             WHERE role = 'staff' AND isactive = TRUE
               AND (parent_user_id = $1 OR LOWER(department) = LOWER($2))
             ORDER BY name`;
    params = [userId, department || ''];
  }

  const { rows } = await pool.query(query, params);
  return rows;
};

// ── Shift Types ──────────────────────────────────────────────────────────

export const getShiftTypes = async (department) => {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (name) * FROM shift_types
     WHERE is_active = TRUE
       ${department ? `AND (department IS NULL OR department = $1)` : ''}
     ORDER BY name, sort_order ASC, id ASC`,
    department ? [department] : []
  );
  return rows;
};

export const createShiftType = async (data) => {
  const { name, abbreviation, color, defaultHours, department, sortOrder } = data;
  const { rows } = await pool.query(
    `INSERT INTO shift_types (name, abbreviation, color, default_hours, department, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name, abbreviation, color || '#6b7280', defaultHours || 8, department || null, sortOrder || 0]
  );
  return rows[0];
};

export const updateShiftType = async (id, data) => {
  const { name, abbreviation, color, defaultHours, isActive, sortOrder } = data;
  const { rows } = await pool.query(
    `UPDATE shift_types SET
       name = COALESCE($1, name), abbreviation = COALESCE($2, abbreviation),
       color = COALESCE($3, color), default_hours = COALESCE($4, default_hours),
       is_active = COALESCE($5, is_active), sort_order = COALESCE($6, sort_order),
       updated_at = NOW()
     WHERE id = $7 RETURNING *`,
    [name, abbreviation, color, defaultHours, isActive, sortOrder, id]
  );
  return rows[0] || null;
};

export const deleteShiftType = async (id) => {
  const { rowCount } = await pool.query(
    'UPDATE shift_types SET is_active = FALSE, updated_at = NOW() WHERE id = $1', [id]
  );
  return rowCount > 0;
};

// ── Schedule CRUD ────────────────────────────────────────────────────────

export const getSchedules = async ({ department, startDate, endDate, staffUserId, shiftTypeId }) => {
  const conditions = ['s.department = $1', 's.schedule_date >= $2', 's.schedule_date <= $3'];
  const params = [department, startDate, endDate];
  let idx = 4;

  if (staffUserId) {
    conditions.push(`s.staff_user_id = $${idx++}`);
    params.push(staffUserId);
  }
  if (shiftTypeId) {
    conditions.push(`s.shift_type_id = $${idx++}`);
    params.push(shiftTypeId);
  }

  const { rows } = await pool.query(
    `SELECT s.id, s.staff_user_id, s.shift_type_id,
            TO_CHAR(s.schedule_date, 'YYYY-MM-DD') AS schedule_date,
            s.department, s.notes, s.created_by,
            s.created_at, s.updated_at,
            st.name AS shift_name, st.abbreviation AS shift_abbr, st.color AS shift_color,
            u.name AS staff_name, u.profession AS staff_role, u.profile_picture
     FROM schedules s
     JOIN shift_types st ON st.id = s.shift_type_id
     JOIN users u ON u.id = s.staff_user_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY s.schedule_date ASC, u.name ASC`,
    params
  );
  return rows;
};

export const createSchedule = async (data) => {
  const { staffUserId, shiftTypeId, scheduleDate, department, notes, createdBy } = data;
  const { rows } = await pool.query(
    `INSERT INTO schedules (staff_user_id, shift_type_id, schedule_date, department, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (staff_user_id, schedule_date, department)
     DO UPDATE SET shift_type_id = $2, notes = $5, updated_at = NOW(), created_by = $6
     RETURNING *`,
    [staffUserId, shiftTypeId, scheduleDate, department, notes || null, createdBy]
  );
  return rows[0];
};

export const bulkCreateSchedules = async (assignments) => {
  const results = [];
  for (const a of assignments) {
    const row = await createSchedule(a);
    results.push(row);
  }
  return results;
};

export const updateSchedule = async (id, data) => {
  const { shiftTypeId, notes } = data;
  const { rows } = await pool.query(
    `UPDATE schedules SET shift_type_id = COALESCE($1, shift_type_id),
       notes = COALESCE($2, notes), updated_at = NOW()
     WHERE id = $3 RETURNING *`,
    [shiftTypeId, notes, id]
  );
  return rows[0] || null;
};

export const deleteSchedule = async (id) => {
  const { rows, rowCount } = await pool.query(
    'DELETE FROM schedules WHERE id = $1 RETURNING *', [id]
  );
  return rowCount > 0 ? rows[0] : null;
};

// ── Conflict Detection ───────────────────────────────────────────────────

export const detectConflicts = async ({ staffUserId, shiftTypeId, scheduleDate, department }) => {
  const conflicts = [];

  // 1. Check double-booking: same staff, same date, different shift
  const { rows: existing } = await pool.query(
    `SELECT s.*, st.name AS shift_name
     FROM schedules s JOIN shift_types st ON st.id = s.shift_type_id
     WHERE s.staff_user_id = $1 AND s.schedule_date = $2 AND s.department = $3`,
    [staffUserId, scheduleDate, department]
  );
  if (existing.length > 0) {
    conflicts.push({
      type: 'double_booking',
      message: `${existing[0].shift_name} shift already assigned on this date`,
      existing: existing[0]
    });
  }

  // 2. Check unavailability
  const { rows: unavail } = await pool.query(
    `SELECT * FROM staff_unavailability
     WHERE user_id = $1 AND date_from <= $2 AND date_to >= $2 AND is_approved = TRUE`,
    [staffUserId, scheduleDate]
  );
  if (unavail.length > 0) {
    conflicts.push({
      type: 'unavailable',
      message: `Staff member is marked unavailable (${unavail[0].reason || 'unspecified'})`,
      unavailability: unavail[0]
    });
  }

  // 3. Check minimum staffing (if shift type is Off or Leave, skip)
  if (shiftTypeId) {
    const { rows: stRow } = await pool.query('SELECT name FROM shift_types WHERE id = $1', [shiftTypeId]);
    const shiftName = stRow[0]?.name;
    if (shiftName !== 'Off' && shiftName !== 'Leave') {
      const [sy, sm, sd] = scheduleDate.split('-').map(Number);
      const dow = new Date(sy, sm - 1, sd).getDay();
      const { rows: minRows } = await pool.query(
        `SELECT ms.min_staff_count, st.name AS shift_name
         FROM minimum_staffing ms
         JOIN shift_types st ON st.id = ms.shift_type_id
         WHERE ms.shift_type_id = $1 AND ms.department = $2
           AND (ms.day_of_week = $3 OR ms.day_of_week IS NULL)
         LIMIT 1`,
        [shiftTypeId, department, dow]
      );
      if (minRows.length > 0) {
        const { rows: currentCount } = await pool.query(
          `SELECT COUNT(*)::int AS cnt FROM schedules
           WHERE shift_type_id = $1 AND schedule_date = $2 AND department = $3
             AND staff_user_id NOT IN (
               SELECT user_id FROM staff_unavailability
               WHERE user_id = staff_user_id AND date_from <= $2 AND date_to >= $2 AND is_approved = TRUE
             )`,
          [shiftTypeId, scheduleDate, department]
        );
        const count = currentCount[0]?.cnt || 0;
        const min = minRows[0].min_staff_count;
        if (count + 1 < min) {
          conflicts.push({
            type: 'understaffed',
            message: `Minimum staffing for ${minRows[0].shift_name} is ${min}, currently ${count}`,
            currentCount: count,
            minRequired: min
          });
        }
      }
    }
  }

  return conflicts;
};

// ── Change Log ───────────────────────────────────────────────────────────

export const logScheduleChange = async (data) => {
  const { scheduleId, staffUserId, shiftTypeId, scheduleDate, department, action, oldShiftTypeId, changedBy } = data;
  const { rows } = await pool.query(
    `INSERT INTO schedule_change_log
       (schedule_id, staff_user_id, shift_type_id, schedule_date, department, action, old_shift_type_id, changed_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [scheduleId, staffUserId, shiftTypeId, scheduleDate, department, action, oldShiftTypeId || null, changedBy]
  );
  return rows[0];
};

export const getChangeLog = async ({ department, startDate, endDate, staffUserId }) => {
  const conditions = ['scl.department = $1', 'scl.schedule_date >= $2', 'scl.schedule_date <= $3'];
  const params = [department, startDate, endDate];
  let idx = 4;

  if (staffUserId) {
    conditions.push(`scl.staff_user_id = $${idx++}`);
    params.push(staffUserId);
  }

  const { rows } = await pool.query(
    `SELECT scl.id, scl.schedule_id, scl.staff_user_id, scl.shift_type_id,
            TO_CHAR(scl.schedule_date, 'YYYY-MM-DD') AS schedule_date,
            scl.department, scl.action, scl.old_shift_type_id,
            scl.changed_by, scl.changed_at,
            u.name AS staff_name,
            cb.name AS changed_by_name,
            st_new.name AS new_shift_name, st_new.abbreviation AS new_shift_abbr, st_new.color AS new_shift_color,
            st_old.name AS old_shift_name, st_old.abbreviation AS old_shift_abbr, st_old.color AS old_shift_color
     FROM schedule_change_log scl
     LEFT JOIN users u ON u.id = scl.staff_user_id
     LEFT JOIN users cb ON cb.id = scl.changed_by
     LEFT JOIN shift_types st_new ON st_new.id = scl.shift_type_id
     LEFT JOIN shift_types st_old ON st_old.id = scl.old_shift_type_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY scl.changed_at DESC`,
    params
  );
  return rows;
};

// ── Minimum Staffing ─────────────────────────────────────────────────────

export const getMinimumStaffing = async (department) => {
  const { rows } = await pool.query(
    `SELECT ms.*, st.name AS shift_name, st.abbreviation AS shift_abbr, st.color AS shift_color
     FROM minimum_staffing ms
     JOIN shift_types st ON st.id = ms.shift_type_id
     WHERE ms.department = $1
     ORDER BY ms.shift_type_id, ms.day_of_week`,
    [department]
  );
  return rows;
};

export const setMinimumStaffing = async (data) => {
  const { shiftTypeId, department, minStaffCount, dayOfWeek, isHoliday } = data;
  const { rows } = await pool.query(
    `INSERT INTO minimum_staffing (shift_type_id, department, min_staff_count, day_of_week, is_holiday)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (shift_type_id, department, day_of_week, is_holiday)
     DO UPDATE SET min_staff_count = $3, updated_at = NOW()
     RETURNING *`,
    [shiftTypeId, department, minStaffCount, dayOfWeek || null, isHoliday || false]
  );
  return rows[0];
};

// ── Staff Unavailability ─────────────────────────────────────────────────

export const getUnavailability = async ({ department, startDate, endDate, userId }) => {
  let query = `
    SELECT su.*, u.name AS user_name, u.profession AS staff_role
    FROM staff_unavailability su
    JOIN users u ON u.id = su.user_id
    WHERE su.date_from <= $2 AND su.date_to >= $1`;
  const params = [startDate, endDate];
  let idx = 3;

  if (userId) {
    query += ` AND su.user_id = $${idx++}`;
    params.push(userId);
  }
  if (department) {
    query += ` AND u.department = $${idx++}`;
    params.push(department);
  }
  query += ' ORDER BY su.date_from ASC';

  const { rows } = await pool.query(query, params);
  return rows;
};

export const createUnavailability = async (data) => {
  const { userId, dateFrom, dateTo, reason, createdBy } = data;
  const { rows } = await pool.query(
    `INSERT INTO staff_unavailability (user_id, date_from, date_to, reason, is_approved, approved_by)
     VALUES ($1, $2, $3, $4, FALSE, $5) RETURNING *`,
    [userId, dateFrom, dateTo, reason || null, createdBy]
  );
  return rows[0];
};

export const approveUnavailability = async (id, approvedBy) => {
  const { rows } = await pool.query(
    `UPDATE staff_unavailability SET is_approved = TRUE, approved_by = $2
     WHERE id = $1 RETURNING *`,
    [id, approvedBy]
  );
  return rows[0] || null;
};

// ── Holidays (Bahire Hasab - computed server-side for grid rendering) ────

export const getEthiopianHolidays = async (startDate, endDate) => {
  // Bahire Hasab calculation for Ethiopian holidays
  // This returns a list of holidays in the given Gregorian date range
  const holidays = [];
  const parseLocalDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);

  // Iterate through each year in the range (possibly spanning two Ethiopian years)
  const ethStartYear = gregorianToEthiopianYear(start);
  const ethEndYear = gregorianToEthiopianYear(end);

  for (let ey = ethStartYear; ey <= ethEndYear; ey++) {
    const fixedHolidays = getFixedHolidays(ey);
    const movableHolidays = getMovableHolidays(ey);
    const allHolidays = [...fixedHolidays, ...movableHolidays];

    for (const h of allHolidays) {
      const gregDate = ethiopianToGregorianDate(ey, h.month, h.day);
      if (gregDate >= start && gregDate <= end) {
        const gy = gregDate.getFullYear();
        const gm = String(gregDate.getMonth() + 1).padStart(2, '0');
        const gd = String(gregDate.getDate()).padStart(2, '0');
        holidays.push({
          date: `${gy}-${gm}-${gd}`,
          name: h.name,
          nameAmharic: h.nameAmharic,
          type: h.type
        });
      }
    }
  }
  return holidays;
};

// ── Ethiopian calendar helpers (Bahire Hasab) ────────────────────────────

function gregorianToEthiopianYear(date) {
  const gYear = date.getFullYear();
  const gMonth = date.getMonth() + 1;
  const gDay = date.getDate();
  // Ethiopian new year is ~Sep 11 (or 12 in leap year)
  const ethNewYear = isEthiopianLeapYear(gYear - 1) ? 12 : 11;
  if (gMonth > 9 || (gMonth === 9 && gDay >= ethNewYear)) {
    return gYear - 7;
  }
  return gYear - 8;
}

function isEthiopianLeapYear(ethYear) {
  return ethYear % 4 === 3;
}

function ethiopianToGregorianDate(ethYear, ethMonth, ethDay) {
  // Calculate JDN for Ethiopian date, then convert to Gregorian
  const ethNewYearGreg = getEthiopianNewYearGregorian(ethYear);
  const daysSinceNewYear = (ethMonth - 1) * 30 + (ethDay - 1);
  const result = new Date(ethNewYearGreg);
  result.setDate(result.getDate() + daysSinceNewYear);
  return result;
}

function getEthiopianNewYearGregorian(ethYear) {
  // Ethiopian new year: Sep 11 or Sep 12 in Gregorian
  const gregYear = ethYear + 7;
  // Sep 11 in Gregorian (or Sep 12 if Ethiopian year before this was leap)
  const isLeap = isEthiopianLeapYear(ethYear - 1);
  return new Date(gregYear, 8, isLeap ? 12 : 11); // Month is 0-indexed
}

function getFixedHolidays(ethYear) {
  return [
    { month: 1, day: 1, name: 'Enkutatash', nameAmharic: 'እንቁጣጣሽ', type: 'public' },
    { month: 1, day: 2, name: 'Enkutatash Holiday', nameAmharic: 'እንቁጣጣሽ በዓል', type: 'public' },
    { month: 2, day: 10, name: 'Meskel', nameAmharic: 'መስቀል', type: 'religious' },
    { month: 2, day: 11, name: 'Meskel Holiday', nameAmharic: 'መስቀል በዓል', type: 'public' },
    { month: 4, day: 1, name: 'Ethiopian Christmas', nameAmharic: 'ገና', type: 'religious' },
    { month: 4, day: 2, name: 'Ethiopian Christmas Holiday', nameAmharic: 'ገና በዓል', type: 'public' },
    { month: 5, day: 19, name: 'Timkat', nameAmharic: 'ጥምቀት', type: 'religious' },
    { month: 5, day: 20, name: 'Timkat Holiday', nameAmharic: 'ጥምቀት በዓል', type: 'public' },
    { month: 9, day: 1, name: 'Ethiopian New Year', nameAmharic: 'አዲስ ዓመት', type: 'public' },
    { month: 9, day: 17, name: 'Finding of True Cross', nameAmharic: 'መስቀል ማግኘት', type: 'religious' },
    { month: 10, day: 27, name: 'St. George Day', nameAmharic: 'ጎርጎር', type: 'religious' },
  ];
}

function getMovableHolidays(ethYear) {
  // Fasika (Easter) - calculated via Bahire Hasab
  const easterEth = calculateFasika(ethYear);
  const holidays = [
    { month: easterEth.month, day: easterEth.day - 55, name: 'Ash Wednesday', nameAmharic: 'አርብ ቀን', type: 'religious' },
    { month: easterEth.month, day: easterEth.day - 7, name: 'Palm Sunday', nameAmharic: 'እሁድ ቅዱስ', type: 'religious' },
    { month: easterEth.month, day: easterEth.day - 2, name: 'Good Friday', nameAmharic: 'ቅዱስ ዓርብ', type: 'religious' },
    { month: easterEth.month, day: easterEth.day - 1, name: 'Holy Saturday', nameAmharic: 'ቅዱስ ቅዳሜ', type: 'religious' },
    { month: easterEth.month, day: easterEth.day, name: 'Fasika (Easter)', nameAmharic: 'ፋሲካ', type: 'religious' },
    { month: easterEth.month, day: easterEth.day + 1, name: 'Fasika Holiday', nameAmharic: 'ፋሲካ በዓል', type: 'public' },
  ];
  // Filter out invalid dates (e.g., negative day values)
  return holidays.filter(h => h.day > 0 && h.day <= 30);
}

function calculateFasika(ethYear) {
  // Bahire Hasab algorithm for computing Fasika (Ethiopian Easter)
  // This is the actual algorithm used in the Ethiopian Orthodox calendar
  const x = ethYear % 4;
  const y = ethYear % 7;
  const a = (19 * ethYear + 16) % 30;
  const b = (2 * x + 4 * y + 6 * a + 6) % 7;
  const day = 22 + a + b;

  if (day > 30) {
    return { month: 7, day: day - 30 }; // Sene
  }
  return { month: 6, day: day }; // Miyazia
}

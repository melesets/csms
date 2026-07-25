import * as schedulingService from './scheduling.service.js';

// ── Departments ────────────────────────────────────────────────────────

export const getDepartments = async (req, res) => {
  const departments = await schedulingService.getDepartments();
  res.json(departments);
};

// ── Staff for Scheduling ────────────────────────────────────────────────

export const getSchedulingStaff = async (req, res) => {
  const { department } = req.query;
  const staff = await schedulingService.getSchedulingStaff({
    department,
    userId: req.user.id,
    userRole: req.user.role
  });
  res.json(staff);
};

// ── Shift Types ──────────────────────────────────────────────────────────

export const getShiftTypes = async (req, res) => {
  const { department } = req.query;
  const types = await schedulingService.getShiftTypes(department);
  res.json(types);
};

export const createShiftType = async (req, res) => {
  const { name, abbreviation, color, defaultHours, department, sortOrder } = req.body;
  if (!name || !abbreviation) {
    return res.status(400).json({ error: 'Name and abbreviation are required' });
  }
  const type = await schedulingService.createShiftType({
    name, abbreviation, color, defaultHours, department, sortOrder
  });
  res.status(201).json(type);
};

export const updateShiftType = async (req, res) => {
  const { id } = req.params;
  const type = await schedulingService.updateShiftType(parseInt(id), req.body);
  if (!type) return res.status(404).json({ error: 'Shift type not found' });
  res.json(type);
};

export const deleteShiftType = async (req, res) => {
  const { id } = req.params;
  const ok = await schedulingService.deleteShiftType(parseInt(id));
  if (!ok) return res.status(404).json({ error: 'Shift type not found' });
  res.json({ success: true });
};

// ── Schedules ────────────────────────────────────────────────────────────

export const getSchedules = async (req, res) => {
  const { department, startDate, endDate, staffUserId, shiftTypeId } = req.query;
  if (!department || !startDate || !endDate) {
    return res.status(400).json({ error: 'department, startDate, and endDate are required' });
  }
  const schedules = await schedulingService.getSchedules({
    department, startDate, endDate,
    staffUserId: staffUserId ? parseInt(staffUserId) : undefined,
    shiftTypeId: shiftTypeId ? parseInt(shiftTypeId) : undefined
  });
  res.json(schedules);
};

export const createSchedule = async (req, res) => {
  const { staffUserId, shiftTypeId, scheduleDate, department, notes } = req.body;
  if (!staffUserId || !shiftTypeId || !scheduleDate || !department) {
    return res.status(400).json({ error: 'staffUserId, shiftTypeId, scheduleDate, and department are required' });
  }
  const conflicts = await schedulingService.detectConflicts({
    staffUserId, shiftTypeId, scheduleDate, department
  });
  // Always save the schedule — conflicts are returned as warnings, not blockers
  const schedule = await schedulingService.createSchedule({
    staffUserId, shiftTypeId, scheduleDate, department, notes, createdBy: req.user.id
  });
  await schedulingService.logScheduleChange({
    scheduleId: schedule.id, staffUserId, shiftTypeId, scheduleDate, department,
    action: 'create', oldShiftTypeId: null, changedBy: req.user.id
  });
  res.status(201).json({ schedule, conflicts });
};

export const bulkCreateSchedules = async (req, res) => {
  const { assignments } = req.body;
  if (!Array.isArray(assignments) || assignments.length === 0) {
    return res.status(400).json({ error: 'assignments array is required' });
  }
  const allConflicts = [];
  const results = [];
  for (const a of assignments) {
    const conflicts = await schedulingService.detectConflicts({
      staffUserId: a.staffUserId, shiftTypeId: a.shiftTypeId,
      scheduleDate: a.scheduleDate, department: a.department
    });
    if (conflicts.length > 0) {
      allConflicts.push({ ...a, conflicts });
    }
    const schedule = await schedulingService.createSchedule({ ...a, createdBy: req.user.id });
    results.push(schedule);
    await schedulingService.logScheduleChange({
      scheduleId: schedule.id, staffUserId: a.staffUserId, shiftTypeId: a.shiftTypeId,
      scheduleDate: a.scheduleDate, department: a.department,
      action: 'create', changedBy: req.user.id
    });
  }
  res.status(201).json({ created: results.length, conflicts: allConflicts });
};

export const updateSchedule = async (req, res) => {
  const { id } = req.params;
  const { shiftTypeId, notes } = req.body;
  const existing = await schedulingService.getSchedules({
    department: req.query.department,
    startDate: req.query.scheduleDate,
    endDate: req.query.scheduleDate,
    staffUserId: req.query.staffUserId
  });
  const oldSchedule = existing.find(s => s.id === parseInt(id));
  const schedule = await schedulingService.updateSchedule(parseInt(id), { shiftTypeId, notes });
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
  await schedulingService.logScheduleChange({
    scheduleId: schedule.id, staffUserId: schedule.staff_user_id, shiftTypeId,
    scheduleDate: schedule.schedule_date, department: schedule.department,
    action: 'update', oldShiftTypeId: oldSchedule?.shift_type_id || null, changedBy: req.user.id
  });
  res.json(schedule);
};

export const deleteSchedule = async (req, res) => {
  const { id } = req.params;
  const deleted = await schedulingService.deleteSchedule(parseInt(id));
  if (!deleted) return res.status(404).json({ error: 'Schedule not found' });
  await schedulingService.logScheduleChange({
    scheduleId: deleted.id, staffUserId: deleted.staff_user_id,
    shiftTypeId: deleted.shift_type_id, scheduleDate: deleted.schedule_date,
    department: deleted.department, action: 'delete',
    oldShiftTypeId: deleted.shift_type_id, changedBy: req.user.id
  });
  res.json({ success: true });
};

// ── Conflicts ────────────────────────────────────────────────────────────

export const getConflicts = async (req, res) => {
  const { staffUserId, shiftTypeId, scheduleDate, department } = req.query;
  if (!staffUserId || !scheduleDate || !department) {
    return res.status(400).json({ error: 'staffUserId, scheduleDate, and department are required' });
  }
  const conflicts = await schedulingService.detectConflicts({
    staffUserId: parseInt(staffUserId),
    shiftTypeId: shiftTypeId ? parseInt(shiftTypeId) : undefined,
    scheduleDate, department
  });
  res.json(conflicts);
};

// ── Minimum Staffing ─────────────────────────────────────────────────────

export const getMinimumStaffing = async (req, res) => {
  const { department } = req.query;
  if (!department) return res.status(400).json({ error: 'department is required' });
  const rules = await schedulingService.getMinimumStaffing(department);
  res.json(rules);
};

export const setMinimumStaffing = async (req, res) => {
  const { shiftTypeId, department, minStaffCount, dayOfWeek, isHoliday } = req.body;
  if (!shiftTypeId || !department || minStaffCount === undefined) {
    return res.status(400).json({ error: 'shiftTypeId, department, and minStaffCount are required' });
  }
  const rule = await schedulingService.setMinimumStaffing({
    shiftTypeId, department, minStaffCount, dayOfWeek, isHoliday
  });
  res.json(rule);
};

// ── Staff Unavailability ─────────────────────────────────────────────────

export const getUnavailability = async (req, res) => {
  const { department, startDate, endDate, userId } = req.query;
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate are required' });
  }
  const items = await schedulingService.getUnavailability({
    department, startDate, endDate, userId: userId ? parseInt(userId) : undefined
  });
  res.json(items);
};

export const createUnavailability = async (req, res) => {
  const { userId, dateFrom, dateTo, reason } = req.body;
  if (!userId || !dateFrom || !dateTo) {
    return res.status(400).json({ error: 'userId, dateFrom, and dateTo are required' });
  }
  const item = await schedulingService.createUnavailability({
    userId, dateFrom, dateTo, reason, createdBy: req.user.id
  });
  res.status(201).json(item);
};

export const approveUnavailability = async (req, res) => {
  const { id } = req.params;
  const item = await schedulingService.approveUnavailability(parseInt(id), req.user.id);
  if (!item) return res.status(404).json({ error: 'Unavailability record not found' });
  res.json(item);
};

// ── Change Log ───────────────────────────────────────────────────────────

export const getChangeLog = async (req, res) => {
  const { department, startDate, endDate, staffUserId } = req.query;
  if (!department || !startDate || !endDate) {
    return res.status(400).json({ error: 'department, startDate, and endDate are required' });
  }
  const log = await schedulingService.getChangeLog({
    department, startDate, endDate, staffUserId: staffUserId ? parseInt(staffUserId) : undefined
  });
  res.json(log);
};

// ── Holidays ─────────────────────────────────────────────────────────────

export const getHolidays = async (req, res) => {
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate are required' });
  }
  const holidays = await schedulingService.getEthiopianHolidays(startDate, endDate);
  res.json(holidays);
};

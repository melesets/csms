// Unit auth controller - handles unit CRUD, PIN auth, and shift context
import { asyncHandler } from '../../middleware/errorHandler.js';
import * as unitAuthService from './unitAuth.service.js';

export const listUnits = asyncHandler(async (req, res) => {
  const units = await unitAuthService.listUnits();
  res.json(units);
});

export const createUnit = asyncHandler(async (req, res) => {
  if (!req.body.name) return res.status(400).json({ error: 'name required' });
  const unit = await unitAuthService.createUnit(req.body);
  res.json(unit);
});

export const updateUnit = asyncHandler(async (req, res) => {
  const unit = await unitAuthService.updateUnit(req.params.id, req.body);
  if (!unit) return res.status(400).json({ error: 'nothing to update' });
  res.json(unit);
});

export const verifyPin = asyncHandler(async (req, res) => {
  const { unitId, pin } = req.body;
  if (!unitId || !pin) return res.status(400).json({ error: 'unitId and pin required' });
  const result = await unitAuthService.verifyPin(unitId, pin);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(result);
});

export const staffLogin = asyncHandler(async (req, res) => {
  const { unitId, staffId, pin } = req.body;
  if (!unitId || !staffId || !pin) return res.status(400).json({ error: 'unitId, staffId, pin required' });
  const result = await unitAuthService.staffLogin(req.body);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(result);
});

export const staffCheckout = asyncHandler(async (req, res) => {
  const result = await unitAuthService.staffCheckout(req.body.sessionId);
  res.json(result);
});

export const getUnitStaff = asyncHandler(async (req, res) => {
  const staff = await unitAuthService.getUnitStaff(req.params.id);
  res.json(staff);
});

export const getUnitActivity = asyncHandler(async (req, res) => {
  const activity = await unitAuthService.getUnitActivity(req.params.id, parseInt(req.query.limit) || 50);
  res.json(activity);
});

export const getShiftContext = asyncHandler(async (req, res) => {
  const ctx = await unitAuthService.getCurrentShiftContext(req.params.id);
  res.json(ctx);
});

export const getShiftWindows = asyncHandler(async (req, res) => {
  const pool = (await import('../../config/database.js')).default;
  const { rows } = await pool.query('SELECT * FROM shift_windows WHERE unit_id = $1 ORDER BY start_hour', [req.params.id]);
  res.json(rows);
});

export const updateShiftWindows = asyncHandler(async (req, res) => {
  const pool = (await import('../../config/database.js')).default;
  const { windows } = req.body;
  for (const w of windows) {
    await pool.query(
      `INSERT INTO shift_windows (unit_id, shift_name, start_hour, end_hour, handover_window_minutes)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (unit_id, shift_name) DO UPDATE SET start_hour=$3, end_hour=$4, handover_window_minutes=$5`,
      [req.params.id, w.shift_name, w.start_hour, w.end_hour, w.handover_window_minutes ?? 30]
    );
  }
  res.json({ success: true });
});

export const setStaffPin = asyncHandler(async (req, res) => {
  const { userId, unitId, pin } = req.body;
  if (!userId || !unitId || !pin) return res.status(400).json({ error: 'userId, unitId, pin required' });
  if (String(pin).length !== 4 || !/^\d{4}$/.test(String(pin))) {
    return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
  }
  const result = await unitAuthService.setStaffPin(req.body);
  res.json(result);
});

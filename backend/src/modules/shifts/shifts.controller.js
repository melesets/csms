// Shifts controller - handles shift context, check-in/out, and handover requests
import { asyncHandler } from '../../middleware/errorHandler.js';
import * as shiftsService from './shifts.service.js';

export const getShiftContext = asyncHandler(async (req, res) => {
  const context = await shiftsService.getShiftContext(req.query.department);
  res.json(context);
});

export const checkIn = asyncHandler(async (req, res) => {
  const { userId, ward } = req.body;
  if (!userId || !ward) return res.status(400).json({ error: 'Missing userId or ward' });
  const result = await shiftsService.checkIn(req.body);
  res.json(result);
});

export const checkOut = asyncHandler(async (req, res) => {
  const result = await shiftsService.checkOut(req.body);
  res.json(result);
});

export const submitHandover = asyncHandler(async (req, res) => {
  const result = await shiftsService.submitHandover(req.body);
  res.json(result);
});

export const getLatestHandover = asyncHandler(async (req, res) => {
  const { ward, profession } = req.params;
  const { mrn } = req.query;
  const handover = await shiftsService.getLatestHandover(ward, profession, mrn);
  res.json(handover);
});

export const getActiveStaff = asyncHandler(async (req, res) => {
  const staff = await shiftsService.getActiveStaff(req.params.department);
  res.json(staff);
});

export const staffAction = asyncHandler(async (req, res) => {
  const { userId, action, ward } = req.body;
  if (!userId || !action || !ward) return res.status(400).json({ error: 'Missing required fields' });
  const result = await shiftsService.staffAction(req.body);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(result);
});

export const getCheckInLogs = asyncHandler(async (req, res) => {
  const { startDate, endDate, department, staffId, page, limit } = req.query;
  const isNonAdmin = req.user.role !== 'admin' && req.user.role !== 'superadmin';
  const result = await shiftsService.getCheckInLogs({
    startDate, endDate, department, staffId,
    page: parseInt(page) || 1, limit: parseInt(limit) || 50,
    parentUserId: isNonAdmin ? req.user.id : undefined
  });
  res.json(result);
});

export const getAttendanceReport = asyncHandler(async (req, res) => {
  const { startDate, endDate, department } = req.query;
  const isNonAdmin = req.user.role !== 'admin' && req.user.role !== 'superadmin';
  const result = await shiftsService.getAttendanceReport({
    startDate, endDate, department,
    parentUserId: isNonAdmin ? req.user.id : undefined
  });
  res.json(result);
});

export const triggerAutoCheckout = asyncHandler(async (req, res) => {
  const result = await shiftsService.autoCheckoutExpiredSessions();
  res.json({ message: `Auto-checkout complete: ${result.checkedOut} session(s) ended`, ...result });
});

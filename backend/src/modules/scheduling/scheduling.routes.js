import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import * as schedulingController from './scheduling.controller.js';

const router = Router();

// ── Departments ────────────────────────────────────────────────────────
router.get('/departments', asyncHandler(schedulingController.getDepartments));

// ── Staff for Scheduling ───────────────────────────────────────────────
router.get('/staff', asyncHandler(schedulingController.getSchedulingStaff));

// ── Shift Types ───────────────────────────────────────────────────────
router.get('/shift-types', asyncHandler(schedulingController.getShiftTypes));
router.post('/shift-types', requireRole('admin', 'superadmin'), asyncHandler(schedulingController.createShiftType));
router.put('/shift-types/:id', requireRole('admin', 'superadmin'), asyncHandler(schedulingController.updateShiftType));
router.delete('/shift-types/:id', requireRole('admin', 'superadmin'), asyncHandler(schedulingController.deleteShiftType));

// ── Schedules ─────────────────────────────────────────────────────────
router.get('/schedules', asyncHandler(schedulingController.getSchedules));
router.post('/schedules', requireRole('admin', 'superadmin', 'user'), asyncHandler(schedulingController.createSchedule));
router.post('/schedules/bulk', requireRole('admin', 'superadmin', 'user'), asyncHandler(schedulingController.bulkCreateSchedules));
router.put('/schedules/:id', requireRole('admin', 'superadmin', 'user'), asyncHandler(schedulingController.updateSchedule));
router.delete('/schedules/:id', requireRole('admin', 'superadmin', 'user'), asyncHandler(schedulingController.deleteSchedule));

// ── Conflicts ─────────────────────────────────────────────────────────
router.get('/conflicts', asyncHandler(schedulingController.getConflicts));

// ── Minimum Staffing ──────────────────────────────────────────────────
router.get('/minimum-staffing', asyncHandler(schedulingController.getMinimumStaffing));
router.post('/minimum-staffing', requireRole('admin', 'superadmin'), asyncHandler(schedulingController.setMinimumStaffing));

// ── Staff Unavailability ──────────────────────────────────────────────
router.get('/unavailability', asyncHandler(schedulingController.getUnavailability));
router.post('/unavailability', asyncHandler(schedulingController.createUnavailability));
router.put('/unavailability/:id/approve', requireRole('admin', 'superadmin'), asyncHandler(schedulingController.approveUnavailability));

// ── Change Log ────────────────────────────────────────────────────────
router.get('/change-log', asyncHandler(schedulingController.getChangeLog));

// ── Holidays ──────────────────────────────────────────────────────────
router.get('/holidays', asyncHandler(schedulingController.getHolidays));

export default router;
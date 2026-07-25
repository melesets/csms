import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import * as schedulingController from './scheduling.controller.js';

const router = Router();

// ── Departments ────────────────────────────────────────────────────────
router.get('/departments', schedulingController.getDepartments);

// ── Staff for Scheduling ────────────────────────────────────────────────
router.get('/staff', schedulingController.getSchedulingStaff);

// ── Shift Types ──────────────────────────────────────────────────────────
router.get('/shift-types', schedulingController.getShiftTypes);
router.post('/shift-types', requireRole('admin', 'superadmin'), schedulingController.createShiftType);
router.put('/shift-types/:id', requireRole('admin', 'superadmin'), schedulingController.updateShiftType);
router.delete('/shift-types/:id', requireRole('admin', 'superadmin'), schedulingController.deleteShiftType);

// ── Schedules ────────────────────────────────────────────────────────────
router.get('/schedules', schedulingController.getSchedules);
router.post('/schedules', requireRole('admin', 'superadmin', 'user'), schedulingController.createSchedule);
router.post('/schedules/bulk', requireRole('admin', 'superadmin', 'user'), schedulingController.bulkCreateSchedules);
router.put('/schedules/:id', requireRole('admin', 'superadmin', 'user'), schedulingController.updateSchedule);
router.delete('/schedules/:id', requireRole('admin', 'superadmin', 'user'), schedulingController.deleteSchedule);

// ── Conflicts ────────────────────────────────────────────────────────────
router.get('/conflicts', schedulingController.getConflicts);

// ── Minimum Staffing ─────────────────────────────────────────────────────
router.get('/minimum-staffing', schedulingController.getMinimumStaffing);
router.post('/minimum-staffing', requireRole('admin', 'superadmin'), schedulingController.setMinimumStaffing);

// ── Staff Unavailability ─────────────────────────────────────────────────
router.get('/unavailability', schedulingController.getUnavailability);
router.post('/unavailability', schedulingController.createUnavailability);
router.put('/unavailability/:id/approve', requireRole('admin', 'superadmin'), schedulingController.approveUnavailability);

// ── Change Log ───────────────────────────────────────────────────────────
router.get('/change-log', schedulingController.getChangeLog);

// ── Holidays ─────────────────────────────────────────────────────────────
router.get('/holidays', schedulingController.getHolidays);

export default router;

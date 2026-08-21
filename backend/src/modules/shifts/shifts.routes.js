// Shift routes - /shifts context, check-in, check-out, handover, staff-action
import { Router } from 'express';
import * as shiftsController from './shifts.controller.js';

const router = Router();

router.get('/context', shiftsController.getShiftContext);
router.post('/check-in', shiftsController.checkIn);
router.post('/check-out', shiftsController.checkOut);
router.post('/handover', shiftsController.submitHandover);
router.get('/handover/:ward/:profession', shiftsController.getLatestHandover);
router.get('/active-staff/:department?', shiftsController.getActiveStaff);
router.get('/check-in-logs', shiftsController.getCheckInLogs);
router.get('/attendance-report', shiftsController.getAttendanceReport);
router.post('/staff-action', shiftsController.staffAction);
router.post('/auto-checkout', shiftsController.triggerAutoCheckout);
router.get('/biometric-lookup', shiftsController.biometricLookup);
router.get('/biometric-last-event/:staffId', shiftsController.biometricLastEvent);
router.get('/biometric-kiosk-url', shiftsController.biometricKioskUrl);

export default router;

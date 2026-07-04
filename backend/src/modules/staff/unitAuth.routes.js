// Unit auth routes - /units CRUD, verify-pin, staff-login, shift-windows
import { Router } from 'express';
import * as unitAuthController from './unitAuth.controller.js';

const router = Router();

router.get('/', unitAuthController.listUnits);
router.post('/', unitAuthController.createUnit);
router.put('/:id', unitAuthController.updateUnit);
router.post('/verify-pin', unitAuthController.verifyPin);
router.post('/staff-login', unitAuthController.staffLogin);
router.post('/staff-checkout', unitAuthController.staffCheckout);
router.get('/:id/staff', unitAuthController.getUnitStaff);
router.get('/:id/activity', unitAuthController.getUnitActivity);
router.get('/:id/shift-context', unitAuthController.getShiftContext);
router.get('/:id/shift-windows', unitAuthController.getShiftWindows);
router.put('/:id/shift-windows', unitAuthController.updateShiftWindows);
router.post('/set-staff-pin', unitAuthController.setStaffPin);

export default router;

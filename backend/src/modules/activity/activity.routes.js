// Activity routes - /activity/user/:username, /activity/department/:department, /activity/admin
import { Router } from 'express';
import * as activityController from './activity.controller.js';
import { requireRoleLevel } from '../../middleware/auth.js';

const router = Router();

router.get('/user/:username', activityController.getUserActivity);
router.get('/department/:department', activityController.getDepartmentActivity);
router.get('/admin', activityController.getAdminActivity);
// Admin full-record audit view, analytics, and manual cleanup
router.get('/admin/all', requireRoleLevel('admin'), activityController.getAdminAll);
router.get('/admin/stats', requireRoleLevel('admin'), activityController.getAdminStats);
router.delete('/admin/records', requireRoleLevel('admin'), activityController.deleteAdminRecords);

export default router;

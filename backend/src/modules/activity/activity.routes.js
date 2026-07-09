// Activity routes - /activity/user/:username, /activity/department/:department, /activity/admin
import { Router } from 'express';
import * as activityController from './activity.controller.js';

const router = Router();

router.get('/user/:username', activityController.getUserActivity);
router.get('/department/:department', activityController.getDepartmentActivity);
router.get('/admin', activityController.getAdminActivity);

export default router;

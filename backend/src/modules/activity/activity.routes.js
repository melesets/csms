// Activity routes - /activity/user/:username and /activity/department/:department
import { Router } from 'express';
import * as activityController from './activity.controller.js';

const router = Router();

router.get('/user/:username', activityController.getUserActivity);
router.get('/department/:department', activityController.getDepartmentActivity);

export default router;

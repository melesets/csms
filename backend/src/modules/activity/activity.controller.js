// Activity controller - serves activity data for users, departments, and admin audit log
import { asyncHandler } from '../../middleware/errorHandler.js';
import * as activityService from './activity.service.js';
import * as adminAudit from './adminAudit.service.js';

export const getUserActivity = asyncHandler(async (req, res) => {
  const activity = await activityService.getUserActivity(req.params.username);
  res.json(activity);
});

export const getDepartmentActivity = asyncHandler(async (req, res) => {
  const activity = await activityService.getDepartmentActivity(req.params.department);
  res.json(activity);
});

export const getAdminActivity = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const rows = await adminAudit.getRecentActivity(limit);
  res.json(rows);
});

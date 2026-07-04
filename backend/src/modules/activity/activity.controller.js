// Activity controller - serves activity data for users and departments
import { asyncHandler } from '../../middleware/errorHandler.js';
import * as activityService from './activity.service.js';

export const getUserActivity = asyncHandler(async (req, res) => {
  const activity = await activityService.getUserActivity(req.params.username);
  res.json(activity);
});

export const getDepartmentActivity = asyncHandler(async (req, res) => {
  const activity = await activityService.getDepartmentActivity(req.params.department);
  res.json(activity);
});

// Staff controller - handles staff CRUD with multer file uploads
import { asyncHandler } from '../../middleware/errorHandler.js';
import * as staffService from './staff.service.js';
import { logAdminAction } from '../activity/adminAudit.service.js';

export const getStaff = asyncHandler(async (req, res) => {
  const staff = await staffService.findAllStaff(req.query.parentUserId, req.query.department);
  res.json(staff);
});

export const createStaff = asyncHandler(async (req, res) => {
  const profilePicture = req.file
    ? await staffService.processAndSave(req.file.buffer, req.file.originalname)
    : null;
  const staff = await staffService.createStaff({ ...req.body, profilePicture });
  res.status(201).json(staff);
});

export const updateStaff = asyncHandler(async (req, res) => {
  const profilePicture = req.file
    ? await staffService.processAndSave(req.file.buffer, req.file.originalname)
    : null;
  const staff = await staffService.updateStaff(req.params.id, { ...req.body, profilePicture });
  if (!staff) return res.status(404).json({ error: 'Staff member not found' });
  res.json(staff);
});

export const deleteStaff = asyncHandler(async (req, res) => {
  const deleted = await staffService.deleteStaff(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Staff member not found' });
  logAdminAction({ action: 'delete', module: 'staff', targetId: req.params.id, performedBy: req.user?.username, ip: req.ip });
  res.json({ success: true });
});

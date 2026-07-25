// Users controller - handles user CRUD HTTP requests
import { asyncHandler } from '../../middleware/errorHandler.js';
import * as usersService from './users.service.js';
import { validateCreateUser, validateSetPin } from './users.validation.js';
import { logAdminAction } from '../activity/adminAudit.service.js';

export const getUsers = asyncHandler(async (req, res) => {
  const users = await usersService.findAllUsers(req.query.department, req.query.parentUserId);
  res.json(users);
});

export const getStaffByParent = asyncHandler(async (req, res) => {
  const staff = await usersService.findStaffByParentId(req.params.parentUserId);
  res.json(staff);
});

export const createUser = asyncHandler(async (req, res) => {
  const validation = validateCreateUser(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }
  const user = await usersService.createUser(req.body);
  res.status(201).json(user);
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await usersService.updateUser(req.params.id, req.body);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

export const deleteUser = asyncHandler(async (req, res) => {
  const deleted = await usersService.deleteUser(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'User not found' });
  logAdminAction({ action: 'delete', module: 'users', targetId: req.params.id, performedBy: req.user?.username, ip: req.ip });
  res.json({ success: true });
});

export const verifyPassword = asyncHandler(async (req, res) => {
  const { userId, password } = req.body;
  if (!userId || !password) return res.status(400).json({ error: 'Missing userId or password' });
  const result = await usersService.verifyPassword(userId, password);
  if (!result.valid) return res.status(401).json({ error: result.error });
  res.json({ valid: true });
});

export const resetStaffPin = asyncHandler(async (req, res) => {
  const { staffId, newPin } = req.body;
  if (!staffId || !newPin || String(newPin).length !== 4) {
    return res.status(400).json({ error: 'Missing staffId or invalid PIN' });
  }
  const verifierId = req.user?.id || req.body.userId;
  if (!verifierId) return res.status(400).json({ error: 'Missing verifier identity' });
  const result = await usersService.resetStaffPin(staffId, newPin, verifierId);
  if (result.error) return res.status(result.status).json({ error: result.error });
  if (!result) return res.status(404).json({ error: 'Staff not found' });
  res.json(result);
});

export const setPin = asyncHandler(async (req, res) => {
  const validation = validateSetPin(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }
  const user = await usersService.setPin(req.params.id, req.body.pin);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

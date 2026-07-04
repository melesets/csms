// Users controller - handles user CRUD HTTP requests
import { asyncHandler } from '../../middleware/errorHandler.js';
import * as usersService from './users.service.js';
import { validateCreateUser, validateSetPin } from './users.validation.js';

export const getUsers = asyncHandler(async (req, res) => {
  const users = await usersService.findAllUsers(req.query.department);
  res.json(users);
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
  res.json({ success: true });
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

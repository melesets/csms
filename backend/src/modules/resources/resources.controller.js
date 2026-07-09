// Resources controller - handles resource CRUD requests
// Maps HTTP requests to resources service methods

import { asyncHandler } from '../../middleware/errorHandler.js';
import * as resourcesService from './resources.service.js';
import { logAdminAction } from '../activity/adminAudit.service.js';

export const getResources = asyncHandler(async (req, res) => {
  const resources = await resourcesService.findAllResources();
  res.json(resources);
});

export const createResource = asyncHandler(async (req, res) => {
  const resource = await resourcesService.createResource(req.body);
  res.status(201).json(resource);
});

export const updateResource = asyncHandler(async (req, res) => {
  const resource = await resourcesService.updateResource(req.params.id, req.body);
  if (!resource) return res.status(404).json({ error: 'Resource not found' });
  res.json(resource);
});

export const deleteResource = asyncHandler(async (req, res) => {
  const deleted = await resourcesService.deleteResource(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Resource not found' });
  logAdminAction({ action: 'delete', module: 'resources', targetId: req.params.id, performedBy: req.user?.username, ip: req.ip });
  res.json({ success: true });
});

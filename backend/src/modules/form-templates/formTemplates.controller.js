// Form templates controller - handles template CRUD and activation requests

import { asyncHandler } from '../../middleware/errorHandler.js';
import * as ftService from './formTemplates.service.js';

export const getTemplates = asyncHandler(async (req, res) => {
  const templates = await ftService.findAllTemplates(req.query.department, req.query.profession);
  res.json(templates);
});

export const getActiveTemplate = asyncHandler(async (req, res) => {
  const template = await ftService.findActiveTemplate(req.params.department, req.query.profession);
  if (!template) return res.status(404).json({ error: 'No active template found for this department.' });
  res.json(template);
});

export const createTemplate = asyncHandler(async (req, res) => {
  const template = await ftService.createTemplate(req.body);
  res.json(template);
});

export const updateTemplate = asyncHandler(async (req, res) => {
  const template = await ftService.updateTemplate(req.params.id, req.body);
  if (!template) return res.status(404).json({ error: 'Template not found' });
  res.json(template);
});

export const setActive = asyncHandler(async (req, res) => {
  const template = await ftService.setActive(req.params.id);
  if (!template) return res.status(404).json({ error: 'Template not found' });
  res.json(template);
});

export const deleteTemplate = asyncHandler(async (req, res) => {
  const deleted = await ftService.deleteTemplate(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Template not found' });
  res.json({ success: true });
});

import { asyncHandler } from '../../middleware/errorHandler.js';
import * as dmService from './dashboardMappings.service.js';
import { validateCreateMapping, validateDashboardType } from './dashboardMappings.validation.js';

export const getMappings = asyncHandler(async (req, res) => {
  const mappings = await dmService.findAllMappings();
  res.json(mappings);
});

export const getByDepartment = asyncHandler(async (req, res) => {
  const { department, type } = req.params;
  const { profession } = req.query;
  const mappings = await dmService.findByDepartment(department, type, profession);
  res.json(mappings);
});

export const createMapping = asyncHandler(async (req, res) => {
  const validation = validateCreateMapping(req.body);
  if (!validation.valid) return res.status(400).json({ error: validation.error });
  const mapping = await dmService.createMapping(req.body);
  res.status(201).json(mapping);
});

export const updateMapping = asyncHandler(async (req, res) => {
  if (req.body.dashboardType) {
    const typeValidation = validateDashboardType(req.body.dashboardType);
    if (!typeValidation.valid) return res.status(400).json({ error: typeValidation.error });
  }
  const mapping = await dmService.updateMapping(req.params.id, req.body);
  if (!mapping) return res.status(404).json({ error: 'Dashboard mapping not found' });
  res.json(mapping);
});

export const deleteMapping = asyncHandler(async (req, res) => {
  const deleted = await dmService.deleteMapping(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Dashboard mapping not found' });
  res.json({ success: true, id: req.params.id });
});

export const toggleMapping = asyncHandler(async (req, res) => {
  const mapping = await dmService.toggleMapping(req.params.id);
  if (!mapping) return res.status(404).json({ error: 'Dashboard mapping not found' });
  res.json(mapping);
});

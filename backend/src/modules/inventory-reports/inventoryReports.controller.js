// Inventory reports controller - handles report listing and creation

import { asyncHandler } from '../../middleware/errorHandler.js';
import * as irService from './inventoryReports.service.js';

export const getReports = asyncHandler(async (req, res) => {
  const reports = await irService.findAllReports(req.query.department);
  res.json(reports);
});

export const createReport = asyncHandler(async (req, res) => {
  const { shift, staffName, department, date, resources } = req.body;
  if (!shift || !staffName || !department || !date || !resources) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const report = await irService.createReport(req.body);
  res.status(201).json(report);
});

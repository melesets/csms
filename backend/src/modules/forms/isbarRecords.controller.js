// ISBAR records controller - handles ISBAR record endpoints
// Routes create and list requests to the ISBAR service

import { asyncHandler } from '../../middleware/errorHandler.js';
import * as isbarService from './isbarRecords.service.js';

export const createRecord = asyncHandler(async (req, res) => {
  const record = await isbarService.saveIsbarRecord(req.body);
  res.status(201).json(record);
});

export const getRecords = asyncHandler(async (req, res) => {
  const records = await isbarService.findIsbarRecords(req.query);
  res.json(records);
});

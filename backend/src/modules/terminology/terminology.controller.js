// Terminology controller - handles terminology search and import requests

import { asyncHandler } from '../../middleware/errorHandler.js';
import * as termService from './terminology.service.js';

export const search = asyncHandler(async (req, res) => {
  const results = await termService.searchTerminology(req.query.q, req.query.system, req.query.limit, req.query.subset);
  res.json(results);
});

export const importCodes = asyncHandler(async (req, res) => {
  const { codes } = req.body;
  if (!codes || !Array.isArray(codes)) return res.status(400).json({ error: 'Invalid codes' });
  const result = await termService.importTerminology(codes);
  res.json(result);
});

// Admin controller - handles system settings and maintenance operations
import { asyncHandler } from '../../middleware/errorHandler.js';
import * as adminService from './admin.service.js';

export const getSystemInfo = asyncHandler(async (req, res) => {
  const info = await adminService.getSystemInfo();
  res.json(info);
});

export const exportData = asyncHandler(async (req, res) => {
  const { format } = req.params;
  const data = await adminService.exportData(format);
  res.json(data);
});

export const importData = asyncHandler(async (req, res) => {
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'No data provided' });
  const result = await adminService.importData(data);
  res.json(result);
});

export const createBackup = asyncHandler(async (req, res) => {
  const backup = await adminService.createBackup();
  res.json(backup);
});

export const getBackups = asyncHandler(async (req, res) => {
  const backups = await adminService.getBackups();
  res.json(backups);
});

export const getAuditLogs = asyncHandler(async (req, res) => {
  const logs = await adminService.getAuditLogs();
  res.json(logs);
});

export const clearAuditLogs = asyncHandler(async (req, res) => {
  const result = await adminService.clearAuditLogs();
  res.json(result);
});

export const purgeOldReports = asyncHandler(async (req, res) => {
  const result = await adminService.purgeOldReports();
  res.json(result);
});

export const clearExpiredResources = asyncHandler(async (req, res) => {
  const result = await adminService.clearExpiredResources();
  res.json(result);
});

export const resetAllData = asyncHandler(async (req, res) => {
  const result = await adminService.resetAllData();
  res.json(result);
});

export const clearCache = asyncHandler(async (req, res) => {
  const result = await adminService.clearCache();
  res.json(result);
});

export const healthCheck = asyncHandler(async (req, res) => {
  const result = await adminService.healthCheck();
  res.json(result);
});

export const saveTheme = asyncHandler(async (req, res) => {
  const result = await adminService.saveTheme(req.body);
  res.json(result);
});

export const getTheme = asyncHandler(async (req, res) => {
  const result = await adminService.getTheme();
  res.json(result);
});

export const saveNotifications = asyncHandler(async (req, res) => {
  const result = await adminService.saveNotifications(req.body);
  res.json(result);
});

export const getNotifications = asyncHandler(async (req, res) => {
  const result = await adminService.getNotifications();
  res.json(result);
});

export const saveSecurity = asyncHandler(async (req, res) => {
  const result = await adminService.saveSecurity(req.body);
  res.json(result);
});

export const syncSchema = asyncHandler(async (req, res) => {
  const result = await adminService.syncSchema();
  res.json(result);
});

export const reindex = asyncHandler(async (req, res) => {
  const result = await adminService.reindex();
  res.json(result);
});

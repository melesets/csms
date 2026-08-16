import { asyncHandler } from '../../middleware/errorHandler.js';
import * as customTabsService from './customTabs.service.js';
import { logAdminAction } from '../activity/adminAudit.service.js';

export const getTabs = asyncHandler(async (req, res) => {
  const tabs = await customTabsService.findAllTabs();
  res.json(tabs);
});

export const createTab = asyncHandler(async (req, res) => {
  if (!req.body.name || !String(req.body.name).trim()) {
    return res.status(400).json({ error: 'Tab name is required' });
  }
  const tab = await customTabsService.createTab(req.body);
  logAdminAction({ action: 'create', module: 'custom-tabs', targetId: tab.id, detail: `tab "${tab.name}"`, performedBy: req.user?.username, ip: req.ip });
  res.status(201).json(tab);
});

export const updateTab = asyncHandler(async (req, res) => {
  const tab = await customTabsService.updateTab(req.params.id, req.body);
  if (!tab) return res.status(404).json({ error: 'Custom tab not found' });
  logAdminAction({ action: 'update', module: 'custom-tabs', targetId: tab.id, detail: `tab "${tab.name}"`, performedBy: req.user?.username, ip: req.ip });
  res.json(tab);
});

export const deleteTab = asyncHandler(async (req, res) => {
  const deleted = await customTabsService.deleteTab(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Custom tab not found' });
  logAdminAction({ action: 'delete', module: 'custom-tabs', targetId: req.params.id, performedBy: req.user?.username, ip: req.ip });
  res.json({ success: true, id: req.params.id });
});
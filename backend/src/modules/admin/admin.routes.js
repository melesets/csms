// Admin routes - system settings, backup, migration, maintenance
import { Router } from 'express';
import * as adminController from './admin.controller.js';

const router = Router();

router.get('/system-info', adminController.getSystemInfo);
router.get('/export/:format', adminController.exportData);
router.post('/import', adminController.importData);
router.post('/backup', adminController.createBackup);
router.get('/backups', adminController.getBackups);
router.get('/audit-logs', adminController.getAuditLogs);
router.post('/clear-logs', adminController.clearAuditLogs);
router.post('/purge-reports', adminController.purgeOldReports);
router.post('/clear-expired', adminController.clearExpiredResources);
router.post('/reset-all', adminController.resetAllData);
router.post('/nuclear-reset', adminController.resetAllData);
router.post('/clear-cache', adminController.clearCache);
router.post('/health-check', adminController.healthCheck);
router.post('/restart-server', (req, res) => {
  res.json({ success: true, message: 'Server restart requested' });
  setTimeout(() => process.exit(0), 1000);
});
router.post('/theme', adminController.saveTheme);
router.get('/theme', adminController.getTheme);
router.post('/notifications', adminController.saveNotifications);
router.get('/notifications', adminController.getNotifications);
router.post('/security', adminController.saveSecurity);
router.post('/sync-schema', adminController.syncSchema);
router.post('/reindex', adminController.reindex);

export default router;

// Admin routes - system settings, backup, migration, maintenance
import { Router } from 'express';
import * as adminController from './admin.controller.js';
import { requireRoleLevel } from '../../middleware/auth.js';

const router = Router();

router.get('/system-info', requireRoleLevel('admin'), adminController.getSystemInfo);
router.get('/export/:format', requireRoleLevel('admin'), adminController.exportData);
router.post('/import', requireRoleLevel('admin'), adminController.importData);
router.post('/backup', requireRoleLevel('admin'), adminController.createBackup);
router.get('/backups', requireRoleLevel('admin'), adminController.getBackups);
router.get('/audit-logs', requireRoleLevel('admin'), adminController.getAuditLogs);
router.post('/clear-logs', requireRoleLevel('admin'), adminController.clearAuditLogs);
router.post('/purge-reports', requireRoleLevel('admin'), adminController.purgeOldReports);
router.post('/clear-expired', requireRoleLevel('admin'), adminController.clearExpiredResources);
router.post('/reset-all', requireRoleLevel('superadmin'), adminController.resetAllData);
router.post('/nuclear-reset', requireRoleLevel('superadmin'), adminController.resetAllData);
router.post('/clear-cache', requireRoleLevel('admin'), adminController.clearCache);
router.post('/health-check', requireRoleLevel('admin'), adminController.healthCheck);
router.post('/restart-server', requireRoleLevel('superadmin'), (req, res) => {
  res.json({ success: true, message: 'Server restart requested' });
  setTimeout(() => process.exit(0), 1000);
});
router.post('/theme', requireRoleLevel('admin'), adminController.saveTheme);
router.get('/theme', adminController.getTheme);
router.post('/notifications', requireRoleLevel('admin'), adminController.saveNotifications);
router.get('/notifications', adminController.getNotifications);
router.post('/security', requireRoleLevel('admin'), adminController.saveSecurity);
router.post('/sync-schema', requireRoleLevel('admin'), adminController.syncSchema);
router.post('/reindex', requireRoleLevel('admin'), adminController.reindex);

export default router;

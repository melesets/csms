import { Router } from 'express';
import * as customTabsController from './customTabs.controller.js';
import { requireRoleLevel } from '../../middleware/auth.js';

const router = Router();

// Read is available to all authenticated users — the dashboard needs tabs for every role.
// Mutations (create/update/delete) are admin-only.
router.get('/', customTabsController.getTabs);
router.post('/', requireRoleLevel('admin'), customTabsController.createTab);
router.put('/:id', requireRoleLevel('admin'), customTabsController.updateTab);
router.delete('/:id', requireRoleLevel('admin'), customTabsController.deleteTab);

export default router;
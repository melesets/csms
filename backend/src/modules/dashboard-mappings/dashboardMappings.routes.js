import { Router } from 'express';
import * as dmController from './dashboardMappings.controller.js';
import { requireRoleLevel } from '../../middleware/auth.js';

const router = Router();

router.get('/by-department/:department/:type?', dmController.getByDepartment);
router.get('/', dmController.getMappings);
router.post('/', requireRoleLevel('admin'), dmController.createMapping);
router.put('/:id', requireRoleLevel('admin'), dmController.updateMapping);
router.delete('/:id', requireRoleLevel('admin'), dmController.deleteMapping);
router.patch('/:id/toggle', requireRoleLevel('admin'), dmController.toggleMapping);

export default router;

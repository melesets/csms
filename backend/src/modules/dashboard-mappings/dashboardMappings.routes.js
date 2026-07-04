import { Router } from 'express';
import * as dmController from './dashboardMappings.controller.js';

const router = Router();

router.get('/by-department/:department/:type?', dmController.getByDepartment);
router.get('/', dmController.getMappings);
router.post('/', dmController.createMapping);
router.put('/:id', dmController.updateMapping);
router.delete('/:id', dmController.deleteMapping);
router.patch('/:id/toggle', dmController.toggleMapping);

export default router;

// Form template routes - /form-templates CRUD with active template lookup

import { Router } from 'express';
import * as ftController from './formTemplates.controller.js';
import { requireRoleLevel } from '../../middleware/auth.js';

const router = Router();

router.get('/department/:department/active-template', ftController.getActiveTemplate);
router.get('/', ftController.getTemplates);
router.post('/', requireRoleLevel('admin'), ftController.createTemplate);
router.put('/:id', requireRoleLevel('admin'), ftController.updateTemplate);
router.patch('/:id/set-active', requireRoleLevel('admin'), ftController.setActive);
router.delete('/:id', requireRoleLevel('admin'), ftController.deleteTemplate);

export default router;

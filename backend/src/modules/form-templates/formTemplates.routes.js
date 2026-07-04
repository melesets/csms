// Form template routes - /form-templates CRUD with active template lookup

import { Router } from 'express';
import * as ftController from './formTemplates.controller.js';

const router = Router();

router.get('/department/:department/active-template', ftController.getActiveTemplate);
router.get('/', ftController.getTemplates);
router.post('/', ftController.createTemplate);
router.put('/:id', ftController.updateTemplate);
router.patch('/:id/set-active', ftController.setActive);
router.delete('/:id', ftController.deleteTemplate);

export default router;

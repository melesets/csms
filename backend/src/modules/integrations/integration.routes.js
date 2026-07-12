// Integration configs routes

import { Router } from 'express';
import * as integrationController from './integration.controller.js';

const router = Router();

router.get('/', integrationController.getAll);
router.get('/:id', integrationController.getById);
router.post('/', integrationController.create);
router.put('/:id', integrationController.update);
router.delete('/:id', integrationController.remove);
router.patch('/:id/toggle', integrationController.toggleActive);
router.post('/:id/test', integrationController.testConnection);
router.post('/:id/sync', integrationController.syncPatients);

export default router;

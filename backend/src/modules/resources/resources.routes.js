// Resource routes - /resources CRUD
// Defines endpoints for listing, creating, updating, and deleting resources

import { Router } from 'express';
import * as resourcesController from './resources.controller.js';

const router = Router();

router.get('/', resourcesController.getResources);
router.post('/', resourcesController.createResource);
router.put('/:id', resourcesController.updateResource);
router.delete('/:id', resourcesController.deleteResource);

export default router;

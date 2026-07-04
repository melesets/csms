// Inventory report routes - /inventory-reports GET and POST

import { Router } from 'express';
import * as irController from './inventoryReports.controller.js';

const router = Router();

router.get('/', irController.getReports);
router.post('/', irController.createReport);

export default router;

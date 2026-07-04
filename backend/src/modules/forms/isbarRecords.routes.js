// ISBAR record routes - POST and GET for ISBAR records
// Provides endpoints to save and retrieve ISBAR submissions

import { Router } from 'express';
import * as isbarController from './isbarRecords.controller.js';

const router = Router();

router.post('/', isbarController.createRecord);
router.get('/', isbarController.getRecords);

export default router;

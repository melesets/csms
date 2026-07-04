// Terminology routes - /terminology/search and /terminology/import

import { Router } from 'express';
import * as termController from './terminology.controller.js';

const router = Router();

router.get('/search', termController.search);
router.post('/import', termController.importCodes);

export default router;

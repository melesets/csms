// Department routes - GET /
import { Router } from 'express';
import * as departmentsController from './departments.controller.js';

const router = Router();
router.get('/', departmentsController.getDepartments);

export default router;

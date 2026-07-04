// Form submission routes - /form-submissions CRUD
// Defines endpoints for creating, reading, updating, and deleting submissions

import { Router } from 'express';
import * as formsController from './forms.controller.js';

const router = Router();

router.post('/', formsController.createSubmission);
router.get('/', formsController.getSubmissions);
router.get('/:id', formsController.getSubmissionById);
router.put('/:id', formsController.updateSubmission);
router.delete('/:id', formsController.deleteSubmission);

export default router;

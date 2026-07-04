// Patient routes - /patient-data with MRN lookup
// Defines endpoints for patient list, MRN search, and detail view

import { Router } from 'express';
import * as patientsController from './patients.controller.js';

const router = Router();

router.get('/mrns', patientsController.getMrns);
router.get('/mrn/:mrn', patientsController.getPatientByMrn);
router.get('/', patientsController.getPatients);

export default router;

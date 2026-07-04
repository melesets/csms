// Staff routes - /department-staff CRUD with photo upload
import { Router } from 'express';
import * as staffController from './staff.controller.js';
import { upload } from './staff.service.js';

const router = Router();

router.get('/', staffController.getStaff);
router.post('/', upload.single('photo'), staffController.createStaff);
router.put('/:id', upload.single('photo'), staffController.updateStaff);
router.delete('/:id', staffController.deleteStaff);

export default router;

import { Router } from 'express';
import { requireRole } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import * as bedAllocationController from './bedAllocation.controller.js';

const router = Router();

router.get('/beds', requireRole('admin', 'superadmin', 'user'), asyncHandler(bedAllocationController.getBeds));
router.post('/beds', requireRole('admin', 'superadmin', 'user'), asyncHandler(bedAllocationController.createBed));
router.put('/beds/:id', requireRole('admin', 'superadmin', 'user'), asyncHandler(bedAllocationController.updateBed));
router.delete('/beds/:id', requireRole('admin', 'superadmin', 'user'), asyncHandler(bedAllocationController.deleteBed));

router.get('/allocations', requireRole('admin', 'superadmin', 'user'), asyncHandler(bedAllocationController.getBedAllocations));
router.post('/allocations', requireRole('admin', 'superadmin', 'user'), asyncHandler(bedAllocationController.createBedAllocation));
router.delete('/allocations/:id', requireRole('admin', 'superadmin', 'user'), asyncHandler(bedAllocationController.deleteBedAllocation));

export default router;
// Bed allocation controller
import { asyncHandler } from '../../middleware/errorHandler.js';
import * as bedAllocationService from './bedAllocation.service.js';

export const getBeds = asyncHandler(async (req, res) => {
  const department = req.query.department || undefined;
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';
  const dept = isAdmin ? department : (req.user?.department || department);
  const beds = await bedAllocationService.getBeds(dept);
  res.json(beds);
});

export const createBed = asyncHandler(async (req, res) => {
  const { name, department } = req.body;
  if (!name || !department) return res.status(400).json({ error: 'name and department are required' });
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';
  const dept = isAdmin ? department : (req.user?.department || department);
  const bed = await bedAllocationService.createBed({ name, department: dept, createdBy: req.user?.id });
  res.status(201).json(bed);
});

export const updateBed = asyncHandler(async (req, res) => {
  const { name, isActive } = req.body;
  const bed = await bedAllocationService.updateBed(req.params.id, { name, isActive });
  if (!bed) return res.status(404).json({ error: 'Bed not found' });
  res.json(bed);
});

export const deleteBed = asyncHandler(async (req, res) => {
  const deleted = await bedAllocationService.deleteBed(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Bed not found' });
  res.json({ success: true });
});

export const getBedAllocations = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  if (!startDate || !endDate) return res.status(400).json({ error: 'startDate and endDate are required' });
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';
  const department = isAdmin ? req.query.department : (req.user?.department || req.query.department);
  if (!department) return res.status(400).json({ error: 'department is required' });
  const allocations = await bedAllocationService.getBedAllocations({ department, startDate, endDate });
  res.json(allocations);
});

export const createBedAllocation = asyncHandler(async (req, res) => {
  const { bedId, staffUserId, allocationDate, department } = req.body;
  if (!bedId || !staffUserId || !allocationDate) {
    return res.status(400).json({ error: 'bedId, staffUserId, and allocationDate are required' });
  }
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';
  const dept = isAdmin ? department : (req.user?.department || department);
  if (!dept) return res.status(400).json({ error: 'department is required' });
  const allocation = await bedAllocationService.createBedAllocation({
    bedId, staffUserId, allocationDate, department: dept, createdBy: req.user?.id
  });
  res.status(201).json(allocation);
});

export const deleteBedAllocation = asyncHandler(async (req, res) => {
  const deleted = await bedAllocationService.deleteBedAllocation(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Allocation not found' });
  res.json({ success: true });
});

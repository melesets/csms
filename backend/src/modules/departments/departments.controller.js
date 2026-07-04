// Departments controller - returns department list
import { asyncHandler } from '../../middleware/errorHandler.js';
import * as departmentsService from './departments.service.js';

export const getDepartments = asyncHandler(async (req, res) => {
  const departments = await departmentsService.findDistinctDepartments();
  res.json(departments);
});

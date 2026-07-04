// Form submissions controller - handles form CRUD requests
// Maps HTTP requests to forms service methods

import { asyncHandler } from '../../middleware/errorHandler.js';
import * as formsService from './forms.service.js';

export const createSubmission = asyncHandler(async (req, res) => {
  const submission = await formsService.createSubmission(req.body);
  res.json(submission);
});

export const getSubmissions = asyncHandler(async (req, res) => {
  const submissions = await formsService.findSubmissions(req.query);
  res.json(submissions);
});

export const getSubmissionById = asyncHandler(async (req, res) => {
  const submission = await formsService.findSubmissionById(req.params.id);
  if (!submission) return res.status(404).json({ error: 'Submission not found' });
  res.json(submission);
});

export const updateSubmission = asyncHandler(async (req, res) => {
  const submission = await formsService.updateSubmission(req.params.id, req.body);
  if (!submission) return res.status(404).json({ error: 'Submission not found' });
  res.json(submission);
});

export const deleteSubmission = asyncHandler(async (req, res) => {
  const deleted = await formsService.deleteSubmission(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Submission not found' });
  res.json({ success: true, message: 'Submission deleted successfully' });
});

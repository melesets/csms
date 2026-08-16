import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { requireRoleLevel } from '../../middleware/auth.js';
import path from 'path';
import * as feedbackService from './feedback.service.js';

const router = Router();

router.post('/attachments', feedbackService.upload.array('files', 5), asyncHandler(async (req, res) => {
  if (!req.files || !req.files.length) return res.status(400).json({ error: 'No files uploaded' });
  const saved = [];
  for (const file of req.files) {
    saved.push(await feedbackService.saveAttachment(file));
  }
  res.status(201).json(saved);
}));

router.get('/attachments/:id', asyncHandler(async (req, res) => {
  const row = await feedbackService.getAttachmentRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'Attachment not found' });
  const filename = row.storage_path.split('/').pop();
  const filepath = path.join(feedbackService.uploadsDir, filename);
  res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(row.original_name)}`);
  res.sendFile(filepath);
}));

router.get('/', asyncHandler(async (req, res) => {
  const { status, category, department, priority, search, userId, limit, offset } = req.query;
  const items = await feedbackService.findFeedback({
    user: req.user,
    status,
    category,
    department,
    priority,
    search,
    userId,
    limit: Math.min(parseInt(limit) || 100, 500),
    offset: parseInt(offset) || 0,
  });
  const total = await feedbackService.countFeedback({ user: req.user, status, category, department, search });
  res.json({ items, total });
}));

router.post('/', requireRoleLevel('admin'), asyncHandler(async (req, res) => {
  const { subject, message, category, rating, attachmentIds, targetDepartment, targetProfession, targetRole, targetUserId } = req.body;
  if (!subject || !subject.trim() || !message || !message.trim()) {
    return res.status(400).json({ error: 'Subject and message are required' });
  }
  const created = await feedbackService.createFeedback({ user: req.user, body: { subject, message, category, rating, attachmentIds, targetDepartment, targetProfession, targetRole, targetUserId } });
  res.status(201).json(created);
}));

router.get('/stats', asyncHandler(async (req, res) => {
  res.json(await feedbackService.getFeedbackStats(req.user));
}));

router.get('/unread-count', asyncHandler(async (req, res) => {
  res.json({ count: await feedbackService.getUnreadCount(req.user) });
}));

router.get('/recent', asyncHandler(async (req, res) => {
  const items = await feedbackService.findRecent(req.user, Math.min(parseInt(req.query.limit) || 8, 20));
  res.json(items);
}));

router.post('/enhance', asyncHandler(async (req, res) => {
  const { text, subject, category } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Text is required' });
  if (text.trim().length > 4000) return res.status(400).json({ error: 'Text is too long (max 4000 characters)' });
  const result = await feedbackService.enhanceWithAI({ text: text.trim(), subject: subject || '', category: category || '' });
  if (result.error === 'ai_not_configured') return res.status(503).json({ error: 'AI service is not configured — add an API key (GROQ_API_KEY or OPENAI_API_KEY) in backend/.env' });
  if (result.error === 'ai_failed') return res.status(502).json({ error: 'AI service is busy — please try again' });
  res.json(result);
}));

router.get('/:id/replies', asyncHandler(async (req, res) => {
  const result = await feedbackService.getReplies({ feedbackId: req.params.id, user: req.user });
  if (result.error === 'not_found') return res.status(404).json({ error: 'Feedback not found' });
  if (result.error === 'forbidden') return res.status(403).json({ error: 'Not allowed' });
  res.json(result.replies);
}));

router.post('/:id/replies', asyncHandler(async (req, res) => {
  const { message, replyToId, attachmentIds } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required' });
  const result = await feedbackService.addReply({ feedbackId: req.params.id, user: req.user, message, replyToId, attachmentIds });
  if (result.error === 'not_found') return res.status(404).json({ error: 'Feedback not found' });
  if (result.error === 'forbidden') return res.status(403).json({ error: 'Not allowed' });
  if (result.error === 'invalid_reply_to') return res.status(400).json({ error: 'Reply target not found' });
  res.status(201).json(result.reply);
}));

router.post('/:id/seen', asyncHandler(async (req, res) => {
  const result = await feedbackService.markSeen({ feedbackId: req.params.id, user: req.user });
  if (result.error === 'not_found') return res.status(404).json({ error: 'Feedback not found' });
  if (result.error === 'forbidden') return res.status(403).json({ error: 'Not allowed' });
  res.json(result.feedback);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const { status, priority, isRead } = req.body;
  const updated = await feedbackService.updateFeedback(req.params.id, { status, priority, isRead, actingUser: req.user });
  if (updated === null) return res.status(404).json({ error: 'Feedback not found' });
  if (updated.error === 'forbidden') return res.status(403).json({ error: 'Not allowed' });
  if (updated.error === 'invalid_status') return res.status(400).json({ error: 'Staff may only set In Progress or Resolved' });
  res.json(updated.item);
}));

router.delete('/:id', requireRoleLevel('admin'), asyncHandler(async (req, res) => {
  const removed = await feedbackService.removeFeedback(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Feedback not found' });
  res.json({ ok: true });
}));

export default router;

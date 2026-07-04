// AI routes - /ai/* endpoints for chat, handover analysis, report generation, and streaming

import { Router } from 'express';
import * as aiController from './ai.controller.js';

const router = Router();

router.get('/providers', aiController.getProviders);
router.post('/handover/analyze', aiController.handoverAnalyze);
router.post('/handover/summarize', aiController.handoverSummarize);
router.post('/reports/generate', aiController.reportGenerate);
router.post('/audit/analyze', aiController.auditAnalyze);
router.post('/stream', aiController.stream);
router.post('/generate-form', aiController.generateForm);
router.post('/generate-report', aiController.generateReport);
router.post('/summarize', aiController.summarize);
router.post('/risk-score', aiController.riskScore);
router.post('/suggestions', aiController.suggestions);
router.post('/full-analysis', aiController.fullAnalysis);
router.post('/db-query', aiController.dbQuery);
router.post('/', aiController.chat);

export default router;

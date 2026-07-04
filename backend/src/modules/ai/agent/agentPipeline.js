// =============================================================================
// |Adare AI AGENT — Agent Pipeline Orchestrator
// =============================================================================
// Main entry point that wires together all layers:
//   Input → Validation → Normalization → DB Context → AI Processing → Reporting
// =============================================================================

import { ingestHandoverData, ingestFileData } from './dataIngestion.js';
import { validateHandoverData, validateFileData, validateChatInput } from './dataValidation.js';
import { processAI, attachmentsToTextBlock } from './aiProcessing.js';
import { safeQuery, lookupMrnByName, fetchPatientHistory, fetchDatabaseContext } from './dbAccess.js';
import {
  formatHandoverSummary,
  formatHandoverAnalysis,
  formatReport,
  formatRiskAssessment,
  formatChatResponse,
  formatStreamChunk,
} from './reporting.js';
import { listTemplates } from './promptTemplates.js';
import {
  isCrewAIOnline,
  crewHandoverAnalyze,
  crewHandoverSummarize,
  crewClinicalRisk,
  crewReportDepartment,
  crewReportResource,
  crewReportAudit,
  crewChat,
  crewDBQuery,
  CREWAI_URL,
} from './crewaiBridge.js';

// Cache CrewAI availability (refresh every 30s)
let _crewOnline = false;
let _crewCheckedAt = 0;
async function crewAvailable() {
  const now = Date.now();
  if (now - _crewCheckedAt > 30_000) {
    _crewOnline = await isCrewAIOnline();
    _crewCheckedAt = now;
    if (_crewOnline) console.log('[|Adare] CrewAI service online at', CREWAI_URL);
  }
  return _crewOnline;
}

// =============================================================================
// PUBLIC API — each method tries CrewAI first, falls back to local pipeline
// =============================================================================

/**
 * Chat pipeline — general conversation with DB auto-detection.
 */
export async function chatPipeline(raw = {}) {
  // Try CrewAI first
  if (await crewAvailable() && raw.message) {
    const crew = await crewChat(raw.message);
    if (crew.ok) return { text: crew.data.result, provider: 'CrewAI', isAIGenerated: true };
    console.error('[|Adare] CrewAI chat failed, falling back to local:', crew.error);
  }

  const ctx = ingestHandoverData(raw);
  const validation = validateChatInput(ctx.message);
  if (!validation.valid) return { error: validation.error };

  // Auto-detect MRN
  const mrnMatch = (ctx.message || '').match(/\b\d{5,}\b/);
  let mrn = ctx.mrn || mrnMatch?.[0];
  if (!mrn) {
    const nameMatch = (ctx.message || '').match(/(?:about|for|status of|patient)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
    if (nameMatch) mrn = await lookupMrnByName(nameMatch[1]);
  }
  if (mrn) ctx.systemHistory = await fetchPatientHistory(mrn);

  // Auto-fetch DB context
  const dbContext = await fetchDatabaseContext(ctx.message || '');
  if (dbContext) ctx.databaseContext = dbContext;

  const aiResult = await processAI('chat', ctx, {
    stream: false,
    maxTokens: 2048,
    temperature: 0.4,
  });

  return formatChatResponse(aiResult);
}

/**
 * Chat streaming pipeline.
 * Returns { ok, body, provider } for SSE processing by the route handler.
 */
export async function chatStreamPipeline(raw = {}) {
  const ctx = ingestHandoverData(raw);
  const validation = validateChatInput(ctx.message);
  if (!validation.valid) return { ok: false, error: validation.error };

  // Auto-detect MRN
  const mrnMatch = (ctx.message || '').match(/\b\d{5,}\b/);
  let mrn = ctx.mrn || mrnMatch?.[0];
  if (!mrn) {
    const nameMatch = (ctx.message || '').match(/(?:about|for|status of|patient)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
    if (nameMatch) mrn = await lookupMrnByName(nameMatch[1]);
  }
  if (mrn) ctx.systemHistory = await fetchPatientHistory(mrn);

  // Auto-fetch DB context
  const dbContext = await fetchDatabaseContext(ctx.message || '');
  if (dbContext) ctx.databaseContext = dbContext;

  const streamResult = await processAI('chat', ctx, {
    stream: true,
    maxTokens: 3072,
    temperature: 0.4,
  });

  return streamResult;
}

/**
 * Handover summarize pipeline.
 */
export async function handoverSummarizePipeline(raw = {}) {
  // Try CrewAI first
  if (await crewAvailable() && raw.handoverData) {
    const crew = await crewHandoverSummarize(raw.handoverData);
    if (crew.ok) return { text: crew.data.result, provider: 'CrewAI', isAIGenerated: true };
    console.error('[|Adare] CrewAI handover/summarize failed, falling back:', crew.error);
  }

  const ctx = ingestHandoverData(raw);
  const validation = validateHandoverData(ctx);

  // Fetch patient history if MRN available
  if (ctx.mrn) ctx.systemHistory = await fetchPatientHistory(ctx.mrn);

  // Fetch DB context
  const dbContext = await fetchDatabaseContext(JSON.stringify(ctx.handoverData));
  if (dbContext) ctx.databaseContext = dbContext;

  const aiResult = await processAI('handover-summarize', ctx, {
    stream: false,
    maxTokens: 3072,
    temperature: 0.3,
  });

  return formatHandoverSummary(aiResult, validation);
}

/**
 * Handover analyze pipeline (JSON mode).
 */
export async function handoverAnalyzePipeline(raw = {}) {
  // Try CrewAI first
  if (await crewAvailable() && raw.handoverData) {
    const crew = await crewHandoverAnalyze(raw.handoverData);
    if (crew.ok) return { text: crew.data.result, provider: 'CrewAI', isAIGenerated: true };
    console.error('[|Adare] CrewAI handover/analyze failed, falling back:', crew.error);
  }

  const ctx = ingestHandoverData(raw);
  const validation = validateHandoverData(ctx);

  if (ctx.mrn) ctx.systemHistory = await fetchPatientHistory(ctx.mrn);
  const dbContext = await fetchDatabaseContext(JSON.stringify(ctx.handoverData));
  if (dbContext) ctx.databaseContext = dbContext;

  const aiResult = await processAI('handover-analyze', ctx, {
    stream: false,
    jsonMode: true,
    maxTokens: 2048,
    temperature: 0.2,
  });

  return formatHandoverAnalysis(aiResult, validation);
}

/**
 * Report generation pipeline.
 */
export async function reportGeneratePipeline(raw = {}) {
  // Try CrewAI first
  const reportType = raw.reportType || 'department';
  if (await crewAvailable()) {
    let crew;
    if (reportType === 'resource') crew = await crewReportResource();
    else if (reportType === 'audit') crew = await crewReportAudit();
    else crew = await crewReportDepartment(raw.department || 'all');
    if (crew.ok) return { text: crew.data.result, provider: 'CrewAI', isAIGenerated: true, reportType };
    console.error('[|Adare] CrewAI report failed, falling back:', crew.error);
  }

  const ctx = ingestHandoverData(raw); // department, resource, audit

  const dbContext = await fetchDatabaseContext(raw.message || reportType);
  if (dbContext) ctx.databaseContext = dbContext;

  const templateId = reportType === 'resource' ? 'report-resource'
    : reportType === 'audit' ? 'report-audit'
    : 'report-department';

  const aiResult = await processAI(templateId, ctx, {
    stream: false,
    maxTokens: 3072,
    temperature: 0.3,
  });

  return formatReport(aiResult, reportType);
}

/**
 * Audit analysis pipeline.
 */
export async function auditAnalyzePipeline(raw = {}) {
  // Try CrewAI first
  if (await crewAvailable()) {
    const crew = await crewReportAudit();
    if (crew.ok) return { text: crew.data.result, provider: 'CrewAI', isAIGenerated: true };
    console.error('[|Adare] CrewAI audit failed, falling back:', crew.error);
  }

  const ctx = ingestHandoverData(raw);

  const dbContext = await fetchDatabaseContext('audit dashboard report');
  if (dbContext) ctx.databaseContext = dbContext;
  if (raw.auditData) ctx.auditData = raw.auditData;

  const aiResult = await processAI('report-audit', ctx, {
    stream: false,
    jsonMode: true,
    maxTokens: 2048,
    temperature: 0.2,
  });

  return formatReport(aiResult, 'audit');
}

/**
 * Clinical risk assessment pipeline.
 */
export async function clinicalRiskPipeline(raw = {}) {
  // Try CrewAI first
  if (await crewAvailable() && raw.handoverData) {
    const crew = await crewClinicalRisk(raw.handoverData);
    if (crew.ok) return { text: crew.data.result, provider: 'CrewAI', isAIGenerated: true };
    console.error('[|Adare] CrewAI clinical risk failed, falling back:', crew.error);
  }

  const ctx = ingestHandoverData(raw);

  if (ctx.mrn) ctx.systemHistory = await fetchPatientHistory(ctx.mrn);

  const aiResult = await processAI('clinical-risk', ctx, {
    stream: false,
    jsonMode: true,
    maxTokens: 1024,
    temperature: 0.2,
  });

  return formatRiskAssessment(aiResult);
}

/**
 * ISBAR section generation pipeline (backward compatible).
 */
export async function isbarPipeline(type, raw = {}) {
  const ctx = ingestHandoverData(raw);

  // Auto-detect MRN
  const mrnMatch = (ctx.message || '').match(/\b\d{5,}\b/);
  let mrn = ctx.mrn || mrnMatch?.[0];
  if (!mrn) {
    const nameMatch = (ctx.message || '').match(/(?:about|for|status of|patient)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
    if (nameMatch) mrn = await lookupMrnByName(nameMatch[1]);
  }
  if (mrn) ctx.systemHistory = await fetchPatientHistory(mrn);

  const templateId = type === 'nursing-summary' ? 'nursing-summary'
    : type === 'vitals-analysis' ? 'vitals-analysis'
    : type === 'generate-full-isbar' ? 'generate-full-isbar'
    : type === 'dashboard-insight' ? 'dashboard-insight'
    : type.startsWith('isbar-') ? type
    : 'chat';

  const maxTokens = type === 'nursing-summary' ? 3072 : 2048;

  const aiResult = await processAI(templateId, ctx, {
    stream: false,
    jsonMode: type === 'generate-full-isbar',
    maxTokens,
    temperature: type === 'generate-full-isbar' ? 0.5 : 0.3,
  });

  return formatChatResponse(aiResult);
}

/**
 * Safe DB query pipeline (for explicit queries).
 */
export async function dbQueryPipeline(sql, params = []) {
  // Try CrewAI first (agent can add context/insights)
  if (await crewAvailable()) {
    const crew = await crewDBQuery(sql);
    if (crew.ok) return { text: crew.data.result, provider: 'CrewAI', isAIGenerated: true, rows: [] };
    console.error('[|Adare] CrewAI db-query failed, falling back:', crew.error);
  }

  const rows = await safeQuery(sql, params);
  return { rows, count: rows.length };
}

/**
 * List available templates.
 */
export function listAgentTemplates() {
  return listTemplates();
}

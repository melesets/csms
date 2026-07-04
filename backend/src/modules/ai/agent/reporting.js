// =============================================================================
// |Adare AI AGENT — Reporting Layer
// =============================================================================
// Generates structured reports from AI processing results.
// Handles formatting for different output types: JSON, text, markdown.
// =============================================================================

/**
 * Format an AI analysis result into a structured handover summary.
 */
export function formatHandoverSummary(aiResult, validation = null) {
  const text = aiResult.text || aiResult.json ? JSON.stringify(aiResult.json, null, 2) : '';
  return {
    type: 'handover-summary',
    generatedAt: new Date().toISOString(),
    provider: aiResult.provider,
    content: text,
    validation: validation ? {
      completeness: validation.completeness?.score,
      consistency: validation.consistency?.score,
      issues: validation.issues?.length || 0,
      warnings: validation.warnings?.length || 0,
    } : null,
  };
}

/**
 * Format a handover analysis result (JSON mode).
 */
export function formatHandoverAnalysis(aiResult, validation = null) {
  const json = aiResult.json || {};
  return {
    type: 'handover-analysis',
    generatedAt: new Date().toISOString(),
    provider: aiResult.provider,
    completeness: json.completeness || null,
    consistency: json.consistency || null,
    clinicalRisk: json.clinicalRisk || null,
    dataQuality: json.dataQuality || null,
    recommendations: json.recommendations || [],
    summary: json.summary || '',
    validation: validation ? {
      completeness: validation.completeness?.score,
      consistency: validation.consistency?.score,
      issues: validation.issues?.length || 0,
      warnings: validation.warnings?.length || 0,
    } : null,
  };
}

/**
 * Format a department/resource/audit report.
 */
export function formatReport(aiResult, reportType = 'department') {
  const text = aiResult.text || '';
  return {
    type: `${reportType}-report`,
    generatedAt: new Date().toISOString(),
    provider: aiResult.provider,
    content: text,
  };
}

/**
 * Format a clinical risk assessment result.
 */
export function formatRiskAssessment(aiResult) {
  const json = aiResult.json || {};
  return {
    type: 'clinical-risk',
    generatedAt: new Date().toISOString(),
    provider: aiResult.provider,
    riskLevel: json.riskLevel || 'Unknown',
    riskScore: json.riskScore || 0,
    escalateNow: json.escalateNow || false,
    abnormalVitals: json.abnormalVitals || [],
    trends: json.trends || 'Unknown',
    alerts: json.alerts || [],
    immediateActions: json.immediateActions || [],
    rationale: json.rationale || '',
  };
}

/**
 * Format a chat response.
 */
export function formatChatResponse(aiResult) {
  return {
    type: 'chat',
    text: aiResult.text || '',
    provider: aiResult.provider,
    isAIGenerated: true,
  };
}

/**
 * Format a streaming chunk.
 */
export function formatStreamChunk(text, provider) {
  return { text, provider };
}

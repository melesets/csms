// =============================================================================
// |Adare AI AGENT — Data Validation Layer
// =============================================================================
// Validates incoming data for completeness, consistency, and clinical safety.
// Returns a validation result with scores and flagged issues.
// =============================================================================

/**
 * Validate handover data for completeness and consistency.
 *
 * @param {object} data - Normalized data envelope from dataIngestion
 * @returns {object} Validation result { valid, completeness, consistency, issues, warnings }
 */
export function validateHandoverData(data = {}) {
  const issues = [];
  const warnings = [];
  const hd = data.handoverData || {};

  // ── Completeness checks ──────────────────────────────────────────────────
  const requiredFields = ['patientName', 'mrn', 'department'];
  const clinicalFields = ['situation', 'background', 'assessment', 'recommendation'];
  const vitalFields = ['temperature', 'heartRate', 'bloodPressure', 'respiratoryRate', 'oxygenSaturation'];

  let requiredFilled = 0;
  for (const f of requiredFields) {
    const val = hd[f] || data[f];
    if (val && String(val).trim()) requiredFilled++;
    else issues.push({ field: f, severity: 'critical', message: `Missing required field: ${f}` });
  }

  let clinicalFilled = 0;
  for (const f of clinicalFields) {
    const val = hd[f] || data[f];
    if (val && String(val).trim().length > 5) clinicalFilled++;
    else if (val && String(val).trim().length > 0) {
      clinicalFilled += 0.5;
      warnings.push({ field: f, severity: 'warning', message: `Field "${f}" is very short — may be incomplete` });
    } else {
      warnings.push({ field: f, severity: 'moderate', message: `Missing ISBAR field: ${f}` });
    }
  }

  let vitalFilled = 0;
  for (const f of vitalFields) {
    const val = hd[f] || (data.vitals && data.vitals[f]);
    if (val !== undefined && val !== null && String(val).trim()) vitalFilled++;
    else warnings.push({ field: f, severity: 'low', message: `Missing vital sign: ${f}` });
  }

  // ── Consistency checks ──────────────────────────────────────────────────
  let consistencyScore = 100;

  // Check if stability contradicts vitals
  const stability = hd.stability || data.stability || 'Stable';
  const temp = parseFloat(hd.temperature || data.vitals?.temperature);
  const hr = parseFloat(hd.heartRate || data.vitals?.heartRate);
  const spo2 = parseFloat(hd.oxygenSaturation || data.vitals?.oxygenSaturation);

  const hasAbnormalVital = (
    (temp && (temp < 35.5 || temp > 38.0)) ||
    (hr && (hr < 50 || hr > 110)) ||
    (spo2 && spo2 < 92)
  );

  if (hasAbnormalVital && stability === 'Stable') {
    issues.push({ field: 'stability', severity: 'high', message: 'Stability marked as "Stable" but abnormal vitals detected — potential inconsistency' });
    consistencyScore -= 25;
  }

  if (!hasAbnormalVital && (stability === 'Unstable' || stability === 'Critical')) {
    warnings.push({ field: 'stability', severity: 'moderate', message: 'Stability marked as unstable/critical but vitals appear within range — verify manually' });
    consistencyScore -= 10;
  }

  // ── Clinical safety checks ──────────────────────────────────────────────
  if (temp && temp > 39.0) {
    issues.push({ field: 'temperature', severity: 'critical', message: `High fever: ${temp}°C — requires immediate attention` });
  }
  if (spo2 && spo2 < 88) {
    issues.push({ field: 'oxygenSaturation', severity: 'critical', message: `Critical SpO2: ${spo2}% — immediate escalation recommended` });
  }
  if (hr && hr > 130) {
    issues.push({ field: 'heartRate', severity: 'high', message: `Severe tachycardia: ${hr} bpm — clinical review needed` });
  }

  // ── Calculate scores ─────────────────────────────────────────────────────
  const completenessScore = Math.round(
    ((requiredFilled / requiredFields.length) * 40) +
    ((clinicalFilled / clinicalFields.length) * 40) +
    ((vitalFilled / vitalFields.length) * 20)
  );

  return {
    valid: issues.filter(i => i.severity === 'critical').length === 0,
    completeness: {
      score: completenessScore,
      requiredFilled: `${requiredFilled}/${requiredFields.length}`,
      clinicalFilled: `${clinicalFilled}/${clinicalFields.length}`,
      vitalFilled: `${vitalFilled}/${vitalFields.length}`,
    },
    consistency: {
      score: Math.max(0, consistencyScore),
    },
    issues,
    warnings,
    summary: issues.length === 0 && warnings.length === 0
      ? 'Data appears complete and consistent'
      : `${issues.length} critical issue(s), ${warnings.length} warning(s) detected`,
  };
}

/**
 * Validate uploaded file data structure.
 */
export function validateFileData(fileData = {}) {
  const issues = [];
  if (!fileData.files || fileData.files.length === 0) {
    issues.push({ severity: 'critical', message: 'No files provided' });
  }
  for (const file of (fileData.files || [])) {
    if (!file.fileName) issues.push({ severity: 'warning', message: 'File missing name' });
    if (file.format === 'binary' && !file.dataUrl) {
      issues.push({ severity: 'critical', message: `Binary file "${file.fileName}" missing data` });
    }
  }
  return { valid: issues.filter(i => i.severity === 'critical').length === 0, issues };
}

/**
 * Lightweight validation for chat messages.
 */
export function validateChatInput(message = '') {
  if (!message || !message.trim()) {
    return { valid: false, error: 'Message cannot be empty' };
  }
  if (message.length > 50000) {
    return { valid: false, error: 'Message too long (max 50,000 characters)' };
  }
  return { valid: true };
}

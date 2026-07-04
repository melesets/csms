// =============================================================================
// |Adare AI AGENT — Data Ingestion & Normalization Layer
// =============================================================================
// Accepts raw input from multiple sources (form data, files, free text,
// database rows) and normalizes into a standard internal structure.
// =============================================================================

/**
 * Normalize handover form data into a standard structure.
 * Handles both structured form submissions and free-text notes.
 *
 * @param {object} raw - Raw input from request body
 * @returns {object} Normalized data envelope
 */
export function ingestHandoverData(raw = {}) {
  const ctx = {
    // ── Source identification ─────────────────────────────────────────────
    source: raw.source || 'unknown',        // 'form', 'upload', 'text', 'database'
    role: normalizeRole(raw.role || raw.requesterRole || raw.context?.requesterRole),
    department: raw.department || raw.context?.department || null,
    timestamp: raw.timestamp || new Date().toISOString(),

    // ── Patient identifiers ───────────────────────────────────────────────
    patientName: raw.patientName || raw.context?.patientName || null,
    mrn: raw.mrn || raw.context?.mrn || null,
    age: raw.age || raw.context?.age || null,
    bedNumber: raw.bedNumber || raw.context?.bedNumber || null,
    gender: raw.gender || raw.context?.gender || null,
    stability: raw.stability || raw.context?.stability || 'Stable',

    // ── Clinical data ─────────────────────────────────────────────────────
    vitals: extractVitals(raw),
    diagnosis: raw.diagnosis || raw.context?.diagnosis || null,
    allergies: raw.allergies || raw.context?.allergies || null,
    treatment: raw.treatment || raw.context?.treatment || null,

    // ── Form/handover data (flexible) ─────────────────────────────────────
    handoverData: raw.handoverData || raw.formData || raw.context || {},
    formType: raw.formType || raw.templateName || raw.context?.templateName || null,

    // ── ISBAR fields ──────────────────────────────────────────────────────
    situation: raw.situation || raw.context?.situation || null,
    background: raw.background || raw.context?.background || null,
    assessment: raw.assessment || raw.context?.assessment || null,
    recommendation: raw.recommendation || raw.context?.recommendation || null,

    // ── Attachments ───────────────────────────────────────────────────────
    attachments: raw.attachments || raw.context?.attachments || [],

    // ── Free text ─────────────────────────────────────────────────────────
    message: raw.message || raw.context?.message || null,
    freeText: raw.freeText || raw.rawText || null,

    // ── Chat context ──────────────────────────────────────────────────────
    chatHistory: raw.history || [],
    screenTitle: raw.screenTitle || raw.context?.screenTitle || null,
    screenFields: raw.screenFields || raw.context?.screenFields || null,
    screenData: raw.screenData || raw.context?.screenData || null,

    // ── Database context (filled later by pipeline) ───────────────────────
    systemHistory: null,
    databaseContext: null,

    // ── Template fields for form generation ──────────────────────────────
    templateFields: raw.templateFields || raw.context?.templateFields || null,
    templateName: raw.templateName || raw.context?.templateName || null,
  };

  // Merge any extra keys from context that weren't explicitly mapped
  const contextObj = raw.context || {};
  for (const key of Object.keys(contextObj)) {
    if (ctx[key] === undefined || ctx[key] === null) {
      ctx[key] = contextObj[key];
    }
  }

  return ctx;
}

/**
 * Ingest uploaded file data (CSV, Excel, JSON, text).
 * For now, expects pre-parsed JSON from the frontend.
 * Can be extended with file parsing libraries later.
 */
export function ingestFileData(raw = {}) {
  const files = raw.files || [];
  const parsed = [];

  for (const file of files) {
    if (file.kind === 'text' && file.text) {
      try {
        // Try parsing as JSON
        const json = JSON.parse(file.text);
        parsed.push({ source: 'file', fileName: file.name, mimeType: file.mimeType, data: json, format: 'json' });
      } catch {
        // Treat as plain text
        parsed.push({ source: 'file', fileName: file.name, mimeType: file.mimeType, data: file.text, format: 'text' });
      }
    } else if (file.kind === 'file' || file.kind === 'image') {
      parsed.push({ source: 'file', fileName: file.name, mimeType: file.mimeType, dataUrl: file.dataUrl, format: 'binary' });
    }
  }

  return { files: parsed, fileCount: parsed.length };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeRole(role) {
  if (!role) return null;
  const r = String(role).toLowerCase();
  if (r.includes('physician') || r.includes('doctor')) return 'physician';
  if (r.includes('nurse')) return 'nurse';
  if (r.includes('midwife')) return 'midwife';
  if (r.includes('admin')) return 'admin';
  if (r.includes('staff')) return 'staff';
  return role;
}

function extractVitals(raw) {
  const ctx = raw.context || raw;
  const vitals = {};
  const vitalKeys = ['temperature', 'heartRate', 'bloodPressure', 'respiratoryRate', 'oxygenSaturation',
                     'temp', 'hr', 'bp', 'rr', 'spo2', 'pulse'];
  for (const key of vitalKeys) {
    if (ctx[key] !== undefined && ctx[key] !== null && ctx[key] !== '') {
      vitals[key] = ctx[key];
    }
  }
  return Object.keys(vitals).length > 0 ? vitals : null;
}

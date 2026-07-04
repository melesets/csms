// =============================================================================
// |Adare — CrewAI Bridge
// =============================================================================
// Forwards requests to the Python CrewAI microservice when available.
// Falls back to the local Node.js agent pipeline when the service is down.
// =============================================================================

const CREWAI_URL = process.env.CREWAI_URL || 'http://localhost:8000';

/**
 * Check if the CrewAI service is reachable.
 */
export async function isCrewAIOnline() {
  try {
    const res = await fetch(`${CREWAI_URL}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Call a CrewAI endpoint. Returns { ok, data } or { ok: false, error }.
 */
async function crewCall(path, body = {}) {
  try {
    const res = await fetch(`${CREWAI_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000), // agents can take time
    });
    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: err, status: res.status };
    }
    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ── Specific crew calls ─────────────────────────────────────────────────────

export async function crewHandoverAnalyze(handoverData) {
  return crewCall('/handover/analyze', { handover_data: handoverData });
}

export async function crewHandoverSummarize(handoverData) {
  return crewCall('/handover/summarize', { handover_data: handoverData });
}

export async function crewClinicalRisk(handoverData) {
  return crewCall('/clinical/risk', { handover_data: handoverData });
}

export async function crewReportDepartment(department = 'all') {
  return crewCall('/reports/department', { department });
}

export async function crewReportResource() {
  return crewCall('/reports/resource');
}

export async function crewReportAudit() {
  return crewCall('/reports/audit');
}

export async function crewChat(message) {
  return crewCall('/chat', { message });
}

export async function crewDBQuery(sql) {
  return crewCall('/db/query', { sql });
}

export async function crewKickoff(crew, params = {}) {
  return crewCall('/kickoff', { crew, params });
}

export { CREWAI_URL };

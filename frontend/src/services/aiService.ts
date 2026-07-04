// AI client service - handles AI API calls with offline fallback

export type AIRequestType =
  | 'isbar-situation'
  | 'isbar-background'
  | 'isbar-assessment'
  | 'isbar-recommendation'
  | 'vitals-analysis'
  | 'dashboard-insight'
  | 'shift-insights'
  | 'chat';

export interface AIResponse {
  text: string;
  isAIGenerated: boolean;
  isOnline: boolean;
  provider?: string; // e.g. "Gemini Flash", "GPT-4o Mini"
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  isAIGenerated: boolean;
  timestamp: Date;
  provider?: string;
}

// ── New ISBAR-specific response types ─────────────────────────────────────────
export interface ISBARSummary {
  summary: string;
  completeness: number;
  missingFields: string[];
  keyAlerts: string[];
  _provider?: string;
}

export interface ISBARRiskScore {
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  riskScore: number;
  escalateNow: boolean;
  alerts: string[];
  rationale: string;
  _provider?: string;
}

export interface ISBARFullAnalysis extends ISBARSummary, ISBARRiskScore {}

// ── Connectivity state ────────────────────────────────────────────────────────
let _online = navigator.onLine;

export function isOnline(): boolean { return _online; }

export function initConnectivityMonitor(onChange: (online: boolean) => void): () => void {
  const check = async () => {
    if (!navigator.onLine) {
      if (_online !== false) { _online = false; onChange(false); }
      return;
    }
    try {
      const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
      const next = res.ok;
      if (_online !== next) { _online = next; onChange(next); }
    } catch {
      if (_online !== false) { _online = false; onChange(false); }
    }
  };

  window.addEventListener('online', check);
  window.addEventListener('offline', check);
  check();

  return () => {
    window.removeEventListener('online', check);
    window.removeEventListener('offline', check);
  };
}

// ── Offline rule-based engine ─────────────────────────────────────────────────
const VITALS_RANGES = {
  temperature: { normal: [36.1, 37.2], concern: [35.5, 38.5] },
  heartRate:   { normal: [60, 100],    concern: [50, 120]    },
  rr:          { normal: [12, 20],     concern: [10, 25]     },
  spo2:        { normal: 95,           urgent: 88            },
};

function vitalStatus(value: number, key: keyof typeof VITALS_RANGES): string {
  const r = VITALS_RANGES[key] as any;
  if (key === 'spo2') {
    if (value < r.urgent) return '🔴 Abnormal';
    if (value < r.normal) return '🟡 Borderline';
    return '🟢 Normal';
  }
  if (value < r.concern[0] || value > r.concern[1]) return '🔴 Abnormal';
  if (value < r.normal[0]  || value > r.normal[1])  return '🟡 Borderline';
  return '🟢 Normal';
}

function offlineVitalsAnalysis(ctx: Record<string, any>): string {
  const temp = parseFloat(ctx.temperature);
  const hr   = parseInt(ctx.heartRate);
  const rr   = parseInt(ctx.respiratoryRate);
  const spo2 = parseInt(ctx.oxygenSaturation);

  const ts = temp ? vitalStatus(temp, 'temperature') : '— Not recorded';
  const hs = hr   ? vitalStatus(hr,   'heartRate')   : '— Not recorded';
  const rs = rr   ? vitalStatus(rr,   'rr')          : '— Not recorded';
  const ss = spo2 ? vitalStatus(spo2, 'spo2')        : '— Not recorded';

  const flags   = [ts, hs, rs, ss];
  const urgency = flags.some(f => f.startsWith('🔴'))
    ? '🔴 ESCALATE — Abnormal values detected. Notify senior clinician immediately.'
    : flags.some(f => f.startsWith('🟡'))
    ? '🟡 MONITOR CLOSELY — Borderline values present. Increase observation frequency.'
    : '🟢 ROUTINE — All values within normal range. Continue standard monitoring.';

  return (
    `🌡 Temperature (${ctx.temperature || '—'}°C): ${ts}\n` +
    `❤️ Heart Rate (${ctx.heartRate || '—'} bpm): ${hs}\n` +
    `🫁 Respiratory Rate (${ctx.respiratoryRate || '—'}/min): ${rs}\n` +
    `🩺 SpO2 (${ctx.oxygenSaturation || '—'}%): ${ss}\n` +
    `🩸 Blood Pressure: ${ctx.bloodPressure || 'Not recorded'}\n\n` +
    `Overall: ${urgency}\n\n` +
    `⚠️ Offline analysis — Always verify with clinical judgment.`
  );
}

function offlineISBARSuggest(type: AIRequestType, ctx: Record<string, any>): string {
  const name = ctx.patientName || 'the patient';
  const age  = ctx.age ? `${ctx.age}-year-old` : '';
  const bed  = ctx.bedNumber  || '—';
  const mrn  = ctx.mrn        || '—';
  const dept = ctx.department || 'the unit';
  const stab = ctx.stability  || 'Stable';

  switch (type) {
    case 'isbar-situation':
      return `Patient ${name}${age ? `, a ${age},` : ''} admitted to Bed ${bed} (MRN: ${mrn}) in ${dept}, is currently ${stab.toLowerCase()}. The clinical team is being notified for handover.\n\n⚠️ Offline template — Edit to reflect the actual clinical situation.`;
    case 'isbar-background':
      return `${name} is admitted under ${dept}. Relevant medical history, current diagnosis, medications, allergies, and recent procedures should be documented here by the reporting nurse.\n\n⚠️ Offline template — Edit to reflect actual patient history.`;
    case 'isbar-assessment':
      return `Current clinical assessment of ${name} indicates a ${stab.toLowerCase()} status. Vital signs have been recorded and reviewed. Document specific clinical findings, concerns, and objective data here.\n\n⚠️ Offline template — Edit to reflect actual clinical assessment.`;
    case 'isbar-recommendation': {
      const actions = stab === 'Critical'
        ? '1. Immediate escalation to senior clinician required.\n2. Continuous monitoring (q15 min).\n3. Initiate emergency protocol as appropriate.'
        : stab === 'Unstable'
        ? '1. Notify attending physician or senior nurse.\n2. Hourly vital sign monitoring.\n3. Review and update medication orders.'
        : '1. Continue routine monitoring as per care plan.\n2. Reassess in 4 hours or sooner if condition changes.\n3. Notify shift leader if deterioration occurs.';
      return `${actions}\n\n⚠️ Offline template — Edit to reflect actual clinical recommendations.`;
    }
    default:
      return '⚠️ Offline mode — Please complete this section based on your clinical assessment.';
  }
}

const OFFLINE_CHAT_KB: [string[], string][] = [
  [['isbar'], 'ISBAR stands for:\n• **I**dentify — who you are and the patient\n• **S**ituation — what is happening right now\n• **B**ackground — relevant patient history\n• **A**ssessment — your clinical judgment\n• **R**ecommendation — what action you need\n\nIt is the standard structured communication tool for clinical handovers.'],
  [['situation'], 'The **Situation** section describes the immediate clinical problem. Include: what is happening now, why you are concerned, and the urgency level. Keep it to 2–3 concise sentences.'],
  [['background'], 'The **Background** section covers relevant history: diagnosis, current medications, allergies, recent procedures, and any factors relevant to the current situation.'],
  [['assessment'], 'The **Assessment** section is your professional clinical judgment — what you think is wrong and why, supported by your observations and vital signs.'],
  [['recommendation'], 'The **Recommendation** section states the specific action you are requesting: a test, medication, escalation to a doctor, or increased monitoring frequency.'],
  [['vital', 'vitals'], 'Normal adult vital sign ranges:\n• Temperature: 36.1–37.2 °C\n• Heart Rate: 60–100 bpm\n• Blood Pressure: 90–140 / 60–90 mmHg\n• Respiratory Rate: 12–20 /min\n• SpO2: ≥95%'],
  [['escalate', 'critical', 'emergency'], 'For critical patients: immediately escalate to a senior clinician, document all findings, initiate the appropriate emergency protocol, and ensure continuous monitoring until care is transferred.'],
  [['handover'], 'A good handover should be clear, structured (use ISBAR), and completed face-to-face when possible. Allow time for the receiving nurse to ask questions before the handover ends.'],
];

function offlineChat(message: string): string {
  const lower = message.toLowerCase();
  for (const [keywords, response] of OFFLINE_CHAT_KB) {
    if (keywords.some(k => lower.includes(k))) {
      return response + '\n\n*📴 Offline mode — Reconnect for full AI assistance.*';
    }
  }
  return '📴 You\'re offline. I can answer basic questions about ISBAR, vital signs, handovers, situation, background, assessment, or recommendations. Try asking about any of those topics.';
}

function offlineGenerateForm(ctx: Record<string, any>): Record<string, string> {
  const generated: Record<string, string> = {};
  (ctx.templateFields || []).forEach((f: any) => {
    const fname = String(f.name).toLowerCase();
    const ftype = String(f.type).toLowerCase();
    if (fname.includes('situation'))       generated[f.name] = offlineISBARSuggest('isbar-situation', ctx);
    else if (fname.includes('background')) generated[f.name] = offlineISBARSuggest('isbar-background', ctx);
    else if (fname.includes('assessment')) generated[f.name] = offlineISBARSuggest('isbar-assessment', ctx);
    else if (fname.includes('recommendation')) generated[f.name] = offlineISBARSuggest('isbar-recommendation', ctx);
    else if (fname.includes('vital'))      generated[f.name] = offlineVitalsAnalysis(ctx);
    else if (ftype === 'text' || ftype === 'textarea')
      generated[f.name] = `⚠️ Offline Mode: Please complete the '${f.label || f.name}' field based on your clinical assessment.`;
    else generated[f.name] = '';
  });
  return generated;
}

// ── Core ask function ─────────────────────────────────────────────────────────
export async function askAI(
  type: AIRequestType,
  context: Record<string, any>,
  history: ChatMessage[] = [],
): Promise<AIResponse> {
  if (!_online) {
    return {
      text: type === 'chat' ? offlineChat(context.message ?? '')
          : type === 'vitals-analysis' ? offlineVitalsAnalysis(context)
          : offlineISBARSuggest(type, context),
      isAIGenerated: false,
      isOnline: false,
    };
  }

  try {
    const actualType = type === 'shift-insights' ? 'dashboard-insight' : type;
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: actualType, context, history: history.map(m => ({ role: m.role, text: m.text })) }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.offline) throw new Error('AI offline flag');

    return { text: data.text, isAIGenerated: true, isOnline: true, provider: data.provider };
  } catch {
    _online = false;
    return {
      text: type === 'chat' ? offlineChat(context.message ?? '')
          : type === 'vitals-analysis' ? offlineVitalsAnalysis(context)
          : offlineISBARSuggest(type, context),
      isAIGenerated: false,
      isOnline: false,
    };
  }
}

// ── Streaming function ────────────────────────────────────────────────────────
export async function askAIStream(
  type: AIRequestType,
  context: Record<string, any>,
  history: ChatMessage[] = [],
  onChunk: (text: string, provider?: string) => void,
): Promise<void> {
  if (!_online) {
    const offlineRes = await askAI(type, context, history);
    onChunk(offlineRes.text);
    return;
  }

  try {
    const actualType = type === 'shift-insights' ? 'dashboard-insight' : type;
    const res = await fetch('/api/ai/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: actualType, context, history: history.map(m => ({ role: m.role, text: m.text })) }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!res.body) throw new Error('ReadableStream not supported');

    const reader  = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText  = '';
    let provider  = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.replace(/^data: /, '');
          if (dataStr === '[DONE]') break;
          try {
            const obj = JSON.parse(dataStr);
            if (obj.text) {
              fullText += obj.text;
              provider  = obj.provider || provider;
              onChunk(fullText, provider);
            }
          } catch { /* ignore */ }
        }
      }
    }
  } catch (err) {
    console.error('Stream error:', err);
    _online = false;
    const offlineRes = await askAI(type, context, history);
    onChunk(offlineRes.text);
  }
}

// ── Generate Full ISBAR (JSON mode) ──────────────────────────────────────────
export interface ISBARStructure {
  situation?: string;
  background?: string;
  assessment?: string;
  recommendation?: string;
}

export async function generateISBAR(context: Record<string, any>): Promise<Record<string, string> | null> {
  if (!_online) return offlineGenerateForm(context);

  try {
    const res = await fetch('/api/ai/generate-form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      if (errData.offline || res.status === 503) throw new Error('AI offline flag');
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    if (data.offline) throw new Error('AI offline flag');
    if (!data || Object.keys(data).length === 0) return offlineGenerateForm(context);

    return data as Record<string, string>;
  } catch {
    _online = false;
    return offlineGenerateForm(context);
  }
}

// ── New ISBAR-specific endpoints ──────────────────────────────────────────────

/** Convert raw clinical text → structured ISBAR JSON */
export async function generateReport(
  rawText: string,
  partialFields?: Record<string, any>,
): Promise<Record<string, any> | null> {
  if (!_online) return null; // no offline equivalent for free-text parsing

  try {
    const res = await fetch('/api/ai/generate-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText, partialFields }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('generateReport error:', err);
    return null;
  }
}

/** Summarize ISBAR data → summary + completeness */
export async function summarizeISBAR(isbarData: Record<string, any>): Promise<ISBARSummary | null> {
  if (!_online) {
    // Offline fallback: basic completeness check
    const key  = ['situation', 'background', 'assessment', 'recommendation'];
    const missing = key.filter(f => !isbarData[f]);
    return {
      summary: `Handover for ${isbarData.patientName || 'patient'} in ${isbarData.department || 'unit'}. Offline summary — reconnect for AI analysis.`,
      completeness: Math.round(((key.length - missing.length) / key.length) * 100),
      missingFields: missing,
      keyAlerts: [],
    };
  }

  try {
    const res = await fetch('/api/ai/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isbarData }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('summarizeISBAR error:', err);
    return null;
  }
}

/** Assess clinical risk → risk level + alerts */
export async function scoreRisk(isbarData: Record<string, any>): Promise<ISBARRiskScore | null> {
  if (!_online) {
    const stab = isbarData.stability || 'Stable';
    return {
      riskLevel: stab === 'Critical' ? 'Critical' : stab === 'Unstable' ? 'High' : 'Low',
      riskScore: stab === 'Critical' ? 9 : stab === 'Unstable' ? 7 : 2,
      escalateNow: stab === 'Critical',
      alerts: stab !== 'Stable' ? [`Patient marked as ${stab}`] : [],
      rationale: `Offline assessment based on stability field only.`,
    };
  }

  try {
    const res = await fetch('/api/ai/risk-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isbarData }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('scoreRisk error:', err);
    return null;
  }
}

/** Get field-by-field improvement suggestions */
export async function getSuggestions(
  isbarData: Record<string, any>,
  freeText?: string,
): Promise<Record<string, string> | null> {
  if (!_online) return null;

  try {
    const res = await fetch('/api/ai/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isbarData, freeText }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('getSuggestions error:', err);
    return null;
  }
}

/** Full parallel analysis: summary + risk in one request */
export async function fullAnalysis(isbarData: Record<string, any>): Promise<ISBARFullAnalysis | null> {
  if (!_online) {
    const summary = await summarizeISBAR(isbarData);
    const risk    = await scoreRisk(isbarData);
    if (!summary || !risk) return null;
    return { ...summary, ...risk };
  }

  try {
    const res = await fetch('/api/ai/full-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isbarData }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('fullAnalysis error:', err);
    return null;
  }
}

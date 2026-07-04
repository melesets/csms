// =============================================================================
// |Adare AI AGENT — Prompt Templates
// =============================================================================
// Extensible prompt template registry. Each template is a function that
// returns a formatted prompt string. New workflows can be added by simply
// adding a new entry — no core logic changes needed.
// =============================================================================

/**
 * Template registry — key = template ID, value = function(ctx) => string
 * ctx = arbitrary context object with whatever fields the template needs.
 */
const TEMPLATES = {

  // ── HANDOVER TEMPLATES ──────────────────────────────────────────────────────

  'handover-summarize': (ctx) => {
    const role = ctx.role || 'clinician';
    const data = ctx.handoverData || ctx.formData || {};
    const fields = Object.entries(data)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `  - ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join('\n');

    return `You are analyzing a patient handover for a ${role} at Adare General Hospital.

=== HANDOVER DATA ===
${fields || '  [No data provided]'}

${ctx.databaseContext ? `=== HOSPITAL DATABASE CONTEXT ===\n${ctx.databaseContext}\n` : ''}
${ctx.systemHistory ? `=== PATIENT HISTORY ===\n${ctx.systemHistory}\n` : ''}

=== YOUR TASK ===
Generate a structured handover summary with these sections:

1. **PATIENT STATUS** — Current condition, stability, key diagnoses
2. **CRITICAL ALERTS** — Abnormal findings, deteriorating trends, urgent actions (use 🔴 CRITICAL / 🟠 HIGH / 🟡 MODERATE / 🟢 NORMAL severity)
3. **PENDING ACTIONS** — Tasks not yet completed, medications due, follow-ups needed
4. **RISK FLAGS** — Missing data, incomplete documentation, conflicting information
5. **RECOMMENDATIONS** — Specific actionable items for the next shift

Be precise. Reference actual values from the data. Flag any missing or inconsistent fields.
End with: "⚠️ Clinical verification required. Final judgment rests with the responsible clinician."`;
  },

  'handover-analyze': (ctx) => {
    const data = ctx.handoverData || ctx.formData || {};
    const fields = Object.entries(data)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `  - ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join('\n');

    return `Analyze this handover data for completeness, consistency, and clinical risk at Adare General Hospital.

=== HANDOVER DATA ===
${fields || '  [No data provided]'}

${ctx.databaseContext ? `=== HOSPITAL DATABASE CONTEXT ===\n${ctx.databaseContext}\n` : ''}
${ctx.systemHistory ? `=== PATIENT HISTORY ===\n${ctx.systemHistory}\n` : ''}

=== ANALYSIS REQUIRED ===
Return a JSON object with this structure:
{
  "completeness": { "score": 0-100, "missingFields": ["..."], "weakFields": ["..."] },
  "consistency": { "score": 0-100, "conflicts": ["..."], "unverifiedClaims": ["..."] },
  "clinicalRisk": { "level": "Low|Medium|High|Critical", "riskScore": 1-10, "escalateNow": true/false, "alerts": ["..."] },
  "dataQuality": { "score": 0-100, "issues": ["..."] },
  "recommendations": ["specific actionable improvements"],
  "summary": "2-3 sentence executive summary"
}

Be thorough. Every missing field matters for patient safety.`;
  },

  // ── REPORT TEMPLATES ────────────────────────────────────────────────────────

  'report-department': (ctx) => {
    const dept = ctx.department || 'all';
    return `Generate a department performance report for Adare General Hospital.

Department: ${dept}

${ctx.databaseContext ? `=== HOSPITAL DATABASE CONTEXT ===\n${ctx.databaseContext}\n` : ''}

=== REPORT SECTIONS ===
1. **OVERVIEW** — Department summary, staff count, patient volume
2. **WORKLOAD ANALYSIS** — Shift coverage, patient-to-staff ratio, bottlenecks
3. **RESOURCE STATUS** — Equipment, supplies, shortages, expiring items
4. **CLINICAL METRICS** — Handover completeness scores, audit findings, trends
5. **QUALITY INDICATORS** — Compliance rates, incident flags, improvement areas
6. **RECOMMENDATIONS** — Prioritized action items

Use actual data from the database context. If data is missing for a section, state "Data not available" and recommend what should be tracked.
Format as a clean, professional report.`;
  },

  'report-resource': (ctx) => {
    return `Generate a resource handover summary for Adare General Hospital.

${ctx.databaseContext ? `=== HOSPITAL DATABASE CONTEXT ===\n${ctx.databaseContext}\n` : ''}

=== REPORT SECTIONS ===
1. **INVENTORY STATUS** — Current stock levels by department, items below standard quantity
2. **EXPIRING ITEMS** — Resources approaching expiry date
3. **SHORTAGE ALERTS** — Items where quantity < standard_quantity
4. **SHIFT HANDOVER NOTES** — Resource status changes from recent inventory reports
5. **RECOMMENDATIONS** — Reorder priorities, equipment maintenance needs

Use actual data from the database context. Flag any critical shortages with 🔴.`;
  },

  'report-audit': (ctx) => {
    return `Generate a clinical audit report for Adare General Hospital.

${ctx.databaseContext ? `=== HOSPITAL DATABASE CONTEXT ===\n${ctx.databaseContext}\n` : ''}
${ctx.auditData ? `=== AUDIT DATA ===\n${JSON.stringify(ctx.auditData, null, 2)}\n` : ''}

=== REPORT SECTIONS ===
1. **COMPLIANCE SCORE** — Overall and per-department compliance rates
2. **HANDOVER QUALITY** — Completeness, consistency, timeliness scores
3. **FINDINGS** — Non-conformities, patterns, recurring issues
4. **TRENDS** — Comparison with previous periods (improving/declining/stable)
5. **ACTION PLAN** — Specific corrective actions with owners and deadlines

Format as a structured audit report suitable for quality committee review.`;
  },

  // ── CLINICAL TEMPLATES ─────────────────────────────────────────────────────

  'clinical-risk': (ctx) => {
    const data = ctx.handoverData || ctx.formData || {};
    const fields = Object.entries(data)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `  - ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join('\n');

    return `Perform a clinical risk assessment for this patient at Adare General Hospital.

=== PATIENT DATA ===
${fields || '  [No data provided]'}

${ctx.systemHistory ? `=== PATIENT HISTORY ===\n${ctx.systemHistory}\n` : ''}

VITAL SIGN BENCHMARKS (Adult):
- Temp: 36.1–37.2°C (Abnormal: <35.5 or >38.0)
- Heart Rate: 60–100 bpm (Abnormal: <50 or >110)
- BP: 90-140/60-90 mmHg (Flag if SBP <90 or >160)
- RR: 12–20/min (Urgent: >24 or <10)
- SpO2: ≥95% (Concerning: <92%, Urgent: <88%)

Return JSON:
{
  "riskLevel": "Low|Medium|High|Critical",
  "riskScore": 1-10,
  "escalateNow": true/false,
  "abnormalVitals": ["..."],
  "trends": "Improving|Worsening|Stable|Unknown",
  "alerts": ["specific clinical concerns"],
  "immediateActions": ["..."],
  "rationale": "brief clinical rationale"
}`;
  },

  // ── CHAT (GENERAL) ─────────────────────────────────────────────────────────

  'chat': (ctx) => {
    const msg = ctx.message || 'How can I help?';
    let prompt = '';

    if (ctx.systemHistory) {
      prompt += `[PATIENT HISTORY FROM DATABASE]\n${ctx.systemHistory}\n\n`;
    }
    if (ctx.databaseContext) {
      prompt += `[LIVE DATABASE QUERY RESULTS]\n${ctx.databaseContext}\n\n`;
    }
    if (ctx.screenTitle) {
      prompt += `[CURRENT SCREEN: ${ctx.screenTitle}]\n`;
      if (ctx.screenFields && ctx.screenFields.length > 0) {
        prompt += `Available Fields:\n`;
        ctx.screenFields.forEach(f => {
          const val = ctx.screenData?.[f.name];
          prompt += `- ${f.label} (${f.name}): ${val !== undefined && val !== '' ? val : '[empty]'}\n`;
        });
      }
      prompt += `\n`;
    }

    prompt += `[USER QUESTION]\n${msg}`;
    return prompt;
  },

  // ── ISBAR SECTION TEMPLATES (kept for backward compatibility) ──────────────

  'isbar-situation': (ctx) => {
    const name = ctx.patientName || 'the patient';
    const age  = ctx.age || '—';
    const bed  = ctx.bedNumber || '—';
    const mrn  = ctx.mrn || '—';
    const dept = ctx.department || 'the unit';
    const stab = ctx.stability || 'Stable';
    const hist = ctx.systemHistory ? `\n[DATABASE HISTORICAL RECORDS]\n${ctx.systemHistory}\n` : '';
    return `${hist}Write a professional ISBAR Situation section for Adare General Hospital.\nPatient: ${name}, age ${age}, Bed ${bed}, MRN ${mrn}, ${dept}, stability: ${stab}.\nExisting note: "${ctx.situation || '(empty)'}"\nWrite 2–3 concise sentences. End with: "\n\n⚠️ AI Suggestion — Review and verify before use."`;
  },

  'isbar-background': (ctx) => {
    const name = ctx.patientName || 'the patient';
    const age  = ctx.age || '—';
    const dept = ctx.department || 'the unit';
    const hist = ctx.systemHistory ? `\n[DATABASE HISTORICAL RECORDS]\n${ctx.systemHistory}\n` : '';
    return `${hist}Write a professional ISBAR Background section for Adare General Hospital.\nPatient: ${name}, age ${age}, ${dept}.\nExisting: "${ctx.background || '(empty)'}"\nSituation: "${ctx.situation || '(empty)'}"\nWrite 2–3 sentences on history, diagnosis, treatment. End with: "\n\n⚠️ AI Suggestion — Review and verify before use."`;
  },

  'isbar-assessment': (ctx) => {
    const stab = ctx.stability || 'Stable';
    const hist = ctx.systemHistory ? `\n[DATABASE HISTORICAL RECORDS]\n${ctx.systemHistory}\n` : '';
    return `${hist}Write a professional ISBAR Assessment section for Adare General Hospital.\nVitals: Temp ${ctx.temperature}°C | HR ${ctx.heartRate}bpm | BP ${ctx.bloodPressure} | RR ${ctx.respiratoryRate}/min | SpO2 ${ctx.oxygenSaturation}% | ${stab}\nSituation: "${ctx.situation || '(empty)'}"\nBackground: "${ctx.background || '(empty)'}"\nWrite 2–3 sentences integrating vitals with clinical picture. Flag abnormals. End with: "\n\n⚠️ AI Suggestion — Review and verify before use."`;
  },

  'isbar-recommendation': (ctx) => {
    const stab = ctx.stability || 'Stable';
    const hist = ctx.systemHistory ? `\n[DATABASE HISTORICAL RECORDS]\n${ctx.systemHistory}\n` : '';
    return `${hist}Write a professional ISBAR Recommendation section for Adare General Hospital.\nStability: ${stab}. Assessment: "${ctx.assessment || '(empty)'}"\nWrite 2–4 specific, prioritised clinical actions. End with: "\n\n⚠️ AI Suggestion — Review and verify before use."`;
  },

  'nursing-summary': (ctx) => {
    const name = ctx.patientName || 'the patient';
    const age  = ctx.age || '—';
    const bed  = ctx.bedNumber || '—';
    const mrn  = ctx.mrn || '—';
    const dept = ctx.department || 'the unit';
    const stab = ctx.stability || 'Stable';
    const hist = ctx.systemHistory ? `\n\n=== PREVIOUS PATIENT RECORDS ===\n${ctx.systemHistory}\n=== END OF HISTORICAL RECORDS ===\n` : '\n\n[No previous records found.]\n';
    const requesterRole = ctx.requesterRole || 'Clinician';

    const filledFields = Object.entries(ctx)
      .filter(([key, val]) => val !== null && val !== undefined && val !== '' && !['templateFields', 'systemHistory', 'message', 'chatHistory', 'databaseContext'].includes(key))
      .map(([key, val]) => `  - ${key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim()}: ${typeof val === 'object' ? JSON.stringify(val) : String(val)}`)
      .join('\n');

    return `You are an expert clinical ${requesterRole} at Adare General Hospital.

=== PATIENT FORM DATA ===
Patient Name: ${name} | Age: ${age} | MRN: ${mrn} | Bed: ${bed} | Dept: ${dept} | Stability: ${stab}

All Recorded Fields:
${filledFields || '  [No fields filled yet]'}
${hist}

=== YOUR TASK ===
Write a COMPREHENSIVE clinical summary including:
1. CURRENT PATIENT CONDITION — overall status, each vital with clinical interpretation
2. CLINICAL TRENDS — compare with previous records if available
3. ${requesterRole.toUpperCase()} INTERVENTIONS & CARE PLAN — immediate actions, monitoring, medications, positioning, fluids, comfort, documentation
4. ALARMS & URGENT ACTIONS — 🔴 CRITICAL / 🟠 HIGH / 🟡 MODERATE / 🟢 NORMAL
5. MISSING INFORMATION — critical gaps and why they matter
6. PATIENT SAFETY SUMMARY — risk level, top 3 priorities, escalation decision

End with: "⚠️ |Adare Agent Analysis — Must be reviewed and countersigned by the responsible clinician."`;
  },

  'vitals-analysis': (ctx) => {
    return `Analyse these vital signs at Adare General Hospital:\nTemp ${ctx.temperature}°C | HR ${ctx.heartRate}bpm | BP ${ctx.bloodPressure} | RR ${ctx.respiratoryRate}/min | SpO2 ${ctx.oxygenSaturation}% | ${ctx.stability || 'Stable'}\nFor each vital: Normal / Borderline / Abnormal. Give overall urgency. Under 120 words. End with "\n\n⚠️ Clinical verification required."`;
  },

  'generate-full-isbar': (ctx) => {
    const formTitle = ctx.templateName || 'Clinical Record';
    const fields = Array.isArray(ctx.templateFields)
      ? ctx.templateFields.map(f => `- "${f.name}" (label: ${f.label}, type: ${f.type})`).join('\n')
      : '- "situation"\n- "background"\n- "assessment"\n- "recommendation"';
    const hist = ctx.systemHistory ? `\n[DATABASE HISTORICAL RECORDS]\n${ctx.systemHistory}\n` : '';
    return `Auto-fill the clinical form titled "${formTitle}" for Adare General Hospital.\n[PATIENT] Name: ${ctx.patientName || 'the patient'} | Age: ${ctx.age || '—'} | MRN: ${ctx.mrn || '—'} | Bed: ${ctx.bedNumber || '—'} | Dept: ${ctx.department || '—'} | Stability: ${ctx.stability || 'Stable'}\n[VITALS] Temp: ${ctx.temperature}°C | HR: ${ctx.heartRate}bpm | BP: ${ctx.bloodPressure} | RR: ${ctx.respiratoryRate}/min | SpO2: ${ctx.oxygenSaturation}%\n${hist}\n[FIELDS TO FILL]\n${fields}\nInstructions: Match keys EXACTLY to field names. Return ONLY valid JSON.`;
  },

  'dashboard-insight': (ctx) => {
    return `Hospital shift data at Adare General Hospital:\n${JSON.stringify(ctx, null, 2)}\nGive 2–3 bullet-point insights on workload, risk, or trends. Under 80 words. End with "\n\n— |Adare Shift Summary"`;
  },
};

/**
 * Get a prompt template by ID.
 * Falls back to 'chat' if template not found.
 */
export function getTemplate(id, ctx = {}) {
  const fn = TEMPLATES[id] || TEMPLATES['chat'];
  return fn(ctx);
}

/**
 * List all available template IDs.
 */
export function listTemplates() {
  return Object.keys(TEMPLATES);
}

/**
 * Register a new template at runtime (for extensibility).
 */
export function registerTemplate(id, fn) {
  if (typeof fn !== 'function') throw new Error('Template must be a function(ctx) => string');
  TEMPLATES[id] = fn;
}

export default TEMPLATES;

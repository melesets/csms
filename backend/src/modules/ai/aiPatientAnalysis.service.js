// AI Patient Analysis Service - Groq Llama 3.1 powered patient status summarization
// Extracts MRN/name from form_data JSONB, calls LLM for analysis, stores results.
import pool from '../../config/database.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env'), override: true });

const GROQ_BASE = 'https://api.groq.com/openai/v1';

async function callLLM(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const url = `${GROQ_BASE}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

function extractField(fd, candidates) {
  if (!fd || typeof fd !== 'object') return null;
  for (const c of candidates) {
    if (fd[c] != null && fd[c] !== '') return String(fd[c]);
  }
  // Case-insensitive fallback
  const lower = Object.keys(fd).reduce((m, k) => { m[k.toLowerCase()] = k; return m; }, {});
  for (const c of candidates) {
    const real = lower[c.toLowerCase()];
    if (real && fd[real] != null && fd[real] !== '') return String(fd[real]);
  }
  return null;
}

export function extractPatientInfo(submission) {
  const fd = submission.form_data || {};
  const mrn = extractField(fd, ['MRN', 'mrn', 'Mrn', 'patient_mrn', 'patientMrn']);
  const name = extractField(fd, ['patientName', 'Patient Name', 'patient_name', 'Name', 'name']);
  const bed = extractField(fd, ['BN', 'bedNumber', 'Bed Number', 'bed_number', 'Bed', 'bed']);
  const age = extractField(fd, ['age', 'Age']);
  const gender = extractField(fd, ['gender', 'Gender', 'sex', 'Sex']);
  const diagnosis = extractField(fd, ['Diagnosis', 'diagnosis', 'situation', 'Situation', 'background', 'Background']);
  const stability = extractField(fd, ['stability', 'Stability', 'Patient Stability', 'POOR', 'status', 'Status']);

  return { mrn, name, bed, age, gender, diagnosis, stability };
}

export function extractVitals(formData) {
  const vitals = [];
  const patterns = [
    { pattern: /heart\s*rate|pulse|hr/i, type: 'heart_rate', unit: 'bpm' },
    { pattern: /blood\s*pressure|bp|systolic|diastolic/i, type: 'blood_pressure', unit: 'mmHg' },
    { pattern: /temperature|temp/i, type: 'temperature', unit: '°C' },
    { pattern: /respiratory\s*rate|rr|respiration/i, type: 'respiratory_rate', unit: '/min' },
    { pattern: /oxygen\s*saturation|spo2|o2/i, type: 'oxygen_saturation', unit: '%' },
    { pattern: /pain/i, type: 'pain_level', unit: '/10' },
    { pattern: /weight|wt/i, type: 'weight', unit: 'kg' },
    { pattern: /glucose|blood\s*sugar|bs/i, type: 'glucose', unit: 'mg/dL' },
    { pattern: /gcs|glasgow/i, type: 'gcs', unit: '/15' },
  ];

  if (!formData || typeof formData !== 'object') return vitals;

  for (const [key, value] of Object.entries(formData)) {
    if (value == null || value === '') continue;
    const strVal = String(value);
    const numVal = parseFloat(strVal.replace(/[^\d.]/g, ''));
    for (const vp of patterns) {
      if (vp.pattern.test(key)) {
        vitals.push({
          type: vp.type,
          value: isNaN(numVal) ? strVal : numVal,
          unit: vp.unit,
          key,
        });
        break;
      }
    }
  }
  return vitals;
}

export async function analyzePatientStatus(patients) {
  if (!patients || patients.length === 0) {
    return {
      summary: 'No patient data available for analysis.',
      alerts: [],
      trends: [],
      recommendations: [],
      riskStratification: { critical: [], stable: [], improving: [] },
    };
  }

  const patientSummaries = patients.slice(0, 20).map((p, i) => {
    const info = extractPatientInfo(p);
    const fd = p.form_data || {};
    const fields = Object.entries(fd)
      .filter(([k]) => !['id', 'created_at', 'updated_at'].includes(k.toLowerCase()))
      .map(([k, v]) => `    ${k}: ${v}`)
      .join('\n');
    return `Patient ${i + 1}:
  MRN: ${info.mrn || 'N/A'}
  Name: ${info.name || 'Unknown'}
  Bed: ${info.bed || 'N/A'}
  Age: ${info.age || 'N/A'}
  Gender: ${info.gender || 'N/A'}
  Diagnosis: ${info.diagnosis || 'Not specified'}
  Stability: ${info.stability || 'Not assessed'}
  Template: ${p.template_name}
  Department: ${p.template_department || 'N/A'}
  Submitted: ${p.submitted_at}
  Submitted By: ${p.submitted_by_name || 'Unknown'}
  Form Data:
${fields}`;
  }).join('\n\n');

  const prompt = `You are a clinical AI assistant for a hospital handover system (ISBAR). Analyze these patient submissions and return ONLY valid JSON (no markdown, no backticks).

Return this exact structure:
{
  "summary": "2-3 sentence clinical overview of all patients",
  "alerts": [
    {
      "mrn": "patient MRN",
      "patient": "patient name",
      "severity": "critical or warning or info",
      "message": "what is concerning",
      "action": "recommended clinical action"
    }
  ],
  "trends": [
    {
      "mrn": "patient MRN",
      "patient": "patient name",
      "trend": "worsening or improving or stable",
      "details": "description of trend",
      "vitals_affected": ["heart_rate", "temperature"]
    }
  ],
  "recommendations": [
    {
      "priority": "high or medium or low",
      "message": "clinical recommendation",
      "affected_patients": ["MRN1", "MRN2"]
    }
  ],
  "riskStratification": {
    "critical": ["MRN of critical patients"],
    "stable": ["MRN of stable patients"],
    "improving": ["MRN of improving patients"]
  }
}

Patient Submissions:
${patientSummaries}`;

  try {
    const response = await callLLM(prompt);
    // Strip markdown code fences if present
    const cleaned = response.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.error('[AI Analysis] LLM call failed:', err.message);
  }

  return {
    summary: 'AI analysis unavailable. Check GROQ_API_KEY configuration.',
    alerts: [],
    trends: [],
    recommendations: [],
    riskStratification: { critical: [], stable: [], improving: [] },
  };
}

async function storeVitals(mrn, formData, submissionId) {
  const vitals = extractVitals(formData);
  for (const v of vitals) {
    await pool.query(`
      INSERT INTO patient_vitals_history (mrn, vital_type, value_numeric, value_text, unit, submission_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [mrn, v.type, typeof v.value === 'number' ? v.value : null, String(v.value), v.unit, submissionId]);
  }
}

export async function analyzeAndStorePatients(department) {
  let query = `SELECT * FROM form_submissions`;
  const params = [];
  if (department) {
    query += ` WHERE LOWER(template_department) = LOWER($1)`;
    params.push(department);
  }
  query += ` ORDER BY submitted_at DESC LIMIT 50`;

  const result = await pool.query(query, params);
  const patients = result.rows;

  if (patients.length === 0) {
    return {
      analysis: {
        summary: 'No submissions found for the selected department.',
        alerts: [],
        trends: [],
        recommendations: [],
        riskStratification: { critical: [], stable: [], improving: [] },
      },
      patientCount: 0,
    };
  }

  const analysis = await analyzePatientStatus(patients);

  let storedCount = 0;
  for (const p of patients) {
    const info = extractPatientInfo(p);
    if (!info.mrn) continue;

    const name = info.name || 'Unknown';
    const summary = `${p.template_name}: ${info.diagnosis || 'No diagnosis'}`;

    const risk = analysis.riskStratification || {};
    let riskLevel = 'stable';
    const critList = Array.isArray(risk.critical) ? risk.critical : [];
    const improvList = Array.isArray(risk.improving) ? risk.improving : [];
    if (critList.some(r => (typeof r === 'string' ? r : r?.mrn) === info.mrn)) riskLevel = 'critical';
    else if (improvList.some(r => (typeof r === 'string' ? r : r?.mrn) === info.mrn)) riskLevel = 'improving';

    // Find the alert/trend for this patient
    const patientAlert = (analysis.alerts || []).find(a => a.mrn === info.mrn);
    const patientTrend = (analysis.trends || []).find(t => t.mrn === info.mrn);

    const patientAnalysis = {
      summary: analysis.summary,
      alert: patientAlert || null,
      trend: patientTrend || null,
      riskLevel,
    };

    await pool.query(`
      INSERT INTO patient_embeddings (mrn, patient_name, department, summary, analysis, risk_level, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (mrn) DO UPDATE SET
        patient_name = EXCLUDED.patient_name,
        department = EXCLUDED.department,
        summary = EXCLUDED.summary,
        analysis = EXCLUDED.analysis,
        risk_level = EXCLUDED.risk_level,
        updated_at = NOW()
    `, [info.mrn, name, p.template_department || department || '', summary, JSON.stringify(patientAnalysis), riskLevel]);

    // Store vitals for trend tracking
    await storeVitals(info.mrn, p.form_data, p.id);
    storedCount++;
  }

  return { analysis, patientCount: patients.length, storedCount };
}

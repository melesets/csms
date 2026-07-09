// AI Patient Analysis Controller - Real AI-powered insights
import pool from '../../config/database.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import * as aiAnalysis from './aiPatientAnalysis.service.js';

const GROQ_BASE = 'https://api.groq.com/openai/v1';

async function callLLM(systemPrompt, userMessage) {
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
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// AI generates real clinical insights from patient data
export const generateInsights = asyncHandler(async (req, res) => {
  const patients = await pool.query(
    'SELECT * FROM patient_embeddings ORDER BY updated_at DESC LIMIT 30'
  );

  if (patients.rows.length === 0) {
    return res.json({ insights: [], summary: 'No patient data available for analysis.' });
  }

  const patientData = patients.rows.map(p => {
    const analysis = p.analysis || {};
    return `Patient: ${p.patient_name}
MRN: ${p.mrn}
Department: ${p.department}
Risk Level: ${p.risk_level}
Summary: ${p.summary || 'No summary'}
Alert: ${analysis.alert ? `${analysis.alert.message} (Action: ${analysis.alert.action || 'None'})` : 'None'}
Trend: ${analysis.trend ? `${analysis.trend.trend} - ${analysis.trend.details}` : 'None'}
Vitals Affected: ${analysis.trend?.vitals_affected?.join(', ') || 'None'}
Last Updated: ${p.updated_at}`;
  }).join('\n\n');

  const systemPrompt = `You are an expert clinical AI assistant analyzing patient data for a hospital ward. Your role is to provide ACTUAL clinical insights based on the real patient data provided — not generic advice.

Based on the patient data, generate a JSON response with:

1. "summary": A 2-3 sentence clinical overview of the ward status RIGHT NOW
2. "insights": An array of objects, each with:
   - "type": one of "pattern", "concern", "improvement", "action_needed"
   - "title": short clinical title (e.g. "Cluster of elevated heart rates in NICU")
   - "detail": 2-3 sentence clinical analysis explaining what you observed and why it matters
   - "priority": "high", "medium", or "low"
   - "patients": array of affected patient names
   - "reasoning": brief explanation of HOW you reached this conclusion from the data

Rules:
- Only report insights you can ACTUALLY SEE in the data — do not invent data
- If heart rates are high across multiple patients, say that specifically
- If a patient has a concerning trend, explain WHAT the trend is and WHY it matters
- Be specific: cite actual numbers, patient names, and clinical reasoning
- Do NOT use confidence percentages — just state your clinical observation
- Keep it concise and clinically relevant

Return ONLY valid JSON, no markdown.`;

  const response = await callLLM(systemPrompt, `Here is the current patient data for the ward:\n\n${patientData}`);

  try {
    const cleaned = response.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return res.json(parsed);
    }
  } catch (err) {
    console.error('[AI Insights] JSON parse failed:', err.message);
  }

  res.json({ insights: [], summary: 'AI analysis could not be completed at this time.' });
});

// Clinical chat - ask questions about patient data
export const clinicalChat = asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  const patients = await pool.query(
    'SELECT * FROM patient_embeddings ORDER BY updated_at DESC LIMIT 30'
  );

  const patientContext = patients.rows.map(p => {
    const a = p.analysis || {};
    return `- ${p.patient_name} (MRN: ${p.mrn}, Dept: ${p.department}, Risk: ${p.risk_level}): ${p.summary || 'No details'}. Alert: ${a.alert?.message || 'None'}. Trend: ${a.trend?.trend || 'None'}.`;
  }).join('\n');

  const systemPrompt = `You are a clinical AI assistant for a hospital ISBAR handover system. You have access to the following patient data:\n\n${patientContext}\n\nAnswer the nurse/doctor's question concisely and clinically. Focus on actionable insights. Use medical terminology appropriately. If you don't have enough data to answer, say so. Be specific with patient names and clinical details.`;

  const response = await callLLM(systemPrompt, message);
  res.json({ text: response });
});

export const getPatientAnalysis = asyncHandler(async (req, res) => {
  const { department } = req.query;
  const result = await aiAnalysis.analyzeAndStorePatients(department || null);
  res.json(result);
});

export const getStoredAnalysis = asyncHandler(async (req, res) => {
  const { department, mrn } = req.query;
  let query = 'SELECT * FROM patient_embeddings';
  const conditions = [];
  const params = [];

  if (department) {
    params.push(department);
    conditions.push(`LOWER(department) = LOWER($${params.length})`);
  }
  if (mrn) {
    params.push(mrn);
    conditions.push(`mrn = $${params.length}`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY updated_at DESC LIMIT 50';

  const result = await pool.query(query, params);
  res.json(result.rows);
});

export const getVitalsHistory = asyncHandler(async (req, res) => {
  const { mrn } = req.query;
  if (!mrn) return res.status(400).json({ error: 'MRN required' });

  const result = await pool.query(
    'SELECT * FROM patient_vitals_history WHERE mrn = $1 ORDER BY recorded_at DESC LIMIT 100',
    [mrn]
  );
  res.json(result.rows);
});

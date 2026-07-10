// AI Insights endpoint - detailed patient analysis with vitals and trends
import { Router } from 'express';
import pool from '../../config/database.js';

const router = Router();

// Generate detailed patient analysis
router.post('/generate', async (req, res) => {
  try {
    const { patients, metrics, timeRange, department } = req.body;
    const groqKey = process.env.GROQ_API_KEY;
    
    let insights;
    if (groqKey) {
      insights = await generateWithLLM(patients, metrics, timeRange, department, groqKey);
    } else {
      insights = generateDetailedAnalysis(patients, metrics, timeRange, department);
    }
    res.json(insights);
  } catch (error) {
    console.error('AI insights error:', error);
    const insights = generateDetailedAnalysis(req.body.patients || [], req.body.metrics || {}, req.body.timeRange || '24h', req.body.department || '');
    res.json(insights);
  }
});

// LLM-powered detailed analysis
async function generateWithLLM(patients, metrics, timeRange, department, apiKey) {
  const patientDetails = patients.slice(0, 15).map(p => 
    `- ${p.patientName} (MRN: ${p.mrn}, Bed: ${p.bedNumber}, Age: ${p.age}, Gender: ${p.gender}, Status: ${p.stability}, Diagnosis: ${p.diagnosis}, Shift: ${p.shift}, Last Update: ${p.lastHandover})`
  ).join('\n');

  const prompt = `You are a clinical AI assistant. Analyze these patients in detail.

DEPARTMENT: ${department || 'All'}
TIME RANGE: ${timeRange}
TOTAL: ${metrics.total}, CRITICAL: ${metrics.critical}, UNSTABLE: ${metrics.unstable}, STABLE: ${metrics.stable}

PATIENTS:
${patientDetails || 'No patients'}

Provide a JSON response:
{
  "summary": "Detailed clinical summary of all patients",
  "alerts": [
    { "type": "critical|warning|info", "title": "Alert", "message": "Detailed patient-focused message", "priority": "high|medium|low", "patient": "patient name if applicable", "mrn": "mrn if applicable" }
  ],
  "recommendations": [
    { "title": "Title", "description": "Detailed patient care recommendation", "impact": "high|medium|low" }
  ],
  "patientAnalysis": [
    { "mrn": "MRN", "name": "Patient Name", "status": "critical|unstable|stable", "riskLevel": "high|medium|low", "analysis": "Detailed analysis of this patient's condition", "monitoring": "What to monitor", "concerns": ["concern 1", "concern 2"] }
  ],
  "trendInsight": "Analysis of patient trends over time",
  "riskFactors": ["risk 1", "risk 2"],
  "positiveIndicators": ["positive 1", "positive 2"]
}

Rules:
- Focus ONLY on patient health, vitals, conditions, and clinical care
- Provide detailed per-patient analysis
- Do NOT mention staffing, equipment, or operations
- Return ONLY valid JSON`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 2500 })
    });
    if (!response.ok) throw new Error('Groq API error');
    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      parsed.isAI = true;
      parsed.generatedAt = new Date().toISOString();
      return parsed;
    }
  } catch (err) {
    console.error('LLM failed, using rule-based:', err.message);
  }
  return generateDetailedAnalysis(patients, metrics, timeRange, department);
}

// Detailed rule-based patient analysis
function generateDetailedAnalysis(patients, metrics, timeRange, department) {
  const criticalPatients = (patients || []).filter(p => p.stability === 'critical');
  const unstablePatients = (patients || []).filter(p => p.stability === 'unstable');
  const stablePatients = (patients || []).filter(p => p.stability === 'stable');
  const total = metrics.total || 0;

  // Summary
  let summary = '';
  if (total === 0) {
    summary = `No patient records found for ${timeRange} in ${department || 'this department'}.`;
  } else {
    summary = `Monitoring ${total} patients: ${criticalPatients.length} critical, ${unstablePatients.length} unstable, ${stablePatients.length} stable. `;
    if (criticalPatients.length > 0) {
      summary += `Immediate attention required for ${criticalPatients.length} patient(s). `;
    }
    if (unstablePatients.length > 0) {
      summary += `${unstablePatients.length} patient(s) showing instability trends. `;
    }
    if (criticalPatients.length === 0 && unstablePatients.length === 0) {
      summary += `All patients in stable condition.`;
    }
  }

  // Alerts - patient-focused
  const alerts = [];
  criticalPatients.forEach(p => {
    alerts.push({
      type: 'critical', title: 'Critical Condition',
      message: `${p.patientName} in bed ${p.bedNumber} requires immediate clinical intervention. Diagnosis: ${p.diagnosis}`,
      priority: 'high', patient: p.patientName, mrn: p.mrn
    });
  });
  unstablePatients.forEach(p => {
    alerts.push({
      type: 'warning', title: 'Patient Instability',
      message: `${p.patientName} (Bed ${p.bedNumber}) showing signs of deterioration. Requires close monitoring. Diagnosis: ${p.diagnosis}`,
      priority: 'medium', patient: p.patientName, mrn: p.mrn
    });
  });

  // Per-patient analysis
  const patientAnalysis = patients.slice(0, 20).map(p => {
    let riskLevel = 'low';
    let analysis = '';
    let monitoring = '';
    let concerns = [];

    if (p.stability === 'critical') {
      riskLevel = 'high';
      analysis = `Patient in critical condition. ${p.diagnosis}. Requires immediate medical attention and continuous monitoring.`;
      monitoring = 'Continuous vital sign monitoring, hourly assessments, immediate response to any changes.';
      concerns = ['Critical condition requires ICU-level care', 'Risk of rapid deterioration'];
    } else if (p.stability === 'unstable') {
      riskLevel = 'medium';
      analysis = `Patient showing signs of instability. ${p.diagnosis}. Condition may change rapidly.`;
      monitoring = 'Vital signs every 2 hours, reassess frequently, watch for signs of improvement or deterioration.';
      concerns = ['Unstable condition may worsen', 'Requires enhanced monitoring'];
    } else {
      analysis = `Patient in stable condition. ${p.diagnosis}. Continuing standard care protocols.`;
      monitoring = 'Routine vital sign monitoring per unit protocol.';
      concerns = [];
    }

    return {
      mrn: p.mrn, name: p.patientName, status: p.stability, riskLevel,
      age: p.age, gender: p.gender, bed: p.bedNumber, diagnosis: p.diagnosis,
      analysis, monitoring, concerns,
      lastUpdate: p.lastHandover, assignedNurse: p.assignedNurse
    };
  });

  // Recommendations - patient-focused only
  const recommendations = [];
  if (criticalPatients.length > 0) {
    recommendations.push({
      title: 'Immediate Clinical Intervention',
      description: `${criticalPatients.length} patient(s) in critical condition. Prioritize assessment and intervention. Consider specialist consultation.`,
      impact: 'high'
    });
  }
  if (unstablePatients.length > 0) {
    recommendations.push({
      title: 'Enhanced Patient Monitoring',
      description: `${unstablePatients.length} unstable patient(s). Increase monitoring frequency and reassess every 1-2 hours.`,
      impact: 'high'
    });
  }
  if (total > 0 && criticalPatients.length === 0 && unstablePatients.length === 0) {
    recommendations.push({
      title: 'Maintain Current Care',
      description: 'All patients stable. Continue current care plans and preventive measures.',
      impact: 'low'
    });
  }
  if (total > 0) {
    recommendations.push({
      title: 'Patient Reassessment Schedule',
      description: 'Ensure timely reassessments based on patient acuity levels. Critical patients need more frequent evaluation.',
      impact: 'medium'
    });
  }

  // Risk factors - patient-focused
  const riskFactors = [];
  if (criticalPatients.length > 0) riskFactors.push(`${criticalPatients.length} critical patient(s) at risk of rapid deterioration`);
  if (unstablePatients.length > 0) riskFactors.push(`${unstablePatients.length} unstable patient(s) may worsen without intervention`);
  const elderlyPatients = patients.filter(p => p.age >= 65).length;
  if (elderlyPatients > 0) riskFactors.push(`${elderlyPatients} elderly patient(s) with higher complication risk`);

  // Positive indicators
  const positiveIndicators = [];
  if (criticalPatients.length === 0) positiveIndicators.push('No critical patients');
  if (unstablePatients.length === 0 && total > 0) positiveIndicators.push('All patients stable');
  if (total > 0) positiveIndicators.push(`${total} patients under active monitoring`);

  return {
    summary, alerts, recommendations, patientAnalysis,
    trendInsight: total > 0
      ? `${total} active patient(s) over ${timeRange}. ${criticalPatients.length > 0 ? 'Critical cases need priority.' : 'Patient conditions are stable.'}`
      : 'No recent patient activity.',
    riskFactors, positiveIndicators,
    generatedAt: new Date().toISOString(), isAI: !!process.env.GROQ_API_KEY
  };
}

// Fetch patient data
router.get('/patient-data', async (req, res) => {
  try {
    const { department, timeRange } = req.query;
    let interval = "24 hours";
    if (timeRange === '7d') interval = "7 days";
    else if (timeRange === '30d') interval = "30 days";

    let query = `
      SELECT fs.id, fs.form_data, fs.submitted_at, fs.submitted_by_name, fs.template_name, fs.template_department
      FROM form_submissions fs
      WHERE fs.submitted_at > NOW() - INTERVAL '${interval}'
    `;
    const params = [];
    if (department) {
      params.push(department);
      query += ` AND LOWER(fs.template_department) = LOWER($${params.length})`;
    }
    query += ' ORDER BY fs.submitted_at DESC';

    const result = await pool.query(query, params);
    const patientMap = new Map();

    (result.rows || []).forEach(sub => {
      const fd = typeof sub.form_data === 'string' ? JSON.parse(sub.form_data) : (sub.form_data || {});
      const mrn = fd.mrn || fd.MRN || fd['MRN'] || fd.patient_mrn;
      if (!mrn || patientMap.has(mrn)) return;

      const stability = normalizeStability(fd.stability || fd['Patient Stability'] || 'stable');
      const shift = determineShift(sub.submitted_at);

      patientMap.set(mrn, {
        id: sub.id, patientName: fd.patientName || fd['Patient name'] || fd.patient_name || 'Unknown',
        mrn: String(mrn), bedNumber: fd.bedNumber || fd['Bed Number'] || fd.bed_number || 'N/A',
        department: sub.template_department || department || 'General', stability,
        lastHandover: sub.submitted_at, diagnosis: fd.diagnosis || fd.background || fd.situation || 'Not specified',
        age: fd.age || 0, gender: fd.gender || fd.sex || 'N/A', shift,
        assignedNurse: sub.submitted_by_name || 'Unknown',
        // Vitals if available
        heartRate: fd.heartRate || fd.heart_rate || fd.pulse || null,
        bloodPressure: fd.bloodPressure || fd.blood_pressure || fd.bp || null,
        temperature: fd.temperature || fd.temp || null,
        respiratoryRate: fd.respiratoryRate || fd.respiratory_rate || fd.rr || null,
        oxygenSaturation: fd.oxygenSaturation || fd.oxygen_saturation || fd.spo2 || null,
        bloodGlucose: fd.bloodGlucose || fd.blood_glucose || fd.glucose || null,
        painLevel: fd.painLevel || fd.pain_level || fd.pain || null,
        weight: fd.weight || null,
        height: fd.height || null
      });
    });

    const patients = Array.from(patientMap.values());
    const critical = patients.filter(p => p.stability === 'critical').length;
    const unstable = patients.filter(p => p.stability === 'unstable').length;
    const stable = patients.filter(p => p.stability === 'stable').length;

    res.json({
      patients,
      metrics: {
        total: patients.length, critical, unstable, stable,
        criticalRate: patients.length > 0 ? ((critical / patients.length) * 100).toFixed(1) : '0'
      }
    });
  } catch (error) {
    console.error('Error fetching patient data:', error);
    res.json({ patients: [], metrics: { total: 0, critical: 0, unstable: 0, stable: 0, criticalRate: '0' } });
  }
});

function normalizeStability(val) {
  const s = String(val || '').trim().toLowerCase();
  if (!s) return 'stable';
  if (/sub[-\s]?critical/.test(s) || /\bamber\b/.test(s) || /\byellow\b/.test(s)) return 'unstable';
  if (/\bunstable\b/.test(s)) return 'unstable';
  if (/\bcritical\b/.test(s) || /\bcode\s*red\b/.test(s) || s === 'red') return 'critical';
  if (/stabl/.test(s) || /\bcode\s*green\b/.test(s) || s === 'green') return 'stable';
  return 'stable';
}

function determineShift(timestamp) {
  const h = new Date(timestamp).getHours();
  if (h >= 6 && h < 14) return 'Morning';
  if (h >= 14 && h < 22) return 'Evening';
  return 'Night';
}

export default router;

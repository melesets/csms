"""CrewAI tasks for |Adare hospital AI system."""
from crewai import Task
from app.agents import handover_analyst, db_analyst, clinical_reviewer, report_generator, medical_agent

# ── Handover Tasks ───────────────────────────────────────────────────────────

handover_analyze_task = Task(
    description=(
        "Analyze the following handover data for completeness, consistency, and clinical risk.\n\n"
        "DATA: {handover_data}\n\n"
        "Steps:\n"
        "1. Check if all required ISBAR fields are present (patient identity, situation, background, assessment, recommendation)\n"
        "2. Identify any missing or incomplete fields\n"
        "3. Detect conflicting information between fields\n"
        "4. Compare vital signs against benchmarks (Temp 36.1–37.2°C, HR 60–100 bpm, BP 90-140/60-90 mmHg, RR 12–20/min, SpO2 ≥95%)\n"
        "5. If an MRN is present, look up patient history for context\n"
        "6. Flag risks with severity: 🔴 CRITICAL | 🟠 HIGH | 🟡 MODERATE | 🟢 NORMAL\n"
        "7. Return a structured analysis with: completeness_score, consistency_score, risk_flags, missing_fields, recommendations"
    ),
    expected_output="A structured JSON analysis with completeness_score, consistency_score, risk_flags, missing_fields, and recommendations.",
    agent=handover_analyst,
)

handover_summarize_task = Task(
    description=(
        "Generate a structured handover summary for the following patient data.\n\n"
        "DATA: {handover_data}\n\n"
        "Steps:\n"
        "1. If MRN is present, fetch patient history from the database\n"
        "2. Produce a summary with sections:\n"
        "   - PATIENT STATUS — current condition, stability, key diagnoses\n"
        "   - CRITICAL ALERTS — abnormal findings, deteriorating trends (with severity indicators)\n"
        "   - PENDING ACTIONS — tasks not yet completed, medications due, follow-ups\n"
        "   - RISK FLAGS — missing data, incomplete documentation, conflicts\n"
        "   - RECOMMENDATIONS — specific actionable items for the next shift\n"
        "3. Reference actual values from the data\n"
        "4. End with: '⚠️ Clinical verification required. Final judgment rests with the responsible clinician.'"
    ),
    expected_output="A structured handover summary with patient status, critical alerts, pending actions, risk flags, and recommendations.",
    agent=handover_analyst,
)

# ── Clinical Tasks ───────────────────────────────────────────────────────────

clinical_risk_task = Task(
    description=(
        "Perform a clinical risk assessment for this patient.\n\n"
        "DATA: {handover_data}\n\n"
        "Steps:\n"
        "1. Extract and evaluate vital signs against benchmarks\n"
        "2. If MRN present, fetch patient history for trend comparison\n"
        "3. Identify abnormal values and assign severity levels\n"
        "4. Determine overall risk level: LOW / MODERATE / HIGH / CRITICAL\n"
        "5. List top 3 clinical priorities\n"
        "6. Recommend escalation decision\n"
        "7. Return structured assessment with: risk_level, vital_analysis, priorities, escalation, clinical_summary"
    ),
    expected_output="A structured clinical risk assessment with risk_level, vital_analysis, priorities, escalation decision, and clinical_summary.",
    agent=clinical_reviewer,
)

# ── Report Tasks ─────────────────────────────────────────────────────────────

report_department_task = Task(
    description=(
        "Generate a department performance report for Adare General Hospital.\n\n"
        "Department: {department}\n\n"
        "Steps:\n"
        "1. Query the database for department staff counts, recent submissions, resources, and shifts\n"
        "2. Analyze workload, patient volume, and resource status\n"
        "3. Identify shortages, compliance issues, and trends\n"
        "4. Produce a professional report with sections:\n"
        "   - OVERVIEW — department summary, staff count, patient volume\n"
        "   - WORKLOAD ANALYSIS — shift coverage, patient-to-staff ratio\n"
        "   - RESOURCE STATUS — equipment, supplies, shortages\n"
        "   - CLINICAL METRICS — handover completeness, audit findings\n"
        "   - RECOMMENDATIONS — prioritized action items\n"
        "5. Use actual data from the database"
    ),
    expected_output="A professional department performance report with overview, workload analysis, resource status, clinical metrics, and recommendations.",
    agent=report_generator,
)

report_resource_task = Task(
    description=(
        "Generate a resource handover summary for Adare General Hospital.\n\n"
        "Steps:\n"
        "1. Query the database for current resource inventory and inventory reports\n"
        "2. Identify items below standard quantity (shortages)\n"
        "3. Identify items approaching expiry\n"
        "4. Produce a report with sections:\n"
        "   - INVENTORY STATUS — current stock by department\n"
        "   - SHORTAGE ALERTS — items below standard quantity\n"
        "   - EXPIRING ITEMS — resources approaching expiry\n"
        "   - SHIFT HANDOVER NOTES — changes from recent inventory reports\n"
        "   - RECOMMENDATIONS — reorder priorities"
    ),
    expected_output="A resource handover summary with inventory status, shortage alerts, expiring items, and recommendations.",
    agent=report_generator,
)

report_audit_task = Task(
    description=(
        "Generate a clinical audit report for Adare General Hospital.\n\n"
        "Steps:\n"
        "1. Query the database for form submissions, ISBAR records, and activity logs\n"
        "2. Analyze handover completeness and consistency across records\n"
        "3. Identify patterns, non-conformities, and recurring issues\n"
        "4. Produce a report with sections:\n"
        "   - COMPLIANCE SCORE — overall and per-department rates\n"
        "   - HANDOVER QUALITY — completeness, consistency, timeliness\n"
        "   - FINDINGS — non-conformities, patterns\n"
        "   - TRENDS — improving/declining/stable\n"
        "   - ACTION PLAN — corrective actions with owners and deadlines"
    ),
    expected_output="A clinical audit report with compliance scores, handover quality, findings, trends, and action plan.",
    agent=report_generator,
)

# ── General Chat Task ────────────────────────────────────────────────────────

chat_task = Task(
    description=(
        "Answer the following question. You are |Adare, an autonomous AI agent for Adare General Hospital.\n\n"
        "QUESTION: {message}\n\n"
        "Rules:\n"
        "- If this is a medical question, answer thoroughly using your comprehensive medical knowledge\n"
        "- If this is about hospital data (patients, staff, resources, etc.), query the database\n"
        "- If this is a clinical question about a specific patient, look up their history first\n"
        "- NEVER refuse a question — you are a comprehensive agent\n"
        "- Be direct, professional, and use markdown formatting\n"
        "- For patient-specific advice, add: '⚠️ Clinical verification required.'"
    ),
    expected_output="A comprehensive answer to the user's question, using medical knowledge and/or database data as appropriate.",
    agent=medical_agent,
)

# ── DB Query Task ────────────────────────────────────────────────────────────

db_query_task = Task(
    description=(
        "Execute this database query and explain the results.\n\n"
        "QUERY: {sql}\n\n"
        "Steps:\n"
        "1. Execute the query using the database tool\n"
        "2. Present the results in a clear, structured format\n"
        "3. Add context or insights about what the data means\n"
        "4. If no results, suggest why and what tables might have relevant data"
    ),
    expected_output="Query results presented in a clear format with context and insights.",
    agent=db_analyst,
)

# Export
TASKS = {
    'handover_analyze': handover_analyze_task,
    'handover_summarize': handover_summarize_task,
    'clinical_risk': clinical_risk_task,
    'report_department': report_department_task,
    'report_resource': report_resource_task,
    'report_audit': report_audit_task,
    'chat': chat_task,
    'db_query': db_query_task,
}

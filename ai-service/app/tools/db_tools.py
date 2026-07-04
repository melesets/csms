"""Database tool for CrewAI agents — safe, read-only access to the hospital database."""
import psycopg2
import psycopg2.extras
import os
import re
from typing import Type, Optional
from pydantic import BaseModel, Field
from crewai.tools import BaseTool

ALLOWED_TABLES = [
    'users', 'form_templates', 'form_submissions', 'isbar_records',
    'department_staff', 'resources', 'inventory_reports', 'dashboard_mappings',
    'terminology_codes', 'shift_sessions', 'activity',
]

def _get_conn():
    url = os.getenv('DATABASE_URL', '')
    if not url:
        raise RuntimeError('DATABASE_URL not configured')
    return psycopg2.connect(url)

def _safe_query(sql: str, params=None, limit=200):
    """Execute a read-only query. Only SELECT on allowed tables."""
    normalized = sql.strip().lower()
    if not normalized.startswith('select'):
        raise ValueError('Only SELECT queries are allowed')
    # Extract table name
    table_match = re.search(r'from\s+(\w+)', normalized)
    if not table_match:
        raise ValueError('Could not identify table in query')
    table = table_match.group(1)
    if table not in ALLOWED_TABLES:
        raise ValueError(f'Table "{table}" is not in the allowed list')
    if limit and 'limit' not in normalized:
        sql = f'{sql.rstrip(";")} LIMIT {limit}'
    conn = _get_conn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(sql, params)
        rows = cur.fetchall()
        cur.close()
        return [dict(r) for r in rows]
    finally:
        conn.close()


# ── Tool Input Schemas ──────────────────────────────────────────────────────

class DBQueryInput(BaseModel):
    sql: str = Field(description='SQL SELECT query to execute')
    params: Optional[list] = Field(default=None, description='Query parameters')

class PatientLookupInput(BaseModel):
    mrn: str = Field(description='Patient MRN (medical record number)')

class NameLookupInput(BaseModel):
    name: str = Field(description='Patient name to search for')

class DBOverviewInput(BaseModel):
    section: str = Field(default='all', description='Data section: all, patients, staff, departments, resources, shifts, templates')


# ── Tool Implementations ─────────────────────────────────────────────────────

class DatabaseQueryTool(BaseTool):
    name: str = "database_query"
    description: str = "Execute a safe, read-only SQL SELECT query on the hospital database. Only allowed tables: " + ", ".join(ALLOWED_TABLES)
    args_schema: Type[BaseModel] = DBQueryInput

    def _run(self, sql: str, params: Optional[list] = None) -> str:
        try:
            rows = _safe_query(sql, params)
            if not rows:
                return "No records found."
            return str(rows[:50])  # truncate for agent context
        except Exception as e:
            return f"Query error: {e}"


class PatientHistoryTool(BaseTool):
    name: str = "patient_history"
    description: str = "Fetch full patient history by MRN — returns all form submissions and ISBAR records for that patient."
    args_schema: Type[BaseModel] = PatientLookupInput

    def _run(self, mrn: str) -> str:
        try:
            submissions = _safe_query(
                "SELECT id, template_name, submitted_at, form_data FROM form_submissions WHERE form_data->>'mrn' = %s ORDER BY submitted_at DESC LIMIT 20",
                [mrn]
            )
            isbar = _safe_query(
                "SELECT id, department, form_data, created_at FROM isbar_records WHERE form_data->>'mrn' = %s ORDER BY created_at DESC LIMIT 10",
                [mrn]
            )
            result = []
            if submissions:
                result.append(f"[FORM SUBMISSIONS for MRN {mrn}]")
                for s in submissions:
                    result.append(f"  - {s['template_name']} ({s['submitted_at']}): {str(s['form_data'])[:300]}")
            if isbar:
                result.append(f"[ISBAR RECORDS for MRN {mrn}]")
                for i in isbar:
                    result.append(f"  - Dept {i['department']} ({i['created_at']}): {str(i['form_data'])[:300]}")
            return '\n'.join(result) if result else f"No records found for MRN {mrn}"
        except Exception as e:
            return f"Error: {e}"


class PatientNameLookupTool(BaseTool):
    name: str = "patient_name_lookup"
    description: str = "Look up a patient's MRN by their name. Returns matching MRN numbers."
    args_schema: Type[BaseModel] = NameLookupInput

    def _run(self, name: str) -> str:
        try:
            rows = _safe_query(
                "SELECT DISTINCT form_data->>'mrn' as mrn, form_data->>'patientName' as name "
                "FROM form_submissions "
                "WHERE (form_data->>'patientName' ILIKE %s OR form_data->>'Patient name' ILIKE %s) "
                "AND form_data->>'mrn' IS NOT NULL LIMIT 5",
                [f'%{name}%', f'%{name}%']
            )
            if not rows:
                return f"No patient found matching '{name}'"
            return '\n'.join([f"  - {r['name']}: MRN {r['mrn']}" for r in rows])
        except Exception as e:
            return f"Error: {e}"


class DatabaseOverviewTool(BaseTool):
    name: str = "database_overview"
    description: str = "Get a general overview of the hospital database — record counts, departments, recent activity, resources, staff."
    args_schema: Type[BaseModel] = DBOverviewInput

    def _run(self, section: str = 'all') -> str:
        try:
            results = []
            lower = section.lower()

            if lower in ('all', 'overview'):
                counts = _safe_query("""
                    SELECT
                        (SELECT count(*) FROM users) as users_count,
                        (SELECT count(*) FROM form_templates) as templates_count,
                        (SELECT count(*) FROM form_submissions) as submissions_count,
                        (SELECT count(*) FROM isbar_records) as isbar_count,
                        (SELECT count(*) FROM resources) as resources_count,
                        (SELECT count(*) FROM department_staff) as dept_staff_count
                """)
                if counts:
                    c = counts[0]
                    results.append(f"[DATABASE OVERVIEW]\n"
                                   f"  Users/Staff: {c['users_count']}\n"
                                   f"  Form Templates: {c['templates_count']}\n"
                                   f"  Form Submissions: {c['submissions_count']}\n"
                                   f"  ISBAR Records: {c['isbar_count']}\n"
                                   f"  Resources: {c['resources_count']}\n"
                                   f"  Department Staff: {c['dept_staff_count']}")

            if lower in ('all', 'departments'):
                depts = _safe_query("SELECT DISTINCT department FROM users WHERE department IS NOT NULL AND department != '' ORDER BY department")
                if depts:
                    results.append("[DEPARTMENTS]\n" + '\n'.join([f"  - {d['department']}" for d in depts]))

            if lower in ('all', 'patients'):
                subs = _safe_query("SELECT id, template_name, form_data->>'patientName' as patient_name, form_data->>'mrn' as mrn, submitted_at FROM form_submissions ORDER BY submitted_at DESC LIMIT 10")
                if subs:
                    results.append("[RECENT PATIENT SUBMISSIONS]\n" + '\n'.join([f"  - {s['patient_name'] or 'N/A'} (MRN {s['mrn'] or 'N/A'}) — {s['template_name']} @ {s['submitted_at']}" for s in subs]))

            if lower in ('all', 'staff'):
                staff = _safe_query("SELECT name, username, role, department, profession, isactive FROM users ORDER BY created_at DESC LIMIT 15")
                if staff:
                    results.append("[STAFF]\n" + '\n'.join([f"  - {s['name'] or s['username']} | Role: {s['role']} | Dept: {s['department'] or '—'} | Active: {s['isactive']}" for s in staff]))

            if lower in ('all', 'resources'):
                res = _safe_query("SELECT name, type, quantity, standard_quantity, unit, department, expiry_date FROM resources ORDER BY department, name LIMIT 20")
                if res:
                    results.append("[RESOURCES]\n" + '\n'.join([f"  - {r['name']} ({r['type']}) | Qty: {r['quantity']} {r['unit']} | Dept: {r['department']}" for r in res]))

            if lower in ('all', 'shifts'):
                shifts = _safe_query("SELECT id, user_id, shift_name, start_time, end_time, is_active FROM shift_sessions ORDER BY start_time DESC LIMIT 10")
                if shifts:
                    results.append("[RECENT SHIFTS]\n" + '\n'.join([f"  - User {s['user_id']} | {s['shift_name']} | {s['start_time']} → {s['end_time'] or 'ongoing'}" for s in shifts]))

            return '\n\n'.join(results) if results else "No data available."
        except Exception as e:
            return f"Error: {e}"

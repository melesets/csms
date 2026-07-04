"""CrewAI crews for |Adare hospital AI system — orchestrates agents and tasks."""
from crewai import Crew, Process
from app.agents import handover_analyst, db_analyst, clinical_reviewer, report_generator, medical_agent
from app.tasks import (
    handover_analyze_task,
    handover_summarize_task,
    clinical_risk_task,
    report_department_task,
    report_resource_task,
    report_audit_task,
    chat_task,
    db_query_task,
)


def run_handover_analyze(handover_data: dict) -> str:
    """Run a sequential crew: DB analyst → Handover analyst."""
    task = handover_analyze_task.clone()
    task.description = task.description.format(handover_data=handover_data)

    crew = Crew(
        agents=[db_analyst, handover_analyst],
        tasks=[task],
        process=Process.sequential,
        verbose=True,
    )
    return crew.kickoff()


def run_handover_summarize(handover_data: dict) -> str:
    """Run a sequential crew: DB analyst → Handover analyst → Report generator."""
    task = handover_summarize_task.clone()
    task.description = task.description.format(handover_data=handover_data)

    crew = Crew(
        agents=[db_analyst, handover_analyst, report_generator],
        tasks=[task],
        process=Process.sequential,
        verbose=True,
    )
    return crew.kickoff()


def run_clinical_risk(handover_data: dict) -> str:
    """Run a sequential crew: DB analyst → Clinical reviewer."""
    task = clinical_risk_task.clone()
    task.description = task.description.format(handover_data=handover_data)

    crew = Crew(
        agents=[db_analyst, clinical_reviewer],
        tasks=[task],
        process=Process.sequential,
        verbose=True,
    )
    return crew.kickoff()


def run_report_department(department: str = 'all') -> str:
    """Run a sequential crew: DB analyst → Report generator."""
    task = report_department_task.clone()
    task.description = task.description.format(department=department)

    crew = Crew(
        agents=[db_analyst, report_generator],
        tasks=[task],
        process=Process.sequential,
        verbose=True,
    )
    return crew.kickoff()


def run_report_resource() -> str:
    """Run a sequential crew: DB analyst → Report generator."""
    task = report_resource_task.clone()

    crew = Crew(
        agents=[db_analyst, report_generator],
        tasks=[task],
        process=Process.sequential,
        verbose=True,
    )
    return crew.kickoff()


def run_report_audit() -> str:
    """Run a sequential crew: DB analyst → Clinical reviewer → Report generator."""
    task = report_audit_task.clone()

    crew = Crew(
        agents=[db_analyst, clinical_reviewer, report_generator],
        tasks=[task],
        process=Process.sequential,
        verbose=True,
    )
    return crew.kickoff()


def run_chat(message: str) -> str:
    """Run a single-agent crew for general chat."""
    task = chat_task.clone()
    task.description = task.description.format(message=message)

    crew = Crew(
        agents=[medical_agent],
        tasks=[task],
        process=Process.sequential,
        verbose=True,
    )
    return crew.kickoff()


def run_db_query(sql: str) -> str:
    """Run a single-agent crew for DB queries."""
    task = db_query_task.clone()
    task.description = task.description.format(sql=sql)

    crew = Crew(
        agents=[db_analyst],
        tasks=[task],
        process=Process.sequential,
        verbose=True,
    )
    return crew.kickoff()


# Map of crew names to functions
CREWS = {
    'handover_analyze': run_handover_analyze,
    'handover_summarize': run_handover_summarize,
    'clinical_risk': run_clinical_risk,
    'report_department': run_report_department,
    'report_resource': run_report_resource,
    'report_audit': run_report_audit,
    'chat': run_chat,
    'db_query': run_db_query,
}

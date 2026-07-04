"""|Adare CrewAI Service — FastAPI endpoints for multi-agent orchestration."""
import traceback
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.crews import CREWS

app = FastAPI(
    title="|Adare CrewAI Service",
    description="Multi-agent orchestration for Adare General Hospital AI system",
    version="2.0.0",
)


# ── Request Models ───────────────────────────────────────────────────────────

class HandoverRequest(BaseModel):
    handover_data: dict

class ReportDepartmentRequest(BaseModel):
    department: str = 'all'

class ChatRequest(BaseModel):
    message: str

class DBQueryRequest(BaseModel):
    sql: str

class CrewKickoffRequest(BaseModel):
    crew: str
    params: dict = {}


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "|Adare CrewAI", "version": "2.0.0"}


@app.get("/crews")
def list_crews():
    return {"crews": list(CREWS.keys())}


# ── Handover Endpoints ───────────────────────────────────────────────────────

@app.post("/handover/analyze")
def handover_analyze(req: HandoverRequest):
    try:
        result = CREWS['handover_analyze'](req.handover_data)
        return {"result": str(result), "crew": "handover_analyze"}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=503, detail=str(e))


@app.post("/handover/summarize")
def handover_summarize(req: HandoverRequest):
    try:
        result = CREWS['handover_summarize'](req.handover_data)
        return {"result": str(result), "crew": "handover_summarize"}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=503, detail=str(e))


# ── Clinical Endpoints ────────────────────────────────────────────────────────

@app.post("/clinical/risk")
def clinical_risk(req: HandoverRequest):
    try:
        result = CREWS['clinical_risk'](req.handover_data)
        return {"result": str(result), "crew": "clinical_risk"}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=503, detail=str(e))


# ── Report Endpoints ─────────────────────────────────────────────────────────

@app.post("/reports/department")
def report_department(req: ReportDepartmentRequest):
    try:
        result = CREWS['report_department'](req.department)
        return {"result": str(result), "crew": "report_department"}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=503, detail=str(e))


@app.post("/reports/resource")
def report_resource():
    try:
        result = CREWS['report_resource']()
        return {"result": str(result), "crew": "report_resource"}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=503, detail=str(e))


@app.post("/reports/audit")
def report_audit():
    try:
        result = CREWS['report_audit']()
        return {"result": str(result), "crew": "report_audit"}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=503, detail=str(e))


# ── Chat & DB ────────────────────────────────────────────────────────────────

@app.post("/chat")
def chat(req: ChatRequest):
    try:
        result = CREWS['chat'](req.message)
        return {"result": str(result), "crew": "chat"}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=503, detail=str(e))


@app.post("/db/query")
def db_query(req: DBQueryRequest):
    try:
        result = CREWS['db_query'](req.sql)
        return {"result": str(result), "crew": "db_query"}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=503, detail=str(e))


# ── Generic kickoff ──────────────────────────────────────────────────────────

@app.post("/kickoff")
def kickoff(req: CrewKickoffRequest):
    if req.crew not in CREWS:
        raise HTTPException(status_code=400, detail=f"Unknown crew: {req.crew}. Available: {list(CREWS.keys())}")
    try:
        result = CREWS[req.crew](**req.params)
        return {"result": str(result), "crew": req.crew}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=503, detail=str(e))

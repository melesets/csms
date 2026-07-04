# |Adare CrewAI Service

Multi-agent orchestration service for |Adare AI at Adare General Hospital, powered by [CrewAI](https://github.com/crewAIInc/crewAI).

## Architecture

```
┌──────────────┐     HTTP      ┌──────────────────┐
│  Node.js     │ ───────────→  │  Python CrewAI   │
│  Backend     │  :8000/api    │  Service          │
│  (Express)   │  ←──────────  │  (FastAPI)        │
└──────────────┘               └──────────────────┘
                                       │
                                       ▼
                               ┌──────────────────┐
                               │  PostgreSQL DB    │
                               │  (read-only)      │
                               └──────────────────┘
```

## Agents

| Agent | Role | Tools |
|-------|------|-------|
| **Handover Analyst** | Analyzes handover data for completeness, consistency, risk | DB query, patient history, name lookup |
| **DB Analyst** | Retrieves live hospital data from PostgreSQL | DB query, overview, patient history |
| **Clinical Reviewer** | Evaluates vitals, flags risks, recommends escalation | Patient history, DB query |
| **Report Generator** | Produces structured reports (department, audit, resource) | DB overview, DB query |
| **Medical Agent** | Answers general medical questions comprehensively | Patient history, DB query |

## Crews (Workflows)

| Crew | Agents | Use Case |
|------|--------|----------|
| `handover_analyze` | DB Analyst → Handover Analyst | Analyze handover completeness & risk |
| `handover_summarize` | DB Analyst → Handover Analyst → Report Gen | Generate handover summary |
| `clinical_risk` | DB Analyst → Clinical Reviewer | Clinical risk assessment |
| `report_department` | DB Analyst → Report Generator | Department performance report |
| `report_resource` | DB Analyst → Report Generator | Resource/inventory report |
| `report_audit` | DB Analyst → Clinical Reviewer → Report Gen | Clinical audit report |
| `chat` | Medical Agent | General medical Q&A |
| `db_query` | DB Analyst | Direct database query |

## Setup

```bash
# 1. Create virtual environment
cd crewai-service
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and AI API keys

# 4. Run the service
python run.py
# or: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/crews` | List available crews |
| POST | `/handover/analyze` | Analyze handover data |
| POST | `/handover/summarize` | Generate handover summary |
| POST | `/clinical/risk` | Clinical risk assessment |
| POST | `/reports/department` | Department report |
| POST | `/reports/resource` | Resource report |
| POST | `/reports/audit` | Audit report |
| POST | `/chat` | General chat |
| POST | `/db/query` | Direct DB query |
| POST | `/kickoff` | Generic crew kickoff |

## Node.js Integration

The Node.js backend automatically routes to this service when it's running. Set `CREWAI_URL` in the server `.env` (default: `http://localhost:8000`).

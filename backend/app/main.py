"""
Decision Intelligence BI Assistant — FastAPI Backend
Phase 2: SQLAgent with self-healing loop
Phase 3: Insight engine (WoW, outliers, health score)
Phase 4: StreamingResponse SSE — 6-step thinking pipeline
Logging: latency tracking on every request
"""

import os
import json
import time
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from dotenv import load_dotenv
load_dotenv(override=True)  # ← Always load latest .env values

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.agent.sql_agent import SQLAgent
from app.db.connection   import init_pool, close_pool, execute_query
from app.insights.engine import run_insights
from app.safety.guard    import validate_sql

# ── LOGGING ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
)
logger = logging.getLogger("dibi")


# ── LIFESPAN ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        logger.warning("⚠  DATABASE_URL not set — DB queries will fail")
    else:
        try:
            await init_pool(dsn)
        except Exception as e:
            logger.error(f"⚠  Could not connect to database: {e}")
            logger.warning("Server starting without DB connection — queries will fail at runtime")
    yield
    await close_pool()


# ── APP ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Decision Intelligence BI Assistant",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("FRONTEND_URL", "http://localhost:3000"),
        "https://*.vercel.app",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Singleton agent
_agent: SQLAgent | None = None

def get_agent() -> SQLAgent:
    global _agent
    if _agent is None:
        key = os.getenv("GROQ_API_KEY")
        if not key:
            raise RuntimeError("GROQ_API_KEY environment variable not set")
        model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        _agent = SQLAgent(api_key=key, model=model)
        logger.info(f"✓ SQLAgent initialized with model: {model}")
    return _agent


# ── SSE HELPERS ───────────────────────────────────────────────────────────────
def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


# ── REQUEST MODELS ────────────────────────────────────────────────────────────
class QueryRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=2000)


# ── STREAMING PIPELINE ────────────────────────────────────────────────────────
async def pipeline_stream(question: str) -> AsyncGenerator[str, None]:
    """
    6-step SSE pipeline:
    1 → Understanding question
    2 → Generating SQL (LLM call)
    3 → Validating safety
    4 → Fetching data (DB + self-heal up to 2 retries)
    5 → Computing insights (WoW, outliers, health)
    6 → Generating narrative (LLM call)
    → done
    """
    pipeline_start = time.perf_counter()
    agent = get_agent()

    # ── STEP 1 ──────────────────────────────────────────────────────────────
    yield sse("step", {"id": 1, "label": "Understanding question", "status": "active"})
    await asyncio.sleep(0.25)
    yield sse("step", {"id": 1, "label": "Understanding question", "status": "done"})

    # ── STEP 2: LLM → SQL ────────────────────────────────────────────────────
    yield sse("step", {"id": 2, "label": "Generating SQL", "status": "active"})
    try:
        agent_result = await agent.generate(question)
    except Exception as e:
        logger.error(f"LLM generation error: {e}")
        yield sse("step",  {"id": 2, "label": "Generating SQL", "status": "error"})
        yield sse("error", {"code": "LLM_ERROR", "message": str(e)})
        return

    yield sse("step", {"id": 2, "label": "Generating SQL", "status": "done"})
    yield sse("sql", {
        "query":        agent_result.get("sql", ""),
        "thought":      agent_result.get("thought_process", ""),
        "confidence":   agent_result.get("confidence_score", 0.0),
        "viz_type":     agent_result.get("visualization_suggestion", "table"),
        "chart_config": agent_result.get("chart_config", {}),
        "llm_ms":       agent_result.get("latency_ms", 0),
    })

    # ── STEP 3: SAFETY ───────────────────────────────────────────────────────
    yield sse("step", {"id": 3, "label": "Validating safety", "status": "active"})
    await asyncio.sleep(0.05)

    if agent_result.get("safety_blocked"):
        yield sse("step",  {"id": 3, "label": "Validating safety", "status": "error"})
        yield sse("error", {
            "code":    "SAFETY_BLOCKED",
            "message": agent_result.get("safety_reason", "Query blocked by safety layer"),
        })
        return

    vr = validate_sql(agent_result.get("sql", ""))
    if not vr.safe:
        yield sse("step",  {"id": 3, "label": "Validating safety", "status": "error"})
        yield sse("error", {"code": "SAFETY_BLOCKED", "message": vr.reason})
        return

    yield sse("step", {"id": 3, "label": "Validating safety", "status": "done"})

    # ── STEP 4: EXECUTE + SELF-HEAL ──────────────────────────────────────────
    yield sse("step", {"id": 4, "label": "Fetching data", "status": "active"})

    sql          = agent_result["sql"]
    rows         = []
    columns      = []
    attempts     = 0
    healed       = False

    for attempt in range(3):   # 1 original + 2 retries
        attempts = attempt + 1
        try:
            rows, columns = await execute_query(sql)
            break                      # ← success, exit loop

        except Exception as db_err:
            err_msg = str(db_err)
            logger.warning(f"DB error (attempt {attempt+1}): {err_msg}")

            if attempt < 2:
                healed = True
                yield sse("healing", {
                    "attempt": attempt + 1,
                    "error":   err_msg[:200],
                    "message": f"Self-healing: attempt {attempt+1}/2…",
                })
                try:
                    repaired = await agent.generate(
                        question,
                        repair_ctx={"failed_sql": sql, "error": err_msg},
                    )
                    if not repaired.get("safety_blocked") and repaired.get("sql"):
                        sql = repaired["sql"]
                        yield sse("sql_repaired", {
                            "query":   sql,
                            "attempt": attempt + 1,
                            "thought": repaired.get("thought_process", ""),
                        })
                except Exception as repair_err:
                    logger.error(f"Repair LLM error: {repair_err}")
            else:
                yield sse("step",  {"id": 4, "label": "Fetching data", "status": "error"})
                yield sse("error", {
                    "code":    "EXECUTION_FAILED",
                    "message": f"Query failed after {attempts} attempts: {err_msg[:300]}",
                })
                return

    yield sse("step", {"id": 4, "label": "Fetching data", "status": "done"})
    yield sse("data", {
        "rows":     rows[:200],   # stream first 200 to frontend
        "columns":  columns,
        "total":    len(rows),
        "healed":   healed,
        "attempts": attempts,
    })

    # ── STEP 5: INSIGHTS ─────────────────────────────────────────────────────
    yield sse("step", {"id": 5, "label": "Computing insights", "status": "active"})
    await asyncio.sleep(0.05)

    insights = run_insights(rows, columns)
    yield sse("step", {"id": 5, "label": "Computing insights", "status": "done"})
    yield sse("insights", insights)

    # ── STEP 6: NARRATIVE ────────────────────────────────────────────────────
    yield sse("step", {"id": 6, "label": "Generating narrative", "status": "active"})
    try:
        narrative = await agent.generate_narrative(
            question,
            wow_data=insights.get("wow", {}),
            stats=insights.get("stats", {}),
            rows=rows,
        )
    except Exception:
        narrative = "Analysis complete. Review the data and visualizations for key findings."

    yield sse("step", {"id": 6, "label": "Generating narrative", "status": "done"})
    yield sse("narrative", {"text": narrative})

    # ── DONE ─────────────────────────────────────────────────────────────────
    total_ms = round((time.perf_counter() - pipeline_start) * 1000)
    logger.info(f"Pipeline complete | question='{question[:60]}' | rows={len(rows)} | ms={total_ms}")

    yield sse("done", {
        "total_ms":  total_ms,
        "row_count": len(rows),
        "attempts":  attempts,
        "healed":    healed,
    })


# ── ROUTES ────────────────────────────────────────────────────────────────────

@app.post("/api/query")
async def query(req: QueryRequest, request: Request):
    """Main endpoint — streams the full analysis pipeline via SSE."""
    logger.info(f"New query: '{req.question[:80]}'  ip={request.client.host if request.client else 'unknown'}")
    return StreamingResponse(
        pipeline_stream(req.question),
        media_type="text/event-stream",
        headers={
            "Cache-Control":     "no-cache",
            "X-Accel-Buffering": "no",
            "Connection":        "keep-alive",
        },
    )


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "decision-intelligence-bi", "version": "2.0.0"}


@app.get("/api/suggestions")
async def suggestions():
    return {"suggestions": [
        "What was our total revenue last month?",
        "Show me the top 5 customers by lifetime value",
        "Which regions have the highest churn rate?",
        "Compare monthly revenue growth over the last 6 months",
        "What is our week-over-week order trend?",
        "Which products have the most cancellations?",
        "Show payment failure rate by method",
        "Who are our at-risk customers?",
        "What is our current conversion rate?",
        "Show MRR trend for this year",
    ]}

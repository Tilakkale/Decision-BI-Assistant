"""
PHASE 2 — SQLAgent
NL→SQL generation with:
- Schema-aware prompting + semantic metadata injection
- Self-healing loop (max 2 retries on DB error)
- Confidence scoring
- Visualization suggestion
"""

import json
import re
import time
import logging
from pathlib import Path
from typing import Any

from groq import AsyncGroq
from app.safety.guard import validate_sql, mask_text, mask_rows

logger = logging.getLogger(__name__)

DICT_PATH = Path(__file__).parent.parent / "dictionary.json"


def _load_dict() -> dict:
    with open(DICT_PATH) as f:
        return json.load(f)


def _build_system_prompt(metadata: dict) -> str:
    schema     = json.dumps(metadata["schema_summary"], indent=2)
    seg        = json.dumps(metadata["customer_segments"], indent=2)
    revenue    = json.dumps(metadata["revenue_metrics"], indent=2)
    ops        = json.dumps(metadata["operational_metrics"], indent=2)
    time_wins  = json.dumps(metadata["time_windows"], indent=2)
    dq         = json.dumps(metadata["data_quality_rules"], indent=2)
    viz        = json.dumps(metadata["visualization_map"], indent=2)

    return f"""You are a senior SQL analyst working with a SaaS company's PostgreSQL database.
You always write clean, production-grade SQL using the business definitions provided.

DATABASE SCHEMA:
{schema}

BUSINESS DEFINITIONS (use these EXACT SQL expressions when user asks about these concepts):
{seg}

REVENUE METRIC PATTERNS:
{revenue}

OPERATIONAL METRICS:
{ops}

TIME WINDOW SHORTCUTS:
{time_wins}

DATA QUALITY RULES (CRITICAL — must follow these):
{dq}

VISUALIZATION GUIDANCE:
{viz}

SQL RULES:
1. Only generate SELECT statements — never DROP/DELETE/UPDATE/INSERT/ALTER
2. Always LOWER(status), LOWER(region), LOWER(plan), LOWER(segment) for string comparisons
3. Always COALESCE(gateway_fee, 0) when summing nullable numerics
4. Always NULLIF(denominator, 0) to prevent division-by-zero errors
5. Add LIMIT 500 unless query is a pure aggregation returning ≤1 row
6. Use CTEs (WITH clause) for complex multi-step logic
7. Prefer DATE_TRUNC for time grouping

Respond with EXACTLY this JSON (no markdown fences, no extra keys):
{{
  "thought_process": "2-3 sentences: tables used, business definition applied, aggregation strategy",
  "sql": "the complete PostgreSQL SELECT statement",
  "visualization_suggestion": "one of: line|area|bar|horizontal_bar|pie|scatter|metric_card|table",
  "confidence_score": 0.0,
  "chart_config": {{
    "x_axis": "column name",
    "y_axis": "column name",
    "title": "descriptive chart title",
    "group_by": null
  }}
}}"""


def _repair_prompt(original_question: str, failed_sql: str, error: str) -> str:
    return f"""The SQL query you generated failed with a database error.
Diagnose and fix it.

ORIGINAL QUESTION: {original_question}

FAILED SQL:
{failed_sql}

DATABASE ERROR:
{error}

Return the corrected JSON with fixed sql and updated thought_process explaining the fix."""


class SQLAgent:
    def __init__(self, api_key: str, model: str = "llama-3.3-70b-versatile"):
        self.client   = AsyncGroq(api_key=api_key)
        self.model    = model
        self.metadata = _load_dict()
        self._sys_prompt = _build_system_prompt(self.metadata)

    async def _call(self, messages: list[dict]) -> tuple[str, float]:
        t0 = time.perf_counter()
        resp = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.05,
            max_tokens=1400,
            response_format={"type": "json_object"},
        )
        latency_ms = round((time.perf_counter() - t0) * 1000)
        logger.info(f"[groq] model={self.model} latency={latency_ms}ms")
        return resp.choices[0].message.content, latency_ms

    def _parse(self, raw: str) -> dict:
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            if match:
                return json.loads(match.group())
            raise ValueError(f"LLM returned non-JSON response: {raw[:200]}")

    async def generate(self, question: str, repair_ctx: dict | None = None) -> dict:
        """
        Generate SQL from a natural language question.
        repair_ctx: {"failed_sql": str, "error": str} — triggers self-heal mode.
        """
        safe_q = mask_text(question)

        if repair_ctx:
            user_msg = _repair_prompt(safe_q, repair_ctx["failed_sql"], repair_ctx["error"])
        else:
            user_msg = f"Business question: {safe_q}"

        messages = [
            {"role": "system", "content": self._sys_prompt},
            {"role": "user",   "content": user_msg},
        ]

        raw, latency_ms = await self._call(messages)
        result = self._parse(raw)

        sql = result.get("sql", "").strip()

        # Safety gate
        vr = validate_sql(sql)
        if not vr.safe:
            result["sql"]              = ""
            result["safety_blocked"]   = True
            result["safety_reason"]    = vr.reason
            result["confidence_score"] = 0.0
        else:
            result["safety_blocked"] = False
            # Auto-inject LIMIT guard
            if sql and "LIMIT" not in sql.upper():
                result["sql"] = sql.rstrip("; \n") + "\nLIMIT 500"

        result["latency_ms"] = latency_ms
        return result

    async def generate_narrative(
        self,
        question: str,
        wow_data: dict,
        stats: dict,
        rows: list[dict],
    ) -> str:
        """Generate executive business narrative from analysis results."""
        safe_rows = mask_rows(rows[:5])
        prompt = f"""Question asked: "{question}"

Week-over-Week analysis:
{json.dumps(wow_data, indent=2)}

Statistical summary:
{json.dumps(stats, indent=2)}

Sample data (first 5 rows, PII masked):
{json.dumps(safe_rows, indent=2)}

Write a 3-4 sentence executive business insight narrative.
Rules:
- Lead with the most important number
- Mention the WoW trend if significant
- Flag any anomalies
- End with one actionable recommendation
- Never mention SQL, databases, or technical details"""

        messages = [
            {"role": "system", "content": "You are a Chief Revenue Officer writing a daily business briefing. Be specific, sharp, and data-driven."},
            {"role": "user",   "content": prompt},
        ]
        raw, _ = await self._call(messages)
        return raw.strip().strip('"')

"""
Database Layer — asyncpg connection pool for Supabase PostgreSQL.
All queries run in READ ONLY transactions for safety.
"""

import asyncpg
import logging
import ssl as ssl_module
from typing import Any

logger = logging.getLogger(__name__)
_pool: asyncpg.Pool | None = None


async def init_pool(dsn: str) -> None:
    global _pool
    # Build a permissive SSL context (Supabase uses self-signed certs on pooler)
    ssl_ctx = ssl_module.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl_module.CERT_NONE

    try:
        _pool = await asyncpg.create_pool(
            dsn,
            min_size=1,
            max_size=5,
            command_timeout=30,
            statement_cache_size=0,   # Required for Supabase PgBouncer
            ssl=ssl_ctx,
        )
        logger.info("✓ Database pool initialized (SSL)")
    except Exception as e1:
        logger.warning(f"SSL connection failed ({e1}), retrying without SSL…")
        try:
            _pool = await asyncpg.create_pool(
                dsn,
                min_size=1,
                max_size=5,
                command_timeout=30,
                statement_cache_size=0,
            )
            logger.info("✓ Database pool initialized (no SSL)")
        except Exception as e2:
            logger.error(f"✗ Database connection failed: {e2}")
            raise


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def execute_query(sql: str) -> tuple[list[dict], list[str]]:
    """
    Execute a SELECT query safely.
    - Runs in READ ONLY transaction
    - Auto-injects LIMIT 500 if missing
    - Returns (rows, columns)
    """
    if not _pool:
        raise RuntimeError("Database pool not initialized")

    if "LIMIT" not in sql.upper():
        sql = sql.rstrip("; \n") + "\nLIMIT 500"

    async with _pool.acquire() as conn:
        async with conn.transaction(readonly=True):
            records = await conn.fetch(sql)

    if not records:
        return [], []

    columns = list(records[0].keys())
    rows = []
    for rec in records:
        row = {}
        for k, v in rec.items():
            if v is None:
                row[k] = None
            elif hasattr(v, "isoformat"):
                row[k] = v.isoformat()
            elif isinstance(v, float):
                row[k] = round(v, 4)
            elif isinstance(v, (int, bool, str)):
                row[k] = v
            else:
                row[k] = str(v)
        rows.append(row)

    return rows, columns

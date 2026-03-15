"""
Safety Layer — PII Masking + SQL Validation
Masks: emails, phone numbers, names in data rows
Blocks: DROP, DELETE, UPDATE, INSERT, ALTER, injection patterns
"""

import re
import hashlib
from dataclasses import dataclass

# ── PII PATTERNS ─────────────────────────────────────────────────────────────
_EMAIL_RE = re.compile(r'\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b')
_PHONE_RE = re.compile(r'\+?[\d\s\-\.\(\)]{7,20}(?=\s|$|,|\))')
_NAME_RE  = re.compile(r'\b([A-Z][a-z]{1,15}\s+[A-Z][a-z]{1,20})\b')  # "John Smith"

_PII_FIELDS = {"email", "phone", "first_name", "last_name", "name", "full_name", "contact"}

# ── BLOCKED SQL PATTERNS ──────────────────────────────────────────────────────
_BLOCKED_KW = [
    r'\bDROP\b', r'\bDELETE\b', r'\bUPDATE\b', r'\bINSERT\b',
    r'\bALTER\b', r'\bTRUNCATE\b', r'\bCREATE\b', r'\bGRANT\b',
    r'\bREVOKE\b', r'\bEXEC\b', r'\bEXECUTE\b', r'\bCOPY\b',
]
_INJECTION = [
    r'--',
    r'/\*[\s\S]*?\*/',
    r';\s*[A-Z]',
    r'\bUNION\b\s+\bSELECT\b',
    r'\bOR\b\s+[\'"\d]+\s*=\s*[\'"\d]+',
    r'\bINTO\s+OUTFILE\b',
    r'0x[0-9A-Fa-f]{4,}',
    r'\bPG_SLEEP\b',
    r'\bINFORMATION_SCHEMA\b',
]


def _token(val: str, prefix: str) -> str:
    h = hashlib.sha256(val.encode()).hexdigest()[:8].upper()
    return f"[{prefix}:{h}]"


# ── PUBLIC API ────────────────────────────────────────────────────────────────

def mask_text(text: str) -> str:
    """Mask PII in free-form text (question, schema context)."""
    text = _EMAIL_RE.sub(lambda m: _token(m.group(), "EMAIL"), text)
    text = _NAME_RE.sub(lambda m: _token(m.group(), "NAME"),  text)
    text = _PHONE_RE.sub(lambda m: _token(m.group(), "PHONE"), text)
    return text


def mask_rows(rows: list[dict]) -> list[dict]:
    """
    Mask PII in query result rows before including as LLM context.
    Only masks when sending sample rows to AI — never modifies what
    the user sees in the final result table.
    """
    masked = []
    for row in rows:
        new_row = {}
        for k, v in row.items():
            if k.lower() in _PII_FIELDS and isinstance(v, str):
                new_row[k] = _token(v, "PII")
            elif isinstance(v, str):
                # Inline email/phone in string values
                v2 = _EMAIL_RE.sub(lambda m: _token(m.group(), "EMAIL"), v)
                v2 = _PHONE_RE.sub(lambda m: _token(m.group(), "PHONE"), v2)
                new_row[k] = v2
            else:
                new_row[k] = v
        masked.append(new_row)
    return masked


@dataclass
class ValidationResult:
    safe: bool
    reason: str = ""


def validate_sql(sql: str) -> ValidationResult:
    """
    Validate generated SQL before execution.
    Returns ValidationResult(safe=True) if allowed.
    """
    if not sql or not sql.strip():
        return ValidationResult(False, "Empty SQL query")

    stripped = sql.strip()
    upper = stripped.upper()
    if not (upper.startswith("SELECT") or upper.startswith("WITH")):
        return ValidationResult(False, "Only SELECT statements are permitted")

    for pat in _BLOCKED_KW:
        if re.search(pat, sql, re.IGNORECASE):
            kw = pat.replace(r'\b', '')
            return ValidationResult(False, f"Blocked operation detected: {kw}")

    for pat in _INJECTION:
        if re.search(pat, sql, re.IGNORECASE):
            return ValidationResult(False, "SQL injection pattern detected")

    # No semicolons mid-query (multi-statement)
    body = stripped.rstrip("; \n")
    if ";" in body:
        return ValidationResult(False, "Multiple statements not permitted")

    return ValidationResult(True)

"""
PHASE 3 — Insight & Data Science Engine
Computes automatically on every query result:
- Week-over-Week (WoW) growth
- Statistical outlier detection (Z-score + IQR)
- Top/Bottom performers
- Descriptive statistics
- Business Health Score (0–100)
"""

import math
import statistics
import logging
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)


# ── WoW GROWTH ────────────────────────────────────────────────────────────────

def compute_wow(rows: list[dict], value_col: str, date_col: str) -> dict:
    """
    Compute Week-over-Week growth from time-series rows.
    Returns pct change, trend direction, and per-week totals.
    """
    weekly: dict[str, float] = {}
    for row in rows:
        raw = row.get(date_col)
        val = float(row.get(value_col) or 0)
        if raw is None:
            continue
        try:
            dt  = datetime.fromisoformat(str(raw)[:10])
            key = dt.strftime("%G-W%V")  # ISO week
            weekly[key] = weekly.get(key, 0) + val
        except Exception:
            continue

    if len(weekly) < 2:
        return {"status": "insufficient_data", "message": "Need ≥2 weeks of data for WoW"}

    weeks    = sorted(weekly.keys())
    cur_val  = weekly[weeks[-1]]
    prev_val = weekly[weeks[-2]]

    if prev_val == 0:
        pct = None
    else:
        pct = round((cur_val - prev_val) / abs(prev_val) * 100, 2)

    return {
        "current_week":   weeks[-1],
        "current_value":  round(cur_val, 2),
        "previous_week":  weeks[-2],
        "previous_value": round(prev_val, 2),
        "wow_pct":        pct,
        "trend":          "up" if pct and pct > 0 else "down" if pct and pct < 0 else "flat",
        "absolute_change": round(cur_val - prev_val, 2),
    }


# ── OUTLIER DETECTION ─────────────────────────────────────────────────────────

def _zscore_outliers(values: list[float], threshold: float = 2.5) -> list[int]:
    if len(values) < 4:
        return []
    try:
        mean = statistics.mean(values)
        std  = statistics.stdev(values)
        if std == 0:
            return []
        return [i for i, v in enumerate(values) if abs((v - mean) / std) > threshold]
    except Exception:
        return []


def _iqr_outliers(values: list[float]) -> list[int]:
    if len(values) < 4:
        return []
    sv = sorted(values)
    n  = len(sv)
    q1, q3 = sv[n // 4], sv[3 * n // 4]
    iqr = q3 - q1
    if iqr == 0:
        return []
    lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    return [i for i, v in enumerate(values) if v < lo or v > hi]


def detect_outliers(rows: list[dict], value_col: str) -> dict:
    """
    Detect statistical outliers using both Z-score AND IQR.
    Only reports outliers confirmed by BOTH methods (reduces false positives).
    """
    vals = [float(r[value_col]) for r in rows if r.get(value_col) is not None]
    if len(vals) < 4:
        return {"count": 0, "indices": [], "values": [], "method": "insufficient_data"}

    z_set   = set(_zscore_outliers(vals))
    iqr_set = set(_iqr_outliers(vals))
    confirmed = sorted(z_set & iqr_set)  # consensus outliers only

    return {
        "count":   len(confirmed),
        "indices": confirmed,
        "values":  [round(vals[i], 4) for i in confirmed],
        "method":  "z-score ∩ IQR",
        "total_rows": len(vals),
    }


# ── DESCRIPTIVE STATISTICS ────────────────────────────────────────────────────

def describe(rows: list[dict], value_col: str) -> dict:
    vals = [float(r[value_col]) for r in rows if r.get(value_col) is not None]
    if not vals:
        return {}
    sv = sorted(vals)
    n  = len(sv)
    try:
        return {
            "n":      n,
            "sum":    round(sum(vals), 2),
            "mean":   round(statistics.mean(vals), 2),
            "median": round(statistics.median(vals), 2),
            "stdev":  round(statistics.stdev(vals), 2) if n > 1 else 0,
            "min":    round(sv[0], 2),
            "max":    round(sv[-1], 2),
            "p25":    round(sv[max(0, n // 4 - 1)], 2),
            "p75":    round(sv[min(n - 1, 3 * n // 4)], 2),
        }
    except Exception as e:
        return {"n": n, "error": str(e)}


# ── TOP / BOTTOM PERFORMERS ───────────────────────────────────────────────────

def top_bottom(rows: list[dict], label_col: str, value_col: str, n: int = 3) -> dict:
    clean = [
        {"label": str(r.get(label_col, "?")), "value": float(r.get(value_col) or 0)}
        for r in rows if r.get(value_col) is not None
    ]
    if not clean:
        return {"top": [], "bottom": []}
    sd = sorted(clean, key=lambda x: x["value"], reverse=True)
    return {
        "top":    [{"label": x["label"], "value": round(x["value"], 2)} for x in sd[:n]],
        "bottom": [{"label": x["label"], "value": round(x["value"], 2)} for x in sd[-n:][::-1]],
    }


# ── BUSINESS HEALTH SCORE ─────────────────────────────────────────────────────

def health_score(wow: dict, outliers: dict, row_count: int) -> dict:
    """
    Compute a 0–100 business health score.
    Weights: WoW trend (40%), anomaly penalty (30%), data richness (30%)
    """
    score = 50.0
    signals = []

    # WoW contribution
    pct = wow.get("wow_pct")
    if pct is not None:
        if pct > 20:    delta, sig = +20, "🚀 Strong growth"
        elif pct > 5:   delta, sig = +12, "📈 Positive trend"
        elif pct > -5:  delta, sig =   0, "➡️  Stable"
        elif pct > -20: delta, sig = -12, "📉 Declining"
        else:           delta, sig = -20, "⚠️  Significant decline"
        score += delta
        signals.append(sig)

    # Anomaly penalty
    n_anom = outliers.get("count", 0)
    penalty = min(n_anom * 6, 25)
    score  -= penalty
    if n_anom > 0:
        signals.append(f"🔍 {n_anom} outlier{'s' if n_anom > 1 else ''} detected")

    # Data richness
    if row_count > 100:   score += 8; signals.append("✅ Rich dataset")
    elif row_count > 20:  score += 3
    elif row_count == 0:  score -= 15; signals.append("❌ No data returned")

    score = round(max(0, min(100, score)), 1)

    if score >= 80:   grade, color = "Excellent", "emerald"
    elif score >= 65: grade, color = "Good",      "teal"
    elif score >= 45: grade, color = "Fair",      "amber"
    elif score >= 25: grade, color = "Poor",      "orange"
    else:             grade, color = "Critical",  "red"

    return {
        "score":   score,
        "grade":   grade,
        "color":   color,
        "signals": signals,
    }


# ── FULL PIPELINE ─────────────────────────────────────────────────────────────

def run_insights(rows: list[dict], columns: list[str]) -> dict:
    """
    Run the full insight pipeline on any query result.
    Auto-detects numeric/date/label columns.
    """
    if not rows or not columns:
        return {
            "wow":          {"status": "no_data"},
            "outliers":     {"count": 0},
            "top_bottom":   {"top": [], "bottom": []},
            "stats":        {},
            "health":       {"score": 50, "grade": "Unknown", "color": "gray", "signals": []},
        }

    # Column type detection
    num_cols  = [c for c in columns if any(kw in c.lower() for kw in
                 ["amount","revenue","value","price","ltv","total","sum","avg","fee",
                  "count","pct","rate","score","freight","qty","quantity"])]
    date_cols = [c for c in columns if any(kw in c.lower() for kw in
                 ["date","month","week","year","period","time"])]
    lbl_cols  = [c for c in columns if any(kw in c.lower() for kw in
                 ["country","name","region","segment","product","plan","status",
                  "method","city","label","category","symbol"])]

    val_col   = num_cols[0]   if num_cols   else None
    date_col  = date_cols[0]  if date_cols  else None
    lbl_col   = lbl_cols[0]   if lbl_cols   else (columns[0] if columns else None)

    out: dict[str, Any] = {}

    out["wow"]        = compute_wow(rows, val_col, date_col) if val_col and date_col else {"status": "no_date_column"}
    out["stats"]      = describe(rows, val_col)               if val_col else {}
    out["outliers"]   = detect_outliers(rows, val_col)        if val_col else {"count": 0}
    out["top_bottom"] = top_bottom(rows, lbl_col, val_col)    if val_col and lbl_col and lbl_col != val_col else {"top": [], "bottom": []}
    out["health"]     = health_score(out["wow"], out["outliers"], len(rows))

    return out

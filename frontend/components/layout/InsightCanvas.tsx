"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Papa from "papaparse";
import { QueryResult } from "@/lib/types";
import ChartRenderer from "@/components/charts/ChartRenderer";
import HealthGauge   from "@/components/ui/HealthGauge";
import SQLTerminal   from "@/components/ui/SQLTerminal";

interface Props { result: QueryResult | null; query?: string; }

/* ── Confidence Badge ─────────────────────────────────────────────────────── */
function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? "var(--accent-main)" : pct >= 50 ? "var(--accent-secondary)" : "#f87171";
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
      style={{
        background: `${color}15`,
        border: `1px solid ${color}35`,
        color,
        fontFamily: "var(--font-mono)",
      }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {pct}% confidence
    </span>
  );
}

/* ── Stat Card ────────────────────────────────────────────────────────────── */
function StatCard({ label, value, loading }: { label: string; value?: string | number; loading: boolean }) {
  return (
    <div className="glass rounded-2xl px-4 py-3 flex flex-col gap-1.5">
      <div className="text-[9px] font-bold uppercase tracking-[0.22em]"
        style={{ color: "var(--text-dim)" }}>
        {label}
      </div>
      {loading ? (
        <div className="h-5 rounded-md shimmer w-3/4" />
      ) : (
        <div className="text-[18px] font-bold leading-none"
          style={{ color: "var(--text-main)", fontFamily: "var(--font-mono)" }}>
          {value ?? "—"}
        </div>
      )}
    </div>
  );
}

/* ── Insight Card ─────────────────────────────────────────────────────────── */
function InsightCard({ insight, i }: { insight: string; i: number }) {
  const icons = ["💡", "📈", "⚡", "🎯", "🔍", "💎"];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.08, duration: 0.4 }}
      whileHover={{ scale: 1.01, x: 2 }}
      className="glass glass-hover rounded-xl px-4 py-3 flex items-start gap-3 cursor-default"
      style={{ border: "1px solid rgba(0,245,212,0.06)" }}>
      <span className="text-base select-none flex-shrink-0 mt-0.5">{icons[i % icons.length]}</span>
      <p className="text-[12px] font-medium leading-relaxed" style={{ color: "var(--text-muted)" }}>
        {insight}
      </p>
    </motion.div>
  );
}

/* ── Data Table ───────────────────────────────────────────────────────────── */
function DataTable({ rows, cols }: { rows: Record<string, any>[]; cols: string[] }) {
  const [page, setPage] = useState(0);
  const pageSize = 8;
  const totalPages = Math.ceil(rows.length / pageSize);
  const pageRows = rows.slice(page * pageSize, page * pageSize + pageSize);

  return (
    <div>
      <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full border-collapse text-[11px]" style={{ fontFamily: "var(--font-mono)" }}>
          <thead>
            <tr style={{ background: "rgba(0,245,212,0.04)", borderBottom: "1px solid var(--border)" }}>
              {cols.map(c => (
                <th key={c} className="text-left px-3 py-2.5 font-bold uppercase tracking-wider whitespace-nowrap"
                  style={{ color: "var(--accent-main)", fontSize: 9 }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={i}
                style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                className="hover:bg-white/[0.02] transition-colors">
                {cols.map(c => (
                  <td key={c} className="px-3 py-2.5 whitespace-nowrap max-w-[180px] truncate"
                    style={{ color: i % 2 === 0 ? "var(--text-main)" : "var(--text-muted)" }}>
                    {row[c] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-2 px-1">
          <span className="text-[10px] font-semibold" style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
            {rows.length} rows
          </span>
          <div className="flex items-center gap-1">
            {[...Array(totalPages)].map((_, i) => (
              <button key={i} onClick={() => setPage(i)}
                className="w-5 h-5 rounded text-[9px] font-bold transition-all"
                style={{
                  background: i === page ? "var(--accent-main)" : "rgba(255,255,255,0.05)",
                  color: i === page ? "var(--bg-primary)" : "var(--text-dim)",
                }}>
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────────────────── */
export default function InsightCanvas({ result, query }: Props) {
  const [showSQL, setShowSQL] = useState(false);

  const downloadCSV = () => {
    if (!result?.rows?.length) return;
    const csv = Papa.unparse(result.rows, { header: true });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeName = (query || "data-export").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    link.download = `${safeName}-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /* Empty state */
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 px-8"
        style={{ color: "var(--text-dim)" }}>
        <motion.div
          animate={{ y: [0, -8, 0], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl"
          style={{
            background: "rgba(0,245,212,0.06)",
            border: "1px solid rgba(0,245,212,0.12)",
            boxShadow: "0 0 40px rgba(0,245,212,0.08)",
          }}>
          📊
        </motion.div>
        <div className="text-center max-w-xs">
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text-main)" }}>
            Insight Canvas
          </h2>
          <p className="text-[13px] font-medium leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Ask a business question to generate SQL, interactive charts, and AI-powered insights.
          </p>
        </div>
        {/* Decorative grid */}
        <div className="grid grid-cols-3 gap-3 opacity-20 mt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div key={i}
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 2, delay: i * 0.3, repeat: Infinity }}
              className="h-8 rounded-xl shimmer" />
          ))}
        </div>
      </div>
    );
  }

  const hasInsights = result.insights;
  const health = hasInsights?.health;
  const narrative = result.narrative;
  const insights = result.insights?.health?.signals ?? [];
  const confidence = result.confidence;

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Top bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between px-5 py-3.5 border-b flex-shrink-0"
        style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: "var(--accent-main)", boxShadow: "0 0 8px var(--accent-main)" }} />
          <p className="text-[12px] font-semibold truncate" style={{ color: "var(--text-muted)" }}>
            {query}
          </p>
        </div>
        <div className="flex items-center gap-3 ml-3 flex-shrink-0">
          {result.rows && result.rows.length > 0 && (
            <button onClick={downloadCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-[10px] font-bold hover:scale-105"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid var(--border)",
                color: "var(--text-main)",
              }}
              title="Download chart data as CSV">
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" x2="12" y1="15" y2="3"></line></svg>
              CSV
            </button>
          )}
          {result.healed && (
            <span className="text-[10px] font-bold px-2 py-1 rounded-md"
              style={{ background: "rgba(255,183,3,0.1)", color: "var(--accent-secondary)", border: "1px solid rgba(255,183,3,0.2)" }}>
              ⚡ Auto-healed
            </span>
          )}
          {confidence !== undefined && <ConfidenceBadge score={confidence} />}
          {result.sql && (
            <button onClick={() => setShowSQL(s => !s)}
              className="text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all"
              style={{
                background: showSQL ? "rgba(0,245,212,0.15)" : "rgba(0,245,212,0.05)",
                border: "1px solid rgba(0,245,212,0.2)",
                color: "var(--accent-main)",
              }}>
              {showSQL ? "Hide SQL" : "View SQL"}
            </button>
          )}
        </div>
      </motion.div>

      {/* SQL Terminal */}
      <AnimatePresence>
        {showSQL && result.sql && (
          <SQLTerminal sql={result.sql} thought={result.thought} onClose={() => setShowSQL(false)} />
        )}
      </AnimatePresence>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-5 space-y-5">

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-4 gap-3">
            {health && <HealthGauge score={health.score} grade={health.grade} />}
            <StatCard label="Total / Sum"
              value={result.insights?.stats?.sum !== undefined ? Number(result.insights.stats.sum).toLocaleString() : undefined}
              loading={false} />
            <StatCard label="Average"
              value={result.insights?.stats?.mean !== undefined ? Number(result.insights.stats.mean).toFixed(2) : undefined}
              loading={false} />
            <StatCard label="Records"
              value={result.total_rows?.toLocaleString()}
              loading={false} />
          </motion.div>

          {/* Chart */}
          {result.viz_type && result.rows && result.rows.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="glass rounded-2xl p-4 h-[400px]">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] mb-3"
                style={{ color: "var(--text-dim)" }}>
                Visualization
              </div>
              <ChartRenderer
                rows={result.rows}
                cols={result.columns ?? []}
                type={result.viz_type}
                config={result.chart_config}
              />
            </motion.div>
          )}

          {/* Narrative */}
          {narrative && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass rounded-2xl px-5 py-4"
              style={{ borderLeft: "3px solid var(--accent-main)" }}>
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] mb-2"
                style={{ color: "var(--accent-main)" }}>
                AI Narrative
              </div>
              <p className="text-[13px] font-medium leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {narrative}
              </p>
            </motion.div>
          )}

          {/* Insights */}
          {insights.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] mb-3"
                style={{ color: "var(--text-dim)" }}>
                Key Insights
              </div>
              <div className="space-y-2">
                {insights.map((ins, i) => (
                  <InsightCard key={i} insight={ins} i={i} />
                ))}
              </div>
            </div>
          )}

          {/* Data table */}
          {result.rows?.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.22em]"
                  style={{ color: "var(--text-dim)" }}>
                  Raw Data
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                  style={{
                    background: "rgba(0,245,212,0.06)",
                    color: "var(--accent-main)",
                    border: "1px solid rgba(0,245,212,0.12)",
                    fontFamily: "var(--font-mono)",
                  }}>
                  {result.total_rows} rows
                </span>
              </div>
              <DataTable rows={result.rows} cols={result.columns ?? []} />
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

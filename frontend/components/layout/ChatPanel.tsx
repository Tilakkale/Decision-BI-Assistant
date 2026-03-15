"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ThinkingStepper from "@/components/ui/ThinkingStepper";
import { useSSEStream } from "@/hooks/useSSEStream";
import { QueryResult } from "@/lib/types";

interface Props {
  onResult:      (q: string, r: QueryResult) => void;
  onShowHistory: () => void;
  hasHistory:    boolean;
}

const SUGGESTIONS = [
  "Total revenue last month?",
  "Top 5 customers by LTV",
  "Churn rate by region",
  "Monthly revenue trend",
  "WoW order growth",
  "Payment failure rate",
  "At-risk customers",
  "Conversion rate",
];

export default function ChatPanel({ onResult, onShowHistory, hasHistory }: Props) {
  const [query,     setQuery]     = useState("");
  const [submitted, setSubmitted] = useState("");
  const textRef                   = useRef<HTMLTextAreaElement>(null);
  const submittedRef              = useRef("");   // stable ref for closure

  const { steps, error, streaming, submit } = useSSEStream(
    (_partial) => {},                                   // onUpdate — handled by onComplete
    (result)   => {
      if (submittedRef.current) onResult(submittedRef.current, result);
    },
  );

  const handleSubmit = useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed || streaming) return;
    submittedRef.current = trimmed;
    setSubmitted(trimmed);
    setQuery("");
    submit(trimmed);
  }, [streaming, submit]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(query); }
  };

  const inputActive = streaming || !!error;

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: "var(--font-sora)" }}>

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <button onClick={onShowHistory}
            className="p-1.5 rounded-lg transition-all hover:scale-110"
            style={{ color: hasHistory ? "var(--accent-main)" : "var(--text-dim)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: "var(--text-dim)" }}>
              Decision Intelligence
            </div>
            <div className="text-[16px] font-bold leading-tight"
              style={{ color: "var(--text-main)" }}>
              BI Assistant
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${streaming ? "pulse-ring" : ""}`}
            style={{ background: streaming ? "var(--accent-secondary)" : "var(--accent-main)" }} />
          <span className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: streaming ? "var(--accent-secondary)" : "var(--accent-main)" }}>
            {streaming ? "Processing" : "Ready"}
          </span>
        </div>
      </div>

      {/* ── Active query display ──────────────────────────────────── */}
      <AnimatePresence>
        {submitted && inputActive && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-4 mt-4 px-4 py-2.5 rounded-xl text-[13px] font-medium"
            style={{
              background: "rgba(0,245,212,0.06)",
              border:     "1px solid rgba(0,245,212,0.15)",
              color:      "var(--text-muted)",
            }}>
            <span style={{ color: "var(--accent-main)" }}>▶</span>&nbsp;{submitted}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Thinking stepper ─────────────────────────────────────── */}
      <div className="px-4 pt-4">
        <ThinkingStepper steps={steps} />
      </div>

      {/* ── Error ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="mx-4 mt-3 px-4 py-3 rounded-xl text-[12px] font-semibold"
            style={{
              background: "rgba(248,113,113,0.08)",
              border:     "1px solid rgba(248,113,113,0.2)",
              color:      "#f87171",
            }}>
            ⚠ {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Suggestion chips ─────────────────────────────────────── */}
      {!inputActive && (
        <div className="px-4 pt-5 flex-1 overflow-y-auto">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] mb-3"
            style={{ color: "var(--text-dim)" }}>
            Try Asking
          </div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s, i) => (
              <motion.button
                key={s}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                whileHover={{ scale: 1.04, y: -1 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => handleSubmit(s)}
                className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all"
                style={{
                  background: "rgba(0,245,212,0.05)",
                  border:     "1px solid rgba(0,245,212,0.15)",
                  color:      "var(--text-muted)",
                }}>
                {s}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {inputActive && <div className="flex-1" />}

      {/* ── Input area ───────────────────────────────────────────── */}
      <div className="p-4 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="relative flex items-end gap-3 px-4 py-3 rounded-2xl transition-all"
          style={{
            background: "rgba(255,255,255,0.03)",
            border:     "1px solid rgba(0,245,212,0.12)",
          }}>
          <textarea
            ref={textRef}
            rows={2}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            disabled={streaming}
            placeholder="Ask a business question…"
            className="flex-1 bg-transparent text-[13px] font-medium leading-relaxed focus:outline-none placeholder:text-[var(--text-dim)]"
            style={{ color: "var(--text-main)" }}
          />
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleSubmit(query)}
            disabled={!query.trim() || streaming}
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-30"
            style={{
              background: "var(--accent-main)",
              color:      "var(--bg-primary)",
            }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </motion.button>
        </div>
        <div className="text-center mt-2 text-[10px]" style={{ color: "var(--text-dim)" }}>
          ↵ Enter to send · Shift+Enter for newline · {query.length}/2000
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";

interface Props {
  sql:     string;
  thought?: string;
  onClose: () => void;
}

function highlight(sql: string): string {
  const KW = ["SELECT","FROM","WHERE","JOIN","LEFT","RIGHT","INNER","ON","GROUP BY","ORDER BY",
               "HAVING","LIMIT","WITH","AS","AND","OR","NOT","IN","LIKE","ILIKE","BETWEEN","IS",
               "NULL","DISTINCT","COUNT","SUM","AVG","MIN","MAX","ROUND","COALESCE","NULLIF",
               "DATE_TRUNC","EXTRACT","INTERVAL","CASE","WHEN","THEN","ELSE","END","LOWER","UPPER",
               "CURRENT_DATE","LAG","LEAD","OVER","PARTITION BY","FILTER","CAST"];
  let s = sql;
  KW.forEach(kw => {
    s = s.replace(new RegExp(`\\b(${kw})\\b`, "gi"),
      `<span style="color:#00F5D4;font-weight:700">$1</span>`);
  });
  s = s.replace(/'([^']*)'/g, `<span style="color:#FFB703">'$1'</span>`);
  s = s.replace(/\b(\d+(\.\d+)?)\b/g, `<span style="color:#a78bfa">$1</span>`);
  s = s.replace(/(--[^\n]*)/g, `<span style="color:rgba(255,255,255,0.2);font-style:italic">$1</span>`);
  return s;
}

export default function SQLTerminal({ sql, thought, onClose }: Props) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone]           = useState(false);
  const timerRef                  = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setDisplayed(""); setDone(false);
    let i = 0;
    timerRef.current = setInterval(() => {
      i++;
      setDisplayed(sql.slice(0, i));
      if (i >= sql.length) { clearInterval(timerRef.current!); setDone(true); }
    }, 6);
    return () => clearInterval(timerRef.current!);
  }, [sql]);

  const skip = () => { clearInterval(timerRef.current!); setDisplayed(sql); setDone(true); };
  const copy = () => navigator.clipboard.writeText(sql);

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{   height: 0, opacity: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 250 }}
      className="overflow-hidden border-b"
      style={{ borderColor: "var(--border)", background: "rgba(5,8,18,0.95)" }}
    >
      <div className="max-h-64 overflow-y-auto">
        {thought && (
          <div className="px-5 pt-3 pb-2.5 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] mb-1.5"
              style={{ color: "var(--text-dim)" }}>
              Agent Reasoning
            </div>
            <p className="text-[11px] leading-relaxed italic"
              style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              {thought}
            </p>
          </div>
        )}

        <div className="px-5 py-3">
          {/* Terminal chrome */}
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              </div>
              <span className="text-[10px] font-semibold"
                style={{ color: "var(--accent-main)", fontFamily: "var(--font-mono)" }}>
                generated.sql
              </span>
            </div>
            <div className="flex items-center gap-3">
              {!done && (
                <button onClick={skip}
                  className="text-[10px] font-semibold transition-colors"
                  style={{ color: "var(--text-dim)" }}>
                  Skip →
                </button>
              )}
              <button onClick={copy}
                className="text-[10px] font-semibold transition-colors hover:text-[var(--accent-main)]"
                style={{ color: "var(--text-dim)" }}>
                Copy
              </button>
              <button onClick={onClose}
                className="text-[10px] font-semibold transition-colors hover:text-red-400"
                style={{ color: "var(--text-dim)" }}>
                ✕
              </button>
            </div>
          </div>

          {/* SQL content */}
          <style>{`.sql-pre { tab-size: 2; }`}</style>
          <pre
            className="sql-pre text-[12px] leading-[1.8] whitespace-pre-wrap break-words"
            style={{ color: "rgba(255,255,255,0.6)", fontFamily: "var(--font-mono)" }}
            dangerouslySetInnerHTML={{ __html: highlight(displayed) }}
          />
          {!done && (
            <span className="inline-block w-1.5 h-3.5 ml-0.5 align-middle blink"
              style={{ background: "var(--accent-main)" }} />
          )}
        </div>
      </div>
    </motion.div>
  );
}

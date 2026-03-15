"use client";

import { motion } from "framer-motion";

interface Props { score: number | null; grade?: string; loading?: boolean; }

const GRADE_COLOR: Record<string, string> = {
  Excellent: "#00F5D4",
  Good:      "#00F5D4",
  Fair:      "#FFB703",
  Poor:      "#fb923c",
  Critical:  "#f87171",
  Unknown:   "#4a5568",
};

const GRADE_GLOW: Record<string, string> = {
  Excellent: "rgba(0,245,212,0.4)",
  Good:      "rgba(0,245,212,0.4)",
  Fair:      "rgba(255,183,3,0.4)",
  Poor:      "rgba(251,146,60,0.4)",
  Critical:  "rgba(248,113,113,0.4)",
  Unknown:   "rgba(74,85,104,0.2)",
};

export default function HealthGauge({ score, grade, loading }: Props) {
  const s    = score ?? 0;
  const g    = grade ?? "Unknown";
  const col  = GRADE_COLOR[g] ?? "#4a5568";
  const glow = GRADE_GLOW[g]  ?? "rgba(74,85,104,0.2)";
  const R    = 40;
  const cx   = 54, cy = 60;

  function pt(angleDeg: number) {
    const r = (angleDeg * Math.PI) / 180;
    return { x: cx + R * Math.cos(r), y: cy + R * Math.sin(r) };
  }
  function arc(a1: number, a2: number) {
    const sp = pt(a1), ep = pt(a2);
    return `M${sp.x} ${sp.y} A${R} ${R} 0 ${a2 - a1 > 180 ? 1 : 0} 1 ${ep.x} ${ep.y}`;
  }

  const fillEnd = -180 + (s / 100) * 180;

  return (
    <div className="glass rounded-2xl p-4 flex flex-col items-center"
      style={{ boxShadow: loading ? undefined : `0 0 30px ${glow}` }}>
      <div className="text-[10px] font-bold uppercase tracking-[0.22em] mb-1"
        style={{ color: "var(--text-dim)" }}>
        Health
      </div>
      <svg width="108" height="70" viewBox="0 0 108 70">
        {/* Track */}
        <path d={arc(-180, 0)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" strokeLinecap="round" />
        {/* Fill */}
        {!loading && score !== null && (
          <motion.path
            d={arc(-180, fillEnd)}
            fill="none" stroke={col} strokeWidth="7" strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.6, ease: "easeOut" }}
            style={{ filter: `drop-shadow(0 0 6px ${col})` }}
          />
        )}
        {/* Score */}
        <text x={cx} y={cy - 8} textAnchor="middle" dominantBaseline="middle"
          fill={loading ? "rgba(255,255,255,0.1)" : col}
          fontSize="22" fontWeight="700" fontFamily="var(--font-mono)">
          {loading ? "–" : Math.round(s)}
        </text>
        <text x={cx} y={cy + 9} textAnchor="middle" dominantBaseline="middle"
          fill="rgba(255,255,255,0.3)" fontSize="9" fontWeight="600" letterSpacing="2">
          {!loading ? g.toUpperCase() : "LOADING"}
        </text>
      </svg>
      <div className="flex justify-between w-[90px] -mt-1">
        <span className="text-[9px] font-bold" style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>0</span>
        <span className="text-[9px] font-bold" style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>100</span>
      </div>
    </div>
  );
}

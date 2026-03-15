"use client";

import { motion } from "framer-motion";

interface Step { label: string; status: "idle" | "active" | "done" | "error"; }
interface Props { steps: Step[]; }

const ICONS = {
  idle:   <circle cx="8" cy="8" r="2" fill="currentColor" opacity="0.3"/>,
  active: <><circle cx="8" cy="8" r="3" fill="var(--accent-main)"/><circle cx="8" cy="8" r="5.5" fill="none" stroke="var(--accent-main)" strokeWidth="1" opacity="0.4"/></>,
  done:   <><circle cx="8" cy="8" r="6" fill="rgba(0,245,212,0.1)"/><path d="M5 8 L7 10 L11 6" stroke="var(--accent-main)" strokeWidth="1.5" fill="none" strokeLinecap="round"/></>,
  error:  <><circle cx="8" cy="8" r="6" fill="rgba(248,113,113,0.1)"/><path d="M6 6 L10 10 M10 6 L6 10" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round"/></>,
};

const TEXT_COLOR = {
  idle:   "var(--text-dim)",
  active: "var(--accent-main)",
  done:   "var(--text-muted)",
  error:  "#f87171",
};

export default function ThinkingStepper({ steps }: Props) {
  if (!steps.length) return null;

  return (
    <div className="space-y-1">
      {steps.map((step, i) => (
        <motion.div
          key={step.label}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.06 }}
          className="flex items-center gap-2.5"
        >
          {/* Connector */}
          <div className="relative flex flex-col items-center" style={{ width: 16 }}>
            {i > 0 && (
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-px"
                style={{
                  height: 6,
                  background: steps[i - 1].status === "done"
                    ? "var(--accent-main)"
                    : "var(--text-dim)",
                  opacity: steps[i - 1].status === "done" ? 0.4 : 0.15,
                }} />
            )}
            <motion.svg
              width="16" height="16" viewBox="0 0 16 16"
              animate={step.status === "active" ? { scale: [1, 1.15, 1] } : { scale: 1 }}
              transition={{ repeat: Infinity, duration: 1.4 }}
            >
              {ICONS[step.status]}
            </motion.svg>
          </div>

          <span className="text-[11px] font-semibold transition-colors duration-300"
            style={{ color: TEXT_COLOR[step.status], fontFamily: "var(--font-sora)" }}>
            {step.label}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

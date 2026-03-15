"use client";

import { motion } from "framer-motion";
import { HistoryItem } from "@/lib/types";

interface Props {
  history:  HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onClose:  () => void;
}

export default function HistoryDrawer({ history, onSelect, onClose }: Props) {
  return (
    <div className="h-full glass flex flex-col"
      style={{ fontFamily: "var(--font-sora)", borderRight: "1px solid var(--border)" }}>

      <div className="flex items-center justify-between px-4 py-4 border-b"
        style={{ borderColor: "var(--border)" }}>
        <span className="text-[10px] font-bold uppercase tracking-[0.22em]"
          style={{ color: "var(--accent-main)" }}>
          Query History
        </span>
        <button onClick={onClose}
          className="text-sm transition-all hover:scale-110"
          style={{ color: "var(--text-dim)" }}>
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {history.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="text-3xl mb-2 opacity-30">💬</div>
            <p className="text-[11px] font-medium" style={{ color: "var(--text-dim)" }}>No queries yet</p>
          </div>
        ) : (
          <div className="space-y-1 px-2">
            {[...history].reverse().map((item, i) => (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                whileHover={{ x: 2 }}
                onClick={() => onSelect(item)}
                className="w-full text-left px-3 py-2.5 rounded-xl transition-all group"
                style={{
                  background: "rgba(0,245,212,0.03)",
                  border: "1px solid transparent",
                }}>
                <div className="text-[11px] font-medium line-clamp-2 leading-relaxed transition-colors"
                  style={{ color: "var(--text-muted)" }}>
                  {item.question}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px]" style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                    {new Date(item.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {item.result.total_rows !== undefined && (
                    <span className="text-[10px]" style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                      {item.result.total_rows} rows
                    </span>
                  )}
                  {item.result.healed && (
                    <span className="text-[10px]" style={{ color: "var(--accent-secondary)" }}>⚡</span>
                  )}
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t" style={{ borderColor: "var(--border)" }}>
        <span className="text-[10px] font-semibold" style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
          {history.length} session quer{history.length === 1 ? "y" : "ies"}
        </span>
      </div>
    </div>
  );
}

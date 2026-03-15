"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ChatPanel from "@/components/layout/ChatPanel";
import InsightCanvas from "@/components/layout/InsightCanvas";
import HistoryDrawer from "@/components/layout/HistoryDrawer";
import { QueryResult, HistoryItem } from "@/lib/types";

export default function Home() {
  const [result, setResult]       = useState<QueryResult | null>(null);
  const [history, setHistory]     = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [currentQuery, setCurrentQuery] = useState("");

  const handleResult = useCallback((q: string, r: QueryResult) => {
    setResult(r);
    setCurrentQuery(q);
    setHistory(prev => [...prev, { id: Date.now().toString(), question: q, result: r, ts: Date.now() }]);
  }, []);

  const handleHistorySelect = useCallback((item: HistoryItem) => {
    setResult(item.result);
    setCurrentQuery(item.question);
    setShowHistory(false);
  }, []);

  return (
    <div className="bg-mesh noise relative flex h-screen overflow-hidden">
      {/* Ambient glow halos */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20"
        style={{ background: "radial-gradient(circle, rgba(0,245,212,0.4) 0%, transparent 70%)" }} />
      <div className="pointer-events-none absolute -bottom-32 -right-20 w-80 h-80 rounded-full opacity-15"
        style={{ background: "radial-gradient(circle, rgba(124,58,237,0.5) 0%, transparent 70%)" }} />
      <div className="pointer-events-none absolute top-1/2 left-1/3 w-64 h-64 rounded-full opacity-10 -translate-y-1/2"
        style={{ background: "radial-gradient(circle, rgba(255,183,3,0.4) 0%, transparent 70%)" }} />

      {/* History drawer */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ x: -280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -280, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="absolute left-0 top-0 h-full w-72 z-30"
          >
            <HistoryDrawer
              history={history}
              onSelect={handleHistorySelect}
              onClose={() => setShowHistory(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main layout */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex w-full h-full"
      >
        {/* Left: Chat panel */}
        <motion.div
          initial={{ x: -40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5, ease: "easeOut" }}
          className="w-[340px] flex-shrink-0 flex flex-col border-r"
          style={{ borderColor: "var(--border)" }}
        >
          <ChatPanel
            onResult={handleResult}
            onShowHistory={() => setShowHistory(s => !s)}
            hasHistory={history.length > 0}
          />
        </motion.div>

        {/* Right: Insight canvas */}
        <motion.div
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
          className="flex-1 overflow-hidden"
        >
          <InsightCanvas result={result} query={currentQuery} />
        </motion.div>
      </motion.div>
    </div>
  );
}

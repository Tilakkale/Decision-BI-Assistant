"use client";

import { useState, useRef, useCallback } from "react";
import { QueryResult, PipelineStep } from "@/lib/types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const STEPS: PipelineStep[] = [
  { id: 1, label: "Understanding question",  status: "idle" },
  { id: 2, label: "Generating SQL",          status: "idle" },
  { id: 3, label: "Validating safety",       status: "idle" },
  { id: 4, label: "Fetching data",           status: "idle" },
  { id: 5, label: "Computing insights",      status: "idle" },
  { id: 6, label: "Generating narrative",    status: "idle" },
];

export function useSSEStream(
  onUpdate:   (r: QueryResult) => void,
  onComplete: (r: QueryResult) => void,
) {
  const [steps, setSteps]         = useState<PipelineStep[]>(STEPS);
  const [streaming, setStreaming] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const resultRef                 = useRef<QueryResult>({});
  const abortRef                  = useRef<AbortController | null>(null);

  const setStep = useCallback((id: number, status: PipelineStep["status"]) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  }, []);

  const reset = useCallback(() => {
    setSteps(STEPS.map(s => ({ ...s, status: "idle" as const })));
    setError(null);
  }, []);

  const submit = useCallback(async (question: string) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    reset();
    setStreaming(true);
    resultRef.current = { question };

    try {
      const resp = await fetch(`${API}/api/query`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ question }),
        signal:  abortRef.current.signal,
      });

      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${body}`);
      }

      const reader  = resp.body!.getReader();
      const decoder = new TextDecoder();
      let   buf     = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        let ev = '';
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.startsWith('event: ')) {
            ev = line.slice(7).trim();
          } else if (line.startsWith('data: ') && ev) {
            try {
              const parsed = JSON.parse(line.slice(6));
              handle(ev, parsed);
            } catch (e) {
              // Ignore malformed JSON during streaming
            }
            ev = '';
          }
        }
      }
    } catch (error) {
      const err = error as Error;
      if (err.name !== "AbortError") {
        setError(err.message ?? "Stream failed");
        setStreaming(false);
      }
    }
  }, []);

  const handle = useCallback((event: string, data: any) => {
    switch (event) {
      case "step":
        setStep(data.id, data.status);
        break;
      case "sql":
        resultRef.current = {
          ...resultRef.current,
          sql: data.query, thought: data.thought,
          confidence: data.confidence, viz_type: data.viz_type,
          chart_config: data.chart_config,
        };
        onUpdate({ ...resultRef.current });
        break;
      case "sql_repaired":
        resultRef.current = { ...resultRef.current, sql: data.query, healed: true };
        onUpdate({ ...resultRef.current });
        break;
      case "data":
        resultRef.current = {
          ...resultRef.current,
          rows: data.rows, columns: data.columns,
          total_rows: data.total, healed: data.healed, attempts: data.attempts,
        };
        onUpdate({ ...resultRef.current });
        break;
      case "insights":
        resultRef.current = { ...resultRef.current, insights: data };
        onUpdate({ ...resultRef.current });
        break;
      case "narrative":
        resultRef.current = { ...resultRef.current, narrative: data.text };
        onUpdate({ ...resultRef.current });
        break;
      case "error":
        setError(data.message);
        setStreaming(false);
        break;
      case "done":
        resultRef.current = { ...resultRef.current, total_ms: data.total_ms };
        setStreaming(false);
        onComplete({ ...resultRef.current });
        break;
    }
  }, [onUpdate, onComplete, setStep]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
  }, []);

  return { submit, cancel, steps, streaming, error, reset };
}

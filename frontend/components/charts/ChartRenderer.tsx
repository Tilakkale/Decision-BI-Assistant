"use client";

import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { ChartConfig } from "@/lib/types";

interface Props {
  rows:   Record<string, any>[];
  cols:   string[];
  type:   string;
  config?: ChartConfig;
}

const C = ["#00F5D4", "#FFB703", "#7C3AED", "#f87171", "#06b6d4", "#fb923c", "#a78bfa", "#34d399"];
const GRID = { strokeDasharray: "3 3", stroke: "#334155" };
const AXIS = {
  tick:     { fill: "var(--text-dim)", fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600 },
  axisLine: { stroke: "var(--border)" },
  tickLine: false as any,
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: "8px 12px",
      fontSize: 11,
      fontFamily: "var(--font-mono)",
      color: "var(--text-main)",
      boxShadow: "0 0 20px rgba(0,245,212,0.1)",
    }}>
      <div style={{ color: "var(--text-dim)", marginBottom: 4, fontSize: 10 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color, fontWeight: 700 }}>
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
        </div>
      ))}
    </div>
  );
};

function detect(cols: string[], cfg?: ChartConfig) {
  const xCol = cfg?.x_axis && cols.includes(cfg.x_axis) ? cfg.x_axis
    : cols.find(c => /date|month|week|year|region|name|product|segment|country|category|method/i.test(c)) ?? cols[0];

  const yNum = cfg?.y_axis && cols.includes(cfg.y_axis) ? [cfg.y_axis]
    : cols.filter(c => c !== xCol && /amount|revenue|value|count|total|ltv|fee|sum|avg|price|qty|pct|rate|score/i.test(c));

  return { xCol, yCols: yNum.length ? yNum : cols.filter(c => c !== xCol).slice(0, 3) };
}

function trunc(v: any, n = 12) {
  const s = String(v ?? "");
  return s.length > n ? s.slice(0, n) + "…" : s;
}

const LEGEND_STYLE = { fontSize: 10, fontWeight: 700, color: "var(--text-dim)" };

export default function ChartRenderer({ rows, cols, type, config }: Props) {
  if (!rows.length || !cols.length) {
    return (
      <div className="h-48 flex items-center justify-center text-sm font-semibold"
        style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
        No data to visualize
      </div>
    );
  }

  const { xCol, yCols } = detect(cols, config);
  const data = rows.slice(0, 100);
  const H    = 240;

  if (data.length === 1) {
    const vCol = yCols[0] ?? cols[1] ?? cols[0];
    const val = data[0][vCol];
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-[240px] rounded-xl"
        style={{ 
          background: "linear-gradient(145deg, rgba(34,211,238,0.05) 0%, rgba(0,0,0,0) 100%)",
          border: "1px solid rgba(34,211,238,0.15)",
          boxShadow: "0 0 30px rgba(34,211,238,0.05) inset"
        }}>
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--text-dim)" }}>
          {vCol}
        </div>
        <div className="text-5xl font-black tracking-tight" style={{ color: "var(--text-main)", fontFamily: "var(--font-mono)", textShadow: "0 0 24px rgba(34,211,238,0.4)" }}>
          {typeof val === 'number' ? val.toLocaleString() : val}
        </div>
        <div className="text-[13px] font-medium mt-3" style={{ color: "var(--accent-main)" }}>
          {data[0][xCol]}
        </div>
      </div>
    );
  }

  const t    = (type ?? "bar").toLowerCase();
  
  if (t === "table" || t === "raw_data") return null;

  const TIP  = <CustomTooltip />;

  if (t === "pie" || t === "donut") {
    const vCol = yCols[0] ?? cols[1];
    const pData = data.slice(0, 10).map(r => ({
      name: trunc(r[xCol], 18),
      value: Number(r[vCol]) || 0,
    }));
    return (
      <ResponsiveContainer width="100%" height={H}>
        <PieChart>
          <Pie data={pData} dataKey="value" nameKey="name" cx="50%" cy="50%"
            innerRadius={t === "donut" ? "42%" : "0%"} outerRadius="68%"
            paddingAngle={3}
            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
            labelLine={{ stroke: "rgba(255,255,255,0.2)" }}>
            {pData.map((_, i) => (
              <Cell key={i} fill={C[i % C.length]}
                style={{ filter: `drop-shadow(0 0 6px ${C[i % C.length]}80)`, opacity: 0.9 }} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (t === "area") {
    return (
      <ResponsiveContainer width="100%" height={H}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <defs>
            {yCols.map((c, i) => (
              <linearGradient key={c} id={`ag${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={i === 0 ? "#22d3ee" : C[i]} stopOpacity={0.4} />
                <stop offset="95%" stopColor={i === 0 ? "#22d3ee" : C[i]} stopOpacity={0.0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid {...GRID} />
          <XAxis dataKey={xCol} {...AXIS} tickFormatter={v => trunc(v, 8)} />
          <YAxis {...AXIS} />
          <Tooltip content={<CustomTooltip />} />
          {yCols.length > 1 && <Legend wrapperStyle={LEGEND_STYLE} />}
          {yCols.map((c, i) => (
            <Area key={c} type="monotone" dataKey={c} stroke={C[i]}
              fill={`url(#ag${i})`} strokeWidth={2} dot={false}
              style={{ filter: `drop-shadow(0 0 3px ${C[i]}80)` }} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (t === "line") {
    return (
      <ResponsiveContainer width="100%" height={H}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey={xCol} {...AXIS} tickFormatter={v => trunc(v, 8)} />
          <YAxis {...AXIS} />
          <Tooltip content={<CustomTooltip />} />
          {yCols.length > 1 && <Legend wrapperStyle={LEGEND_STYLE} />}
          {yCols.map((c, i) => (
            <Line key={c} type="monotone" dataKey={c} stroke={C[i]}
              strokeWidth={2} dot={{ r: 3, fill: C[i], strokeWidth: 0 }}
              activeDot={{ r: 5, fill: C[i], style: { filter: `drop-shadow(0 0 4px ${C[i]})` } }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (t === "horizontal_bar") {
    const vCol = yCols[0] ?? cols[1];
    return (
      <ResponsiveContainer width="100%" height={Math.max(H, data.length * 28)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 28, bottom: 4, left: 80 }}>
          <CartesianGrid {...GRID} horizontal={false} />
          <XAxis type="number" {...AXIS} />
          <YAxis type="category" dataKey={xCol} {...AXIS} tickFormatter={v => trunc(v, 14)} width={76} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey={vCol} radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={C[0]} opacity={1 - i * 0.04}
                style={{ filter: `drop-shadow(0 0 4px ${C[0]}60)` }} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={H}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
        <CartesianGrid {...GRID} />
        <XAxis dataKey={xCol} {...AXIS} tickFormatter={v => trunc(v, 8)} />
        <YAxis {...AXIS} />
        <Tooltip content={<CustomTooltip />} />
        {yCols.length > 1 && <Legend wrapperStyle={LEGEND_STYLE} />}
        {yCols.map((c, i) => (
          <Bar key={c} dataKey={c} fill={C[i]} opacity={0.9} radius={[3, 3, 0, 0]}
            style={{ filter: `drop-shadow(0 0 4px ${C[i]}60)` }} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

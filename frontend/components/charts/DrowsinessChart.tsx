"use client";

import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from "recharts";

interface DataPoint { label: string; score: number }

interface DrowsinessChartProps {
  data: DataPoint[];
  height?: number;
}

export function DrowsinessChart({ data, height = 160 }: DrowsinessChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
        <CartesianGrid stroke="var(--ds-base-border)" strokeDasharray="4 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 1]} tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "var(--ds-base-raised)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }}
          formatter={(v) => [typeof v === "number" ? v.toFixed(3) : v, "Score"]}
        />
        {[0.25, 0.5, 0.75].map((y) => (
          <ReferenceLine key={y} y={y} stroke="var(--ds-base-border)" strokeDasharray="3 2" />
        ))}
        <Line
          type="monotone"
          dataKey="score"
          stroke="var(--ds-emerald)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "var(--ds-emerald)" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

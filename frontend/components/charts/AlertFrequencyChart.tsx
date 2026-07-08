"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { ALERT_META } from "@/types/detection";

interface Props { data: { day: string; l1: number; l2: number; l3: number }[]; height?: number }

export function AlertFrequencyChart({ data, height = 160 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }} barSize={12}>
        <XAxis dataKey="day" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "var(--ds-base-raised)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }}
        />
        {(["l1", "l2", "l3"] as const).map((k, i) => (
          <Bar key={k} dataKey={k} stackId="a" fill={ALERT_META[(i + 1) as 1 | 2 | 3].color} radius={i === 2 ? [3, 3, 0, 0] : undefined} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

"use client";

import { RadialBarChart, RadialBar, Tooltip, ResponsiveContainer, Legend } from "recharts";

const BAND_COLORS: Record<string, string> = {
  A: "var(--ds-emerald)",
  B: "oklch(0.82 0.14 162)",
  C: "var(--ds-alert-1)",
  D: "var(--ds-coral)",
  F: "var(--ds-alert-3)",
};

interface Props {
  distribution: Record<string, number>;
  height?: number;
}

export function RiskDistributionChart({ distribution, height = 200 }: Props) {
  const data = Object.entries(distribution)
    .map(([band, count]) => ({ band, count, fill: BAND_COLORS[band] }))
    .filter((d) => d.count > 0);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadialBarChart
        cx="50%"
        cy="50%"
        innerRadius="25%"
        outerRadius="80%"
        data={data}
        startAngle={90}
        endAngle={-270}
      >
        <RadialBar dataKey="count" background={{ fill: "var(--ds-base-border)" }} label={false} />
        <Tooltip
          contentStyle={{ background: "var(--ds-base-raised)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }}
          formatter={(v, _name, props) => [v, `Band ${(props as { payload?: { band?: string } })?.payload?.band ?? ""}`]}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(v) => <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>Band {v}</span>}
        />
      </RadialBarChart>
    </ResponsiveContainer>
  );
}

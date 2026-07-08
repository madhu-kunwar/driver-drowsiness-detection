"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useDetectionStore } from "@/store/detectionStore";

const THRESHOLDS = [
  { y: 0.25, color: "var(--ds-alert-1)", label: "Mild" },
  { y: 0.50, color: "var(--ds-alert-2)", label: "Warning" },
  { y: 0.75, color: "var(--ds-alert-3)", label: "Critical" },
];

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number }> }) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value as number;
  const color =
    val >= 0.75 ? "var(--ds-alert-3)" :
    val >= 0.50 ? "var(--ds-alert-2)" :
    val >= 0.25 ? "var(--ds-alert-1)" :
    "var(--ds-emerald)";
  return (
    <div
      className="px-2 py-1 rounded text-caption"
      style={{ background: "var(--ds-base-raised)", border: `1px solid ${color}40`, color }}
    >
      {val.toFixed(3)}
    </div>
  );
}

export function ScoreTimeline() {
  const timeline = useDetectionStore((s) => s.timeline);

  const data = timeline.map((p, i) => ({
    i,
    score: p.score,
    t: (p.t / 1000).toFixed(0) + "s",
  }));

  if (data.length < 2) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-caption text-muted-foreground">Waiting for data…</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="var(--ds-emerald)" stopOpacity={0.4} />
            <stop offset="95%" stopColor="var(--ds-emerald)" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {THRESHOLDS.map(({ y, color, label }) => (
          <ReferenceLine
            key={y}
            y={y}
            stroke={color}
            strokeDasharray="4 3"
            strokeOpacity={0.5}
            label={{ value: label, fill: color, fontSize: 9, position: "right" }}
          />
        ))}

        <XAxis
          dataKey="t"
          tick={{ fontSize: 9, fill: "var(--ds-base-border)" }}
          interval="preserveStartEnd"
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 1]}
          tick={{ fontSize: 9, fill: "var(--ds-base-border)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />

        <Area
          type="monotone"
          dataKey="score"
          stroke="var(--ds-emerald)"
          strokeWidth={1.5}
          fill="url(#scoreGrad)"
          isAnimationActive={false}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

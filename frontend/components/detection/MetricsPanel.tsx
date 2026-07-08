"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useDetectionStore } from "@/store/detectionStore";
import { ScoreGauge } from "./ScoreGauge";

interface Metric {
  key: string;
  label: string;
  value: number;
  max: number;
  unit: string;
  dangerAt: number;
  warnAt: number;
}

function MetricBar({ label, value, max, unit, dangerAt, warnAt }: Omit<Metric, "key">) {
  const pct = Math.min(100, (value / max) * 100);
  const color =
    value >= dangerAt
      ? "var(--ds-alert-2)"
      : value >= warnAt
      ? "var(--ds-alert-1)"
      : "var(--ds-emerald)";

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-caption text-muted-foreground">{label}</span>
        <span
          className="text-caption font-medium"
          style={{ fontFamily: "var(--font-mono)", color }}
        >
          {value.toFixed(2)}
          {unit}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${pct}%`, backgroundColor: color }}
          transition={{ duration: 0.15, ease: "linear" }}
          style={{ filter: pct > 70 ? `drop-shadow(0 0 4px ${color})` : undefined }}
        />
      </div>
    </div>
  );
}

export function MetricsPanel() {
  const metrics = useDetectionStore((s) => s.metrics);
  const sessionStartMs = useDetectionStore((s) => s.sessionStartMs);
  const yawnCount = useDetectionStore((s) => s.yawnCount);
  const sessionActive = useDetectionStore((s) => s.sessionActive);

  // Tick every second so the timer keeps running even when no face is detected
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!sessionActive) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [sessionActive]);

  const elapsed = sessionActive && sessionStartMs
    ? Math.floor((Date.now() - sessionStartMs) / 1000)
    : 0;
  const hh = String(Math.floor(elapsed / 3600)).padStart(2, "0");
  const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  if (!metrics) {
    return (
      <div className="flex flex-col gap-6 p-4 border-l border-border h-full">
        <div className="text-caption text-muted-foreground text-center mt-10">
          Start a session to see live metrics
        </div>
      </div>
    );
  }

  const bars: Metric[] = [
    { key: "ear",     label: "EAR",       value: metrics.ear,          max: 0.45, unit: "",   warnAt: 0.25, dangerAt: 0.21 },
    { key: "perclos", label: "PERCLOS",   value: metrics.perclos,      max: 40,   unit: "%",  warnAt: 15,   dangerAt: 30   },
    { key: "mar",     label: "MAR",       value: metrics.mar,          max: 1,    unit: "",   warnAt: 0.5,  dangerAt: 0.65 },
    { key: "pitch",   label: "Pitch",     value: Math.abs(metrics.pitch), max: 45, unit: "°", warnAt: 20,   dangerAt: 30   },
    { key: "posture", label: "Posture",   value: metrics.postureScore, max: 1,    unit: "",   warnAt: 0.4,  dangerAt: 0.7  },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 border-l border-border h-full overflow-y-auto">
      {/* Score gauge */}
      <div className="flex justify-center pt-2">
        <ScoreGauge />
      </div>

      {/* Metric bars */}
      <div className="space-y-3">
        {bars.map(({ key, ...rest }) => (
          <MetricBar key={key} {...rest} />
        ))}
      </div>

      {/* Session stats */}
      <div className="border-t border-border pt-3 space-y-2 mt-auto">
        <div className="flex justify-between text-caption">
          <span className="text-muted-foreground">Blink rate</span>
          <span style={{ fontFamily: "var(--font-mono)" }}>
            {metrics.blinkRate.toFixed(0)}/min
          </span>
        </div>
        <div className="flex justify-between text-caption">
          <span className="text-muted-foreground">Yawns</span>
          <span style={{ fontFamily: "var(--font-mono)" }}>{yawnCount}</span>
        </div>
        <div className="flex justify-between text-caption">
          <span className="text-muted-foreground">Session</span>
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--ds-emerald)" }}>
            {hh}:{mm}:{ss}
          </span>
        </div>
        {metrics.yawnDetected && (
          <div
            className="text-center text-caption font-semibold py-1 rounded"
            style={{ background: "var(--ds-coral-glow)", color: "var(--ds-coral)" }}
          >
            YAWN DETECTED
          </div>
        )}
      </div>
    </div>
  );
}

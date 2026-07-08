"use client";

import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";
import { useDetectionStore } from "@/store/detectionStore";
import { ALERT_META } from "@/types/detection";

const SIZE = 160;
const STROKE = 12;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

export function ScoreGauge() {
  const metrics = useDetectionStore((s) => s.metrics);
  const score = metrics?.compositeScore ?? 0;
  const level = metrics?.alertLevel ?? 0;
  const meta = ALERT_META[level];

  const springScore = useSpring(0, { stiffness: 60, damping: 20 });
  useEffect(() => { springScore.set(score); }, [score, springScore]);

  const dashOffset = useTransform(springScore, [0, 1], [CIRCUMFERENCE, 0]);

  return (
    <div className="relative flex flex-col items-center gap-2">
      <svg width={SIZE} height={SIZE} style={{ transform: "rotate(-90deg)" }}>
        {/* Background track */}
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={R}
          fill="none"
          stroke="var(--ds-base-border)"
          strokeWidth={STROKE}
        />
        {/* Score arc */}
        <motion.circle
          cx={SIZE / 2} cy={SIZE / 2} r={R}
          fill="none"
          stroke={meta.color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          style={{ filter: `drop-shadow(0 0 6px ${meta.color}80)` }}
        />
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-metric font-bold"
          style={{ color: meta.color, fontFamily: "var(--font-mono)" }}
        >
          {score.toFixed(2)}
        </motion.span>
        <span
          className="text-caption font-bold tracking-widest mt-0.5"
          style={{ color: meta.color }}
        >
          {meta.label}
        </span>
      </div>

      {/* Dot indicators */}
      <div className="flex gap-1.5 mt-1">
        {([0, 1, 2, 3] as const).map((lvl) => (
          <motion.div
            key={lvl}
            className="rounded-full"
            animate={{
              width: lvl === level ? 20 : 8,
              backgroundColor: lvl === level ? ALERT_META[lvl].color : "var(--ds-base-border)",
            }}
            style={{ height: 8 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          />
        ))}
      </div>
    </div>
  );
}

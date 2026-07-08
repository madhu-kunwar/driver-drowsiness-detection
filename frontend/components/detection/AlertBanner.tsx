"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useDetectionStore } from "@/store/detectionStore";
import { ALERT_META } from "@/types/detection";
import { AlertTriangle, CheckCircle, Clock } from "lucide-react";

export function AlertBanner() {
  const metrics       = useDetectionStore((s) => s.metrics);
  const sessionActive = useDetectionStore((s) => s.sessionActive);
  const reduceMotion  = useReducedMotion();

  if (!sessionActive || !metrics) return null;

  const { alertLevel, compositeScore, alertLabel } = metrics;
  const meta = ALERT_META[alertLevel];

  const icons = [CheckCircle, Clock, AlertTriangle, AlertTriangle];
  const Icon  = icons[alertLevel];

  const iconAnimate = alertLevel === 3 && !reduceMotion
    ? { scale: [1, 1.2, 1], rotate: [0, -8, 8, 0] }
    : { scale: 1 };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={alertLevel}
        /* Screen-reader semantics: assertive for critical, polite for informational */
        role={alertLevel >= 2 ? "alert" : "status"}
        aria-live={alertLevel === 3 ? "assertive" : "polite"}
        aria-label={`Alert level ${alertLevel}: ${alertLevel === 0 ? "Driver alert — safe" : `Level ${alertLevel} ${alertLabel}`}. Composite score: ${compositeScore.toFixed(3)}`}
        className="w-full flex items-center justify-between px-4 py-2.5"
        style={{ background: meta.bgVar, borderBottom: `1px solid ${meta.color}30` }}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25 }}
      >
        <div className="flex items-center gap-2">
          <motion.div
            animate={iconAnimate}
            transition={{ duration: 0.4, repeat: alertLevel === 3 && !reduceMotion ? Infinity : 0, repeatDelay: 0.8 }}
            aria-hidden
          >
            <Icon size={16} style={{ color: meta.color }} />
          </motion.div>
          <span className="text-caption font-bold" style={{ color: meta.color }}>
            {alertLevel === 0 ? "DRIVER ALERT" : `LEVEL ${alertLevel} — ${alertLabel.toUpperCase()}`}
          </span>
          {alertLevel === 3 && (
            <span className="text-caption text-white font-medium">· Please pull over safely</span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <span className="text-caption font-mono" style={{ color: meta.color }} aria-hidden>
            Score: {compositeScore.toFixed(3)}
          </span>
          {/* Alert level indicator dots */}
          <div className="flex gap-1" role="img" aria-label={`Level ${alertLevel} of 3`}>
            {([0, 1, 2, 3] as const).map((lvl) => (
              <div
                key={lvl}
                className="w-2 h-2 rounded-full transition-all duration-300"
                style={{
                  background: lvl <= alertLevel ? ALERT_META[lvl].color : "var(--ds-base-border)",
                  transform: lvl === alertLevel ? "scale(1.3)" : "scale(1)",
                }}
              />
            ))}
          </div>
        </div>
      </motion.div>

      {/* Level 3 full-screen flash — skipped when user prefers reduced motion */}
      {alertLevel === 3 && !reduceMotion && (
        <motion.div
          key="l3-flash"
          className="fixed inset-0 pointer-events-none z-[200]"
          animate={{ opacity: [0, 0.12, 0] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          style={{ background: "var(--ds-alert-3)" }}
          aria-hidden
        />
      )}
    </AnimatePresence>
  );
}

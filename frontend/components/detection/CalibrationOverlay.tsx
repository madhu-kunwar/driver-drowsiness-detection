"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Lottie from "lottie-react";
import loadingAnimation from "@/public/lottie/loading.json";

interface CalibrationOverlayProps {
  onComplete: () => void;
  durationMs?: number; // default 3000
}

export function CalibrationOverlay({ onComplete, durationMs = 3000 }: CalibrationOverlayProps) {
  const [countdown, setCountdown] = useState(3);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          clearInterval(interval);
          return 0;
        }
        return n - 1;
      });
    }, 1000);

    const timeout = setTimeout(() => {
      setVisible(false);
      setTimeout(onComplete, 400); // wait for exit animation
    }, durationMs);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [onComplete, durationMs]);

  const progress = 1 - countdown / 3;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 rounded-xl"
          style={{ background: "rgba(10, 15, 30, 0.85)", backdropFilter: "blur(8px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          {/* Lottie spinner */}
          <Lottie
            animationData={loadingAnimation}
            loop
            style={{ width: 80, height: 80 }}
            aria-hidden
          />

          {/* Instruction */}
          <div className="text-center">
            <p className="text-body font-semibold" style={{ color: "var(--ds-emerald)" }}>
              Calibrating…
            </p>
            <p className="text-caption text-muted-foreground mt-1">
              Stay still and look at the camera
            </p>
          </div>

          {/* Countdown ring */}
          <div className="relative w-16 h-16">
            <svg className="absolute inset-0 -rotate-90" width="64" height="64">
              {/* Track */}
              <circle cx="32" cy="32" r="26" fill="none" stroke="var(--ds-base-border)" strokeWidth="4" />
              {/* Progress */}
              <motion.circle
                cx="32" cy="32" r="26"
                fill="none"
                stroke="var(--ds-emerald)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 26}`}
                animate={{ strokeDashoffset: 2 * Math.PI * 26 * (1 - progress) }}
                transition={{ duration: 0.9, ease: "linear" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.span
                  key={countdown}
                  className="text-h2 font-bold font-mono"
                  style={{ color: "var(--ds-emerald)" }}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.4 }}
                  transition={{ duration: 0.2 }}
                >
                  {countdown > 0 ? countdown : "✓"}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>

          {/* EAR baseline note */}
          <p className="text-caption text-muted-foreground" style={{ fontSize: 10 }}>
            Setting personal EAR baseline
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

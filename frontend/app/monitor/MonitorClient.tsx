"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { AlertBanner } from "@/components/detection/AlertBanner";
import { MetricsPanel } from "@/components/detection/MetricsPanel";
import { ScoreTimeline } from "@/components/detection/ScoreTimeline";
import { SessionControls } from "@/components/detection/SessionControls";
import { CalibrationOverlay } from "@/components/detection/CalibrationOverlay";
import { useDetectionStore } from "@/store/detectionStore";
import { ALERT_META } from "@/types/detection";

/* WebcamCapture needs browser APIs — lazy loaded */
const WebcamCapture = dynamic(
  () => import("@/components/detection/WebcamCapture").then((m) => m.WebcamCapture),
  { ssr: false, loading: () => <div className="w-full h-full bg-black/40 rounded-xl animate-pulse" /> }
);

export function MonitorClient() {
  const alertLevel = useDetectionStore((s) => s.metrics?.alertLevel ?? 0);
  const alertCount = useDetectionStore((s) => s.alertCount);
  const sessionActive = useDetectionStore((s) => s.sessionActive);
  const [calibrating, setCalibrating] = useState(false);

  const handleSessionStart = useCallback(() => {
    setCalibrating(true);
  }, []);

  const handleCalibrationComplete = useCallback(() => {
    setCalibrating(false);
  }, []);

  return (
    <div className="flex flex-col h-[calc(100dvh-80px)] overflow-hidden">
      {/* ── Alert banner ── */}
      <AlertBanner />

      {/* ── Session controls ── */}
      <SessionControls onSessionStart={handleSessionStart} />

      {/* ── Main grid ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_280px] min-h-0 overflow-hidden">
        {/* Left: webcam + timeline */}
        <div className="flex flex-col min-h-0">
          {/* Webcam — enforced min-height on mobile so it doesn't collapse */}
          <div className="relative flex-1 p-3 min-h-0" style={{ minHeight: "clamp(200px, 44vw, 9999px)" }}>
            <WebcamCapture />
            {sessionActive && calibrating && (
              <CalibrationOverlay onComplete={handleCalibrationComplete} />
            )}
          </div>

          {/* Score timeline */}
          <div className="h-28 px-3 pb-3 border-t border-border flex-shrink-0">
            <p className="text-caption text-muted-foreground px-1 pt-2 mb-1">
              Composite Score · last 60s
            </p>
            <div className="h-16">
              <ScoreTimeline />
            </div>
          </div>
        </div>

        {/* Right / bottom: metrics panel
            Mobile: capped height + scroll so it doesn't push layout off-screen
            Desktop: full-height sidebar */}
        <div className="border-t lg:border-t-0 lg:border-l border-border overflow-y-auto max-h-64 lg:max-h-none lg:overflow-hidden">
          <MetricsPanel />
        </div>
      </div>

      {/* ── Alert count strip ── */}
      <div className="flex border-t border-border bg-card">
        {([0, 1, 2, 3] as const).map((lvl) => (
          <div
            key={lvl}
            className="flex-1 flex flex-col items-center py-1.5 text-center"
            style={{
              borderRight: lvl < 3 ? "1px solid var(--border)" : undefined,
            }}
          >
            <span
              className="text-metric-sm font-bold"
              style={{ color: ALERT_META[lvl].color, fontFamily: "var(--font-mono)" }}
            >
              {alertCount[lvl] ?? 0}
            </span>
            <span className="text-caption text-muted-foreground" style={{ fontSize: 10 }}>
              {ALERT_META[lvl].label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

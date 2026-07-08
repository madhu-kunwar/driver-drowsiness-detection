"use client";

import { motion } from "framer-motion";
import { Play, Square, Monitor, RefreshCw } from "lucide-react";
import { useDetectionStore } from "@/store/detectionStore";
import { useDetection } from "@/hooks/useDetection";
import { useStartSession, useCompleteSession } from "@/hooks/queries/sessions";

interface SessionControlsProps {
  onSessionStart?: () => void;
}

function computeRiskBand(avg: number): string {
  if (avg < 0.15) return "A";
  if (avg < 0.30) return "B";
  if (avg < 0.50) return "C";
  if (avg < 0.70) return "D";
  return "F";
}

function computePremiumAdj(band: string): number {
  return { A: 0.85, B: 0.92, C: 1.00, D: 1.12, F: 1.25 }[band] ?? 1.00;
}

export function SessionControls({ onSessionStart }: SessionControlsProps) {
  const {
    sessionActive, sessionId, sessionStartMs, wsStatus, demoMode,
    timeline, events, alertCount,
    startSession, endSession, setDemoMode, setWsStatus,
  } = useDetectionStore();
  const { connect, disconnect } = useDetection();
  const startMutation    = useStartSession();
  const completeMutation = useCompleteSession();

  async function handleStart() {
    let backendId: string | undefined;
    try {
      const res = await startMutation.mutateAsync();
      backendId = res.id;
    } catch {
      // Backend unavailable — still allow local session (demo / offline)
    }
    startSession(backendId);
    connect();
    onSessionStart?.();
  }

  async function handleStop() {
    const id = sessionId;
    endSession();
    disconnect();
    setWsStatus("disconnected");

    // Persist to NestJS if we have a backend session ID and real timeline data
    if (id && timeline.length > 0 && !demoMode) {
      const scores      = timeline.map((p) => p.score);
      const avgScore    = scores.reduce((a, b) => a + b, 0) / scores.length;
      const peakScore   = Math.max(...scores);
      const riskBand    = computeRiskBand(avgScore);
      const durationS   = sessionStartMs
        ? Math.round((Date.now() - sessionStartMs) / 1000)
        : 0;

      try {
        await completeMutation.mutateAsync({
          id,
          endedAt:           new Date().toISOString(),
          durationS,
          avgScore:          Math.round(avgScore * 10000) / 10000,
          peakScore:         Math.round(peakScore * 10000) / 10000,
          riskBand,
          premiumAdjustment: computePremiumAdj(riskBand),
          alertCount0:       alertCount[0] ?? 0,
          alertCount1:       alertCount[1] ?? 0,
          alertCount2:       alertCount[2] ?? 0,
          alertCount3:       alertCount[3] ?? 0,
          events:            events.map((e) => ({
            timestamp: e.timestamp,
            level:     e.level,
            score:     e.score,
            ear:       e.ear,
            perclos:   e.perclos,
            mar:       e.mar,
          })),
        });
      } catch {
        // Session data lost if backend is down — acceptable for demo
      }
    }
  }

  function toggleDemo() {
    setDemoMode(!demoMode);
  }

  const statusColor =
    wsStatus === "connected" ? "var(--ds-emerald)" :
    wsStatus === "demo"      ? "var(--ds-alert-1)" :
    wsStatus === "error"     ? "var(--ds-alert-3)" :
    wsStatus === "connecting" ? "var(--ds-alert-1)" :
    "var(--muted-foreground)";

  const statusLabel = {
    connected:    "Backend connected",
    demo:         "Demo mode active",
    error:        "Connection error",
    connecting:   "Connecting…",
    disconnected: "Disconnected",
  }[wsStatus];

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-4 py-3 border-b border-border">
      {/* Status */}
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: statusColor }} />
        <span className="text-caption text-muted-foreground">{statusLabel}</span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Demo toggle */}
        <motion.button
          onClick={toggleDemo}
          whileTap={{ scale: 0.96 }}
          aria-pressed={demoMode}
          aria-label={demoMode ? "Disable demo mode" : "Enable demo mode — simulate detection without backend"}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-caption font-medium border transition-colors cursor-pointer"
          style={{
            borderColor: demoMode ? "var(--ds-alert-1)" : "var(--border)",
            color: demoMode ? "var(--ds-alert-1)" : "var(--muted-foreground)",
            background: demoMode ? "var(--ds-coral-glow)" : "transparent",
          }}
        >
          <Monitor size={13} aria-hidden />
          {demoMode ? "Demo ON" : "Demo Mode"}
        </motion.button>

        {/* Start / Stop */}
        {!sessionActive ? (
          <motion.button
            onClick={handleStart}
            whileTap={{ scale: 0.96 }}
            whileHover={{ scale: 1.02 }}
            aria-label="Start drowsiness monitoring session"
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-caption font-semibold text-white cursor-pointer"
            style={{ background: "var(--ds-emerald)" }}
          >
            <Play size={14} aria-hidden />
            Start Monitoring
          </motion.button>
        ) : (
          <motion.button
            onClick={handleStop}
            whileTap={{ scale: 0.96 }}
            aria-label="Stop current monitoring session"
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-caption font-semibold text-white cursor-pointer"
            style={{ background: "var(--ds-alert-3)" }}
          >
            <Square size={14} aria-hidden />
            Stop Session
          </motion.button>
        )}

        {/* Reconnect (when error) */}
        {wsStatus === "error" && !demoMode && (
          <motion.button
            onClick={handleStart}
            whileTap={{ scale: 0.96 }}
            aria-label="Retry WebSocket connection"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-caption border border-current cursor-pointer"
            style={{ color: "var(--ds-alert-3)" }}
          >
            <RefreshCw size={12} aria-hidden />
            Retry
          </motion.button>
        )}
      </div>
    </div>
  );
}

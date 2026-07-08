"use client";

import { useRef, useCallback, useEffect } from "react";
import { Howler } from "howler";
import { useDetectionStore } from "@/store/detectionStore";
import type { DetectionMetrics, AlertLevel } from "@/types/detection";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/detect";

/* ── Demo-mode metric generator ─────────────────────────────── */
function generateDemoMetrics(sessionStartMs: number): DetectionMetrics {
  const elapsed = (Date.now() - sessionStartMs) / 1000;
  const cycle = elapsed % 120; // 2-minute cycle through all 4 levels

  let base: number;
  if (cycle < 30) base = 0.08 + Math.random() * 0.1;
  else if (cycle < 60) base = 0.28 + Math.random() * 0.14;
  else if (cycle < 90) base = 0.54 + Math.random() * 0.14;
  else base = 0.78 + Math.random() * 0.14;

  const score = Math.max(0, Math.min(1, base + (Math.random() - 0.5) * 0.04));
  const level: AlertLevel = score < 0.25 ? 0 : score < 0.5 ? 1 : score < 0.75 ? 2 : 3;
  const labels = ["Alert", "Mild", "Warning", "Critical"];

  const ear = 0.28 + Math.random() * 0.12 - score * 0.08;
  const perclos = score * 30 + Math.random() * 5;
  const mar = Math.random() < 0.05 ? 0.7 + Math.random() * 0.2 : 0.2 + Math.random() * 0.3;

  return {
    ear: Math.max(0.1, Math.min(0.45, ear)),
    perclos: Math.max(0, Math.min(100, perclos)),
    mar: Math.max(0, Math.min(1, mar)),
    pitch: (Math.random() - 0.5) * 30 * score,
    yaw: (Math.random() - 0.5) * 20,
    roll: (Math.random() - 0.5) * 10,
    postureScore: score * 0.5 + Math.random() * 0.2,
    compositeScore: score,
    alertLevel: level,
    alertLabel: labels[level],
    yawnDetected: mar > 0.65,
    blinkRate: Math.max(5, 18 - score * 10 + Math.random() * 4),
    timestamp: new Date().toISOString(),
  };
}

/* ── Howler-backed alert tones ──────────────────────────────────
   Uses Howler.ctx (Howler's managed AudioContext) so global mute /
   volume calls on Howler propagate to these tones automatically.
   Falls back to a standalone AudioContext on first call before any
   Howl has initialised Howler's context.
──────────────────────────────────────────────────────────────── */
function scheduleBeep(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  vol: number,
  startAt: number,
  dur: number,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(dest);
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, startAt);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + dur);
  osc.start(startAt);
  osc.stop(startAt + dur + 0.02);
}

/* Haptic feedback on mobile — Level 3 only, guards for API availability */
function vibrateAlert(level: AlertLevel) {
  if (level !== 3) return;
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate([200, 100, 200, 100, 200]);
  } catch { /* vibrate not available on this device */ }
}

function playAlertTone(level: AlertLevel) {
  if (level === 0) return;
  try {
    const ctx =
      (Howler.ctx as AudioContext | null) ??
      new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    const dest: AudioNode =
      (Howler.masterGain as AudioNode | null) ?? ctx.destination;
    const now = ctx.currentTime;

    if (level === 1) {
      scheduleBeep(ctx, dest, 440, 0.12, now, 0.25);
    } else if (level === 2) {
      scheduleBeep(ctx, dest, 660, 0.18, now,        0.22);
      scheduleBeep(ctx, dest, 660, 0.18, now + 0.32, 0.22);
    } else {
      // Level 3 critical — three-pulse alarm
      scheduleBeep(ctx, dest, 880,  0.28, now,        0.28);
      scheduleBeep(ctx, dest, 1100, 0.28, now + 0.38, 0.28);
      scheduleBeep(ctx, dest, 880,  0.28, now + 0.76, 0.36);
    }
  } catch { /* AudioContext gated behind user gesture — silently skip */ }
}

/* ── Main hook ───────────────────────────────────────────────── */
export function useDetection() {
  const ws = useRef<WebSocket | null>(null);
  const demoInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevLevel = useRef<AlertLevel>(0);
  const { setMetrics, setWsStatus, sessionActive, sessionStartMs, demoMode } =
    useDetectionStore();

  const sendFrame = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;
      canvas.toBlob(
        (blob) => {
          if (blob && ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(blob);
          }
        },
        "image/jpeg",
        0.75
      );
    },
    []
  );

  const connect = useCallback(() => {
    if (demoMode) {
      setWsStatus("demo");
      return;
    }
    setWsStatus("connecting");
    try {
      ws.current = new WebSocket(WS_URL);
      ws.current.binaryType = "arraybuffer";

      ws.current.onopen = () => setWsStatus("connected");
      ws.current.onerror = () => setWsStatus("error");
      ws.current.onclose = () => setWsStatus("disconnected");
      ws.current.onmessage = (e) => {
        try {
          const data: DetectionMetrics = JSON.parse(
            typeof e.data === "string" ? e.data : new TextDecoder().decode(e.data)
          );
          setMetrics(data);
          if (data.alertLevel > 0 && data.alertLevel !== prevLevel.current) {
            playAlertTone(data.alertLevel);
            vibrateAlert(data.alertLevel);
          }
          prevLevel.current = data.alertLevel;
        } catch {}
      };
    } catch {
      setWsStatus("error");
    }
  }, [demoMode, setMetrics, setWsStatus]);

  const disconnect = useCallback(() => {
    ws.current?.close();
    ws.current = null;
    if (demoInterval.current) {
      clearInterval(demoInterval.current);
      demoInterval.current = null;
    }
  }, []);

  /* Demo mode auto-feed */
  useEffect(() => {
    if (!sessionActive || !demoMode || !sessionStartMs) return;

    demoInterval.current = setInterval(() => {
      const m = generateDemoMetrics(sessionStartMs);
      setMetrics(m);
      if (m.alertLevel > 0 && m.alertLevel !== prevLevel.current) {
        playAlertTone(m.alertLevel);
        vibrateAlert(m.alertLevel);
      }
      prevLevel.current = m.alertLevel;
    }, 100); // 10fps demo to save CPU

    return () => {
      if (demoInterval.current) clearInterval(demoInterval.current);
    };
  }, [sessionActive, demoMode, sessionStartMs, setMetrics]);

  return { connect, disconnect, sendFrame };
}

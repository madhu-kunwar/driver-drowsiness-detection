import { create } from "zustand";
import type { DetectionMetrics, TimelinePoint, AlertEvent, AlertLevel, WsStatus } from "@/types/detection";

const MAX_TIMELINE = 200; // ~60 seconds at 30fps
const MAX_EVENTS = 100;

interface DetectionState {
  metrics: DetectionMetrics | null;
  timeline: TimelinePoint[];
  events: AlertEvent[];
  sessionActive: boolean;
  sessionId: string | null;
  sessionStartMs: number | null;
  wsStatus: WsStatus;
  alertCount: Record<AlertLevel, number>;
  blinkCount: number;
  yawnCount: number;
  demoMode: boolean;

  // Actions
  setMetrics: (m: DetectionMetrics) => void;
  startSession: (backendId?: string) => void;
  endSession: () => void;
  setWsStatus: (s: WsStatus) => void;
  setDemoMode: (v: boolean) => void;
  reset: () => void;
}

const initialAlertCount: Record<AlertLevel, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };

export const useDetectionStore = create<DetectionState>((set) => ({
  metrics: null,
  timeline: [],
  events: [],
  sessionActive: false,
  sessionId: null,
  sessionStartMs: null,
  wsStatus: "disconnected",
  alertCount: { ...initialAlertCount },
  blinkCount: 0,
  yawnCount: 0,
  demoMode: false,

  setMetrics: (m) =>
    set((state) => {
      const t = state.sessionStartMs ? Date.now() - state.sessionStartMs : 0;
      const point: TimelinePoint = { t, score: m.compositeScore, level: m.alertLevel };

      const newTimeline = [...state.timeline, point].slice(-MAX_TIMELINE);

      // Log high-severity events
      let newEvents = state.events;
      if (m.alertLevel >= 2) {
        const event: AlertEvent = {
          timestamp: m.timestamp,
          level: m.alertLevel,
          score: m.compositeScore,
          ear: m.ear,
          perclos: m.perclos,
          mar: m.mar,
        };
        newEvents = [event, ...state.events].slice(0, MAX_EVENTS);
      }

      // Count alerts
      const newAlertCount = { ...state.alertCount };
      newAlertCount[m.alertLevel] = (newAlertCount[m.alertLevel] || 0) + 1;

      return {
        metrics: m,
        timeline: newTimeline,
        events: newEvents,
        alertCount: newAlertCount,
        yawnCount: m.yawnDetected ? state.yawnCount + 1 : state.yawnCount,
      };
    }),

  startSession: (backendId?: string) =>
    set({
      sessionActive: true,
      sessionId: backendId ?? crypto.randomUUID(),
      sessionStartMs: Date.now(),
      timeline: [],
      events: [],
      metrics: null,
      alertCount: { ...initialAlertCount },
      blinkCount: 0,
      yawnCount: 0,
    }),

  endSession: () =>
    set({
      sessionActive: false,
    }),

  setWsStatus: (s) => set({ wsStatus: s }),
  setDemoMode: (v) => set({ demoMode: v }),

  reset: () =>
    set({
      metrics: null,
      timeline: [],
      events: [],
      sessionActive: false,
      sessionId: null,
      sessionStartMs: null,
      wsStatus: "disconnected",
      alertCount: { ...initialAlertCount },
      blinkCount: 0,
      yawnCount: 0,
    }),
}));

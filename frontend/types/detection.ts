export type AlertLevel = 0 | 1 | 2 | 3;

export const ALERT_META: Record<AlertLevel, { label: string; color: string; bgVar: string; desc: string }> = {
  0: { label: "ALERT",    color: "var(--ds-alert-0)", bgVar: "var(--ds-emerald-glow)",  desc: "Driver is alert" },
  1: { label: "MILD",     color: "var(--ds-alert-1)", bgVar: "color-mix(in oklch, var(--ds-alert-1) 15%, transparent)", desc: "Mild drowsiness detected" },
  2: { label: "WARNING",  color: "var(--ds-alert-2)", bgVar: "color-mix(in oklch, var(--ds-alert-2) 15%, transparent)", desc: "Significant drowsiness" },
  3: { label: "CRITICAL", color: "var(--ds-alert-3)", bgVar: "color-mix(in oklch, var(--ds-alert-3) 20%, transparent)", desc: "Pull over immediately" },
};

export interface DetectionMetrics {
  ear: number;
  perclos: number;
  mar: number;
  pitch: number;
  yaw: number;
  roll: number;
  postureScore: number;
  compositeScore: number;
  alertLevel: AlertLevel;
  alertLabel: string;
  yawnDetected: boolean;
  blinkRate: number;
  timestamp: string;
}

export interface TimelinePoint {
  t: number;       // ms since session start
  score: number;
  level: AlertLevel;
}

export interface AlertEvent {
  timestamp: string;
  level: AlertLevel;
  score: number;
  ear: number;
  perclos: number;
  mar: number;
}

export interface Session {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationS: number;
  avgScore: number;
  peakScore: number;
  alertCount: Record<AlertLevel, number>;
  riskBand: "A" | "B" | "C" | "D" | "F";
  premiumAdjustment: number;
  events: AlertEvent[];
}

export type WsStatus = "disconnected" | "connecting" | "connected" | "error" | "demo";

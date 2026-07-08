import { create } from "zustand";
import type { Session } from "@/types/detection";

// ── Mock session data for demo / before backend is connected ──────────
function generateMockSessions(count = 12): Session[] {
  const bands: Array<"A" | "B" | "C" | "D" | "F"> = ["A", "A", "B", "B", "B", "C", "C", "D", "A", "B", "C", "D"];
  return Array.from({ length: count }, (_, i) => {
    const band = bands[i] ?? "B";
    const avgScore = band === "A" ? 0.1 : band === "B" ? 0.22 : band === "C" ? 0.41 : band === "D" ? 0.62 : 0.82;
    const peakScore = avgScore + 0.15 + Math.random() * 0.1;
    const durationS = 1800 + Math.floor(Math.random() * 3600);
    const startedAt = new Date(Date.now() - (i + 1) * 24 * 3600 * 1000 - Math.random() * 3600 * 1000);
    return {
      id: `session-${i + 1}`,
      startedAt: startedAt.toISOString(),
      endedAt: new Date(startedAt.getTime() + durationS * 1000).toISOString(),
      durationS,
      avgScore: Math.min(1, avgScore + (Math.random() - 0.5) * 0.05),
      peakScore: Math.min(1, peakScore),
      alertCount: {
        0: Math.floor(durationS * 0.7),
        1: Math.floor(durationS * 0.05),
        2: Math.floor(durationS * 0.02),
        3: band === "D" || band === "F" ? Math.floor(Math.random() * 5) : 0,
      },
      riskBand: band,
      premiumAdjustment: band === "A" ? 0.85 : band === "B" ? 0.92 : band === "C" ? 1.0 : band === "D" ? 1.12 : 1.25,
      events: [],
    };
  });
}

interface SessionState {
  sessions: Session[];
  currentSessionId: string | null;
  loadMockData: () => void;
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Session) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessions: [],
  currentSessionId: null,

  loadMockData: () => set({ sessions: generateMockSessions(12) }),
  setSessions: (sessions) => set({ sessions }),
  addSession: (session) =>
    set((state) => ({ sessions: [session, ...state.sessions] })),
}));

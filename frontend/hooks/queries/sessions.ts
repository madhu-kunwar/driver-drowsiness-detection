"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Session } from "@/types/detection";

export interface SessionAnalyticsHeatmap {
  data: number[][];
}

export interface AlertFrequencyDay {
  day:  string;
  l1:   number;
  l2:   number;
  l3:   number;
}

// ── Queries ──────────────────────────────────────────────────────

export function useSessions() {
  return useQuery<Session[]>({
    queryKey: ["sessions"],
    queryFn:  () => apiFetch<Session[]>("/sessions"),
    staleTime: 30_000,
  });
}

export function useSession(id: string) {
  return useQuery<Session>({
    queryKey: ["sessions", id],
    queryFn:  () => apiFetch<Session>(`/sessions/${id}`),
    enabled:  !!id,
    staleTime: 60_000,
  });
}

export function useSessionHeatmap() {
  return useQuery<number[][]>({
    queryKey: ["sessions", "analytics", "heatmap"],
    queryFn:  () => apiFetch<number[][]>("/sessions/analytics/heatmap"),
    staleTime: 5 * 60_000,
  });
}

export function useAlertFrequency() {
  return useQuery<AlertFrequencyDay[]>({
    queryKey: ["sessions", "analytics", "alert-frequency"],
    queryFn:  () => apiFetch<AlertFrequencyDay[]>("/sessions/analytics/alert-frequency"),
    staleTime: 5 * 60_000,
  });
}

// ── Mutations ────────────────────────────────────────────────────

export function useStartSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ id: string; startedAt: string }>("/sessions", { method: "POST" }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["sessions"] }),
  });
}

export interface CompleteSessionPayload {
  endedAt:           string;
  durationS:         number;
  avgScore:          number;
  peakScore:         number;
  riskBand:          string;
  premiumAdjustment: number;
  alertCount0:       number;
  alertCount1:       number;
  alertCount2:       number;
  alertCount3:       number;
  events?: Array<{
    timestamp: string;
    level:     number;
    score:     number;
    ear?:      number;
    perclos?:  number;
    mar?:      number;
  }>;
}

export function useCompleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: CompleteSessionPayload & { id: string }) =>
      apiFetch<Session>(`/sessions/${id}`, {
        method: "PATCH",
        body:   JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
  });
}

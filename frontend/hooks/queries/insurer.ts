"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { FleetDriver, FleetSummary, Claim } from "@/types/insurer";

// ── Fleet ─────────────────────────────────────────────────────────

export function useFleetSummary() {
  return useQuery<FleetSummary>({
    queryKey: ["insurer", "summary"],
    queryFn:  () => apiFetch<FleetSummary>("/insurer/summary"),
    staleTime: 60_000,
  });
}

export function useFleetDrivers() {
  return useQuery<FleetDriver[]>({
    queryKey: ["insurer", "drivers"],
    queryFn:  () => apiFetch<FleetDriver[]>("/insurer/drivers"),
    staleTime: 60_000,
  });
}

export function useFleetDriver(id: string) {
  return useQuery<FleetDriver>({
    queryKey: ["insurer", "drivers", id],
    queryFn:  () => apiFetch<FleetDriver>(`/insurer/drivers/${id}`),
    enabled:  !!id,
    staleTime: 60_000,
  });
}

// ── Claims ────────────────────────────────────────────────────────

export function useClaims() {
  return useQuery<Claim[]>({
    queryKey: ["insurer", "claims"],
    queryFn:  () => apiFetch<Claim[]>("/insurer/claims"),
    staleTime: 60_000,
  });
}

export function useClaim(id: string) {
  return useQuery<Claim>({
    queryKey: ["insurer", "claims", id],
    queryFn:  () => apiFetch<Claim>(`/insurer/claims/${id}`),
    enabled:  !!id,
    staleTime: 60_000,
  });
}

export function useUpdateClaimStatus(claimId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: string) =>
      apiFetch<Claim>(`/insurer/claims/${claimId}`, {
        method: "PATCH",
        body:   JSON.stringify({ status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["insurer", "claims"] });
      qc.invalidateQueries({ queryKey: ["insurer", "claims", claimId] });
    },
  });
}

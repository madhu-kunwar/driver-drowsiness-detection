"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import type { AuthUser, LoginCredentials, Role } from "@/types/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

/* ── Mock users (active while backend is offline) ─────────── */
const MOCK_USERS: (AuthUser & { password: string })[] = [
  {
    id: "u-driver-01",
    name: "Alex Driver",
    email: "driver@demo.com",
    password: "demo123",
    role: "driver",
    licenseNo: "NP-D-4821",
    avatarInitials: "AD",
  },
  {
    id: "u-insurer-01",
    name: "Sarah Fleet",
    email: "insurer@fleet.com",
    password: "demo123",
    role: "insurer",
    companyId: "HBI-Nepal",
    avatarInitials: "SF",
  },
  {
    id: "u-admin-01",
    name: "DS Admin",
    email: "admin@drowsyshield.com",
    password: "demo123",
    role: "admin",
    avatarInitials: "DA",
  },
];

/* Produces a displayable mock JWT (not cryptographically signed) */
function mockToken(user: AuthUser): string {
  const h = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const p = btoa(
    JSON.stringify({ sub: user.id, role: user.role, exp: Date.now() + 86_400_000 })
  );
  const s = btoa(`${user.id}:${Date.now()}`);
  return `${h}.${p}.${s}`;
}

function homeForRole(role: Role): string {
  return role === "insurer" ? "/insurer" : "/dashboard";
}

/* ── Hook ──────────────────────────────────────────────────── */
export function useAuth() {
  const { user, token, isAuthenticated, login: storeLogin, logout: storeLogout, hasRole } =
    useAuthStore();
  const router = useRouter();

  const login = useCallback(
    async (credentials: LoginCredentials): Promise<{ error?: string }> => {
      /* 1. Try real backend */
      try {
        const res = await fetch(`${API_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credentials),
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          const { user: apiUser, token: apiToken }: { user: AuthUser; token: string } =
            await res.json();
          storeLogin(apiUser, apiToken);
          router.push(homeForRole(apiUser.role));
          return {};
        }
        if (res.status === 401) return { error: "Invalid email or password" };
      } catch {
        // Backend offline — fall through to mock
      }

      /* 2. Mock fallback */
      const mock = MOCK_USERS.find(
        (u) => u.email === credentials.email && u.password === credentials.password
      );
      if (!mock) return { error: "Invalid email or password" };

      const { password: _pw, ...authUser } = mock;
      storeLogin(authUser, mockToken(authUser));
      router.push(homeForRole(authUser.role));
      return {};
    },
    [storeLogin, router]
  );

  const logout = useCallback(() => {
    storeLogout();
    router.push("/login");
  }, [storeLogout, router]);

  return { user, token, isAuthenticated, login, logout, hasRole };
}

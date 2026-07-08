import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AuthUser, Role } from "@/types/auth";

const TOKEN_COOKIE = "drowsy_token";
const ROLE_COOKIE  = "drowsy_role";
const COOKIE_TTL   = 60 * 60 * 24 * 7; // 7 days (seconds)

function setCookie(name: string, value: string, maxAge: number) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function clearCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0`;
}

interface AuthStore {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  /* Actions */
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: (user, token) => {
        setCookie(TOKEN_COOKIE, token, COOKIE_TTL);
        setCookie(ROLE_COOKIE, user.role, COOKIE_TTL);
        set({ user, token, isAuthenticated: true });
      },

      logout: () => {
        clearCookie(TOKEN_COOKIE);
        clearCookie(ROLE_COOKIE);
        set({ user: null, token: null, isAuthenticated: false });
      },

      hasRole: (...roles) => {
        const { user } = get();
        return user !== null && roles.includes(user.role);
      },
    }),
    {
      name: "drowsy-auth",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : ({ getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {}, key: () => null, length: 0 } as unknown as Storage)
      ),
      partialize: (s) => ({
        user: s.user,
        token: s.token,
        isAuthenticated: s.isAuthenticated,
      }),
    }
  )
);

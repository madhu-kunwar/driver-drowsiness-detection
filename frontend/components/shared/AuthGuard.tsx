"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Lottie from "lottie-react";
import loadingAnimation from "@/public/lottie/loading.json";
import { useAuthStore } from "@/store/authStore";
import type { Role } from "@/types/auth";

interface AuthGuardProps {
  children: ReactNode;
  /** Required roles. Omit to allow any authenticated user. */
  roles?: Role[];
  /** Where to redirect if not authenticated (default: /login). */
  fallback?: string;
}

export function AuthGuard({ children, roles, fallback = "/login" }: AuthGuardProps) {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    /* Wait one tick — Zustand persist rehydrates asynchronously */
    const t = setTimeout(() => {
      if (!isAuthenticated) {
        router.replace(fallback);
      } else if (roles && user && !roles.includes(user.role)) {
        router.replace(user.role === "insurer" ? "/insurer" : "/dashboard");
      } else {
        setChecked(true);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [isAuthenticated, user, roles, fallback, router]);

  if (!checked) {
    return (
      <div className="flex items-center justify-center min-h-[60dvh]">
        <Lottie
          animationData={loadingAnimation}
          loop
          style={{ width: 72, height: 72 }}
          aria-hidden
        />
      </div>
    );
  }

  return <>{children}</>;
}

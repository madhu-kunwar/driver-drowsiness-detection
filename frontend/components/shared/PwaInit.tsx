"use client";

import { useEffect } from "react";

/* Registers the service worker once on first client mount.
   Production-only to avoid dev caching headaches. */
export function PwaInit() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        reg.addEventListener("updatefound", () => {
          const next = reg.installing;
          if (!next) return;
          next.addEventListener("statechange", () => {
            if (next.state === "installed" && navigator.serviceWorker.controller) {
              /* New SW installed — could show a "refresh for update" toast here */
              console.info("[DrowsyShield SW] Update available. Reload to apply.");
            }
          });
        });
      })
      .catch(() => {});
  }, []);

  return null;
}

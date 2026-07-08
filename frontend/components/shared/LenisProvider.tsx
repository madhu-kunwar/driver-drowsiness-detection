"use client";

import { useEffect, useRef, createContext, useContext } from "react";
import Lenis from "lenis";
import { usePathname } from "next/navigation";

type LenisContextValue = { lenis: Lenis | null };
const LenisContext = createContext<LenisContextValue>({ lenis: null });

export function useLenis() {
  return useContext(LenisContext);
}

const DISABLED_ROUTES = ["/monitor"];

export function LenisProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);
  const pathname = usePathname();
  const disabled = DISABLED_ROUTES.some((r) => pathname?.startsWith(r));

  useEffect(() => {
    if (disabled) return;

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    lenisRef.current = lenis;

    // Dynamic import keeps GSAP/ScrollTrigger out of the SSR bundle
    let ScrollTrigger: typeof import("gsap/ScrollTrigger").default | null = null;
    import("gsap/ScrollTrigger").then((m) => {
      ScrollTrigger = m.default;
    });

    // Use a cancel flag — cancelAnimationFrame(id) only stops the FIRST call;
    // the recursive requestAnimationFrame inside raf() would keep running.
    let cancelled = false;

    function raf(time: number) {
      if (cancelled) return;
      lenis.raf(time);
      ScrollTrigger?.update();
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      cancelled = true;       // stops the recursive loop
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [disabled]);

  return (
    <LenisContext.Provider value={{ lenis: lenisRef.current }}>
      {children}
    </LenisContext.Provider>
  );
}

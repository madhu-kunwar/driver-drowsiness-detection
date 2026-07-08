"use client";

/**
 * Theatre.js Provider
 * ──────────────────
 * - Initialises @theatre/studio in development mode only
 * - Exposes the DrowsyShield project via context
 * - In production the studio is never loaded (zero overhead)
 *
 * HOW TO RECORD ANIMATIONS:
 * 1. Run `npm run dev` — the Theatre.js studio panel opens automatically
 * 2. Click the object you want to animate in the studio
 * 3. Scrub the timeline and set keyframes
 * 4. Click "Export" → save the JSON to /theatre/<sheet-name>.json
 * 5. Import the JSON and pass as `state` to getProject()
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { IProject } from "@theatre/core";

type TheatreContextValue = { project: IProject | null };
const TheatreContext = createContext<TheatreContextValue>({ project: null });

export function useTheatre() {
  return useContext(TheatreContext);
}

export function TheatreProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<IProject | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const { getProject } = await import("@theatre/core");

      // In dev: load studio for live editing
      if (process.env.NODE_ENV === "development") {
        const { default: studio } = await import("@theatre/studio");
        studio.initialize();
      }

      if (!cancelled) {
        const p = getProject("DrowsyShield");
        setProject(p);
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  return (
    <TheatreContext.Provider value={{ project }}>
      {children}
    </TheatreContext.Provider>
  );
}

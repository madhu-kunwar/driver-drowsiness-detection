"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { EyeScene } from "./EyeScene";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";

interface HeroCanvasProps {
  score?:     number;
  className?: string;
}

function SpinnerFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div
        className="w-24 h-24 rounded-full border-2 border-dashed animate-spin"
        style={{ borderColor: "var(--ds-emerald)", animationDuration: "3s" }}
      />
    </div>
  );
}

/* Shown when WebGL is unavailable or the Canvas throws */
function WebGLFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center" aria-hidden>
      <svg viewBox="0 0 200 200" width="200" height="200" role="img" aria-label="DrowsyShield eye icon">
        <ellipse cx="100" cy="100" rx="80" ry="50" fill="none" stroke="#10B981" strokeWidth="4" opacity="0.6" />
        <circle   cx="100" cy="100" r="28"  fill="#10B981" />
        <circle   cx="100" cy="100" r="12"  fill="#1C1C1E" />
        <circle   cx="109" cy="92"  r="7"   fill="white" opacity="0.85" />
        <path d="M20 100 Q100 48 180 100"  fill="none" stroke="#10B981" strokeWidth="2.5" opacity="0.35" />
        <path d="M20 100 Q100 152 180 100" fill="none" stroke="#10B981" strokeWidth="2.5" opacity="0.35" />
      </svg>
    </div>
  );
}

export function HeroCanvas({ score = 0.19, className }: HeroCanvasProps) {
  return (
    <div className={className ?? "w-full h-full"}>
      <ErrorBoundary fallback={<WebGLFallback />}>
        <Canvas
          camera={{ position: [0, 0, 8], fov: 50 }}
          gl={{ antialias: true, alpha: true }}
          style={{ background: "transparent" }}
          dpr={[1, 1.5]}
        >
          <Suspense fallback={null}>
            <EyeScene score={score} />
          </Suspense>
        </Canvas>
      </ErrorBoundary>
    </div>
  );
}

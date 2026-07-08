"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AuroraBackgroundProps {
  children?: React.ReactNode;
  className?: string;
  intensity?: "subtle" | "medium" | "strong";
}

export function AuroraBackground({
  children,
  className,
  intensity = "medium",
}: AuroraBackgroundProps) {
  const opacityMap = { subtle: 0.25, medium: 0.4, strong: 0.6 };
  const opacity = opacityMap[intensity];

  return (
    <div className={cn("relative overflow-hidden bg-background", className)}>
      {/* Aurora orbs */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 select-none"
        style={{ opacity }}
      >
        {/* Emerald orb — top left */}
        <motion.div
          className="absolute rounded-full blur-[120px]"
          style={{
            width: "55%",
            height: "55%",
            top: "-20%",
            left: "-10%",
            background:
              "radial-gradient(circle, var(--ds-emerald) 0%, transparent 70%)",
          }}
          animate={{
            x: [0, 30, -20, 0],
            y: [0, -20, 15, 0],
            scale: [1, 1.1, 0.95, 1],
          }}
          transition={{
            duration: 14,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Coral orb — bottom right */}
        <motion.div
          className="absolute rounded-full blur-[140px]"
          style={{
            width: "50%",
            height: "50%",
            bottom: "-15%",
            right: "-5%",
            background:
              "radial-gradient(circle, var(--ds-coral) 0%, transparent 70%)",
          }}
          animate={{
            x: [0, -25, 20, 0],
            y: [0, 25, -15, 0],
            scale: [1, 0.9, 1.08, 1],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
        />

        {/* Emerald mid orb */}
        <motion.div
          className="absolute rounded-full blur-[180px]"
          style={{
            width: "35%",
            height: "35%",
            top: "30%",
            left: "40%",
            background:
              "radial-gradient(circle, var(--ds-emerald-dim) 0%, transparent 70%)",
          }}
          animate={{
            x: [0, 40, -30, 0],
            y: [0, -30, 20, 0],
            scale: [1, 1.15, 0.9, 1],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 5,
          }}
        />
      </div>

      {/* Grain noise overlay for depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10">{children}</div>
    </div>
  );
}

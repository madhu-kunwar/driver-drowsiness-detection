"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlowCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: "emerald" | "coral" | "muted";
}

export function GlowCard({
  children,
  className,
  glowColor = "emerald",
}: GlowCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: "50%", y: "50%" });
  const [hovered, setHovered] = useState(false);

  const glowHex =
    glowColor === "emerald"
      ? "var(--ds-emerald)"
      : glowColor === "coral"
      ? "var(--ds-coral)"
      : "var(--muted-foreground)";

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: `${((e.clientX - rect.left) / rect.width) * 100}%`,
      y: `${((e.clientY - rect.top) / rect.height) * 100}%`,
    });
  }

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={onMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
      className={cn(
        "relative rounded-2xl border border-border bg-card overflow-hidden",
        className
      )}
    >
      {/* Radial glow that follows cursor */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        animate={{ opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        style={{
          background: `radial-gradient(300px circle at ${mousePos.x} ${mousePos.y}, ${glowHex}18, transparent 70%)`,
        }}
      />
      {/* Top border glow */}
      <motion.div
        className="pointer-events-none absolute top-0 left-0 right-0 h-px"
        animate={{ opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        style={{
          background: `linear-gradient(90deg, transparent, ${glowHex}60, transparent)`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

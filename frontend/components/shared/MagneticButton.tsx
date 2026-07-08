"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MagneticButtonProps {
  children: React.ReactNode;
  className?: string;
  strength?: number;
  onClick?: () => void;
  variant?: "emerald" | "coral" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  asChild?: boolean;
}

const variantStyles = {
  emerald: "text-white",
  coral: "text-white",
  ghost: "text-foreground hover:bg-muted",
  outline: "border border-border text-foreground hover:bg-muted",
};

const sizeStyles = {
  sm: "px-4 py-1.5 text-caption",
  md: "px-6 py-2.5 text-body",
  lg: "px-8 py-3.5 text-body-lg",
};

export function MagneticButton({
  children,
  className,
  strength = 0.35,
  onClick,
  variant = "emerald",
  size = "md",
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  function onMouseMove(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setPos({
      x: (e.clientX - rect.left - rect.width / 2) * strength,
      y: (e.clientY - rect.top - rect.height / 2) * strength,
    });
  }

  function onMouseLeave() {
    setPos({ x: 0, y: 0 });
    setHovered(false);
  }

  const bg =
    variant === "emerald"
      ? { background: hovered ? "var(--ds-emerald-dim)" : "var(--ds-emerald)" }
      : variant === "coral"
      ? { background: hovered ? "var(--ds-coral-dim)" : "var(--ds-coral)" }
      : {};

  return (
    <motion.button
      ref={ref}
      animate={{ x: pos.x, y: pos.y }}
      transition={{ type: "spring", stiffness: 200, damping: 18, mass: 0.5 }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onMouseEnter={() => setHovered(true)}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-xl font-medium cursor-pointer transition-colors",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      style={bg}
    >
      {/* Shine sweep */}
      <motion.span
        className="absolute inset-0 -translate-x-full"
        animate={{ x: hovered ? "200%" : "-100%" }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)",
        }}
      />
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </motion.button>
  );
}

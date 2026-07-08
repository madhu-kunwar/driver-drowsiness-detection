"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export function Logo({ size = "default" }: { size?: "default" | "sm" }) {
  const isSmall = size === "sm";

  return (
    <Link href="/" className="flex items-center gap-2 group select-none">
      {/* Eye / shield icon mark */}
      <motion.div
        className={`relative flex items-center justify-center rounded-lg ${
          isSmall ? "w-7 h-7" : "w-8 h-8"
        }`}
        style={{ background: "var(--ds-emerald)" }}
        whileHover={{ scale: 1.08, rotate: -3 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
      >
        {/* Eye shape */}
        <svg
          width={isSmall ? 16 : 18}
          height={isSmall ? 16 : 18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" fill="white" stroke="none" />
        </svg>
        {/* Pulse ring on mount */}
        <motion.span
          className="absolute inset-0 rounded-lg"
          style={{ border: "2px solid var(--ds-emerald)" }}
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
        />
      </motion.div>

      <span
        className={`font-display font-700 tracking-tight text-foreground group-hover:text-primary transition-colors ${
          isSmall ? "text-base" : "text-lg"
        }`}
        style={{ fontFamily: "var(--font-display)" }}
      >
        Drowsy
        <span style={{ color: "var(--ds-emerald)" }}>Shield</span>
      </span>
    </Link>
  );
}

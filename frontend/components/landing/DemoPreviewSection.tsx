"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Play, ArrowRight, Zap, AlertTriangle } from "lucide-react";
import { MagneticButton } from "@/components/shared/MagneticButton";

/**
 * DemoPreviewSection
 * ──────────────────
 * The monitor UI mockup is a CSS-only replica (no real <img>), so it does
 * not use Shery.js imageEffect — that effect requires an actual image
 * source to build its WebGL texture from.
 */

/* ── Simulated monitor screen ── */
function MonitorMockup() {
  return (
    <div className="w-full rounded-2xl overflow-hidden border border-border bg-card shadow-2xl">
      {/* Alert bar */}
      <div
        className="h-10 flex items-center justify-between px-4 text-caption font-bold text-white"
        style={{ background: "var(--ds-alert-2)" }}
      >
        <span>⚠ WARNING — Score 0.61 — Level 2</span>
        <span className="font-mono">00:47:12</span>
      </div>

      <div className="grid grid-cols-3 gap-0">
        {/* Webcam area */}
        <div
          className="col-span-2 aspect-video flex items-center justify-center relative"
          style={{ background: "var(--ds-base)" }}
        >
          {/* Simulated face outline */}
          <div className="relative w-40 h-48 border-2 rounded-full border-dashed" style={{ borderColor: "var(--ds-emerald)" }}>
            {/* Eyes */}
            <div className="absolute top-10 left-6 w-6 h-3 rounded-full border-2" style={{ borderColor: "var(--ds-emerald)" }} />
            <div className="absolute top-10 right-6 w-6 h-3 rounded-full border-2" style={{ borderColor: "var(--ds-emerald)" }} />
            {/* Nose */}
            <div className="absolute top-20 left-1/2 -translate-x-1/2 text-caption text-muted-foreground">+</div>
            {/* Mouth */}
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-10 h-3 border-b-2 rounded-b-full" style={{ borderColor: "var(--ds-alert-2)" }} />
            {/* Landmark dots */}
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1.5 h-1.5 rounded-full"
                style={{
                  background: "var(--ds-emerald)",
                  top: `${15 + (i % 4) * 20}%`,
                  left: `${10 + (i % 6) * 14}%`,
                  opacity: 0.8,
                }}
              />
            ))}
          </div>
          {/* Overlay labels */}
          <div className="absolute top-2 left-2 text-caption font-mono" style={{ color: "var(--ds-emerald)" }}>
            FPS: 28 | Face: ✓
          </div>
          <div className="absolute bottom-2 right-2 text-caption font-mono" style={{ color: "var(--ds-alert-2)" }}>
            YAWN DETECTED
          </div>
        </div>

        {/* Metrics panel */}
        <div className="p-3 space-y-2 border-l border-border text-caption">
          {[
            { label: "EAR",       value: 0.19, max: 0.5,  color: "var(--ds-alert-2)" },
            { label: "PERCLOS",   value: 0.21, max: 0.3,  color: "var(--ds-alert-2)" },
            { label: "MAR",       value: 0.72, max: 1,    color: "var(--ds-alert-3)" },
            { label: "Head Pose", value: 0.31, max: 1,    color: "var(--ds-alert-1)" },
            { label: "Posture",   value: 0.18, max: 1,    color: "var(--ds-emerald)" },
          ].map(({ label, value, max, color }) => (
            <div key={label}>
              <div className="flex justify-between mb-0.5">
                <span className="text-muted-foreground">{label}</span>
                <span style={{ color, fontFamily: "var(--font-mono)" }}>{value.toFixed(2)}</span>
              </div>
              <div className="h-1 rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: color }} />
              </div>
            </div>
          ))}

          <div className="pt-2 border-t border-border">
            <p className="text-muted-foreground mb-1">Score</p>
            <p className="text-metric-sm font-bold" style={{ color: "var(--ds-alert-2)", fontFamily: "var(--font-mono)" }}>
              0.61
            </p>
            <div className="flex gap-1 mt-1">
              {[0, 1, 2, 3].map((lvl) => (
                <div
                  key={lvl}
                  className="flex-1 h-2 rounded-sm"
                  style={{
                    background: lvl <= 2
                      ? `var(--ds-alert-${lvl === 0 ? "0" : lvl === 1 ? "1" : "2"})`
                      : "var(--ds-base-border)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Timeline bar */}
      <div className="border-t border-border p-3">
        <p className="text-caption text-muted-foreground mb-1.5">Score · last 60s</p>
        <div className="flex items-end gap-0.5 h-8">
          {[0.15,0.18,0.22,0.28,0.35,0.42,0.50,0.55,0.58,0.60,0.63,0.61,0.59,0.62,0.60,0.61,0.64,0.62,0.60,0.61].map((v, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm"
              style={{
                height: `${v * 100}%`,
                background: v >= 0.75 ? "var(--ds-alert-3)" : v >= 0.5 ? "var(--ds-alert-2)" : v >= 0.25 ? "var(--ds-alert-1)" : "var(--ds-emerald)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function DemoPreviewSection() {
  const features = [
    { icon: Zap,           text: "Real-time · 30 fps · <85ms" },
    { icon: AlertTriangle, text: "4-level alert system with audio" },
    { icon: Play,          text: "Works in any browser with webcam" },
  ];

  return (
    <section className="relative py-28 overflow-hidden bg-card">
      <div
        className="absolute top-1/2 left-0 w-96 h-96 -translate-y-1/2 rounded-full blur-3xl opacity-10 pointer-events-none"
        style={{ background: "var(--ds-emerald)" }}
      />

      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left — copy */}
          <motion.div
            className="flex flex-col gap-6"
            initial={{ opacity: 0, x: -32 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
          >
            <span
              className="text-caption font-semibold uppercase tracking-widest"
              style={{ color: "var(--ds-emerald)" }}
            >
              Live Demo
            </span>
            <h2 className="text-h1">
              See it in action — your browser, your webcam
            </h2>
            <p className="text-body-lg text-muted-foreground">
              No app download. No hardware. Open the monitor page, allow webcam
              access, and see real-time drowsiness detection — all five signals,
              a live composite score, and audible alerts — in under 30 seconds.
            </p>

            <ul className="space-y-3">
              {features.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-body text-foreground">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "var(--ds-emerald-glow)" }}
                  >
                    <Icon size={16} style={{ color: "var(--ds-emerald)" }} />
                  </div>
                  {text}
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/monitor">
                <MagneticButton variant="emerald" size="lg">
                  <Play size={16} /> Open Live Monitor
                </MagneticButton>
              </Link>
              <Link href="/dashboard">
                <MagneticButton variant="outline" size="md">
                  View Analytics <ArrowRight size={14} />
                </MagneticButton>
              </Link>
            </div>

            <p className="text-caption text-muted-foreground">
              Privacy: No video is ever stored. All processing is ephemeral and local.
            </p>
          </motion.div>

          {/* Right — monitor mockup */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, x: 32 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number], delay: 0.1 }}
          >
            <div className="relative cursor-pointer">
              <MonitorMockup />
            </div>

            {/* Floating alert badge */}
            <motion.div
              className="absolute -bottom-4 -left-4 px-4 py-2.5 rounded-xl border shadow-xl flex items-center gap-2"
              style={{
                background: "color-mix(in oklch, var(--ds-alert-2) 15%, var(--card))",
                borderColor: "color-mix(in oklch, var(--ds-alert-2) 40%, transparent)",
              }}
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            >
              <AlertTriangle size={16} style={{ color: "var(--ds-alert-2)" }} />
              <span className="text-caption font-semibold" style={{ color: "var(--ds-alert-2)" }}>
                Level 2 Alert — Yawn Detected
              </span>
            </motion.div>

            {/* Latency badge */}
            <motion.div
              className="absolute -top-4 -right-4 px-3 py-1.5 rounded-xl shadow-xl"
              style={{ background: "var(--ds-emerald)", color: "white" }}
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <span className="text-caption font-bold font-mono">~72ms</span>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

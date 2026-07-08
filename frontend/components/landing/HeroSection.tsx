"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, Play, Shield, CheckCircle } from "lucide-react";
import { useAnimate, stagger } from "framer-motion";
import { AuroraBackground } from "@/components/shared/AuroraBackground";
import { MagneticButton } from "@/components/shared/MagneticButton";

/* R3F canvas — lazy loaded, never SSR */
const HeroCanvas = dynamic(
  () => import("@/components/three/HeroCanvas").then((m) => m.HeroCanvas),
  { ssr: false, loading: () => <div className="w-full h-full" /> }
);

const TRUST_BADGES = [
  "91% Detection Accuracy",
  "Euro NCAP 2026 Ready",
  "FMCSA HOS Compliant",
  "GDPR Compliant",
];

/* ── Score mockup ────────────────────────────────────────────── */
function ScoreMockup() {
  return (
    <div className="relative w-full max-w-lg mx-auto">
      <div
        className="absolute -inset-6 rounded-3xl blur-3xl opacity-25 pointer-events-none"
        style={{ background: "linear-gradient(135deg, var(--ds-emerald), var(--ds-coral))" }}
      />
      <div className="relative rounded-2xl border border-border bg-card/80 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="h-1.5 w-full" style={{ background: "var(--ds-emerald)" }} />

        <div className="p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-caption text-muted-foreground">Session · 00:23:47</p>
              <p className="text-caption font-semibold mt-0.5" style={{ color: "var(--ds-emerald)" }}>
                ● MONITORING ACTIVE
              </p>
            </div>
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-caption font-semibold"
              style={{ background: "var(--ds-emerald-glow)", color: "var(--ds-emerald)" }}
            >
              <CheckCircle size={12} /> ALERT
            </div>
          </div>

          <div className="flex gap-4 items-start">
            {/* Circular score gauge */}
            <div className="flex-shrink-0 text-center">
              <div
                className="relative w-24 h-24 rounded-full flex items-center justify-center"
                style={{ background: "conic-gradient(var(--ds-emerald) 0% 19%, var(--ds-base-border) 19% 100%)" }}
              >
                <div className="absolute inset-1.5 rounded-full bg-card flex flex-col items-center justify-center">
                  <span className="text-metric" style={{ color: "var(--ds-emerald)" }}>0.19</span>
                </div>
              </div>
              <p className="text-caption text-muted-foreground mt-2">Score</p>
            </div>

            {/* Metric bars */}
            <div className="flex-1 space-y-2.5">
              {[
                { label: "EAR", value: 0.31, max: 0.5, color: "var(--ds-emerald)" },
                { label: "PERCLOS", value: 0.08, max: 0.3, color: "var(--ds-emerald)" },
                { label: "MAR", value: 0.42, max: 1, color: "var(--ds-alert-1)" },
                { label: "Head Pose", value: 0.12, max: 1, color: "var(--ds-emerald)" },
              ].map(({ label, value, max, color }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-caption text-muted-foreground w-16 shrink-0">{label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: color }} />
                  </div>
                  <span className="text-code text-muted-foreground w-10 text-right">{value.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-caption text-muted-foreground mb-2">Score · last 60s</p>
            <div className="flex items-end gap-0.5 h-10">
              {[0.12,0.15,0.18,0.14,0.19,0.22,0.20,0.17,0.19,0.21,0.18,0.16,0.19,0.21,0.19,0.18,0.22,0.20,0.19,0.19].map((v, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{
                    height: `${v * 160}%`,
                    background: v > 0.5 ? "var(--ds-alert-3)" : v > 0.25 ? "var(--ds-alert-1)" : "var(--ds-emerald)",
                    opacity: 0.5 + i * 0.025,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating badge */}
      <div
        className="absolute -top-4 -right-4 px-3 py-1.5 rounded-xl shadow-xl border text-caption font-bold animate-bounce"
        style={{ background: "var(--ds-emerald)", color: "white", borderColor: "var(--ds-emerald-dim)", animationDuration: "3s" }}
      >
        Band A — −15%
      </div>
    </div>
  );
}

/* ── Hero Section ────────────────────────────────────────────── */
export function HeroSection() {
  const [scope, animate] = useAnimate();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    // Cinematic entrance sequence
    // All elements start hidden via initial styles set below
    const sequence = async () => {
      // 1. Eyebrow badge
      await animate(".hero-eyebrow", { opacity: 1, y: 0 }, { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number,number,number,number] });

      // 2. Headline words stagger
      animate(".hero-word", { opacity: 1, y: 0, rotateX: 0 }, {
        duration: 0.65,
        delay: stagger(0.07),
        ease: [0.22, 1, 0.36, 1] as [number,number,number,number],
        at: "-0.3",
      } as Parameters<typeof animate>[2]);

      // 3. Subheading
      animate(".hero-sub", { opacity: 1, y: 0 }, {
        duration: 0.55,
        ease: [0.22, 1, 0.36, 1] as [number,number,number,number],
        at: "-0.2",
      } as Parameters<typeof animate>[2]);

      // 4. CTA row
      animate(".hero-cta", { opacity: 1, y: 0 }, {
        duration: 0.45,
        ease: [0.22, 1, 0.36, 1] as [number,number,number,number],
      } as Parameters<typeof animate>[2]);

      // 5. Trust badges stagger
      animate(".hero-badge", { opacity: 1 }, {
        duration: 0.4,
        delay: stagger(0.06),
      } as Parameters<typeof animate>[2]);

      // 6. Score mockup
      animate(".hero-mockup", { opacity: 1, y: 0, scale: 1 }, {
        duration: 0.7,
        ease: [0.22, 1, 0.36, 1] as [number,number,number,number],
        at: "-0.8",
      } as Parameters<typeof animate>[2]);
    };

    // Small delay so fonts and layout settle
    const t = setTimeout(sequence, 120);
    return () => clearTimeout(t);
  }, [animate]);

  const headline = "Stop Drowsy Driving Before It Kills";
  const words = headline.split(" ");

  return (
    <AuroraBackground className="min-h-[100dvh] flex flex-col" intensity="strong">
      <div
        ref={scope}
        className="flex-1 max-w-7xl mx-auto px-6 pt-16 pb-24 w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center"
      >
        {/* ── Left column ── */}
        <div className="flex flex-col gap-6">

          {/* Eyebrow */}
          <div
            className="hero-eyebrow w-fit"
            style={{ opacity: 0, transform: "translateY(16px)" }}
          >
            <span
              className="flex items-center gap-2 px-4 py-1.5 rounded-full border text-caption font-medium"
              style={{
                borderColor: "color-mix(in oklch, var(--ds-emerald) 35%, transparent)",
                background: "var(--ds-emerald-glow)",
                color: "var(--ds-emerald)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "var(--ds-emerald)", animation: "pulse 2s infinite" }}
              />
              Driver Risk Intelligence Platform
            </span>
          </div>

          {/* Headline — word-by-word */}
          <h1
            className="text-display"
            style={{ perspective: "900px" }}
          >
            {words.map((word, i) => (
              <span key={i} style={{ display: "inline-block", overflow: "hidden", marginRight: "0.25em" }}>
                <span
                  className="hero-word"
                  style={{
                    display: "inline-block",
                    opacity: 0,
                    transform: "translateY(60%) rotateX(-20deg)",
                  }}
                >
                  {word}
                </span>
              </span>
            ))}
          </h1>

          {/* Subhead */}
          <p
            className="hero-sub text-body-lg text-muted-foreground max-w-lg"
            style={{ opacity: 0, transform: "translateY(16px)" }}
          >
            Real-time multimodal detection using eye tracking, head pose, and posture.
            Built for motor insurance agencies — risk scoring, claims evidence, and
            fleet compliance in one platform.
          </p>

          {/* CTAs */}
          <div
            className="hero-cta flex flex-wrap gap-3"
            style={{ opacity: 0, transform: "translateY(12px)" }}
          >
            <Link href="/monitor">
              <MagneticButton variant="emerald" size="lg">
                <Play size={16} />
                Try Live Demo
              </MagneticButton>
            </Link>
            <Link href="/insurer">
              <MagneticButton variant="outline" size="lg">
                Insurance Portal
                <ArrowRight size={16} />
              </MagneticButton>
            </Link>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap gap-4 pt-1">
            {TRUST_BADGES.map((badge) => (
              <span
                key={badge}
                className="hero-badge flex items-center gap-1.5 text-caption text-muted-foreground"
                style={{ opacity: 0 }}
              >
                <Shield size={12} style={{ color: "var(--ds-emerald)" }} />
                {badge}
              </span>
            ))}
          </div>
        </div>

        {/* ── Right column — 3D eye canvas (Phase 5) ── */}
        <div
          className="hero-mockup hidden lg:block"
          style={{ opacity: 0, transform: "translateY(32px) scale(0.95)", height: "520px" }}
        >
          <HeroCanvas score={0.19} className="w-full h-full" />
        </div>
      </div>

      {/* Scroll cue */}
      <div className="flex flex-col items-center gap-2 pb-8 text-muted-foreground">
        <p className="text-caption">Scroll to explore</p>
        <div
          className="w-px h-10 rounded-full"
          style={{ background: "var(--ds-emerald)", animation: "scaleY 1.8s ease-in-out infinite" }}
        />
      </div>
    </AuroraBackground>
  );
}

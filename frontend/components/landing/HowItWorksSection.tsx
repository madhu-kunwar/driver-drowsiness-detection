"use client";

import { useRef, useEffect } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

const SIGNALS = [
  {
    id: "EAR",
    abbr: "EAR",
    name: "Eye Aspect Ratio",
    weight: "30%",
    icon: "👁",
    color: "var(--ds-emerald)",
    glow: "var(--ds-emerald-glow)",
    description:
      "Measures the ratio of eye height to width using 6 facial landmarks per eye. When EAR drops below an adaptive, per-session calibrated threshold for 3+ consecutive frames, the driver's eyes are involuntarily closing.",
    metric: "EAR < 0.21 = drowsy",
    tech: "MediaPipe FaceMesh · 468 landmarks",
    points: [
      "Adaptive baseline — calibrated in first 3 seconds",
      "Personal threshold accounts for natural eye shape",
      "Landmark jitter detection flags glasses mode",
    ],
  },
  {
    id: "PERCLOS",
    abbr: "PERCLOS",
    name: "Percentage Eye Closure",
    weight: "25%",
    icon: "⏱",
    color: "var(--ds-emerald)",
    glow: "var(--ds-emerald-glow)",
    description:
      "A 60-second rolling window measuring the proportion of time eyes are 80%+ closed. FAA-validated gold standard for drowsiness — far more reliable than single blink detection.",
    metric: ">15% = drowsy · >30% = critical",
    tech: "Rolling deque · 60-second window",
    points: [
      "Most predictive single feature in published literature",
      "Immune to single long-blink false positives",
      "Updates every frame via O(1) deque append/pop",
    ],
  },
  {
    id: "MAR",
    abbr: "MAR",
    name: "Mouth Aspect Ratio",
    weight: "20%",
    icon: "🗣",
    color: "var(--ds-alert-1)",
    glow: "color-mix(in oklch, var(--ds-alert-1) 15%, transparent)",
    description:
      "8 lip landmarks measure mouth openness. MAR > 0.6 sustained for 1.5+ seconds classifies a yawn — one of the clearest physiological fatigue markers. The 1.5s window eliminates speech false positives.",
    metric: "MAR > 0.6 for 1.5s = yawn",
    tech: "MediaPipe FaceMesh · 8 mouth pts",
    points: [
      "Distinguishes talking (short) vs yawning (sustained)",
      "Yawn count tracked per session",
      "1.5s persistence eliminates false positives from speech",
    ],
  },
  {
    id: "HeadPose",
    abbr: "Head Pose",
    name: "Head Pose Estimation",
    weight: "15%",
    icon: "🔄",
    color: "var(--ds-coral)",
    glow: "var(--ds-coral-glow)",
    description:
      "6 canonical 3D facial points projected to 2D via OpenCV solvePnP. Rodrigues rotation gives Euler angles (pitch, yaw, roll). Separates drowsiness (nodding) from distraction (looking away) at the event-log level.",
    metric: "Pitch >±20° · Yaw >±25° · Roll >±15°",
    tech: "OpenCV solvePnP · Rodrigues rotation",
    points: [
      "Pitch (nod) — forward droop, strongest fatigue signal",
      "Yaw (look away) — distraction, labelled separately",
      "Roll (tilt) — lateral lean, indicates severe drowsiness",
    ],
  },
  {
    id: "Posture",
    abbr: "Posture",
    name: "Body Posture Analysis",
    weight: "10%",
    icon: "🧍",
    color: "var(--ds-coral)",
    glow: "var(--ds-coral-glow)",
    description:
      "Shoulder and ear positions from the MediaPipe 33-point Pose skeleton measure forward lean and shoulder tilt relative to a 3-second calibration baseline captured at session start.",
    metric: "Euclidean deviation from baseline",
    tech: "MediaPipe Pose · 33-point skeleton",
    points: [
      "Shoulder tilt: arctan(Δy / Δx) vs baseline",
      "Forward lean: head_centroid − shoulder_midpoint",
      "Calibrated baseline isolates per-driver normal posture",
    ],
  },
];

export function HowItWorksSection() {
  const outerRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  /* ── Set outer height dynamically so scroll distance is correct ── */
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    function setHeight() {
      const track = trackRef.current;
      const outer = outerRef.current;
      const header = headerRef.current;
      if (!track || !outer || !header) return;
      const headerH = header.offsetHeight;
      const trackScrollWidth = track.scrollWidth - window.innerWidth + 96;
      outer.style.height = `${window.innerHeight + trackScrollWidth}px`;
    }

    setHeight();
    window.addEventListener("resize", setHeight);
    return () => window.removeEventListener("resize", setHeight);
  }, []);

  /* ── GSAP horizontal scroll ── */
  useGSAP(
    () => {
      gsap.registerPlugin(ScrollTrigger);

      const track = trackRef.current;
      const outer = outerRef.current;
      if (!track || !outer) return;

      const getScrollWidth = () =>
        track.scrollWidth - window.innerWidth + 96;

      const tween = gsap.to(track, {
        x: () => -getScrollWidth(),
        ease: "none",
        scrollTrigger: {
          trigger: outer,
          start: "top top",
          end: () => `+=${getScrollWidth()}`,
          scrub: 1.2,
          invalidateOnRefresh: true,
          // Don't use pin here — we use CSS sticky on stickyRef
        },
      });

      /* ── Card stagger on scroll progress ── */
      const cards = gsap.utils.toArray<HTMLElement>(".signal-card");
      cards.forEach((card, i) => {
        gsap.fromTo(
          card,
          { opacity: 0.3, scale: 0.92 },
          {
            opacity: 1,
            scale: 1,
            ease: "none",
            scrollTrigger: {
              trigger: outer,
              start: () => `top top+=${i * (getScrollWidth() / cards.length)}`,
              end: () => `top top+=${(i + 0.8) * (getScrollWidth() / cards.length)}`,
              scrub: 1,
              containerAnimation: tween,
            },
          }
        );
      });

      return () => {
        tween.kill();
        ScrollTrigger.getAll().forEach((t) => t.kill());
      };
    },
    { scope: outerRef }
  );

  return (
    /* Outer — tall enough for full scroll distance */
    <section ref={outerRef} className="relative bg-background" style={{ willChange: "transform" }}>
      {/* Sticky viewport-height panel */}
      <div
        ref={stickyRef}
        className="sticky top-0 h-screen overflow-hidden flex flex-col"
      >
        {/* ── Static header ── */}
        <div ref={headerRef} className="max-w-7xl mx-auto px-6 pt-16 pb-8 flex-shrink-0 w-full">
          <span
            className="text-caption font-semibold uppercase tracking-widest"
            style={{ color: "var(--ds-emerald)" }}
          >
            How It Works
          </span>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mt-3">
            <h2 className="text-h1">Five signals. One score.</h2>
            <p className="text-caption text-muted-foreground max-w-xs">
              Scroll to walk through each detection pipeline →
            </p>
          </div>

          {/* Weight bar */}
          <div className="flex mt-5 h-2 rounded-full overflow-hidden gap-0.5">
            {SIGNALS.map(({ abbr, weight, color }) => (
              <div
                key={abbr}
                title={`${abbr} · ${weight}`}
                className="h-full rounded-sm transition-all"
                style={{ width: weight, background: color }}
              />
            ))}
          </div>
          <div className="flex mt-1 gap-0">
            {SIGNALS.map(({ abbr, weight }) => (
              <span
                key={abbr}
                className="text-caption text-muted-foreground"
                style={{ width: weight, textAlign: "center", fontSize: "10px" }}
              >
                {abbr}
              </span>
            ))}
          </div>
        </div>

        {/* ── Horizontal track ── */}
        <div className="flex-1 flex items-center overflow-visible px-6">
          <div
            ref={trackRef}
            className="flex gap-5 items-stretch"
            style={{ willChange: "transform" }}
          >
            {SIGNALS.map(({ id, abbr, name, weight, icon, color, glow, description, metric, tech, points }) => (
              <div
                key={id}
                className="signal-card flex-shrink-0 w-[420px] rounded-2xl border border-border bg-card flex flex-col p-6 gap-4 overflow-hidden relative"
                style={{ minHeight: "340px" }}
              >
                {/* Glow bg */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: `radial-gradient(ellipse 70% 50% at 20% 20%, ${glow}, transparent)` }}
                />

                <div className="relative z-10 flex flex-col gap-4 h-full">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{icon}</span>
                      <div>
                        <p className="text-h3">{abbr}</p>
                        <p className="text-caption text-muted-foreground">{name}</p>
                      </div>
                    </div>
                    <span
                      className="text-caption font-bold px-2.5 py-1 rounded-lg flex-shrink-0"
                      style={{ background: `${color}22`, color }}
                    >
                      {weight}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-caption text-muted-foreground flex-1 leading-relaxed">
                    {description}
                  </p>

                  {/* Metric chip */}
                  <code
                    className="block px-3 py-2 rounded-lg text-caption"
                    style={{ background: `${color}14`, color, fontFamily: "var(--font-mono)" }}
                  >
                    {metric}
                  </code>

                  {/* Tech */}
                  <p className="text-caption text-muted-foreground">
                    <span className="font-semibold text-foreground">Stack: </span>
                    {tech}
                  </p>

                  {/* Points */}
                  <ul className="space-y-1">
                    {points.map((pt, i) => (
                      <li key={i} className="flex items-start gap-2 text-caption text-muted-foreground">
                        <span style={{ color }} className="mt-px">›</span>
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}

            {/* End card — fusion result */}
            <div
              className="flex-shrink-0 w-[340px] rounded-2xl border flex flex-col items-center justify-center p-8 gap-5 text-center"
              style={{
                borderColor: "color-mix(in oklch, var(--ds-emerald) 35%, transparent)",
                background: "var(--ds-emerald-glow)",
              }}
            >
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-h1 font-bold text-white shadow-xl"
                style={{ background: "var(--ds-emerald)" }}
              >
                0.24
              </div>
              <div>
                <p className="text-h3 mb-1" style={{ color: "var(--ds-emerald)" }}>
                  Composite Score
                </p>
                <p className="text-caption text-muted-foreground">
                  Weighted fusion of all 5 signals
                </p>
              </div>
              <div
                className="px-5 py-2 rounded-xl text-body font-semibold text-white"
                style={{ background: "var(--ds-emerald)" }}
              >
                ● ALERT — Level 0
              </div>
              <p className="text-caption text-muted-foreground">
                Updated every 33ms · &lt;100ms total pipeline
              </p>
            </div>
          </div>
        </div>

        {/* Progress hint */}
        <p className="text-center text-caption text-muted-foreground pb-4">
          ← scroll to advance →
        </p>
      </div>
    </section>
  );
}

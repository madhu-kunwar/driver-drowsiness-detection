"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import { AnimatedCounter } from "@/components/shared/AnimatedCounter";
import { GlowCard } from "@/components/shared/GlowCard";
import { TrendingDown, AlertTriangle, DollarSign, Clock } from "lucide-react";

const STATS = [
  { icon: DollarSign,    value: 109,  prefix: "$", suffix: "B",  label: "Annual cost of drowsy driving crashes (US)", source: "NHTSA",           color: "coral"   },
  { icon: AlertTriangle, value: 6400, prefix: "",  suffix: "+",  label: "Annual drowsy driving fatalities",           source: "NHTSA 2025",       color: "coral"   },
  { icon: Clock,         value: 50,   prefix: "",  suffix: "%",  label: "Fatal truck crashes involving driver fatigue",source: "FMCSA",            color: "coral"   },
  { icon: TrendingDown,  value: 148,  prefix: "$", suffix: "K",  label: "Average commercial trucking claim cost",     source: "Insurance Journal", color: "emerald" },
];

const PROBLEMS = [
  { title: "Premiums priced on demographics, not behaviour",   desc: "Insurers still use age, location, and history. Drivers who actively monitor fatigue get no reward." },
  { title: "Claims disputes rely on witness statements",        desc: "Without objective drowsiness data, fault is contested, slow, and expensive for both parties." },
  { title: "Fleet managers are blind until accidents happen",   desc: "No real-time visibility into driver cognitive state. The first signal is often a crash report." },
  { title: "DMS hardware costs thousands per vehicle",          desc: "OEM systems like Mobileye are unreachable for the 1B+ vehicles already on the road." },
];

export function ProblemSection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.registerPlugin(ScrollTrigger);

      /* Heading slide in */
      gsap.from(".problem-heading", {
        y: 50, opacity: 0, duration: 0.8,
        ease: "power3.out",
        scrollTrigger: { trigger: ".problem-heading", start: "top 85%", toggleActions: "play none none none" },
      });

      /* Stat cards batch */
      ScrollTrigger.batch(".stat-card", {
        onEnter: (batch) =>
          gsap.to(batch, {
            opacity: 1, y: 0, scale: 1,
            duration: 0.65, stagger: 0.1,
            ease: "power3.out",
          }),
        start: "top 88%",
      });

      /* Problem rows stagger */
      gsap.from(".problem-row", {
        x: -32, opacity: 0, duration: 0.55,
        ease: "power3.out",
        stagger: 0.1,
        scrollTrigger: { trigger: ".problem-row", start: "top 85%", toggleActions: "play none none none" },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      className="relative py-28 overflow-hidden bg-card"
    >
      <div
        className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-10 pointer-events-none"
        style={{ background: "var(--ds-coral)" }}
      />

      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="problem-heading max-w-2xl mb-20">
          <span className="text-caption font-semibold uppercase tracking-widest" style={{ color: "var(--ds-coral)" }}>
            The Problem
          </span>
          <h2 className="text-h1 mt-3 mb-4">Drowsy driving costs more than you think</h2>
          <p className="text-body-lg text-muted-foreground">
            Every year, fatigued drivers cause billions in insured losses. Insurance companies have
            no objective data, fleets have no visibility, and current solutions require expensive
            hardware nobody has retrofitted.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-20">
          {STATS.map(({ icon: Icon, value, prefix, suffix, label, source, color }) => (
            <div
              key={label}
              className="stat-card"
              style={{ opacity: 0, transform: "translateY(32px) scale(0.95)" }}
            >
              <GlowCard glowColor={color as "emerald" | "coral"} className="p-6 h-full">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: color === "coral" ? "var(--ds-coral-glow)" : "var(--ds-emerald-glow)" }}
                >
                  <Icon size={20} style={{ color: color === "coral" ? "var(--ds-coral)" : "var(--ds-emerald)" }} />
                </div>
                <p className="text-metric mb-2" style={{ color: color === "coral" ? "var(--ds-coral)" : "var(--ds-emerald)" }}>
                  <AnimatedCounter value={value} prefix={prefix} suffix={suffix} duration={2.2} />
                </p>
                <p className="text-caption text-foreground font-medium mb-1">{label}</p>
                <p className="text-caption text-muted-foreground">Source: {source}</p>
              </GlowCard>
            </div>
          ))}
        </div>

        {/* Problem list */}
        <h3 className="text-h2 mb-10 max-w-xl">The insurance industry has four unsolved problems</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PROBLEMS.map(({ title, desc }, i) => (
            <div key={title} className="problem-row flex gap-4 p-6 rounded-2xl border border-border bg-card">
              <span
                className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-caption font-bold text-white mt-0.5"
                style={{ background: "var(--ds-coral)" }}
              >
                {i + 1}
              </span>
              <div>
                <h4 className="text-h3 mb-1">{title}</h4>
                <p className="text-caption text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

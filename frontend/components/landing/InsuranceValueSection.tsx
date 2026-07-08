"use client";

import { motion } from "framer-motion";
import { GlowCard } from "@/components/shared/GlowCard";
import { AnimatedCounter } from "@/components/shared/AnimatedCounter";
import { MagneticButton } from "@/components/shared/MagneticButton";
import { ArrowRight, TrendingDown, FileCheck, ShieldCheck, BarChart2 } from "lucide-react";
import Link from "next/link";

const RISK_BANDS = [
  { band: "A", label: "Excellent", adj: "-15%", sessions: "0–2 alerts/mo", color: "var(--ds-emerald)", bg: "band-bg-a" },
  { band: "B", label: "Good",      adj: "-8%",  sessions: "3–8 alerts/mo", color: "oklch(0.82 0.14 162)", bg: "band-bg-b" },
  { band: "C", label: "Average",   adj: "±0%",  sessions: "9–18/mo",       color: "var(--ds-alert-1)", bg: "band-bg-c" },
  { band: "D", label: "Elevated",  adj: "+12%", sessions: "19–35/mo",      color: "var(--ds-coral)", bg: "band-bg-d" },
  { band: "F", label: "High Risk", adj: "+25%", sessions: "36+/mo",        color: "var(--ds-alert-3)", bg: "band-bg-f" },
];

const USE_CASES = [
  {
    icon: TrendingDown,
    title: "Usage-Based Insurance (PHYD)",
    desc: "Add cognitive risk to your existing telematics signals. Drowsiness score + PERCLOS + yawn count generate an actuarial risk band that feeds directly into your pricing engine.",
    tags: ["UBI", "PHYD", "Actuarial API"],
  },
  {
    icon: FileCheck,
    title: "Claims Investigation",
    desc: "Generate a tamper-evident, SHA-256 hash-chained evidence package for any incident timestamp. 6-page PDF formatted for adjusters and legal teams.",
    tags: ["Evidence PDF", "Audit Chain", "Fraud Flag"],
  },
  {
    icon: ShieldCheck,
    title: "Fleet Compliance",
    desc: "Track FMCSA Hours of Service limits per driver. Correlate HOS violations with drowsiness score spikes — the insight that reduces claims before they happen.",
    tags: ["FMCSA HOS", "Fleet Dashboard", "Webhook Alerts"],
  },
  {
    icon: BarChart2,
    title: "Actuarial Data Products",
    desc: "Export anonymised aggregate drowsiness data in CSV/Excel. Risk tables by hour-of-day, day-of-week, session duration. Plug into your actuarial modelling suite.",
    tags: ["CSV Export", "Risk Heatmap", "Correlation API"],
  },
];

const ROI_STATS = [
  { value: 15, suffix: "–30%", label: "Premium reduction for telematics-verified safe fleets" },
  { value: 148, prefix: "$", suffix: "K", label: "Average commercial trucking claim prevented" },
  { value: 28, suffix: "%", label: "Fewer accidents in monitored fleets" },
];

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
};

export function InsuranceValueSection() {
  return (
    <section
      className="relative py-28 overflow-hidden bg-card"
    >
      <div
        className="absolute bottom-0 right-0 w-[500px] h-[400px] rounded-full blur-3xl opacity-10 pointer-events-none"
        style={{ background: "var(--ds-emerald)" }}
      />

      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <motion.div {...fadeUp} transition={{ duration: 0.6 }} className="max-w-2xl mb-16">
          <span
            className="text-caption font-semibold uppercase tracking-widest"
            style={{ color: "var(--ds-emerald)" }}
          >
            Insurance Value
          </span>
          <h2 className="text-h1 mt-3 mb-4">
            Built for what insurers actually need
          </h2>
          <p className="text-body-lg text-muted-foreground">
            Not just a detection demo. Every output is designed to plug into
            underwriting, claims, compliance, and actuarial workflows.
          </p>
        </motion.div>

        {/* Risk Band Visualiser */}
        <motion.div {...fadeUp} transition={{ duration: 0.6, delay: 0.1 }} className="mb-16">
          <h3 className="text-h2 mb-6">Driver Risk Bands</h3>
          <div className="space-y-3">
            {RISK_BANDS.map(({ band, label, adj, sessions, color, bg }, i) => (
              <motion.div
                key={band}
                initial={{ opacity: 0, x: -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07, duration: 0.45 }}
                className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card"
              >
                {/* Band letter */}
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-h2 font-bold flex-shrink-0 ${bg}`}
                  style={{ color }}
                >
                  {band}
                </div>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <p className="text-body font-semibold" style={{ color }}>
                    {label}
                  </p>
                  <p className="text-caption text-muted-foreground">{sessions}</p>
                </div>

                {/* Bar */}
                <div className="hidden sm:block flex-1 h-2 rounded-full bg-muted overflow-hidden max-w-48">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${20 * (i + 1)}%`,
                      background: color,
                    }}
                  />
                </div>

                {/* Adjustment */}
                <div className="text-right flex-shrink-0">
                  <p
                    className="text-metric-sm font-bold"
                    style={{ color }}
                  >
                    {adj}
                  </p>
                  <p className="text-caption text-muted-foreground">premium adj.</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ROI stats */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-16"
        >
          {ROI_STATS.map(({ value, prefix, suffix, label }, i) => (
            <div
              key={label}
              className="p-6 rounded-2xl border border-border text-center bg-card"
            >
              <p className="text-metric" style={{ color: "var(--ds-emerald)" }}>
                <AnimatedCounter value={value} prefix={prefix ?? ""} suffix={suffix} />
              </p>
              <p className="text-caption text-muted-foreground mt-2">{label}</p>
            </div>
          ))}
        </motion.div>

        {/* Use cases */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
          {USE_CASES.map(({ icon: Icon, title, desc, tags }, i) => (
            <motion.div
              key={title}
              {...fadeUp}
              transition={{ duration: 0.5, delay: i * 0.08 }}
            >
              <GlowCard glowColor="emerald" className="p-6 h-full flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "var(--ds-emerald-glow)" }}
                  >
                    <Icon size={20} style={{ color: "var(--ds-emerald)" }} />
                  </div>
                  <h4 className="text-h3">{title}</h4>
                </div>
                <p className="text-caption text-muted-foreground flex-1">{desc}</p>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-caption px-2.5 py-1 rounded-lg font-medium"
                      style={{
                        background: "var(--ds-emerald-glow)",
                        color: "var(--ds-emerald)",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </GlowCard>
            </motion.div>
          ))}
        </div>

        {/* CTA row */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-wrap gap-3"
        >
          <Link href="/insurer">
            <MagneticButton variant="emerald" size="lg">
              Open Insurance Portal <ArrowRight size={16} />
            </MagneticButton>
          </Link>
          <Link href="/insurer/claims">
            <MagneticButton variant="outline" size="lg">
              Try Claims Evidence Tool
            </MagneticButton>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

"use client";

import { motion } from "framer-motion";
import { GlowCard } from "@/components/shared/GlowCard";
import { ShieldCheck, Globe, Truck, Lock } from "lucide-react";

const REGULATIONS = [
  {
    icon: Globe,
    badge: "EU GSR · July 2026",
    title: "EU General Safety Regulation",
    mandate: "All new vehicle types must have ADDW from July 7, 2026",
    desc: "The EU's GSR mandates Advanced Driver Distraction Warning on every new vehicle type sold in Europe. Indirect monitoring (steering sensors) no longer qualifies — direct eye and head tracking is required.",
    compliance: "Our system provides direct eye tracking + head pose — fully compliant",
    urgency: "high",
  },
  {
    icon: ShieldCheck,
    badge: "Euro NCAP · 2026 Protocol",
    title: "Euro NCAP 2026 DMS Scoring",
    mandate: "Driver Monitoring is now worth 25 points in Euro NCAP ratings",
    desc: "From 2026, Euro NCAP requires real-time drowsiness detection at highway speeds, distraction monitoring including frequent short glances, and phone use detection for a 5-star safety rating.",
    compliance: "EAR + PERCLOS + head pose satisfies direct monitoring requirement",
    urgency: "high",
  },
  {
    icon: Truck,
    badge: "FMCSA · US Commercial",
    title: "FMCSA Hours of Service",
    mandate: "Max 11 hrs driving · 30-min break after 8 hrs · 60/70-hr weekly cap",
    desc: "FMCSA HOS regulations define the maximum driving hours for commercial vehicle operators. Our system tracks cumulative driving time per session and correlates HOS violations with drowsiness score increases.",
    compliance: "HOS tracking + drowsiness correlation included in fleet tier",
    urgency: "medium",
  },
  {
    icon: Lock,
    badge: "GDPR · Privacy",
    title: "GDPR & Data Privacy",
    mandate: "No video stored · On-device biometric processing · Full right-to-erasure",
    desc: "Five US states introduced telematics privacy legislation in 2026. Our system processes all biometric data ephemerally — no raw video or facial embeddings are stored. Consent is scoped and explicit.",
    compliance: "Article 17 (erasure) + Article 20 (portability) endpoints built-in",
    urgency: "medium",
  },
];

const TIMELINE = [
  { year: "Jul 2024", event: "ADDW required for new EU vehicle types (first wave)" },
  { year: "Jan 2026", event: "California SB 1007: no interference with OEM DMS devices" },
  { year: "Jul 2026", event: "EU GSR ADDW required for ALL new vehicles sold in EU" },
  { year: "2026",     event: "Euro NCAP DMS worth 25 points — direct monitoring mandatory" },
  { year: "2027",     event: "Mobileye DMS production start (millions of vehicles)" },
  { year: "2029",     event: "Euro NCAP 2029 protocol — expected to tighten further" },
];

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
};

export function RegulatorySection() {
  return (
    <section
      className="relative py-28 overflow-hidden bg-card"
    >
      <div
        className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-8 pointer-events-none"
        style={{ background: "var(--ds-emerald)" }}
      />

      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <motion.div {...fadeUp} transition={{ duration: 0.6 }} className="max-w-2xl mb-16">
          <span
            className="text-caption font-semibold uppercase tracking-widest"
            style={{ color: "var(--ds-emerald)" }}
          >
            Regulatory Landscape
          </span>
          <h2 className="text-h1 mt-3 mb-4">
            Mandated by law. Now.
          </h2>
          <p className="text-body-lg text-muted-foreground">
            2026 is the year DMS became compulsory. EU regulators, US states, and Euro
            NCAP are all requiring driver monitoring simultaneously — creating the largest
            DMS demand spike in history.
          </p>
        </motion.div>

        {/* Regulation cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-16">
          {REGULATIONS.map(({ icon: Icon, badge, title, mandate, desc, compliance, urgency }, i) => (
            <motion.div
              key={title}
              {...fadeUp}
              transition={{ duration: 0.5, delay: i * 0.08 }}
            >
              <GlowCard
                glowColor={urgency === "high" ? "coral" : "emerald"}
                className="p-6 h-full flex flex-col gap-4"
              >
                {/* Badge row */}
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center gap-2 px-3 py-1 rounded-full text-caption font-semibold"
                    style={{
                      background:
                        urgency === "high"
                          ? "var(--ds-coral-glow)"
                          : "var(--ds-emerald-glow)",
                      color:
                        urgency === "high"
                          ? "var(--ds-coral)"
                          : "var(--ds-emerald)",
                    }}
                  >
                    <Icon size={12} />
                    {badge}
                  </div>
                  {urgency === "high" && (
                    <span
                      className="text-caption font-bold px-2 py-0.5 rounded"
                      style={{
                        background: "var(--ds-coral-glow)",
                        color: "var(--ds-coral)",
                      }}
                    >
                      ACTIVE NOW
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-h3 mb-1">{title}</h3>
                  <p
                    className="text-caption font-semibold"
                    style={{
                      color:
                        urgency === "high"
                          ? "var(--ds-coral)"
                          : "var(--ds-emerald)",
                    }}
                  >
                    {mandate}
                  </p>
                </div>

                <p className="text-caption text-muted-foreground flex-1">{desc}</p>

                <div
                  className="p-3 rounded-xl flex items-start gap-2"
                  style={{ background: "var(--ds-emerald-glow)" }}
                >
                  <ShieldCheck
                    size={14}
                    style={{ color: "var(--ds-emerald)", flexShrink: 0, marginTop: 2 }}
                  />
                  <p className="text-caption" style={{ color: "var(--ds-emerald)" }}>
                    {compliance}
                  </p>
                </div>
              </GlowCard>
            </motion.div>
          ))}
        </div>

        {/* Timeline */}
        <motion.div {...fadeUp} transition={{ duration: 0.6, delay: 0.2 }}>
          <h3 className="text-h2 mb-8">Regulatory timeline</h3>
          <div className="relative pl-6">
            {/* Vertical line */}
            <div
              className="absolute left-0 top-2 bottom-2 w-px"
              style={{ background: "var(--ds-emerald)" }}
            />

            <div className="space-y-6">
              {TIMELINE.map(({ year, event }, i) => (
                <motion.div
                  key={year + event}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06, duration: 0.4 }}
                  className="flex items-start gap-4"
                >
                  {/* Dot */}
                  <div
                    className="absolute -left-1.5 w-3 h-3 rounded-full border-2 border-background"
                    style={{
                      background: "var(--ds-emerald)",
                      marginTop: "0.35rem",
                    }}
                  />
                  <div className="flex items-baseline gap-3">
                    <span
                      className="text-caption font-bold w-16 flex-shrink-0"
                      style={{ color: "var(--ds-emerald)" }}
                    >
                      {year}
                    </span>
                    <span className="text-caption text-foreground">{event}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

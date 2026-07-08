"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Play, Building2, Truck } from "lucide-react";
import { AuroraBackground } from "@/components/shared/AuroraBackground";
import { MagneticButton } from "@/components/shared/MagneticButton";

const PATHS = [
  {
    icon: Play,
    title: "Try the Live Demo",
    desc: "Open the monitor page, allow webcam access, and see real-time drowsiness detection in under 30 seconds.",
    cta: "Start Monitoring",
    href: "/monitor",
    variant: "emerald" as const,
  },
  {
    icon: Building2,
    title: "Insurance Portal",
    desc: "Explore the fleet risk dashboard, driver risk cards, claims evidence tool, and actuarial export.",
    cta: "Open Portal",
    href: "/insurer",
    variant: "outline" as const,
  },
  {
    icon: Truck,
    title: "Fleet Compliance",
    desc: "See FMCSA HOS tracking, drowsiness-HOS correlation, and weekly compliance reports for your drivers.",
    cta: "View Fleet",
    href: "/insurer/fleet",
    variant: "outline" as const,
  },
];

export function CTASection() {
  return (
    <AuroraBackground className="py-28" intensity="medium">
      <div className="max-w-7xl mx-auto px-6 text-center">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-h1 mb-4">
            Ready to reduce drowsy driving claims?
          </h2>
          <p className="text-body-lg text-muted-foreground">
            Deploy DrowsyShield for your fleet. No hardware purchase. No OEM integration.
            Just a webcam and a browser — and your drivers get monitored from day one.
          </p>
        </motion.div>

        {/* Path cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          {PATHS.map(({ icon: Icon, title, desc, cta, href, variant }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              <Link href={href} className="block group h-full">
                <div className="p-6 rounded-2xl border border-border bg-card/70 backdrop-blur-sm h-full flex flex-col gap-4 group-hover:border-primary transition-colors">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto"
                    style={{ background: "var(--ds-emerald-glow)" }}
                  >
                    <Icon size={22} style={{ color: "var(--ds-emerald)" }} />
                  </div>
                  <h3 className="text-h3">{title}</h3>
                  <p className="text-caption text-muted-foreground flex-1">{desc}</p>
                  <div className="flex items-center justify-center gap-1.5 text-caption font-semibold group-hover:gap-2.5 transition-all"
                    style={{ color: "var(--ds-emerald)" }}
                  >
                    {cta} <ArrowRight size={14} />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Main CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="flex flex-wrap gap-4 justify-center"
        >
          <Link href="/monitor">
            <MagneticButton variant="emerald" size="lg">
              Try Live Demo Now <ArrowRight size={18} />
            </MagneticButton>
          </Link>
          <Link href="/insurer">
            <MagneticButton variant="coral" size="lg">
              Insurance Partner Portal
            </MagneticButton>
          </Link>
        </motion.div>

        {/* Fine print */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-caption text-muted-foreground mt-8"
        >
          No video stored · No hardware required · Works with any $25 webcam ·
          GDPR compliant · Euro NCAP 2026 ready
        </motion.p>
      </div>
    </AuroraBackground>
  );
}

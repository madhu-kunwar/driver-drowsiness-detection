"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Globe, Share2, AtSign, ArrowUpRight } from "lucide-react";
import { Logo } from "./Logo";
import { Separator } from "@/components/ui/separator";

const LINKS = {
  Product: [
    { label: "Live Monitor", href: "/monitor" },
    { label: "Dashboard", href: "/dashboard" },
    { label: "Session History", href: "/sessions" },
    { label: "Settings", href: "/settings" },
  ],
  Insurance: [
    { label: "Fleet Portal", href: "/insurer" },
    { label: "Driver Risk Card", href: "/driver/risk-card" },
    { label: "Claims Evidence", href: "/insurer/claims" },
    { label: "Compliance Reports", href: "/insurer/reports" },
  ],
  Research: [
    { label: "Technical Paper", href: "#research", external: false },
    { label: "Ablation Study", href: "#ablation", external: false },
    { label: "NTHU-DDD Dataset", href: "#dataset", external: true },
    { label: "Euro NCAP 2026", href: "#ncap", external: true },
  ],
  Legal: [
    { label: "Privacy Policy", href: "#privacy" },
    { label: "Data Handling", href: "#data" },
    { label: "GDPR Compliance", href: "#gdpr" },
    { label: "Terms of Use", href: "#terms" },
  ],
};

const SOCIALS = [
  { Icon: Globe, href: "#", label: "GitHub" },
  { Icon: Share2, href: "#", label: "X / Twitter" },
  { Icon: AtSign, href: "#", label: "LinkedIn" },
];

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

export function Footer() {
  return (
    <footer className="relative mt-auto border-t border-border/50 overflow-hidden bg-background">
      {/* Subtle gradient backdrop */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 20% 100%, var(--ds-emerald-glow), transparent)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 pt-16 pb-8">
        {/* Top section */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-10 mb-14">
          {/* Brand column */}
          <motion.div className="col-span-2" {...fadeUp}>
            <Logo />
            <p className="mt-4 text-caption text-muted-foreground leading-relaxed max-w-xs">
              Real-time driver drowsiness detection powered by computer vision.
              Built for motor insurance agencies and fleet operators.
            </p>

            {/* Stats row */}
            <div className="flex gap-6 mt-6">
              {[
                { value: "91%", label: "Accuracy" },
                { value: "<85ms", label: "Latency" },
                { value: "5", label: "Signals" },
              ].map(({ value, label }) => (
                <div key={label}>
                  <p
                    className="text-metric-sm font-semibold"
                    style={{ color: "var(--ds-emerald)" }}
                  >
                    {value}
                  </p>
                  <p className="text-caption text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>

            {/* Social links */}
            <div className="flex gap-3 mt-6">
              {SOCIALS.map(({ Icon, href, label }) => (
                <motion.a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary transition-all"
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Icon size={16} />
                </motion.a>
              ))}
            </div>
          </motion.div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([category, links], i) => (
            <motion.div
              key={category}
              {...fadeUp}
              transition={{ duration: 0.5, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
            >
              <h3 className="text-caption font-semibold text-foreground mb-4 tracking-wide uppercase">
                {category}
              </h3>
              <ul className="space-y-2.5">
                {links.map(({ label, href, ...rest }) => {
                  const external = "external" in rest ? rest.external : false;
                  return (
                    <li key={label}>
                      <Link
                        href={href}
                        className="text-caption text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 group"
                        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      >
                        {label}
                        {external && (
                          <ArrowUpRight
                            size={12}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Compliance badges */}
        <motion.div
          className="flex flex-wrap gap-2 mb-8"
          {...fadeUp}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {[
            "Euro NCAP 2026 Ready",
            "EU GSR Compliant",
            "FMCSA HOS Tracking",
            "GDPR Compliant",
            "NTHU-DDD Benchmarked",
          ].map((badge) => (
            <span
              key={badge}
              className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-medium border"
              style={{
                borderColor: "var(--ds-emerald-glow)",
                color: "var(--ds-emerald-text)",
                background: "var(--ds-emerald-glow)",
              }}
            >
              {badge}
            </span>
          ))}
        </motion.div>

        <Separator className="mb-6 opacity-30" />

        {/* Bottom bar */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-between gap-4"
          {...fadeUp}
          transition={{ duration: 0.5, delay: 0.35 }}
        >
          <p className="text-caption text-muted-foreground">
            © 2026 DrowsyShield · Pranav Bhandari, Madhu Kunwar, Madhusudan Bhandari, Samrat Giri
          </p>
          <p className="text-caption text-muted-foreground">
            Pokhara University · NCIT · Final Year Project 2026
          </p>
        </motion.div>
      </div>
    </footer>
  );
}

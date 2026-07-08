"use client";

import { use } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft, Clock, TrendingUp, AlertTriangle,
  Shield, Download, Calendar,
} from "lucide-react";
import { useSession } from "@/hooks/queries/sessions";
import { DrowsinessChart } from "@/components/charts/DrowsinessChart";
import { AlertFrequencyChart } from "@/components/charts/AlertFrequencyChart";
import { GlowCard } from "@/components/shared/GlowCard";
import { SpotlightCard } from "@/components/shared/SpotlightCard";
import { AnimatedCounter } from "@/components/shared/AnimatedCounter";
import { ALERT_META } from "@/types/detection";
import type { Session } from "@/types/detection";

const BAND_COLORS: Record<string, string> = {
  A: "var(--ds-emerald)",
  B: "oklch(0.82 0.14 162)",
  C: "var(--ds-alert-1)",
  D: "var(--ds-coral)",
  F: "var(--ds-alert-3)",
};

/* Generate a mock score timeline for the session */
function mockSessionTimeline(session: Session) {
  const points = 40;
  return Array.from({ length: points }, (_, i) => {
    const progress = i / points;
    // Score drifts toward peak then comes back
    const peak = session.peakScore;
    const avg = session.avgScore;
    const drift = avg + (peak - avg) * Math.sin(progress * Math.PI);
    const noise = (Math.random() - 0.5) * 0.08;
    return {
      label: `${Math.floor((session.durationS / 60) * progress)}m`,
      score: Math.max(0, Math.min(1, drift + noise)),
    };
  });
}

/* Mock weekly alert frequency for this session's week */
function mockWeekAlerts(session: Session) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return days.map((day) => ({
    day,
    l1: Math.floor(Math.random() * 20 + 5),
    l2: Math.floor(Math.random() * 8),
    l3: session.alertCount[3] > 0 ? Math.floor(Math.random() * 3) : 0,
  }));
}

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session, isLoading } = useSession(id);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 text-center text-muted-foreground text-body">
        Loading session…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <p className="text-h2 text-muted-foreground mb-4">Session not found</p>
        <Link href="/sessions" className="text-primary text-body hover:underline">
          ← Back to sessions
        </Link>
      </div>
    );
  }

  const bandColor = BAND_COLORS[session.riskBand] ?? "var(--ds-emerald)";
  const startDate = new Date(session.startedAt);
  const endDate = session.endedAt ? new Date(session.endedAt) : null;
  const durationMin = Math.floor(session.durationS / 60);
  const timelineData = mockSessionTimeline(session);
  const weekAlerts = mockWeekAlerts(session);

  const statCards = [
    {
      icon: TrendingUp,
      label: "Avg Score",
      value: session.avgScore * 100,
      suffix: "%",
      color: session.avgScore > 0.5 ? "coral" : "emerald",
    },
    {
      icon: AlertTriangle,
      label: "Peak Score",
      value: session.peakScore * 100,
      suffix: "%",
      color: session.peakScore > 0.5 ? "coral" : "emerald",
    },
    {
      icon: Clock,
      label: "Duration",
      value: durationMin,
      suffix: " min",
      color: "emerald",
    },
    {
      icon: Shield,
      label: "Total Alerts",
      value: session.alertCount[1] + session.alertCount[2] + session.alertCount[3],
      suffix: "",
      color: session.alertCount[3] > 0 ? "coral" : "emerald",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Back link */}
      <motion.div {...fadeUp}>
        <Link
          href="/sessions"
          className="flex items-center gap-2 text-caption text-muted-foreground hover:text-foreground transition-colors mb-8 w-fit"
        >
          <ArrowLeft size={14} /> Back to sessions
        </Link>
      </motion.div>

      {/* Header */}
      <motion.div
        {...fadeUp}
        transition={{ delay: 0.05, duration: 0.45 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
      >
        <div className="flex items-center gap-4">
          {/* Risk band badge */}
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-h1 font-bold flex-shrink-0"
            style={{ background: `${bandColor}22`, color: bandColor }}
          >
            {session.riskBand}
          </div>
          <div>
            <h1 className="text-h1 mb-1">Session Report</h1>
            <div className="flex items-center gap-2 text-caption text-muted-foreground flex-wrap">
              <Calendar size={12} />
              {startDate.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
              <span>·</span>
              {startDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              {endDate && (
                <>
                  <span>→</span>
                  {endDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Premium adjustment */}
        <div className="flex items-center gap-3">
          <div
            className="px-4 py-2 rounded-xl text-center"
            style={{
              background: session.premiumAdjustment < 1 ? "var(--ds-emerald-glow)" : "var(--ds-coral-glow)",
            }}
          >
            <p
              className="text-metric font-bold"
              style={{ color: session.premiumAdjustment < 1 ? "var(--ds-emerald)" : "var(--ds-coral)" }}
            >
              {session.premiumAdjustment < 1 ? "-" : "+"}
              {Math.abs((1 - session.premiumAdjustment) * 100).toFixed(0)}%
            </p>
            <p className="text-caption text-muted-foreground">premium adj.</p>
          </div>

          <button
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-caption font-medium hover:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => window.print()}
          >
            <Download size={14} />
            Export PDF
          </button>
        </div>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(({ icon: Icon, label, value, suffix, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.07, duration: 0.45 }}
          >
            <GlowCard
              glowColor={color as "emerald" | "coral"}
              className="p-5"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                style={{
                  background: color === "coral" ? "var(--ds-coral-glow)" : "var(--ds-emerald-glow)",
                }}
              >
                <Icon
                  size={16}
                  style={{ color: color === "coral" ? "var(--ds-coral)" : "var(--ds-emerald)" }}
                />
              </div>
              <p
                className="text-metric mb-1"
                style={{ color: color === "coral" ? "var(--ds-coral)" : "var(--ds-emerald)" }}
              >
                <AnimatedCounter value={value} suffix={suffix} decimals={0} />
              </p>
              <p className="text-caption text-muted-foreground">{label}</p>
            </GlowCard>
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Score timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.45 }}
        >
          <SpotlightCard className="p-5">
            <h3 className="text-h3 mb-1">Drowsiness Timeline</h3>
            <p className="text-caption text-muted-foreground mb-4">
              Score across the full session duration
            </p>
            <DrowsinessChart data={timelineData} height={180} />
          </SpotlightCard>
        </motion.div>

        {/* Alert breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.45 }}
        >
          <SpotlightCard className="p-5">
            <h3 className="text-h3 mb-1">Alert Frequency</h3>
            <p className="text-caption text-muted-foreground mb-4">
              This session&apos;s week at a glance
            </p>
            <AlertFrequencyChart data={weekAlerts} height={180} />
          </SpotlightCard>
        </motion.div>
      </div>

      {/* Alert level breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.45 }}
        className="mb-8"
      >
        <SpotlightCard className="p-5">
          <h3 className="text-h3 mb-4">Alert Level Breakdown</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {([0, 1, 2, 3] as const).map((lvl) => {
              const count = session.alertCount[lvl] ?? 0;
              const total = Object.values(session.alertCount).reduce((a, b) => a + b, 0);
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div
                  key={lvl}
                  className="flex flex-col items-center p-4 rounded-xl"
                  style={{ background: `${ALERT_META[lvl].color}12` }}
                >
                  <p
                    className="text-metric font-bold"
                    style={{ color: ALERT_META[lvl].color, fontFamily: "var(--font-mono)" }}
                  >
                    {count.toLocaleString()}
                  </p>
                  <p
                    className="text-caption font-semibold mt-0.5"
                    style={{ color: ALERT_META[lvl].color }}
                  >
                    Level {lvl} — {ALERT_META[lvl].label}
                  </p>
                  <p className="text-caption text-muted-foreground mt-1">{pct}% of session</p>
                </div>
              );
            })}
          </div>
        </SpotlightCard>
      </motion.div>

      {/* Insurance summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.45 }}
      >
        <GlowCard
          glowColor={session.riskBand === "A" || session.riskBand === "B" ? "emerald" : "coral"}
          className="p-6"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-h3 mb-1">Insurance Risk Summary</h3>
              <p className="text-caption text-muted-foreground max-w-md">
                This session contributes to your policy period risk profile.
                Band {session.riskBand} qualifies for a{" "}
                <strong style={{ color: bandColor }}>
                  {session.premiumAdjustment < 1
                    ? `${Math.abs((1 - session.premiumAdjustment) * 100).toFixed(0)}% premium discount`
                    : `${Math.abs((1 - session.premiumAdjustment) * 100).toFixed(0)}% premium surcharge`}
                </strong>.
              </p>
            </div>

            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="text-center">
                <p className="text-caption text-muted-foreground">Risk Band</p>
                <p className="text-h1 font-bold" style={{ color: bandColor }}>
                  {session.riskBand}
                </p>
              </div>
              <div className="text-center">
                <p className="text-caption text-muted-foreground">Adj. Factor</p>
                <p
                  className="text-h2 font-bold"
                  style={{
                    color: session.premiumAdjustment < 1 ? "var(--ds-emerald)" : "var(--ds-coral)",
                  }}
                >
                  ×{session.premiumAdjustment.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </GlowCard>
      </motion.div>
    </div>
  );
}

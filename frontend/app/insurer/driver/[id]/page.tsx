"use client";

import { use } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, AlertTriangle, Clock, Shield, FileText } from "lucide-react";
import { AuthGuard } from "@/components/shared/AuthGuard";
import { GlowCard } from "@/components/shared/GlowCard";
import { SpotlightCard } from "@/components/shared/SpotlightCard";
import { DrowsinessChart } from "@/components/charts/DrowsinessChart";
import { useFleetDriver, useClaims } from "@/hooks/queries/insurer";
import type { RiskBand } from "@/types/insurer";

const BAND_COLORS: Record<RiskBand, string> = {
  A: "var(--ds-emerald)", B: "oklch(0.82 0.14 162)",
  C: "var(--ds-alert-1)", D: "var(--ds-coral)", F: "var(--ds-alert-3)",
};

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

function DriverDetail({ id }: { id: string }) {
  const { data: driver, isLoading } = useFleetDriver(id);
  const { data: allClaims = [] }    = useClaims();
  const driverClaims = allClaims.filter((c) => c.driverId === id);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 text-center text-muted-foreground text-body">
        Loading driver…
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <p className="text-h2 text-muted-foreground mb-4">Driver not found</p>
        <Link href="/insurer" className="text-primary hover:underline">← Back to fleet</Link>
      </div>
    );
  }

  const bandColor   = BAND_COLORS[driver.riskBand];
  const premDelta   = (driver.premiumAdjustment - 1) * 100;
  const trendData   = driver.scoreHistory.map((score, i) => ({ label: `S${i + 1}`, score }));

  const TrendIcon = driver.trend === "improving"
    ? <TrendingDown size={14} style={{ color: "var(--ds-emerald)" }} />
    : driver.trend === "declining"
    ? <TrendingUp size={14} style={{ color: "var(--ds-coral)" }} />
    : <Minus size={14} className="text-muted-foreground" />;

  const CLAIM_STATUS_COLOR: Record<string, string> = {
    open:          "var(--ds-alert-1)",
    investigating: "var(--ds-coral)",
    resolved:      "var(--ds-emerald)",
    denied:        "var(--muted-foreground)",
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      {/* Back */}
      <motion.div {...fadeUp}>
        <Link href="/insurer" className="flex items-center gap-2 text-caption text-muted-foreground hover:text-foreground transition-colors mb-8 w-fit">
          <ArrowLeft size={14} /> Back to fleet
        </Link>
      </motion.div>

      {/* Header */}
      <motion.div {...fadeUp} transition={{ delay: 0.05 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-h1 font-bold flex-shrink-0"
            style={{ background: `${bandColor}22`, color: bandColor }}>
            {driver.riskBand}
          </div>
          <div>
            <h1 className="text-h1 mb-1">{driver.name}</h1>
            <div className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
              <span>{driver.licenseNo}</span>
              <span>·</span>
              <span>{driver.vehicle}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Trend chip */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-caption font-medium border border-border">
            {TrendIcon}
            <span className="capitalize">{driver.trend}</span>
          </div>
          {/* Premium */}
          <div className="px-4 py-2 rounded-xl text-center"
            style={{ background: premDelta <= 0 ? "var(--ds-emerald-glow)" : "var(--ds-coral-glow)" }}>
            <p className="text-metric font-bold"
              style={{ color: premDelta <= 0 ? "var(--ds-emerald)" : "var(--ds-coral)" }}>
              {premDelta <= 0 ? "" : "+"}{premDelta.toFixed(0)}%
            </p>
            <p className="text-caption text-muted-foreground">premium adj.</p>
          </div>
        </div>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Clock,         label: "Hours monitored", value: driver.totalHoursMonitored, suffix: " hrs", color: "emerald" },
          { icon: Shield,        label: "Total sessions",  value: driver.totalSessions,        suffix: "",     color: "emerald" },
          { icon: TrendingUp,    label: "Avg score",       value: driver.avgScore * 100,       suffix: "%",    color: driver.avgScore > 0.5 ? "coral" : "emerald" },
          { icon: AlertTriangle, label: "L3 this week",    value: driver.l3AlertsThisWeek,     suffix: "",     color: driver.l3AlertsThisWeek > 0 ? "coral" : "emerald" },
        ].map(({ icon: Icon, label, value, suffix, color }, i) => (
          <motion.div key={label} {...fadeUp} transition={{ delay: 0.08 + i * 0.06 }}>
            <GlowCard glowColor={color as "emerald" | "coral"} className="p-5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                style={{ background: color === "coral" ? "var(--ds-coral-glow)" : "var(--ds-emerald-glow)" }}>
                <Icon size={16} style={{ color: color === "coral" ? "var(--ds-coral)" : "var(--ds-emerald)" }} />
              </div>
              <p className="text-metric mb-1 font-mono"
                style={{ color: color === "coral" ? "var(--ds-coral)" : "var(--ds-emerald)" }}>
                {typeof value === "number" ? value.toFixed(value % 1 === 0 ? 0 : 1) : value}{suffix}
              </p>
              <p className="text-caption text-muted-foreground">{label}</p>
            </GlowCard>
          </motion.div>
        ))}
      </div>

      {/* Score trend chart */}
      <motion.div {...fadeUp} transition={{ delay: 0.25 }} className="mb-8">
        <SpotlightCard className="p-5">
          <h3 className="text-h3 mb-1">Drowsiness Score — Last 7 Sessions</h3>
          <p className="text-caption text-muted-foreground mb-4">Avg composite score per session</p>
          <DrowsinessChart data={trendData} height={200} />
        </SpotlightCard>
      </motion.div>

      {/* Mini score bar */}
      <motion.div {...fadeUp} transition={{ delay: 0.3 }} className="mb-8">
        <SpotlightCard className="p-5">
          <h3 className="text-h3 mb-4">Risk Profile Breakdown</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { label: "Peak score this month", value: driver.peakScore, color: driver.peakScore > 0.5 ? "var(--ds-coral)" : "var(--ds-emerald)" },
              { label: "L3 alerts this month",  value: driver.l3AlertsThisMonth / 20, display: driver.l3AlertsThisMonth.toString(), color: "var(--ds-alert-3)" },
              { label: "Monitoring coverage",   value: Math.min(1, driver.totalHoursMonitored / 100), display: `${driver.totalHoursMonitored.toFixed(0)}h`, color: "var(--ds-emerald)" },
            ].map(({ label, value, color, display }) => (
              <div key={label}>
                <div className="flex justify-between text-caption mb-1.5">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono font-semibold" style={{ color }}>
                    {display ?? `${(value * 100).toFixed(0)}%`}
                  </span>
                </div>
                <div className="h-2 rounded-full" style={{ background: "var(--ds-base-border)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, value * 100)}%`, background: color }} />
                </div>
              </div>
            ))}
          </div>
        </SpotlightCard>
      </motion.div>

      {/* Claims */}
      {driverClaims.length > 0 && (
        <motion.div {...fadeUp} transition={{ delay: 0.35 }}>
          <SpotlightCard className="overflow-hidden">
            <div className="flex items-center gap-2 p-5 border-b border-border">
              <FileText size={16} className="text-muted-foreground" />
              <h3 className="text-h3">Claims History</h3>
              <span className="ml-auto text-caption text-muted-foreground">{driverClaims.length} claim{driverClaims.length > 1 ? "s" : ""}</span>
            </div>
            <div className="divide-y divide-border">
              {driverClaims.map((c) => (
                <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-caption font-semibold">{c.id}</p>
                    <p className="text-caption text-muted-foreground capitalize">{c.type.replace("-", " ")} · {new Date(c.incidentDate).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-caption font-mono">NPR {c.amountNPR.toLocaleString()}</span>
                    <span className="text-caption font-semibold px-2 py-0.5 rounded capitalize"
                      style={{ background: `${CLAIM_STATUS_COLOR[c.status]}22`, color: CLAIM_STATUS_COLOR[c.status] }}>
                      {c.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </SpotlightCard>
        </motion.div>
      )}
    </div>
  );
}

export default function InsurerDriverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AuthGuard roles={["insurer", "admin"]}>
      <DriverDetail id={id} />
    </AuthGuard>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Users, TrendingUp, AlertTriangle, DollarSign,
  ChevronUp, ChevronDown, ChevronsUpDown, ArrowRight,
  TrendingDown, Minus,
} from "lucide-react";
import { AuthGuard } from "@/components/shared/AuthGuard";
import { GlowCard } from "@/components/shared/GlowCard";
import { SpotlightCard } from "@/components/shared/SpotlightCard";
import { AnimatedCounter } from "@/components/shared/AnimatedCounter";
import { RiskDistributionChart } from "@/components/charts/RiskDistributionChart";
import { useFleetSummary, useFleetDrivers } from "@/hooks/queries/insurer";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { FleetDriver, RiskBand } from "@/types/insurer";

/* ── Constants ─────────────────────────────────────────────── */
const BAND_COLORS: Record<RiskBand, string> = {
  A: "var(--ds-emerald)", B: "oklch(0.82 0.14 162)",
  C: "var(--ds-alert-1)", D: "var(--ds-coral)", F: "var(--ds-alert-3)",
};

const BAND_ORDER: Record<RiskBand, number> = { A: 0, B: 1, C: 2, D: 3, F: 4 };

type SortKey = "name" | "band" | "avgScore" | "l3" | "premium" | "trend";
type SortDir = "asc" | "desc";

function sortDrivers(drivers: FleetDriver[], key: SortKey, dir: SortDir) {
  const TREND_ORDER = { improving: 0, stable: 1, declining: 2 };
  return [...drivers].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "name":     cmp = a.name.localeCompare(b.name); break;
      case "band":     cmp = BAND_ORDER[a.riskBand] - BAND_ORDER[b.riskBand]; break;
      case "avgScore": cmp = a.avgScore - b.avgScore; break;
      case "l3":       cmp = a.l3AlertsThisWeek - b.l3AlertsThisWeek; break;
      case "premium":  cmp = a.premiumAdjustment - b.premiumAdjustment; break;
      case "trend":    cmp = TREND_ORDER[a.trend] - TREND_ORDER[b.trend]; break;
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

function TrendIcon({ trend }: { trend: FleetDriver["trend"] }) {
  if (trend === "improving") return <TrendingDown size={13} style={{ color: "var(--ds-emerald)" }} />;
  if (trend === "declining") return <TrendingUp   size={13} style={{ color: "var(--ds-coral)" }} />;
  return <Minus size={13} className="text-muted-foreground" />;
}

function SortHead({
  label, k, cur, dir, onSort,
}: { label: string; k: SortKey; cur: SortKey; dir: SortDir; onSort: (k: SortKey) => void }) {
  const active = cur === k;
  const Icon = active ? (dir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <TableHead onClick={() => onSort(k)} className="cursor-pointer select-none whitespace-nowrap"
      style={{ color: active ? "var(--ds-emerald)" : undefined }}>
      <span className="flex items-center gap-1">{label} <Icon size={12} className={active ? "opacity-100" : "opacity-30"} /></span>
    </TableHead>
  );
}

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

/* ── Fleet Dashboard content ────────────────────────────────── */
function FleetDashboard() {
  const { data: drivers = [] } = useFleetDrivers();
  const { data: summary }      = useFleetSummary();
  const [bandFilter, setBandFilter] = useState<RiskBand | "ALL">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("band");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(k: SortKey) {
    if (k === sortKey) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  }

  const filtered = useMemo(() => {
    const base = bandFilter === "ALL" ? drivers : drivers.filter((d) => d.riskBand === bandFilter);
    return sortDrivers(base, sortKey, sortDir);
  }, [drivers, bandFilter, sortKey, sortDir]);

  const distribution = useMemo(
    () => summary ? Object.fromEntries(Object.entries(summary.bandDistribution).filter(([, v]) => v > 0)) : {},
    [summary]
  );

  if (!summary) return null;

  const statCards = [
    { icon: Users, label: "Total drivers", value: summary.totalDrivers, suffix: "", color: "emerald", decimals: 0 },
    { icon: TrendingUp, label: "Active this week", value: summary.activeThisWeek, suffix: "", color: "emerald", decimals: 0 },
    { icon: AlertTriangle, label: "L3 alerts this week", value: summary.l3AlertsThisWeek, suffix: "", color: "coral", decimals: 0 },
    { icon: DollarSign, label: "Avg premium adj.", value: (summary.avgPremiumAdjustment - 1) * 100, suffix: "%", color: summary.avgPremiumAdjustment < 1 ? "emerald" : "coral", decimals: 1 },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <motion.div {...fadeUp} className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
        <div>
          <p className="text-caption text-muted-foreground mb-1">{summary.companyName}</p>
          <h1 className="text-h1">Fleet Risk Dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/insurer/claims"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-caption font-semibold border border-border hover:bg-muted/30 transition-colors">
            Claims <ArrowRight size={13} />
          </Link>
          <span
            className="px-3 py-1.5 rounded-xl text-caption font-bold"
            style={{ background: `${BAND_COLORS[summary.fleetRiskBand]}22`, color: BAND_COLORS[summary.fleetRiskBand] }}
          >
            Fleet Band {summary.fleetRiskBand}
          </span>
        </div>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(({ icon: Icon, label, value, suffix, color, decimals }, i) => (
          <motion.div key={label} {...fadeUp} transition={{ delay: i * 0.07 }}>
            <GlowCard glowColor={color as "emerald" | "coral"} className="p-5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                style={{ background: color === "coral" ? "var(--ds-coral-glow)" : "var(--ds-emerald-glow)" }}>
                <Icon size={16} style={{ color: color === "coral" ? "var(--ds-coral)" : "var(--ds-emerald)" }} />
              </div>
              <p className="text-metric mb-1" style={{ color: color === "coral" ? "var(--ds-coral)" : "var(--ds-emerald)" }}>
                {label === "Avg premium adj." && value > 0 ? "+" : ""}
                <AnimatedCounter value={Math.abs(value)} suffix={suffix} decimals={decimals} />
              </p>
              <p className="text-caption text-muted-foreground">{label}</p>
            </GlowCard>
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <motion.div {...fadeUp} transition={{ delay: 0.2 }}>
          <SpotlightCard className="p-5 h-full">
            <h3 className="text-h3 mb-1">Band Distribution</h3>
            <p className="text-caption text-muted-foreground mb-4">All {summary.totalDrivers} fleet drivers</p>
            <RiskDistributionChart distribution={distribution} height={180} />
          </SpotlightCard>
        </motion.div>

        {/* Top risk drivers */}
        <motion.div {...fadeUp} transition={{ delay: 0.25 }} className="lg:col-span-2">
          <SpotlightCard className="p-5 h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-h3">Highest Risk Drivers</h3>
              <span className="text-caption text-muted-foreground">This week</span>
            </div>
            <div className="space-y-2">
              {[...drivers].sort((a, b) => b.l3AlertsThisWeek - a.l3AlertsThisWeek).slice(0, 5).map((d) => (
                <Link key={d.id} href={`/insurer/driver/${d.id}`}
                  className="flex items-center justify-between px-4 py-2.5 rounded-xl hover:bg-muted/30 transition-colors group">
                  <div className="flex items-center gap-3">
                    <span className="text-caption font-bold px-2 py-0.5 rounded-lg"
                      style={{ background: `${BAND_COLORS[d.riskBand]}22`, color: BAND_COLORS[d.riskBand] }}>
                      {d.riskBand}
                    </span>
                    <div>
                      <p className="text-caption font-medium">{d.name}</p>
                      <p className="text-caption text-muted-foreground" style={{ fontSize: 11 }}>{d.vehicle.split("·")[0].trim()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-caption font-semibold" style={{ color: d.l3AlertsThisWeek > 0 ? "var(--ds-alert-3)" : "var(--muted-foreground)" }}>
                      {d.l3AlertsThisWeek} L3
                    </span>
                    <TrendIcon trend={d.trend} />
                    <ArrowRight size={13} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          </SpotlightCard>
        </motion.div>
      </div>

      {/* Driver table */}
      <motion.div {...fadeUp} transition={{ delay: 0.3 }}>
        <SpotlightCard className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-border">
            <h3 className="text-h3">Driver Risk Table</h3>
            <div className="flex items-center gap-2 flex-wrap">
              {(["ALL", "A", "B", "C", "D", "F"] as (RiskBand | "ALL")[]).map((band) => (
                <button key={band} type="button" onClick={() => setBandFilter(band)}
                  className="px-3 py-1 rounded-lg text-caption font-medium transition-all cursor-pointer"
                  style={{
                    background: bandFilter === band ? `${BAND_COLORS[band as RiskBand] ?? "var(--ds-emerald)"}33` : "var(--ds-base-raised)",
                    color: bandFilter === band ? BAND_COLORS[band as RiskBand] ?? "var(--ds-emerald)" : "var(--muted-foreground)",
                    border: `1px solid ${bandFilter === band ? BAND_COLORS[band as RiskBand] ?? "var(--ds-emerald)" : "transparent"}`,
                  }}>
                  {band}
                </button>
              ))}
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead label="Driver"   k="name"     cur={sortKey} dir={sortDir} onSort={handleSort} />
                <TableHead className="hidden lg:table-cell">Vehicle</TableHead>
                <SortHead label="Band"     k="band"     cur={sortKey} dir={sortDir} onSort={handleSort} />
                <SortHead label="Avg Score" k="avgScore" cur={sortKey} dir={sortDir} onSort={handleSort} />
                <TableHead className="hidden sm:table-cell">Sessions</TableHead>
                <SortHead label="L3 / Week" k="l3"     cur={sortKey} dir={sortDir} onSort={handleSort} />
                <SortHead label="Premium"  k="premium"  cur={sortKey} dir={sortDir} onSort={handleSort} />
                <SortHead label="Trend"    k="trend"    cur={sortKey} dir={sortDir} onSort={handleSort} />
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((d) => {
                const premDelta = (d.premiumAdjustment - 1) * 100;
                return (
                  <TableRow key={d.id} className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => { window.location.href = `/insurer/driver/${d.id}`; }}>
                    <TableCell>
                      <p className="text-caption font-medium whitespace-nowrap">{d.name}</p>
                      <p className="text-caption text-muted-foreground" style={{ fontSize: 10 }}>{d.licenseNo}</p>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-caption text-muted-foreground whitespace-nowrap">{d.vehicle}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-caption font-bold px-2 py-0.5 rounded"
                        style={{ background: `${BAND_COLORS[d.riskBand]}22`, color: BAND_COLORS[d.riskBand] }}>
                        {d.riskBand}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-caption"
                        style={{ color: d.avgScore > 0.5 ? "var(--ds-coral)" : "var(--ds-emerald)" }}>
                        {(d.avgScore * 100).toFixed(0)}%
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-caption text-muted-foreground">{d.totalSessions}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-caption font-semibold"
                        style={{ color: d.l3AlertsThisWeek > 0 ? "var(--ds-alert-3)" : "var(--muted-foreground)" }}>
                        {d.l3AlertsThisWeek}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-caption font-bold whitespace-nowrap"
                        style={{ color: premDelta <= 0 ? "var(--ds-emerald)" : "var(--ds-coral)" }}>
                        {premDelta <= 0 ? "" : "+"}{premDelta.toFixed(0)}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <TrendIcon trend={d.trend} />
                    </TableCell>
                    <TableCell>
                      <ArrowRight size={13} className="text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </SpotlightCard>
      </motion.div>
    </div>
  );
}

export default function InsurerPage() {
  return (
    <AuthGuard roles={["insurer", "admin"]}>
      <FleetDashboard />
    </AuthGuard>
  );
}

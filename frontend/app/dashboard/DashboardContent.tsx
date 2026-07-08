"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, TrendingUp, AlertTriangle, Clock, Shield, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { GlowCard } from "@/components/shared/GlowCard";
import { AnimatedCounter } from "@/components/shared/AnimatedCounter";
import { SpotlightCard } from "@/components/shared/SpotlightCard";
import { DrowsinessChart } from "@/components/charts/DrowsinessChart";
import { AlertFrequencyChart } from "@/components/charts/AlertFrequencyChart";
import { RiskDistributionChart } from "@/components/charts/RiskDistributionChart";
import { RiskHeatmap } from "@/components/charts/RiskHeatmap";
import { useSessions, useSessionHeatmap, useAlertFrequency } from "@/hooks/queries/sessions";
import type { Session } from "@/types/detection";

function mockTrend(sessions: Session[]) {
  return sessions.slice().reverse().map((s, i) => ({ label: `S${i + 1}`, score: s.avgScore }));
}
function mockAlertFreq() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return days.map((day) => ({
    day,
    l1: Math.floor(Math.random() * 30 + 10),
    l2: Math.floor(Math.random() * 15 + 2),
    l3: Math.floor(Math.random() * 5),
  }));
}
function mockHeatmap() {
  return Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: 24 }, (_, h) => {
      const nightRisk = h < 5 || h >= 22 ? 0.6 : 0;
      const afternoonDip = h >= 14 && h <= 16 ? 0.3 : 0;
      return Math.min(1, nightRisk + afternoonDip + Math.random() * 0.15);
    })
  );
}
function riskDistribution(sessions: Session[]) {
  return sessions.reduce((acc, s) => {
    acc[s.riskBand] = (acc[s.riskBand] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

const BAND_COLORS: Record<string, string> = {
  A: "var(--ds-emerald)", B: "oklch(0.82 0.14 162)",
  C: "var(--ds-alert-1)", D: "var(--ds-coral)", F: "var(--ds-alert-3)",
};

type SortKey = "date" | "duration" | "avgScore" | "band";
type SortDir = "asc" | "desc";
const BAND_ORDER: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, F: 4 };

function sortSessions(sessions: Session[], key: SortKey, dir: SortDir) {
  return [...sessions].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "date":     cmp = new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(); break;
      case "duration": cmp = a.durationS - b.durationS; break;
      case "avgScore": cmp = a.avgScore - b.avgScore; break;
      case "band":     cmp = (BAND_ORDER[a.riskBand] ?? 0) - (BAND_ORDER[b.riskBand] ?? 0); break;
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown size={12} className="opacity-30" />;
  return dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
}

function RecentSessionsTable({ sessions }: { sessions: Session[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const rows = useMemo(() => sortSessions(sessions, sortKey, sortDir).slice(0, 8), [sessions, sortKey, sortDir]);

  function th(label: string, key: SortKey) {
    const active = sortKey === key;
    return (
      <TableHead
        onClick={() => handleSort(key)}
        className="cursor-pointer select-none whitespace-nowrap"
        style={{ color: active ? "var(--ds-emerald)" : undefined }}
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      >
        <span className="flex items-center gap-1">{label} <SortIcon active={active} dir={sortDir} /></span>
      </TableHead>
    );
  }

  return (
    <SpotlightCard className="overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-border">
        <h3 className="text-h3">Recent Sessions</h3>
        <Link href="/sessions" className="flex items-center gap-1 text-caption transition-colors" style={{ color: "var(--ds-emerald)" }}>
          View all <ArrowRight size={12} />
        </Link>
      </div>
      <Table aria-label="Recent driving sessions">
        <TableHeader>
          <TableRow>
            {th("Date", "date")}
            {th("Duration", "duration")}
            {th("Avg Score", "avgScore")}
            <TableHead>Peak</TableHead>
            {th("Band", "band")}
            <TableHead className="text-center">L2</TableHead>
            <TableHead className="text-center">L3</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s) => {
            const date = new Date(s.startedAt);
            const bandColor = BAND_COLORS[s.riskBand] ?? "var(--ds-emerald)";
            return (
              <TableRow
                key={s.id}
                className="cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => { window.location.href = `/sessions/${s.id}`; }}
                aria-label={`Session on ${date.toLocaleDateString()}, risk band ${s.riskBand}`}
              >
                <TableCell>
                  <p className="text-caption font-medium whitespace-nowrap">
                    {date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </p>
                  <p className="text-caption text-muted-foreground" style={{ fontSize: 11 }}>
                    {date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </TableCell>
                <TableCell><span className="text-caption text-muted-foreground whitespace-nowrap">{Math.floor(s.durationS / 60)} min</span></TableCell>
                <TableCell><span className="font-mono text-caption" style={{ color: s.avgScore > 0.5 ? "var(--ds-coral)" : "var(--ds-emerald)" }}>{(s.avgScore * 100).toFixed(0)}%</span></TableCell>
                <TableCell><span className="font-mono text-caption" style={{ color: s.peakScore > 0.5 ? "var(--ds-coral)" : "var(--ds-emerald)" }}>{(s.peakScore * 100).toFixed(0)}%</span></TableCell>
                <TableCell><span className="text-caption font-bold px-2 py-0.5 rounded" style={{ background: `${bandColor}22`, color: bandColor }}>{s.riskBand}</span></TableCell>
                <TableCell className="text-center"><span className="text-caption" style={{ color: s.alertCount[2] > 0 ? "var(--ds-coral)" : "var(--muted-foreground)" }}>{s.alertCount[2]}</span></TableCell>
                <TableCell className="text-center"><span className="text-caption font-semibold" style={{ color: s.alertCount[3] > 0 ? "var(--ds-alert-3)" : "var(--muted-foreground)" }}>{s.alertCount[3]}</span></TableCell>
                <TableCell><ArrowRight size={13} className="text-muted-foreground" aria-hidden /></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </SpotlightCard>
  );
}

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

export function DashboardContent() {
  const { data: sessions = [] } = useSessions();
  const { data: heatmapData = mockHeatmap() }   = useSessionHeatmap();
  const { data: alertFreqData = mockAlertFreq() } = useAlertFrequency();

  const totalHours  = useMemo(() => sessions.reduce((a, s) => a + s.durationS / 3600, 0), [sessions]);
  const avgScore    = useMemo(() => (sessions.length ? sessions.reduce((a, s) => a + s.avgScore, 0) / sessions.length : 0), [sessions]);
  const l3Total     = useMemo(() => sessions.reduce((a, s) => a + (s.alertCount[3] ?? 0), 0), [sessions]);
  const currentBand = sessions[0]?.riskBand ?? "B";

  const trendData    = useMemo(() => mockTrend(sessions), [sessions]);
  const distribution = useMemo(() => riskDistribution(sessions), [sessions]);

  const STATS = [
    { icon: Clock,         label: "Total monitoring",  value: totalHours,    suffix: " hrs", decimals: 1, color: "emerald" },
    { icon: TrendingUp,    label: "Avg drowsiness",    value: avgScore * 100, suffix: "%",  decimals: 0, color: "emerald" },
    { icon: AlertTriangle, label: "Critical alerts",   value: l3Total,       suffix: "",    decimals: 0, color: "coral"   },
    { icon: Shield,        label: "Current risk band", value: undefined,     band: currentBand },
  ];

  return (
    <main className="max-w-7xl mx-auto px-6 py-10">
      <motion.div {...fadeUp} className="mb-10">
        <h1 className="text-h1 mb-2">Driver Analytics</h1>
        <p className="text-body text-muted-foreground">Your drowsiness history, risk profile, and session trends.</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10" role="list" aria-label="Summary statistics">
        {STATS.map(({ icon: Icon, label, value, suffix, decimals, color, band }, i) => (
          <motion.div key={label} {...fadeUp} transition={{ delay: i * 0.08, duration: 0.5 }} role="listitem">
            <GlowCard glowColor={color === "coral" ? "coral" : "emerald"} className="p-5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                style={{ background: color === "coral" ? "var(--ds-coral-glow)" : "var(--ds-emerald-glow)" }}>
                <Icon size={16} style={{ color: color === "coral" ? "var(--ds-coral)" : "var(--ds-emerald)" }} aria-hidden />
              </div>
              {band ? (
                <p className="text-h1 font-bold mb-1"
                  style={{ color: { A: "var(--ds-emerald)", B: "oklch(0.82 0.14 162)", C: "var(--ds-alert-1)", D: "var(--ds-coral)", F: "var(--ds-alert-3)" }[band] }}>
                  {band}
                </p>
              ) : (
                <p className="text-metric mb-1" style={{ color: color === "coral" ? "var(--ds-coral)" : "var(--ds-emerald)" }}>
                  <AnimatedCounter value={value!} suffix={suffix!} decimals={decimals!} />
                </p>
              )}
              <p className="text-caption text-muted-foreground">{label}</p>
            </GlowCard>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <motion.div {...fadeUp} transition={{ delay: 0.2 }}>
          <SpotlightCard className="p-5">
            <h2 className="text-h3 mb-4">Drowsiness Trend — Sessions</h2>
            <DrowsinessChart data={trendData} height={180} />
          </SpotlightCard>
        </motion.div>
        <motion.div {...fadeUp} transition={{ delay: 0.25 }}>
          <SpotlightCard className="p-5">
            <h2 className="text-h3 mb-1">Alert Frequency — This Week</h2>
            <p className="text-caption text-muted-foreground mb-4">Stacked by level</p>
            <AlertFrequencyChart data={alertFreqData} height={180} />
          </SpotlightCard>
        </motion.div>
        <motion.div {...fadeUp} transition={{ delay: 0.3 }}>
          <SpotlightCard className="p-5">
            <h2 className="text-h3 mb-1">Risk Band Distribution</h2>
            <p className="text-caption text-muted-foreground mb-4">All sessions this month</p>
            <RiskDistributionChart distribution={distribution} height={200} />
          </SpotlightCard>
        </motion.div>
        <motion.div {...fadeUp} transition={{ delay: 0.35 }}>
          <SpotlightCard className="p-5">
            <h2 className="text-h3 mb-1">Peak Risk Hours</h2>
            <p className="text-caption text-muted-foreground mb-4">Hour × day-of-week · avg score</p>
            <RiskHeatmap data={heatmapData} />
          </SpotlightCard>
        </motion.div>
      </div>

      <motion.div {...fadeUp} transition={{ delay: 0.4 }}>
        <RecentSessionsTable sessions={sessions} />
      </motion.div>
    </main>
  );
}

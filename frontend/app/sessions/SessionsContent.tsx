"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, ArrowRight, Filter, Play, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import Lottie from "lottie-react";
import emptyAnimation from "@/public/lottie/empty.json";
import { useSessions } from "@/hooks/queries/sessions";
import { ALERT_META } from "@/types/detection";
import type { Session } from "@/types/detection";
import { GlowCard } from "@/components/shared/GlowCard";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type BandFilter = "ALL" | "A" | "B" | "C" | "D" | "F";
type SortKey    = "date" | "duration" | "avgScore" | "band" | "premium";
type SortDir    = "asc" | "desc";

const BAND_COLORS: Record<string, string> = {
  A: "var(--ds-emerald)", B: "oklch(0.82 0.14 162)",
  C: "var(--ds-alert-1)", D: "var(--ds-coral)", F: "var(--ds-alert-3)",
};
const BAND_ORDER: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, F: 4 };

function sortSessions(sessions: Session[], key: SortKey, dir: SortDir) {
  return [...sessions].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "date":     cmp = new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(); break;
      case "duration": cmp = a.durationS - b.durationS; break;
      case "avgScore": cmp = a.avgScore - b.avgScore; break;
      case "band":     cmp = (BAND_ORDER[a.riskBand] ?? 0) - (BAND_ORDER[b.riskBand] ?? 0); break;
      case "premium":  cmp = a.premiumAdjustment - b.premiumAdjustment; break;
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

function SortableHead({ label, sortKey, current, dir, onSort }: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir; onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  const Icon = active ? (dir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <TableHead
      onClick={() => onSort(sortKey)}
      className="cursor-pointer select-none whitespace-nowrap"
      style={{ color: active ? "var(--ds-emerald)" : undefined }}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <span className="flex items-center gap-1">{label}<Icon size={13} className={active ? "opacity-100" : "opacity-30"} aria-hidden /></span>
    </TableHead>
  );
}

function SessionCard({ session }: { session: Session }) {
  const date      = new Date(session.startedAt);
  const durationMin = Math.floor(session.durationS / 60);
  const bandColor = BAND_COLORS[session.riskBand] ?? "var(--ds-emerald)";

  return (
    <Link href={`/sessions/${session.id}`} aria-label={`Session on ${date.toLocaleDateString()}, band ${session.riskBand}`}>
      <GlowCard glowColor={session.riskBand === "A" || session.riskBand === "B" ? "emerald" : "coral"}
        className="p-5 flex items-center gap-4 cursor-pointer hover:shadow-lg transition-shadow">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-h2 font-bold flex-shrink-0"
          style={{ background: `${bandColor}22`, color: bandColor }}>
          {session.riskBand}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-caption font-semibold">
              {date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            </p>
            <span className="text-caption text-muted-foreground">
              {date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <div className="flex flex-wrap gap-3 text-caption text-muted-foreground">
            <span className="flex items-center gap-1"><Clock size={11} aria-hidden /> {durationMin} min</span>
            <span>Avg: <strong className="text-foreground">{(session.avgScore * 100).toFixed(0)}%</strong></span>
            <span>Peak: <strong style={{ color: session.peakScore > 0.5 ? "var(--ds-coral)" : "var(--ds-emerald)" }}>{(session.peakScore * 100).toFixed(0)}%</strong></span>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          {([1, 2, 3] as const).filter((l) => session.alertCount[l] > 0).map((lvl) => (
            <span key={lvl} className="text-caption px-2 py-0.5 rounded font-semibold"
              style={{ background: `${ALERT_META[lvl].color}22`, color: ALERT_META[lvl].color }}>
              L{lvl}: {session.alertCount[lvl]}
            </span>
          ))}
        </div>
        <div className="flex flex-col items-end flex-shrink-0">
          <span className="text-caption font-bold"
            style={{ color: session.premiumAdjustment < 1 ? "var(--ds-emerald)" : "var(--ds-coral)" }}>
            {session.premiumAdjustment < 1 ? "-" : "+"}{Math.abs((1 - session.premiumAdjustment) * 100).toFixed(0)}%
          </span>
          <span className="text-caption text-muted-foreground" style={{ fontSize: 10 }}>premium adj.</span>
          <ArrowRight size={12} className="text-muted-foreground mt-1" aria-hidden />
        </div>
      </GlowCard>
    </Link>
  );
}

export function SessionsContent() {
  const { data: sessions = [], isLoading } = useSessions();
  const [bandFilter, setBandFilter] = useState<BandFilter>("ALL");
  const [sortKey, setSortKey]       = useState<SortKey>("date");
  const [sortDir, setSortDir]       = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const filtered = useMemo(() => {
    const base = bandFilter === "ALL" ? sessions : sessions.filter((s) => s.riskBand === bandFilter);
    return sortSessions(base, sortKey, sortDir);
  }, [sessions, bandFilter, sortKey, sortDir]);

  const emptyState = (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Lottie animationData={emptyAnimation} loop style={{ width: 120, height: 120 }} aria-hidden />
      <p className="text-h3 text-muted-foreground">No sessions</p>
      <p className="text-caption text-muted-foreground">Start a monitoring session to see your history</p>
      <Link href="/monitor" className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl text-caption font-semibold text-white"
        style={{ background: "var(--ds-emerald)" }}>
        <Play size={13} aria-hidden /> Start Session
      </Link>
    </div>
  );

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-h1 mb-1">Session History</h1>
          <p className="text-body text-muted-foreground">{isLoading ? "Loading…" : `${sessions.length} sessions recorded`}</p>
        </div>
        <Link href="/monitor" className="flex items-center gap-2 px-4 py-2 rounded-xl text-caption font-semibold text-white flex-shrink-0"
          style={{ background: "var(--ds-emerald)" }}>
          <Play size={13} aria-hidden /> New Session
        </Link>
      </div>

      <div className="flex items-center gap-2 mb-6 flex-wrap" role="group" aria-label="Filter by risk band">
        <Filter size={14} className="text-muted-foreground" aria-hidden />
        {(["ALL", "A", "B", "C", "D", "F"] as BandFilter[]).map((band) => (
          <button key={band} type="button" onClick={() => setBandFilter(band)}
            className="px-3 py-1 rounded-lg text-caption font-medium transition-all cursor-pointer"
            aria-pressed={bandFilter === band}
            style={{
              background: bandFilter === band ? `${BAND_COLORS[band] ?? "var(--ds-emerald)"}33` : "var(--ds-base-raised)",
              color: bandFilter === band ? BAND_COLORS[band] ?? "var(--ds-emerald)" : "var(--muted-foreground)",
              border: `1px solid ${bandFilter === band ? BAND_COLORS[band] ?? "var(--ds-emerald)" : "transparent"}`,
            }}>
            {band}
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        {filtered.length === 0 ? emptyState : (
          <div className="rounded-xl border border-border overflow-hidden bg-card">
            <Table aria-label="Session history">
              <TableHeader>
                <TableRow>
                  <SortableHead label="Date"     sortKey="date"     current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortableHead label="Duration" sortKey="duration" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortableHead label="Avg Score" sortKey="avgScore" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <TableHead className="whitespace-nowrap">Peak</TableHead>
                  <SortableHead label="Band"    sortKey="band"    current={sortKey} dir={sortDir} onSort={handleSort} />
                  <TableHead className="text-center">L2</TableHead>
                  <TableHead className="text-center">L3</TableHead>
                  <SortableHead label="Premium" sortKey="premium" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence mode="popLayout">
                  {filtered.map((s, i) => {
                    const date = new Date(s.startedAt);
                    const bandColor = BAND_COLORS[s.riskBand] ?? "var(--ds-emerald)";
                    const premiumDelta = (1 - s.premiumAdjustment) * 100;
                    return (
                      <motion.tr key={s.id}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        transition={{ delay: i * 0.03, duration: 0.25 }}
                        className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => { window.location.href = `/sessions/${s.id}`; }}
                        aria-label={`Session ${date.toLocaleDateString()}, band ${s.riskBand}`}
                      >
                        <TableCell>
                          <p className="text-caption font-medium whitespace-nowrap">{date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p>
                          <p className="text-caption text-muted-foreground" style={{ fontSize: 11 }}>{date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>
                        </TableCell>
                        <TableCell><span className="text-caption flex items-center gap-1 whitespace-nowrap"><Clock size={11} className="text-muted-foreground" aria-hidden />{Math.floor(s.durationS / 60)} min</span></TableCell>
                        <TableCell><span className="font-mono text-caption" style={{ color: s.avgScore > 0.5 ? "var(--ds-coral)" : "var(--ds-emerald)" }}>{(s.avgScore * 100).toFixed(0)}%</span></TableCell>
                        <TableCell><span className="font-mono text-caption" style={{ color: s.peakScore > 0.5 ? "var(--ds-coral)" : "var(--ds-emerald)" }}>{(s.peakScore * 100).toFixed(0)}%</span></TableCell>
                        <TableCell><span className="text-caption font-bold px-2.5 py-0.5 rounded-lg" style={{ background: `${bandColor}22`, color: bandColor }}>{s.riskBand}</span></TableCell>
                        <TableCell className="text-center"><span className="text-caption font-semibold" style={{ color: s.alertCount[2] > 0 ? ALERT_META[2].color : "var(--muted-foreground)" }}>{s.alertCount[2]}</span></TableCell>
                        <TableCell className="text-center"><span className="text-caption font-semibold" style={{ color: s.alertCount[3] > 0 ? ALERT_META[3].color : "var(--muted-foreground)" }}>{s.alertCount[3]}</span></TableCell>
                        <TableCell><span className="text-caption font-bold whitespace-nowrap" style={{ color: premiumDelta > 0 ? "var(--ds-emerald)" : "var(--ds-coral)" }}>{premiumDelta > 0 ? "-" : "+"}{Math.abs(premiumDelta).toFixed(0)}%</span></TableCell>
                        <TableCell><ArrowRight size={14} className="text-muted-foreground" aria-hidden /></TableCell>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? emptyState : (
          filtered.map((session, i) => (
            <motion.div key={session.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.4 }}>
              <SessionCard session={session} />
            </motion.div>
          ))
        )}
      </div>
    </main>
  );
}

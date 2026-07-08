"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, FileSearch, Download } from "lucide-react";
import { AuthGuard } from "@/components/shared/AuthGuard";
import { SpotlightCard } from "@/components/shared/SpotlightCard";
import { useClaims, useFleetSummary } from "@/hooks/queries/insurer";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { ClaimStatus, ClaimType } from "@/types/insurer";

const STATUS_COLOR: Record<ClaimStatus, string> = {
  open:          "var(--ds-alert-1)",
  investigating: "var(--ds-coral)",
  resolved:      "var(--ds-emerald)",
  denied:        "var(--muted-foreground)",
};

const TYPE_LABEL: Record<ClaimType, string> = {
  "fatigue-related": "Fatigue-Related",
  collision:         "Collision",
  other:             "Other",
};

const ALERT_COLOR = ["var(--ds-emerald)", "var(--ds-alert-1)", "var(--ds-coral)", "var(--ds-alert-3)"];

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

function ClaimsContent() {
  const { data: claims = [] } = useClaims();
  const { data: summary }     = useFleetSummary();
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | "ALL">("ALL");

  const filtered = useMemo(() =>
    statusFilter === "ALL" ? claims : claims.filter((c) => c.status === statusFilter),
    [claims, statusFilter]
  );

  const totalValue = useMemo(() => claims.reduce((a, c) => a + c.amountNPR, 0), [claims]);
  const openCount  = useMemo(() => claims.filter((c) => c.status === "open" || c.status === "investigating").length, [claims]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      {/* Back */}
      <motion.div {...fadeUp}>
        <Link href="/insurer" className="flex items-center gap-2 text-caption text-muted-foreground hover:text-foreground transition-colors mb-8 w-fit">
          <ArrowLeft size={14} /> Back to fleet
        </Link>
      </motion.div>

      {/* Header */}
      <motion.div {...fadeUp} transition={{ delay: 0.05 }} className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-caption text-muted-foreground mb-1">{summary?.companyName}</p>
          <h1 className="text-h1">Claims Investigation</h1>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-caption font-semibold border border-border hover:bg-muted/30 transition-colors"
          onClick={() => window.print()}
        >
          <Download size={13} /> Export Report
        </button>
      </motion.div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total claims",      value: claims.length,            suffix: "",   color: "var(--ds-emerald)" },
          { label: "Open / Active",     value: openCount,                suffix: "",   color: "var(--ds-coral)" },
          { label: "Total claimed",     value: totalValue / 1000,        suffix: "K NPR", color: "var(--ds-alert-1)" },
        ].map(({ label, value, suffix, color }) => (
          <motion.div key={label} {...fadeUp} transition={{ delay: 0.1 }}>
            <div className="p-5 rounded-2xl border border-border bg-card/60 backdrop-blur text-center">
              <p className="text-metric font-bold font-mono" style={{ color }}>
                {value.toFixed(0)}{suffix}
              </p>
              <p className="text-caption text-muted-foreground mt-1">{label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filter + Table */}
      <motion.div {...fadeUp} transition={{ delay: 0.2 }}>
        <SpotlightCard className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-border">
            <div className="flex items-center gap-2">
              <FileSearch size={16} className="text-muted-foreground" />
              <h3 className="text-h3">Claims Log</h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {(["ALL", "open", "investigating", "resolved", "denied"] as (ClaimStatus | "ALL")[]).map((s) => (
                <button key={s} type="button" onClick={() => setStatusFilter(s)}
                  className="px-3 py-1 rounded-lg text-caption font-medium transition-all cursor-pointer capitalize"
                  style={{
                    background: statusFilter === s ? `${STATUS_COLOR[s as ClaimStatus] ?? "var(--ds-emerald)"}33` : "var(--ds-base-raised)",
                    color: statusFilter === s ? STATUS_COLOR[s as ClaimStatus] ?? "var(--ds-emerald)" : "var(--muted-foreground)",
                    border: `1px solid ${statusFilter === s ? STATUS_COLOR[s as ClaimStatus] ?? "var(--ds-emerald)" : "transparent"}`,
                  }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Claim ID</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden md:table-cell">Alert at Incident</TableHead>
                <TableHead className="hidden lg:table-cell">Evidence</TableHead>
                <TableHead className="text-right">Amount (NPR)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence mode="popLayout">
                {filtered.map((c, i) => (
                  <motion.tr
                    key={c.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="border-b border-border hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => { window.location.href = `/insurer/claims/${c.id}`; }}
                  >
                    <TableCell>
                      <span className="font-mono text-caption">{c.id}</span>
                    </TableCell>
                    <TableCell>
                      <p className="text-caption font-medium whitespace-nowrap">{c.driverName}</p>
                      <p className="text-caption text-muted-foreground" style={{ fontSize: 10 }}>{c.vehicle.split("·")[1]?.trim()}</p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-caption text-muted-foreground whitespace-nowrap">
                        {new Date(c.incidentDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-caption whitespace-nowrap">{TYPE_LABEL[c.type]}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-caption font-semibold"
                        style={{ color: ALERT_COLOR[c.alertLevelAtIncident] }}>
                        Level {c.alertLevelAtIncident}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-caption text-muted-foreground">{c.evidenceFrames} frames</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono text-caption">{c.amountNPR.toLocaleString()}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-caption font-semibold px-2 py-0.5 rounded capitalize whitespace-nowrap"
                        style={{ background: `${STATUS_COLOR[c.status]}22`, color: STATUS_COLOR[c.status] }}>
                        {c.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ArrowRight size={13} className="text-muted-foreground" />
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>

          {filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-caption">
              No claims match the selected filter.
            </div>
          )}
        </SpotlightCard>
      </motion.div>

      {/* Evidence note */}
      <motion.div {...fadeUp} transition={{ delay: 0.35 }}>
        <div className="mt-6 px-5 py-4 rounded-2xl border"
          style={{ background: "var(--ds-emerald-glow)", borderColor: "var(--ds-emerald)44" }}>
          <p className="text-caption" style={{ color: "var(--ds-emerald)" }}>
            <strong>Evidence integrity:</strong> All captured frames are SHA-256 hashed at source.
            Tamper-evident audit chain generated per session — admissible as claims evidence.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default function ClaimsPage() {
  return (
    <AuthGuard roles={["insurer", "admin"]}>
      <ClaimsContent />
    </AuthGuard>
  );
}

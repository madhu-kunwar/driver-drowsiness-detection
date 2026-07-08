"use client";

import { use } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  ArrowLeft, AlertTriangle, FileText, Shield,
  DollarSign, User, Car, Calendar, Hash,
} from "lucide-react";
import { AuthGuard } from "@/components/shared/AuthGuard";
import { GlowCard } from "@/components/shared/GlowCard";
import { SpotlightCard } from "@/components/shared/SpotlightCard";
import { EvidenceViewer } from "@/components/insurer/EvidenceViewer";
import { useClaim, useFleetDriver } from "@/hooks/queries/insurer";
import type { ClaimStatus } from "@/types/insurer";

/* Dynamic import keeps react-pdf off the SSR bundle */
const EvidenceExport = dynamic(
  () => import("@/components/insurer/EvidenceExport").then((m) => ({ default: m.EvidenceExport })),
  {
    ssr: false,
    loading: () => (
      <button
        disabled
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-caption font-semibold border border-border opacity-50"
      >
        Preparing…
      </button>
    ),
  }
);

const STATUS_COLOR: Record<ClaimStatus, string> = {
  open:          "var(--ds-alert-1)",
  investigating: "var(--ds-coral)",
  resolved:      "var(--ds-emerald)",
  denied:        "var(--muted-foreground)",
};

const ALERT_COLOR = [
  "var(--ds-alert-0)",
  "var(--ds-alert-1)",
  "var(--ds-alert-2)",
  "var(--ds-alert-3)",
] as const;

const ALERT_LABEL = ["Alert / Safe", "Mild", "Warning", "CRITICAL"] as const;

const fadeUp = {
  initial:    { opacity: 0, y: 20 },
  animate:    { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

function ClaimDetail({ id }: { id: string }) {
  const { data: claim, isLoading } = useClaim(id);
  const { data: driver }           = useFleetDriver(claim?.driverId ?? "");

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 text-center text-muted-foreground text-body">
        Loading claim…
      </div>
    );
  }

  if (!claim || !driver) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <p className="text-h2 text-muted-foreground mb-4">Claim not found</p>
        <Link href="/insurer/claims" className="text-primary hover:underline">
          ← Back to claims
        </Link>
      </div>
    );
  }

  const alertColor  = ALERT_COLOR[claim.alertLevelAtIncident];
  const statusColor = STATUS_COLOR[claim.status];
  const premDelta   = (driver.premiumAdjustment - 1) * 100;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      {/* Back */}
      <motion.div {...fadeUp}>
        <Link
          href="/insurer/claims"
          className="flex items-center gap-2 text-caption text-muted-foreground hover:text-foreground transition-colors mb-8 w-fit"
        >
          <ArrowLeft size={14} /> Back to claims
        </Link>
      </motion.div>

      {/* Header */}
      <motion.div
        {...fadeUp}
        transition={{ delay: 0.05, duration: 0.45 }}
        className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8"
      >
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-h1 font-mono">{claim.id}</h1>
            <span
              className="text-caption font-semibold px-2.5 py-1 rounded-lg capitalize"
              style={{ background: `${statusColor}22`, color: statusColor }}
            >
              {claim.status}
            </span>
            <span
              className="text-caption px-2.5 py-1 rounded-lg capitalize border border-border"
            >
              {claim.type.replace("-", " ")}
            </span>
          </div>
          <p className="text-caption text-muted-foreground">
            Incident: {new Date(claim.incidentDate).toLocaleDateString("en-US", {
              weekday: "long", year: "numeric", month: "long", day: "numeric",
            })}
          </p>
        </div>
        <EvidenceExport claim={claim} driver={driver} />
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            icon: AlertTriangle,
            label: "Alert at Incident",
            display: `Level ${claim.alertLevelAtIncident}`,
            sub: ALERT_LABEL[claim.alertLevelAtIncident],
            color: alertColor,
            glow: claim.alertLevelAtIncident >= 2 ? "coral" : "emerald",
          },
          {
            icon: Shield,
            label: "Composite Score",
            display: `${(claim.compositeScoreAtIncident * 100).toFixed(1)}%`,
            sub: `Band ${driver.riskBand}`,
            color: claim.compositeScoreAtIncident > 0.5 ? "var(--ds-coral)" : "var(--ds-emerald)",
            glow: claim.compositeScoreAtIncident > 0.5 ? "coral" : "emerald",
          },
          {
            icon: FileText,
            label: "Evidence Frames",
            display: claim.evidenceFrames.toString(),
            sub: "SHA-256 hashed",
            color: "var(--ds-emerald)",
            glow: "emerald",
          },
          {
            icon: DollarSign,
            label: "Claimed Amount",
            display: `${(claim.amountNPR / 1000).toFixed(0)}K`,
            sub: "NPR",
            color: "var(--ds-alert-1)",
            glow: "coral",
          },
        ].map(({ icon: Icon, label, display, sub, color, glow }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.06, duration: 0.45 }}
          >
            <GlowCard glowColor={glow as "emerald" | "coral"} className="p-5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                style={{ background: `${color}20` }}
              >
                <Icon size={16} style={{ color }} />
              </div>
              <p className="text-metric font-bold font-mono mb-0.5" style={{ color }}>
                {display}
              </p>
              <p className="text-caption text-muted-foreground">{label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 opacity-70">{sub}</p>
            </GlowCard>
          </motion.div>
        ))}
      </div>

      {/* Two-column: driver info + incident details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Driver info */}
        <motion.div {...fadeUp} transition={{ delay: 0.22, duration: 0.45 }}>
          <SpotlightCard className="p-5 h-full">
            <div className="flex items-center gap-2 mb-4">
              <User size={15} className="text-muted-foreground" />
              <h3 className="text-h3">Driver Profile</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-caption text-muted-foreground">Name</span>
                <span className="text-caption font-semibold">{driver.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-caption text-muted-foreground">License</span>
                <span className="text-caption font-mono">{driver.licenseNo}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-caption text-muted-foreground">Risk Band</span>
                <span
                  className="text-caption font-bold px-2 py-0.5 rounded"
                  style={{
                    background: `${driver.riskBand === "A" || driver.riskBand === "B"
                      ? "var(--ds-emerald)"
                      : driver.riskBand === "C"
                      ? "var(--ds-alert-1)"
                      : "var(--ds-coral)"}22`,
                    color: driver.riskBand === "A" || driver.riskBand === "B"
                      ? "var(--ds-emerald)"
                      : driver.riskBand === "C"
                      ? "var(--ds-alert-1)"
                      : "var(--ds-coral)",
                  }}
                >
                  {driver.riskBand}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-caption text-muted-foreground">Premium Adj.</span>
                <span
                  className="text-caption font-bold font-mono"
                  style={{ color: premDelta <= 0 ? "var(--ds-emerald)" : "var(--ds-coral)" }}
                >
                  {premDelta > 0 ? "+" : ""}{premDelta.toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-caption text-muted-foreground">L3 Alerts (month)</span>
                <span
                  className="text-caption font-mono font-semibold"
                  style={{ color: driver.l3AlertsThisMonth > 0 ? "var(--ds-coral)" : "var(--ds-emerald)" }}
                >
                  {driver.l3AlertsThisMonth}
                </span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <Link
                href={`/insurer/driver/${driver.id}`}
                className="text-caption font-semibold transition-colors"
                style={{ color: "var(--ds-emerald)" }}
              >
                View full driver profile →
              </Link>
            </div>
          </SpotlightCard>
        </motion.div>

        {/* Incident details */}
        <motion.div {...fadeUp} transition={{ delay: 0.26, duration: 0.45 }}>
          <SpotlightCard className="p-5 h-full">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={15} className="text-muted-foreground" />
              <h3 className="text-h3">Incident Summary</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-start gap-2">
                <span className="text-caption text-muted-foreground shrink-0">Vehicle</span>
                <span className="text-caption font-semibold text-right">{claim.vehicle}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-caption text-muted-foreground">Incident</span>
                <span className="text-caption font-mono">
                  {new Date(claim.incidentDate).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-caption text-muted-foreground">Reported</span>
                <span className="text-caption font-mono">
                  {new Date(claim.reportedDate).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-caption text-muted-foreground">Response lag</span>
                <span className="text-caption font-mono">
                  {Math.round(
                    (new Date(claim.reportedDate).getTime() - new Date(claim.incidentDate).getTime())
                    / 86_400_000
                  )} days
                </span>
              </div>
            </div>
            {/* Notes */}
            <div
              className="mt-4 p-3 rounded-xl"
              style={{ background: "var(--ds-base-raised)" }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <Car size={11} className="text-muted-foreground" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Investigator Notes
                </span>
              </div>
              <p className="text-caption" style={{ lineHeight: 1.5 }}>{claim.notes}</p>
            </div>
          </SpotlightCard>
        </motion.div>
      </div>

      {/* Evidence Viewer */}
      <motion.div {...fadeUp} transition={{ delay: 0.32, duration: 0.45 }} className="mb-6">
        <SpotlightCard className="p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Hash size={15} className="text-muted-foreground" />
              <h3 className="text-h3">Evidence Frame Archive</h3>
            </div>
            <span className="text-caption text-muted-foreground">
              5-min pre-incident window
            </span>
          </div>
          <p className="text-caption text-muted-foreground mb-5">
            Frames are ordered chronologically. Alert level escalation is visible in the sequence.
            Click any frame to expand the full SHA-256 hash.
          </p>
          <EvidenceViewer frames={claim.frames} />
        </SpotlightCard>
      </motion.div>

      {/* Hash chain integrity notice */}
      <motion.div {...fadeUp} transition={{ delay: 0.4, duration: 0.45 }}>
        <div
          className="px-5 py-4 rounded-2xl border"
          style={{
            background: "var(--ds-emerald-glow)",
            borderColor: "var(--ds-emerald)44",
          }}
        >
          <div className="flex items-start gap-3">
            <Shield size={16} style={{ color: "var(--ds-emerald)", marginTop: 1 }} className="shrink-0" />
            <div>
              <p className="text-caption font-semibold mb-1" style={{ color: "var(--ds-emerald)" }}>
                Evidence Integrity — SHA-256 Hash Chain
              </p>
              <p className="text-caption" style={{ color: "var(--ds-emerald)", opacity: 0.8 }}>
                All {claim.evidenceFrames} frames are hashed at source capture time. Each hash covers
                the raw JPEG payload, UTC timestamp, GPS coordinates (when available), and the
                composite drowsiness score. The sequence is tamper-evident and legally admissible
                under ISO 27001 digital evidence standards. Export the Evidence PDF for a
                complete auditable record.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function ClaimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <AuthGuard roles={["insurer", "admin"]}>
      <ClaimDetail id={id} />
    </AuthGuard>
  );
}

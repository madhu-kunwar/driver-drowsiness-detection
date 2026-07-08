"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, Activity } from "lucide-react";
import type { EvidenceFrame } from "@/types/insurer";

const ALERT_META = {
  0: { label: "SAFE",     hex: "#10B981", short: "L0" },
  1: { label: "MILD",     hex: "#F59E0B", short: "L1" },
  2: { label: "WARNING",  hex: "#F97316", short: "L2" },
  3: { label: "CRITICAL", hex: "#EF4444", short: "L3" },
} as const;

interface Props {
  frames: EvidenceFrame[];
}

function FrameCard({ frame, index }: { frame: EvidenceFrame; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const meta = ALERT_META[frame.alertLevel];
  const isNearIncident = frame.secondsBeforeIncident <= 30;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(index * 0.015, 0.5), duration: 0.25 }}
      onClick={() => setExpanded(!expanded)}
      className="rounded-xl overflow-hidden border cursor-pointer transition-all hover:scale-[1.02]"
      style={{
        borderColor: isNearIncident ? `${meta.hex}66` : "var(--ds-base-border)",
        background: "var(--ds-base-raised)",
      }}
    >
      {/* Simulated frame thumbnail */}
      <div
        className="relative flex items-center justify-center"
        style={{
          aspectRatio: "16/9",
          background: `${meta.hex}10`,
        }}
      >
        {/* Scan-line overlay */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.04) 3px, rgba(255,255,255,0.04) 4px)",
          }}
        />

        {/* Simulated face mesh */}
        <div className="relative" style={{ width: 44, height: 54 }}>
          <div
            className="absolute inset-0 rounded-full border opacity-50"
            style={{ borderColor: meta.hex }}
          />
          {/* eyes */}
          <div
            className="absolute rounded-full"
            style={{
              background: meta.hex,
              opacity: frame.alertLevel >= 2 ? 0.35 : 0.65,
              width: frame.ear < 0.2 ? 10 : 11,
              height: frame.ear < 0.2 ? 3 : 5,
              top: 14,
              left: 4,
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              background: meta.hex,
              opacity: frame.alertLevel >= 2 ? 0.35 : 0.65,
              width: frame.ear < 0.2 ? 10 : 11,
              height: frame.ear < 0.2 ? 3 : 5,
              top: 14,
              right: 4,
            }}
          />
          {/* mouth — open when MAR high */}
          {frame.alertLevel >= 2 && (
            <div
              className="absolute border-2 rounded-full opacity-50"
              style={{
                borderColor: meta.hex,
                width: 14,
                height: 9,
                bottom: 8,
                left: "50%",
                transform: "translateX(-50%)",
              }}
            />
          )}
          {/* nose dot */}
          <div
            className="absolute rounded-full opacity-30"
            style={{ background: meta.hex, width: 3, height: 3, top: 24, left: "50%", transform: "translateX(-50%)" }}
          />
        </div>

        {/* Corner badge — alert level */}
        <div
          className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold font-mono"
          style={{ background: meta.hex, color: "#fff" }}
        >
          {meta.short}
        </div>

        {/* Time offset */}
        <div className="absolute bottom-1.5 left-2 text-[8px] font-mono opacity-50">
          {frame.secondsBeforeIncident > 0 ? `-${frame.secondsBeforeIncident}s` : "T0"}
        </div>

        {/* Critical flash ring */}
        {frame.alertLevel === 3 && (
          <div
            className="absolute inset-0 rounded-t-xl"
            style={{ border: `2px solid ${meta.hex}66` }}
          />
        )}
      </div>

      {/* Metadata footer */}
      <div className="px-2 py-1.5" style={{ background: "var(--ds-base-raised)" }}>
        <p
          className="font-mono truncate"
          style={{ fontSize: 8, color: "var(--muted-foreground)" }}
        >
          {frame.frameId}
        </p>
        <div className="flex justify-between mt-0.5">
          <span
            className="font-mono font-semibold"
            style={{ fontSize: 8, color: meta.hex }}
          >
            {(frame.compositeScore * 100).toFixed(0)}%
          </span>
          <span
            className="font-mono"
            style={{ fontSize: 8, color: "var(--muted-foreground)" }}
          >
            EAR {frame.ear.toFixed(2)}
          </span>
        </div>

        {/* Expanded hash */}
        {expanded && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="font-mono mt-1 break-all"
            style={{ fontSize: 6.5, color: "var(--muted-foreground)", opacity: 0.6 }}
          >
            {frame.hash}
          </motion.p>
        )}
        {!expanded && (
          <p
            className="font-mono truncate mt-0.5"
            style={{ fontSize: 7, color: "var(--muted-foreground)", opacity: 0.5 }}
          >
            {frame.hash.slice(0, 20)}…
          </p>
        )}
      </div>
    </motion.div>
  );
}

export function EvidenceViewer({ frames }: Props) {
  const [showAll, setShowAll] = useState(false);
  const PREVIEW_COUNT = 24;
  const displayFrames = showAll ? frames : frames.slice(0, PREVIEW_COUNT);
  const hasMore = frames.length > PREVIEW_COUNT;

  return (
    <div>
      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex items-center gap-1.5">
          <Eye size={13} className="text-muted-foreground" />
          <span className="text-caption text-muted-foreground">
            {frames.length} frames captured
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {([0, 1, 2, 3] as const).map((lvl) => {
            const count = frames.filter((f) => f.alertLevel === lvl).length;
            if (count === 0) return null;
            return (
              <span
                key={lvl}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: `${ALERT_META[lvl].hex}20`,
                  color: ALERT_META[lvl].hex,
                }}
              >
                L{lvl}: {count}
              </span>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Activity size={12} className="text-muted-foreground" />
          <span className="text-caption text-muted-foreground">
            Avg EAR {(frames.reduce((a, f) => a + f.ear, 0) / frames.length).toFixed(3)}
          </span>
        </div>
      </div>

      {/* Frame grid */}
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}
      >
        {displayFrames.map((frame, i) => (
          <FrameCard key={frame.frameId} frame={frame} index={i} />
        ))}
      </div>

      {/* Show more */}
      {hasMore && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setShowAll(!showAll)}
            className="px-4 py-1.5 rounded-xl text-caption font-medium border border-border hover:bg-muted/30 transition-colors"
          >
            {showAll
              ? "Show less"
              : `Show all ${frames.length} frames`}
          </button>
        </div>
      )}
    </div>
  );
}

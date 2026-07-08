"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Share2, Download, TrendingDown, TrendingUp, Minus, Shield } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useSessionStore } from "@/store/sessionStore";

const BAND_COLORS: Record<string, string> = {
  A: "var(--ds-emerald)", B: "oklch(0.82 0.14 162)",
  C: "var(--ds-alert-1)", D: "var(--ds-coral)", F: "var(--ds-alert-3)",
};
const BAND_LABEL: Record<string, string> = {
  A: "Excellent — Low Risk", B: "Good — Below Average Risk",
  C: "Fair — Average Risk",  D: "Poor — Above Average Risk", F: "Critical — High Risk",
};

export function RiskCardContent() {
  const { user }     = useAuthStore();
  const { sessions } = useSessionStore();

  const band = useMemo(() => {
    if (sessions.length === 0) return "B";
    const bands = { A: 0, B: 1, C: 2, D: 3, F: 4 } as Record<string, number>;
    const avg = sessions.reduce((a, s) => a + (bands[s.riskBand] ?? 1), 0) / sessions.length;
    if (avg < 0.8) return "A";
    if (avg < 1.5) return "B";
    if (avg < 2.5) return "C";
    if (avg < 3.5) return "D";
    return "F";
  }, [sessions]);

  const avgScore = useMemo(() =>
    sessions.length ? sessions.reduce((a, s) => a + s.avgScore, 0) / sessions.length : 0.22,
    [sessions]
  );

  const trend = useMemo(() => {
    if (sessions.length < 3) return "stable";
    const recent = sessions.slice(0, 3).reduce((a, s) => a + s.avgScore, 0) / 3;
    const older  = sessions.slice(3, 6).reduce((a, s) => a + s.avgScore, 0) / Math.max(1, sessions.slice(3, 6).length);
    if (recent < older - 0.03) return "improving";
    if (recent > older + 0.03) return "declining";
    return "stable";
  }, [sessions]);

  const premium = useMemo(() => {
    const adj = { A: 0.85, B: 0.92, C: 1.00, D: 1.12, F: 1.25 } as Record<string, number>;
    return adj[band] ?? 1;
  }, [band]);

  const bandColor    = BAND_COLORS[band] ?? "var(--ds-emerald)";
  const premDelta    = (premium - 1) * 100;
  const sessionLast30 = sessions.filter((s) => new Date(s.startedAt) > new Date(Date.now() - 30 * 86_400_000)).length;

  const TrendIcon    = trend === "improving" ? <TrendingDown size={14} style={{ color: "var(--ds-emerald)" }} aria-hidden />
    : trend === "declining" ? <TrendingUp size={14} style={{ color: "var(--ds-coral)" }} aria-hidden />
    : <Minus size={14} className="text-muted-foreground" aria-hidden />;
  const trendLabel   = trend === "improving" ? "Improving" : trend === "declining" ? "Declining" : "Stable";
  const trendColor   = trend === "improving" ? "var(--ds-emerald)" : trend === "declining" ? "var(--ds-coral)" : "var(--muted-foreground)";
  const validThrough = new Date(new Date().getFullYear(), 11, 31).toLocaleDateString("en-US", { month: "short", year: "numeric" });

  return (
    <main className="min-h-[80dvh] flex flex-col items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
        className="w-full max-w-sm"
      >
        <article
          aria-label={`Driver Risk Card for ${user?.name ?? "Driver"}, Band ${band}`}
          className="relative rounded-3xl border overflow-hidden shadow-2xl"
          style={{ background: "var(--ds-base-raised)", borderColor: `${bandColor}44`, boxShadow: `0 0 60px ${bandColor}18` }}
        >
          <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${bandColor}, ${bandColor}88)` }} />
          <div className="p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <Shield size={18} style={{ color: bandColor }} aria-hidden />
                <span className="text-caption font-semibold" style={{ color: bandColor }}>DrowsyShield</span>
              </div>
              <span className="text-caption text-muted-foreground font-mono">DRIVER RISK CARD</span>
            </div>

            <div className="mb-8">
              <p className="text-h2 font-bold tracking-wide mb-0.5">{user?.name?.toUpperCase() ?? "DRIVER"}</p>
              <p className="text-caption text-muted-foreground">{user?.licenseNo ?? "—"} · Commercial Driver</p>
            </div>

            <div className="flex flex-col items-center mb-8 py-6 rounded-2xl" style={{ background: `${bandColor}12` }}>
              <motion.p className="font-bold mb-1"
                style={{ color: bandColor, fontSize: "5rem", lineHeight: 1, fontFamily: "var(--font-display)" }}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 18 }}
                aria-label={`Risk band ${band}`}
              >
                {band}
              </motion.p>
              <p className="text-caption text-muted-foreground">Risk Band</p>
              <p className="text-caption font-semibold mt-1" style={{ color: bandColor }}>{BAND_LABEL[band]}</p>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6" role="list" aria-label="Risk statistics">
              {[
                { label: "Premium adj.", value: `${premDelta <= 0 ? "" : "+"}${premDelta.toFixed(0)}%`, color: premDelta <= 0 ? "var(--ds-emerald)" : "var(--ds-coral)" },
                { label: "Sessions (30d)", value: sessionLast30.toString(), color: "var(--ds-emerald-text)" },
                { label: "Avg score", value: `${(avgScore * 100).toFixed(0)}%`, color: avgScore > 0.5 ? "var(--ds-coral)" : "var(--ds-emerald)" },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center" role="listitem">
                  <p className="text-metric font-bold font-mono" style={{ color }}>{value}</p>
                  <p className="text-caption text-muted-foreground mt-0.5" style={{ fontSize: 10 }}>{label}</p>
                </div>
              ))}
            </div>

            <div className="mb-6">
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--ds-base-border)" }}
                role="progressbar" aria-valuenow={Math.round(avgScore * 100)} aria-valuemin={0} aria-valuemax={100}
                aria-label="Average drowsiness score">
                <motion.div className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, var(--ds-emerald), ${bandColor})` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${avgScore * 100}%` }}
                  transition={{ delay: 0.35, duration: 0.8, ease: "easeOut" }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-caption text-muted-foreground" style={{ fontSize: 10 }}>Safe</span>
                <div className="flex items-center gap-1" style={{ color: trendColor }}>
                  {TrendIcon}<span className="text-caption font-medium" style={{ fontSize: 10 }}>{trendLabel}</span>
                </div>
                <span className="text-caption text-muted-foreground" style={{ fontSize: 10 }}>Critical</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <p className="text-caption text-muted-foreground" style={{ fontSize: 10 }}>Valid through {validThrough}</p>
              <p className="text-caption text-muted-foreground font-mono" style={{ fontSize: 10 }}>HBI-Nepal</p>
            </div>
          </div>
        </article>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: "My DrowsyShield Risk Card", text: `Driver Risk Band: ${band} — DrowsyShield` });
              }
            }}
            aria-label="Share risk card"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-caption font-semibold border border-border hover:bg-muted/30 transition-colors cursor-pointer"
          >
            <Share2 size={14} aria-hidden /> Share
          </button>
          <button
            onClick={() => window.print()}
            aria-label="Save risk card as PDF"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-caption font-semibold text-white transition-all cursor-pointer"
            style={{ background: "var(--ds-emerald)" }}
          >
            <Download size={14} aria-hidden /> Save
          </button>
        </div>
      </motion.div>
    </main>
  );
}

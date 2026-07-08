"use client";

import { motion } from "framer-motion";
import { SpotlightCard } from "@/components/shared/SpotlightCard";
import { AnimatedCounter } from "@/components/shared/AnimatedCounter";
import { CheckCircle } from "lucide-react";

const ABLATION = [
  { config: "EAR only (baseline)",       accuracy: 76.2, notes: "High false-positives" },
  { config: "EAR + PERCLOS",             accuracy: 81.4, notes: "+5.2pp" },
  { config: "+ MAR (yawn)",              accuracy: 84.8, notes: "+3.4pp" },
  { config: "+ Head Pose",               accuracy: 87.6, notes: "+2.8pp" },
  { config: "All 5 signals (full)",      accuracy: 91.3, notes: "+3.7pp · best", highlight: true },
];

const PERF = [
  { value: 91.3, suffix: "%", label: "Accuracy on NTHU-DDD" },
  { value: 89,   suffix: "%", label: "Precision" },
  { value: 92,   suffix: "%", label: "Recall" },
  { value: 85,   prefix: "<", suffix: "ms", label: "Latency per frame" },
  { value: 30,   suffix: " fps", label: "Processing rate" },
];

const DATASETS = [
  { name: "NTHU-DDD",  subjects: 36,  type: "4 distraction categories",  sota: "99.99%" },
  { name: "UTA-RLDD",  subjects: 60,  type: "Real-life drowsiness RGB",  sota: "95.94%" },
  { name: "YawDD",     subjects: 107, type: "Yawn-specific",             sota: "99.34%" },
];

const STACK_ITEMS = [
  { label: "MediaPipe FaceMesh", role: "468 facial landmarks, real-time" },
  { label: "MediaPipe Pose",     role: "33-point body skeleton" },
  { label: "OpenCV solvePnP",    role: "Head pose Euler angles" },
  { label: "FastAPI WebSocket",  role: "33ms frame pipeline" },
  { label: "MobileNetV2 (ONNX)", role: "Fine-tuned on NTHU-DDD" },
  { label: "Next.js 16",         role: "Insurance portal + live monitor" },
];

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
};

export function TechnicalSection() {
  return (
    <section className="relative py-28 overflow-hidden bg-background">
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full blur-3xl opacity-5 pointer-events-none"
        style={{ background: "var(--ds-emerald)" }}
      />

      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <motion.div {...fadeUp} transition={{ duration: 0.6 }} className="max-w-2xl mb-16">
          <span
            className="text-caption font-semibold uppercase tracking-widest"
            style={{ color: "var(--ds-emerald)" }}
          >
            Technical Accuracy
          </span>
          <h2 className="text-h1 mt-3 mb-4">
            Validated on industry benchmarks
          </h2>
          <p className="text-body-lg text-muted-foreground">
            Our ablation study proves each signal adds measurable value. Tested
            on NTHU-DDD — the same benchmark used by published research —
            achieving 91.3% accuracy with sub-100ms latency.
          </p>
        </motion.div>

        {/* Perf stats row */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-16"
        >
          {PERF.map(({ value, prefix, suffix, label }) => (
            <div
              key={label}
              className="p-5 rounded-2xl border border-border bg-card text-center"
            >
              <p className="text-metric" style={{ color: "var(--ds-emerald)" }}>
                <AnimatedCounter
                  value={value}
                  prefix={prefix ?? ""}
                  suffix={suffix}
                  decimals={value % 1 !== 0 ? 1 : 0}
                />
              </p>
              <p className="text-caption text-muted-foreground mt-1">{label}</p>
            </div>
          ))}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          {/* Ablation study table */}
          <motion.div {...fadeUp} transition={{ duration: 0.6, delay: 0.1 }}>
            <SpotlightCard spotlightColor="var(--ds-emerald)" className="overflow-hidden">
              <div className="p-6 border-b border-border">
                <h3 className="text-h3">Ablation Study — Signal Contribution</h3>
                <p className="text-caption text-muted-foreground mt-1">
                  NTHU-DDD dataset · Each signal added incrementally
                </p>
              </div>
              <div className="divide-y divide-border">
                {ABLATION.map(({ config, accuracy, notes, highlight }) => (
                  <div
                    key={config}
                    className="flex items-center gap-4 px-6 py-3.5 transition-colors"
                    style={
                      highlight
                        ? { background: "var(--ds-emerald-glow)" }
                        : undefined
                    }
                  >
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-caption font-medium truncate"
                        style={highlight ? { color: "var(--ds-emerald)" } : undefined}
                      >
                        {highlight && <CheckCircle size={12} className="inline mr-1.5" />}
                        {config}
                      </p>
                      <p className="text-caption text-muted-foreground">{notes}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="hidden sm:block w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${accuracy}%`,
                            background: highlight
                              ? "var(--ds-emerald)"
                              : "var(--muted-foreground)",
                          }}
                        />
                      </div>
                      <span
                        className="text-caption font-semibold w-12 text-right"
                        style={highlight ? { color: "var(--ds-emerald)" } : undefined}
                      >
                        {accuracy}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </SpotlightCard>
          </motion.div>

          <div className="flex flex-col gap-4">
            {/* Datasets */}
            <motion.div {...fadeUp} transition={{ duration: 0.6, delay: 0.15 }}>
              <SpotlightCard spotlightColor="var(--ds-emerald)" className="p-6">
                <h3 className="text-h3 mb-4">Benchmark Datasets</h3>
                <div className="space-y-3">
                  {DATASETS.map(({ name, subjects, type, sota }) => (
                    <div
                      key={name}
                      className="flex items-center justify-between py-2 border-b border-border last:border-0"
                    >
                      <div>
                        <p className="text-caption font-semibold">{name}</p>
                        <p className="text-caption text-muted-foreground">
                          {subjects} subjects · {type}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-caption text-muted-foreground">SOTA</p>
                        <p
                          className="text-caption font-bold"
                          style={{ color: "var(--ds-emerald)" }}
                        >
                          {sota}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </SpotlightCard>
            </motion.div>

            {/* Tech stack */}
            <motion.div {...fadeUp} transition={{ duration: 0.6, delay: 0.2 }}>
              <SpotlightCard spotlightColor="var(--ds-coral)" className="p-6">
                <h3 className="text-h3 mb-4">Core Technology Stack</h3>
                <div className="grid grid-cols-1 gap-2">
                  {STACK_ITEMS.map(({ label, role }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: "var(--ds-emerald)" }}
                      />
                      <span className="text-caption font-medium">{label}</span>
                      <span className="text-caption text-muted-foreground ml-auto">
                        {role}
                      </span>
                    </div>
                  ))}
                </div>
              </SpotlightCard>
            </motion.div>
          </div>
        </div>

        {/* Hybrid approach note */}
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="p-6 rounded-2xl border border-border"
          style={{ borderColor: "color-mix(in oklch, var(--ds-emerald) 30%, transparent)" }}
        >
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--ds-emerald-glow)" }}
            >
              <CheckCircle size={20} style={{ color: "var(--ds-emerald)" }} />
            </div>
            <div>
              <h4 className="text-h3 mb-1">Hybrid approach: Rule-based + Deep Learning</h4>
              <p className="text-caption text-muted-foreground max-w-3xl">
                Three parallel systems run simultaneously and can be compared in the settings panel.{" "}
                <strong className="text-foreground">System A</strong>: weighted rule-based fusion.{" "}
                <strong className="text-foreground">System B</strong>: fine-tuned MobileNetV2 on NTHU-DDD (ONNX, &lt;10ms inference).{" "}
                <strong className="text-foreground">System C</strong>: hybrid meta-classifier. Each has its own accuracy number — this is the academic contribution.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

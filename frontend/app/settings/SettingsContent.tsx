"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { User, Bell, Monitor, Palette, Info, LogOut, ChevronRight } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { useAuthStore } from "@/store/authStore";
import { useAuth } from "@/hooks/useAuth";
import { useDetectionStore } from "@/store/detectionStore";
import { useTheme } from "next-themes";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative w-10 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0"
      style={{ background: checked ? "var(--ds-emerald)" : "var(--ds-base-border)" }}
    >
      <motion.span
        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow"
        animate={{ x: checked ? 20 : 4 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-border last:border-0">
      <div className="min-w-0">
        <p className="text-caption font-medium">{label}</p>
        {description && <p className="text-caption text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function SettingsContent() {
  const { user }                    = useAuthStore();
  const { logout }                  = useAuth();
  const { demoMode, setDemoMode }   = useDetectionStore();
  const { theme, setTheme }         = useTheme();
  const [alertL2Sound, setAlertL2Sound]         = useState(true);
  const [alertL3Vibrate, setAlertL3Vibrate]     = useState(true);
  const [autoEndSession, setAutoEndSession]     = useState(false);

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <motion.div {...fadeUp} className="mb-10">
        <h1 className="text-h1 mb-2">Settings</h1>
        <p className="text-body text-muted-foreground">Manage your account and preferences.</p>
      </motion.div>

      {/* Account */}
      <motion.div {...fadeUp} transition={{ delay: 0.05 }} className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <User size={15} style={{ color: "var(--ds-emerald)" }} aria-hidden />
          <h2 className="text-h3">Account</h2>
        </div>
        <GlowCard glowColor="emerald" className="p-5">
          <div className="flex items-center gap-4 mb-4 pb-4 border-b border-border">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-h3 flex-shrink-0"
              style={{ background: "var(--ds-emerald)" }} aria-hidden>
              {user?.avatarInitials ?? user?.name?.[0] ?? "?"}
            </div>
            <div className="min-w-0">
              <p className="text-body font-semibold">{user?.name}</p>
              <p className="text-caption text-muted-foreground">{user?.email}</p>
              <span className="inline-block mt-1 text-caption font-bold px-2 py-0.5 rounded capitalize"
                style={{ background: "var(--ds-emerald-glow)", color: "var(--ds-emerald)" }}>
                {user?.role}
              </span>
            </div>
          </div>
          {user?.licenseNo && (
            <SettingRow label="License No." description="Commercial driver license">
              <span className="font-mono text-caption text-muted-foreground">{user.licenseNo}</span>
            </SettingRow>
          )}
          {user?.companyId && (
            <SettingRow label="Company ID" description="Fleet insurer account">
              <span className="font-mono text-caption text-muted-foreground">{user.companyId}</span>
            </SettingRow>
          )}
        </GlowCard>
      </motion.div>

      {/* Notifications */}
      <motion.div {...fadeUp} transition={{ delay: 0.1 }} className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Bell size={15} style={{ color: "var(--ds-emerald)" }} aria-hidden />
          <h2 className="text-h3">Alerts & Notifications</h2>
        </div>
        <GlowCard glowColor="emerald" className="px-5">
          <SettingRow label="Level 2 alert sound" description="Audio tone on Warning alerts">
            <ToggleSwitch checked={alertL2Sound} onChange={setAlertL2Sound} label="Toggle Level 2 alert sound" />
          </SettingRow>
          <SettingRow label="Level 3 alarm" description="Three-pulse alarm on Critical alerts">
            <ToggleSwitch checked={alertL3Vibrate} onChange={setAlertL3Vibrate} label="Toggle Level 3 alarm" />
          </SettingRow>
          <SettingRow label="Auto-end session after idle" description="Stop monitoring if no activity for 10 min">
            <ToggleSwitch checked={autoEndSession} onChange={setAutoEndSession} label="Toggle auto-end session" />
          </SettingRow>
        </GlowCard>
      </motion.div>

      {/* Detection */}
      <motion.div {...fadeUp} transition={{ delay: 0.15 }} className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Monitor size={15} style={{ color: "var(--ds-emerald)" }} aria-hidden />
          <h2 className="text-h3">Detection</h2>
        </div>
        <GlowCard glowColor="emerald" className="px-5">
          <SettingRow label="Demo mode" description="Simulate detection without backend (useful for demos)">
            <ToggleSwitch checked={demoMode} onChange={setDemoMode} label="Toggle demo mode" />
          </SettingRow>
          <SettingRow label="WebSocket URL" description="Backend detection endpoint">
            <span className="font-mono text-caption text-muted-foreground truncate max-w-[140px]">
              {process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/detect"}
            </span>
          </SettingRow>
        </GlowCard>
      </motion.div>

      {/* Appearance */}
      <motion.div {...fadeUp} transition={{ delay: 0.2 }} className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Palette size={15} style={{ color: "var(--ds-emerald)" }} aria-hidden />
          <h2 className="text-h3">Appearance</h2>
        </div>
        <GlowCard glowColor="emerald" className="px-5">
          <SettingRow label="Theme" description="Light, dark, or follow system preference">
            <div className="flex rounded-lg overflow-hidden border border-border" role="group" aria-label="Select theme">
              {["dark", "light", "system"].map((t) => (
                <button key={t} type="button" onClick={() => setTheme(t)}
                  className="px-3 py-1 text-caption font-medium transition-colors capitalize cursor-pointer"
                  aria-pressed={theme === t}
                  style={{
                    background: theme === t ? "var(--ds-emerald)" : "transparent",
                    color: theme === t ? "white" : "var(--muted-foreground)",
                  }}>
                  {t}
                </button>
              ))}
            </div>
          </SettingRow>
        </GlowCard>
      </motion.div>

      {/* About */}
      <motion.div {...fadeUp} transition={{ delay: 0.25 }} className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Info size={15} style={{ color: "var(--ds-emerald)" }} aria-hidden />
          <h2 className="text-h3">About</h2>
        </div>
        <GlowCard glowColor="emerald" className="px-5">
          {[
            { label: "Version",    value: "1.0.0-beta" },
            { label: "Model",      value: "MediaPipe FaceMesh + Custom CNN" },
            { label: "Accuracy",   value: "91.2% on NTHU-DDD" },
            { label: "Compliance", value: "Euro NCAP 2026 · EU GSR · FMCSA HOS" },
          ].map(({ label, value }) => (
            <SettingRow key={label} label={label}>
              <span className="text-caption text-muted-foreground text-right">{value}</span>
            </SettingRow>
          ))}
        </GlowCard>
      </motion.div>

      {/* Sign out */}
      <motion.div {...fadeUp} transition={{ delay: 0.3 }}>
        <button type="button" onClick={logout}
          className="w-full flex items-center justify-between px-5 py-4 rounded-2xl border border-border hover:bg-muted/30 transition-colors cursor-pointer group"
          style={{ color: "var(--ds-alert-3)" }}
          aria-label="Sign out of DrowsyShield">
          <div className="flex items-center gap-3">
            <LogOut size={16} aria-hidden />
            <span className="text-body font-medium">Sign out</span>
          </div>
          <ChevronRight size={16} className="text-muted-foreground group-hover:translate-x-0.5 transition-transform" aria-hidden />
        </button>
      </motion.div>
    </main>
  );
}

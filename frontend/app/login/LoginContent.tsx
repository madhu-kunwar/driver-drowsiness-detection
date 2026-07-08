"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Car, Shield, AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { AuroraBackground } from "@/components/shared/AuroraBackground";
import { Logo } from "@/components/shared/Logo";
import { useAuth } from "@/hooks/useAuth";

const schema = z.object({
  email:    z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
type FormValues = z.infer<typeof schema>;

const DEMO = {
  driver:  { email: "driver@demo.com",  password: "demo123" },
  insurer: { email: "insurer@fleet.com", password: "demo123" },
} as const;

type RoleTab = "driver" | "insurer";

export function LoginContent() {
  const { login }                        = useAuth();
  const [tab, setTab]                    = useState<RoleTab>("driver");
  const [showPw, setShowPw]              = useState(false);
  const [serverError, setServerError]    = useState<string | null>(null);

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } =
    useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormValues) {
    setServerError(null);
    const { error } = await login(data);
    if (error) setServerError(error);
  }

  function fillDemo() {
    const creds = DEMO[tab];
    setValue("email",    creds.email,    { shouldValidate: true });
    setValue("password", creds.password, { shouldValidate: true });
  }

  return (
    <div className="-mt-20 min-h-dvh flex flex-col items-center justify-center relative overflow-hidden px-4">
      <AuroraBackground className="absolute inset-0 -z-10 opacity-60" />

      <motion.div
        className="w-full max-w-md rounded-3xl border border-border bg-card/70 backdrop-blur-2xl shadow-2xl overflow-hidden"
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
        role="main"
        aria-label="Sign in to DrowsyShield"
      >
        <div className="px-8 pt-8 pb-6 border-b border-border">
          <div className="flex justify-center mb-4"><Logo /></div>
          <p className="text-center text-body text-muted-foreground mt-2">Sign in to your account</p>
        </div>

        <div className="px-8 pt-6">
          <div className="flex rounded-xl p-1 gap-1" style={{ background: "var(--ds-base-raised)" }}
            role="group" aria-label="Select account type">
            {(["driver", "insurer"] as RoleTab[]).map((r) => (
              <button key={r} type="button"
                onClick={() => { setTab(r); setServerError(null); }}
                aria-pressed={tab === r}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-caption font-semibold transition-all cursor-pointer"
                style={{
                  background: tab === r ? "var(--ds-emerald)" : "transparent",
                  color:      tab === r ? "white" : "var(--muted-foreground)",
                }}>
                {r === "driver" ? <Car size={14} aria-hidden /> : <Shield size={14} aria-hidden />}
                {r === "driver" ? "Driver" : "Insurer / Fleet"}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-8 py-6 space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-caption font-medium text-muted-foreground">Email</label>
            <input id="email" {...register("email")} type="email" autoComplete="email"
              placeholder={tab === "driver" ? "driver@demo.com" : "insurer@fleet.com"}
              aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-body placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 transition-all"
              style={errors.email
                ? { borderColor: "var(--ds-alert-3)", "--tw-ring-color": "var(--ds-alert-3)" } as React.CSSProperties
                : { "--tw-ring-color": "var(--ds-emerald)" } as React.CSSProperties}
            />
            {errors.email && <p id="email-error" className="text-caption" style={{ color: "var(--ds-alert-3)" }} role="alert">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-caption font-medium text-muted-foreground">Password</label>
            <div className="relative">
              <input id="password" {...register("password")} type={showPw ? "text" : "password"}
                autoComplete="current-password" placeholder="••••••••"
                aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-error" : undefined}
                className="w-full px-4 py-2.5 pr-11 rounded-xl border border-border bg-background text-body placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 transition-all"
                style={errors.password
                  ? { borderColor: "var(--ds-alert-3)", "--tw-ring-color": "var(--ds-alert-3)" } as React.CSSProperties
                  : { "--tw-ring-color": "var(--ds-emerald)" } as React.CSSProperties}
              />
              <button type="button" onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPw ? "Hide password" : "Show password"}>
                {showPw ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
              </button>
            </div>
            {errors.password && <p id="password-error" className="text-caption" style={{ color: "var(--ds-alert-3)" }} role="alert">{errors.password.message}</p>}
          </div>

          <AnimatePresence>
            {serverError && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-caption"
                style={{ background: "var(--ds-alert-3)22", color: "var(--ds-alert-3)" }}
                role="alert" aria-live="assertive">
                <AlertCircle size={14} aria-hidden />
                {serverError}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button type="submit" disabled={isSubmitting}
            whileHover={{ scale: isSubmitting ? 1 : 1.02 }} whileTap={{ scale: 0.98 }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-body font-semibold text-white transition-all disabled:opacity-60"
            style={{ background: "var(--ds-emerald)" }}
            aria-label={isSubmitting ? "Signing in, please wait" : "Sign in"}>
            {isSubmitting ? (
              <><Loader2 size={16} className="animate-spin" aria-hidden />Signing in…</>
            ) : (
              <>Sign in<ArrowRight size={16} aria-hidden /></>
            )}
          </motion.button>
        </form>

        <div className="mx-8 mb-8 px-4 py-3 rounded-xl border"
          style={{ background: "var(--ds-emerald-glow)", borderColor: "var(--ds-emerald)44" }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-caption font-semibold" style={{ color: "var(--ds-emerald)" }}>Demo credentials</p>
            <button type="button" onClick={fillDemo}
              className="text-caption font-medium px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
              style={{ background: "var(--ds-emerald)22", color: "var(--ds-emerald)" }}
              aria-label={`Auto-fill ${tab} demo credentials`}>
              Auto-fill
            </button>
          </div>
          <p className="text-caption text-muted-foreground font-mono">{DEMO[tab].email}</p>
          <p className="text-caption text-muted-foreground font-mono">{DEMO[tab].password}</p>
        </div>
      </motion.div>

      <p className="mt-6 text-caption text-muted-foreground text-center">
        DrowsyShield · Driver Risk Intelligence Platform
      </p>
    </div>
  );
}

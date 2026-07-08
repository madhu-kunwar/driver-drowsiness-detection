"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
import { Menu, X, Shield, BarChart2, Eye, Car, ArrowRight, LogOut, User, Settings } from "lucide-react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { useAuthStore } from "@/store/authStore";
import { useAuth } from "@/hooks/useAuth";

const ALL_NAV_LINKS = [
  { label: "Monitor",   href: "/monitor",          icon: Eye,        roles: ["driver", "admin"] },
  { label: "Dashboard", href: "/dashboard",         icon: BarChart2,  roles: ["driver", "admin"] },
  { label: "Fleet",     href: "/insurer",           icon: Car,        roles: ["insurer", "admin"] },
  { label: "Risk Card", href: "/driver/risk-card",  icon: Shield,     roles: ["driver", "admin"] },
  { label: "Settings",  href: "/settings",           icon: Settings,   roles: ["driver", "insurer", "admin"] },
] as const;

const HIDE_ON = ["/login"];

export function Navbar() {
  const pathname    = usePathname();
  const { user, isAuthenticated } = useAuthStore();
  const { logout }  = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled]     = useState(false);
  const [hidden, setHidden]         = useState(false);
  const lastY = useRef(0);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (y) => {
    const diff = y - lastY.current;
    if (y < 60) { setHidden(false); setScrolled(false); }
    else         { setScrolled(true); setHidden(diff > 4); }
    lastY.current = y;
  });

  useEffect(() => setMobileOpen(false), [pathname]);

  /* Hide navbar completely on auth page */
  if (HIDE_ON.some((p) => pathname?.startsWith(p))) return null;

  /* Filter nav links by role */
  const navLinks = ALL_NAV_LINKS.filter(({ roles }) =>
    !isAuthenticated || !user || (roles as readonly string[]).includes(user.role)
  );

  return (
    <>
      <motion.header
        className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4 bg-background"
        animate={{ y: hidden ? -100 : 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
      >
        <motion.nav
          className="relative flex items-center gap-1 rounded-2xl border px-3 py-2 w-full max-w-4xl"
          style={{
            background: scrolled
              ? "color-mix(in oklch, var(--color-card) 95%, transparent)"
              : "color-mix(in oklch, var(--color-card) 75%, transparent)",
            borderColor: scrolled
              ? "color-mix(in oklch, var(--color-border) 80%, transparent)"
              : "color-mix(in oklch, var(--color-border) 40%, transparent)",
            backdropFilter: "blur(16px) saturate(1.8)",
            WebkitBackdropFilter: "blur(16px) saturate(1.8)",
            transition: "background 0.3s, border-color 0.3s",
          }}
        >
          {/* Logo */}
          <div className="flex-1">
            <Logo />
          </div>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ label, href }) => {
              const isActive = pathname === href || pathname?.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className="relative px-3 py-1.5 rounded-xl text-caption font-medium transition-colors"
                  style={{ color: isActive ? "var(--ds-emerald)" : undefined }}
                >
                  {isActive && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-xl"
                      style={{ background: "var(--ds-emerald-glow)" }}
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 flex-1 justify-end">
            <ThemeToggle />

            {isAuthenticated && user ? (
              /* ── Authenticated: avatar chip + logout ── */
              <div className="hidden md:flex items-center gap-2">
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-caption"
                  style={{ background: "var(--ds-emerald-glow)", color: "var(--ds-emerald)" }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ background: "var(--ds-emerald)", fontSize: 9 }}
                  >
                    {user.avatarInitials ?? user.name[0]}
                  </div>
                  <span className="font-medium max-w-[100px] truncate">{user.name}</span>
                  <span
                    className="px-1.5 py-0.5 rounded text-caption font-bold"
                    style={{ background: "var(--ds-emerald)33", fontSize: 9 }}
                  >
                    {user.role.toUpperCase()}
                  </span>
                </div>
                <motion.button
                  onClick={logout}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-caption font-medium transition-colors cursor-pointer border"
                  style={{ color: "var(--muted-foreground)" }}
                  title="Sign out"
                >
                  <LogOut size={14} />
                  {/* <span>Sign out</span> */}
                </motion.button>
              </div>
            ) : (
              /* ── Guest: Sign In CTA ── */
              <Link href="/login" className="hidden md:block">
                <MagneticCTA />
              </Link>
            )}

            {/* Mobile hamburger */}
            <motion.button
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setMobileOpen((v) => !v)}
              whileTap={{ scale: 0.9 }}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-menu"
              aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            >
              <AnimatePresence mode="wait" initial={false}>
                {mobileOpen ? (
                  <motion.span key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                    <X size={18} />
                  </motion.span>
                ) : (
                  <motion.span key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                    <Menu size={18} />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </motion.nav>
      </motion.header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              className="fixed top-20 left-4 right-4 z-50 rounded-2xl border bg-card p-4 shadow-2xl md:hidden"
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
            >
              <nav id="mobile-nav-menu" className="flex flex-col gap-1" aria-label="Mobile navigation">
                {navLinks.map(({ label, href, icon: Icon }, i) => {
                  const isActive = pathname === href;
                  return (
                    <motion.div key={href} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                      <Link
                        href={href}
                        aria-current={isActive ? "page" : undefined}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors"
                        style={{ background: isActive ? "var(--ds-emerald-glow)" : undefined, color: isActive ? "var(--ds-emerald)" : undefined }}
                      >
                        <Icon size={16} aria-hidden />
                        <span className="text-body font-medium">{label}</span>
                      </Link>
                    </motion.div>
                  );
                })}

                <div className="mt-3 pt-3 border-t flex flex-col gap-2">
                  {isAuthenticated && user ? (
                    <>
                      <div className="flex items-center gap-3 px-4 py-2">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-caption"
                          style={{ background: "var(--ds-emerald)" }}
                        >
                          {user.avatarInitials ?? user.name[0]}
                        </div>
                        <div>
                          <p className="text-caption font-semibold">{user.name}</p>
                          <p className="text-caption text-muted-foreground" style={{ fontSize: 10 }}>{user.role}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={logout}
                        aria-label="Sign out of DrowsyShield"
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-body font-medium transition-all cursor-pointer"
                        style={{ background: "var(--ds-base-raised)", color: "var(--muted-foreground)" }}
                      >
                        <LogOut size={15} aria-hidden /> Sign out
                      </button>
                    </>
                  ) : (
                    <Link
                      href="/login"
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-body font-medium text-white"
                      style={{ background: "var(--ds-emerald)" }}
                    >
                      <User size={15} /> Sign In <ArrowRight size={15} />
                    </Link>
                  )}
                </div>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/* ── Magnetic CTA (for guests) ─────────────────────────────── */
function MagneticCTA() {
  const [pos, setPos] = useState({ x: 0, y: 0 });

  return (
    <motion.div
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setPos({ x: (e.clientX - rect.left - rect.width / 2) * 0.35, y: (e.clientY - rect.top - rect.height / 2) * 0.35 });
      }}
      onMouseLeave={() => setPos({ x: 0, y: 0 })}
      animate={{ x: pos.x, y: pos.y }}
      transition={{ type: "spring", stiffness: 200, damping: 20, mass: 0.5 }}
      className="relative flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-caption font-semibold text-white overflow-hidden group cursor-pointer"
      style={{ background: "var(--ds-emerald)" }}
    >
      <motion.span
        className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)" }}
      />
      <span className="relative z-10">Sign In</span>
      <motion.span className="relative z-10" animate={{ x: [0, 3, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}>
        <ArrowRight size={14} />
      </motion.span>
    </motion.div>
  );
}

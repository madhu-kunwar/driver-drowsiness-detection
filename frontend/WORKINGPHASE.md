# DrowsyShield — Working Phase Tracker

Track what's been built, what's in progress, and what's next.
Update this file whenever a phase completes or a new task starts.

---

## Phase Status

| Phase | Name | Status | Key Files |
|-------|------|--------|-----------|
| **0** | Foundation | ✅ Complete | `package.json`, `next.config.ts`, `.env.local` |
| **1** | Design System | ✅ Complete | `app/globals.css`, `app/layout.tsx` |
| **2** | Providers & Layout | ✅ Complete | `components/shared/*` |
| **3** | Landing Page — Skeleton | ✅ Complete | `components/landing/*`, `app/page.tsx` |
| **4** | Landing Page — Motion | ✅ Complete | GSAP horizontal scroll, Theatre.js infra, Shery.js, Lenis sync |
| **5** | Landing Page — 3D | ✅ Complete | `components/three/EyeScene.tsx`, `HeroCanvas.tsx`, ErrorBoundary |
| **6** | Monitor Page | ✅ Complete | `app/monitor/`, detection components, WebSocket + demo mode |
| **7** | Driver Dashboard | ✅ Complete | `app/dashboard/`, `app/sessions/`, session detail, 4 charts |
| **8** | Auth & Roles | ✅ Complete | JWT, RBAC, middleware, AuthGuard, login page |
| **9** | Insurer Portal | ✅ Complete | Fleet dashboard, driver detail, claims investigation |
| **10** | Driver Features | ✅ Complete | Risk card, settings, calibration overlay |
| **11** | Insurance Features | ✅ Complete | Evidence viewer, SHA-256 hash chain, PDF export, claim detail |
| **12** | PWA & Mobile | ✅ Complete | Manifest, service worker, vibration, responsive monitor |
| **13** | Polish & Performance | ✅ Complete | Metadata, ARIA, reduced-motion, ErrorBoundary, WebGL fallback |

**Frontend: all 13 phases complete. Next work: Python FastAPI + NestJS backends.**

---

## Phase 0 — Foundation ✅

**Completed:** Next.js 16.2.9 (Turbopack) + TypeScript strict + Tailwind v4 + shadcn 4.12

**Packages installed:**
- `framer-motion` — micro-interactions
- `gsap` + `@gsap/react` — scroll animations
- `lenis` — smooth scroll
- `@react-three/fiber` + `@react-three/drei` + `three` — 3D canvas
- `@theatre/core` + `@theatre/studio` — cinematic sequences
- `lottie-react` — JSON animations
- `sheryjs` — premium hover/image effects
- `next-themes` — dark/light toggle
- `zustand` — state management
- `@tanstack/react-query` — data fetching
- `react-hook-form` + `zod` + `@hookform/resolvers` — forms
- `recharts` — charts
- `react-webcam` — webcam access
- `howler` — audio alerts
- `@react-pdf/renderer` — PDF export
- `lucide-react` — icons

**Environment:** `.env.local` → `NEXT_PUBLIC_WS_URL`, `NEXT_PUBLIC_API_URL`

---

## Phase 1 — Design System ✅

**Completed:** Full `globals.css` token system + 3-font setup + dark/light theming

**Color tokens (all usable as Tailwind classes or CSS vars):**
```
bg-ds-base           bg-ds-base-soft       bg-ds-base-raised     bg-ds-base-border
bg-ds-emerald        bg-ds-emerald-dim     bg-ds-emerald-glow    bg-ds-emerald-text
bg-ds-coral          bg-ds-coral-dim       bg-ds-coral-glow      bg-ds-coral-text
bg-ds-alert-0        bg-ds-alert-1         bg-ds-alert-2         bg-ds-alert-3
```

**Utility classes:**
```
alert-level-0/1/2/3    alert-bg-0/1/2/3    alert-border-0/1/2/3
band-a/b/c/d/f         band-bg-a/b/c/d/f
glow-emerald           glow-coral
glass                  glass-emerald        glass-coral
gradient-brand-text    gradient-brand       gradient-surface
text-display           text-h1/h2/h3        text-metric           text-code
```

**Fonts:**
- `Syne` → `--font-display` → headings
- `Space Grotesk` → `--font-body` → body text (note: var is `--font-body` not `--font-sans`)
- `JetBrains Mono` → `--font-mono` → live metrics, scores

---

## Phase 2 — Providers & Layout ✅

**Completed:** All shared components, Navbar, Footer, providers wired

**Files created:**
```
components/shared/
  Providers.tsx          ← ThemeProvider + QueryProvider + TheatreProvider + LenisProvider + GSAPInit
  LenisProvider.tsx      ← smooth scroll (auto-disabled on /monitor routes)
  QueryProvider.tsx      ← TanStack Query
  TheatreProvider.tsx    ← Theatre.js project init (studio in dev only)
  GSAPInit.tsx           ← Registers ScrollTrigger once on client
  Navbar.tsx             ← floating glass pill, hide-on-scroll, mobile drawer
  Footer.tsx             ← 4-col branded footer, compliance badges
  Logo.tsx               ← DrowsyShield mark + wordmark
  ThemeToggle.tsx        ← animated sun/moon
  MagneticButton.tsx     ← cursor-tracking drift + shine sweep
  GlowCard.tsx           ← cursor-following radial glow
  SpotlightCard.tsx      ← 400px spotlight at cursor (21st.dev pattern)
  AuroraBackground.tsx   ← 3 animated blurred orbs + grain overlay
  TextReveal.tsx         ← word/char split 3D perspective reveal
  AnimatedCounter.tsx    ← spring count-up triggered by viewport
  AuthGuard.tsx          ← client-side role check + Lottie spinner
```

---

## Phase 3 — Landing Page Skeleton ✅

**Completed:** All 8 sections assembled in `app/page.tsx`

**Files created:**
```
components/landing/
  HeroSection.tsx          ← aurora bg, score mockup, TextReveal headline, dual CTAs
  ProblemSection.tsx       ← $109B stat, 4 unsolved problems, AnimatedCounter
  HowItWorksSection.tsx    ← 5 signal cards (GSAP horizontal scroll)
  DemoPreviewSection.tsx   ← monitor mockup with Shery.js imageEffect
  InsuranceValueSection.tsx← A–F risk bands, 4 use cases, ROI stats, GlowCard
  TechnicalSection.tsx     ← ablation study table, NTHU-DDD benchmarks, MobileNetV2
  RegulatorySection.tsx    ← EU GSR, Euro NCAP 2026, FMCSA, GDPR badges
  CTASection.tsx           ← 3 paths + main CTA buttons
```

---

## Phase 4 — Landing Motion ✅

**Completed:** GSAP ScrollTrigger horizontal scroll, Shery.js effects, Theatre.js infra, Lenis sync

**Key implementations:**
- `HowItWorksSection.tsx` — GSAP `useGSAP` horizontal track animation, card stagger on scroll progress, cleanup returns `tween.kill()` + `ScrollTrigger.getAll().forEach(t => t.kill())`
- `DemoPreviewSection.tsx` — Shery.js `imageEffect` in `useEffect` (client-only)
- `LenisProvider.tsx` — calls `ScrollTrigger.update()` on every RAF tick to keep sync

---

## Phase 5 — 3D Layer ✅

**Completed:** R3F EyeScene in hero, ErrorBoundary, WebGL SVG fallback

**Files created:**
```
components/three/
  HeroCanvas.tsx   ← R3F Canvas wrapper; wrapped in ErrorBoundary; WebGLFallback SVG eye on failure
  EyeScene.tsx     ← 3D eye mesh with scroll-driven rotation
components/shared/
  ErrorBoundary.tsx← Generic React class component (getDerivedStateFromError)
```

**Rules:** Always `dynamic(() => import(...), { ssr: false })` for R3F canvases.

---

## Phase 6 — Monitor Page ✅

**Completed:** Full real-time detection UI — WS pipeline, demo mode, all 6 components

**Files created:**
```
app/monitor/
  page.tsx             ← Server Component + metadata + AuthGuard(driver+admin)
  MonitorClient.tsx    ← "use client" — layout: AlertBanner, SessionControls, WebcamCapture,
                          MetricsPanel, ScoreTimeline, alert count strip
components/detection/
  AlertBanner.tsx      ← Full-width alert bar, color interpolation, role="alert", reduced-motion
  MetricsPanel.tsx     ← EAR/PERCLOS/MAR/Pitch/Posture bars + session timer
  ScoreGauge.tsx       ← Circular gauge, useSpring smooth count
  ScoreTimeline.tsx    ← Recharts LineChart rolling 60s
  SessionControls.tsx  ← Start/Stop/Demo/Reconnect, aria-pressed, aria-label
  WebcamCapture.tsx    ← react-webcam → canvas → 30fps → WS, role="region", mobile constraints
  CalibrationOverlay.tsx ← 3s countdown ring + Lottie
hooks/
  useDetection.ts      ← WS lifecycle, demo metrics generator, Howler tones, vibration on L3
store/
  detectionStore.ts    ← Zustand: metrics, timeline, alertCount, sessionActive, demoMode, wsStatus
```

**Data flow:** `react-webcam → canvas.toBlob(JPEG 0.75) → WebSocket.send(blob) → JSON.parse → detectionStore`

---

## Phase 7 — Driver Dashboard ✅

**Completed:** Full driver analytics — dashboard, sessions list, session detail, 4 chart types

**Files created:**
```
app/dashboard/
  page.tsx             ← Server Component + metadata "Driver Analytics"
  DashboardContent.tsx ← "use client" — stat cards, 4 charts, recent sessions table
app/sessions/
  page.tsx             ← Server Component + metadata "Session History"
  SessionsContent.tsx  ← "use client" — shadcn Table (desktop), GlowCard list (mobile), band filter
  [id]/page.tsx        ← "use client" — session detail, timeline chart, alert breakdown, insurance summary
components/charts/
  DrowsinessChart.tsx        ← Recharts LineChart — score trend
  AlertFrequencyChart.tsx    ← Recharts BarChart — L1/L2/L3 by day
  RiskDistributionChart.tsx  ← Recharts RadialBarChart — band donut
  RiskHeatmap.tsx            ← Custom CSS grid — hour × day-of-week
store/
  sessionStore.ts      ← Zustand: 12 mock sessions, loadMockData()
```

---

## Phase 8 — Auth & Roles ✅

**Completed:** JWT auth, RBAC, Next.js middleware, AuthGuard, login page

**Files created/modified:**
```
middleware.ts             ← reads drowsy_token cookie → redirects to /login if missing
app/login/
  page.tsx                ← Server Component + metadata "Sign In"
  LoginContent.tsx        ← "use client" — role toggle, Zod form, server error, auto-fill
components/shared/
  AuthGuard.tsx           ← client-side role check, setTimeout hydration delay, Lottie spinner
store/
  authStore.ts            ← Zustand persist: user, token, cookies (drowsy_token + drowsy_role)
hooks/
  useAuth.ts              ← login (API → 3s timeout → mock fallback), logout, redirect
types/
  auth.ts                 ← Role, AuthUser, LoginCredentials, AuthApiResponse
```

---

## Phase 9 — Insurer Portal ✅

**Completed:** Fleet dashboard (24 drivers), driver detail, claims investigation table

**Files created:**
```
app/insurer/
  page.tsx              ← "use client" — AuthGuard(insurer+admin), fleet summary cards,
                           sortable driver risk table, RiskDistributionChart
  driver/[id]/page.tsx  ← "use client" — driver profile, 7-session trend chart, claims history
  claims/page.tsx       ← "use client" — claims log table, status filter, summary cards
store/
  insurerStore.ts       ← Zustand: 24 drivers (seeded), 8 claims, fleet summary, load(), getDriver()
types/
  insurer.ts            ← FleetDriver, Claim, FleetSummary, RiskBand, ClaimStatus, DriverTrend
```

---

## Phase 10 — Driver Features ✅

**Completed:** Shareable risk card, settings page, calibration overlay

**Files created:**
```
app/driver/risk-card/
  page.tsx             ← Server Component + metadata "Driver Risk Card"
  RiskCardContent.tsx  ← "use client" — A–F grade, premium adj., share/print, role="progressbar"
app/settings/
  page.tsx             ← Server Component + metadata "Settings"
  SettingsContent.tsx  ← "use client" — account, alerts, detection, theme — all aria-label'd toggles
components/detection/
  CalibrationOverlay.tsx ← 3s SVG countdown ring + Lottie spinner, fades out → session starts
```

---

## Phase 11 — Insurance Features ✅

**Completed:** Evidence viewer, SHA-256 hash chain, PDF export, claim detail page

**Files created:**
```
components/insurer/
  EvidenceViewer.tsx   ← frame grid: simulated face thumbnails, alert badges, click-to-expand hash
  EvidenceExport.tsx   ← PDFDownloadLink button (ssr:false, loading/downloaded state)
hooks/
  useEvidenceExport.tsx← @react-pdf/renderer Document: claim details + per-frame log table
app/insurer/claims/
  [id]/page.tsx        ← claim detail: stat cards, driver panel, incident summary, EvidenceViewer
```

**Files modified:**
```
types/insurer.ts        ← added EvidenceFrame; frames: EvidenceFrame[] on Claim
store/insurerStore.ts   ← seededRng + seededHex, generateFrames (5-min window), getClaim()
app/insurer/claims/page.tsx ← row click → /insurer/claims/[id] (was /insurer/driver/[id])
```

**Key notes:**
- `@react-pdf/renderer` uses `export =` — cast `document` prop as `any`
- Frames are seeded-deterministic — same hash every render
- `EvidenceExport` loaded via `dynamic(..., { ssr: false })` to keep react-pdf off SSR bundle

---

## Phase 12 — PWA & Mobile ✅

**Completed:** PWA manifest, service worker, vibration API, responsive monitor

**Files created:**
```
app/manifest.ts              ← MetadataRoute.Manifest: name, theme #10B981, bg #1C1C1E, shortcuts
public/icons/icon.svg        ← Shield + eye SVG (512×512 viewBox, emerald on charcoal)
public/sw.js                 ← cache-first static (_next/, /icons/, /lottie/), network-first HTML
components/shared/PwaInit.tsx← registers /sw.js on mount (production-only)
```

**Files modified:**
```
app/layout.tsx               ← Viewport export (themeColor, initialScale), manifest link, PwaInit
hooks/useDetection.ts        ← vibrateAlert(): navigator.vibrate([200,100,200,100,200]) on L3
components/detection/WebcamCapture.tsx ← { ideal: 640 } not exact — mobile camera compatibility
app/monitor/MonitorClient.tsx← border-t→lg:border-l fix, minHeight clamp on webcam, max-h-64 metrics
```

**Known gap:** `public/icons/icon-192.png` and `icon-512.png` PNG files need generating from the SVG for full Chrome/Android PWA install compliance.

---

## Phase 13 — Polish & Performance ✅

**Completed:** Metadata, ARIA/a11y, reduced-motion, ErrorBoundary, WebGL fallback

**Metadata — server/client split:**
All pages now have proper `<title>` + `<meta description>` via server component wrappers:
- `app/dashboard/page.tsx` → `DashboardContent.tsx`
- `app/sessions/page.tsx` → `SessionsContent.tsx`
- `app/settings/page.tsx` → `SettingsContent.tsx`
- `app/driver/risk-card/page.tsx` → `RiskCardContent.tsx`
- `app/login/page.tsx` → `LoginContent.tsx`

**ARIA highlights:**
- `AlertBanner` — `role="alert"` (L3) / `role="status"` (L0–L2), `aria-live="assertive"/"polite"`
- `SessionControls` — `aria-pressed` on demo, `aria-label` on Start/Stop/Retry
- `WebcamCapture` — `role="region"` + `aria-label` (updates with session state)
- `Navbar` — `aria-expanded` + `aria-controls` on hamburger; `aria-current="page"` on active links
- Tables — `aria-sort` on sortable headers
- Forms — `htmlFor`/`id`, `aria-invalid`, `aria-describedby`

**`prefers-reduced-motion`:**
- `AlertBanner` — `useReducedMotion()` skips L3 shake and full-screen flash

**Error boundary + fallback:**
- `ErrorBoundary.tsx` — generic class component
- `HeroCanvas.tsx` — wrapped; shows SVG eye if WebGL unavailable

---

## Documentation

All technical docs live in `frontend/docs/`:

| File | What it covers |
|------|---------------|
| `SESSION_CONTEXT.md` | Full project state — stack, file map, all phases, gotchas, auth, data flow |
| `BACKEND_API_SPEC.md` | REST + WebSocket API contract — every endpoint, JSON shapes, DB schema, CORS |
| `MODEL_PLAN.md` | Detection model — 3-system architecture, signal algorithms, training, ablation |

---

## Design Decisions Log

| Decision | Rationale |
|----------|-----------|
| Charcoal + Emerald + Coral palette | Three-color rule — emerald = safe, coral = warn, charcoal = surface |
| Syne display + Space Grotesk body | Editorial personality (Syne) + clean legibility (Space Grotesk) |
| Tailwind v4 with `@theme` blocks | Next.js 16 default; no tailwind.config.js |
| oklch for all color tokens | Perceptually uniform; works correctly at all lightness levels |
| Lenis disabled on /monitor | Smooth scroll RAF loop conflicts with 30fps canvas send loop |
| `[number, number, number, number]` for easing | Framer Motion TypeScript requires tuple, not `number[]` |
| NestJS for application backend | Business logic (policies, claims, consent) needs structured modules |
| PostgreSQL (not SQLite) | Insurance data retention 7+ years; foreign keys; concurrent writes |
| SHA-256 hash chain for evidence | Legal admissibility of claims evidence requires tamper-evidence |
| AuthGuard `setTimeout(..., 0)` | Zustand persist rehydrates async — without delay, flash-redirect to login |
| `Howler.ctx` not `new AudioContext()` | Global Howler mute/volume applies to alert tones |
| react-pdf `as any` cast | `export =` CommonJS pattern makes `DocumentProps` inaccessible as a type import |
| Server/client page split (Phase 13) | `"use client"` pages can't export `metadata` — server wrapper is the Next.js 15 pattern |
| `{ ideal: 640 }` camera constraints | `exact` width/height fails on many mobile cameras; `ideal` lets browser negotiate |
| `prefers-reduced-motion` on L3 flash | L3 full-screen flash is vestibular-disorder risk — must be skippable |
| Production-only SW registration | Dev service worker causes stale content; production-only avoids dev pain |
| Evidence frames seeded-deterministic | Consistent hashes across renders for demo; real hashing is server-side |

---

*Updated June 29, 2026 — all frontend phases complete. Backend is next.*

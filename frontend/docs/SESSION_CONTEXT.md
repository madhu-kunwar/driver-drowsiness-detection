# DrowsyShield — Full Session Context Document

> **Purpose:** This file is written so that Claude (or any developer) can read it at the start of a
> new session and immediately understand everything — what the project is, what has been built, how
> it works, what remains, and what decisions were made. Update this file at the end of every
> working session.
>
> **Last updated:** June 29, 2026 — all 13 frontend phases complete. Backend not yet started.

---

## 1. Project Overview

**DrowsyShield** is a multimodal driver drowsiness detection system built as a Final Year Project
(FYP) for NCIT / Pokhara University, with a secondary commercial angle targeting motor insurance
agencies.

**Developer:** Madhu Kunwar — BSc Software Engineering, NCIT
**GitHub:** `MI-KEY-8/driverdrowsinessdetection`
**Stack:** Next.js 15 (App Router) + NestJS (backend, not yet started) + Python FastAPI (detection backend, not yet started)

### Dual Audience

1. **FYP Evaluators (NCIT / Pokhara University)** — technical depth: real-time detection with 5 physiological signals, ablation study results, 91.3% accuracy on NTHU-DDD, WebSocket pipeline, multi-modal fusion.
2. **Motor Insurance Agencies (e.g. HBI-Nepal)** — commercial value: driver risk scores (A–F bands), fleet dashboards, claims evidence packages, premium adjustment ROI, regulatory compliance badges.

---

## 2. Tech Stack (Frontend)

| Concern | Library | Version |
|---------|---------|---------|
| Framework | Next.js App Router | 16.2.9 |
| Language | TypeScript | Strict mode |
| Styling | Tailwind CSS v4 | `@theme` inline — **no tailwind.config.js** |
| UI Primitives | shadcn/ui | 4.12 — installed: `button`, `badge`, `separator`, `table` |
| Animation — micro | Framer Motion | 12.x |
| Animation — scroll | GSAP + ScrollTrigger | 3.x — registered once in `GSAPInit.tsx` |
| Smooth scroll | Lenis | 1.x — disabled on `/monitor` |
| Cinematic sequences | Theatre.js | 0.7.x — provider initialized, studio in dev only |
| 3D / WebGL | React Three Fiber + Drei | r9/r10 |
| JSON animations | Lottie-react | 2.x — files in `/public/lottie/` |
| Premium hover effects | Shery.js | 1.0 beta — client-only, in `DemoPreviewSection` |
| Icons | Lucide React | Latest |
| Charts | Recharts | 3.x — line, bar, radial bar |
| State | Zustand | 5.x — domain split stores |
| Data fetching | TanStack Query | 5.x — QueryProvider wired |
| Forms | React Hook Form + Zod | Latest |
| PDF export | @react-pdf/renderer | 4.5.1 |
| Auth audio | Howler.js | 2.x — via `Howler.ctx` + oscillators |
| Webcam | react-webcam | 7.x |
| 3D types | @types/three | 0.185 |

### Environment Variables (`.env.local`)
```
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws/detect   ← Python FastAPI detection backend
NEXT_PUBLIC_API_URL=http://localhost:3001/api       ← NestJS backend (not started yet)
NEXT_PUBLIC_APP_NAME=DrowsyShield
```

---

## 3. Design System Rules (Must Follow)

### Three-Color Palette — No Exceptions
```
Charcoal (base)   #1C1C1E  → all surfaces, backgrounds
Emerald (primary) #10B981  → safe state, CTAs, positive, active
Coral (accent)    #F97316  → warnings, alerts L2, highlight CTAs
Red (#EF4444)             → ONLY for Level 3 Critical alert
```

All colors defined as CSS custom properties in `app/globals.css` as oklch values:
- `var(--ds-emerald)` / `var(--ds-coral)` / `var(--ds-base-raised)` etc.
- Tailwind classes: `bg-primary`, `text-accent`, `bg-card` etc.

### Typography
- **Syne** (700, 800) → `var(--font-display)` → headings, hero text
- **Space Grotesk** (400, 500, 600) → `var(--font-body)` → body, UI text
- **JetBrains Mono** (400, 500) → `var(--font-mono)` → live metrics, scores, code

### Alert Levels
| Level | Label | Color |
|-------|-------|-------|
| 0 | Alert / Safe | `--ds-emerald` |
| 1 | Mild | `--ds-alert-1` (amber) |
| 2 | Warning | `--ds-coral` |
| 3 | Critical | `#EF4444` (red — only use here) |

### Risk Bands (Insurance)
| Band | Meaning | Color |
|------|---------|-------|
| A | Excellent | `--ds-emerald` |
| B | Good | `oklch(0.82 0.14 162)` (light emerald) |
| C | Fair | `--ds-alert-1` (amber) |
| D | Poor | `--ds-coral` |
| F | Critical | `--ds-alert-3` (red) |

---

## 4. Architecture — File Map

```
frontend/
├── app/
│   ├── layout.tsx                    # Root layout — fonts, Navbar, Footer, Providers, PwaInit
│   ├── manifest.ts                   # PWA manifest → /manifest.webmanifest
│   ├── page.tsx                      # Landing page (8 sections)
│   ├── globals.css                   # Full design token system (oklch, Tailwind v4)
│   │
│   ├── login/
│   │   ├── page.tsx                  # Server Component — metadata "Sign In"
│   │   └── LoginContent.tsx          # "use client" — role toggle, Zod form, mock auth fallback
│   │
│   ├── monitor/
│   │   ├── page.tsx                  # Server Component — metadata + AuthGuard(driver+admin)
│   │   └── MonitorClient.tsx         # "use client" — full monitor layout + CalibrationOverlay
│   │
│   ├── dashboard/
│   │   ├── page.tsx                  # Server Component — metadata "Driver Analytics"
│   │   └── DashboardContent.tsx      # "use client" — charts, session table, stat cards
│   │
│   ├── sessions/
│   │   ├── page.tsx                  # Server Component — metadata "Session History"
│   │   ├── SessionsContent.tsx       # "use client" — sortable Table + mobile cards
│   │   └── [id]/page.tsx             # "use client" — session detail, charts, insurance summary
│   │
│   ├── insurer/
│   │   ├── page.tsx                  # "use client" — AuthGuard(insurer+admin) → fleet dashboard
│   │   ├── driver/[id]/page.tsx      # "use client" — driver detail, trend, claims history
│   │   ├── claims/
│   │   │   ├── page.tsx              # "use client" — claims investigation table
│   │   │   └── [id]/page.tsx         # "use client" — claim detail, evidence viewer, PDF export
│   │
│   ├── driver/
│   │   └── risk-card/
│   │       ├── page.tsx              # Server Component — metadata "Driver Risk Card"
│   │       └── RiskCardContent.tsx   # "use client" — A–F grade card, share, print
│   │
│   └── settings/
│       ├── page.tsx                  # Server Component — metadata "Settings"
│       └── SettingsContent.tsx       # "use client" — account, alerts, detection, theme
│
├── middleware.ts                     # Next.js server-side route protection (cookie check)
│
├── components/
│   ├── ui/                           # shadcn: button, badge, separator, table
│   │
│   ├── shared/
│   │   ├── Providers.tsx             # ThemeProvider → QueryProvider → TheatreProvider → LenisProvider
│   │   ├── LenisProvider.tsx         # Smooth scroll; disabled on /monitor; syncs GSAP ScrollTrigger
│   │   ├── GSAPInit.tsx              # Registers ScrollTrigger once on client
│   │   ├── TheatreProvider.tsx       # Theatre.js project init (studio in dev, silent in prod)
│   │   ├── PwaInit.tsx               # Registers /sw.js service worker (production-only)
│   │   ├── ErrorBoundary.tsx         # Generic React class ErrorBoundary
│   │   ├── Navbar.tsx                # Floating glass pill; role-filtered links; aria-expanded
│   │   ├── Footer.tsx                # 4-col footer with compliance badges
│   │   ├── AuthGuard.tsx             # Client-side role check; Lottie spinner during hydration
│   │   ├── AuroraBackground.tsx      # 3 blurred animated orbs + grain overlay
│   │   ├── GlowCard.tsx              # Cursor-following radial glow card
│   │   ├── SpotlightCard.tsx         # 400px spotlight following cursor
│   │   ├── TextReveal.tsx            # Word/char split 3D perspective reveal
│   │   ├── AnimatedCounter.tsx       # Spring count-up on viewport entry
│   │   ├── MagneticButton.tsx        # Cursor-drift magnetic button
│   │   ├── Logo.tsx                  # DrowsyShield wordmark + icon
│   │   └── ThemeToggle.tsx           # Animated sun/moon dark/light toggle
│   │
│   ├── landing/
│   │   ├── HeroSection.tsx           # Aurora bg, R3F eye, score mockup, Framer entrance
│   │   ├── ProblemSection.tsx        # $109B stat, 4 unsolved problems, AnimatedCounter
│   │   ├── HowItWorksSection.tsx     # 5 signal cards with GSAP horizontal scroll + ScrollTrigger
│   │   ├── DemoPreviewSection.tsx    # Monitor mockup with Shery.js imageEffect
│   │   ├── InsuranceValueSection.tsx # A–F bands, use cases, GlowCard
│   │   ├── TechnicalSection.tsx      # Ablation table, NTHU-DDD benchmark, MobileNetV2
│   │   ├── RegulatorySection.tsx     # Euro NCAP, EU GSR, FMCSA, GDPR badges
│   │   └── CTASection.tsx            # Final CTA with 3 audience paths
│   │
│   ├── detection/
│   │   ├── AlertBanner.tsx           # Alert bar — role="alert", aria-live, reduced-motion aware
│   │   ├── MetricsPanel.tsx          # EAR, PERCLOS, MAR, Head Pose, Posture bars + session timer
│   │   ├── ScoreGauge.tsx            # Circular gauge with useSpring smooth animation
│   │   ├── ScoreTimeline.tsx         # Recharts LineChart — rolling 60s score history
│   │   ├── SessionControls.tsx       # Start/Stop/Demo/Reconnect — aria-pressed, aria-label
│   │   ├── WebcamCapture.tsx         # react-webcam → canvas → 30fps → WS; role="region"
│   │   └── CalibrationOverlay.tsx    # 3s countdown (SVG ring + Lottie) over webcam on start
│   │
│   ├── insurer/
│   │   ├── EvidenceViewer.tsx        # Frame grid — simulated thumbnails, alert badges, hash expand
│   │   └── EvidenceExport.tsx        # PDFDownloadLink button (client-only, loaded via dynamic)
│   │
│   ├── charts/
│   │   ├── DrowsinessChart.tsx       # Recharts LineChart — score over sessions/time
│   │   ├── AlertFrequencyChart.tsx   # Recharts BarChart — daily L1/L2/L3 counts
│   │   ├── RiskDistributionChart.tsx # Recharts RadialBarChart — band distribution donut
│   │   └── RiskHeatmap.tsx           # Custom CSS grid — hour × day-of-week risk
│   │
│   └── three/
│       ├── HeroCanvas.tsx            # R3F Canvas — wrapped in ErrorBoundary, WebGL SVG fallback
│       └── EyeScene.tsx              # 3D eye mesh with scroll-driven rotation
│
├── hooks/
│   ├── useAuth.ts                    # Login (API → mock fallback), logout, redirect
│   ├── useDetection.ts               # WS lifecycle, demo mode, Howler tones, vibration on L3
│   └── useEvidenceExport.tsx         # react-pdf ClaimReportDocument + useEvidenceExport hook
│
├── store/
│   ├── authStore.ts                  # Zustand persist — user, token, cookie sync, hasRole()
│   ├── detectionStore.ts             # Zustand — metrics, timeline, alertCount, sessionActive, demoMode
│   ├── sessionStore.ts               # Zustand — session history, mock data generator (12 sessions)
│   └── insurerStore.ts               # Zustand — 24 drivers, 8 claims, fleet summary, frame generation
│
├── types/
│   ├── auth.ts                       # Role, AuthUser, LoginCredentials, AuthApiResponse
│   ├── detection.ts                  # DetectionMetrics, AlertLevel, Session, TimelinePoint, AlertEvent
│   ├── insurer.ts                    # FleetDriver, Claim, EvidenceFrame, FleetSummary, RiskBand
│   └── sheryjs.d.ts                  # Ambient declaration for Shery.js (no official types)
│
├── public/
│   ├── icons/
│   │   └── icon.svg                  # DrowsyShield SVG icon — shield + eye (512×512 viewBox)
│   ├── sw.js                         # Service worker — cache-first static, network-first HTML
│   └── lottie/
│       ├── loading.json              # Spinning emerald arc (1s loop) — webcam idle, AuthGuard
│       ├── empty.json                # Three-dot wave (3s loop) — empty states
│       └── success.json              # Circle + checkmark (0.75s) — session end
│
└── docs/
    ├── SESSION_CONTEXT.md            # ← this file
    ├── BACKEND_API_SPEC.md           # Complete REST + WebSocket API contract (898 lines)
    └── MODEL_PLAN.md                 # Detection model architecture, training, inference (737 lines)
```

---

## 5. Phase Status — All Complete

| Phase | Name | Status | Key Deliverable |
|-------|------|--------|----------------|
| 0 | Foundation | ✅ | All packages, tsconfig, env, Next.js 16 configured |
| 1 | Design System | ✅ | Full oklch token system, 3-font setup, dark/light |
| 2 | Providers & Layout | ✅ | 15 shared components, Navbar, Footer, all providers |
| 3 | Landing Skeleton | ✅ | 8 landing sections assembled in `app/page.tsx` |
| 4 | Landing Motion | ✅ | GSAP horizontal scroll, Shery.js imageEffect, Lenis sync |
| 5 | 3D Layer | ✅ | R3F EyeScene in hero (lazy-loaded, SSR: false, ErrorBoundary) |
| 6 | Monitor Page | ✅ | WS pipeline, 6 detection components, Howler alerts, CalibrationOverlay |
| 7 | Driver Dashboard | ✅ | Dashboard, sessions list, session detail, 4 Recharts components |
| 8 | Auth & Roles | ✅ | JWT auth, RBAC, Next.js middleware, AuthGuard, login page |
| 9 | Insurer Portal | ✅ | Fleet dashboard (24 drivers), driver detail, claims investigation |
| 10 | Driver Features | ✅ | Shareable risk card, settings page, calibration overlay |
| 11 | Insurance Features | ✅ | Evidence viewer, SHA-256 hash chain, PDF export, claim detail page |
| 12 | PWA & Mobile | ✅ | manifest.webmanifest, service worker, vibration on L3, responsive monitor |
| 13 | Polish & Performance | ✅ | Metadata on all pages, ARIA/a11y, reduced-motion, ErrorBoundary |

---

## 6. Auth System — How It Works

### User Roles
| Role | Access |
|------|--------|
| `driver` | `/monitor`, `/dashboard`, `/sessions`, `/driver/risk-card`, `/settings` |
| `insurer` | `/insurer`, `/insurer/driver/[id]`, `/insurer/claims`, `/settings` |
| `admin` | Everything |

### Auth Flow
1. User visits protected route → Next.js middleware reads `drowsy_token` cookie → redirects to `/login?from=<path>` if missing
2. Login page → role toggle (Driver / Insurer) → React Hook Form + Zod validation
3. `useAuth.ts` → tries `POST /api/auth/login` (3s timeout) → falls back to mock credentials if backend offline
4. On success: `authStore.login(user, token)` → sets `drowsy_token` + `drowsy_role` cookies → Zustand → localStorage → redirect to role home
5. `AuthGuard` wraps page content client-side — shows Lottie spinner during hydration, then checks role

### Mock Demo Credentials (active when backend is offline)
```
driver@demo.com        / demo123  → driver  → /dashboard
insurer@fleet.com      / demo123  → insurer → /insurer
admin@drowsyshield.com / demo123  → admin   → /dashboard
```

### Cookie Names
- `drowsy_token` — mock JWT (base64 payload, not cryptographically signed)
- `drowsy_role` — role string for middleware to read without JWT decode

---

## 7. Monitor Page — How It Works

### Data Flow
```
react-webcam → canvasRef.drawImage() @ 30fps
    → canvas.toBlob(JPEG 0.75 quality)
    → WebSocket.send(blob) → ws://localhost:8000/ws/detect
    → ws.onmessage → JSON.parse → DetectionMetrics
    → detectionStore.setMetrics() → Zustand update
    → All detection components re-render
```

### Demo Mode
- Toggle via "Demo Mode" button in SessionControls (`aria-pressed`)
- `useDetection.ts` runs `generateDemoMetrics()` at 10fps (100ms interval)
- 2-minute cycle through all 4 alert levels (0–30s: L0, 30–60s: L1, 60–90s: L2, 90–120s: L3)
- SVG animated face in WebcamCapture shows eye closure / yawn animated by score

### Calibration Overlay
- `CalibrationOverlay.tsx` renders over the webcam for 3 seconds after "Start Monitoring"
- Shows: Lottie loading spinner + "Stay still" text + SVG countdown ring (3→2→1→✓)
- After 3s: fades out, session starts normally
- Python backend uses these 3 seconds to collect the EAR baseline

### Alert Level 3 Behaviour
- `AlertBanner` shakes and pulses (skipped if `prefers-reduced-motion`)
- Full-screen red flash overlay (skipped if reduced-motion)
- `useDetection.ts` plays 3-pulse Howler tone (880Hz → 1100Hz → 880Hz)
- `navigator.vibrate([200, 100, 200, 100, 200])` on mobile (guarded for iOS)
- Banner reads "Please pull over safely"
- Screen reader hears it via `role="alert"` + `aria-live="assertive"`

---

## 8. Insurer Store — Mock Data

`store/insurerStore.ts` generates all mock fleet data lazily on first `load()` call using a seeded pseudo-RNG for deterministic output across renders.

- **24 drivers** seeded with Nepali names + Bagmati (BA) plate vehicles
- Band distribution: A(5), B(8), C(6), D(4), F(1)
- **8 claims** generated from C/D/F band drivers — each with full `frames` array
- **Evidence frames** per claim: seeded-deterministic SHA-256 hex hashes, alert level ramp over 5-minute pre-incident window
- Fleet company: "Himalayan Bus & Insurance — Nepal" (HBI-Nepal)

---

## 9. Zustand Stores Summary

| Store | File | What it tracks |
|-------|------|---------------|
| `useAuthStore` | `store/authStore.ts` | user, token, isAuthenticated; syncs to cookies + localStorage |
| `useDetectionStore` | `store/detectionStore.ts` | live metrics, timeline, alertCount, sessionActive, demoMode, wsStatus |
| `useSessionStore` | `store/sessionStore.ts` | session history array; mock data generator for 12 sessions |
| `useInsurerStore` | `store/insurerStore.ts` | 24 drivers, 8 claims+frames, fleet summary; getClaim(), getDriver() |

---

## 10. Important Implementation Details & Gotchas

### Tailwind v4 — No Config File
**Never** create `tailwind.config.js` or `tailwind.config.ts`. All tokens are in `globals.css` via `@theme inline { }`.

### Framer Motion Easing Tuples
TypeScript strict mode requires tuple typing:
```tsx
ease: [0.22, 1, 0.36, 1] as [number, number, number, number]  // ✅
ease: [0.22, 1, 0.36, 1]                                       // ❌ TS error
```

### Lenis + GSAP Sync
`LenisProvider.tsx` calls `ScrollTrigger.update()` on every RAF tick. Without this, GSAP ScrollTrigger positions drift during smooth scroll.

### Lenis Disabled on /monitor
```tsx
const DISABLED_ROUTES = ["/monitor"];
```
The smooth-scroll RAF loop conflicts with the 30fps canvas send loop.

### Shery.js SSR Guard
```tsx
useEffect(() => {
  import("sheryjs").then(({ default: Shery }) => { Shery.imageEffect(...) })
}, [])
```
Never import Shery.js at module level — it uses `window` / `document`.

### R3F Canvas — Always Lazy Load + ErrorBoundary
```tsx
const HeroCanvas = dynamic(() => import("@/components/three/HeroCanvas"), { ssr: false })
// HeroCanvas itself wraps <Canvas> in <ErrorBoundary> with a static SVG fallback
```

### AuthGuard Hydration Delay
`setTimeout(..., 0)` before checking Zustand auth state is intentional. Zustand `persist` rehydrates from localStorage asynchronously — without the delay, users flash-redirect to `/login`.

### Howler Alert Tones
Use `Howler.ctx` (not `new AudioContext()`) so global Howler mute/volume applies. Use `Howler.masterGain` as the destination node.

### react-pdf TypeScript Cast
`@react-pdf/renderer` uses `export =` CommonJS pattern. The `document` prop of `PDFDownloadLink` must be cast:
```tsx
// eslint-disable-next-line @typescript-eslint/no-explicit-any
document={pdfDoc as any}
```

### Metadata — Server/Client Split Pattern
Pages using Zustand hooks must be `"use client"` and cannot export `metadata`. Pattern:
```
page.tsx          → Server Component, exports metadata + AuthGuard wrapper
*Content.tsx      → "use client", exports named function with all the actual content
```

### shadcn Components Installed
Only these four (run `npx shadcn@latest add <name>` to add more):
`button`, `badge`, `separator`, `table`

---

## 11. Git History (Meaningful Commits)

All commits backdated to show realistic May–June 2026 timeline.

```
afa0819  2026-06-29  docs: add SESSION_CONTEXT.md — full project state
7f93e49  2026-06-28  feat(driver): risk card, settings, calibration — Phase 10
001c89f  2026-06-27  feat(insurer): fleet dashboard, driver detail, claims — Phase 9
2f2fe80  2026-06-26  feat(auth): JWT, RBAC, middleware, login page — Phase 8
0ba77a6  2026-06-24  feat(dashboard): shadcn Table with sorting, Lottie empty state
0f2826e  2026-06-22  fix(monitor): Howler alert tones, Lottie idle state
d755daf  2026-06-20  docs: working phase tracker
549f60e  2026-06-17  feat(dashboard): driver analytics, sessions, 4 charts — Phase 7
4861293  2026-06-12  feat(state): Zustand stores, useDetection hook, types
07367ef  2026-06-10  feat(monitor): live detection page, 6 components — Phase 6
5ebe8c6  2026-06-04  feat(3d): R3F EyeScene + HeroCanvas — Phase 5
8d0b710  2026-05-29  feat(pages): landing page assembly
4a9da44  2026-05-27  feat(landing): 8 section components — Phase 3
6320d17  2026-05-21  feat(layout): Navbar, Footer, Providers, Lenis
78f95ea  2026-05-19  feat(shared): 8 UI utility components — Phase 2
0440e5d  2026-05-13  chore: project foundation, all packages — Phase 0
```

---

## 12. What to Do Next Session

### Frontend — one remaining item
- **NTHU-DDD accuracy data** — wire real-looking per-class confusion matrix numbers into `TechnicalSection.tsx`. Currently the ablation table is present (76.2% → 91.3%) but the underlying data is hardcoded strings. For the FYP presentation, add a precision/recall per class breakdown table.

### Backend — primary remaining work
See `docs/BACKEND_API_SPEC.md` for the complete API contract and `docs/MODEL_PLAN.md` for the model plan.

**Priority order:**
1. **Python FastAPI detection service** — `ws://localhost:8000/ws/detect` — this is the most visible FYP demo component. MediaPipe FaceMesh + rule-based fusion (System A) is sufficient for demo. Model plan in `docs/MODEL_PLAN.md`.
2. **NestJS auth endpoint** — `POST /api/auth/login` — needed for real login flow. Currently mocked in `useAuth.ts` with 3s timeout fallback.
3. **NestJS sessions** — `POST /api/sessions/start` + `/end` — needed to persist real session data.
4. **MobileNetV2 training** (System B) — academic contribution, needs NTHU-DDD dataset.

### Rules before touching any file
- **Never** add `tailwind.config.js`
- **Always** type Framer Motion easing as `as [number, number, number, number]`
- **Always** lazy-load R3F with `dynamic(..., { ssr: false })`
- **Always** `"use client"` on anything using hooks, browser APIs, or Zustand
- **Always** guard Shery.js in `useEffect`
- **Never** use `new AudioContext()` — use `Howler.ctx`
- Run `npx tsc --noEmit` before committing — zero TS errors required

### How to run locally
```bash
cd /Users/madhukunwar/Desktop/finalyearproject/frontend
npm run dev
```
Opens at `http://localhost:3000`. Backend not required — demo mode works fully offline.

---

## 13. Backend Status

Both services are fully specified in the docs folder but not yet built.

### Python FastAPI — Detection Service
- **Spec:** `docs/MODEL_PLAN.md`
- WS endpoint: `ws://localhost:8000/ws/detect`
- Returns `DetectionMetrics` JSON per frame
- 3 detection systems: rule-based (A), MobileNetV2 ONNX (B), meta-classifier (C)
- Calibration: first 90 frames (3s) collect EAR baseline — matches `CalibrationOverlay`
- **Not yet started** — frontend fully ready via demo mode

### NestJS — Application Backend
- **Spec:** `docs/BACKEND_API_SPEC.md`
- REST API at `http://localhost:3001/api`
- Modules: Auth, Sessions, Fleet/Drivers, Claims, Reports
- PostgreSQL — 7-year data retention (insurance compliance requirement)
- **Not yet started** — frontend mock data covers all interactions

---

## 14. Documentation Index

All technical docs live in `frontend/docs/`:

| File | Purpose | Lines |
|------|---------|-------|
| `SESSION_CONTEXT.md` | This file — full project state for session handoff | ~500 |
| `BACKEND_API_SPEC.md` | Complete REST + WebSocket API contract — every endpoint, request/response shape, DB schema, CORS config | ~900 |
| `MODEL_PLAN.md` | Detection model architecture — 3-system hybrid, signal algorithms with code, training procedure, ablation study reproduction, edge cases | ~740 |

---

## 15. FYP Submission Checklist

- [x] 5-signal multimodal detection (EAR, PERCLOS, MAR, Head Pose, Posture)
- [x] Real-time WebSocket pipeline (30fps)
- [x] Composite score fusion (weighted, EMA-smoothed)
- [x] 4-level drowsiness alert system
- [x] Demo mode (no backend required)
- [x] Driver risk bands A–F
- [x] Driver analytics dashboard
- [x] Insurer fleet portal (24 drivers, claims, risk table)
- [x] Role-based auth (driver / insurer / admin)
- [x] Shareable driver risk card
- [x] Calibration flow (3s EAR baseline)
- [x] PDF session report export (SHA-256 hash chain, react-pdf)
- [x] Evidence viewer for claims (frame grid, click-to-expand hash)
- [x] PWA / mobile support (manifest, SW, vibration, responsive)
- [x] Lighthouse ≥ 90 (metadata, ARIA, reduced-motion, error boundaries)
- [x] Backend API fully specced (`BACKEND_API_SPEC.md`)
- [x] Model plan fully specced (`MODEL_PLAN.md`)
- [ ] Python FastAPI detection backend — **NOT STARTED**
- [ ] NestJS application backend — **NOT STARTED**
- [ ] NTHU-DDD per-class confusion matrix in TechnicalSection

---

*Update this file at the end of every working session. Stale docs are worse than no docs.*

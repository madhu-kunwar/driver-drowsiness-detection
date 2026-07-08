# DrowsyShield — Frontend CLAUDE.md

This file is the single source of truth for how this frontend is built. Every decision about stack, animation, color, typography, and component usage is recorded here. Read before writing any code.

---

## Project Purpose

**Dual audience** — this frontend serves two people at once:

1. **FYP Evaluators (NCIT / Pokhara University):** Need to see the technical system working — live drowsiness detection, all 5 signals, ablation study results, real-time metrics.
2. **Motor Insurance Agencies:** Need to see commercial value — driver risk scores (A–F bands), fleet dashboard, claims evidence, premium adjustment ROI.

The landing page pitches the insurance value. The demo section shows the full technical depth. Both audiences leave impressed for different reasons.

---

## Tech Stack

| Concern | Library | Version Target |
|---------|---------|---------------|
| Framework | Next.js (App Router) | 15.x |
| Language | TypeScript | Strict mode |
| Styling | Tailwind CSS | 3.x |
| UI Components | shadcn/ui | Latest |
| 3rd-party components | 21st.dev | As needed |
| General animation | Framer Motion | 11.x |
| Scroll-driven animation | GSAP + ScrollTrigger | 3.x |
| Smooth scroll | Lenis | 1.x |
| 3D / WebGL | React Three Fiber + Drei | r164 / latest |
| Cinematic animation sequencing | Theatre.js | 0.7.x |
| JSON animation (Lottie files) | Lottie-react | Latest |
| Premium hover/image effects | Shery.js | Latest |
| Icons | Lucide React | Latest |
| Charts | Recharts | Latest |
| State management | Zustand | 5.x |
| Data fetching | TanStack Query | 5.x |
| Forms | React Hook Form + Zod | Latest |
| Dates | date-fns | Latest |
| PDF export | @react-pdf/renderer | Latest |
| Audio | Howler.js | Latest |
| Webcam | react-webcam | Latest |

---

## Color System

### Three-Color Palette Rule

**Every color decision uses only these three families. No exceptions.**

```css
/* Base — background, surfaces */
--color-base:         #1C1C1E;   /* charcoal — page background */
--color-base-soft:    #242426;   /* slightly lifted surface */
--color-base-raised:  #2C2C2E;   /* card / panel background */
--color-base-border:  #3A3A3C;   /* subtle borders */

/* Primary — brand, interactive, data-positive, safe state */
--color-primary:      #10B981;   /* emerald — CTAs, safe score, success */
--color-primary-dim:  #059669;   /* darker emerald for hover states */
--color-primary-glow: #10B98133; /* emerald glow at 20% opacity */
--color-primary-text: #6EE7B7;   /* light emerald for text on dark */

/* Accent — alerts, warnings, call-to-action highlights */
--color-accent:       #F97316;   /* coral/orange — alerts, warnings, CTA highlights */
--color-accent-dim:   #EA580C;   /* darker coral for hover */
--color-accent-glow:  #F9731633; /* coral glow at 20% opacity */
--color-accent-text:  #FED7AA;   /* light coral for text on dark */

/* Semantic overrides (use these for drowsiness levels) */
--color-alert-0:  #10B981;   /* Level 0 — Alert/Safe → primary emerald */
--color-alert-1:  #F59E0B;   /* Level 1 — Mild → amber */
--color-alert-2:  #F97316;   /* Level 2 — Warning → coral accent */
--color-alert-3:  #EF4444;   /* Level 3 — Critical → red (only time red is used) */

/* Text */
--color-text-primary:   #F5F5F7;   /* near-white for headings */
--color-text-secondary: #A1A1A6;   /* muted for body / meta */
--color-text-tertiary:  #6E6E73;   /* very muted for placeholders */
```

### Tailwind Config Extension

```js
// tailwind.config.ts
colors: {
  base: {
    DEFAULT: '#1C1C1E',
    soft:    '#242426',
    raised:  '#2C2C2E',
    border:  '#3A3A3C',
  },
  primary: {
    DEFAULT: '#10B981',
    dim:     '#059669',
    glow:    '#10B98133',
    text:    '#6EE7B7',
  },
  accent: {
    DEFAULT: '#F97316',
    dim:     '#EA580C',
    glow:    '#F9731633',
    text:    '#FED7AA',
  },
}
```

### Color Harmony Rules

- **Emerald (primary)** is for anything that means SAFE, POSITIVE, CONFIRMED, ACTIVE — safe drowsiness state, successful actions, active UI elements, chart positive trends.
- **Coral (accent)** is for anything that means WARNING, ACTION NEEDED, HIGHLIGHT — alert levels 2–3, primary CTA buttons, important numbers, badges.
- **Charcoal (base)** is all background surfaces — never use black (#000) or white (#fff) directly; use the base scale.
- **Red (#EF4444)** is used ONLY for Level 3 Critical drowsiness alerts — nowhere else.
- **Gradients:** Only emerald→primary-dim or coral→accent-dim. No rainbow gradients.

---

## Typography

### Font Families

| Role | Font | Weight |
|------|------|--------|
| Display headings (H1, H2, hero) | Syne | 700, 800 |
| Body text, labels, UI | Space Grotesk | 400, 500, 600 |
| Monospace (live metrics, scores, code) | JetBrains Mono | 400, 500 |

### Loading in Next.js

```tsx
// app/layout.tsx
import { Syne, Space_Grotesk } from 'next/font/google'
import localFont from 'next/font/local'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['700', '800'],
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space',
  weight: ['400', '500', '600'],
})
```

### Type Scale

```css
/* Use these classes — don't invent new sizes */
.text-display   { font-family: Syne; font-size: 4.5rem;  font-weight: 800; line-height: 1.05; }
.text-h1        { font-family: Syne; font-size: 3rem;    font-weight: 700; line-height: 1.1;  }
.text-h2        { font-family: Syne; font-size: 2rem;    font-weight: 700; line-height: 1.15; }
.text-h3        { font-family: Space Grotesk; font-size: 1.25rem; font-weight: 600; }
.text-body      { font-family: Space Grotesk; font-size: 1rem;    font-weight: 400; }
.text-caption   { font-family: Space Grotesk; font-size: 0.875rem; font-weight: 400; }
.text-metric    { font-family: JetBrains Mono; font-size: 2rem;   font-weight: 500; }
.text-code      { font-family: JetBrains Mono; font-size: 0.875rem; }
```

---

## Animation Philosophy

This site has **three tiers of animation**. Each tier has a specific job. Don't mix responsibilities.

### Tier 1 — Micro-interactions (Framer Motion)
Handles all in-component, state-driven animations:
- Button hover, press, focus states
- Cards appearing when they mount
- Modals, drawers sliding in
- Alert banners animating in/out
- Score number counting up
- Tab switches, accordion open/close

```tsx
// Standard motion config — use as defaults
const fadeUp = {
  initial:  { opacity: 0, y: 24 },
  animate:  { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
}

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } }
}
```

### Tier 2 — Scroll-driven storytelling (GSAP + ScrollTrigger)
Handles section reveals, parallax, and timeline scrubbing as user scrolls through the landing page:
- Hero text splitting and animating on scroll
- Feature sections pinning while content animates
- Statistics counting up as they enter viewport
- Architecture diagram drawing itself on scroll
- "How it works" horizontal scroll section

```tsx
// Always wrap GSAP in useGSAP hook (from @gsap/react) inside useEffect with proper cleanup
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// Inside component:
useGSAP(() => {
  gsap.from('.hero-text', {
    scrollTrigger: { trigger: '.hero', start: 'top 80%' },
    y: 60, opacity: 0, duration: 1, ease: 'power3.out',
  })
  return () => ScrollTrigger.getAll().forEach(t => t.kill()) // cleanup
}, [])
```

### Tier 3 — Cinematic sequences (Theatre.js)
For precisely timed, designed animation sequences that aren't scroll-driven or state-driven:
- The hero section's opening animation (camera movement, text reveal, 3D model)
- A "product overview" cinematic walkthrough
- The alert level escalation demo on the landing page

Theatre.js project files live in `/frontend/theatre/`. Never hard-code Theatre timings in component code.

### Smooth Scrolling (Lenis)
Lenis wraps the entire app for smooth inertial scrolling. Initialize once in layout, expose via context.

```tsx
// app/providers/LenisProvider.tsx
'use client'
import Lenis from 'lenis'
import { useEffect, createContext, useContext } from 'react'

// Initialize Lenis, sync with GSAP ScrollTrigger ticker
// All pages get smooth scroll automatically
```

- **Do NOT use native `scroll-behavior: smooth` anywhere** — Lenis handles it
- **Disable Lenis on the `/monitor` page** — smooth scroll interferes with live detection UX

### 3D Elements (React Three Fiber + Drei)
Used for:
- Hero section: animated 3D eye/camera mesh that rotates as the user scrolls
- Risk score visualization: 3D gauge or sphere that changes color by risk band
- Background particle field on the landing page (subtle, not distracting)

```tsx
// Always lazy-load R3F canvases — they're heavy
const HeroCanvas = dynamic(() => import('@/components/three/HeroCanvas'), {
  ssr: false,
  loading: () => <div className="hero-canvas-placeholder" />,
})
```

Keep R3F components in `/components/three/`. Never put Three.js code inside page files.

### Lottie Animations
Use for:
- Loading states (skeleton replacement for detection model initializing)
- Success/completion confirmations (session ended, report generated)
- Empty states (no sessions yet, no drivers added)
- The calibration countdown animation

```tsx
import Lottie from 'lottie-react'
import calibrationAnimation from '@/lottie/calibration.json'

<Lottie animationData={calibrationAnimation} loop={true} />
```

Lottie files live in `/frontend/public/lottie/`.

### Shery.js (Premium hover/image effects)
Use for:
- The "How it works" feature card images — magnetic hover effect
- Team/driver profile photos — ripple/distortion on hover
- Hero image/screenshot — parallax depth effect
- Landing page feature previews — shery imageEffect

```tsx
// Initialize Shery effects after component mounts (client-side only)
import { useEffect } from 'react'

useEffect(() => {
  import('sheryjs').then(({ default: Shery }) => {
    Shery.imageEffect('.feature-image', {
      style: 5,  // distortion style
      config: { uFrequencyX: { value: 14 }, uFrequencyY: { value: 14 } },
    })
    Shery.makeMagnet('.cta-button', { ease: 'cubic-bezier(0.23, 1, 0.32, 1)', duration: 1 })
  })
}, [])
```

Shery requires DOM refs — always guard with `typeof window !== 'undefined'` and use `useEffect`. Never use in SSR context.

---

## Component Guidelines

### shadcn/ui — Base Component Layer
shadcn/ui provides the structural base: Button, Dialog, Sheet, Tabs, Card, Badge, Input, Select, Slider, Switch, Tooltip, Table, DropdownMenu.

- Run `npx shadcn@latest add [component]` to add new ones — never copy-paste shadcn code manually
- **Always extend shadcn variants** — don't override styles inline. Add new variants in the component file.
- All shadcn components should use the charcoal theme (dark by default)

```tsx
// Correct — extend variant
const buttonVariants = cva('...base styles...', {
  variants: {
    variant: {
      primary: 'bg-primary text-base hover:bg-primary-dim',
      accent:  'bg-accent text-base hover:bg-accent-dim',
      ghost:   'hover:bg-base-soft text-text-secondary',
    }
  }
})
```

### 21st.dev Components
21st.dev provides premium, animated UI components. Use for:
- Animated navigation (the site header)
- Spotlight cards (feature section)
- Aurora/gradient backgrounds (hero section)
- Bento grid layouts (product feature overview)
- Animated number counters (statistics section)
- Glowing input components (insurer portal login)

Browse 21st.dev before building any complex component from scratch — it may already exist.

### Component File Structure

```
frontend/
├── app/                        # Next.js App Router pages
│   ├── layout.tsx
│   ├── page.tsx                # Landing page
│   ├── monitor/page.tsx        # Live detection
│   ├── dashboard/page.tsx      # Analytics (driver)
│   ├── sessions/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── insurer/
│   │   ├── page.tsx            # Insurer portal home
│   │   ├── fleet/[id]/page.tsx
│   │   ├── driver/[id]/page.tsx
│   │   └── claims/page.tsx
│   ├── driver/
│   │   └── risk-card/page.tsx
│   └── settings/page.tsx
├── components/
│   ├── ui/                     # shadcn primitives (auto-generated)
│   ├── three/                  # All R3F / Three.js components
│   ├── charts/                 # Recharts wrappers
│   ├── detection/              # Live monitoring components
│   ├── insurance/              # Insurer portal components
│   ├── landing/                # Landing page sections
│   └── shared/                 # Nav, Footer, etc.
├── hooks/                      # Custom hooks
├── lib/                        # Utils, API clients
├── store/                      # Zustand stores
├── lottie/                     # .json animation files
├── theatre/                    # Theatre.js project files
└── public/
    ├── fonts/
    └── assets/
```

---

## Pages & What They Must Do

### `/` — Landing Page (Most Important — Dual Audience)

Structure (scroll order):
1. **Hero** — Full viewport. "Stop Drowsy Driving Before It Kills." 3D eye mesh, live score preview, two CTAs: "Try Live Demo" + "Insurance Partners". Cinematic Theatre.js opening sequence.
2. **Problem Statement** — Animated statistics (GSAP count-up): "$109B annual cost", "50% of fatal truck crashes involve fatigue". Scroll-triggered.
3. **How It Works** — Pinned horizontal scroll section (GSAP ScrollTrigger pin). 5 cards for EAR / PERCLOS / MAR / Head Pose / Posture → each animates in.
4. **Live Demo Preview** — Pre-recorded video or live demo embed of the monitor page.
5. **Insurance Value Section** — Risk bands (A–F) shown as a visual component. "Reduce claims by 28%". Premium adjustment calculator UI.
6. **Fleet Dashboard Preview** — Screenshot of insurer portal with Shery.js image effect on hover.
7. **Accuracy / Technical Credibility** — Ablation study table (animated on scroll). "91% accuracy on NTHU-DDD benchmark."
8. **Regulatory Section** — Euro NCAP 2026, EU GSR, FMCSA HOS compliance badges.
9. **CTA Footer** — "Deploy for your fleet" with emerald button + coral glow effect.

### `/monitor` — Live Detection Page (Core Demo)

The most technically complex page. Layout:
```
┌─────────────────────────────────────────────────────┐
│  Alert Level Bar (full width — color changes live)  │
├──────────────────────────┬──────────────────────────┤
│                          │  Metrics Panel           │
│  Webcam + Canvas HUD     │  EAR, PERCLOS, MAR       │
│  (landmarks drawn)       │  Head Pose, Posture      │
│                          │  ──────────────────      │
│                          │  Score: 0.32  [MILD]     │
│                          │  Risk Band: B  ●         │
├──────────────────────────┴──────────────────────────┤
│  Composite Score Timeline (last 60 seconds)         │
└─────────────────────────────────────────────────────┘
```

Animations:
- Alert level transitions: Framer Motion color interpolation
- Score number: Framer Motion `useSpring` for smooth counting
- Alert Level 3: Full-screen red flash + Framer Motion `shake` variant

**No Lenis on this page.** Disable smooth scroll — interferes with canvas.

### `/dashboard` — Driver Analytics

Historical data visualizations. Recharts for all charts:
- Drowsiness score over time (line chart, emerald line)
- Alert frequency (bar chart, coral bars for L2/L3)
- Peak risk heatmap (hour × day-of-week, opacity = risk)
- Risk band distribution (donut chart)
- Session list table (shadcn Table with sorting)

### `/insurer` — Insurer Portal

Role-gated (insurer JWT). Fleet risk overview:
- Summary cards: total drivers, fleet risk band, L3 alerts this week, premium adjustment
- Driver risk table: sortable, filterable by band
- Risk distribution chart
- Claims investigation tool

### `/driver/risk-card` — Consumer Risk Card

Single-screen, shareable. Shows driver's current A–F grade, premium savings, session count. Designed to be screenshot-able. Emerald for A/B, coral for D/F.

---

## Theme System (Dark + Light)

Default: **Dark**. Toggle available. Use `next-themes`.

```tsx
// All colors defined as CSS variables — switch by toggling class on <html>
:root.dark  { --bg: #1C1C1E; --text: #F5F5F7; ... }
:root.light { --bg: #F5F5F7; --text: #1C1C1E; ... }
```

- Keep emerald and coral the same in both modes (they're brand colors)
- In light mode: base surfaces go to #F5F5F7, #EBEBED, #E0E0E2
- **Always test new components in both modes before merging**

---

## Animation Rules (Must Follow)

1. **Every scroll animation uses `will-change: transform`** on the element — prevents paint jank.
2. **Never animate `width` or `height`** — always use `scaleX`/`scaleY` or `clip-path`.
3. **Reduced motion:** Always wrap GSAP and Framer Motion animations with `prefers-reduced-motion` check.
4. **R3F canvas:** Always has a fallback image/div for browsers where WebGL fails.
5. **Lenis + GSAP sync:** In the Lenis tick, call `ScrollTrigger.update()` to keep them in sync.
6. **Shery.js** only runs client-side in `useEffect` — never in SSR, never in Server Components.
7. **Theatre.js** sequences are authored in the Theatre.js Studio and committed as `.theatre/` project JSON — not hand-coded.

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Lighthouse Performance | ≥ 90 |
| LCP | < 2.5s |
| CLS | < 0.1 |
| Monitor page frame send rate | 30 fps (WebSocket) |
| Detection result render | < 100ms |
| Bundle size (initial JS) | < 200KB gzipped |

- Lazy-load R3F canvas, Shery.js, and Theatre.js — they're heavy
- Recharts: import only the chart types you use (tree-shakeable)
- All images: Next.js `<Image>` with proper `sizes` prop

---

## Code Conventions

- **TypeScript strict mode** — no `any`, no `@ts-ignore`
- **Named exports** for all components, default export only for page files
- **Co-locate styles** — Tailwind classes in the component file, not a separate CSS file
- **No inline styles** except for dynamic values (e.g., CSS variables set via JS)
- **Server Components by default** — add `'use client'` only when you need hooks, events, or browser APIs
- **Zustand stores** are split by domain: `useDetectionStore`, `useSessionStore`, `useInsurerStore`
- **Never put API calls in components** — use TanStack Query hooks in `/hooks/queries/`

---

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws/detect
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_APP_NAME=DrowsyShield
```

---

## Key Third-Party Docs

- Framer Motion: https://www.framer.com/motion/
- GSAP ScrollTrigger: https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- Lenis: https://github.com/darkroomengineering/lenis
- React Three Fiber: https://docs.pmnd.rs/react-three-fiber/
- Drei: https://github.com/pmndrs/drei
- Theatre.js: https://www.theatrejs.com/docs/
- Shery.js: https://github.com/aayushchouhan24/sheryjs
- 21st.dev: https://21st.dev

---

*Last updated: June 2026 — DrowsyShield FYP + Motor Insurance Edition*

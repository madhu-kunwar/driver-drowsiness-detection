# DrowsyShield — Frontend

> The main README with full project overview, setup instructions, architecture, and documentation links is at the **repository root**: [`../README.md`](../README.md)

---

## Quick Start

```bash
npm install
cp .env.example .env.local   # or create .env.local manually
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000). No backend required — demo mode works fully offline.

### `.env.local`

```env
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws/detect
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_APP_NAME=DrowsyShield
```

### Demo credentials

| Email | Password | Role |
|-------|----------|------|
| `driver@demo.com` | `demo123` | Driver |
| `insurer@fleet.com` | `demo123` | Insurer |
| `admin@drowsyshield.com` | `demo123` | Admin |

---

## Documentation

| File | Purpose |
|------|---------|
| [`docs/SESSION_CONTEXT.md`](docs/SESSION_CONTEXT.md) | Full project state — read this at the start of every session |
| [`docs/BACKEND_API_SPEC.md`](docs/BACKEND_API_SPEC.md) | Complete REST + WebSocket API contract |
| [`docs/MODEL_PLAN.md`](docs/MODEL_PLAN.md) | Detection model architecture, training, and inference plan |
| [`WORKINGPHASE.md`](WORKINGPHASE.md) | Phase-by-phase build tracker and design decisions log |

---

## Rules (read before touching any file)

- **Never** create `tailwind.config.js` — Tailwind v4 uses `@theme` in `globals.css`
- **Always** type Framer Motion easing as `as [number, number, number, number]`
- **Always** lazy-load R3F canvases with `dynamic(..., { ssr: false })`
- **Always** add `"use client"` to anything using hooks, browser APIs, or Zustand
- **Always** guard Shery.js inside `useEffect`
- **Never** use `new AudioContext()` — use `Howler.ctx`
- **Always** run `npx tsc --noEmit` before committing — zero errors required
- Pages needing `metadata` must follow the server/client split pattern (`page.tsx` + `*Content.tsx`)

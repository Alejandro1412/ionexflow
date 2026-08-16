# Immersive Three.js Scene — Design Spec

**Date:** 2026-08-16  
**Product:** IonexFlow web (`apps/web`)  
**Status:** Approved for planning (pending user review of this file)

## Goal

Make the entire web app feel immersive and futuristic with a persistent Three.js atmosphere: a living neural field everywhere, plus a strong orbital core on the landing hero. Interaction is reactive (mouse parallax + landing scroll), without blocking form/dashboard usability.

## Decisions (locked)

| Decision | Choice |
|----------|--------|
| Scope | Entire app including dashboard (C) |
| Aesthetic | Neural network background + OrbitCore on landing only (D) |
| Interactivity | Reactive: strong cursor parallax + landing scroll transforms (B) |
| Architecture | Single global WebGL canvas + intensity by route (Approach 1) |

## Architecture

### Global canvas

- Mount a client-only `SceneCanvas` once from the root `app/layout.tsx`.
- Canvas is `position: fixed; inset: 0; z-index: 0` behind all app UI (`z-index ≥ 1`).
- Default `pointer-events: none` so forms and links remain usable.
- Landing may enable limited pointer capture on an overlay layer for parallax input without stealing clicks from CTAs (mouse position via `pointermove` on `window`, not canvas hit-testing).

### Route intensity

`SceneProvider` (or equivalent) reads the pathname and sets:

| Mode | Routes | NeuralField | OrbitCore | Camera / motion |
|------|--------|-------------|-----------|-----------------|
| `hero` | `/` | Dense, bloom-friendly | Visible, scroll-reactive | Strong mouse parallax + scroll dolly/orbit |
| `auth` | `/login`, `/signup` | Sparse/slow | Hidden | Mild mouse parallax |
| `app` | `/dashboard`, others | Calm, minimal | Hidden | Very mild / near-static |

Also respect `prefers-reduced-motion: reduce` → near-static field, no bloom thrash, no scroll camera animation.

### 3D units

1. **`NeuralField`** — points (nodes) + line segments (edges) + occasional traveling pulse along edges. Procedural / BufferGeometry; no external GLTF required for v1.
2. **`OrbitCore`** — abstract orbital geometry (rings + glowing core). Visible only in `hero` mode. Subtle idle rotation; stronger tilt from mouse; scroll increases rotation / camera approach.
3. **`CameraRig`** — lerps camera look/offset toward normalized mouse; on landing, also maps scroll progress to camera Z / core spin.

### Stack

- `three`
- `@react-three/fiber`
- `@react-three/drei` (helpers only: e.g. `Stars` optional, `Float`, effects if needed)
- Dynamic import / `next/dynamic` with `ssr: false` for the canvas tree so Next 14 App Router stays clean

### Performance constraints

- Cap `dpr` (e.g. `Math.min(devicePixelRatio, 1.75)`).
- Scale node/edge counts by mode and by coarse device heuristics (mobile = fewer nodes).
- Pause / throttle `requestAnimationFrame` work when `document.visibilityState === "hidden"`.
- Prefer one WebGL context for the whole session (no remount on client navigations).
- Avoid stacking multiple full-screen canvases.

## Visual system

### Palette (CSS tokens)

| Name | Hex | Role |
|------|-----|------|
| Void | `#05070F` | Page background |
| Fog | `#0B1220` | Elevated surfaces / glass base |
| Signal | `#3DFFF2` | Primary accent / focus / neural pulse |
| Arc | `#5B8CFF` | Secondary accent / edges |
| Ice | `#E8F1FF` | Primary text on dark |
| Alert | `#FF5C7A` | Errors / destructive |

Map into existing shadcn-style HSL variables so `bg-background`, `text-primary`, etc. read as this dark futurist system. Force dark appearance on marketing + auth + dashboard for this phase (no light theme flip required).

### Typography

- **Display:** Syne — brand wordmark and landing headlines (hero-level brand presence).
- **Body:** Manrope — UI copy, forms, dashboard.
- Load via `next/font/google` in root layout; apply CSS variables on `html`/`body`.

### UI treatment

- Glass panels: translucent `Fog` + blur + thin luminous border (Signal/Arc at low alpha).
- Landing first viewport: brand + one headline + one supporting sentence + one CTA group over the 3D plane (no card grid in hero).
- Auth cards: glass, centered, high contrast inputs, Signal focus rings.
- Dashboard: calmer glass/opaque content regions so data stays readable over the neural field.

## Per-route UX

### Landing `/`

- Full-bleed 3D as the dominant visual plane.
- Hero copy and CTAs sit above with restrained glass/text shadow for legibility.
- Scroll progresses camera/core; content below fold can exist but first viewport stays focused.

### Auth `/login`, `/signup`

- Neural field only (no OrbitCore).
- Existing form flows and server actions unchanged functionally; visual chrome updated.

### Dashboard `/dashboard`

- Calm neural atmosphere only.
- Header + main content remain interactive and readable; no competing 3D “product” object.

## File plan (`apps/web`)

| Area | Paths |
|------|--------|
| Dependencies | `package.json` (workspace web app) |
| Scene | `components/scene/scene-canvas.tsx`, `scene-provider.tsx`, `neural-field.tsx`, `orbit-core.tsx`, `camera-rig.tsx`, `index.ts` |
| Root mount | `app/layout.tsx` |
| Theme | `app/globals.css`, `tailwind.config.ts` |
| Surfaces | `app/page.tsx`, `app/(auth)/layout.tsx`, `components/auth/*`, `app/dashboard/layout.tsx`, `app/dashboard/page.tsx` |

## Non-goals (v1)

- No GLTF marketplace models / heavy asset pipeline.
- No WebXR.
- No replacing React Flow / workflow canvas (Phase 3).
- No mobile Expo Three.js work in this pass.
- No light-mode dual theme maintenance for the new look.

## Accessibility & safety

- Honor `prefers-reduced-motion`.
- Keep contrast for text/controls WCAG-friendly on glass overlays.
- Never block pointer events on form controls or primary CTAs.
- Fail soft: if WebGL unavailable, show solid Void background + UI still works.

## Success criteria

1. Every major route (`/`, `/login`, `/signup`, `/dashboard`) shows the shared neural atmosphere.
2. Landing uniquely shows OrbitCore with clear mouse + scroll reactivity.
3. Auth and dashboard remain usable (typing, submit, navigation) with no input capture bugs.
4. No second WebGL context; tab background does not burn CPU/GPU unnecessarily.
5. Visual identity is dark, signal-cyan/arc-blue futurist — not generic purple SaaS.

## Open implementation notes

- Exact bloom/postprocessing: optional; only add if frame budget allows on mid-range laptops.
- Node counts: tune during implementation; start ~120–200 nodes on desktop `hero`, ~40–80 on `app`, lower on mobile.

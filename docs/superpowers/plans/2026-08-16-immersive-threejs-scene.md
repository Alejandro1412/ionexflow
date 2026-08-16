# Immersive Three.js Scene Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Persistent futuristic Three.js neural atmosphere across the whole web app, with OrbitCore + reactive camera on landing.

**Architecture:** Single global R3F canvas in root layout; `SceneProvider` sets intensity by route; glass dark UI over the canvas.

**Tech Stack:** Next.js 14, React 18, three, @react-three/fiber, @react-three/drei, next/font (Syne + Manrope)

## Global Constraints

- One WebGL context only; `ssr: false` dynamic import
- Modes: `hero` | `auth` | `app`
- Palette: Void `#05070F`, Fog `#0B1220`, Signal `#3DFFF2`, Arc `#5B8CFF`, Ice `#E8F1FF`, Alert `#FF5C7A`
- Honor `prefers-reduced-motion`; pause when tab hidden
- Do not block form/CTA pointer events

---

### Task 1: Dependencies + theme + fonts
- [ ] Install `three` `@react-three/fiber` `@react-three/drei` `@types/three`
- [ ] Update `globals.css` + `tailwind.config.ts` + root layout fonts

### Task 2: Scene system
- [ ] `components/scene/*` — provider, canvas, neural-field, orbit-core, camera-rig
- [ ] Mount in `app/layout.tsx`

### Task 3: Surfaces
- [ ] Redesign landing, auth layout/card, dashboard chrome for glass dark UI

### Task 4: Verify
- [ ] App loads on `/`, `/login`, `/dashboard` without runtime errors

# Full Product Implementation Plan (Phases 2–5)

**Goal:** Make IonexFlow end-to-end usable: billing, visual workflows, execution engine, mobile approvals.

**Architecture:** Extend existing Next.js + Supabase schema. Stripe when keys exist; local “Activate Pro” when not. Graph runner walks React Flow nodes server-side. Mobile shares Supabase auth + Realtime on `approvals`.

**Tech:** stripe, @xyflow/react, existing Supabase tables

## Tasks
1. Phase 2 — billing lib, pricing, checkout/webhook/dev activate, paywall
2. Phase 3 — workflow CRUD + React Flow editor
3. Phase 4 — runner + run/resume + execution logs UI
4. Phase 5 — mobile login + Realtime inbox
5. Docs + smoke verify

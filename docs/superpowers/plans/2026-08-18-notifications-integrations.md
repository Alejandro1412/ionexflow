# Plan: Notifications + Integrations

Date: 2026-08-18  
Spec: `docs/superpowers/specs/2026-08-18-notifications-integrations-design.md`

## Tasks (completed)

1. Migration `notifications` + RLS + Realtime
2. `lib/notifications/notify.ts` (in-app + Resend)
3. Hook after approval insert (executions + approvals resume)
4. Bell UI + `/dashboard/notifications`
5. Engine nodes `http` / `slack` / `webhook` + canvas inspector
6. Template `content-publish`
7. Docs + `.env.example`

## Verify

1. `npx supabase migration up --local`
2. Run workflow with Approval → see bell badge
3. Approve → with Slack URL (or failOnError=false) continue
4. Optional: set `RESEND_API_KEY` and confirm email

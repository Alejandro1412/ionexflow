# IonexFlow — Mobile Companion (Expo)

Phase 1 scope: monorepo wiring only — Expo Router skeleton and a Supabase
client (`lib/supabase.ts`) pointed at the **same** Supabase project as
`apps/web`, so auth state and RLS policies are shared from day one.

Not implemented yet (Phase 5):
- Login screen backed by `supabase.auth.signInWithPassword` / OAuth
- Realtime subscription to `public.approvals` (`status = 'pending'`)
- Approve / Reject actions writing back to `workflow_executions`
- Push notifications for high-risk actions

## Local dev

```bash
cp .env.example .env
pnpm --filter mobile dev
```

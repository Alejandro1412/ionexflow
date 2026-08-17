# IonexFlow Companion (mobile)

Expo app for human-in-the-loop **approvals**.

## Setup

```bash
cp apps/mobile/.env.example apps/mobile/.env
# Same Supabase URL/anon key as web
# EXPO_PUBLIC_API_URL=http://localhost:3000
# On a physical device, use your PC LAN IP instead of localhost
pnpm dev:mobile
```

## Flows

1. Sign in with the same email/password as the web app
2. See pending `approvals` (Realtime)
3. Approve / Reject → calls `POST /api/approvals/resolve` which resumes the execution engine

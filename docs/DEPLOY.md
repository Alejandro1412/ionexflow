# Deploy IonexFlow to production (Vercel + Supabase Cloud + Stripe)

Goal: public URL where a customer can sign up, pay with Stripe, and use the product.

**Current production deploy:** https://ionexflow.vercel.app  
**Vercel project:** `alejandro-polanco-andrades-projects/ionexflow` (Root Directory `apps/web`)  
**Supabase project ref:** `aevtnrpjgrseupxhllec` → `https://aevtnrpjgrseupxhllec.supabase.co`

After creating Supabase Cloud + filling keys:

```powershell
copy .env.vercel.production.example .env.vercel.production
# edit .env.vercel.production with real keys
powershell -File scripts/push-vercel-prod-env.ps1
npx vercel --prod --yes --scope alejandro-polanco-andrades-projects
```

One-shot schema (SQL Editor): paste `scripts/prod-all-migrations.sql`  
Auth Site URL must be `https://ionexflow.vercel.app`

## Architecture

| Piece | Service |
|-------|---------|
| Web app (`apps/web`) | [Vercel](https://vercel.com) |
| Auth + DB + Realtime | [Supabase Cloud](https://supabase.com) |
| Billing | [Stripe](https://stripe.com) Checkout + webhooks |
| LLM (optional but recommended) | OpenAI and/or Anthropic |
| Transactional email (optional) | Resend |

Local Docker Supabase is for development only. Production must use a Supabase project.

---

## 1. Supabase Cloud

1. Create a project at https://supabase.com/dashboard
2. Copy **Project URL**, **anon key**, and **service_role key**
3. Apply migrations from this repo:

```bash
cd ionexflow
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

4. Auth → URL configuration:
   - Site URL: `https://YOUR_DOMAIN`
   - Redirect URLs: `https://YOUR_DOMAIN/**` and `https://YOUR_DOMAIN/auth/callback` (if used)
5. (Optional) Google OAuth:
   - Auth → Providers → Google → Enable
   - Client ID / Secret from repo root `.env` (`GOOGLE_OAUTH_*`)
   - In Google Cloud → Credentials → Authorized redirect URIs add:
     `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
   - On Vercel set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` and redeploy

---

## 2. Stripe (production)

1. Create a Product + recurring Price in Stripe Dashboard → copy `price_...`
2. Developers → API keys → copy **Secret key** (`sk_live_...` or `sk_test_...`) and **Publishable key** (`pk_...`)
3. Developers → Webhooks → Add endpoint:
   - URL: `https://YOUR_DOMAIN/api/stripe/webhook`
   - Events:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.paid`
   - Copy **Signing secret** → `STRIPE_WEBHOOK_SECRET` (`whsec_...`)
4. Enable Customer Portal: Settings → Billing → Customer portal

**Important:** `Activate Pro (dev)` is **disabled in production** automatically (`NODE_ENV` / `VERCEL_ENV`). Do not set `ALLOW_DEV_BILLING_BYPASS=true` on Vercel.

---

## 3. Vercel

1. Import the GitHub repo into Vercel
2. Set **Root Directory** to `apps/web` (monorepo)
3. Framework: Next.js (uses `apps/web/vercel.json`)
4. Environment variables (Production + Preview as needed):

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=https://YOUR_DOMAIN

# Cron (call GET /api/cron/tick every 5m)
# Hobby Vercel: use an external cron (cron-job.org) with header:
#   Authorization: Bearer $CRON_SECRET
# Pro Vercel: you can add crons in vercel.json
CRON_SECRET=

STRIPE_SECRET_KEY=
STRIPE_PRICE_ID=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Recommended
OPENAI_API_KEY=
# or ANTHROPIC_API_KEY=

# Optional
RESEND_API_KEY=
RESEND_FROM=IonexFlow <billing@yourdomain.com>
EMAIL_INBOUND_SECRET=
```

5. Deploy
6. Point your domain to Vercel; set `NEXT_PUBLIC_SITE_URL` to that domain
7. Re-check Stripe webhook URL matches the final domain

---

## 4. Smoke test (prod)

1. Open `https://YOUR_DOMAIN` → Sign up
2. Confirm org is on `trial` and dashboard works
3. Billing → **Upgrade with Stripe Checkout** (use Stripe test card `4242…` if on test mode)
4. After success, plan should become `active` (sync from Checkout session + webhook)
5. Customer portal opens for the Stripe customer
6. Confirm `Activate Pro (dev)` is **not** shown

---

## 5. Local Stripe webhook (optional while developing)

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Put the CLI `whsec_...` into `apps/web/.env.local` as `STRIPE_WEBHOOK_SECRET`.

---

## 6. Security checklist

- [ ] `SUPABASE_SERVICE_ROLE_KEY` only on server (Vercel env), never `NEXT_PUBLIC_`
- [ ] No `ALLOW_DEV_BILLING_BYPASS` in Production
- [ ] Stripe live keys only on Production; use test keys on Preview if desired
- [ ] RLS migrations applied (`email_connections` passwords protected by org RLS — rotate if leaked)
- [ ] `NEXT_PUBLIC_SITE_URL` matches the real HTTPS domain (Checkout success/cancel URLs)

---

## 7. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Checkout works but plan stays `trial` | Webhook URL/secret wrong; or refresh — success page also syncs via `session_id` |
| “Stripe is not configured” | Missing one of `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| Portal button missing | Complete one Checkout so `stripe_customer_id` is saved |
| Auth redirect errors | Supabase Site URL + Google redirect must match prod hosts |
| Build fails on Vercel | Root Directory = `apps/web`; install from monorepo root via `vercel.json` |

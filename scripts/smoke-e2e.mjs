/**
 * Local smoke test — reads apps/web/.env.local
 * Run: node scripts/smoke-e2e.mjs
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(resolve(root, "apps/web/package.json"));
const { createClient } = require("@supabase/supabase-js");
const envPath = resolve(root, "apps/web/.env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
const site = env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const results = [];
const ok = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} | ${name}${detail ? ` — ${detail}` : ""}`);
};

const email = `e2e_${Date.now()}@test.local`;
const password = "password123";
const sb = createClient(url, anon);
const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: sign, error: signErr } = await sb.auth.signUp({
  email,
  password,
  options: { data: { full_name: "E2E Tester", org_name: "E2E Org" } },
});
ok("Auth signup email/password", !signErr && !!sign.user, signErr?.message || sign.user?.id);

await new Promise((r) => setTimeout(r, 600));
const { data: profile, error: pErr } = await sb
  .from("profiles")
  .select("*, organizations(*)")
  .eq("id", sign.user.id)
  .single();
ok(
  "Trigger creates profile+org",
  !pErr && !!profile?.organizations,
  pErr?.message || `${profile?.organizations?.name} / ${profile?.organizations?.plan_status}`
);

const nodes = [
  { id: "start-1", type: "workflow", position: { x: 0, y: 0 }, data: { label: "Start", type: "start" } },
  {
    id: "agent-1",
    type: "workflow",
    position: { x: 200, y: 0 },
    data: { label: "Agent", type: "agent", prompt: "test" },
  },
  {
    id: "approval-1",
    type: "workflow",
    position: { x: 400, y: 0 },
    data: { label: "Approval", type: "approval", message: "OK?" },
  },
  { id: "end-1", type: "workflow", position: { x: 600, y: 0 }, data: { label: "End", type: "end" } },
];
const edges = [
  { id: "e1", source: "start-1", target: "agent-1" },
  { id: "e2", source: "agent-1", target: "approval-1" },
  { id: "e3", source: "approval-1", target: "end-1" },
];

const { data: wf, error: wfErr } = await sb
  .from("workflows")
  .insert({
    org_id: profile.org_id,
    name: "E2E Flow",
    nodes,
    edges,
    is_active: true,
    created_by: sign.user.id,
  })
  .select("*")
  .single();
ok("Create workflow", !wfErr && !!wf, wfErr?.message || wf?.id);

const { data: ex, error: exErr } = await sb
  .from("workflow_executions")
  .insert({
    workflow_id: wf.id,
    org_id: profile.org_id,
    status: "paused",
    trigger_payload: { input: "e2e" },
    logs: [
      {
        at: new Date().toISOString(),
        nodeId: "agent-1",
        level: "info",
        message: "ran",
      },
    ],
    started_at: new Date().toISOString(),
  })
  .select("*")
  .single();
ok("Create execution", !exErr && !!ex, exErr?.message || ex?.status);

const { data: appr, error: aErr } = await sb
  .from("approvals")
  .insert({
    execution_id: ex.id,
    org_id: profile.org_id,
    node_id: "approval-1",
    status: "pending",
    requested_by: sign.user.id,
    payload: { label: "Approval", message: "OK?" },
  })
  .select("*")
  .single();
ok("Create pending approval", !aErr && !!appr, aErr?.message || appr?.status);

const token = (await sb.auth.getSession()).data.session?.access_token;
const res = await fetch(`${site}/api/approvals/resolve`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ approvalId: appr.id, decision: "approved" }),
});
const body = await res.json().catch(() => ({}));
ok("API resolve approval resumes engine", res.ok, `${res.status} ${JSON.stringify(body)}`);

const { data: ex2 } = await sb
  .from("workflow_executions")
  .select("status")
  .eq("id", ex.id)
  .single();
ok("Execution completed after approve", ex2?.status === "completed", ex2?.status);

const { error: billErr } = await admin
  .from("organizations")
  .update({ plan_status: "active" })
  .eq("id", profile.org_id);
ok("Billing plan update (Activate Pro path)", !billErr, billErr?.message || "active");

for (const path of ["/", "/login", "/signup", "/pricing"]) {
  const r = await fetch(`${site}${path}`);
  ok(`Page ${path}`, r.status === 200, String(r.status));
}
for (const path of ["/dashboard", "/dashboard/workflows", "/dashboard/billing"]) {
  const r = await fetch(`${site}${path}`, { redirect: "manual" });
  ok(
    `Protected ${path} redirects unauth`,
    r.status === 307 || r.status === 302 || r.status === 303,
    String(r.status)
  );
}

ok(
  "Google OAuth configured",
  Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET),
  "Needs GOOGLE_OAUTH_CLIENT_ID/SECRET + Supabase restart"
);
ok(
  "Stripe Checkout configured",
  Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_ID && env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
  "Empty STRIPE_* → use Activate Pro (dev)"
);

const failed = results.filter((r) => !r.pass);
console.log(
  `\nSUMMARY: ${results.filter((r) => r.pass).length}/${results.length} passed, ${failed.length} gaps`
);
process.exit(failed.some((f) => !f.name.includes("Google") && !f.name.includes("Stripe")) ? 1 : 0);

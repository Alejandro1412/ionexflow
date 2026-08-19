import Link from "next/link";
import { redirect } from "next/navigation";
import {
  disconnectMailbox,
  updateEmailConnectionSettings,
} from "@/actions/email";
import {
  disconnectWhatsApp,
  updateWhatsAppSettings,
} from "@/actions/whatsapp";
import { createWorkflowFromTemplate } from "@/actions/workflows";
import {
  ConnectMailboxForm,
  SyncMailboxButton,
} from "@/components/email/connect-mailbox-form";
import { ConnectWhatsAppForm } from "@/components/whatsapp/connect-whatsapp-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionProfile } from "@/lib/org";
import { hasProductAccess } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";

function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export default async function IntegrationsPage() {
  const session = await getSessionProfile();
  if (!session?.user) redirect("/login");
  if (!hasProductAccess(session.org?.plan_status)) {
    redirect("/dashboard/billing?paywall=1");
  }

  const supabase = await createClient();
  const [
    { data: connections },
    { data: workflows },
    { data: recentMail },
    { data: waConnections },
  ] = await Promise.all([
    supabase
      .from("email_connections")
      .select(
        "id, provider, status, display_name, email_address, inbound_token, default_workflow_id, forward_to, last_synced_at, last_error, imap_host, smtp_host, connected_at, auto_sync"
      )
      .eq("org_id", session.org!.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("workflows")
      .select("id, name")
      .eq("org_id", session.org!.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("email_messages")
      .select("id, direction, from_address, subject, status, created_at")
      .eq("org_id", session.org!.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("whatsapp_connections")
      .select(
        "id, status, display_name, phone_number_id, verify_token, inbound_token, default_workflow_id, last_error, connected_at"
      )
      .eq("org_id", session.org!.id)
      .order("created_at", { ascending: true }),
  ]);

  const active =
    (connections ?? []).find((c) => c.status === "active") ||
    (connections ?? [])[0];
  const waActive =
    (waConnections ?? []).find((c) => c.status === "active") ||
    (waConnections ?? [])[0];
  const webhookUrl = `${siteUrl()}/api/whatsapp/webhook`;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <p className="font-display text-sm font-semibold uppercase tracking-[0.28em] text-signal">
          Integrations
        </p>
        <h1 className="mt-1 font-display text-4xl font-bold tracking-tight glow-text">
          Email automation
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Connect any institutional mailbox with real IMAP + SMTP. Ionex pulls
          new mail, classifies it, drafts replies, redirects sensitive threads,
          and sends only after human approval when needed.
        </p>
      </div>

      <Card className="border-signal/30">
        <CardHeader>
          <CardTitle>Connect mailbox (live)</CardTitle>
          <CardDescription>
            We verify IMAP and SMTP before saving. Works with Gmail (app
            password), Microsoft 365, Zoho, cPanel, and custom servers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectMailboxForm workflows={workflows ?? []} />
        </CardContent>
      </Card>

      {active ? (
        <Card
          className={
            active.status === "active"
              ? "border-signal/40 bg-signal/[0.03]"
              : "border-amber-400/30"
          }
        >
          <CardHeader>
            <CardTitle>
              {active.display_name} · {active.email_address}
            </CardTitle>
            <CardDescription>
              Status: {active.status}
              {active.imap_host ? ` · IMAP ${active.imap_host}` : ""}
              {active.smtp_host ? ` · SMTP ${active.smtp_host}` : ""}
              {active.last_synced_at
                ? ` · Last sync ${new Date(active.last_synced_at).toLocaleString()}`
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {active.last_error ? (
              <p className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {active.last_error}
              </p>
            ) : null}

            <form
              action={updateEmailConnectionSettings}
              className="grid gap-4 sm:grid-cols-2"
            >
              <input type="hidden" name="connectionId" value={active.id} />
              <div className="flex flex-col gap-1 sm:col-span-2">
                <Label>Inbox address</Label>
                <Input
                  name="emailAddress"
                  defaultValue={active.email_address ?? ""}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Default automation workflow</Label>
                <select
                  name="workflowId"
                  defaultValue={active.default_workflow_id ?? ""}
                  className="h-10 rounded-md border border-white/10 bg-black/40 px-2 text-sm"
                >
                  <option value="">Select workflow…</option>
                  {(workflows ?? []).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label>Redirect / escalate to</Label>
                <Input
                  name="forwardTo"
                  defaultValue={active.forward_to ?? ""}
                  placeholder="legal@tuempresa.com"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
                <input
                  type="checkbox"
                  name="autoSync"
                  defaultChecked={
                    (active as { auto_sync?: boolean }).auto_sync !== false
                  }
                />
                Auto-sync inbox every 5 minutes (cron)
              </label>
              <div className="sm:col-span-2 flex flex-wrap gap-3">
                <Button type="submit">Save routing</Button>
              </div>
            </form>

            <form
              action={async () => {
                "use server";
                await disconnectMailbox(active.id);
              }}
            >
              <Button type="submit" variant="outline">
                Disconnect
              </Button>
            </form>

            {active.status === "active" ? (
              <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                <h3 className="font-display text-sm font-semibold">
                  Pull mail from IMAP
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Fetches unseen inbox messages and starts your linked workflow
                  for each one (AI triage → reply / approval / redirect).
                </p>
                <div className="mt-3">
                  <SyncMailboxButton connectionId={active.id} />
                </div>
              </div>
            ) : null}

            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Optional inbound webhook
              </p>
              <p className="mt-1 font-mono text-xs text-signal break-all">
                {siteUrl()}/api/email/inbound
              </p>
              <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                token: {active.inbound_token}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/25 p-4 text-sm text-muted-foreground">
              <p className="font-display text-sm font-semibold text-foreground">
                Playbook incluido (listo para usar)
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed">
                <li>
                  <strong className="text-foreground">auto_reply</strong> — horario,
                  reset de acceso, FAQ, precios públicos
                </li>
                <li>
                  <strong className="text-foreground">needs_human</strong> — enojo,
                  reembolsos, Enterprise, legal → borrador + Approvals
                </li>
                <li>
                  <strong className="text-foreground">redirect</strong> — ventas,
                  legal, billing → reenvío al email de escalado
                </li>
              </ul>
              <p className="mt-2 text-xs">
                Crea el workflow abajo, selecciónalo en Default workflow, y listo.
                Si quieres cambiar tono o hechos de marca, edita los nodos Agent en
                el canvas.
              </p>
            </div>

            <form
              action={async () => {
                "use server";
                await createWorkflowFromTemplate("support-email");
              }}
            >
              <Button type="submit" variant="outline">
                Create Support email workflow
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>WhatsApp Business (Meta Cloud API)</CardTitle>
          <CardDescription>
            Canal principal para LATAM: mensajes entrantes disparan un workflow;
            el nodo WhatsApp envía respuestas (idealmente tras Approval).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {waActive?.status === "active" ? (
            <div className="space-y-3 rounded-lg border border-signal/30 bg-signal/5 p-4 text-sm">
              <p>
                <span className="font-semibold">{waActive.display_name}</span> ·{" "}
                {waActive.phone_number_id}
              </p>
              <p className="text-xs text-muted-foreground">
                Webhook URL: <code className="text-signal">{webhookUrl}</code>
              </p>
              <p className="text-xs text-muted-foreground">
                Verify token:{" "}
                <code className="text-signal">{waActive.verify_token}</code>
              </p>
              <form action={updateWhatsAppSettings} className="flex flex-wrap gap-3">
                <input type="hidden" name="connectionId" value={waActive.id} />
                <select
                  name="workflowId"
                  defaultValue={waActive.default_workflow_id ?? ""}
                  className="rounded-md border border-white/10 bg-black/40 px-2 py-2 text-sm"
                >
                  <option value="">— workflow —</option>
                  {(workflows ?? []).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                <Button type="submit" size="sm" variant="outline">
                  Save routing
                </Button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await disconnectWhatsApp(waActive.id);
                }}
              >
                <Button type="submit" size="sm" variant="outline">
                  Disconnect
                </Button>
              </form>
              {waActive.last_error ? (
                <p className="text-amber-200">{waActive.last_error}</p>
              ) : null}
            </div>
          ) : (
            <ConnectWhatsAppForm workflows={workflows ?? []} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent mail activity</CardTitle>
          <CardDescription>Real inbound / outbound audit</CardDescription>
        </CardHeader>
        <CardContent>
          {(recentMail ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No messages yet. Connect a mailbox and run Sync inbox now.
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {(recentMail ?? []).map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{m.subject ?? "(no subject)"}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.direction} · {m.from_address ?? "—"} · {m.status}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(m.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Also available in{" "}
        <Link href="/dashboard/automations" className="text-signal">
          AI Automations → Support email inbox
        </Link>
      </p>
    </div>
  );
}

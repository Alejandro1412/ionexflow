import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  resumeWaitingExecution,
  startWorkflowRun,
} from "@/lib/engine/start-run";
import { fetchUnseenMail } from "@/lib/email/imap";
import { rowToCredentials } from "@/lib/email/send";

function authorizeCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header =
    request.headers.get("authorization") ||
    request.headers.get("x-cron-secret") ||
    "";
  if (header === `Bearer ${secret}`) return true;
  if (header === secret) return true;
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET> when configured
  return false;
}

async function runTick() {
  const admin = createServiceRoleClient();
  const summary = {
    resumedDelays: 0,
    emailSynced: 0,
    scheduledRuns: 0,
    errors: [] as string[],
  };

  // 1) Resume delays
  const { data: waiting } = await admin
    .from("workflow_executions")
    .select("id")
    .eq("status", "paused")
    .not("waiting_node_id", "is", null)
    .lte("resume_at", new Date().toISOString())
    .limit(25);

  for (const row of waiting ?? []) {
    try {
      const r = await resumeWaitingExecution(admin, row.id);
      if (!r.skipped) summary.resumedDelays += 1;
    } catch (error) {
      summary.errors.push(
        `delay ${row.id}: ${error instanceof Error ? error.message : "fail"}`
      );
    }
  }

  // 2) Email auto-sync
  const { data: mailboxes } = await admin
    .from("email_connections")
    .select("*")
    .eq("status", "active")
    .eq("auto_sync", true)
    .not("default_workflow_id", "is", null)
    .limit(20);

  for (const connection of mailboxes ?? []) {
    try {
      const credentials = rowToCredentials(connection);
      if (!credentials) continue;
      const fetched = await fetchUnseenMail(credentials, 10);
      if (!fetched.ok) {
        await admin
          .from("email_connections")
          .update({ last_error: fetched.error, status: "error" })
          .eq("id", connection.id);
        summary.errors.push(`imap ${connection.id}: ${fetched.error}`);
        continue;
      }

      for (const mail of fetched.messages) {
        const triggerPayload = {
          input: `Email from ${mail.from}\nSubject: ${mail.subject}\n\n${mail.body}`,
          channel: "email",
          startedBy: "cron-imap",
          orgId: connection.org_id,
          emailConnectionId: connection.id,
          email: {
            from: mail.from,
            to: mail.to,
            subject: mail.subject,
            body: mail.body,
            threadId: mail.messageId,
            forwardTo: connection.forward_to,
          },
          from: mail.from,
          subject: mail.subject,
          body: mail.body,
          to: connection.forward_to ?? "",
        };

        const { data: message } = await admin
          .from("email_messages")
          .insert({
            org_id: connection.org_id,
            connection_id: connection.id,
            direction: "inbound",
            from_address: mail.from,
            to_address: mail.to,
            subject: mail.subject,
            body_text: mail.body,
            thread_id: mail.messageId,
            status: "received",
            meta: { uid: mail.uid, source: "cron-imap" },
          })
          .select("id")
          .single();

        const { executionId } = await startWorkflowRun(admin, {
          orgId: connection.org_id,
          workflowId: connection.default_workflow_id!,
          triggerPayload,
        });

        if (message?.id) {
          await admin
            .from("email_messages")
            .update({ execution_id: executionId, status: "processed" })
            .eq("id", message.id);
        }
        summary.emailSynced += 1;
      }

      await admin
        .from("email_connections")
        .update({
          last_synced_at: new Date().toISOString(),
          last_error: null,
          status: "active",
        })
        .eq("id", connection.id);
    } catch (error) {
      summary.errors.push(
        `mailbox ${connection.id}: ${
          error instanceof Error ? error.message : "fail"
        }`
      );
    }
  }

  // 3) Scheduled workflows
  const { data: scheduled } = await admin
    .from("workflows")
    .select("id, org_id, schedule_every_minutes, last_scheduled_at")
    .eq("is_active", true)
    .eq("schedule_enabled", true)
    .not("schedule_every_minutes", "is", null)
    .limit(50);

  const now = Date.now();
  for (const wf of scheduled ?? []) {
    try {
      const every = Number(wf.schedule_every_minutes);
      if (!every || every < 5) continue;
      const last = wf.last_scheduled_at
        ? new Date(wf.last_scheduled_at).getTime()
        : 0;
      if (now - last < every * 60_000) continue;

      await startWorkflowRun(admin, {
        orgId: wf.org_id,
        workflowId: wf.id,
        triggerPayload: {
          input: "Scheduled run",
          channel: "schedule",
          startedBy: "cron",
          orgId: wf.org_id,
        },
      });
      await admin
        .from("workflows")
        .update({ last_scheduled_at: new Date().toISOString() })
        .eq("id", wf.id);
      summary.scheduledRuns += 1;
    } catch (error) {
      summary.errors.push(
        `schedule ${wf.id}: ${error instanceof Error ? error.message : "fail"}`
      );
    }
  }

  return summary;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await runTick();
  return Response.json({ ok: true, ...summary });
}

export async function POST(request: Request) {
  return GET(request);
}

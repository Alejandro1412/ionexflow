import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  resumeWaitingExecution,
  startWorkflowRun,
} from "@/lib/engine/start-run";
import { fetchUnseenMail } from "@/lib/email/imap";
import { rowToCredentials } from "@/lib/email/send";
import {
  allowRateLimit,
  clientIpFromRequest,
} from "@/lib/security/rate-limit";
import { escalateDueApprovals } from "@/lib/approvals/escalate";

function authorizeCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header =
    request.headers.get("authorization") ||
    request.headers.get("x-cron-secret") ||
    "";
  if (header === `Bearer ${secret}`) return true;
  if (header === secret) return true;
  return false;
}

async function runTick() {
  const admin = createServiceRoleClient();
  const summary = {
    resumedDelays: 0,
    emailSynced: 0,
    scheduledRuns: 0,
    reapedStuck: 0,
    escalatedApprovals: 0,
    errors: [] as string[],
  };

  // 0) Reap zombie running executions (hung / timed-out workers)
  try {
    const { data: reaped, error: reapError } = await admin.rpc(
      "reap_stuck_running_executions",
      { p_minutes: 15 }
    );
    if (reapError) {
      summary.errors.push(`reaper: ${reapError.message}`);
    } else {
      summary.reapedStuck = (reaped as unknown[] | null)?.length ?? 0;
    }
  } catch (error) {
    summary.errors.push(
      `reaper: ${error instanceof Error ? error.message : "fail"}`
    );
  }

  // 0b) Approval SLA escalations
  try {
    const esc = await escalateDueApprovals(admin);
    summary.escalatedApprovals = esc.escalated;
    summary.errors.push(...esc.errors.map((e) => `sla: ${e}`));
  } catch (error) {
    summary.errors.push(
      `sla: ${error instanceof Error ? error.message : "fail"}`
    );
  }

  // 1) Atomically claim due delays, then resume
  try {
    const { data: claimed, error: claimError } = await admin.rpc(
      "claim_due_delay_executions",
      { p_limit: 25 }
    );
    if (claimError) {
      summary.errors.push(`claim delays: ${claimError.message}`);
    } else {
      for (const row of claimed ?? []) {
        try {
          const r = await resumeWaitingExecution(admin, row.id, {
            alreadyClaimed: true,
          });
          if (!r.skipped) summary.resumedDelays += 1;
        } catch (error) {
          summary.errors.push(
            `delay ${row.id}: ${
              error instanceof Error ? error.message : "fail"
            }`
          );
        }
      }
    }
  } catch (error) {
    summary.errors.push(
      `claim delays: ${error instanceof Error ? error.message : "fail"}`
    );
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

  // 3) Atomically claim due schedules (sets last_scheduled_at)
  try {
    const { data: scheduled, error: schedError } = await admin.rpc(
      "claim_due_schedules",
      { p_limit: 50 }
    );
    if (schedError) {
      summary.errors.push(`claim schedules: ${schedError.message}`);
    } else {
      for (const wf of scheduled ?? []) {
        try {
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
          summary.scheduledRuns += 1;
        } catch (error) {
          summary.errors.push(
            `schedule ${wf.id}: ${
              error instanceof Error ? error.message : "fail"
            }`
          );
        }
      }
    }
  } catch (error) {
    summary.errors.push(
      `claim schedules: ${error instanceof Error ? error.message : "fail"}`
    );
  }

  return summary;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = clientIpFromRequest(request);
  if (!allowRateLimit(`cron:${ip}`, { limit: 30, windowMs: 60_000 })) {
    return Response.json({ error: "Rate limited" }, { status: 429 });
  }

  const summary = await runTick();
  return Response.json({ ok: true, ...summary });
}

export async function POST(request: Request) {
  return GET(request);
}

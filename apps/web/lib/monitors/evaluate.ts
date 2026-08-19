export type MonitorRow = {
  id: string;
  org_id: string;
  name: string;
  kind: string;
  metric_value: number | string;
  operator: string;
  threshold: number | string;
  window_hours: number;
  workflow_id: string | null;
  notify_message: string | null;
  last_triggered_at: string | null;
};

function compare(op: string, left: number, right: number) {
  switch (op) {
    case "gt":
      return left > right;
    case "gte":
      return left >= right;
    case "lt":
      return left < right;
    case "lte":
      return left <= right;
    case "eq":
      return left === right;
    default:
      return left >= right;
  }
}

export async function evaluateMonitorValue(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: { from: (t: string) => any },
  monitor: MonitorRow
): Promise<{ value: number; triggered: boolean }> {
  const threshold = Number(monitor.threshold);
  const op = monitor.operator || "gte";
  const windowHours = Math.max(1, Number(monitor.window_hours) || 168);
  const since = new Date(Date.now() - windowHours * 3600_000).toISOString();

  let value = Number(monitor.metric_value) || 0;

  if (monitor.kind === "failed_executions") {
    const { count } = await admin
      .from("workflow_executions")
      .select("id", { count: "exact", head: true })
      .eq("org_id", monitor.org_id)
      .eq("status", "failed")
      .gte("created_at", since);
    value = count ?? 0;
  } else if (monitor.kind === "rejected_approvals") {
    const { count } = await admin
      .from("approvals")
      .select("id", { count: "exact", head: true })
      .eq("org_id", monitor.org_id)
      .eq("status", "rejected")
      .gte("created_at", since);
    value = count ?? 0;
  }

  // Cooldown: don't re-fire within one check window if already triggered recently
  let cooled = false;
  if (monitor.last_triggered_at) {
    const ageMs = Date.now() - new Date(monitor.last_triggered_at).getTime();
    const checkMs = 5 * 60_000;
    if (ageMs < checkMs) cooled = true;
  }

  const triggered = !cooled && compare(op, value, threshold);
  return { value, triggered };
}

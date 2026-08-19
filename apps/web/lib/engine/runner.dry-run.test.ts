import { describe, expect, it } from "vitest";
import { runWorkflowGraph } from "@/lib/engine/runner";
import type { FlowEdge, FlowNode } from "@/lib/workflow/types";

describe("runWorkflowGraph dryRun", () => {
  it("stubs outbound side effects and skips delays", async () => {
    const nodes: FlowNode[] = [
      {
        id: "start",
        position: { x: 0, y: 0 },
        data: { type: "start", label: "Start" },
      },
      {
        id: "delay-1",
        position: { x: 0, y: 0 },
        data: { type: "delay", label: "Wait", waitMinutes: 60 },
      },
      {
        id: "slack-1",
        position: { x: 0, y: 0 },
        data: {
          type: "slack",
          label: "Notify",
          url: "https://hooks.slack.com/services/TEST",
          message: "hello",
        },
      },
      {
        id: "end",
        position: { x: 0, y: 0 },
        data: { type: "end", label: "End" },
      },
    ];
    const edges: FlowEdge[] = [
      { id: "a", source: "start", target: "delay-1" },
      { id: "b", source: "delay-1", target: "slack-1" },
      { id: "c", source: "slack-1", target: "end" },
    ];

    const result = await runWorkflowGraph({
      nodes,
      edges,
      dryRun: true,
      triggerPayload: { input: "test", orgId: "org" },
    });

    expect(result.kind).toBe("completed");
    if (result.kind !== "completed") return;
    const messages = result.logs.map((l) => l.message).join("\n");
    expect(messages).toMatch(/delay .* skipped/i);
    expect(messages).toMatch(/\[dry-run\] would SLACK/i);
    expect(messages).not.toMatch(/Waiting \d+ minute/);
  });
});

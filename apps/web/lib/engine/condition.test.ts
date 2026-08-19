import { describe, expect, it } from "vitest";
import { evaluateCondition } from "@/lib/engine/condition";

describe("evaluateCondition", () => {
  it("compares numbers with gt", () => {
    const r = evaluateCondition({
      leftRaw: "{{amount}}",
      op: "gt",
      rightRaw: "1000",
      vars: { amount: "1500" },
    });
    expect(r.route).toBe("true");
    expect(r.ok).toBe(true);
  });

  it("supports contains without LLM", () => {
    const r = evaluateCondition({
      leftRaw: "{{trigger}}",
      op: "contains",
      rightRaw: "urgente",
      vars: { trigger: "Ticket URGENTE del cliente" },
    });
    expect(r.route).toBe("true");
  });

  it("routes false when equality fails", () => {
    const r = evaluateCondition({
      leftRaw: "{{status}}",
      op: "eq",
      rightRaw: "open",
      vars: { status: "closed" },
    });
    expect(r.route).toBe("false");
  });
});

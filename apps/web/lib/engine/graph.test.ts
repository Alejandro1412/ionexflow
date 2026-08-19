import { describe, expect, it } from "vitest";
import { nextNodeId } from "@/lib/engine/graph";
import type { FlowEdge } from "@/lib/workflow/types";

const edges: FlowEdge[] = [
  { id: "e1", source: "start", target: "agent-1" },
  { id: "e2", source: "agent-1", target: "clf" },
  {
    id: "e3",
    source: "clf",
    target: "urgent",
    label: "urgent",
    sourceHandle: "urgent",
  },
  {
    id: "e4",
    source: "clf",
    target: "normal",
    label: "normal",
    sourceHandle: "normal",
  },
  { id: "e5", source: "urgent", target: "end" },
];

describe("nextNodeId", () => {
  it("follows the first outgoing edge when no route is given", () => {
    expect(nextNodeId("start", edges)).toBe("agent-1");
    expect(nextNodeId("agent-1", edges)).toBe("clf");
  });

  it("routes by classifier label / sourceHandle", () => {
    expect(nextNodeId("clf", edges, "urgent")).toBe("urgent");
    expect(nextNodeId("clf", edges, "normal")).toBe("normal");
  });

  it("returns null when there is no outgoing edge", () => {
    expect(nextNodeId("end", edges)).toBeNull();
  });

  it("falls back to first edge when route is missing", () => {
    // Matches engine behavior: unknown classifier route still advances via default edge
    expect(nextNodeId("clf", edges, "missing")).toBe("urgent");
  });
});

"use client";

import dynamic from "next/dynamic";
import type { FlowEdge, FlowNode } from "@/lib/workflow/types";

const WorkflowCanvas = dynamic(
  () =>
    import("@/components/workflow/workflow-canvas").then((mod) => mod.WorkflowCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[70vh] items-center justify-center rounded-xl border border-white/10 bg-black/20 text-sm text-muted-foreground">
        Loading canvas…
      </div>
    ),
  }
);

type Props = {
  workflowId: string;
  initialName: string;
  initialNodes: FlowNode[];
  initialEdges: FlowEdge[];
  initialActive: boolean;
  initialScheduleEnabled?: boolean;
  initialScheduleEveryMinutes?: number | null;
  initialVersions?: Array<{
    id: string;
    version: number;
    name: string;
    created_at: string;
  }>;
  aiStatus?: { live: boolean; label: string; hint: string };
  generatedFromText?: boolean;
};

export function WorkflowCanvasLazy(props: Props) {
  return <WorkflowCanvas {...props} />;
}

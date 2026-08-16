"use client";

import dynamic from "next/dynamic";
import { SceneProvider } from "@/components/scene/scene-provider";

const SceneCanvas = dynamic(
  () =>
    import("@/components/scene/scene-canvas").then((mod) => mod.SceneCanvas),
  { ssr: false }
);

export function SceneRoot() {
  return (
    <SceneProvider>
      <SceneCanvas />
    </SceneProvider>
  );
}

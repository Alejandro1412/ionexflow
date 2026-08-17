"use client";

import { SceneProvider } from "@/components/scene/scene-provider";
import { SceneCanvas } from "@/components/scene/scene-canvas";

export function SceneShell() {
  return (
    <SceneProvider>
      <SceneCanvas />
    </SceneProvider>
  );
}

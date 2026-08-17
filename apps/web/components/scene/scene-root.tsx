"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { modeFromPathname } from "@/components/scene/types";

const SceneShell = dynamic(
  () => import("@/components/scene/scene-shell").then((mod) => mod.SceneShell),
  { ssr: false }
);

/**
 * Mounts WebGL only on marketing/auth routes. Dashboard stays free of Three.js.
 */
export function SceneRoot() {
  const pathname = usePathname() || "/";
  const mode = modeFromPathname(pathname);

  if (mode === "app") return null;

  return <SceneShell />;
}

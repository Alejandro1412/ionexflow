export type SceneMode = "hero" | "auth" | "app";

export type ScenePointer = {
  x: number;
  y: number;
};

export function modeFromPathname(pathname: string): SceneMode {
  if (pathname === "/") return "hero";
  if (pathname.startsWith("/login") || pathname.startsWith("/signup")) {
    return "auth";
  }
  return "app";
}

export const SCENE_COLORS = {
  void: "#05070F",
  fog: "#0B1220",
  signal: "#3DFFF2",
  arc: "#5B8CFF",
  ice: "#E8F1FF",
  alert: "#FF5C7A",
} as const;

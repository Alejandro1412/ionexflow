"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  modeFromPathname,
  type SceneMode,
  type ScenePointer,
} from "@/components/scene/types";

type SceneContextValue = {
  mode: SceneMode;
  pointer: ScenePointer;
  scrollProgress: number;
  reducedMotion: boolean;
  visible: boolean;
};

const SceneContext = createContext<SceneContextValue | null>(null);

export function useScene() {
  const ctx = useContext(SceneContext);
  if (!ctx) {
    throw new Error("useScene must be used within SceneProvider");
  }
  return ctx;
}

export function SceneProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const mode = useMemo(() => modeFromPathname(pathname), [pathname]);
  const [pointer, setPointer] = useState<ScenePointer>({ x: 0, y: 0 });
  const [scrollProgress, setScrollProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setReducedMotion(mq.matches);
    syncMotion();
    mq.addEventListener("change", syncMotion);
    return () => mq.removeEventListener("change", syncMotion);
  }, []);

  useEffect(() => {
    const onVisibility = () => setVisible(document.visibilityState === "visible");
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = (event.clientY / window.innerHeight) * 2 - 1;
      setPointer({ x, y: -y });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useEffect(() => {
    if (mode !== "hero") {
      setScrollProgress(0);
      return;
    }
    const onScroll = () => {
      const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      setScrollProgress(Math.min(window.scrollY / max, 1));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [mode]);

  const value = useMemo(
    () => ({ mode, pointer, scrollProgress, reducedMotion, visible }),
    [mode, pointer, scrollProgress, reducedMotion, visible]
  );

  return <SceneContext.Provider value={value}>{children}</SceneContext.Provider>;
}

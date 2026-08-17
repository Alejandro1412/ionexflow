"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
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
  pointerRef: MutableRefObject<ScenePointer>;
  scrollProgressRef: MutableRefObject<number>;
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
  const pointerRef = useRef<ScenePointer>({ x: 0, y: 0 });
  const scrollProgressRef = useRef(0);
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
    // Refs only — avoid React re-renders on every pointermove (kills nav fluidity).
    const onMove = (event: PointerEvent) => {
      pointerRef.current = {
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: -((event.clientY / window.innerHeight) * 2 - 1),
      };
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useEffect(() => {
    if (mode !== "hero") {
      scrollProgressRef.current = 0;
      return;
    }
    const onScroll = () => {
      const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      scrollProgressRef.current = Math.min(window.scrollY / max, 1);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [mode]);

  const value = useMemo(
    () => ({ mode, pointerRef, scrollProgressRef, reducedMotion, visible }),
    [mode, pointerRef, scrollProgressRef, reducedMotion, visible]
  );

  return <SceneContext.Provider value={value}>{children}</SceneContext.Provider>;
}

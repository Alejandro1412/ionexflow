"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { NeuralField } from "@/components/scene/neural-field";
import { OrbitCore } from "@/components/scene/orbit-core";
import { CameraRig } from "@/components/scene/camera-rig";
import { useScene } from "@/components/scene/scene-provider";
import { SCENE_COLORS } from "@/components/scene/types";

function SceneContent() {
  const { mode, visible } = useScene();

  return (
    <>
      <color attach="background" args={[SCENE_COLORS.void]} />
      <fog attach="fog" args={[SCENE_COLORS.void, 8, mode === "hero" ? 22 : 18]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 6, 2]} intensity={0.55} color={SCENE_COLORS.ice} />
      {visible ? (
        <>
          <NeuralField />
          <OrbitCore />
          <CameraRig />
        </>
      ) : null}
    </>
  );
}

export function SceneCanvas() {
  const { mode } = useScene();
  const appMode = mode === "app";

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 h-[100dvh] w-screen"
    >
      <Canvas
        dpr={appMode ? [1, 1] : [1, 1.75]}
        performance={{ min: appMode ? 0.4 : 0.5 }}
        gl={{
          antialias: !appMode,
          alpha: false,
          powerPreference: "high-performance",
        }}
        camera={{ position: [0, 0, 9], fov: 50, near: 0.1, far: 60 }}
        style={{ width: "100%", height: "100%" }}
      >
        <Suspense fallback={null}>
          <SceneContent />
        </Suspense>
      </Canvas>
    </div>
  );
}

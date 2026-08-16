"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useScene } from "@/components/scene/scene-provider";

export function CameraRig() {
  const { camera } = useThree();
  const { mode, pointer, scrollProgress, reducedMotion, visible } = useScene();
  const target = useRef(new THREE.Vector3());

  useFrame(() => {
    if (!visible) return;

    const strength =
      reducedMotion ? 0.08 : mode === "hero" ? 1 : mode === "auth" ? 0.45 : 0.2;

    const baseZ = mode === "hero" ? 8 - scrollProgress * 2.2 : mode === "auth" ? 9 : 10;
    const lookX = pointer.x * 1.4 * strength;
    const lookY = pointer.y * 0.9 * strength;

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, lookX * 0.8, 0.05);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, lookY * 0.55, 0.05);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, baseZ, 0.05);

    target.current.set(lookX * 0.35, lookY * 0.25, 0);
    camera.lookAt(target.current);
  });

  return null;
}

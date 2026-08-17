"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useScene } from "@/components/scene/scene-provider";
import { SCENE_COLORS } from "@/components/scene/types";

export function OrbitCore() {
  const { mode, pointerRef, scrollProgressRef, reducedMotion, visible } = useScene();
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (!visible || !group.current || mode !== "hero") return;
    const t = state.clock.elapsedTime;
    const motion = reducedMotion ? 0.15 : 1;
    const pointer = pointerRef.current;
    const scrollProgress = scrollProgressRef.current;

    group.current.rotation.y += delta * (0.35 + scrollProgress * 0.8) * motion;
    group.current.rotation.x = THREE.MathUtils.lerp(
      group.current.rotation.x,
      pointer.y * 0.45 * motion,
      0.06
    );
    group.current.rotation.z = THREE.MathUtils.lerp(
      group.current.rotation.z,
      pointer.x * 0.35 * motion,
      0.06
    );

    const scale = 1 + Math.sin(t * 2.2) * 0.04 * motion + scrollProgress * 0.25;
    group.current.scale.setScalar(scale);

    if (core.current) {
      const mat = core.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1.4 + Math.sin(t * 3) * 0.35 * motion;
    }
  });

  if (mode !== "hero") return null;

  return (
    <group ref={group} position={[2.2, 0.2, 0]}>
      <mesh ref={core}>
        <icosahedronGeometry args={[0.85, 1]} />
        <meshStandardMaterial
          color={SCENE_COLORS.fog}
          emissive={SCENE_COLORS.signal}
          emissiveIntensity={1.5}
          metalness={0.7}
          roughness={0.25}
          wireframe={false}
        />
      </mesh>

      <mesh>
        <icosahedronGeometry args={[0.88, 1]} />
        <meshBasicMaterial color={SCENE_COLORS.signal} wireframe transparent opacity={0.35} />
      </mesh>

      <mesh rotation={[Math.PI / 2.2, 0.2, 0]}>
        <torusGeometry args={[1.45, 0.03, 16, 120]} />
        <meshBasicMaterial color={SCENE_COLORS.arc} transparent opacity={0.85} />
      </mesh>

      <mesh rotation={[0.4, Math.PI / 3, 0.6]}>
        <torusGeometry args={[1.75, 0.02, 16, 140]} />
        <meshBasicMaterial color={SCENE_COLORS.signal} transparent opacity={0.55} />
      </mesh>

      <mesh rotation={[-0.5, -0.4, 1.1]}>
        <torusGeometry args={[2.05, 0.015, 12, 160]} />
        <meshBasicMaterial color={SCENE_COLORS.ice} transparent opacity={0.28} />
      </mesh>

      <pointLight color={SCENE_COLORS.signal} intensity={2.2} distance={12} />
      <pointLight color={SCENE_COLORS.arc} intensity={1.2} distance={10} position={[1, 1, 1]} />
    </group>
  );
}

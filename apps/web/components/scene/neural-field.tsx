"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useScene } from "@/components/scene/scene-provider";
import { SCENE_COLORS, type SceneMode } from "@/components/scene/types";

function nodeCountForMode(mode: SceneMode, mobile: boolean) {
  if (mode === "hero") return mobile ? 90 : 180;
  if (mode === "auth") return mobile ? 50 : 100;
  return mobile ? 35 : 70;
}

function buildGraph(count: number, spread: number) {
  const positions = new Float32Array(count * 3);
  const points: THREE.Vector3[] = [];

  for (let i = 0; i < count; i++) {
    const v = new THREE.Vector3(
      (Math.random() - 0.5) * spread,
      (Math.random() - 0.5) * spread * 0.7,
      (Math.random() - 0.5) * spread
    );
    points.push(v);
    positions[i * 3] = v.x;
    positions[i * 3 + 1] = v.y;
    positions[i * 3 + 2] = v.z;
  }

  const maxDist = spread * 0.22;
  const segments: number[] = [];
  for (let i = 0; i < count; i++) {
    const a = points[i]!;
    for (let j = i + 1; j < count; j++) {
      const b = points[j]!;
      if (a.distanceTo(b) < maxDist) {
        segments.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
  }

  return {
    positions,
    linePositions: new Float32Array(segments),
    points,
  };
}

export function NeuralField() {
  const { mode, reducedMotion, visible } = useScene();
  const group = useRef<THREE.Group>(null);
  const pulseRef = useRef<THREE.Points>(null);

  const mobile =
    typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;

  const graph = useMemo(() => {
    const count = nodeCountForMode(mode, mobile);
    return buildGraph(count, mode === "hero" ? 14 : 11);
  }, [mode, mobile]);

  const pulsePositions = useMemo(() => {
    const n = Math.min(24, Math.floor(graph.points.length / 4) || 1);
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const p = graph.points[(i * 3) % graph.points.length] ?? graph.points[0]!;
      arr[i * 3] = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z;
    }
    return arr;
  }, [graph]);

  useFrame((state, delta) => {
    if (!visible || !group.current) return;
    const t = state.clock.elapsedTime;
    const speed = reducedMotion ? 0.02 : mode === "hero" ? 0.12 : mode === "auth" ? 0.06 : 0.035;
    group.current.rotation.y += delta * speed;
    group.current.rotation.x = Math.sin(t * 0.15) * 0.08;

    const pulse = pulseRef.current;
    if (pulse && !reducedMotion) {
      const attr = pulse.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
      if (!attr) return;
      for (let i = 0; i < attr.count; i++) {
        const base = graph.points[i % graph.points.length];
        if (!base) continue;
        const wobble = Math.sin(t * 2 + i) * 0.15;
        attr.setXYZ(i, base.x + wobble, base.y + Math.cos(t * 1.4 + i) * 0.12, base.z);
      }
      attr.needsUpdate = true;
    }
  });

  const pointSize = mode === "hero" ? 0.045 : 0.035;
  const lineOpacity = mode === "hero" ? 0.35 : mode === "auth" ? 0.22 : 0.14;
  const pointOpacity = mode === "hero" ? 0.9 : 0.65;

  return (
    <group ref={group}>
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={graph.positions.length / 3}
            array={graph.positions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color={SCENE_COLORS.signal}
          size={pointSize}
          sizeAttenuation
          transparent
          opacity={pointOpacity}
          depthWrite={false}
        />
      </points>

      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={graph.linePositions.length / 3}
            array={graph.linePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color={SCENE_COLORS.arc}
          transparent
          opacity={lineOpacity}
          depthWrite={false}
        />
      </lineSegments>

      <points ref={pulseRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={pulsePositions.length / 3}
            array={pulsePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color={SCENE_COLORS.ice}
          size={pointSize * 1.8}
          sizeAttenuation
          transparent
          opacity={mode === "app" ? 0.35 : 0.75}
          depthWrite={false}
        />
      </points>
    </group>
  );
}

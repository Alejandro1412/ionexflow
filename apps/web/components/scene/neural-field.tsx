"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useScene } from "@/components/scene/scene-provider";
import { SCENE_COLORS } from "@/components/scene/types";

/** Keep buffer sizes stable across route changes — Three.js cannot resize attributes. */
const DESKTOP_NODES = 120;
const MOBILE_NODES = 60;
const PULSE_COUNT = 24;

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

  const pulse = new Float32Array(PULSE_COUNT * 3);
  for (let i = 0; i < PULSE_COUNT; i++) {
    const p = points[i % points.length]!;
    pulse[i * 3] = p.x;
    pulse[i * 3 + 1] = p.y;
    pulse[i * 3 + 2] = p.z;
  }

  return {
    positions,
    linePositions: new Float32Array(segments),
    pulsePositions: pulse,
    points,
  };
}

export function NeuralField() {
  const { mode, reducedMotion, visible } = useScene();
  const group = useRef<THREE.Group>(null);
  const pulseRef = useRef<THREE.Points>(null);
  const pointsRef = useRef<THREE.Vector3[]>([]);

  const mobile =
    typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;

  const graph = useMemo(() => {
    const built = buildGraph(mobile ? MOBILE_NODES : DESKTOP_NODES, 12);
    pointsRef.current = built.points;
    return built;
  }, [mobile]);

  useFrame((state, delta) => {
    if (!visible || !group.current) return;
    const t = state.clock.elapsedTime;
    const speed = reducedMotion ? 0.02 : mode === "hero" ? 0.12 : mode === "auth" ? 0.06 : 0.035;
    group.current.rotation.y += delta * speed;
    group.current.rotation.x = Math.sin(t * 0.15) * 0.08;

    const pulse = pulseRef.current;
    const bases = pointsRef.current;
    if (pulse && !reducedMotion && bases.length > 0) {
      const attr = pulse.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
      if (!attr || attr.count !== PULSE_COUNT) return;
      for (let i = 0; i < PULSE_COUNT; i++) {
        const base = bases[i % bases.length]!;
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
            args={[graph.positions, 3]}
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
            args={[graph.linePositions, 3]}
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
            args={[graph.pulsePositions, 3]}
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

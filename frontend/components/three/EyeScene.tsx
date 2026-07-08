"use client";

import { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Float, Text } from "@react-three/drei";
import * as THREE from "three";

/* ── Particle cloud ───────────────────────────────────────────── */
function ParticleField({ count = 700 }: { count?: number }) {
  const posArr = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3]     = (Math.random() - 0.5) * 24;
      p[i * 3 + 1] = (Math.random() - 0.5) * 24;
      p[i * 3 + 2] = (Math.random() - 0.5) * 12;
    }
    return p;
  }, [count]);

  const ref = useRef<THREE.Points>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * 0.012;
    ref.current.rotation.x = Math.sin(clock.elapsedTime * 0.007) * 0.05;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[posArr, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.045}
        color="#10B981"
        transparent
        opacity={0.35}
        sizeAttenuation
      />
    </points>
  );
}

/* ── Orbital landmark dots ────────────────────────────────────── */
function LandmarkRing({ radius = 2, count = 30, yScale = 0.55 }: {
  radius?: number; count?: number; yScale?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.z = clock.elapsedTime * 0.08;
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const jitter = 1 + Math.sin(i * 1.7) * 0.15;
        return (
          <mesh
            key={i}
            position={[
              Math.cos(angle) * radius * jitter,
              Math.sin(angle) * radius * yScale * jitter,
              Math.sin(i * 0.9) * 0.25,
            ]}
          >
            <sphereGeometry args={[0.035 + (i % 3) * 0.012, 8, 8]} />
            <meshStandardMaterial
              color="#10B981"
              emissive="#10B981"
              emissiveIntensity={1.2}
            />
          </mesh>
        );
      })}
    </group>
  );
}

/* ── Main eye ─────────────────────────────────────────────────── */
function Eye({ score = 0.19 }: { score?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const pupilRef = useRef<THREE.Mesh>(null);

  // Color interpolation based on score
  const alertColor = useMemo(() => {
    if (score < 0.25) return "#10B981";
    if (score < 0.50) return "#F59E0B";
    if (score < 0.75) return "#F97316";
    return "#EF4444";
  }, [score]);

  useFrame(({ clock }) => {
    if (!groupRef.current || !pupilRef.current) return;
    const t = clock.elapsedTime;
    groupRef.current.rotation.y = t * 0.06;
    // Pupil subtle pulse
    const pulse = 1 + Math.sin(t * 1.8) * 0.04;
    pupilRef.current.scale.setScalar(pulse);
  });

  return (
    <group ref={groupRef}>
      {/* Outer iris ring */}
      <mesh>
        <torusGeometry args={[2.2, 0.055, 24, 120]} />
        <meshStandardMaterial color={alertColor} emissive={alertColor} emissiveIntensity={0.7} />
      </mesh>

      {/* Mid ring */}
      <mesh>
        <torusGeometry args={[1.65, 0.03, 16, 80]} />
        <meshStandardMaterial color={alertColor} emissive={alertColor} emissiveIntensity={0.4} transparent opacity={0.65} />
      </mesh>

      {/* Inner ring */}
      <mesh>
        <torusGeometry args={[1.1, 0.025, 16, 64]} />
        <meshStandardMaterial color={alertColor} emissive={alertColor} emissiveIntensity={0.3} transparent opacity={0.45} />
      </mesh>

      {/* Pupil sphere */}
      <mesh ref={pupilRef}>
        <sphereGeometry args={[0.52, 32, 32]} />
        <meshStandardMaterial
          color="#050810"
          emissive={alertColor}
          emissiveIntensity={0.15}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {/* Score text — uses Drei default font (no external file needed) */}
      <Text
        position={[0, -3.1, 0]}
        fontSize={0.45}
        color={alertColor}
        anchorX="center"
        anchorY="middle"
        characters="0123456789."
      >
        {score.toFixed(2)}
      </Text>
      <Text
        position={[0, -3.65, 0]}
        fontSize={0.22}
        color="#A1A1A6"
        anchorX="center"
        anchorY="middle"
        characters="COMPOSITESCR"
      >
        COMPOSITE SCORE
      </Text>

      {/* Landmark orbital */}
      <LandmarkRing radius={2.2} count={30} yScale={0.55} />
    </group>
  );
}

/* ── Camera rig ───────────────────────────────────────────────── */
function CameraRig({ scrollY = 0 }: { scrollY?: number }) {
  const { camera } = useThree();
  useFrame(({ clock }) => {
    camera.position.x = Math.sin(clock.elapsedTime * 0.05) * 0.3;
    camera.position.y = Math.cos(clock.elapsedTime * 0.04) * 0.2 - scrollY * 1.2;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

/* ── Full scene export ────────────────────────────────────────── */
export function EyeScene({ score = 0.19 }: { score?: number }) {
  return (
    <>
      <ambientLight intensity={0.15} />
      <pointLight position={[5, 5, 5]} intensity={0.8} color="#10B981" />
      <pointLight position={[-5, -5, -5]} intensity={0.4} color="#F97316" />

      <CameraRig />
      <ParticleField count={600} />

      <Float speed={1.2} rotationIntensity={0.08} floatIntensity={0.3}>
        <Eye score={score} />
      </Float>
    </>
  );
}

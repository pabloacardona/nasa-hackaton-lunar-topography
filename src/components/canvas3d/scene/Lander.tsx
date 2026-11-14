"use client";
// Lander CLPS genérico con materiales PBR (aislante MLI dorado, celdas solares, aluminio).
// - Polo sur: panel VERTICAL que gira siguiendo el azimut del Sol.
// - Ecuador: paneles HORIZONTALES.
// - Antena de alta ganancia apuntando a la Tierra; luz de estado verde/ámbar/roja.
// Todo lo dinámico se actualiza en useFrame (sin re-render de React).
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { HourSample, PanelType } from "@/lib/types";
import { azElToVec3 } from "@/lib/lunarMath";
import { texPaths, usePbrSet } from "../textures";
import type { Tier } from "@/store/useGfxStore";
import { getPlayhead, newFrameSample, sampleTimeline } from "./frame";

const LEG_ANGLES = [45, 135, 225, 315];
const C_OK = new THREE.Color("#22c55e"), C_WARN = new THREE.Color("#f59e0b"), C_BAD = new THREE.Color("#ef4444");

export function Lander({ panel, timeline, tier }: { panel: PanelType; timeline: HourSample[]; tier: Tier }) {
  const mli = usePbrSet(texPaths(tier).mli);
  const solar = usePbrSet(texPaths(tier).solar);
  const dish = useRef<THREE.Group>(null);
  const panelRef = useRef<THREE.Group>(null);
  const beacon = useRef<THREE.MeshStandardMaterial>(null);
  const fs = useMemo(() => newFrameSample(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    const s = sampleTimeline(timeline, getPlayhead(), fs);
    if (!s) return;
    if (panelRef.current) panelRef.current.rotation.y = Math.PI - (s.sunAz * Math.PI) / 180;
    if (dish.current) {
      const [x, y, z] = azElToVec3(s.earthAz, s.earthEl, 100);
      dish.current.parent!.getWorldPosition(tmp);
      dish.current.lookAt(tmp.x + x, tmp.y + y, tmp.z + z);
    }
    if (beacon.current) {
      const c = !s.sunVisible ? C_BAD : !s.earthVisible ? C_WARN : C_OK;
      beacon.current.color.copy(c);
      beacon.current.emissive.copy(c);
      beacon.current.emissiveIntensity = 2 + Math.sin(clock.elapsedTime * 4) * 1.5;
    }
  });

  const aluminum = useMemo(() => new THREE.MeshStandardMaterial({ color: "#c7ccd3", metalness: 0.9, roughness: 0.35 }), []);
  const solarMat = (
    <meshStandardMaterial map={solar.map} normalMap={solar.normalMap} roughnessMap={solar.orm} metalnessMap={solar.orm} roughness={1} metalness={1} />
  );

  return (
    <group>
      {LEG_ANGLES.map((deg) => {
        const a = (deg * Math.PI) / 180;
        const fx = Math.sin(a) * 1.6, fz = Math.cos(a) * 1.6;
        return (
          <group key={deg}>
            <mesh position={[fx * 0.62, 0.55, fz * 0.62]} rotation={[Math.cos(a) * 0.55, 0, -Math.sin(a) * 0.55]} castShadow material={aluminum}>
              <cylinderGeometry args={[0.05, 0.05, 1.3, 6]} />
            </mesh>
            <mesh position={[fx, 0.04, fz]} castShadow receiveShadow material={aluminum}>
              <cylinderGeometry args={[0.22, 0.26, 0.06, 12]} />
            </mesh>
          </group>
        );
      })}
      <mesh position={[0, 1.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 1.0, 1.6]} />
        <meshStandardMaterial map={mli.map} normalMap={mli.normalMap} roughnessMap={mli.orm} metalnessMap={mli.orm} metalness={1} roughness={1} />
      </mesh>
      <mesh position={[0, 1.8, 0]} castShadow material={aluminum}>
        <boxGeometry args={[1.7, 0.1, 1.7]} />
      </mesh>
      {panel === "vertical" ? (
        <group ref={panelRef} position={[0, 2.9, 0]}>
          <mesh castShadow>
            <boxGeometry args={[2.4, 1.9, 0.05]} />
            {solarMat}
          </mesh>
          <mesh position={[0, -0.6, -0.1]} material={aluminum}>
            <cylinderGeometry args={[0.05, 0.05, 1.2, 6]} />
          </mesh>
        </group>
      ) : (
        [-1, 1].map((s) => (
          <mesh key={s} position={[s * 1.9, 1.85, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
            <boxGeometry args={[2.2, 1.4, 0.04]} />
            {solarMat}
          </mesh>
        ))
      )}
      <group position={[0.55, 2.05, 0.55]}>
        <group ref={dish}>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.15]} castShadow>
            <sphereGeometry args={[0.38, 20, 10, 0, Math.PI * 2, 0, Math.PI / 3.2]} />
            <meshStandardMaterial color="#e5e7eb" metalness={0.6} roughness={0.3} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0, 0.35]} rotation={[Math.PI / 2, 0, 0]} material={aluminum}>
            <cylinderGeometry args={[0.02, 0.02, 0.4, 6]} />
          </mesh>
        </group>
      </group>
      <mesh position={[-0.6, 1.95, -0.6]}>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial ref={beacon} color="#22c55e" emissive="#22c55e" emissiveIntensity={3} toneMapped={false} />
      </mesh>
    </group>
  );
}

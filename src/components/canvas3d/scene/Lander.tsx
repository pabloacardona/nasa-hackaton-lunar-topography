"use client";
// Lander lunar detallado (estilo CLPS): bus octogonal con aislante MLI dorado, cubierta con radiador,
// motor principal y propulsores RCS, tanques, 4 patas con puntales y amortiguadores, paneles solares
// (verticales que siguen al Sol en el polo / alas horizontales en el ecuador), antena parabólica de alta
// ganancia orientada a la Tierra, antena omnidireccional, mástil de cámaras y baliza de estado.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { HourSample, PanelType } from "@/lib/types";
import { azElToVec3 } from "@/lib/lunarMath";
import { texPaths, usePbrSet } from "../textures";
import type { Tier } from "@/store/useGfxStore";
import { getPlayhead, newFrameSample, sampleTimeline } from "./frame";

/** Puntos de anclaje de los rayos (coordenadas del lander) */
export const DISH_ANCHOR = new THREE.Vector3(0.75, 2.75, 0.75);
export const PANEL_ANCHOR = new THREE.Vector3(0, 3.6, 0);

const LEGS = [45, 135, 225, 315];
const C_OK = new THREE.Color("#22c55e"), C_WARN = new THREE.Color("#f59e0b"), C_BAD = new THREE.Color("#ef4444");

/** Puntal entre dos puntos (cilindro orientado). */
function Strut({ a, b, r = 0.04, material }: { a: THREE.Vector3; b: THREE.Vector3; r?: number; material: THREE.Material }) {
  const { pos, quat, len } = useMemo(() => {
    const d = new THREE.Vector3().subVectors(b, a);
    return {
      pos: a.clone().addScaledVector(d, 0.5),
      quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()),
      len: d.length(),
    };
  }, [a, b]);
  return (
    <mesh position={pos} quaternion={quat} material={material} castShadow>
      <cylinderGeometry args={[r, r, len, 6]} />
    </mesh>
  );
}

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
      dish.current.getWorldPosition(tmp);
      dish.current.lookAt(tmp.x + x, tmp.y + y, tmp.z + z);
    }
    if (beacon.current) {
      const c = !s.sunVisible ? C_BAD : !s.earthVisible ? C_WARN : C_OK;
      beacon.current.color.copy(c);
      beacon.current.emissive.copy(c);
      beacon.current.emissiveIntensity = 2.5 + Math.sin(clock.elapsedTime * 4) * 1.5;
    }
  });

  const mats = useMemo(
    () => ({
      alu: new THREE.MeshStandardMaterial({ color: "#c9ced6", metalness: 0.9, roughness: 0.32 }),
      dark: new THREE.MeshStandardMaterial({ color: "#2b2f36", metalness: 0.7, roughness: 0.45 }),
      white: new THREE.MeshStandardMaterial({ color: "#eef1f4", metalness: 0.1, roughness: 0.55 }),
      tank: new THREE.MeshStandardMaterial({ color: "#9aa3ad", metalness: 0.85, roughness: 0.28 }),
      silver: new THREE.MeshStandardMaterial({ color: "#d9dde3", metalness: 1, roughness: 0.18 }),
    }),
    []
  );
  const solarMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: solar.map, normalMap: solar.normalMap, roughnessMap: solar.orm, metalnessMap: solar.orm, roughness: 1, metalness: 1 }),
    [solar]
  );
  const mliMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: mli.map, normalMap: mli.normalMap, roughnessMap: mli.orm, metalnessMap: mli.orm, roughness: 1, metalness: 1 }),
    [mli]
  );
  // Parábola de la antena (LatheGeometry)
  const dishGeo = useMemo(() => {
    const pts = Array.from({ length: 12 }, (_, i) => {
      const r = (i / 11) * 0.55;
      return new THREE.Vector2(r, r * r * 0.9);
    });
    return new THREE.LatheGeometry(pts, 28);
  }, []);
  const legs = useMemo(
    () =>
      LEGS.map((deg) => {
        const a = (deg * Math.PI) / 180;
        const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
        const foot = dir.clone().multiplyScalar(2.05).setY(0.1);
        const top = dir.clone().multiplyScalar(0.92).setY(1.55);
        const side = new THREE.Vector3(-dir.z, 0, dir.x);
        const b1 = dir.clone().multiplyScalar(0.8).addScaledVector(side, 0.45).setY(0.75);
        const b2 = dir.clone().multiplyScalar(0.8).addScaledVector(side, -0.45).setY(0.75);
        return { deg, foot, top, b1, b2, mid: foot.clone().lerp(top, 0.45) };
      }),
    []
  );

  return (
    <group>
      {/* Patas: puntal principal (con amortiguador) + 2 secundarios + pie */}
      {legs.map((l) => (
        <group key={l.deg}>
          <Strut a={l.foot} b={l.top} r={0.06} material={mats.alu} />
          <Strut a={l.mid} b={l.top} r={0.09} material={mats.dark} />
          <Strut a={l.foot} b={l.b1} r={0.035} material={mats.alu} />
          <Strut a={l.foot} b={l.b2} r={0.035} material={mats.alu} />
          <mesh position={l.foot} material={mats.alu} castShadow receiveShadow>
            <cylinderGeometry args={[0.3, 0.34, 0.08, 16]} />
          </mesh>
          <mesh position={[l.foot.x, l.foot.y + 0.08, l.foot.z]} material={mats.alu} castShadow>
            <sphereGeometry args={[0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
        </group>
      ))}

      {/* Motor principal + RCS */}
      <mesh position={[0, 0.82, 0]} material={mats.dark} castShadow>
        <cylinderGeometry args={[0.2, 0.42, 0.55, 20, 1, true]} />
      </mesh>
      {LEGS.map((deg) => {
        const a = ((deg + 45) * Math.PI) / 180;
        return (
          <mesh key={deg} position={[Math.sin(a) * 0.98, 1.95, Math.cos(a) * 0.98]} rotation={[0, a, Math.PI / 2]} material={mats.dark}>
            <cylinderGeometry args={[0.05, 0.09, 0.18, 8]} />
          </mesh>
        );
      })}

      {/* Tanques de propelente bajo la cubierta */}
      {[0, 90, 180, 270].map((deg) => {
        const a = (deg * Math.PI) / 180;
        return (
          <mesh key={deg} position={[Math.sin(a) * 0.55, 1.15, Math.cos(a) * 0.55]} material={mats.tank} castShadow>
            <sphereGeometry args={[0.28, 16, 12]} />
          </mesh>
        );
      })}

      {/* Bus octogonal con aislante MLI dorado */}
      <mesh position={[0, 1.95, 0]} material={mliMat} castShadow receiveShadow>
        <cylinderGeometry args={[0.95, 0.95, 0.85, 8]} />
      </mesh>
      {/* Cubierta superior + radiador blanco */}
      <mesh position={[0, 2.42, 0]} material={mats.alu} castShadow>
        <cylinderGeometry args={[1.02, 1.02, 0.08, 8]} />
      </mesh>
      <mesh position={[-0.9, 1.95, 0]} rotation={[0, Math.PI / 2, 0]} material={mats.white}>
        <boxGeometry args={[0.7, 0.6, 0.03]} />
      </mesh>
      {/* Cargas útiles sobre la cubierta */}
      <mesh position={[-0.35, 2.6, -0.35]} material={mats.silver} castShadow><boxGeometry args={[0.45, 0.28, 0.4]} /></mesh>
      <mesh position={[0.35, 2.58, -0.45]} material={mliMat} castShadow><boxGeometry args={[0.35, 0.24, 0.3]} /></mesh>

      {/* Mástil de cámaras */}
      <group position={[-0.55, 2.46, 0.5]}>
        <mesh position={[0, 0.45, 0]} material={mats.alu}><cylinderGeometry args={[0.03, 0.03, 0.9, 6]} /></mesh>
        <mesh position={[0, 0.95, 0]} material={mats.white}><boxGeometry args={[0.22, 0.14, 0.14]} /></mesh>
        <mesh position={[0, 0.95, 0.08]}><sphereGeometry args={[0.045, 10, 8]} /><meshStandardMaterial color="#0a0a0a" metalness={0.2} roughness={0.05} /></mesh>
      </group>
      {/* Antena omnidireccional */}
      <mesh position={[0.6, 2.85, -0.55]} material={mats.alu}><cylinderGeometry args={[0.015, 0.015, 0.8, 6]} /></mesh>
      <mesh position={[0.6, 3.27, -0.55]} material={mats.white}><sphereGeometry args={[0.05, 8, 6]} /></mesh>

      {/* Paneles solares */}
      {panel === "vertical" ? (
        <group ref={panelRef} position={[0, 2.46, 0]}>
          <mesh position={[0, 0.55, 0]} material={mats.alu}><cylinderGeometry args={[0.05, 0.06, 1.1, 8]} /></mesh>
          <group position={[0, 1.15, 0.06]}>
            {[-0.82, 0.82].map((x) => (
              <group key={x} position={[x, 0, 0]}>
                <mesh material={solarMat} castShadow><boxGeometry args={[1.5, 1.7, 0.04]} /></mesh>
                <mesh position={[0, 0, -0.03]} material={mats.alu}><boxGeometry args={[1.56, 1.76, 0.02]} /></mesh>
              </group>
            ))}
          </group>
        </group>
      ) : (
        [-1, 1].map((s) => (
          <group key={s} position={[s * 2.0, 2.42, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} material={solarMat} castShadow><boxGeometry args={[2.0, 1.3, 0.04]} /></mesh>
            <mesh position={[-s * 0.75, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.alu}><cylinderGeometry args={[0.03, 0.03, 0.6, 6]} /></mesh>
          </group>
        ))
      )}

      {/* Antena de alta ganancia (cardán) -> Tierra */}
      <group position={[DISH_ANCHOR.x, 2.46, DISH_ANCHOR.z]}>
        <mesh position={[0, 0.15, 0]} material={mats.alu}><cylinderGeometry args={[0.05, 0.07, 0.3, 8]} /></mesh>
        <group ref={dish} position={[0, 0.32, 0]}>
          <group rotation={[Math.PI / 2, 0, 0]}>
            <mesh geometry={dishGeo} castShadow>
              <meshStandardMaterial color="#f1f3f5" metalness={0.5} roughness={0.25} side={THREE.DoubleSide} />
            </mesh>
            {[0, 120, 240].map((d) => {
              const a = (d * Math.PI) / 180;
              return <Strut key={d} a={new THREE.Vector3(Math.cos(a) * 0.5, 0.22, Math.sin(a) * 0.5)} b={new THREE.Vector3(0, 0.55, 0)} r={0.012} material={mats.alu} />;
            })}
            <mesh position={[0, 0.58, 0]} material={mats.dark}><cylinderGeometry args={[0.04, 0.06, 0.12, 8]} /></mesh>
          </group>
        </group>
      </group>

      {/* Baliza de estado */}
      <mesh position={[0.2, 2.75, 0.6]}>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial ref={beacon} color="#22c55e" emissive="#22c55e" emissiveIntensity={3} toneMapped={false} />
      </mesh>
    </group>
  );
}

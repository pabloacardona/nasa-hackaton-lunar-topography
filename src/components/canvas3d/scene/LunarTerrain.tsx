"use client";
// Terreno lunar polar (anillos × 360°) con material PBR de regolito.
// GARANTÍA FÍSICA: la cresta en el radio R tiene exactamente la altura angular del
// perfil de horizonte (horizonProfileDeg) y el terreno interior nunca la supera,
// así lo que se ve coincide con el cálculo de visibilidad Sol/Tierra.
import { useMemo } from "react";
import * as THREE from "three";
import { terrainAt } from "@/lib/lunarMath";
import { TIER, type Tier } from "@/store/useGfxStore";
import { texPaths, usePbrSet } from "../textures";

export const TERRAIN_R = 60; // radio donde está la cresta del horizonte
const SKIRT_R = TERRAIN_R * 1.6;
const SEG = 360;

function smooth(e0: number, e1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

// Ruido de valor determinista (detalle de micro-relieve cerca del lander)
function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function buildTerrain(profile: number[], rings: number) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const radii: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    radii.push(0.4 + Math.pow(t, 1.6) * (SKIRT_R - 0.4)); // más densidad cerca del lander
  }
  for (let i = 0; i < radii.length; i++) {
    const r = radii[i];
    for (let j = 0; j <= SEG; j++) {
      const az = (j % SEG) * (360 / SEG);
      const a = (az * Math.PI) / 180;
      const x = r * Math.sin(a);
      const z = -r * Math.cos(a);
      const hDeg = terrainAt(profile, az);
      const crest = TERRAIN_R * Math.tan((Math.max(hDeg, -1) * Math.PI) / 180);
      let y: number;
      if (r <= TERRAIN_R) {
        // ramp(r) <= r/R  => ángulo visto desde el lander <= ángulo del horizonte
        const ramp = Math.pow(smooth(TERRAIN_R * 0.3, TERRAIN_R, r), 1.6) * (r / TERRAIN_R);
        y = ramp * crest;
      } else {
        // Falda detrás de la cresta (cae suavemente, nunca sobresale del horizonte)
        y = crest * (1 - 0.35 * smooth(TERRAIN_R, SKIRT_R, r));
      }
      // micro-relieve: limitado a < 0.25° de altura angular
      const n = vnoise(x * 0.35, z * 0.35) * 0.7 + vnoise(x * 1.3, z * 1.3) * 0.3 - 0.5;
      y += n * Math.min(0.35, r * 0.004);
      pos.push(x, y, z);
      uv.push(x / 8, z / 8);
    }
  }
  const row = SEG + 1;
  for (let i = 0; i < radii.length - 1; i++) {
    for (let j = 0; j < SEG; j++) {
      const a = i * row + j, b = a + 1, c = a + row, d = c + 1;
      idx.push(a, b, c, b, d, c); // CCW visto desde arriba => normales hacia +Y
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export function LunarTerrain({ profile, tier, mare }: { profile: number[]; tier: Tier; mare: boolean }) {
  const rings = TIER[tier].terrainRings;
  const geom = useMemo(() => buildTerrain(profile, rings), [profile, rings]);
  const tex = usePbrSet(texPaths(tier).regolith, { repeat: 1, aniso: TIER[tier].aniso, tile: true });
  return (
    <mesh geometry={geom} receiveShadow castShadow>
      <meshStandardMaterial
        map={tex.map}
        normalMap={tex.normalMap}
        normalScale={new THREE.Vector2(1.2, 1.2)}
        roughnessMap={tex.orm}
        aoMap={tex.orm}
        aoMapIntensity={0.9}
        roughness={1}
        metalness={0}
        color={mare ? "#8f8c88" : "#c9c6c0"}
      />
    </mesh>
  );
}

/** Rocas instanciadas (1 draw call). Decorativas: pequeñas, no alteran el horizonte. */
export function Boulders({ profile, tier, count = 140 }: { profile: number[]; tier: Tier; count?: number }) {
  const tex = usePbrSet(texPaths(tier).regolith, { repeat: 1, aniso: TIER[tier].aniso, tile: true });
  const { geom, matrices } = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = 0.75 + hash(i, 3.3) * 0.5;
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.7, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    const m: THREE.Matrix4[] = [];
    const o = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const r = 3 + Math.pow(hash(i, 1.1), 0.7) * (TERRAIN_R * 0.75);
      const az = hash(i, 2.2) * 360;
      const a = (az * Math.PI) / 180;
      const ramp = Math.pow(smooth(TERRAIN_R * 0.3, TERRAIN_R, r), 1.6) * (r / TERRAIN_R);
      const crest = TERRAIN_R * Math.tan((terrainAt(profile, az) * Math.PI) / 180);
      const s = 0.08 + Math.pow(hash(i, 4.4), 3) * 0.6;
      o.position.set(r * Math.sin(a), ramp * crest + s * 0.2, -r * Math.cos(a));
      o.rotation.set(hash(i, 5) * 3, hash(i, 6) * 6, hash(i, 7) * 3);
      o.scale.setScalar(s);
      o.updateMatrix();
      m.push(o.matrix.clone());
    }
    return { geom: g, matrices: m };
  }, [profile, count]);
  return (
    <instancedMesh
      args={[geom, undefined, matrices.length]}
      castShadow
      receiveShadow
      ref={(im) => {
        if (!im) return;
        matrices.forEach((m, i) => im.setMatrixAt(i, m));
        im.instanceMatrix.needsUpdate = true;
      }}
    >
      <meshStandardMaterial map={tex.map} normalMap={tex.normalMap} roughness={0.95} color="#a8a49e" />
    </instancedMesh>
  );
}

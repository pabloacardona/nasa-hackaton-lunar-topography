"use client";
// Terreno lunar polar (anillos × 360°) con material PBR de regolito.
// GARANTÍA FÍSICA: la cresta en el radio R tiene exactamente la altura angular del
// perfil de horizonte (horizonProfileDeg) y el terreno interior nunca la supera,
// así lo que se ve coincide con el cálculo de visibilidad Sol/Tierra.
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { terrainAt } from "@/lib/lunarMath";
import { TIER, type Tier } from "@/store/useGfxStore";
import { texPaths, usePbrSet } from "../textures";

export const TERRAIN_R = 60; // radio donde está la cresta del horizonte

/** Puntos de impacto de los rayos bloqueados (los escribe <Beam>, los lee el material del terreno). */
export type HitUniforms = ReturnType<typeof makeHitUniforms>;
export const makeHitUniforms = () => ({
  uHitA: { value: new THREE.Vector3() }, uHitAOn: { value: 0 },
  uHitB: { value: new THREE.Vector3() }, uHitBOn: { value: 0 },
  uHitColor: { value: new THREE.Color("#ff2a1f") }, uHitTime: { value: 0 },
});

/** Actualiza el punto de impacto (se llama cada frame desde <Beam>, sin re-render). */
export function writeHit(h: HitUniforms, slot: "A" | "B", pos: THREE.Vector3, target: number, dt: number, time: number) {
  const p = slot === "A" ? h.uHitA : h.uHitB;
  const on = slot === "A" ? h.uHitAOn : h.uHitBOn;
  p.value.copy(pos);
  on.value += (target - on.value) * Math.min(1, dt * 6);
  if (slot === "A") h.uHitTime.value = time;
}

export function resetHits(h: HitUniforms) {
  h.uHitAOn.value = 0;
  h.uHitBOn.value = 0;
}

const FRAG_HEAD = /* glsl */ `
  varying vec3 vWPos;
  uniform vec3 uHitA; uniform float uHitAOn; uniform vec3 uHitB; uniform float uHitBOn; uniform vec3 uHitColor; uniform float uHitTime;
  float tHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float tNoise(vec2 p){
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(tHash(i), tHash(i + vec2(1.0, 0.0)), f.x), mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  // Rompe la repetición: mezcla dos copias de la textura con desplazamientos que varían suavemente.
  vec4 untile(sampler2D t, vec2 uv){
    float l = tNoise(uv * 0.31) * 8.0;
    float ia = floor(l), f = fract(l);
    vec2 offa = sin(vec2(3.0, 7.0) * ia), offb = sin(vec2(3.0, 7.0) * (ia + 1.0));
    vec2 dx = dFdx(uv), dy = dFdy(uv);
    vec4 ca = textureGrad(t, uv + offa, dx, dy), cb = textureGrad(t, uv + offb, dx, dy);
    return mix(ca, cb, smoothstep(0.2, 0.8, f - 0.1 * dot(ca.rgb - cb.rgb, vec3(1.0))));
  }
  // Luz roja translúcida del impacto: se suma al color y se modula con el relieve para que la topografía se lea.
  vec3 hitGlow(vec3 hit, float on, vec3 wN, float lum){
    if (on < 0.01) return vec3(0.0);
    float d = distance(vWPos, hit);
    float core = exp(-d * d / 420.0);
    float ripple = (0.5 + 0.5 * sin(d * 1.1 - uHitTime * 5.0)) * exp(-d / 18.0);
    vec3 lp = hit + vec3(-hit.x, 0.0, -hit.z) * 0.14 + vec3(0.0, 5.0, 0.0);
    float relief = 0.25 + 0.75 * max(dot(wN, normalize(lp - vWPos)), 0.0);
    return min(uHitColor * on * (core * 1.7 + ripple * 0.55) * relief * (0.4 + 2.2 * lum), vec3(3.0));
  }
`;

function patchRegolith(m: THREE.MeshStandardMaterial, hits: HitUniforms) {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, hits);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\n" + FRAG_HEAD)
      .replace("#include <map_fragment>", /* glsl */ `
        float tDist = length(vWPos.xz);
        vec4 sampledDiffuseColor = mix(untile(map, vMapUv), untile(map, vMapUv * 0.27 + 3.1), smoothstep(12.0, 55.0, tDist) * 0.75);
        sampledDiffuseColor.rgb *= 0.92 + 0.16 * tNoise(vWPos.xz * 0.6);
        diffuseColor *= sampledDiffuseColor;`)
      .replace("#include <normal_fragment_maps>", THREE.ShaderChunk.normal_fragment_maps.replace("texture2D( normalMap, vNormalMapUv )", "untile( normalMap, vNormalMapUv )"))
      .replace("#include <emissivemap_fragment>", /* glsl */ `#include <emissivemap_fragment>
        {
          vec3 wN = inverseTransformDirection(normal, viewMatrix);
          float lum = dot(diffuseColor.rgb, vec3(0.333));
          totalEmissiveRadiance += hitGlow(uHitA, uHitAOn, wN, lum) + hitGlow(uHitB, uHitBOn, wN, lum);
        }`);
  };
  m.customProgramCacheKey = () => "regolith-untile-hit";
}
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

// ---------------------------------------------------------------- Cráteres modelados (geometría real)
interface Crater { x: number; z: number; r: number; depth: number; rim: number }

/** Campo de cráteres determinista por sitio. Ninguno a menos de 5 m del lander (zona de alunizaje plana). */
export function makeCraters(seed: number, count: number): Crater[] {
  const out: Crater[] = [];
  for (let i = 0; out.length < count && i < count * 4; i++) {
    const k = seed * 13.37 + i * 7.13;
    const r = 0.9 + Math.pow(hash(k, 1.7), 3.2) * 9.5; // muchos pequeños, pocos grandes
    const dist = 5.5 + r + Math.pow(hash(k, 2.9), 0.8) * (TERRAIN_R * 0.93 - 5.5 - 2 * r); // el cuenco completo queda antes de la cresta
    const a = hash(k, 4.3) * Math.PI * 2;
    const x = dist * Math.sin(a), z = -dist * Math.cos(a);
    if (out.some((c) => Math.hypot(c.x - x, c.z - z) < (c.r + r) * 0.75)) continue; // sin solapes grandes
    const fresh = hash(k, 5.5); // 0 = viejo y suave, 1 = joven y marcado
    // El borde nunca supera 0,2° visto desde el lander: no altera el horizonte calculado.
    out.push({ x, z, r, depth: r * (0.1 + 0.12 * fresh), rim: Math.min(r * 0.035 * (0.4 + fresh), dist * 0.0035) });
  }
  return out;
}

/** Desplazamiento vertical y tono (0 fondo oscuro … 1 borde claro) de los cráteres en un punto. */
function craterAt(cr: Crater[], x: number, z: number) {
  let dy = 0, tone = 0;
  for (const c of cr) {
    const dx = x - c.x, dz = z - c.z;
    const lim = c.r * 1.9;
    if (Math.abs(dx) > lim || Math.abs(dz) > lim) continue;
    const d = Math.hypot(dx, dz) / c.r;
    if (d >= 1.9) continue;
    if (d < 1) {
      const bowl = 1 - d * d;
      dy += -c.depth * bowl * (0.75 + 0.25 * bowl) + c.rim * d * d * d; // cuenco parabólico de fondo algo plano
      tone += -0.55 * bowl + 0.5 * d * d * d;
    } else {
      const f = 1 - (d - 1) / 0.9; // falda de eyecta
      dy += c.rim * f * f;
      tone += 0.5 * f * f;
    }
  }
  return { dy, tone };
}

/** Altura del terreno (sin cráteres) en un punto: rampa hasta la cresta del horizonte + ondulación suave. */
function baseHeight(profile: number[], x: number, z: number) {
  const r = Math.hypot(x, z);
  const az = ((Math.atan2(x, -z) * 180) / Math.PI + 360) % 360;
  const crest = TERRAIN_R * Math.tan((Math.max(terrainAt(profile, az), -1) * Math.PI) / 180);
  let y: number;
  if (r <= TERRAIN_R) {
    // ramp(r) <= r/R  => ángulo visto desde el lander <= ángulo del horizonte
    y = Math.pow(smooth(TERRAIN_R * 0.3, TERRAIN_R, r), 1.6) * (r / TERRAIN_R) * crest;
  } else {
    y = crest * (1 - 0.35 * smooth(TERRAIN_R, SKIRT_R, r)); // falda detrás de la cresta
  }
  // ondulación: limitada a < 0,25° de altura angular y nula bajo el lander
  const n = vnoise(x * 0.09, z * 0.09) * 0.55 + vnoise(x * 0.35, z * 0.35) * 0.3 + vnoise(x * 1.3, z * 1.3) * 0.15 - 0.5;
  return y + n * Math.min(0.5, Math.max(0, r - 3) * 0.004);
}

/** Altura final (para apoyar rocas). */
export function terrainHeight(profile: number[], craters: Crater[], x: number, z: number) {
  const inside = Math.hypot(x, z) < TERRAIN_R * 0.97;
  return baseHeight(profile, x, z) + (inside ? craterAt(craters, x, z).dy : 0);
}

export function buildTerrain(profile: number[], rings: number, craters: Crater[]) {
  const pos: number[] = [];
  const uv: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const radii: number[] = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    radii.push(0.4 + Math.pow(t, 1.35) * (SKIRT_R - 0.4)); // más densidad cerca del lander
  }
  for (let i = 0; i < radii.length; i++) {
    const r = radii[i];
    for (let j = 0; j <= SEG; j++) {
      const a = ((j % SEG) * (360 / SEG) * Math.PI) / 180;
      const x = r * Math.sin(a);
      const z = -r * Math.cos(a);
      const c = r < TERRAIN_R * 0.97 ? craterAt(craters, x, z) : { dy: 0, tone: 0 };
      pos.push(x, baseHeight(profile, x, z) + c.dy, z);
      uv.push(x / 8, z / 8);
      // Tono por vértice: fondo de cráter más oscuro, bordes y eyecta más claros,
      // halo claro bajo el lander (el motor barre el polvo) y manchas a gran escala.
      const blast = 0.16 * Math.exp(-(r * r) / 30);
      const macro = (vnoise(x * 0.045 + 9.1, z * 0.045) - 0.5) * 0.22;
      const v = Math.min(1.35, Math.max(0.55, 1 + c.tone * 0.3 + blast + macro));
      col.push(v, v, v * 0.985);
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
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export function LunarTerrain({ profile, tier, mare, hits, seed }: { profile: number[]; tier: Tier; mare: boolean; hits: HitUniforms; seed: number }) {
  const rings = TIER[tier].terrainRings;
  const geom = useMemo(() => buildTerrain(profile, rings, makeCraters(seed, tier === "high" ? 70 : 40)), [profile, rings, seed, tier]);
  useEffect(() => () => geom.dispose(), [geom]);
  const tex = usePbrSet(texPaths(tier).regolith, { repeat: 1, aniso: TIER[tier].aniso, tile: true });
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      map: tex.map, normalMap: tex.normalMap, normalScale: new THREE.Vector2(1.2, 1.2), roughnessMap: tex.orm ?? null, aoMap: tex.orm ?? null,
      aoMapIntensity: 0.9, roughness: 1, metalness: 0, vertexColors: true, color: mare ? "#8f8c88" : "#c9c6c0",
    });
    patchRegolith(m, hits);
    return m;
  }, [tex.map, tex.normalMap, tex.orm, mare, hits]);
  useEffect(() => () => material.dispose(), [material]);
  return <mesh geometry={geom} material={material} receiveShadow castShadow />;
}

/** Rocas instanciadas (1 draw call). Decorativas: pequeñas, no alteran el horizonte. */
export function Boulders({ profile, tier, count = 140, seed }: { profile: number[]; tier: Tier; count?: number; seed: number }) {
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
    const craters = makeCraters(seed, tier === "high" ? 70 : 40);
    for (let i = 0; i < count; i++) {
      // 1 de cada 3 rocas se agrupa junto al borde de un cráter (bloques de eyecta), el resto dispersas
      let x: number, z: number;
      const c = craters[Math.floor(hash(i, 9.9) * craters.length)];
      if (i % 3 === 0 && c && c.r > 2) {
        const a = hash(i, 2.2) * Math.PI * 2, d = c.r * (0.95 + hash(i, 1.1) * 0.6);
        x = c.x + Math.cos(a) * d; z = c.z + Math.sin(a) * d;
      } else {
        const r = 3.5 + Math.pow(hash(i, 1.1), 0.7) * (TERRAIN_R * 0.75), a = hash(i, 2.2) * Math.PI * 2;
        x = r * Math.sin(a); z = -r * Math.cos(a);
      }
      if (Math.hypot(x, z) < 3.5) continue;
      const s = 0.06 + Math.pow(hash(i, 4.4), 3) * 0.6;
      o.position.set(x, terrainHeight(profile, craters, x, z) + s * 0.2, z);
      o.rotation.set(hash(i, 5) * 3, hash(i, 6) * 6, hash(i, 7) * 3);
      o.scale.set(s, s * (0.6 + hash(i, 8) * 0.5), s * (0.8 + hash(i, 3) * 0.5));
      o.updateMatrix();
      m.push(o.matrix.clone());
    }
    return { geom: g, matrices: m };
  }, [profile, count, seed, tier]);
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

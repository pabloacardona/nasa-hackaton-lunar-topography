"use client";
// Sol (HDR emisivo + halo) y Tierra (Blue Marble con FASE real iluminada por el Sol + atmósfera).
// Posiciones actualizadas en useFrame desde el cabezal de reproducción.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { texPaths, useSrgbTexture } from "../textures";
import type { Tier } from "@/store/useGfxStore";
import type { HourSample } from "@/lib/types";
import { azElToVec3 } from "@/lib/lunarMath";
import { getPlayhead, newFrameSample, sampleTimeline } from "./frame";
import { useMissionStore } from "@/store/useMissionStore";

/** Distancia "de cielo" (más allá de la falda del terreno para que el relieve los oculte de verdad). */
export const SKY_R = 170;
/** Tamaños aparentes exagerados ~4x (reales: Sol 0.53°, Tierra 1.9°) para legibilidad. */
export const SUN_RADIUS = 4.5;
export const EARTH_RADIUS = 5.5;

/** Sol + luz direccional con sombras que solo se recalculan si el Sol se movió > 0,2°. */
export function SunAndLight({ timeline, tier, shadowSize }: { timeline: HourSample[]; tier: Tier; shadowSize: number }) {
  const glow = useSrgbTexture(texPaths(tier).vfx.glow, 1);
  const group = useRef<THREE.Group>(null);
  const light = useRef<THREE.DirectionalLight>(null);
  const halo = useRef<THREE.Sprite>(null);
  const fs = useMemo(() => newFrameSample(), []);
  const last = useRef({ az: -999, el: -999, t: 0 });

  useFrame(({ clock, gl }) => {
    const s = sampleTimeline(timeline, getPlayhead(), fs);
    if (!s || !group.current || !light.current) return;
    const [x, y, z] = azElToVec3(s.sunAz, s.sunEl, SKY_R);
    group.current.position.set(x, y, z);
    light.current.position.set(x, y, z);
    light.current.intensity = s.sunEl > -1.5 ? 6.5 : 0;
    if (halo.current) halo.current.material.rotation = clock.elapsedTime * 0.02;
    // Sombras: recalcular solo si el Sol se movió; durante la reproducción, como máximo 5 veces/s
    const moved = Math.abs(s.sunAz - last.current.az) > 0.2 || Math.abs(s.sunEl - last.current.el) > 0.05;
    const now = clock.elapsedTime;
    const playing = useMissionStore.getState().isPlaying;
    if (moved && (!playing || now - last.current.t > 0.2)) {
      last.current = { az: s.sunAz, el: s.sunEl, t: now };
      gl.shadowMap.needsUpdate = true;
    }
  });

  return (
    <>
      <directionalLight ref={light} intensity={6.5} color="#fffaf0" castShadow shadow-mapSize={[shadowSize, shadowSize]} shadow-bias={-0.0004} shadow-normalBias={0.06}>
        <orthographicCamera attach="shadow-camera" args={[-105, 105, 105, -105, 1, 500]} />
      </directionalLight>
      <group ref={group}>
        <mesh>
          <sphereGeometry args={[SUN_RADIUS, 24, 24]} />
          {/* Color HDR > 1 => alimenta el Bloom; sin atmósfera el Sol es blanco */}
          <meshBasicMaterial color={new THREE.Color(12, 11.2, 9.5)} toneMapped={false} />
        </mesh>
        <sprite ref={halo} scale={[SUN_RADIUS * 6.5, SUN_RADIUS * 6.5, 1]}>
          <spriteMaterial map={glow} color="#fff4e0" transparent blending={THREE.AdditiveBlending} depthWrite={false} opacity={0.7} />
        </sprite>
      </group>
    </>
  );
}

const earthVert = /* glsl */ `
  varying vec2 vUv; varying vec3 vNormalW; varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const earthFrag = /* glsl */ `
  uniform sampler2D dayMap; uniform vec3 sunDir;
  varying vec2 vUv; varying vec3 vNormalW; varying vec3 vViewDir;
  void main() {
    vec3 day = texture2D(dayMap, vUv).rgb;
    float l = dot(normalize(vNormalW), normalize(sunDir));
    float lit = smoothstep(-0.08, 0.18, l);
    float fres = pow(1.0 - max(dot(vNormalW, vViewDir), 0.0), 3.0);
    vec3 col = day * (0.03 + 1.6 * lit) + vec3(0.35, 0.6, 1.0) * fres * (0.25 + 1.2 * lit);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;
const atmoFrag = /* glsl */ `
  uniform vec3 sunDir; varying vec3 vNormalW; varying vec3 vViewDir; varying vec2 vUv;
  void main() {
    float rim = pow(1.0 - abs(dot(vNormalW, vViewDir)), 2.5);
    float lit = smoothstep(-0.3, 0.4, dot(vNormalW, normalize(sunDir)));
    gl_FragColor = vec4(vec3(0.3, 0.6, 1.0) * rim * (0.2 + 1.5 * lit), rim);
  }`;

/** Tierra: fase según la dirección real del Sol (se ve "Tierra creciente/llena" como desde la Luna). */
export function EarthBody({ timeline, tier }: { timeline: HourSample[]; tier: Tier }) {
  const map = useSrgbTexture(texPaths(tier).earth.map, 4);
  const group = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Mesh>(null);
  const earthMat = useRef<THREE.ShaderMaterial>(null);
  const atmoMat = useRef<THREE.ShaderMaterial>(null);
  const fs = useMemo(() => newFrameSample(), []);
  const uniforms = useMemo(() => ({ dayMap: { value: map }, sunDir: { value: new THREE.Vector3(1, 0, 0) } }), [map]);
  const atmoUniforms = useMemo(() => ({ sunDir: { value: new THREE.Vector3(1, 0, 0) } }), []);

  useFrame(() => {
    const s = sampleTimeline(timeline, getPlayhead(), fs);
    if (!s || !group.current) return;
    const [x, y, z] = azElToVec3(s.earthAz, s.earthEl, SKY_R * 0.92);
    group.current.position.set(x, y, z);
    const [sx, sy, sz] = azElToVec3(s.sunAz, s.sunEl, 1);
    earthMat.current?.uniforms.sunDir.value.set(sx, sy, sz);
    atmoMat.current?.uniforms.sunDir.value.set(sx, sy, sz);
    if (spin.current) spin.current.rotation.y = (s.hour / 24) * Math.PI * 2;
  });

  return (
    <group ref={group}>
      <group rotation={[0.41, 0, 0]}>
        <mesh ref={spin}>
          <sphereGeometry args={[EARTH_RADIUS, 48, 48]} />
          <shaderMaterial ref={earthMat} vertexShader={earthVert} fragmentShader={earthFrag} uniforms={uniforms} />
        </mesh>
        <mesh scale={1.08}>
          <sphereGeometry args={[EARTH_RADIUS, 32, 32]} />
          <shaderMaterial ref={atmoMat} vertexShader={earthVert} fragmentShader={atmoFrag} uniforms={atmoUniforms}
            transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.BackSide} />
        </mesh>
      </group>
    </group>
  );
}

/** Luz cenicienta: la Tierra ilumina débilmente la superficie. */
export function Earthshine({ timeline }: { timeline: HourSample[] }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const fs = useMemo(() => newFrameSample(), []);
  useFrame(() => {
    const s = sampleTimeline(timeline, getPlayhead(), fs);
    if (!s || !light.current) return;
    const [x, y, z] = azElToVec3(s.earthAz, s.earthEl, 100);
    light.current.position.set(x, y, z);
    light.current.intensity = s.earthEl > 0 ? 0.12 : 0;
  });
  return <directionalLight ref={light} intensity={0.12} color="#9cc4ff" />;
}

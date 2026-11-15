"use client";
// VFX optimizados: haz DTE (geometría unitaria escalada, sin recrear), chispas siempre montadas
// (solo se ocultan), polvo con shader y post-procesado ligero (Bloom a media resolución).
import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import { Bloom, EffectComposer, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { TIER, type Tier } from "@/store/useGfxStore";
import type { HourSample } from "@/lib/types";
import { azElToVec3 } from "@/lib/lunarMath";
import { texPaths, useSrgbTexture } from "../textures";
import { getPlayhead, newFrameSample, sampleTimeline } from "./frame";
import { TERRAIN_R, writeHit, type HitUniforms } from "./LunarTerrain";
import { SKY_R } from "./CelestialBodies";

// ------------------------------------------------------------ Rayos (Tierra y Sol)
const beamVert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const beamFrag = /* glsl */ `
  uniform float uTime; uniform vec3 uColor; uniform float uLen; uniform float uFlow; uniform float uIntensity; varying vec2 vUv;
  float hash(float n){ return fract(sin(n) * 43758.5453); }
  void main(){
    float x = abs(vUv.x - 0.5) * 2.0;
    float core = exp(-x * x * 60.0);                 // núcleo fino
    float halo = exp(-x * x * 5.0) * 0.35;           // halo suave
    float s = vUv.y * uLen * 0.06 - uTime * 1.8 * uFlow;
    float packets = smoothstep(0.82, 1.0, fract(s)) * (0.6 + 0.4 * hash(floor(s)));
    float flicker = 0.85 + 0.15 * sin(uTime * 23.0 + vUv.y * 40.0);
    float fade = smoothstep(0.0, 0.02, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
    float a = (core * (0.9 + packets * 2.5) + halo * (0.6 + packets)) * fade * flicker * uIntensity;
    gl_FragColor = vec4(uColor * (1.2 + core * 2.5 + packets * 3.0), a);
  }`;
// Partículas que viajan por el rayo
const sparkVert = /* glsl */ `
  uniform vec3 uStart; uniform vec3 uEnd; uniform float uTime; uniform float uFlow; attribute float aSeed; varying float vA;
  void main(){
    float t = fract(aSeed + uTime * (0.05 + aSeed * 0.05) * uFlow);
    if (uFlow < 0.0) t = 1.0 - fract(aSeed - uTime * (0.05 + aSeed * 0.05));
    vec3 p = mix(uStart, uEnd, t);
    p += vec3(sin(aSeed * 91.0 + uTime), cos(aSeed * 57.0 + uTime * 1.3), sin(aSeed * 13.0 - uTime)) * 0.12;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = clamp(60.0 / -mv.z, 1.5, 7.0);
    vA = smoothstep(0.0, 0.05, t) * smoothstep(1.0, 0.85, t);
    gl_Position = projectionMatrix * mv;
  }`;
const sparkFrag = /* glsl */ `
  uniform vec3 uColor; uniform float uIntensity; varying float vA;
  void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA * uIntensity; gl_FragColor = vec4(uColor * 2.5, a); }`;

const UP = new THREE.Vector3(0, 1, 0);
const C_EARTH_FULL = new THREE.Color("#33ffb4"), C_EARTH_DEG = new THREE.Color("#b794ff"), C_BLOCK = new THREE.Color("#ff3b3b");
const C_SUN_HIGH = new THREE.Color("#fff3b0"), C_SUN_LOW = new THREE.Color("#ffb020");

type BeamKind = "earth" | "sun";

/**
 * Rayo genérico. Tierra: sale de la antena hacia la Tierra (verde / violeta degradado / rojo bloqueado).
 * Sol: llega desde el Sol al panel (amarillo intenso con mucha potencia, ámbar con poca, rojo si una montaña lo tapa).
 */
export function Beam({ timeline, kind, anchor, hits }: { timeline: HourSample[]; kind: BeamKind; anchor: THREE.Vector3; hits: HitUniforms }) {
  const group = useRef<THREE.Group>(null);
  const sparks = useRef<THREE.Group>(null);
  const flare = useRef<THREE.Sprite>(null);
  const beamMat = useRef<THREE.ShaderMaterial>(null);
  const pts = useRef<THREE.ShaderMaterial>(null);
  const glow = useSrgbTexture(texPaths("low").vfx.glow, 1);
  const fs = useMemo(() => newFrameSample(), []);
  const v = useMemo(() => ({ dir: new THREE.Vector3(), end: new THREE.Vector3(), q: new THREE.Quaternion(), c: new THREE.Color() }), []);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uColor: { value: new THREE.Color() }, uLen: { value: 100 }, uFlow: { value: kind === "sun" ? -1 : 1 }, uIntensity: { value: 1 } }), [kind]);
  const pUniforms = useMemo(() => ({ uStart: { value: new THREE.Vector3() }, uEnd: { value: new THREE.Vector3() }, uTime: { value: 0 }, uFlow: { value: kind === "sun" ? -1 : 1 }, uColor: { value: new THREE.Color() }, uIntensity: { value: 1 } }), [kind]);
  const seeds = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = 36;
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(Float32Array.from({ length: n }, (_, i) => (i * 0.6180339) % 1), 1));
    return g;
  }, []);

  useFrame((_, dt) => {
    const s = sampleTimeline(timeline, getPlayhead(), fs);
    const g = group.current;
    if (!s || !g || !beamMat.current || !pts.current) return;
    const az = kind === "sun" ? s.sunAz : s.earthAz;
    const el = kind === "sun" ? s.sunEl : s.earthEl;
    const visible = kind === "sun" ? s.sunVisible : s.earthVisible;
    const [x, y, z] = azElToVec3(az, el, 1);
    v.dir.set(x, y, z);
    const len = visible ? SKY_R * (kind === "sun" ? 0.98 : 0.9) : TERRAIN_R / Math.cos((Math.max(0.5, el) * Math.PI) / 180);
    v.end.copy(anchor).addScaledVector(v.dir, len);
    g.position.copy(anchor).addScaledVector(v.dir, len / 2);
    g.quaternion.copy(v.q.setFromUnitVectors(UP, v.dir));
    g.scale.set(1, len, 1);
    // color por estado
    if (!visible) v.c.copy(C_BLOCK);
    else if (kind === "earth") v.c.copy(s.dte === "full" ? C_EARTH_FULL : C_EARTH_DEG);
    else v.c.copy(C_SUN_LOW).lerp(C_SUN_HIGH, Math.min(1, Math.max(0, (el + 1) / 6)));
    const u = beamMat.current.uniforms;
    u.uTime.value += dt;
    u.uLen.value = len;
    u.uColor.value.copy(v.c);
    u.uIntensity.value = visible ? 1 : 0.8;
    const p = pts.current.uniforms;
    p.uTime.value = u.uTime.value;
    p.uStart.value.copy(anchor);
    p.uEnd.value.copy(v.end);
    p.uColor.value.copy(v.c);
    writeHit(hits, kind === "earth" ? "A" : "B", v.end, visible ? 0 : 1, dt, u.uTime.value);
    if (sparks.current) {
      sparks.current.visible = !visible;
      sparks.current.position.copy(v.end);
    }
    if (flare.current) {
      flare.current.position.copy(visible ? anchor : v.end);
      (flare.current.material as THREE.SpriteMaterial).color.copy(v.c);
      const k = 0.9 + Math.sin(u.uTime.value * 6) * 0.15;
      flare.current.scale.setScalar((visible ? 1.1 : 4.2) * k);
    }
  });

  return (
    <>
      <group ref={group}>
        {[0, Math.PI / 3, (2 * Math.PI) / 3].map((ry) => (
          <mesh key={ry} rotation={[0, ry, 0]} frustumCulled={false}>
            <planeGeometry args={[kind === "sun" ? 0.9 : 0.7, 1, 1, 1]} />
            <shaderMaterial ref={ry === 0 ? beamMat : undefined} vertexShader={beamVert} fragmentShader={beamFrag} uniforms={uniforms}
              transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <points geometry={seeds} frustumCulled={false}>
        <shaderMaterial ref={pts} vertexShader={sparkVert} fragmentShader={sparkFrag} uniforms={pUniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <sprite ref={flare}>
        <spriteMaterial map={glow} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      <group ref={sparks} visible={false}>
        <Sparkles count={30} scale={3} size={6} speed={1.5} color={kind === "sun" ? "#ff7a3c" : "#ff5a3c"} />
      </group>
    </>
  );
}

// ------------------------------------------------------------ Polvo lunar
const dustVert = /* glsl */ `
  uniform float uTime; uniform float uSize; attribute float aSeed; varying float vA;
  void main(){
    vec3 p = position;
    p.y += sin(uTime * 0.3 + aSeed * 30.0) * 0.25 + mod(uTime * 0.05 + aSeed, 1.0) * 0.6;
    p.x += sin(uTime * 0.11 + aSeed * 11.0) * 0.6;
    p.z += cos(uTime * 0.09 + aSeed * 7.0) * 0.6;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = clamp(uSize * (0.3 + aSeed) * (30.0 / -mv.z), 0.0, 6.0);
    vA = 0.35 + 0.65 * fract(aSeed * 13.0);
    gl_Position = projectionMatrix * mv;
  }`;
const dustFrag = /* glsl */ `
  uniform sampler2D uTex; uniform float uLight; varying float vA;
  void main(){
    float a = texture2D(uTex, gl_PointCoord).a * vA * uLight;
    gl_FragColor = vec4(vec3(1.0, 0.97, 0.92), a * 0.35);
  }`;

/** Polvo levitado electrostáticamente (fenómeno real cerca del terminador lunar). */
export function DustField({ tier, timeline }: { tier: Tier; timeline: HourSample[] }) {
  const tex = useSrgbTexture(texPaths(tier).vfx.dust, 1);
  const count = TIER[tier].dust;
  const fs = useMemo(() => newFrameSample(), []);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    const s = new Float32Array(count);
    const rnd = (i: number, k: number) => {
      const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };
    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(rnd(i, 1)) * 28;
      const a = rnd(i, 2) * Math.PI * 2;
      p.set([Math.cos(a) * r, rnd(i, 3) * 2.2, Math.sin(a) * r], i * 3);
      s[i] = rnd(i, 4);
    }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(s, 1));
    return g;
  }, [count]);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uSize: { value: 1.4 }, uTex: { value: tex }, uLight: { value: 1 } }), [tex]);
  useFrame((_, dt) => {
    const u = mat.current?.uniforms;
    if (!u) return;
    const s = sampleTimeline(timeline, getPlayhead(), fs);
    u.uTime.value += dt;
    u.uLight.value = THREE.MathUtils.lerp(u.uLight.value, s?.sunVisible ? 1 : 0.12, 0.05);
  });
  return (
    <points geometry={geom} frustumCulled={false}>
      <shaderMaterial ref={mat} vertexShader={dustVert} fragmentShader={dustFrag} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// ------------------------------------------------------------ Post-procesado (ligero)
export const Effects = memo(function Effects({ tier, enabled }: { tier: Tier; enabled: boolean }) {
  if (!enabled) {
    return (
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    );
  }
  return (
    <EffectComposer multisampling={0} enableNormalPass={false} resolutionScale={tier === "high" ? 1 : 0.75}>
      {tier === "high" ? <SMAA /> : <></>}
      <Bloom mipmapBlur intensity={tier === "high" ? 1.0 : 0.7} luminanceThreshold={0.95} luminanceSmoothing={0.2} resolutionScale={0.5} levels={tier === "high" ? 6 : 4} />
      <Vignette offset={0.25} darkness={0.7} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
});

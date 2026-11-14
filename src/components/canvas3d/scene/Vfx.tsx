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
import { TERRAIN_R } from "./LunarTerrain";
import { SKY_R } from "./CelestialBodies";

// ------------------------------------------------------------ Haz DTE
const beamVert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const beamFrag = /* glsl */ `
  uniform float uTime; uniform vec3 uColor; uniform float uLen; varying vec2 vUv;
  void main(){
    float core = pow(1.0 - abs(vUv.x - 0.5) * 2.0, 3.0);
    float pulses = smoothstep(0.75, 1.0, fract(vUv.y * uLen * 0.08 - uTime * 1.6));
    float fade = smoothstep(0.0, 0.03, vUv.y) * smoothstep(1.0, 0.92, vUv.y);
    gl_FragColor = vec4(uColor * (1.0 + pulses * 3.0), (0.25 + pulses * 1.2) * core * fade);
  }`;

const ANTENNA = new THREE.Vector3(0.55, 2.2, 0.55);
const UP = new THREE.Vector3(0, 1, 0);
const C_FULL = new THREE.Color("#3bff9a"), C_DEG = new THREE.Color("#b794ff"), C_NONE = new THREE.Color("#ff3b3b");

export function DteBeam({ timeline }: { timeline: HourSample[] }) {
  const group = useRef<THREE.Group>(null);
  const sparks = useRef<THREE.Group>(null);
  const fs = useMemo(() => newFrameSample(), []);
  const v = useMemo(() => ({ dir: new THREE.Vector3(), end: new THREE.Vector3(), q: new THREE.Quaternion() }), []);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uColor: { value: new THREE.Color("#3bff9a") }, uLen: { value: 100 } }), []);
  const mat = useRef<THREE.ShaderMaterial>(null);

  useFrame((_, dt) => {
    const s = sampleTimeline(timeline, getPlayhead(), fs);
    const g = group.current;
    if (!s || !g || !mat.current) return;
    const [x, y, z] = azElToVec3(s.earthAz, s.earthEl, 1);
    v.dir.set(x, y, z);
    const len = s.earthVisible ? SKY_R * 0.92 : TERRAIN_R / Math.cos((Math.max(0.5, s.earthEl) * Math.PI) / 180);
    v.end.copy(ANTENNA).addScaledVector(v.dir, len);
    g.position.copy(ANTENNA).addScaledVector(v.dir, len / 2);
    g.quaternion.copy(v.q.setFromUnitVectors(UP, v.dir));
    g.scale.set(1, len, 1);
    const u = mat.current.uniforms;
    u.uTime.value += dt;
    u.uLen.value = len;
    u.uColor.value.copy(s.dte === "full" ? C_FULL : s.dte === "degraded" ? C_DEG : C_NONE);
    if (sparks.current) {
      sparks.current.visible = !s.earthVisible;
      sparks.current.position.copy(v.end);
    }
  });

  return (
    <>
      <group ref={group}>
        {[0, Math.PI / 2].map((ry) => (
          <mesh key={ry} rotation={[0, ry, 0]}>
            <planeGeometry args={[0.6, 1, 1, 1]} />
            <shaderMaterial ref={ry === 0 ? mat : undefined} vertexShader={beamVert} fragmentShader={beamFrag} uniforms={uniforms}
              transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <group ref={sparks} visible={false}>
        <Sparkles count={30} scale={3} size={6} speed={1.5} color="#ff5a3c" />
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

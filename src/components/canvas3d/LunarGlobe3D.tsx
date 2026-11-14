"use client";
// Globo lunar HD:
//  - Albedo LROC 4K + normal map 4K derivado del DEM LOLA 16 px/° (NASA CGI Moon Kit)
//  - Sombreado Lunar-Lambert (mezcla Lommel-Seeliger + Lambert): el regolito no se oscurece
//    hacia el limbo como una esfera "plástica" -> aspecto realista de Luna llena / cuarto.
//  - Terminador real: dirección del Sol del escenario activo en la hora actual.
//  - Tierra en su dirección real; pines de sitios y escenarios con pulso.
import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls, PerformanceMonitor, Stars } from "@react-three/drei";
import { Bloom, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { useMissionStore } from "@/store/useMissionStore";
import { TIER, useGfxStore, useTier, type Tier } from "@/store/useGfxStore";
import { SCENARIO_COLORS } from "@/lib/types";
import { azElToBody, enuBasis } from "@/lib/geo";
import { texPaths, usePbrSet, useSrgbTexture } from "./textures";
import { getPlayhead, newFrameSample, sampleTimeline } from "./scene/frame";

export function latLonToVec(lat: number, lon: number, r: number): [number, number, number] {
  const phi = (lat * Math.PI) / 180;
  const lam = (lon * Math.PI) / 180;
  return [r * Math.cos(phi) * Math.sin(lam), r * Math.sin(phi), r * Math.cos(phi) * Math.cos(lam)];
}
/** Vector del marco lunar (X→lon0, Y→lon90E, Z→norte) a coordenadas de la escena (x=Y, y=Z, z=X). */
const bodyToScene = (v: number[]) => new THREE.Vector3(v[1], v[2], v[0]);

const moonVert = /* glsl */ `
  varying vec2 vUv; varying vec3 vPos; varying vec3 vView;
  void main(){
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPos = wp.xyz;
    vView = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const moonFrag = /* glsl */ `
  uniform sampler2D albedoMap; uniform sampler2D normalMap; uniform vec3 sunDir; uniform vec3 earthDir; uniform float normalStrength;
  varying vec2 vUv; varying vec3 vPos; varying vec3 vView;
  void main(){
    vec3 n = normalize(vPos);
    vec3 east = normalize(vec3(n.z, 0.0, -n.x) + 1e-5);
    vec3 north = cross(n, east);
    vec3 t = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
    vec3 N = normalize(t.x * normalStrength * east + t.y * normalStrength * north + t.z * n);
    float mu0 = max(dot(N, sunDir), 0.0);
    float mu = max(dot(N, vView), 1e-3);
    float ls = 2.0 * mu0 / (mu0 + mu);                // Lommel-Seeliger
    float refl = 0.75 * ls + 0.25 * mu0;              // Lunar-Lambert (L ~ 0.75)
    float terminator = smoothstep(-0.02, 0.06, dot(n, sunDir));
    vec3 alb = texture2D(albedoMap, vUv).rgb;
    float earthshine = 0.012 * max(dot(n, earthDir), 0.0) * (1.0 - terminator);
    vec3 col = alb * (refl * 1.35 * terminator + earthshine);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

function Pulse({ color }: { color: string }) {
  const m = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!m.current) return;
    const t = (clock.elapsedTime % 1.6) / 1.6;
    m.current.scale.setScalar(1 + t * 3);
    (m.current.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - t);
  });
  return (
    <mesh ref={m}>
      <ringGeometry args={[0.025, 0.032, 32]} />
      <meshBasicMaterial color={color} transparent side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function Moon({ tier }: { tier: Tier }) {
  const dataset = useMissionStore((s) => s.dataset);
  const scenarios = useMissionStore((s) => s.scenarios);
  const activeLabel = useMissionStore((s) => s.activeLabel);
  const setSite = useMissionStore((s) => s.setSite);
  const tex = usePbrSet(texPaths(tier).moon, { aniso: TIER[tier].aniso });
  const earthTex = useSrgbTexture(texPaths(tier).earth.map, 4);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const earth = useRef<THREE.Mesh>(null);
  const fs = useMemo(() => newFrameSample(), []);
  const uniforms = useMemo(
    () => ({ albedoMap: { value: tex.map }, normalMap: { value: tex.normalMap }, sunDir: { value: new THREE.Vector3(1, 0, 0) }, earthDir: { value: new THREE.Vector3(0, 0, 1) }, normalStrength: { value: 0.75 } }),
    [tex.map, tex.normalMap]
  );
  const active = scenarios.find((s) => s.label === activeLabel) ?? scenarios[0];

  useFrame(() => {
    if (!active?.timeline.length || !mat.current) return;
    const s = sampleTimeline(active.timeline, getPlayhead(), fs);
    if (!s) return;
    const b = enuBasis(active);
    const sun = bodyToScene(azElToBody(s.sunAz, s.sunEl, b)).normalize();
    const ear = bodyToScene(azElToBody(s.earthAz, s.earthEl, b)).normalize();
    mat.current.uniforms.sunDir.value.copy(sun);
    mat.current.uniforms.earthDir.value.copy(ear);
    earth.current?.position.copy(ear).multiplyScalar(9);
  });

  return (
    <>
      <mesh rotation={[0, -Math.PI / 2, 0]}>
        <sphereGeometry args={[1, tier === "high" ? 256 : 96, tier === "high" ? 128 : 48]} />
        <shaderMaterial ref={mat} vertexShader={moonVert} fragmentShader={moonFrag} uniforms={uniforms} />
      </mesh>
      <mesh ref={earth} position={[0, 0, 9]}>
        <sphereGeometry args={[0.37, 48, 48]} />
        <meshBasicMaterial map={earthTex} />
      </mesh>
      {dataset?.sites.map((s) => {
        const sel = scenarios.find((sc) => sc.siteId === s.id)?.label;
        return <Pin key={s.id} lat={s.lat} lon={s.lon} color={sel ? SCENARIO_COLORS[sel] : "#facc15"} label={sel ? `${sel} · ${s.name}` : undefined}
          onClick={() => setSite(activeLabel, s.id)} />;
      })}
      {scenarios.filter((sc) => sc.siteId === "custom").map((sc) => (
        <Pin key={sc.label} lat={sc.lat} lon={sc.lon} color={SCENARIO_COLORS[sc.label]} label={`${sc.label} · ${sc.siteName}`} />
      ))}
    </>
  );
}

function Pin({ lat, lon, color, label, onClick }: { lat: number; lon: number; color: string; label?: string; onClick?: () => void }) {
  const p = latLonToVec(lat, lon, 1.003);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...p).normalize());
  return (
    <group position={p} quaternion={q}>
      <mesh onClick={onClick}>
        <circleGeometry args={[0.016, 20]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {label && <Pulse color={color} />}
      {label && (
        <Html distanceFactor={4} className="pointer-events-none whitespace-nowrap text-[10px] text-white drop-shadow">
          {label}
        </Html>
      )}
    </group>
  );
}

export default function LunarGlobe3D() {
  const tier = useTier();
  const vfx = useGfxStore((s) => s.vfx);
  const setAutoTier = useGfxStore((s) => s.setAutoTier);
  return (
    <div className="h-[480px] overflow-hidden rounded-lg bg-black" id="tour-globe">
      <Canvas flat dpr={TIER[tier].dpr} camera={{ position: [0, -2.2, 2.6], fov: 45 }} gl={{ antialias: true }}>
        <PerformanceMonitor onDecline={() => setAutoTier("low")} />
        <color attach="background" args={["#000003"]} />
        <Stars radius={120} count={tier === "high" ? 4000 : 1500} fade saturation={0} />
        <Suspense fallback={null}>
          <Moon tier={tier} />
        </Suspense>
        <OrbitControls enablePan={false} minDistance={1.25} maxDistance={8} enableDamping />
        <EffectComposer multisampling={0}>
          {vfx ? <Bloom mipmapBlur intensity={0.6} luminanceThreshold={0.9} resolutionScale={0.5} /> : <></>}
          {vfx ? <Vignette offset={0.3} darkness={0.7} /> : <></>}
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      </Canvas>
      <p className="px-2 py-1 text-[11px] text-slate-400">
        NASA CGI Moon Kit: color LROC + relieve LOLA (4K). Iluminación real del escenario activo en la hora actual. Clic en un sitio = asignarlo al escenario activo.
      </p>
    </div>
  );
}

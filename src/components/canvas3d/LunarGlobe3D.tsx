"use client";
// Globo lunar interactivo:
//  - Clic en la superficie => mueve el escenario activo + calcula el panal de abeja + zoom a la zona.
//  - Hexágonos del panal dibujados SOBRE la Luna con su % de aptitud; clic en un hexágono = seleccionarlo.
//  - Textura 4K (LROC) + normal LOLA; sombreado Lunar-Lambert; terminador real o luz de inspección.
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { CameraControls, Html, PerformanceMonitor, Stars } from "@react-three/drei";
import { Bloom, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { Loader2, Maximize2, Sun as SunIcon, Lightbulb } from "lucide-react";
import { useMissionStore } from "@/store/useMissionStore";
import { useUiStore } from "@/store/useUiStore";
import { TIER, useGfxStore, useTier, type Tier } from "@/store/useGfxStore";
import { SCENARIO_COLORS } from "@/lib/types";
import { azElToBody, destination, enuBasis } from "@/lib/geo";
import { aptitudeColor } from "@/lib/lunarMath";
import { exploreAt } from "@/lib/explore";
import { texPaths, usePbrSet, useSrgbTexture } from "./textures";
import { getPlayhead, newFrameSample, sampleTimeline } from "./scene/frame";

export function latLonToVec(lat: number, lon: number, r: number): [number, number, number] {
  const phi = (lat * Math.PI) / 180;
  const lam = (lon * Math.PI) / 180;
  return [r * Math.cos(phi) * Math.sin(lam), r * Math.sin(phi), r * Math.cos(phi) * Math.cos(lam)];
}
const vecToLatLon = (v: THREE.Vector3) => {
  const n = v.clone().normalize();
  return { lat: (Math.asin(n.y) * 180) / Math.PI, lon: (Math.atan2(n.x, n.z) * 180) / Math.PI };
};
/** Vector del marco lunar (X→lon0, Y→lon90E, Z→norte) a coordenadas de la escena. */
const bodyToScene = (v: number[]) => new THREE.Vector3(v[1], v[2], v[0]);
const R_KM = 1737.4;

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
  uniform sampler2D albedoMap; uniform sampler2D normalMap; uniform vec3 sunDir; uniform vec3 earthDir;
  uniform float normalStrength; uniform float inspect;
  uniform float exposure;
  varying vec2 vUv; varying vec3 vPos; varying vec3 vView;
  void main(){
    vec3 n = normalize(vPos);
    vec3 east = normalize(vec3(n.z, 0.0, -n.x) + 1e-5);
    vec3 north = cross(n, east);
    vec3 t = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
    vec3 N = normalize(t.x * normalStrength * east + t.y * normalStrength * north + t.z * n);
    vec3 L = normalize(mix(sunDir, normalize(vView + north * 0.6 + east * 0.3), inspect));
    float mu0 = max(dot(N, L), 0.0);
    float mu = max(dot(N, vView), 1e-3);
    float refl = 0.75 * (2.0 * mu0 / (mu0 + mu)) + 0.25 * mu0;  // Lunar-Lambert
    float terminator = mix(smoothstep(-0.02, 0.06, dot(n, sunDir)), 1.0, inspect);
    vec3 alb = texture2D(albedoMap, vUv).rgb;
    float earthshine = 0.012 * max(dot(n, earthDir), 0.0) * (1.0 - terminator);
    gl_FragColor = vec4(alb * (refl * 1.35 * terminator + earthshine + inspect * 0.05) * exposure, 1.0);
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
      <ringGeometry args={[0.012, 0.016, 32]} />
      <meshBasicMaterial color={color} transparent side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function Pin({ lat, lon, color, label, onClick }: { lat: number; lon: number; color: string; label?: string; onClick?: () => void }) {
  const p = latLonToVec(lat, lon, 1.0006);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...p).normalize());
  const g = useRef<THREE.Group>(null);
  const wp = useMemo(() => new THREE.Vector3(), []);
  // Tamaño constante en pantalla: al hacer zoom el marcador no tapa el panal.
  useFrame(({ camera }) => {
    if (!g.current) return;
    g.current.getWorldPosition(wp);
    g.current.scale.setScalar(THREE.MathUtils.clamp(camera.position.distanceTo(wp) / 3.2, 0.002, 1));
  });
  return (
    <group ref={g} position={p} quaternion={q}>
      <mesh onClick={(e) => { e.stopPropagation(); onClick?.(); }}>
        <circleGeometry args={[0.008, 20]} />
        <meshBasicMaterial color={color} toneMapped={false} depthTest={false} />
      </mesh>
      {label && <Pulse color={color} />}
      {label && (
        <Html className="pointer-events-none whitespace-nowrap text-[10px] font-semibold text-white drop-shadow">
          {label}
        </Html>
      )}
    </group>
  );
}

/** Hexágonos del panal sobre la superficie (1 draw call) + etiquetas de aptitud. */
function HoneyOverlay() {
  const honey = useUiStore((s) => s.honey);
  const sel = useUiStore((s) => s.honeySel);
  const setSel = useUiStore((s) => s.setHoneySel);
  const focused = useUiStore((s) => !!s.globeFocus);
  const geo = useMemo(() => {
    if (!honey) return null;
    const pos: number[] = [], col: number[] = [], line: number[] = [];
    const rad = (honey.spacingKm / Math.sqrt(3)) * 1000 * 0.94;
    const c = new THREE.Color();
    honey.results.forEach((r) => {
      const center = new THREE.Vector3(...latLonToVec(r.lat, r.lon, 1.0004));
      const corners = Array.from({ length: 6 }, (_, k) => {
        const d = destination(r.lat, r.lon, 60 * k, rad);
        return new THREE.Vector3(...latLonToVec(d.lat, d.lon, 1.0004));
      });
      c.set(aptitudeColor(r.aptitude));
      for (let k = 0; k < 6; k++) {
        const a = corners[k], b = corners[(k + 1) % 6];
        pos.push(center.x, center.y, center.z, a.x, a.y, a.z, b.x, b.y, b.z);
        for (let j = 0; j < 3; j++) col.push(c.r, c.g, c.b);
        line.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    const l = new THREE.BufferGeometry();
    l.setAttribute("position", new THREE.Float32BufferAttribute(line, 3));
    return { g, l };
  }, [honey]);
  if (!honey || !geo) return null;
  const best = honey.results.reduce((b, r, i) => (r.aptitude > honey.results[b].aptitude ? i : b), 0);

  return (
    <group>
      <mesh geometry={geo.g} onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (e.faceIndex != null) setSel(Math.floor(e.faceIndex / 6)); }}>
        <meshBasicMaterial vertexColors transparent opacity={0.72} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <lineSegments geometry={geo.l}>
        <lineBasicMaterial color="#0b1220" transparent opacity={0.9} />
      </lineSegments>
      {focused && honey.results.map((r, i) => (
        <Html key={i} position={latLonToVec(r.lat, r.lon, 1.0008)} center distanceFactor={0.006 * honey.spacingKm}
          className="pointer-events-none select-none">
          <div className={`rounded px-1 text-[11px] font-bold leading-tight text-white ${i === sel ? "bg-white/90 text-black" : i === best ? "bg-yellow-400/90 text-black" : "bg-black/45"}`}>
            {r.aptitude}%
          </div>
        </Html>
      ))}
    </group>
  );
}

function CameraRig({ controls }: { controls: React.RefObject<CameraControls | null> }) {
  const focus = useUiStore((s) => s.globeFocus);
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    if (!focus) {
      void c.setLookAt(0, -2.2, 2.6, 0, 0, 0, true);
      return;
    }
    const p = new THREE.Vector3(...latLonToVec(focus.lat, focus.lon, 1));
    const n = p.clone().normalize();
    // dirección "norte" local en la superficie (o eje Z si estamos en el polo)
    const up = new THREE.Vector3(0, 1, 0);
    let north = up.clone().sub(n.clone().multiplyScalar(up.dot(n)));
    if (north.lengthSq() < 1e-6) north = new THREE.Vector3(0, 0, 1);
    north.normalize();
    const d = Math.max(0.014, (focus.extentKm / R_KM) * 1.6);
    const cam = p.clone().addScaledVector(n, d * 0.8).addScaledVector(north, -d * 0.6);
    void c.setLookAt(cam.x, cam.y, cam.z, p.x, p.y, p.z, true);
  }, [focus, controls]);
  return null;
}

function Moon({ tier, inspect }: { tier: Tier; inspect: boolean }) {
  const dataset = useMissionStore((s) => s.dataset);
  const scenarios = useMissionStore((s) => s.scenarios);
  const activeLabel = useMissionStore((s) => s.activeLabel);
  const tex = usePbrSet(texPaths(tier).moon, { aniso: TIER[tier].aniso });
  const earthTex = useSrgbTexture(texPaths(tier).earth.map, 4);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const earth = useRef<THREE.Mesh>(null);
  const fs = useMemo(() => newFrameSample(), []);
  const uniforms = useMemo(
    () => ({ albedoMap: { value: tex.map }, normalMap: { value: tex.normalMap }, sunDir: { value: new THREE.Vector3(1, 0, 0) },
      earthDir: { value: new THREE.Vector3(0, 0, 1) }, normalStrength: { value: 0.75 }, inspect: { value: 0 }, exposure: { value: 1 } }),
    [tex.map, tex.normalMap]
  );
  const active = scenarios.find((s) => s.label === activeLabel) ?? scenarios[0];

  useFrame(({ camera }) => {
    const u = mat.current?.uniforms;
    if (!u) return;
    // De cerca la textura se ve sobreexpuesta: bajamos la exposición para que destaquen los hexágonos.
    u.exposure.value = THREE.MathUtils.clamp(0.5 + (camera.position.length() - 1) * 1.5, 0.5, 1);
    u.inspect.value = THREE.MathUtils.lerp(u.inspect.value, inspect ? 1 : 0, 0.15);
    if (!active?.timeline.length) return;
    const s = sampleTimeline(active.timeline, getPlayhead(), fs);
    if (!s) return;
    const b = enuBasis(active);
    const sun = bodyToScene(azElToBody(s.sunAz, s.sunEl, b)).normalize();
    const ear = bodyToScene(azElToBody(s.earthAz, s.earthEl, b)).normalize();
    u.sunDir.value.copy(sun);
    u.earthDir.value.copy(ear);
    earth.current?.position.copy(ear).multiplyScalar(9);
  });

  const onMoonClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return; // fue un arrastre, no un clic
    e.stopPropagation();
    const { lat, lon } = vecToLatLon(e.point);
    void exploreAt(lat, lon);
  };

  return (
    <>
      <mesh rotation={[0, -Math.PI / 2, 0]} onClick={onMoonClick}>
        <sphereGeometry args={[1, tier === "high" ? 256 : 128, tier === "high" ? 128 : 64]} />
        <shaderMaterial ref={mat} vertexShader={moonVert} fragmentShader={moonFrag} uniforms={uniforms} />
      </mesh>
      <mesh ref={earth} position={[0, 0, 9]}>
        <sphereGeometry args={[0.37, 48, 48]} />
        <meshBasicMaterial map={earthTex} />
      </mesh>
      <HoneyOverlay />
      {dataset?.sites.map((s) => {
        const sel = scenarios.find((sc) => sc.siteId === s.id)?.label;
        return (
          <Pin key={s.id} lat={s.lat} lon={s.lon} color={sel ? SCENARIO_COLORS[sel] : "#facc15"} label={sel ? `${sel} · ${s.name}` : undefined}
            onClick={async () => {
              await useMissionStore.getState().setSite(activeLabel, s.id);
              void exploreAt(s.lat, s.lon, { moveScenario: false });
            }} />
        );
      })}
      {scenarios.filter((sc) => sc.siteId === "custom").map((sc) => (
        <Pin key={sc.label} lat={sc.lat} lon={sc.lon} color={SCENARIO_COLORS[sc.label]} label={sc.label} />
      ))}
    </>
  );
}

export default function LunarGlobe3D() {
  const tier = useTier();
  const vfx = useGfxStore((s) => s.vfx);
  const setAutoTier = useGfxStore((s) => s.setAutoTier);
  const busy = useUiStore((s) => s.honeyBusy);
  const focus = useUiStore((s) => s.globeFocus);
  const clearFocus = useUiStore((s) => s.clearGlobeFocus);
  const es = useMissionStore((s) => s.lang) === "es";
  const controls = useRef<CameraControls | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [inspect, setInspect] = useState(true);

  useEffect(() => {
    if (!box.current) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.01 });
    io.observe(box.current);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={box} className="relative h-[520px] overflow-hidden rounded-xl bg-black" id="tour-globe">
      <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-[60%] text-xs text-slate-200">
        <div className="text-sm font-semibold">{es ? "Explora la Luna" : "Explore the Moon"}</div>
        <div className="text-slate-400">{es ? "Haz clic en cualquier punto: se calcula el panal de abeja y se hace zoom." : "Click anywhere: the honeycomb is computed and the camera zooms in."}</div>
      </div>
      <div className="absolute right-3 top-3 z-10 flex gap-1">
        <button onClick={() => setInspect((v) => !v)} title={inspect ? "Luz real del Sol" : "Luz de inspección"} aria-label="Cambiar iluminación"
          className="flex items-center gap-1 rounded bg-slate-900/85 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700">
          {inspect ? <Lightbulb className="h-3.5 w-3.5" /> : <SunIcon className="h-3.5 w-3.5" />} {inspect ? (es ? "Luz de inspección" : "Inspection light") : (es ? "Luz real" : "Real light")}
        </button>
        {focus && (
          <button onClick={clearFocus} className="flex items-center gap-1 rounded bg-slate-900/85 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700">
            <Maximize2 className="h-3.5 w-3.5" /> {es ? "Ver Luna completa" : "Whole Moon"}
          </button>
        )}
      </div>
      {busy && (
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900/90 px-4 py-1.5 text-xs text-amber-200">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> {es ? "Calculando panal" : "Computing honeycomb"} {busy.done}/{busy.total}
          <div className="h-1.5 w-28 overflow-hidden rounded bg-slate-700"><div className="h-full bg-amber-400" style={{ width: `${(busy.done / busy.total) * 100}%` }} /></div>
        </div>
      )}
      <Canvas flat frameloop={visible ? "always" : "never"} dpr={TIER[tier].dpr} camera={{ position: [0, -2.2, 2.6], fov: 45, near: 0.0005, far: 100 }} gl={{ antialias: true }}>
        <PerformanceMonitor onDecline={() => setAutoTier("low")} />
        <color attach="background" args={["#000003"]} />
        <Stars radius={60} count={tier === "high" ? 4000 : 1500} fade saturation={0} />
        <Suspense fallback={null}>
          <Moon tier={tier} inspect={inspect} />
        </Suspense>
        <CameraControls ref={controls} makeDefault minDistance={0.004} maxDistance={8} smoothTime={0.6} />
        <CameraRig controls={controls} />
        <EffectComposer multisampling={0}>
          {vfx ? <Bloom mipmapBlur intensity={0.5} luminanceThreshold={0.9} resolutionScale={0.5} /> : <></>}
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

"use client";
// Globo lunar interactivo:
//  - Clic en la superficie => mueve el escenario activo + calcula el panal de abeja + zoom a la zona.
//  - Hexágonos del panal dibujados SOBRE la Luna con su % de aptitud; clic en un hexágono = seleccionarlo.
//  - Textura 4K (LROC) + normal LOLA; sombreado Lunar-Lambert; terminador real o luz de inspección.
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { CameraControls, Html, PerformanceMonitor, Stars } from "@react-three/drei";
import { Bloom, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { Hexagon, Loader2, Maximize2, Minus, Plus, Sun as SunIcon, Lightbulb } from "lucide-react";
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
  uniform sampler2D albedoMap; uniform sampler2D normalMap; uniform sampler2D polarMap; uniform vec3 sunDir; uniform vec3 earthDir;
  uniform float normalStrength; uniform float inspect; uniform float exposure; uniform float alt;
  varying vec2 vUv; varying vec3 vPos; varying vec3 vView;
  const float RMAX = 0.0874887; // tan(5°): borde del mapa polar (80°S)
  float h13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float n3(vec3 p){
    vec3 i = floor(p), f = fract(p); f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    return mix(mix(mix(h13(i), h13(i + vec3(1,0,0)), f.x), mix(h13(i + vec3(0,1,0)), h13(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h13(i + vec3(0,0,1)), h13(i + vec3(1,0,1)), f.x), mix(h13(i + vec3(0,1,1)), h13(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  // Manchas suaves de tono (regolito más claro/oscuro), giradas para que no se note la rejilla
  float mottle(vec3 p, float px){
    const mat3 R = mat3(0.36, 0.48, -0.8, -0.8, 0.6, 0.0, 0.48, 0.64, 0.6);
    vec3 q = R * p;
    float a = 0.0, amp = 0.5, f = 350.0;
    for (int i = 0; i < 4; i++) { a += (n3(q * f) - 0.5) * amp * (1.0 - smoothstep(0.1, 0.35, px * f)); f *= 3.3; amp *= 0.7; q = R * q; }
    return a;
  }
  vec3 h33(vec3 p){ p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
  // Cráteres procedurales que aparecen al acercarse (la textura real llega a ~2,7 km/píxel).
  // Devuelve la pendiente (vector 3D) para inclinar la normal: así se iluminan con la misma luz que el resto.
  // Cada octava se activa solo cuando sus cráteres miden varios píxeles => sin parpadeo de lejos ni pixelado de cerca.
  vec3 craterSlope(vec3 p, float px){
    vec3 g = vec3(0.0);
    float f = 220.0;
    for (int o = 0; o < 7; o++) {
      float w = 1.0 - smoothstep(0.02, 0.075, px * f);
      if (w > 0.0) {
        vec3 q = p * f;
        vec3 base = floor(q - 0.5);
        for (int i = 0; i < 8; i++) {
          vec3 cell = base + vec3(float(i & 1), float((i >> 1) & 1), float((i >> 2) & 1));
          vec3 rnd = h33(cell + float(o) * 17.0);
          vec3 c = cell + 0.5 + (rnd - 0.5) * 0.3;
          c *= f / length(c);                       // el centro del cráter se apoya en la superficie
          float r = 0.09 + 0.15 * rnd.z * rnd.z;
          vec3 dv = q - c;
          float d = length(dv) / r;
          if (d < 1.4) {
            float slope = d < 1.0 ? 0.75 * d : -0.4 * (1.0 - (d - 1.0) / 0.4);
            g += normalize(dv + 1e-6) * slope * w;
          }
        }
      }
      f *= 1.8;
    }
    return g;
  }
  void main(){
    vec3 n = normalize(vPos);
    vec3 east = normalize(vec3(n.z, 0.0, -n.x) + 1e-5);
    vec3 north = cross(n, east);
    float px = max(length(dFdx(vPos)), length(dFdy(vPos)));
    float near = 1.0 - smoothstep(0.08, 0.9, alt);          // 0 lejos, 1 cerca
    // Casquete polar sur: relieve LOLA en proyección estereográfica (sin el estiramiento del polo)
    vec2 st = vec2(n.x, n.z) / max(1.0 - n.y, 1e-4) / RMAX;
    float cap = n.y < 0.0 ? 1.0 - smoothstep(0.82, 0.98, length(st)) : 0.0;
    float wPolar = cap * near;
    float poleFade = 1.0 - smoothstep(0.975, 0.998, abs(n.y)); // la normal equirectangular se degenera en los polos
    vec3 t = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
    float ns = normalStrength * poleFade * (1.0 - wPolar) * (1.0 - 0.6 * near);
    vec3 N = normalize(t.x * ns * east + t.y * ns * north + t.z * n);
    float tone = 1.0;
    if (near > 0.002) { // de lejos no se calcula el detalle (ahorra GPU)
      vec3 g = craterSlope(vPos, px);
      g -= n * dot(g, n);
      N = normalize(N - g * near * 0.9);
      tone = 1.0 + near * 0.22 * mottle(vPos, px);
    }
    vec3 L = normalize(mix(sunDir, normalize(vView + north * 0.6 + east * 0.3), inspect));
    float mu0 = max(dot(N, L), 0.0);
    float mu = max(dot(N, vView), 1e-3);
    float refl = 0.75 * (2.0 * mu0 / (mu0 + mu)) + 0.25 * mu0;  // Lunar-Lambert
    float terminator = mix(smoothstep(-0.02, 0.06, dot(n, sunDir)), 1.0, inspect);
    vec3 alb = texture2D(albedoMap, vUv).rgb;
    vec3 hs = texture2D(polarMap, st * 0.5 + 0.5).rgb;
    alb = mix(alb, hs * 0.85 + 0.06, wPolar);
    float litPolar = 0.55 + 0.5 * mix(1.0, mu0 / max(dot(n, L), 0.2), near); // en el polo el relieve grande ya viene sombreado (LOLA)
    float lit = mix(refl * mix(1.35, 1.1, near), litPolar, wPolar) * terminator;
    float earthshine = 0.012 * max(dot(n, earthDir), 0.0) * (1.0 - terminator);
    gl_FragColor = vec4(alb * tone * (lit + earthshine + inspect * 0.05) * exposure, 1.0);
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
  const focused = useUiStore((s) => !!s.globeFocus); // con zoom al panal, los nombres estorban
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
      {label && !focused && <Pulse color={color} />}
      {label && !focused && (
        <Html className="pointer-events-none whitespace-nowrap text-[10px] font-semibold text-white drop-shadow">
          {label}
        </Html>
      )}
    </group>
  );
}

/** Hexágonos del panal sobre la superficie (1 draw call) + etiquetas de aptitud + señal de alunizaje viable. */
function HoneyOverlay() {
  const honey = useUiStore((s) => s.honey);
  const sel = useUiStore((s) => s.honeySel);
  const setSel = useUiStore((s) => s.setHoneySel);
  const focused = useUiStore((s) => !!s.globeFocus);
  const es = useMissionStore((s) => s.lang) === "es";
  const geo = useMemo(() => {
    if (!honey) return null;
    const pos: number[] = [], col: number[] = [], line: number[] = [], ok: number[] = [];
    const rad = (honey.spacingKm / Math.sqrt(3)) * 1000 * 0.94;
    const c = new THREE.Color();
    honey.results.forEach((r) => {
      const center = new THREE.Vector3(...latLonToVec(r.lat, r.lon, 1.0004));
      const corners = Array.from({ length: 6 }, (_, k) => {
        const d = destination(r.lat, r.lon, 60 * k, rad);
        return new THREE.Vector3(...latLonToVec(d.lat, d.lon, 1.0004));
      });
      c.set(aptitudeColor(r.aptitude));
      const viable = r.metrics.viability === "VIABLE";
      for (let k = 0; k < 6; k++) {
        const a = corners[k], b = corners[(k + 1) % 6];
        pos.push(center.x, center.y, center.z, a.x, a.y, a.z, b.x, b.y, b.z);
        for (let j = 0; j < 3; j++) col.push(c.r, c.g, c.b);
        (viable ? ok : line).push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    const l = new THREE.BufferGeometry();
    l.setAttribute("position", new THREE.Float32BufferAttribute(line, 3));
    const v = new THREE.BufferGeometry();
    v.setAttribute("position", new THREE.Float32BufferAttribute(ok, 3));
    return { g, l, v };
  }, [honey]);
  useEffect(() => () => { geo?.g.dispose(); geo?.l.dispose(); geo?.v.dispose(); }, [geo]);
  if (!honey || !geo) return null;
  const best = honey.results.reduce((b, r, i) => (r.aptitude > honey.results[b].aptitude ? i : b), 0);
  const bestR = honey.results[best];
  const bestViable = bestR.metrics.viability === "VIABLE";
  const bp = latLonToVec(bestR.lat, bestR.lon, 1.0009);
  const bq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...bp).normalize());

  return (
    <group>
      <mesh geometry={geo.g} onClick={(e: ThreeEvent<MouseEvent>) => { if (e.delta > 6) return; e.stopPropagation(); if (e.faceIndex != null) setSel(Math.floor(e.faceIndex / 6)); }}>
        <meshBasicMaterial vertexColors transparent opacity={0.5} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <lineSegments geometry={geo.l}>
        <lineBasicMaterial color="#0b1220" transparent opacity={0.85} />
      </lineSegments>
      <lineSegments geometry={geo.v}>
        <lineBasicMaterial color="#86efac" toneMapped={false} />
      </lineSegments>
      {bestViable && (
        <group position={bp} quaternion={bq} scale={(honey.spacingKm / R_KM) * 20}>
          <Pulse color="#86b98f" />
        </group>
      )}
      {focused && honey.results.map((r, i) => {
        const viable = r.metrics.viability === "VIABLE";
        return (
          <Html key={i} position={latLonToVec(r.lat, r.lon, 1.0008)} center distanceFactor={0.006 * honey.spacingKm} zIndexRange={[5, 0]}
            className="pointer-events-none select-none">
            <div className="flex flex-col items-center gap-0.5">
              {i === best && bestViable && (
                <div className="whitespace-nowrap rounded bg-[#7fb39a] px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-black shadow-lg ring-2 ring-white">
                   {es ? "Alunizaje viable" : "Landing viable"}
                </div>
              )}
              <div className={`whitespace-nowrap rounded px-1 text-[11px] font-bold leading-tight ${i === sel ? "bg-white text-black" : viable ? "bg-[#5f9a7e]/95 text-black ring-1 ring-white/70" : "bg-black/55 text-white"}`}>
                {viable ? " " : ""}{r.aptitude}%
              </div>
            </div>
          </Html>
        );
      })}
    </group>
  );
}

const MIN_ALT = 0.005, MAX_ALT = 7;

/** Cámara siempre mirando al centro de la Luna (vista cenital): zoom por altitud y giro proporcional a la altitud. */
function CameraRig({ controls, box }: { controls: React.RefObject<CameraControls | null>; box: React.RefObject<HTMLDivElement | null> }) {
  const focus = useUiStore((s) => s.globeFocus);
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    if (!focus) {
      void c.setLookAt(0, -2.2, 2.6, 0, 0, 0, true);
      return;
    }
    const n = new THREE.Vector3(...latLonToVec(focus.lat, focus.lon, 1));
    const d = THREE.MathUtils.clamp((focus.extentKm / R_KM) * 1.2, MIN_ALT * 2, 2);
    const cam = n.multiplyScalar(1 + d);
    void c.setLookAt(cam.x, cam.y, cam.z, 0, 0, 0, true);
  }, [focus, controls]);

  // Rueda: zoom exponencial sobre la ALTITUD (no sobre la distancia al centro) => suave de lejos y de cerca.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const c = controls.current;
      if (!c) return;
      e.preventDefault();
      zoomBy(c, Math.exp(THREE.MathUtils.clamp(e.deltaY, -240, 240) * 0.0022));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [box, controls]);

  useFrame(({ camera }) => {
    const c = controls.current;
    if (!c) return;
    const alt = Math.max(MIN_ALT, camera.position.length() - 1);
    const k = THREE.MathUtils.clamp(alt * 0.75, 0.0035, 1);
    setRotateSpeed(c, k);
  });
  return null;
}

function setRotateSpeed(c: CameraControls, k: number) {
  c.azimuthRotateSpeed = k;
  c.polarRotateSpeed = k;
}

function zoomBy(c: CameraControls, factor: number) {
  const alt = THREE.MathUtils.clamp((c.distance - 1) * factor, MIN_ALT, MAX_ALT);
  void c.dollyTo(1 + alt, true);
}

function Moon({ tier, inspect, onHover }: { tier: Tier; inspect: boolean; onHover: (p: { lat: number; lon: number } | null) => void }) {
  const dataset = useMissionStore((s) => s.dataset);
  const scenarios = useMissionStore((s) => s.scenarios);
  const activeLabel = useMissionStore((s) => s.activeLabel);
  const tex = usePbrSet(texPaths(tier).moon, { aniso: TIER[tier].aniso });
  const polar = useSrgbTexture(texPaths(tier).polarMap, TIER[tier].aniso);
  const earthTex = useSrgbTexture(texPaths(tier).earth.map, 4);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const earth = useRef<THREE.Mesh>(null);
  const fs = useMemo(() => newFrameSample(), []);
  const uniforms = useMemo(
    () => ({ albedoMap: { value: tex.map }, normalMap: { value: tex.normalMap }, polarMap: { value: polar }, sunDir: { value: new THREE.Vector3(1, 0, 0) },
      earthDir: { value: new THREE.Vector3(0, 0, 1) }, normalStrength: { value: 0.75 }, inspect: { value: 0 }, exposure: { value: 1 }, alt: { value: 2 } }),
    [tex.map, tex.normalMap, polar]
  );
  const active = scenarios.find((s) => s.label === activeLabel) ?? scenarios[0];

  useFrame(({ camera }) => {
    const u = mat.current?.uniforms;
    if (!u) return;
    const alt = camera.position.length() - 1;
    u.alt.value = alt;
    // De cerca bajamos un poco la exposición para que destaquen los hexágonos.
    u.exposure.value = THREE.MathUtils.clamp(0.62 + alt * 1.2, 0.62, 1);
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
      <mesh rotation={[0, -Math.PI / 2, 0]} onClick={onMoonClick}
        onPointerMove={(e) => onHover(vecToLatLon(e.point))} onPointerOut={() => onHover(null)}>
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
          <Pin key={s.id} lat={s.lat} lon={s.lon} color={sel ? SCENARIO_COLORS[sel] : "#c9a85e"} label={sel ? `${sel} · ${s.name}` : undefined}
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
  const honey = useUiStore((s) => s.honey);
  const focus = useUiStore((s) => s.globeFocus);
  const clearFocus = useUiStore((s) => s.clearGlobeFocus);
  const es = useMissionStore((s) => s.lang) === "es";
  const controls = useRef<CameraControls | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const coord = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(true);
  const [inspect, setInspect] = useState(true);

  useEffect(() => {
    if (!box.current) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.01 });
    io.observe(box.current);
    return () => io.disconnect();
  }, []);

  // Coordenada bajo el cursor: se escribe directo en el DOM (sin re-render).
  const onHover = useCallback((p: { lat: number; lon: number } | null) => {
    if (coord.current) coord.current.textContent = p ? `${p.lat.toFixed(3)}°, ${p.lon.toFixed(3)}°` : "—";
  }, []);

  const viable = honey ? honey.results.filter((r) => r.metrics.viability === "VIABLE").length : 0;
  const bestApt = honey ? Math.max(...honey.results.map((r) => r.aptitude)) : 0;
  const btn = "flex h-10 w-10 items-center justify-center rounded-full border border-slate-600 bg-slate-900/90 text-slate-100 transition hover:scale-110 hover:bg-[#3a5a7a]";

  return (
    <div ref={box} className="relative h-[560px] cursor-crosshair overflow-hidden rounded-3xl border-2 border-[#4f7396]/60 bg-black" id="tour-globe">
      <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-[55%] rounded-lg bg-slate-950/70 px-2 py-1 text-xs text-slate-200">
        <div className="font-display text-base font-extrabold text-white"> {es ? "Toca la Luna para explorar" : "Tap the Moon to explore"}</div>
        <div className="text-slate-400">{es ? " Arrastra = girar · rueda o +/− = acercar · clic = explorar ese punto" : " Drag = rotate · wheel or +/− = zoom · click = explore that point"}</div>
      </div>
      <div className="absolute right-3 top-3 z-10 flex gap-1">
        <button onClick={() => setInspect((v) => !v)} title={inspect ? "Luz real del Sol" : "Luz de inspección"} aria-label="Cambiar iluminación"
          className="flex items-center gap-1 rounded bg-slate-900/85 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700">
          {inspect ? <Lightbulb className="h-3.5 w-3.5" /> : <SunIcon className="h-3.5 w-3.5" />} {inspect ? (es ? "Luz de inspección" : "Inspection light") : (es ? "Luz real" : "Real light")}
        </button>
      </div>
      <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1">
        <button className={btn} aria-label={es ? "Acercar" : "Zoom in"} title={es ? "Acercar" : "Zoom in"} onClick={() => controls.current && zoomBy(controls.current, 0.55)}><Plus className="h-4 w-4" /></button>
        <button className={btn} aria-label={es ? "Alejar" : "Zoom out"} title={es ? "Alejar" : "Zoom out"} onClick={() => controls.current && zoomBy(controls.current, 1.8)}><Minus className="h-4 w-4" /></button>
        <button className={btn} aria-label={es ? "Ver Luna completa" : "Whole Moon"} title={es ? "Ver Luna completa" : "Whole Moon"}
          onClick={() => { clearFocus(); void controls.current?.setLookAt(0, -2.2, 2.6, 0, 0, 0, true); }}><Maximize2 className="h-4 w-4" /></button>
        {honey && !focus && (
          <button className={btn} aria-label={es ? "Volver al panal" : "Back to honeycomb"} title={es ? "Volver al panal" : "Back to honeycomb"}
            onClick={() => useUiStore.getState().focusGlobe(honey.centerLat, honey.centerLon, honey.spacingKm * (honey.rings + 1) * 2.4)}><Hexagon className="h-4 w-4" /></button>
        )}
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded bg-slate-900/80 px-2 py-1 font-mono text-[11px] text-slate-300">
        <span ref={coord}>—</span>
        {focus && <span className="ml-2 font-sans text-slate-400">{es ? "· cráteres pequeños ilustrativos; el cálculo usa el relieve LOLA real" : "· small craters are illustrative; maths use real LOLA terrain"}</span>}
      </div>
      {busy ? (
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900/90 px-4 py-1.5 text-xs text-[#e6d3ad]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> {es ? "Calculando panal" : "Computing honeycomb"} {busy.done}/{busy.total}
          <div className="h-1.5 w-28 overflow-hidden rounded bg-slate-700"><div className="h-full bg-[#c9a66b]" style={{ width: `${(busy.done / busy.total) * 100}%` }} /></div>
        </div>
      ) : honey && (
        <div role="status" className={`pointer-events-none absolute left-1/2 top-12 z-10 -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-1.5 font-display text-sm font-extrabold shadow-lg ${viable ? "glow-ok bg-[#7fb39a] text-black ring-2 ring-white/80" : "bg-[#884a4e]/95 text-white"}`}>
          {viable
            ? (es ? ` ALUNIZAJE VIABLE · ${viable} de ${honey.results.length} celdas · mejor ${bestApt}%` : ` LANDING VIABLE · ${viable} of ${honey.results.length} cells · best ${bestApt}%`)
            : (es ? ` Ninguna celda viable aquí (mejor ${bestApt}%). Prueba otro punto u otra fecha.` : ` No viable cell here (best ${bestApt}%). Try another point or date.`)}
        </div>
      )}
      <Canvas flat frameloop={visible ? "always" : "never"} dpr={TIER[tier].dpr} camera={{ position: [0, -2.2, 2.6], fov: 45, near: 0.001, far: 100 }} gl={{ antialias: true }}>
        <PerformanceMonitor onDecline={() => setAutoTier("low")} />
        <color attach="background" args={["#000003"]} />
        <Stars radius={60} count={tier === "high" ? 4000 : 1500} fade saturation={0} />
        <Suspense fallback={null}>
          <Moon tier={tier} inspect={inspect} onHover={onHover} />
        </Suspense>
        <CameraControls ref={controls} makeDefault minDistance={1 + MIN_ALT} maxDistance={1 + MAX_ALT} smoothTime={0.35} draggingSmoothTime={0.08}
          mouseButtons={{ left: 1, middle: 0, right: 1, wheel: 0 }} touches={{ one: 64, two: 0, three: 0 }} />
        <CameraRig controls={controls} box={box} />
        <EffectComposer multisampling={0}>
          {vfx ? <Bloom mipmapBlur intensity={0.5} luminanceThreshold={0.9} resolutionScale={0.5} /> : <></>}
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

"use client";
// Horizonte local 3D (hasta 2 vistas simultáneas). Optimizaciones:
// - El movimiento (Sol, luz, Tierra, haz, panel, antena) se actualiza en useFrame sin re-render de React.
// - Sombras con actualización manual (solo cuando el Sol se mueve) => a 30x no se recalculan cada frame.
// - DPR reducido durante la reproducción rápida; canvas fuera de pantalla se pausa (frameloop="never").
import { memo, Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { AdaptiveDpr, CameraControls, PerformanceMonitor, Stars } from "@react-three/drei";
import { Eye, Globe2, Sun as SunIcon, Plane } from "lucide-react";
import { useMissionStore } from "@/store/useMissionStore";
import { TIER, useGfxStore, useTier, type Tier } from "@/store/useGfxStore";
import { azElToVec3 } from "@/lib/lunarMath";
import { SCENARIO_COLORS, type Scenario } from "@/lib/types";
import { LunarTerrain, Boulders } from "./scene/LunarTerrain";
import { Lander } from "./scene/Lander";
import { EarthBody, Earthshine, SunAndLight } from "./scene/CelestialBodies";
import { DteBeam, DustField, Effects } from "./scene/Vfx";

const MARE_SITES = new Set(["apollo_11", "mare_crisium", "apollo_15"]);
type CamPreset = "lander" | "sun" | "earth" | "aerial";

/** Ajustes del renderer: sombras manuales y DPR más bajo al reproducir rápido. */
function RenderTuning({ tier, profileKey }: { tier: Tier; profileKey: string }) {
  const getThree = useThree((s) => s.get);
  const setDpr = useThree((s) => s.setDpr);
  const isPlaying = useMissionStore((s) => s.isPlaying);
  const speed = useMissionStore((s) => s.speed);
  useEffect(() => {
    const { gl } = getThree();
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
  }, [getThree, profileKey]);
  useEffect(() => {
    const [lo, hi] = TIER[tier].dpr;
    setDpr(isPlaying && speed >= 10 ? lo : hi);
  }, [isPlaying, speed, tier, setDpr]);
  return null;
}

const Scene = memo(function Scene({ sc, tier, controls }: { sc: Scenario; tier: Tier; controls: React.RefObject<CameraControls | null> }) {
  const vfx = useGfxStore((s) => s.vfx);
  if (!sc.timeline.length) return null;
  return (
    <>
      <RenderTuning tier={tier} profileKey={`${sc.lat},${sc.lon}`} />
      <color attach="background" args={["#000003"]} />
      <Stars radius={400} depth={60} count={tier === "high" ? 4000 : 1500} factor={5} saturation={0} fade speed={0.2} />
      {/* Sin atmósfera: luz ambiente casi nula => sombras negras absolutas */}
      <ambientLight intensity={0.03} />
      <SunAndLight timeline={sc.timeline} tier={tier} shadowSize={TIER[tier].shadow} />
      <Earthshine timeline={sc.timeline} />
      <LunarTerrain profile={sc.horizonProfileDeg} tier={tier} mare={MARE_SITES.has(sc.siteId)} />
      <Boulders profile={sc.horizonProfileDeg} tier={tier} count={tier === "high" ? 140 : 60} />
      <Lander panel={sc.panelType} timeline={sc.timeline} tier={tier} />
      <EarthBody timeline={sc.timeline} tier={tier} />
      {vfx && <DteBeam timeline={sc.timeline} />}
      {vfx && <DustField tier={tier} timeline={sc.timeline} />}
      <CameraControls ref={controls} minDistance={3} maxDistance={140} maxPolarAngle={Math.PI / 2 - 0.03} />
      <Effects tier={tier} enabled={vfx} />
    </>
  );
});

/** HUD aislado: es lo único que se re-renderiza cuando cambia la hora (no el <Canvas>). */
function Hud({ sc }: { sc: Scenario }) {
  const hour = useMissionStore((s) => s.currentHourIndex);
  const h = sc.timeline[hour];
  return (
    <div className="pointer-events-none absolute left-2 top-2 z-10 flex flex-col gap-1 text-xs">
      <span className="font-semibold text-slate-200">{sc.label} · {sc.siteName}</span>
      {h && (
        <span className="flex gap-2" aria-live="polite">
          <span className={`rounded px-1.5 py-0.5 ${h.sunVisible ? "bg-amber-500/80 text-black" : "bg-red-700/80"}`}>☀ {h.sunEl.toFixed(2)}° {h.sunVisible ? "visible" : "tras el relieve"}</span>
          <span className={`rounded px-1.5 py-0.5 ${h.dte === "full" ? "bg-cyan-500/80 text-black" : h.dte === "degraded" ? "bg-violet-500/80" : "bg-red-700/80"}`}>
            🌍 {h.earthEl.toFixed(2)}° {h.dte === "full" ? "DTE" : h.dte === "degraded" ? "multipath" : "bloqueada"}
          </span>
        </span>
      )}
    </div>
  );
}

export function Horizon3DView({ sc }: { sc: Scenario }) {
  const tier = useTier();
  const setAutoTier = useGfxStore((s) => s.setAutoTier);
  const controls = useRef<CameraControls | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!box.current) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.01 });
    io.observe(box.current);
    return () => io.disconnect();
  }, []);

  const goTo = (p: CamPreset) => {
    const c = controls.current;
    const h = sc.timeline[useMissionStore.getState().currentHourIndex];
    if (!c || !h) return;
    if (p === "lander") void c.setLookAt(9, 4.5, 12, 0, 1.5, 0, true);
    if (p === "aerial") void c.setLookAt(0, 70, 40, 0, 0, 0, true);
    if (p === "sun" || p === "earth") {
      const az = p === "sun" ? h.sunAz : h.earthAz;
      const el = p === "sun" ? h.sunEl : h.earthEl;
      const back = azElToVec3(az + 180, 0, 10);
      const tgt = azElToVec3(az, Math.max(el, 0), 60);
      void c.setLookAt(back[0], 3.2, back[2], tgt[0], tgt[1] + 2, tgt[2], true);
    }
  };

  return (
    <div ref={box} className="relative h-[380px] overflow-hidden rounded-lg bg-black" style={{ outline: `1px solid ${SCENARIO_COLORS[sc.label]}55` }}>
      <Hud sc={sc} />
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        {([
          ["lander", <Eye key="e" className="h-3.5 w-3.5" />, "Lander"],
          ["sun", <SunIcon key="s" className="h-3.5 w-3.5" />, "Mirar al Sol"],
          ["earth", <Globe2 key="g" className="h-3.5 w-3.5" />, "Mirar a la Tierra"],
          ["aerial", <Plane key="p" className="h-3.5 w-3.5" />, "Vista aérea"],
        ] as const).map(([p, icon, label]) => (
          <button key={p} title={label} aria-label={label} onClick={() => goTo(p)} className="rounded bg-slate-900/80 p-1.5 text-slate-200 hover:bg-slate-700">
            {icon}
          </button>
        ))}
      </div>
      <Canvas
        shadows
        flat
        frameloop={visible ? "always" : "never"}
        dpr={TIER[tier].dpr}
        camera={{ position: [9, 4.5, 12], fov: 55, near: 0.1, far: 1200 }}
        gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
      >
        <PerformanceMonitor onDecline={() => setAutoTier("low")} />
        <AdaptiveDpr pixelated={false} />
        <Suspense fallback={null}>
          <Scene sc={sc} tier={tier} controls={controls} />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default function LocalHorizon3D() {
  const scenarios = useMissionStore((s) => s.scenarios);
  const view3d = useMissionStore((s) => s.view3d);
  const shown = scenarios.filter((s) => view3d.includes(s.label));
  return (
    <div id="tour-3d">
      <div className={`grid grid-cols-1 gap-2 ${shown.length > 1 ? "lg:grid-cols-2" : ""}`}>
        {shown.map((sc) => (
          <Horizon3DView key={sc.label} sc={sc} />
        ))}
      </div>
      {scenarios.length > 2 && (
        <p className="mt-1 text-[11px] text-slate-500">Máximo 2 vistas 3D a la vez (botón ▣ en cada escenario). Todos los escenarios se ven en el panorama, las tarjetas y la línea de tiempo.</p>
      )}
    </div>
  );
}

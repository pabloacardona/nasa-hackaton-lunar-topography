"use client";
// Horizonte local 3D: hasta 4 vistas (cuadrícula 2×2). Con 3-4 vistas se activa el modo compacto
// (menor resolución, sombras 1024, sin polvo) para mantener la fluidez.
// - El movimiento (Sol, luz, Tierra, rayos, panel, antena) se actualiza en useFrame sin re-render de React.
// - Sombras con actualización manual; DPR reducido al reproducir rápido; vistas fuera de pantalla en pausa.
import { memo, Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { AdaptiveDpr, CameraControls, PerformanceMonitor, Stars } from "@react-three/drei";
import { Eye, Globe2, LayoutGrid, Sun as SunIcon, Plane } from "lucide-react";
import { useMissionStore } from "@/store/useMissionStore";
import { TIER, useGfxStore, useTier, type Tier } from "@/store/useGfxStore";
import { azElToVec3 } from "@/lib/lunarMath";
import { SCENARIO_COLORS, type Scenario } from "@/lib/types";
import { LunarTerrain, Boulders } from "./scene/LunarTerrain";
import { DISH_ANCHOR, Lander, PANEL_ANCHOR } from "./scene/Lander";
import { EarthBody, Earthshine, SunAndLight } from "./scene/CelestialBodies";
import { Beam, DustField, Effects } from "./scene/Vfx";

const MARE_SITES = new Set(["apollo_11", "mare_crisium", "apollo_15"]);
type CamPreset = "lander" | "sun" | "earth" | "aerial";

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

const Scene = memo(function Scene({ sc, tier, compact, controls }: { sc: Scenario; tier: Tier; compact: boolean; controls: React.RefObject<CameraControls | null> }) {
  const vfx = useGfxStore((s) => s.vfx);
  if (!sc.timeline.length) return null;
  return (
    <>
      <RenderTuning tier={tier} profileKey={`${sc.lat},${sc.lon}`} />
      <color attach="background" args={["#000003"]} />
      <Stars radius={400} depth={60} count={compact ? 1200 : tier === "high" ? 4000 : 1500} factor={5} saturation={0} fade speed={0.2} />
      {/* Sin atmósfera: luz ambiente casi nula => sombras negras absolutas */}
      <ambientLight intensity={0.03} />
      <SunAndLight timeline={sc.timeline} tier={tier} shadowSize={compact ? 1024 : TIER[tier].shadow} />
      <Earthshine timeline={sc.timeline} />
      <LunarTerrain profile={sc.horizonProfileDeg} tier={tier} mare={MARE_SITES.has(sc.siteId)} />
      <Boulders profile={sc.horizonProfileDeg} tier={tier} count={compact ? 50 : tier === "high" ? 140 : 60} />
      <Lander panel={sc.panelType} timeline={sc.timeline} tier={tier} />
      <EarthBody timeline={sc.timeline} tier={tier} />
      {vfx && <Beam kind="earth" anchor={DISH_ANCHOR} timeline={sc.timeline} />}
      {vfx && <Beam kind="sun" anchor={PANEL_ANCHOR} timeline={sc.timeline} />}
      {vfx && !compact && <DustField tier={tier} timeline={sc.timeline} />}
      <CameraControls ref={controls} minDistance={3} maxDistance={140} maxPolarAngle={Math.PI / 2 - 0.03} />
      <Effects tier={compact ? "low" : tier} enabled={vfx} />
    </>
  );
});

/** HUD aislado: es lo único que se re-renderiza cuando cambia la hora (no el <Canvas>). */
function Hud({ sc }: { sc: Scenario }) {
  const hour = useMissionStore((s) => s.currentHourIndex);
  const h = sc.timeline[hour];
  return (
    <div className="pointer-events-none absolute left-2 top-2 z-10 flex flex-col gap-1 text-xs">
      <span className="font-semibold text-slate-200"><span style={{ color: SCENARIO_COLORS[sc.label] }}>●</span> {sc.label} · {sc.siteName}</span>
      {h && (
        <span className="flex flex-wrap gap-1.5" aria-live="polite">
          <span className={`rounded px-1.5 py-0.5 ${h.sunVisible ? "bg-amber-400/90 text-black" : "bg-red-700/85"}`}>☀ {h.sunVisible ? "Sol llega al panel" : "Sol tapado"}</span>
          <span className={`rounded px-1.5 py-0.5 ${h.dte === "full" ? "bg-emerald-400/90 text-black" : h.dte === "degraded" ? "bg-violet-500/85" : "bg-red-700/85"}`}>
            🌍 {h.dte === "full" ? "Señal OK" : h.dte === "degraded" ? "Señal débil" : "Sin señal"}
          </span>
        </span>
      )}
    </div>
  );
}

export function Horizon3DView({ sc, compact }: { sc: Scenario; compact: boolean }) {
  const autoTier = useTier();
  const tier: Tier = compact ? "low" : autoTier;
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
    if (p === "lander") void c.setLookAt(9, 4.5, 12, 0, 1.8, 0, true);
    if (p === "aerial") void c.setLookAt(0, 70, 40, 0, 0, 0, true);
    if (p === "sun" || p === "earth") {
      const az = p === "sun" ? h.sunAz : h.earthAz;
      const el = p === "sun" ? h.sunEl : h.earthEl;
      const back = azElToVec3(az + 180, 0, 10);
      const tgt = azElToVec3(az, Math.max(el, 0), 60);
      void c.setLookAt(back[0], 3.4, back[2], tgt[0], tgt[1] + 2, tgt[2], true);
    }
  };

  return (
    <div ref={box} className={`relative overflow-hidden rounded-lg bg-black ${compact ? "h-[300px]" : "h-[400px]"}`} style={{ outline: `1px solid ${SCENARIO_COLORS[sc.label]}55` }}>
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
      <Canvas shadows flat frameloop={visible ? "always" : "never"} dpr={TIER[tier].dpr}
        camera={{ position: [9, 4.5, 12], fov: 55, near: 0.1, far: 1200 }}
        gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}>
        <PerformanceMonitor onDecline={() => setAutoTier("low")} />
        <AdaptiveDpr pixelated={false} />
        <Suspense fallback={null}>
          <Scene sc={sc} tier={tier} compact={compact} controls={controls} />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default function LocalHorizon3D() {
  const scenarios = useMissionStore((s) => s.scenarios);
  const view3d = useMissionStore((s) => s.view3d);
  const es = useMissionStore((s) => s.lang) === "es";
  const { toggleView3d, showAll3d } = useMissionStore.getState();
  const shown = scenarios.filter((s) => view3d.includes(s.label));
  const compact = shown.length > 2;
  return (
    <section id="tour-3d" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
        <span className="font-semibold text-slate-200">{es ? "Vista 3D desde el lander" : "3D view from the lander"}</span>
        <span className="text-slate-500">{es ? "Mostrar:" : "Show:"}</span>
        {scenarios.map((s) => {
          const on = view3d.includes(s.label);
          return (
            <button key={s.label} onClick={() => toggleView3d(s.label)} aria-pressed={on}
              className={`rounded px-2 py-0.5 font-semibold ${on ? "text-black" : "bg-slate-800 text-slate-400"}`} style={on ? { background: SCENARIO_COLORS[s.label] } : undefined}>
              {s.label}
            </button>
          );
        })}
        {scenarios.length > 1 && (
          <button onClick={showAll3d} className="flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 hover:bg-slate-700">
            <LayoutGrid className="h-3 w-3" /> {es ? `Ver ${scenarios.length === 4 ? "los 4" : "todos"}` : "Show all"}
          </button>
        )}
        <span className="ml-auto text-[11px] text-slate-500">
          {es ? "Rayo verde = señal con la Tierra · rayo amarillo = luz del Sol al panel · rojo = una montaña lo bloquea" : "Green beam = Earth link · yellow beam = sunlight to panel · red = blocked by terrain"}
          {compact ? (es ? " · modo compacto" : " · compact mode") : ""}
        </span>
      </div>
      <div className={`grid grid-cols-1 gap-2 ${shown.length > 1 ? "lg:grid-cols-2" : ""}`}>
        {shown.map((sc) => (
          <Horizon3DView key={sc.label} sc={sc} compact={compact} />
        ))}
      </div>
    </section>
  );
}

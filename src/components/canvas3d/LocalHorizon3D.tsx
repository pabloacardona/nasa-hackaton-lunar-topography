"use client";
// Horizonte local 3D: hasta 4 vistas (cuadrícula 2×2). Con 3-4 vistas se activa el modo compacto
// (menor resolución, sombras 1024, sin polvo) para mantener la fluidez.
// - El movimiento (Sol, luz, Tierra, rayos, panel, antena) se actualiza en useFrame sin re-render de React.
// - Sombras con actualización manual; DPR reducido al reproducir rápido; vistas fuera de pantalla en pausa.
import { memo, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { AdaptiveDpr, CameraControls, PerformanceMonitor, Stars } from "@react-three/drei";
import { Eye, Globe2, LayoutGrid, Sun as SunIcon, Plane } from "lucide-react";
import { useMissionStore } from "@/store/useMissionStore";
import { TIER, useGfxStore, useTier, type Tier } from "@/store/useGfxStore";
import { azElToVec3 } from "@/lib/lunarMath";
import { SCENARIO_COLORS, type Scenario } from "@/lib/types";
import { LunarTerrain, Boulders, makeHitUniforms, resetHits } from "./scene/LunarTerrain";
import { DISH_ANCHOR, Lander, PANEL_ANCHOR } from "./scene/Lander";
import { EarthBody, Earthshine, SunAndLight } from "./scene/CelestialBodies";
import { Beam, DustField, Effects } from "./scene/Vfx";
import TimeBar from "@/components/dashboard/TimeBar";

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
  const hits = useMemo(() => makeHitUniforms(), []);
  useEffect(() => { if (!vfx) resetHits(hits); }, [vfx, hits]); // sin rayos no hay resplandor de impacto
  const seed = Math.abs(Math.round(sc.lat * 1000) * 31 + Math.round(sc.lon * 1000)) % 9973; // mismo sitio => mismo terreno
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
      <LunarTerrain profile={sc.horizonProfileDeg} tier={tier} mare={MARE_SITES.has(sc.siteId)} hits={hits} seed={seed} />
      <Boulders profile={sc.horizonProfileDeg} tier={tier} count={compact ? 70 : tier === "high" ? 220 : 90} seed={seed} />
      <Lander panel={sc.panelType} timeline={sc.timeline} tier={tier} />
      <EarthBody timeline={sc.timeline} tier={tier} />
      {vfx && <Beam kind="earth" anchor={DISH_ANCHOR} timeline={sc.timeline} hits={hits} />}
      {vfx && <Beam kind="sun" anchor={PANEL_ANCHOR} timeline={sc.timeline} hits={hits} />}
      {vfx && !compact && <DustField tier={tier} timeline={sc.timeline} />}
      <CameraControls ref={controls} minDistance={3} maxDistance={140} maxPolarAngle={Math.PI / 2 - 0.03} />
      <Effects tier={compact ? "low" : tier} enabled={vfx} />
    </>
  );
});

/** HUD aislado: es lo único que se re-renderiza cuando cambia la hora (no el <Canvas>). */
function Hud({ sc }: { sc: Scenario }) {
  const hour = useMissionStore((s) => s.currentHourIndex);
  const es = useMissionStore((s) => s.lang) === "es";
  const kid = useMissionStore((s) => s.audienceMode) === "educator";
  const h = sc.timeline[hour];
  const v = sc.metrics?.viability;
  const chip = "rounded-full px-2 py-0.5 font-bold shadow";
  return (
    <div className="pointer-events-none absolute left-2 top-2 z-10 flex flex-col gap-1 text-xs">
      <span className="flex w-fit items-center gap-1.5 rounded-full bg-black/60 py-0.5 pl-0.5 pr-2 font-bold text-white">
        <span className="flex h-5 w-5 items-center justify-center rounded-full text-black" style={{ background: SCENARIO_COLORS[sc.label] }}>{sc.label}</span> {sc.siteName}
      </span>
      {v && (
        <span className={`w-fit ${chip} ${v === "VIABLE" ? "bg-[#7fb39a] text-black" : v === "RELAY_REQUIRED" ? "bg-[#c9a66b] text-black" : "bg-[#9a5559] text-white"}`}>
          {v === "VIABLE" ? (kid ? (es ? " ¡Se puede alunizar!" : " We can land!") : " ALUNIZAJE VIABLE")
            : v === "RELAY_REQUIRED" ? (kid ? (es ? " Necesita satélite ayudante" : " Needs a helper satellite") : " Viable solo con satélite relé")
            : (kid ? (es ? " Aquí la nave se congela" : " The lander freezes here") : " No apto: riesgo de congelamiento")}
        </span>
      )}
      {h && (
        <span className="flex flex-wrap gap-1" aria-live="polite">
          <span className={`${chip} ${h.sunVisible ? "bg-[#dcc08f] text-black" : "bg-[#884a4e] text-white"}`}>{h.sunVisible ? (kid ? (es ? "Hay Sol" : "Sunny") : "Sol llega al panel") : (kid ? (es ? "Sin Sol" : "No Sun") : "Sol tapado")}</span>
          <span className={`${chip} ${h.dte === "full" ? "bg-[#a6cdb8] text-black" : h.dte === "degraded" ? "bg-[#9d8fc2] text-black" : "bg-[#884a4e] text-white"}`}>
            {h.dte === "full" ? (kid ? (es ? "Tierra conectada" : "Earth connected") : "Señal OK") : h.dte === "degraded" ? (es ? "Señal débil" : "Weak signal") : (es ? "Sin señal" : "No signal")}
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
    <div ref={box} className={`relative overflow-hidden rounded-2xl bg-black ${compact ? "h-[300px]" : "h-[420px]"}`} style={{ outline: `2px solid ${SCENARIO_COLORS[sc.label]}` }}>
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
        <span className="font-bold text-slate-200">{es ? "Ver naves:" : "Show landers:"}</span>
        {scenarios.map((s) => {
          const on = view3d.includes(s.label);
          return (
            <button key={s.label} onClick={() => toggleView3d(s.label)} aria-pressed={on} title={s.siteName}
              className={`h-7 w-7 rounded-full font-display text-sm font-extrabold transition hover:scale-110 ${on ? "text-black" : "bg-slate-800 text-slate-400"}`} style={on ? { background: SCENARIO_COLORS[s.label] } : undefined}>
              {s.label}
            </button>
          );
        })}
        {scenarios.length > 1 && (
          <button onClick={showAll3d} className="flex items-center gap-1 rounded-full bg-slate-800 px-3 py-1 font-bold hover:bg-slate-700">
            <LayoutGrid className="h-3 w-3" /> {es ? `Ver ${scenarios.length === 4 ? "las 4" : "todas"}` : "Show all"}
          </button>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          <span><i className="mr-1 inline-block h-1.5 w-5 rounded bg-[#dcc08f] align-middle" />{es ? "luz del Sol" : "sunlight"}</span>
          <span><i className="mr-1 inline-block h-1.5 w-5 rounded bg-[#7fb39a] align-middle" />{es ? "señal con la Tierra" : "Earth link"}</span>
          <span><i className="mr-1 inline-block h-1.5 w-5 rounded bg-[#9d8fc2] align-middle" />{es ? "señal débil" : "weak link"}</span>
          <span><i className="mr-1 inline-block h-1.5 w-5 rounded bg-[#b86b6e] align-middle" />{es ? "una montaña lo tapa" : "blocked by a mountain"}</span>
          {compact && <span className="text-slate-500">{es ? "· modo rápido" : "· fast mode"}</span>}
        </span>
      </div>
      <div className={`grid grid-cols-1 gap-2 ${shown.length > 1 ? "lg:grid-cols-2" : ""}`}>
        {shown.map((sc) => (
          <Horizon3DView key={sc.label} sc={sc} compact={compact} />
        ))}
      </div>
      <TimeBar />
    </section>
  );
}

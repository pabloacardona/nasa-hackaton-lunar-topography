"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useMissionStore } from "@/store/useMissionStore";
import ScenarioSelector from "@/components/dashboard/ScenarioSelector";
import MetricsComparison from "@/components/dashboard/MetricsComparison";
import LunarTimelineGantt from "@/components/dashboard/LunarTimelineGantt";
import HorizonSkyplot2D from "@/components/canvas3d/HorizonSkyplot2D";
import EducatorOverlay from "@/components/copilot/EducatorOverlay";
import MissionVoiceAgent from "@/components/copilot/MissionVoiceAgent";
import MissionBriefModal from "@/components/copilot/MissionBriefModal";
import HoneycombPanel from "@/components/analysis/HoneycombPanel";
import SeasonsHeatmap from "@/components/analysis/SeasonsHeatmap";
import PolarMap from "@/components/analysis/PolarMap";
import EarthVsMoon from "@/components/analysis/EarthVsMoon";
import EnergyThermalChart from "@/components/analysis/EnergyThermalChart";
import TourGuide from "@/components/TourGuide";
import LiveTranslate from "@/components/LiveTranslate";
import DemoOverlay from "@/components/DemoOverlay";
import Collapsible from "@/components/ui/Collapsible";
import ChatDock from "@/components/copilot/ChatDock";
import { SCENARIO_COLORS } from "@/lib/types";

// Three.js solo en el cliente
const LocalHorizon3D = dynamic(() => import("@/components/canvas3d/LocalHorizon3D"), { ssr: false });
const LunarGlobe3D = dynamic(() => import("@/components/canvas3d/LunarGlobe3D"), { ssr: false });

const INSTRUCTIONS = `Eres el Flight Director de una misión lunar (NASA CLPS/Artemis). Responde en el idioma del estado (language), breve (2-4 frases) porque tus respuestas se leen en voz alta.
Usa SIEMPRE los datos del estado compartido (escenarios A-D) y cita números: % de luz, % DTE, ventana dorada, SoC mínimo, horas a sunset/earthset.
Reglas físicas: sin atmósfera; un astro es visible solo si su elevación supera la altura del terreno (LOLA) en ese azimut. En el polo sur el Sol va al ras (0-5°) y los paneles son verticales; la Tierra libra ±7°; si está <1° sobre la cresta el enlace es degradado (multipath).
Sin Sol / batería agotada = riesgo de congelamiento (rojo). Sin Tierra pero con Sol = relé (amarillo).
Si preguntan cómo usar la herramienta o qué significa un número, responde con el glosario del estado (toolGlossary) en lenguaje sencillo.
Cuando el usuario pida comparar, retrasar, buscar fechas (findBestLandingWindow), analizar puntos cercanos (analyzeNearbyPoints), cambiar coordenadas, ir a un evento, generar informe o demo: EJECUTA la acción y luego da el veredicto.
Antes de recomendar cambiar un sitio usa SIEMPRE recommendSiteChange (pide aprobación).
En modo "educator" explica con analogías simples; en "engineer" usa grados, W/m², % y horas.`;

const STEPS = [
  { id: "step-1", emoji: "", color: "#5f8fb8", es: "Elige el lugar", en: "Pick the place" },
  { id: "step-2", emoji: "", color: "#a88bb8", es: "Mira tu nave", en: "Watch your lander" },
  { id: "step-3", emoji: "", color: "#8fb07a", es: "Revisa los datos", en: "Check the data" },
] as const;

/** Navegación fija de 3 pasos: siempre sabes dónde estás y saltas con un clic. */
function StepNav() {
  const isEs = useMissionStore((s) => s.lang) === "es";
  const [active, setActive] = useState(0);
  useEffect(() => {
    const els = STEPS.map((s) => document.getElementById(s.id));
    const onScroll = () => {
      const y = window.innerHeight * 0.4;
      let cur = 0;
      els.forEach((el, i) => { if (el && el.getBoundingClientRect().top < y) cur = i; });
      setActive(cur);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <nav aria-label={isEs ? "Pasos de la misión" : "Mission steps"} className="sticky top-2 z-40 mx-auto flex w-fit max-w-full gap-1 rounded-full border-2 border-slate-600 bg-slate-950/90 p-1 shadow-xl backdrop-blur">
      {STEPS.map((s, i) => (
        <button key={s.id} onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" })} aria-current={active === i ? "step" : undefined}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-extrabold transition hover:scale-105"
          style={active === i ? { background: s.color, color: "#0b1020" } : { color: "#cbd5e1" }}>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/25 text-xs">{i + 1}</span>
          <span aria-hidden>{s.emoji}</span> <span className="hidden sm:inline">{isEs ? s.es : s.en}</span>
        </button>
      ))}
    </nav>
  );
}

function StepTitle({ n, kidEs, kidEn, proEs, proEn }: { n: 1 | 2 | 3; kidEs: string; kidEn: string; proEs: string; proEn: string }) {
  const isEs = useMissionStore((s) => s.lang) === "es";
  const kid = useMissionStore((s) => s.audienceMode) === "educator";
  const st = STEPS[n - 1];
  return (
    <div id={st.id} className="mt-3 flex scroll-mt-16 flex-wrap items-center gap-3 rounded-2xl px-3 py-2" style={{ background: `linear-gradient(90deg, ${st.color}33, transparent 70%)`, borderLeft: `6px solid ${st.color}` }}>
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl font-display text-2xl font-extrabold text-slate-950" style={{ background: st.color }}>{n}</span>
      <div>
        <h2 className="font-display text-xl font-extrabold leading-tight text-white"><span aria-hidden>{st.emoji}</span> {isEs ? st.es : st.en}</h2>
        <p className="text-sm text-slate-300">{kid ? (isEs ? kidEs : kidEn) : (isEs ? proEs : proEn)}</p>
      </div>
    </div>
  );
}

/** Resumen del veredicto por escenario (se ve aunque el desplegable esté cerrado). */
function VerdictChips() {
  const scenarios = useMissionStore((s) => s.scenarios);
  return (
    <>
      {scenarios.map((sc) => (
        <span key={sc.label} className="rounded-full bg-slate-800 px-2 py-0.5">
          <b style={{ color: SCENARIO_COLORS[sc.label] }}>{sc.label}</b> {sc.metrics ? { VIABLE: "", RELAY_REQUIRED: "", CRITICAL_FREEZE_RISK: "" }[sc.metrics.viability] : "…"}
        </span>
      ))}
    </>
  );
}

export default function Home() {
  const es = useMissionStore((s) => s.lang) === "es";
  const kid = useMissionStore((s) => s.audienceMode) === "educator";
  const loadDataset = useMissionStore((s) => s.loadDataset);
  const isPlaying = useMissionStore((s) => s.isPlaying);

  useEffect(() => {
    void loadDataset();
  }, [loadDataset]);

  // Reproducción con requestAnimationFrame: el cabezal (float) avanza cada frame,
  // el 3D lo lee en useFrame y los paneles DOM se actualizan con límite de frecuencia.
  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const { playhead, speed, setPlayhead } = useMissionStore.getState();
      setPlayhead(playhead + dt * speed * 3); // 1x = 3 h/s (un día cada 8 s; la barra cruza el mes en ~4 min) · 10x = 30 h/s · 30x = 90 h/s
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 p-3 pb-28">
      <ScenarioSelector />
      <StepNav />
      <EducatorOverlay />

      <StepTitle n={1}
        kidEs="Toca cualquier punto de la Luna. Verás un panal de colores: ¡verde con  significa que tu nave puede aterrizar ahí!"
        kidEn="Tap any point on the Moon. A colourful honeycomb appears: green with  means your lander can land there!"
        proEs="Clic en el globo o en el mapa polar: se evalúan 37 celdas (horizonte LOLA + efemérides JPL) y se marca dónde el alunizaje es viable."
        proEn="Click the globe or polar map: 37 cells are evaluated (LOLA horizon + JPL ephemeris) and viable landing cells are flagged." />
      <section id="tour-explore" className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div className="xl:col-span-2"><LunarGlobe3D /></div>
        <div className="flex flex-col gap-3">
          <HoneycombPanel />
          <Collapsible id="sec-polar" emoji="" tint="#5f8fb8" title={es ? "Mapa del polo sur" : "South pole map"} summary={es ? "otra forma de elegir un punto" : "another way to pick a point"}>
            <PolarMap />
          </Collapsible>
        </div>
      </section>

      <StepTitle n={2}
        kidEs="Así se ve desde tu nave. Pulsa Reproducir o mueve la barra del tiempo: el rayo amarillo es la luz del Sol, el verde es la llamada a la Tierra y el rojo avisa que una montaña estorba."
        kidEn="This is the view from your lander. Press Play or drag the time bar: the yellow beam is sunlight, the green one is the call to Earth and red warns that a mountain is in the way."
        proEs="Horizonte local con relieve LOLA y posiciones JPL. La barra de tiempo controla todas las vistas; los rayos indican visibilidad solar y enlace DTE."
        proEn="Local horizon with LOLA terrain and JPL positions. The time bar drives every view; beams show solar visibility and the DTE link." />
      <LocalHorizon3D />

      <StepTitle n={3}
        kidEs="Abre las cajas que quieras para ver los números de tu misión. ¡Si tienes dudas, pregúntale a Luna-Bot abajo! "
        kidEn="Open the boxes you like to see your mission numbers. If in doubt, ask Luna-Bot below! "
        proEs="Indicadores, línea de tiempo, energía/temperatura, panorama, estaciones y comparación Tierra–Luna. Solo se renderiza lo que abras."
        proEn="KPIs, timeline, power/thermal, panorama, seasons and Earth–Moon comparison. Only open sections are rendered." />
      <Collapsible id="sec-metrics" emoji="" tint="#7fb39a" title={kid ? (es ? "¿Se puede alunizar? El semáforo" : "Can we land? The traffic light") : (es ? "Indicadores clave y veredicto" : "Key indicators and verdict")} summary={<VerdictChips />}>
        <MetricsComparison />
      </Collapsible>
      <Collapsible id="sec-timeline" emoji="" tint="#c9a25e" title={kid ? (es ? "¿Cuándo hay Sol y cuándo hay Tierra?" : "When is there Sun and Earth?") : (es ? "Línea de tiempo de 30 días" : "30-day timeline")} summary={es ? "30 días de misión de un vistazo" : "30 mission days at a glance"}>
        <LunarTimelineGantt />
      </Collapsible>
      <Collapsible id="sec-energy" emoji="" tint="#8fb07a" title={kid ? (es ? "¿Aguanta la batería el frío?" : "Does the battery survive the cold?") : (es ? "Batería y temperatura" : "Battery and temperature")} summary={es ? "energía y temperatura hora a hora" : "power and temperature hour by hour"}>
        <EnergyThermalChart />
      </Collapsible>
      <Collapsible id="sec-panorama" emoji="" tint="#c79a6a" title={kid ? (es ? "Las montañas que rodean tu nave" : "The mountains around your lander") : (es ? "Panorama 360° del horizonte" : "360° horizon panorama")} summary={es ? "silueta del horizonte y camino del Sol y la Tierra" : "horizon silhouette and Sun/Earth paths"}>
        <HorizonSkyplot2D />
      </Collapsible>
      <Collapsible id="sec-seasons" emoji="" tint="#a88bb8" title={kid ? (es ? "¿Qué día es mejor para viajar?" : "Which day is best to travel?") : (es ? "Mejores fechas: días lunares y estaciones" : "Best dates: lunar days and seasons")} summary={es ? "12 meses en colores de semáforo" : "12 months in traffic-light colours"}>
        <SeasonsHeatmap />
      </Collapsible>
      <Collapsible id="sec-earthmoon" emoji="" tint="#7ea4c9" title={kid ? (es ? "¿En qué se diferencia de la Tierra?" : "How is it different from Earth?") : (es ? "Tierra vs. Luna" : "Earth vs. Moon")} summary={es ? "el mismo día en Medellín y en la Luna" : "the same day in Medellín and on the Moon"}>
        <EarthVsMoon />
      </Collapsible>

      <footer className="text-[11px] text-slate-500">
        Efemérides: NASA/JPL Horizons (DE441), observador coord@301, sin refracción, caché horaria nov-2026 → nov-2027. Horizonte: LOLA LDEM (NASA CGI Moon Kit) 16 px/° en el polo sur, 4 px/° global.
        Texturas: LROC + LOLA, Blue Marble (NASA). Al acercar mucho el globo, los cráteres pequeños son ilustrativos (generados por computador); en las vistas desde la nave, los cráteres y rocas cercanos también son ilustrativos y nunca superan el horizonte LOLA. El cálculo usa siempre el relieve LOLA real.
      </footer>

      <MissionVoiceAgent />
      <MissionBriefModal />
      <TourGuide />
      <LiveTranslate />
      <DemoOverlay />
      <ChatDock instructions={INSTRUCTIONS} />
    </main>
  );
}

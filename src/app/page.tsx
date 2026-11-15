"use client";
import { useEffect } from "react";
import dynamic from "next/dynamic";
import { CopilotPopup } from "@copilotkit/react-ui";
import { Compass, FileText, Clapperboard, Square } from "lucide-react";
import { useMissionStore } from "@/store/useMissionStore";
import { useUiStore } from "@/store/useUiStore";
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
import { generateMissionBrief } from "@/lib/brief";
import { cancelDemo, runNarratedDemo } from "@/lib/demo";
import { useT } from "@/lib/i18n";

// Three.js solo en el cliente
const LocalHorizon3D = dynamic(() => import("@/components/canvas3d/LocalHorizon3D"), { ssr: false });
const LunarGlobe3D = dynamic(() => import("@/components/canvas3d/LunarGlobe3D"), { ssr: false });

const INSTRUCTIONS = `Eres el Flight Director de una misión lunar (NASA CLPS/Artemis). Responde en el idioma del estado (language), breve (2-4 frases) porque tus respuestas se leen en voz alta.
Usa SIEMPRE los datos del estado compartido (escenarios A-D) y cita números: % de luz, % DTE, ventana dorada, SoC mínimo, horas a sunset/earthset.
Reglas físicas: sin atmósfera; un astro es visible solo si su elevación supera la altura del terreno (LOLA) en ese azimut. En el polo sur el Sol va al ras (0-5°) y los paneles son verticales; la Tierra libra ±7°; si está <1° sobre la cresta el enlace es degradado (multipath).
Sin Sol / batería agotada = riesgo de congelamiento (rojo). Sin Tierra pero con Sol = relé (amarillo).
Cuando el usuario pida comparar, retrasar, buscar fechas (findBestLandingWindow), analizar puntos cercanos (analyzeNearbyPoints), cambiar coordenadas, ir a un evento, generar informe o demo: EJECUTA la acción y luego da el veredicto.
Antes de recomendar cambiar un sitio usa SIEMPRE recommendSiteChange (pide aprobación).
En modo "educator" explica con analogías simples; en "engineer" usa grados, W/m², % y horas.`;

export default function Home() {
  const t = useT();
  const loadDataset = useMissionStore((s) => s.loadDataset);
  const isPlaying = useMissionStore((s) => s.isPlaying);
  const demoRunning = useUiStore((s) => s.demoRunning);
  const { setTourStep, openBrief } = useUiStore.getState();

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
      setPlayhead(playhead + dt * speed * 4); // 1x = 4 h/s · 10x = 40 h/s · 30x = 120 h/s
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 p-3">
      <ScenarioSelector />
      <div className="flex flex-wrap gap-2 text-xs">
        <button onClick={() => setTourStep(0)} className="flex items-center gap-1 rounded bg-slate-800 px-3 py-1.5 hover:bg-slate-700"><Compass className="h-4 w-4" /> {t("tour")}</button>
        {demoRunning ? (
          <button onClick={cancelDemo} className="flex items-center gap-1 rounded bg-red-700 px-3 py-1.5"><Square className="h-4 w-4" /> Detener demo</button>
        ) : (
          <button onClick={() => void runNarratedDemo()} className="flex items-center gap-1 rounded bg-fuchsia-700 px-3 py-1.5 hover:bg-fuchsia-600"><Clapperboard className="h-4 w-4" /> {t("demo")}</button>
        )}
        <button onClick={() => openBrief(generateMissionBrief())} className="flex items-center gap-1 rounded bg-slate-800 px-3 py-1.5 hover:bg-slate-700"><FileText className="h-4 w-4" /> {t("brief")}</button>
      </div>
      <EducatorOverlay />
      <section id="tour-explore" className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div className="xl:col-span-2"><LunarGlobe3D /></div>
        <div className="flex flex-col gap-3">
          <HoneycombPanel />
          <PolarMap />
        </div>
      </section>
      <LocalHorizon3D />
      <HorizonSkyplot2D />
      <MetricsComparison />
      <LunarTimelineGantt />
      <EnergyThermalChart />
      <SeasonsHeatmap />
      <EarthVsMoon />
      <footer className="pb-16 text-[11px] text-slate-500">
        Efemérides: NASA/JPL Horizons (DE441), observador coord@301, sin refracción, caché horaria nov-2026 → nov-2027. Horizonte: LOLA LDEM (NASA CGI Moon Kit) 16 px/° en el polo sur, 4 px/° global.
        Texturas: LROC + LOLA, Blue Marble (NASA).
      </footer>

      <MissionVoiceAgent />
      <MissionBriefModal />
      <TourGuide />
      <CopilotPopup
        instructions={INSTRUCTIONS}
        labels={{
          title: "Flight Director IA",
          initial: "Hola, soy tu Flight Director. Prueba: «Busca la mejor fecha de diciembre para Malapert» o «Analiza puntos cercanos a A».",
        }}
      />
    </main>
  );
}

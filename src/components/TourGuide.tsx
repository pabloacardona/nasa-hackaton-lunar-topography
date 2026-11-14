"use client";
// Tour guiado (accesible: rol dialog, foco en botones, navegación con teclado).
import { useEffect } from "react";
import { useUiStore } from "@/store/useUiStore";
import { useMissionStore } from "@/store/useMissionStore";
import { tStatic } from "@/lib/i18n";

const STEPS: { id: string; es: [string, string]; en: [string, string] }[] = [
  { id: "tour-scenarios", es: ["Escenarios (hasta 4)", "Elige sitios curados o coordenadas propias, fecha de alunizaje y retraso. El escenario con borde de color es el ACTIVO: recibe los clics del mapa y del panal."], en: ["Scenarios (up to 4)", "Pick curated sites or your own coordinates, landing date and delay. The highlighted scenario is ACTIVE: it receives map and honeycomb clicks."] },
  { id: "tour-3d", es: ["Horizonte 3D", "Lo que ve el lander: relieve real (LOLA), Sol y Tierra en su posición real (JPL). El haz verde es la comunicación directa; rojo = la montaña la bloquea."], en: ["3D horizon", "What the lander sees: real terrain (LOLA), Sun and Earth at their real positions (JPL). Green beam = direct link; red = blocked by terrain."] },
  { id: "tour-panorama", es: ["Panorama 360°", "La silueta del horizonte y las trayectorias de 30 días del Sol (ámbar) y la Tierra (cian). Si el punto queda bajo la silueta, está oculto."], en: ["360° panorama", "Horizon silhouette and the 30-day paths of the Sun (amber) and Earth (cyan). Below the silhouette = hidden."] },
  { id: "tour-metrics", es: ["Semáforo y KPIs", "Horas hasta el ocaso/Earthset, potencia, batería, temperatura y veredicto para la duración de la misión."], en: ["Verdict & KPIs", "Hours to sunset/Earthset, power, battery, temperature and verdict for the mission duration."] },
  { id: "tour-timeline", es: ["Línea de tiempo", "Barras de Sol, DTE (violeta = degradado) y ventana dorada. Reproduce a 1x/10x/30x o salta a eventos."], en: ["Timeline", "Sun, DTE (violet = degraded) and golden window bars. Play at 1x/10x/30x or jump to events."] },
  { id: "tour-honeycomb", es: ["Panal de abeja", "Explora puntos a 0,5–5 km: moverse 1 km puede cambiar la luz del 25 % al 70 %."], en: ["Honeycomb", "Explore points 0.5–5 km away: moving 1 km can change sunlight from 25% to 70%."] },
  { id: "tour-seasons", es: ["Días lunares y estaciones", "12 meses de fechas de alunizaje por sitio. Clic para usar una fecha."], en: ["Lunar days & seasons", "12 months of landing dates per site. Click to use a date."] },
  { id: "tour-polar", es: ["Mapa polar", "Haz clic en cualquier punto del polo sur para evaluarlo al instante."], en: ["Polar map", "Click anywhere at the south pole to evaluate it instantly."] },
  { id: "tour-copilot", es: ["Copiloto por voz", "Pulsa el micrófono y pide, por ejemplo: «busca la mejor fecha de diciembre para Malapert»."], en: ["Voice copilot", "Press the mic and ask, e.g.: “find the best December date for Malapert”."] },
];

export default function TourGuide() {
  const step = useUiStore((s) => s.tourStep);
  const setStep = useUiStore((s) => s.setTourStep);
  const lang = useMissionStore((s) => s.lang);

  useEffect(() => {
    document.querySelectorAll("[data-tour-active]").forEach((el) => el.removeAttribute("data-tour-active"));
    if (step === null) return;
    const el = document.getElementById(STEPS[step].id);
    el?.setAttribute("data-tour-active", "true");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStep(null);
      if (e.key === "ArrowRight") setStep(Math.min(STEPS.length - 1, step + 1));
      if (e.key === "ArrowLeft") setStep(Math.max(0, step - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, setStep]);

  if (step === null) return null;
  const s = STEPS[step];
  const [title, body] = lang === "es" ? s.es : s.en;
  return (
    <div role="dialog" aria-modal="false" aria-labelledby="tour-title" className="fixed bottom-6 left-6 z-[60] w-[360px] rounded-xl border border-sky-600 bg-slate-950/95 p-4 text-sm shadow-2xl">
      <div className="mb-1 text-[11px] text-sky-400">{step + 1} / {STEPS.length}</div>
      <h3 id="tour-title" className="mb-1 font-semibold text-slate-100">{title}</h3>
      <p className="mb-3 text-slate-300">{body}</p>
      <div className="flex justify-between gap-2">
        <button className="rounded bg-slate-800 px-3 py-1" onClick={() => setStep(null)}>{tStatic("close", lang)}</button>
        <div className="flex gap-2">
          <button className="rounded bg-slate-800 px-3 py-1 disabled:opacity-40" disabled={step === 0} onClick={() => setStep(step - 1)}>{tStatic("prev", lang)}</button>
          {step < STEPS.length - 1 ? (
            <button autoFocus className="rounded bg-sky-600 px-3 py-1 font-semibold" onClick={() => setStep(step + 1)}>{tStatic("next", lang)}</button>
          ) : (
            <button autoFocus className="rounded bg-emerald-600 px-3 py-1 font-semibold" onClick={() => setStep(null)}>OK</button>
          )}
        </div>
      </div>
    </div>
  );
}

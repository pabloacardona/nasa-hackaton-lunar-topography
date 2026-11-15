"use client";
// Tour guiado (accesible: rol dialog, foco en botones, navegación con teclado).
import { useEffect } from "react";
import { useUiStore } from "@/store/useUiStore";
import { useMissionStore } from "@/store/useMissionStore";
import { tStatic } from "@/lib/i18n";

const STEPS: { id: string; es: [string, string]; en: [string, string] }[] = [
  { id: "tour-scenarios", es: ["Escenarios (hasta 4)", "Elige sitios curados o coordenadas propias, fecha de alunizaje y retraso. El escenario con borde de color es el ACTIVO: recibe los clics del mapa y del panal."], en: ["Scenarios (up to 4)", "Pick curated sites or your own coordinates, landing date and delay. The highlighted scenario is ACTIVE: it receives map and honeycomb clicks."] },
  { id: "tour-globe", es: ["Explorar la Luna", "Haz clic en cualquier punto de la Luna: la cámara hace zoom y aparece un panal de celdas con su % de aptitud para alunizar (verde = mejor). Clic en una celda para ver su detalle."], en: ["Explore the Moon", "Click anywhere on the Moon: the camera zooms in and a honeycomb of cells appears with each cell's landing aptitude % (green = best). Click a cell for details."] },
  { id: "tour-3d", es: ["Horizonte 3D (hasta 4)", "Elige qué escenarios ver (A–D o «Ver los 4»). Lo que ve el lander: relieve real (LOLA), Sol y Tierra en su posición real (JPL). Rayo verde = señal con la Tierra, rayo amarillo/blanco = luz del Sol al panel; rojo = la montaña lo bloquea."], en: ["3D horizon", "What the lander sees: real terrain (LOLA), Sun and Earth at their real positions (JPL). Green beam = direct link; red = blocked by terrain."] },
  { id: "tour-timebar", es: ["Barra de tiempo", "Está pegada a las vistas 3D: reproduce a 1x/10x/30x, arrastra para ir a cualquier hora o salta al próximo ocaso. La franja muestra cuándo hay Sol (ámbar) y Sol + Tierra (verde)."], en: ["Time bar", "Attached to the 3D views: play at 1x/10x/30x, drag to any hour or jump to the next sunset. The strip shows Sun (amber) and Sun + Earth (green)."] },
  { id: "tour-chat", es: ["Luna-Bot, siempre abajo", "La barra de abajo está siempre disponible: escribe o usa el micrófono para preguntar lo que quieras. Al abrirla verás preguntas sugeridas."], en: ["Assistant chat", "The bottom bar is always available: type or use the mic to ask anything. Opening it shows suggested questions."] },
  { id: "tour-panorama", es: ["Panorama 360°", "La silueta del horizonte y las trayectorias de 30 días del Sol (ámbar) y la Tierra (cian). Si el punto queda bajo la silueta, está oculto."], en: ["360° panorama", "Horizon silhouette and the 30-day paths of the Sun (amber) and Earth (cyan). Below the silhouette = hidden."] },
  { id: "tour-metrics", es: ["Semáforo y KPIs", "Horas hasta el ocaso/Earthset, potencia, batería, temperatura y veredicto para la duración de la misión."], en: ["Verdict & KPIs", "Hours to sunset/Earthset, power, battery, temperature and verdict for the mission duration."] },
  { id: "tour-timeline", es: ["Línea de tiempo", "Una fila por escenario: Sol (ámbar), Tierra (cian) y ambos (verde)."], en: ["Timeline", "One row per scenario: Sun (amber), Earth (cyan) and both (green)."] },
  { id: "tour-honeycomb", es: ["Panal de abeja", "Ranking automático de las celdas del último clic. «Usar» mueve el escenario activo a esa celda: moverse 1 km puede cambiar la luz del 25 % al 70 %."], en: ["Honeycomb", "Automatic ranking of the cells from your last click. “Use” moves the active scenario there: moving 1 km can change sunlight from 25% to 70%."] },
  { id: "tour-seasons", es: ["Días lunares y estaciones", "12 meses de fechas de alunizaje por sitio. Clic para usar una fecha."], en: ["Lunar days & seasons", "12 months of landing dates per site. Click to use a date."] },
  { id: "tour-polar", es: ["Mapa polar", "Haz clic en cualquier punto del polo sur para evaluarlo al instante."], en: ["Polar map", "Click anywhere at the south pole to evaluate it instantly."] },
];

const SECTION_OF: Record<string, string> = {
  "tour-scenarios": "sec-scenarios", "tour-panorama": "sec-panorama", "tour-metrics": "sec-metrics",
  "tour-timeline": "sec-timeline", "tour-seasons": "sec-seasons", "tour-polar": "sec-polar",
};

export default function TourGuide() {
  const step = useUiStore((s) => s.tourStep);
  const setStep = useUiStore((s) => s.setTourStep);
  const lang = useMissionStore((s) => s.lang);

  useEffect(() => {
    document.querySelectorAll("[data-tour-active]").forEach((el) => el.removeAttribute("data-tour-active"));
    if (step === null) return;
    const id = STEPS[step].id;
    if (SECTION_OF[id]) useUiStore.getState().openSection(SECTION_OF[id]); // abre el desplegable que contiene el paso
    const timer = setTimeout(() => {
      const el = document.getElementById(id);
      el?.setAttribute("data-tour-active", "true");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStep(null);
      if (e.key === "ArrowRight") setStep(Math.min(STEPS.length - 1, step + 1));
      if (e.key === "ArrowLeft") setStep(Math.max(0, step - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(timer); window.removeEventListener("keydown", onKey); };
  }, [step, setStep]);

  if (step === null) return null;
  const s = STEPS[step];
  const [title, body] = lang === "es" ? s.es : s.en;
  return (
    <div role="dialog" aria-modal="false" aria-labelledby="tour-title" className="pop fixed bottom-24 left-4 z-[60] w-[360px] max-w-[calc(100vw-2rem)] rounded-3xl border-2 border-[#7fa6c9] bg-slate-950 p-4 text-sm shadow-2xl">
      <div className="mb-1 text-[11px] text-[#7fa6c9]">{step + 1} / {STEPS.length}</div>
      <h3 id="tour-title" className="mb-1 font-display text-lg font-extrabold text-white"> {title}</h3>
      <p className="mb-3 text-slate-300">{body}</p>
      <div className="flex justify-between gap-2">
        <button className="rounded bg-slate-800 px-3 py-1" onClick={() => setStep(null)}>{tStatic("close", lang)}</button>
        <div className="flex gap-2">
          <button className="rounded bg-slate-800 px-3 py-1 disabled:opacity-40" disabled={step === 0} onClick={() => setStep(step - 1)}>{tStatic("prev", lang)}</button>
          {step < STEPS.length - 1 ? (
            <button autoFocus className="rounded bg-[#44658a] px-3 py-1 font-semibold" onClick={() => setStep(step + 1)}>{tStatic("next", lang)}</button>
          ) : (
            <button autoFocus className="rounded bg-[#4f8569] px-3 py-1 font-semibold" onClick={() => setStep(null)}>OK</button>
          )}
        </div>
      </div>
    </div>
  );
}

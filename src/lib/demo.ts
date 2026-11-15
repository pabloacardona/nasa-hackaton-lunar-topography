// Demo para grabar el video del pitch: guion con subtítulos, puntero virtual que hace clic
// en los controles reales y narración (Web Speech API) en el idioma elegido.
// No necesita LLM ni API key. Cada escena espera a que termine su acción antes de seguir.
import { useMissionStore } from "@/store/useMissionStore";
import { useUiStore } from "@/store/useUiStore";
import { honeyScore } from "./honeycomb";
import { exploreAt, goToCell } from "./explore";
import { speakText, stopSpeaking } from "./voice";

type Lang = "es" | "en";
let cancelled = false;
export const cancelDemo = () => {
  cancelled = true;
  stopSpeaking();
  useUiStore.getState().setDemoCaption(null);
  useUiStore.getState().setDemoCursor(null);
};

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
function check() { if (cancelled) throw new Error("cancelled"); }

/** Narra y devuelve cuando termina la voz (o pasa el tiempo de lectura, lo que tarde más). */
function speak(text: string, lang: Lang, minMs: number): Promise<void> {
  return Promise.all([wait(minMs), speakText(text, lang, { rate: 0.95, maxMs: 15000 })]).then(() => undefined);
}

/** Mueve el puntero virtual hasta el elemento, hace clic (onda) y ejecuta la acción. */
async function point(sel: string | null, act?: () => Promise<unknown> | void) {
  const ui = useUiStore.getState();
  if (sel) {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      await wait(700);
      const r = el.getBoundingClientRect();
      const x = Math.min(window.innerWidth - 30, Math.max(10, r.left + r.width / 2));
      const y = Math.min(window.innerHeight - 30, Math.max(10, r.top + r.height / 2));
      ui.setDemoCursor({ x, y, click: (ui.demoCursor?.click ?? 0) });
      await wait(1000);
      ui.setDemoCursor({ x, y, click: (ui.demoCursor?.click ?? 0) + 1 });
      await wait(250);
    }
  }
  if (act) await act();
}

/** Busca un botón por su texto dentro de la página (para «Alrededor de» o «¡Ir aquí!»). */
function buttonWith(text: string, index = 0): string | null {
  const all = [...document.querySelectorAll("button")].filter((b) => b.textContent?.includes(text));
  const b = all[index];
  if (!b) return null;
  b.setAttribute("data-demo-target", `${text}-${index}`);
  return `[data-demo-target="${text}-${index}"]`;
}

export async function runNarratedDemo() {
  const ui = useUiStore.getState();
  cancelled = false;
  ui.setDemoRunning(true);
  const lang = (): Lang => (useMissionStore.getState().lang === "es" ? "es" : "en");

  // Cada escena: texto en ambos idiomas, elemento a señalar, acción y tiempo de lectura mínimo.
  type Scene = { es: string; en: string; target?: string | null; act?: () => Promise<unknown> | void; hold?: number };
  const scenes: Scene[] = [
    { es: "El reto de la NASA: elegir dónde aterrizar en el polo sur de la Luna, con seguridad.", en: "The NASA challenge: choose where to land on the Moon's south pole, safely.", hold: 1500 },
    {
      es: "Mons Mouton, en el polo sur, con alunizaje el 15 de noviembre de 2026.",
      en: "Mons Mouton, at the south pole, landing on November 15, 2026.",
      target: "#tour-scenarios",
      act: async () => {
        const st = useMissionStore.getState();
        await st.setSite("A", "mons_mouton");
        await st.setBaseDate("A", "2026-11-15T00:00:00Z");
        await st.setDelay("A", 0);
        st.setActive("A");
      },
    },
    {
      es: "Con esa fecha la misión sí es viable: hay Sol y Tierra a la vez en la ventana dorada.",
      en: "On that date the mission is viable: Sun and Earth are both available in the golden window.",
      target: "#tour-metrics",
    },
    {
      es: "Pero el cohete se retrasa catorce días. Mira cómo cambia el veredicto.",
      en: "But the rocket slips fourteen days. Watch how the verdict changes.",
      target: "#tour-scenarios",
      act: () => useMissionStore.getState().setDelay("A", 14),
    },
    {
      es: "Ahora el lugar ya no sirve. Buscamos alternativas cercanas con el panal de abeja.",
      en: "Now this place no longer works. We search nearby alternatives with the honeycomb.",
      target: buttonWith("Alrededor de"),
      act: async () => {
        const sc = useMissionStore.getState().getScenario("A")!;
        await exploreAt(sc.lat, sc.lon, { label: "A", spacingKm: 2, rings: 3, moveScenario: false });
      },
      hold: 2000,
    },
    {
      es: "Cada celda tiene su propio horizonte real, medido con el láser LOLA de la NASA.",
      en: "Each cell has its own real horizon, measured with NASA's LOLA laser.",
      target: "#tour-explore",
    },
    {
      es: "La mejor alternativa a pocos kilómetros: la movemos ahí con un clic.",
      en: "The best alternative is a few kilometers away: we move the lander there with one click.",
      target: null,
      act: async () => {
        const honey = useUiStore.getState().honey;
        const best = honey ? [...honey.results].sort((a, b) => honeyScore(b) - honeyScore(a)).filter((r) => Math.hypot(r.cell.northKm, r.cell.eastKm) > 0.01)[0] : null;
        if (!best) return;
        await goToCell(best.lat, best.lon, "A");
      },
      hold: 1500,
    },
    {
      es: "Ahora vemos la vista desde el lander. El rayo amarillo es la luz del Sol.",
      en: "Now the view from the lander. The yellow beam is sunlight.",
      target: "#tour-timebar button[aria-label]",
      act: () => useMissionStore.getState().togglePlay(),
      hold: 4000,
    },
    {
      es: "La barra del tiempo avanza despacio y se detiene sola cuando la tocas, para que tú tomes el control.",
      en: "The time bar moves slowly and stops by itself when you touch it, so you take control.",
      target: "#tour-timebar input[type=range]",
      act: () => useMissionStore.getState().pausePlayback(),
    },
    {
      es: "Y en el mapa de estaciones vemos qué fechas del año funcionan para cada sitio.",
      en: "And on the seasons map we see which dates of the year work for each site.",
      target: "#tour-seasons",
    },
    {
      es: "Con las herramientas actuales esto tomaría días. Aquí, segundos. Gracias.",
      en: "With today's tools this would take days. Here, seconds. Thank you.",
      target: null,
      hold: 2000,
    },
  ];

  try {
    for (const sc of scenes) {
      check();
      const text = lang() === "es" ? sc.es : sc.en;
      ui.setDemoCaption(text);
      const words = text.split(" ").length;
      await point(sc.target ?? null, sc.act);
      check();
      await speak(text, lang(), Math.max(sc.hold ?? 0, words * 420 + 900));
      await wait(300);
    }
  } catch {
    /* cancelado por el usuario */
  } finally {
    ui.setDemoCaption(null);
    ui.setDemoCursor(null);
    ui.setDemoRunning(false);
  }
}

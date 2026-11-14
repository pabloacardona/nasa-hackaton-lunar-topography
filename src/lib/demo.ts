// Demo narrada: secuencia guiada con voz (Web Speech API). Funciona SIN LLM ni API key — ideal para el video.
import { useMissionStore } from "@/store/useMissionStore";
import { useUiStore } from "@/store/useUiStore";
import { computeHoneycomb, honeyScore } from "./honeycomb";
import { effectiveStart } from "@/store/useMissionStore";

let cancelled = false;
export const cancelDemo = () => {
  cancelled = true;
  if (typeof window !== "undefined") window.speechSynthesis.cancel();
};

function say(text: string, lang: "es" | "en"): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return setTimeout(resolve, 2500);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "es" ? "es-ES" : "en-US";
    u.rate = 1.05;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const scroll = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });

export async function runNarratedDemo() {
  const st = useMissionStore.getState();
  const ui = useUiStore.getState();
  const es = st.lang === "es";
  cancelled = false;
  ui.setDemoRunning(true);
  try {
    const step = async (text: [string, string], act?: () => Promise<unknown> | void, section?: string) => {
      if (cancelled) throw new Error("cancel");
      if (section) scroll(section);
      if (act) await act();
      await say(es ? text[0] : text[1], st.lang);
      await wait(400);
    };
    const m = () => useMissionStore.getState().getScenario("A")?.metrics;

    await step(["Somos el equipo de una misión comercial CLPS rumbo a Mons Mouton, en el polo sur de la Luna. Alunizaje: 15 de noviembre de 2026.",
      "We are a commercial CLPS mission headed to Mons Mouton, at the lunar south pole. Landing: November 15, 2026."], async () => {
      await st.setSite("A", "mons_mouton");
      await st.setBaseDate("A", "2026-11-15T00:00:00Z");
      await st.setDelay("A", 0);
      st.setActive("A");
    }, "tour-3d");
    await step([`Con esa fecha la misión es ${m()?.viability === "VIABLE" ? "viable" : "riesgosa"}: ${m()?.goldenPct} por ciento de ventana dorada, Sol y Tierra a la vez.`,
      `On that date the mission is ${m()?.viability === "VIABLE" ? "viable" : "at risk"}: ${m()?.goldenPct} percent golden window, Sun and Earth at once.`], undefined, "tour-metrics");
    await step(["Pero el cohete se retrasa catorce días.", "But the rocket slips by fourteen days."], () => st.setDelay("A", 14), "tour-scenarios");
    await step([`Ahora el veredicto es: ${m()?.viabilityReason}`, `Now the verdict is: ${m()?.viabilityReason}`], undefined, "tour-metrics");
    await step(["Buscamos alternativas cercanas con el panal de abeja: cada celda tiene su propio horizonte real medido por el láser LOLA.",
      "We search nearby alternatives with the honeycomb: each cell has its own real horizon measured by the LOLA laser."], async () => {
      const sc = useMissionStore.getState().getScenario("A")!;
      const s2 = useMissionStore.getState();
      const results = await computeHoneycomb({ center: sc, timeline: sc.timeline, startUtc: effectiveStart(sc), rings: 3, spacingKm: 2,
        missionHours: s2.missionHours, power: s2.power, panel: sc.panelType, region: sc.region });
      ui.setHoney({ center: "A", spacingKm: 2, results });
    }, "tour-honeycomb");
    const honey = useUiStore.getState().honey;
    const best = honey ? [...honey.results].sort((a, b) => honeyScore(b) - honeyScore(a))[0] : null;
    if (best) {
      await step([`La mejor celda está a ${Math.hypot(best.cell.northKm, best.cell.eastKm).toFixed(1)} kilómetros, con ${best.metrics.goldenPct} por ciento de ventana dorada. La asignamos al escenario B.`,
        `The best cell is ${Math.hypot(best.cell.northKm, best.cell.eastKm).toFixed(1)} kilometers away, with ${best.metrics.goldenPct} percent golden window. We assign it to scenario B.`], async () => {
        if (!useMissionStore.getState().getScenario("B")) useMissionStore.getState().addScenario();
        await useMissionStore.getState().setDelay("B", 0);
        await useMissionStore.getState().setBaseDate("B", effectiveStart(useMissionStore.getState().getScenario("A")!));
        await useMissionStore.getState().setCustomCoords("B", best.lat, best.lon, "Alternativa panal");
      }, "tour-metrics");
    }
    await step(["Y con el mapa de estaciones vemos qué fechas del año funcionan para cada sitio.", "And the seasons map shows which dates of the year work for each site."], undefined, "tour-seasons");
    await step(["Con las herramientas actuales esto tomaría días. Aquí, segundos.", "With today's tools this would take days. Here, seconds."], undefined, "tour-3d");
  } catch {
    /* cancelado */
  } finally {
    useUiStore.getState().setDemoRunning(false);
  }
}

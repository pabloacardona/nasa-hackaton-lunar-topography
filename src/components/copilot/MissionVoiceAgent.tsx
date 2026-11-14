"use client";
// ============================================================================
// Copiloto de vuelo (CopilotKit):
//  - Lee un RESUMEN del estado (no las 720 horas) + resultados del panal.
//  - Acciones sobre la UI con tarjetas en el chat, confirmación humana y sugerencias dinámicas.
//  - Voz: Web Speech API (gratis) -> chat; respuesta del asistente -> síntesis de voz.
// ============================================================================
import { useEffect, useRef, useState } from "react";
import { useCopilotAction, useCopilotChatInternal, useCopilotChatSuggestions, useCopilotReadable } from "@copilotkit/react-core";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { effectiveStart, useMissionStore, type EventType } from "@/store/useMissionStore";
import { useUiStore } from "@/store/useUiStore";
import type { Scenario, ScenarioLabel } from "@/lib/types";
import { bestWindowsForScenario } from "@/lib/seasons";
import { computeHoneycomb, honeyScore } from "@/lib/honeycomb";
import { generateMissionBrief } from "@/lib/brief";
import { runNarratedDemo } from "@/lib/demo";
import { ApprovalCard, ScenarioCompareCard, WindowsCard } from "./ChatCards";

function summary(sc: Scenario, hour: number) {
  const h = sc.timeline[hour];
  return {
    label: sc.label, site: sc.siteName, siteId: sc.siteId, lat: sc.lat, lon: sc.lon, region: sc.region,
    landingUtc: effectiveStart(sc), delayDays: sc.delayDays, horizonSource: sc.horizonSource, metrics: sc.metrics,
    now: h && { sunEl: h.sunEl, sunVisible: h.sunVisible, earthEl: h.earthEl, dte: h.dte, hoursToSunset: h.hoursToSunset, hoursToEarthset: h.hoursToEarthset, solarPowerWM2: h.solarPowerWM2, socPct: h.socPct, surfaceTempC: h.surfaceTempC },
  };
}

type SR = { lang: string; interimResults: boolean; start: () => void; stop: () => void; onresult: ((e: { results: { 0: { transcript: string } }[] }) => void) | null; onend: (() => void) | null };
const LABELS = ["A", "B", "C", "D"];
const store = () => useMissionStore.getState();
const labelsOf = (scenario: string): ScenarioLabel[] =>
  scenario === "all" ? store().scenarios.map((s) => s.label) : [scenario as ScenarioLabel];

export default function MissionVoiceAgent() {
  // Selectores puntuales: NO suscribirse al store completo (playhead cambia cada frame)
  const scenarios = useMissionStore((s) => s.scenarios);
  const currentHourIndex = useMissionStore((s) => s.currentHourIndex);
  const audienceMode = useMissionStore((s) => s.audienceMode);
  const lang = useMissionStore((s) => s.lang);
  const missionHours = useMissionStore((s) => s.missionHours);
  const power = useMissionStore((s) => s.power);
  const activeLabel = useMissionStore((s) => s.activeLabel);
  const dataset = useMissionStore((s) => s.dataset);
  const st = { scenarios, currentHourIndex, audienceMode, lang, missionHours, power, activeLabel, dataset };
  const honey = useUiStore((s) => s.honey);
  const sites = st.dataset?.sites.map((s) => ({ id: s.id, name: s.name, mission: s.mission, lat: s.lat, lon: s.lon })) ?? [];

  useCopilotReadable({
    description:
      "Estado del simulador lunar: escenarios (A-D) con sitio, fecha, retraso, métricas de la misión (sunlightPct, dtePct, goldenPct, minSocPct, viabilidad) y valores de la hora actual. Horas en h, potencia W/m², temperatura °C.",
    value: {
      currentHourIndex: st.currentHourIndex, audienceMode: st.audienceMode, language: st.lang, missionHours: st.missionHours, power: st.power,
      activeScenario: st.activeLabel, scenarios: st.scenarios.map((s) => summary(s, st.currentHourIndex)),
      cacheRangeUtc: st.dataset ? [st.dataset.startUtc, new Date(new Date(st.dataset.startUtc).getTime() + st.dataset.hours * 3600_000).toISOString()] : null,
    },
  });
  useCopilotReadable({ description: "Sitios curados disponibles (usa su id en las acciones)", value: sites });
  useCopilotReadable({
    description: "Resultado del último análisis de panal de abeja (puntos cercanos)",
    value: honey ? { center: honey.center, spacingKm: honey.spacingKm, cells: honey.results.length,
      best: [...honey.results].sort((a, b) => honeyScore(b) - honeyScore(a)).slice(0, 3).map((r) => ({ lat: r.lat, lon: r.lon, northKm: r.cell.northKm, eastKm: r.cell.eastKm, ...r.metrics })) } : null,
  });

  useCopilotChatSuggestions(
    {
      instructions: `Sugiere 2-3 acciones cortas y útiles según el estado actual (escenarios con riesgo, retrasos, falta de análisis de panal, mejores fechas). Idioma: ${st.lang === "es" ? "español" : "inglés"}.`,
      minSuggestions: 2,
      maxSuggestions: 3,
    },
    [st.scenarios.map((s) => s.metrics?.viability).join(), st.lang]
  );

  useCopilotAction({
    name: "compareSites",
    description: "Carga hasta 4 sitios curados en los escenarios A-D (en orden) y opcionalmente una fecha ISO común.",
    parameters: [
      { name: "siteIds", type: "string[]", description: "ids de sitios (1 a 4)", required: true },
      { name: "dateIso", type: "string", description: "Fecha de alunizaje ISO UTC opcional", required: false },
    ],
    handler: async ({ siteIds, dateIso }) => {
      const ids = siteIds.slice(0, 4);
      while (store().scenarios.length < ids.length) store().addScenario();
      const bad = ids.filter((id) => !store().getSite(id));
      if (bad.length) return `Sitios desconocidos: ${bad.join(", ")}. Usa ids de la lista de sitios.`;
      await Promise.all(ids.map(async (id, i) => {
        const l = LABELS[i] as ScenarioLabel;
        if (dateIso) await store().setBaseDate(l, dateIso);
        await store().setSite(l, id);
      }));
      store().setViewMode("split_3d");
      return JSON.stringify(store().scenarios.map((s) => ({ label: s.label, site: s.siteName, ...s.metrics })));
    },
    render: ({ status, args }) => (status === "complete" ? <ScenarioCompareCard labels={LABELS.slice(0, args.siteIds?.length ?? 4)} /> : <span>Comparando…</span>),
  });

  useCopilotAction({
    name: "simulateLaunchDelay",
    description: "Aplica un retraso de lanzamiento en días a un escenario (A-D) o a todos ('all').",
    parameters: [
      { name: "delayDays", type: "number", description: "Días de retraso totales", required: true },
      { name: "scenario", type: "string", enum: ["A", "B", "C", "D", "all"], description: "Escenario", required: true },
    ],
    handler: async ({ delayDays, scenario }) => {
      const ls = labelsOf(scenario);
      await Promise.all(ls.map((l) => store().setDelay(l, delayDays)));
      return JSON.stringify(ls.map((l) => ({ label: l, ...store().getScenario(l)?.metrics })));
    },
    render: ({ status, args }) => (status === "complete" ? <ScenarioCompareCard labels={args.scenario === "all" ? undefined : [args.scenario]} /> : <span>Aplicando retraso…</span>),
  });

  useCopilotAction({
    name: "setCustomCoordinates",
    description: "Usa coordenadas lunares personalizadas en un escenario (horizonte LOLA + efemérides trasladadas o JPL en vivo).",
    parameters: [
      { name: "scenario", type: "string", enum: LABELS, description: "Escenario", required: true },
      { name: "lat", type: "number", description: "Latitud (-90 a 90)", required: true },
      { name: "lon", type: "number", description: "Longitud este (-180 a 180)", required: true },
    ],
    handler: async ({ scenario, lat, lon }) => {
      await store().setCustomCoords(scenario as ScenarioLabel, lat, lon);
      return JSON.stringify(store().getScenario(scenario as ScenarioLabel)?.metrics ?? store().getScenario(scenario as ScenarioLabel)?.error);
    },
  });

  useCopilotAction({
    name: "jumpToCriticalEvent",
    description: "Mueve la línea de tiempo al próximo evento crítico de un escenario.",
    parameters: [
      { name: "scenario", type: "string", enum: LABELS, description: "Escenario", required: true },
      { name: "eventType", type: "string", enum: ["next_sunset", "next_earthset", "peak_power", "next_sunrise", "battery_empty"], description: "Evento", required: true },
    ],
    handler: async ({ scenario, eventType }) => `Línea de tiempo en T+${store().jumpToEvent(scenario as ScenarioLabel, eventType as EventType)} h`,
  });

  useCopilotAction({
    name: "setMissionProfile",
    description: "Duración de la misión (h) y batería (h de autonomía). Artemis=156, CLPS=240/336, rover=720.",
    parameters: [
      { name: "missionHours", type: "number", description: "Horas de misión", required: true },
      { name: "batteryHours", type: "number", description: "Horas de batería a oscuras", required: false },
    ],
    handler: async ({ missionHours, batteryHours }) => {
      if (batteryHours) store().setPower({ batteryHours });
      store().setMissionHours(missionHours);
      return "Perfil de misión actualizado";
    },
  });

  useCopilotAction({
    name: "manageScenarios",
    description: "Agrega (con un sitio opcional) o quita escenarios. Máximo 4.",
    parameters: [
      { name: "operation", type: "string", enum: ["add", "remove"], description: "add/remove", required: true },
      { name: "siteId", type: "string", description: "Sitio para el nuevo escenario", required: false },
      { name: "scenario", type: "string", enum: LABELS, description: "Escenario a quitar", required: false },
    ],
    handler: async ({ operation, siteId, scenario }) => {
      if (operation === "add") return `Escenario ${store().addScenario(siteId) ?? "no agregado (máximo 4)"}`;
      if (scenario) store().removeScenario(scenario as ScenarioLabel);
      return "Escenario quitado";
    },
  });

  useCopilotAction({
    name: "findBestLandingWindow",
    description: "Busca las mejores fechas/horas de alunizaje para un escenario dentro de un rango (usa la caché anual de JPL + LOLA).",
    parameters: [
      { name: "scenario", type: "string", enum: LABELS, description: "Escenario", required: true },
      { name: "fromIso", type: "string", description: "Inicio del rango ISO", required: true },
      { name: "toIso", type: "string", description: "Fin del rango ISO", required: true },
    ],
    handler: async ({ scenario, fromIso, toIso }) => {
      const r = bestWindowsForScenario(scenario, fromIso, toIso, 5);
      return r ? JSON.stringify(r) : "Sin datos en caché para ese escenario/rango";
    },
    render: ({ status, args, result }) => {
      if (status !== "complete") return <span>Buscando ventanas…</span>;
      try {
        return <WindowsCard label={args.scenario} windows={JSON.parse(result)} />;
      } catch {
        return <span>{String(result)}</span>;
      }
    },
  });

  useCopilotAction({
    name: "analyzeNearbyPoints",
    description: "Análisis de sensibilidad con panal de abeja alrededor de un escenario: evalúa puntos a 0,5–5 km con su horizonte real.",
    parameters: [
      { name: "scenario", type: "string", enum: LABELS, description: "Escenario centro", required: true },
      { name: "spacingKm", type: "number", description: "Separación (0.5, 1, 2 o 5 km)", required: false },
      { name: "rings", type: "number", description: "Anillos (2-4)", required: false },
    ],
    handler: async ({ scenario, spacingKm, rings }) => {
      const sc = store().getScenario(scenario as ScenarioLabel);
      if (!sc?.timeline.length) return "Escenario sin datos";
      const results = await computeHoneycomb({ center: sc, timeline: sc.timeline, startUtc: effectiveStart(sc), rings: rings ?? 3, spacingKm: spacingKm ?? 1,
        missionHours: store().missionHours, power: store().power, panel: sc.panelType, region: sc.region });
      useUiStore.getState().setHoney({ center: sc.label, spacingKm: spacingKm ?? 1, results });
      document.getElementById("tour-honeycomb")?.scrollIntoView({ behavior: "smooth", block: "center" });
      const best = [...results].sort((a, b) => honeyScore(b) - honeyScore(a)).slice(0, 3);
      return JSON.stringify(best.map((r) => ({ lat: r.lat, lon: r.lon, northKm: r.cell.northKm, eastKm: r.cell.eastKm, goldenPct: r.metrics.goldenPct, sunlightPct: r.metrics.sunlightPct, viability: r.metrics.viability })));
    },
  });

  useCopilotAction({
    name: "recommendSiteChange",
    description: "Propone mover un escenario a otras coordenadas o sitio y PIDE APROBACIÓN al usuario antes de aplicarlo. Úsalo siempre que recomiendes cambiar el sitio de aterrizaje.",
    parameters: [
      { name: "scenario", type: "string", enum: LABELS, description: "Escenario a cambiar", required: true },
      { name: "reason", type: "string", description: "Justificación breve con números", required: true },
      { name: "siteId", type: "string", description: "Sitio curado destino (o vacío si se usan coordenadas)", required: false },
      { name: "lat", type: "number", description: "Latitud destino", required: false },
      { name: "lon", type: "number", description: "Longitud destino", required: false },
    ],
    renderAndWaitForResponse: ({ args, status, respond, result }) => (
      <ApprovalCard
        text={`Propuesta: mover ${args.scenario ?? "?"} a ${args.siteId ?? `${args.lat?.toFixed?.(3)}°, ${args.lon?.toFixed?.(2)}°`}. ${args.reason ?? ""}`}
        done={status === "complete" ? String(result) : undefined}
        onApprove={async () => {
          if (args.siteId && store().getSite(args.siteId)) await store().setSite(args.scenario as ScenarioLabel, args.siteId);
          else if (args.lat !== undefined && args.lon !== undefined) await store().setCustomCoords(args.scenario as ScenarioLabel, args.lat, args.lon);
          respond?.("Aprobado y aplicado por el usuario.");
        }}
        onReject={() => respond?.("Rechazado por el usuario; no se cambió nada.")}
      />
    ),
  });

  useCopilotAction({
    name: "generateMissionBrief",
    description: "Genera el informe de misión (Markdown) con escenarios, riesgos y recomendación, y lo muestra para descargar.",
    parameters: [],
    handler: async () => {
      const text = generateMissionBrief();
      useUiStore.getState().openBrief(text);
      return text;
    },
  });

  useCopilotAction({
    name: "runGuidedDemo",
    description: "Ejecuta la demo narrada de 1 minuto (retraso de Mons Mouton + alternativa con panal).",
    parameters: [],
    handler: async () => {
      void runNarratedDemo();
      return "Demo iniciada";
    },
  });

  useCopilotAction({
    name: "setUiOptions",
    description: "Cambia modo (engineer/educator), vista (split_3d/orbital_globe/horizon_panorama), idioma (es/en) o inicia el tour.",
    parameters: [
      { name: "audienceMode", type: "string", enum: ["engineer", "educator"], description: "Modo", required: false },
      { name: "viewMode", type: "string", enum: ["split_3d", "orbital_globe", "horizon_panorama"], description: "Vista", required: false },
      { name: "language", type: "string", enum: ["es", "en"], description: "Idioma", required: false },
      { name: "startTour", type: "boolean", description: "Iniciar tour guiado", required: false },
    ],
    handler: async ({ audienceMode, viewMode, language, startTour }) => {
      if (audienceMode) store().setAudienceMode(audienceMode as "engineer");
      if (viewMode) store().setViewMode(viewMode as "split_3d");
      if (language) store().setLang(language as "es");
      if (startTour) useUiStore.getState().setTourStep(0);
      return "OK";
    },
  });

  // ---------------- Voz: STT -> chat, respuesta -> TTS ----------------
  const { messages, sendMessage, isLoading } = useCopilotChatInternal();
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(true);
  const recRef = useRef<SR | null>(null);
  const lastSpoken = useRef<string | null>(null);

  useEffect(() => {
    if (!speak || isLoading || typeof window === "undefined") return;
    const last = [...(messages ?? [])].reverse().find((m) => m.role === "assistant");
    const text = typeof last?.content === "string" ? last.content : "";
    if (!last || last.id === lastSpoken.current || !text) return;
    lastSpoken.current = last.id;
    const u = new SpeechSynthesisUtterance(text.replace(/[*#_`|]/g, ""));
    u.lang = st.lang === "es" ? "es-ES" : "en-US";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }, [messages, isLoading, speak, st.lang]);

  const toggleMic = () => {
    const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) {
      alert("Tu navegador no soporta reconocimiento de voz (usa Chrome o Edge).");
      return;
    }
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new Ctor();
    rec.lang = store().lang === "es" ? "es-ES" : "en-US";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      void sendMessage({ id: crypto.randomUUID(), role: "user", content: text });
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <div className="fixed bottom-24 right-6 z-50 flex flex-col gap-2" id="tour-copilot">
      <button onClick={() => setSpeak((s) => !s)} className="rounded-full bg-slate-800 p-3 text-slate-200 shadow-lg hover:bg-slate-700" aria-label="Activar o desactivar voz del copiloto" aria-pressed={speak}>
        {speak ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
      </button>
      <button onClick={toggleMic} className={`rounded-full p-4 shadow-lg ${listening ? "animate-pulse bg-red-600" : "bg-sky-600 hover:bg-sky-500"}`} aria-label="Hablar con el copiloto" aria-pressed={listening}>
        {listening ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
      </button>
    </div>
  );
}

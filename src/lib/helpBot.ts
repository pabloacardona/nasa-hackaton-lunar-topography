// ============================================================================
// Asistente local (sin IA externa): responde dudas sobre la herramienta usando
// el glosario, una lista de preguntas frecuentes y el estado actual de los escenarios.
// Se usa cuando no hay LLM configurado, así el chat SIEMPRE responde.
// ============================================================================
import { GLOSSARY, type GlossaryEntry } from "./glossary";
import { aptitude } from "./lunarMath";
import { useMissionStore } from "@/store/useMissionStore";
import { useUiStore } from "@/store/useUiStore";

type Lang = "es" | "en";
const idx = (l: Lang) => (l === "es" ? 0 : 1);
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9% ]/g, " ");

/** Preguntas guía que se muestran como botones sobre el chat. */
export const GUIDE_QUESTIONS: [string, string][] = [
  ["¿Cómo empiezo a usar la herramienta?", "How do I start using the tool?"],
  ["¿Cuál de mis escenarios es el mejor para alunizar?", "Which of my scenarios is best for landing?"],
  ["¿Qué significa el % de cada hexágono?", "What does each hexagon's % mean?"],
  ["¿Qué significan los colores de los rayos?", "What do the beam colours mean?"],
  ["¿Por qué un sitio sale en rojo?", "Why is a site shown in red?"],
  ["¿Cómo comparo varios sitios a la vez?", "How do I compare several sites at once?"],
  ["¿Cómo cambio la fecha o simulo un retraso?", "How do I change the date or simulate a delay?"],
  ["¿De dónde salen los datos?", "Where does the data come from?"],
];

const FAQ: { kw: string[]; a: [string, string] }[] = [
  { kw: ["empiezo", "empezar", "comenzar", "usar", "funciona", "start", "begin", "tutorial", "ayuda", "help", "guia"],
    a: ["**3 pasos:**\n1. En «Explorar la Luna», haz clic en un punto: aparece un panal de 37 celdas con su % de aptitud y un letrero verde si el alunizaje es viable.\n2. Mira la vista 3D del lander y mueve la barra de tiempo que está justo debajo para ver cómo cambian el Sol y la Tierra.\n3. Abre los desplegables de estadísticas (indicadores, línea de tiempo, batería, estaciones) para confirmar.\nTambién puedes pulsar «Enséñame» arriba para un recorrido guiado.",
        "**3 steps:**\n1. In “Explore the Moon”, click a point: a 37-cell honeycomb appears with each cell's aptitude % and a green sign if landing is viable.\n2. Watch the lander's 3D view and drag the time bar right below it to see the Sun and Earth move.\n3. Open the statistics drop-downs (KPIs, timeline, battery, seasons) to confirm.\nYou can also press “Guided tour” at the top."] },
  { kw: ["rayo", "rayos", "haz", "beam", "beams", "colores", "colours", "colors", "verde", "amarillo", "violeta", "impacto"],
    a: ["**Rayo hacia la Tierra** (sale de la antena): verde = señal directa buena · violeta = señal débil (la Tierra está a menos de 1° sobre la montaña) · rojo = una montaña la tapa.\n**Rayo del Sol** (llega a los paneles): ámbar = Sol bajo, poca energía · blanco-amarillo = Sol alto · rojo = el Sol está tapado.\nCuando un rayo sale rojo, la zona del terreno donde choca se ilumina en rojo translúcido: esa es la montaña que bloquea.",
        "**Earth beam** (from the antenna): green = good direct link · violet = weak link (Earth <1° above the ridge) · red = blocked by terrain.\n**Sun beam** (onto the panels): amber = low Sun, little power · white-yellow = high Sun · red = Sun blocked.\nWhen a beam is red, the terrain where it hits glows translucent red: that is the blocking mountain."] },
  { kw: ["comparo", "comparar", "varios", "cuatro", "4", "escenarios", "compare", "several", "scenarios"],
    a: ["Abre «Escenarios» y pulsa «+ Escenario» (hasta 4: A, B, C, D). Cada uno tiene su sitio, fecha y retraso. En la vista 3D pulsa «Ver los 4» para verlos a la vez; los indicadores y la línea de tiempo muestran una fila por escenario. El escenario con borde de color es el ACTIVO: recibe los clics de la Luna.",
        "Open “Scenarios” and press “+ Scenario” (up to 4: A–D). Each has its own site, date and delay. In the 3D view press “Show all” to see them together; KPIs and timeline show one row per scenario. The highlighted scenario is ACTIVE: it receives Moon clicks."] },
  { kw: ["fecha", "retraso", "retrasar", "lanzamiento", "date", "delay", "launch", "cuando"],
    a: ["En «Escenarios», cada tarjeta tiene la fecha de alunizaje y un control de retraso (+7 d, +14 d o la barra de 0 a 180 días). Todo se recalcula al instante. Para encontrar una buena fecha, abre «Días lunares y estaciones»: es un semáforo de 12 meses; haz clic en una casilla verde para usarla.",
        "In “Scenarios”, each card has the landing date and a delay control (+7 d, +14 d or the 0–180 day slider). Everything recomputes instantly. To find a good date open “Lunar days & seasons”: a 12-month traffic light; click a green cell to use it."] },
  { kw: ["datos", "fuente", "fuentes", "nasa", "jpl", "lola", "data", "source", "sources", "reales", "real"],
    a: ["**Posición del Sol y la Tierra:** NASA/JPL Horizons, hora a hora durante 12 meses (nov-2026 a nov-2027).\n**Relieve:** modelo láser LOLA del Lunar Reconnaissance Orbiter (≈1,9 km por píxel en el polo sur, ≈7,6 km en el resto).\n**Regla física:** sin atmósfera, un astro se ve solo si su elevación supera la altura de la montaña en esa dirección.\nLa batería y la temperatura son modelos simplificados, no telemetría real.",
        "**Sun and Earth positions:** NASA/JPL Horizons, hourly for 12 months (Nov-2026 to Nov-2027).\n**Terrain:** LOLA laser altimetry from the Lunar Reconnaissance Orbiter (≈1.9 km/px at the south pole, ≈7.6 km elsewhere).\n**Physics:** with no atmosphere, a body is visible only if its elevation exceeds the terrain height in that direction.\nBattery and temperature are simplified models, not real telemetry."] },
  { kw: ["tiempo", "barra", "reproducir", "velocidad", "play", "time", "speed", "slider"],
    a: ["La barra de tiempo está justo debajo de las vistas 3D. El botón Reproducir (1x, 10x, 30x), la barra te lleva a cualquier hora de los 30 días y los botones saltan al próximo ocaso o al momento en que se pierde la Tierra. La franja de color encima de la barra muestra cuándo hay Sol (ámbar) y Sol + Tierra (verde).",
        "The time bar sits right under the 3D views. Play starts (1x, 10x, 30x), the slider goes to any hour of the 30 days and the buttons jump to the next sunset or Earth loss. The coloured strip above shows Sun (amber) and Sun + Earth (green)."] },
  { kw: ["informe", "reporte", "demo", "tour", "report", "brief", "exportar"],
    a: ["Arriba tienes tres botones: «Enséñame» (recorre cada sección), «Demo» (una demostración automática con voz) e «Informe» (resumen de la misión listo para copiar).",
        "At the top there are three buttons: “Guided tour”, “Narrated demo” (automatic voiced walkthrough) and “Report” (mission summary ready to copy)."] },
  { kw: ["luna", "globo", "zoom", "mouse", "girar", "acercar", "moon", "globe", "rotate"],
    a: ["En el globo: arrastra para girar, usa la rueda o los botones +/− para acercar, y haz clic para analizar un punto. El botón ⤢ vuelve a la Luna completa. Abajo a la izquierda ves la coordenada bajo el cursor.",
        "On the globe: drag to rotate, wheel or +/− to zoom, click to analyse a point. The ⤢ button returns to the whole Moon. The coordinate under the cursor is shown bottom-left."] },
];

function entryText(e: GlossaryEntry, l: Lang) {
  const i = idx(l);
  const L = l === "es" ? ["Qué es", "Cómo se calcula", "Para qué sirve", "Cómo usarlo"] : ["What it is", "How it is computed", "Why it matters", "How to use it"];
  return `**${e.title[i]}**\n${L[0]}: ${e.what[i]}\n${L[1]}: ${e.how[i]}\n${L[2]}: ${e.why[i]}\n${L[3]}: ${e.use[i]}`;
}

const VERDICT: Record<string, [string, string]> = {
  VIABLE: [" alunizaje viable", " landing viable"],
  RELAY_REQUIRED: [" viable solo con satélite relé", " viable only with a relay satellite"],
  CRITICAL_FREEZE_RISK: [" no apto (riesgo de congelamiento)", " not suitable (freeze risk)"],
};

function rankScenarios(l: Lang) {
  const i = idx(l);
  const scs = useMissionStore.getState().scenarios.filter((s) => s.metrics);
  if (!scs.length) return l === "es" ? "Todavía se están cargando los escenarios." : "Scenarios are still loading.";
  const rows = scs.map((s) => ({ s, a: aptitude(s.metrics!) })).sort((x, y) => y.a - x.a);
  const lines = rows.map(({ s, a }, k) => `${k + 1}. **${s.label} · ${s.siteName}** — ${l === "es" ? "aptitud" : "aptitude"} ${a}/100, ${VERDICT[s.metrics!.viability][i]}. Sol ${s.metrics!.sunlightPct}% · Tierra ${s.metrics!.dtePct}%`);
  const best = rows[0];
  const tail = best.s.metrics!.viability === "VIABLE"
    ? (l === "es" ? `Recomendado: **${best.s.label}**. ${best.s.metrics!.viabilityReason}` : `Recommended: **${best.s.label}**.`)
    : (l === "es" ? "Ninguno es plenamente viable en esa fecha: prueba otra fecha en «Días lunares y estaciones» o un punto cercano con el panal." : "None is fully viable on that date: try another date in “Lunar days & seasons” or a nearby point with the honeycomb.");
  return `${lines.join("\n")}\n${tail}`;
}

function whyRed(l: Lang) {
  const i = idx(l);
  const scs = useMissionStore.getState().scenarios.filter((s) => s.metrics && s.metrics.viability !== "VIABLE");
  const general = l === "es"
    ? "Un sitio sale  cuando no hay Sol al alunizar o la batería llega a 0 % durante la misión, y  cuando hay energía pero la Tierra no se ve lo suficiente (haría falta un satélite relé)."
    : "A site is  when there is no Sun at landing or the battery reaches 0% during the mission, and  when power is fine but Earth is not visible enough (a relay satellite would be needed).";
  if (!scs.length) return general + (l === "es" ? "\nAhora mismo todos tus escenarios son viables." : "\nRight now all your scenarios are viable.");
  return `${general}\n${scs.map((s) => `• **${s.label} · ${s.siteName}**: ${VERDICT[s.metrics!.viability][i]} — ${s.metrics!.viabilityReason}`).join("\n")}\n${l === "es" ? "Solución: otra fecha (desplegable de estaciones) o un punto cercano más alto (clic en la Luna)." : "Fix: another date (seasons drop-down) or a higher nearby point (click the Moon)."}`;
}

function honeySummary(l: Lang) {
  const h = useUiStore.getState().honey;
  const e = entryText(GLOSSARY.aptitude, l);
  if (!h) return `${e}\n${l === "es" ? "Aún no has calculado un panal: haz clic en un punto de la Luna." : "No honeycomb yet: click a point on the Moon."}`;
  const ok = h.results.filter((r) => r.metrics.viability === "VIABLE").length;
  const best = [...h.results].sort((a, b) => b.aptitude - a.aptitude)[0];
  return `${e}\n${l === "es"
    ? `En tu último panal: ${ok} de ${h.results.length} celdas son viables; la mejor tiene ${best.aptitude}% en ${best.lat.toFixed(3)}°, ${best.lon.toFixed(3)}°.`
    : `In your last honeycomb: ${ok} of ${h.results.length} cells are viable; the best has ${best.aptitude}% at ${best.lat.toFixed(3)}°, ${best.lon.toFixed(3)}°.`}`;
}

const GLOSS_KW: Partial<Record<keyof typeof GLOSSARY, string[]>> = {
  verdict: ["veredicto", "semaforo", "viable", "verdict"], hoursToSunset: ["ocaso", "sunset", "atardecer"], hoursToEarthset: ["earthset", "perder la tierra"],
  solarElevation: ["elevacion", "altura del sol", "elevation"], power: ["potencia", "energia solar", "w/m", "power"], battery: ["bateria", "soc", "battery", "carga"],
  temperature: ["temperatura", "frio", "congel", "temperature"], sunlightPct: ["% con sol", "luz solar", "sunlight", "iluminacion"], dtePct: ["dte", "comunicacion", "senal", "link", "% con tierra"],
  goldenPct: ["ventana dorada", "golden", "sol y tierra"], longestShadow: ["sombra", "shadow", "noche"], aptitude: ["aptitud", "aptitude", "suitability", "probabilidad", "posibilidad"],
  honeycomb: ["panal", "abeja", "honeycomb", "hexagono", "celdas", "hexagon"], panorama: ["panorama", "360", "silueta", "skyplot"], timeline: ["linea de tiempo", "timeline", "gantt"],
  seasons: ["estaciones", "dias lunares", "seasons", "heatmap", "12 meses"], delay: ["retraso", "delay"], missionProfile: ["perfil", "duracion de la mision", "tipo de mision", "profile"],
  horizonSource: ["horizonte", "relieve", "montanas", "horizon", "terrain"],
};

/** Responde una pregunta en lenguaje natural sin IA externa. */
export function localAnswer(question: string, lang: Lang): string {
  const q = norm(question);
  const has = (...w: string[]) => w.some((x) => q.includes(x));
  // 1) Preguntas sobre el estado actual
  if (has("mejor", "best", "recomiend", "recommend", "cual elijo", "which")) return rankScenarios(lang);
  if (has("rojo", "red", "no apto", "congel", "por que sale", "why is")) return whyRed(lang);
  if (has("hexagono", "hexagon", "%", "porcentaje", "panal", "honeycomb", "probabilidad", "posibilidad")) return honeySummary(lang);
  if (has("puedo alunizar", "puedo aterrizar", "se puede alunizar", "can i land", "es viable")) return rankScenarios(lang);
  // 2) Preguntas frecuentes y glosario: gana la entrada con más palabras clave
  let best: { score: number; text: string } = { score: 0, text: "" };
  for (const f of FAQ) {
    const score = f.kw.filter((k) => q.split(" ").includes(k) || (k.length > 4 && q.includes(k))).length;
    if (score > best.score) best = { score, text: f.a[idx(lang)] };
  }
  for (const [k, kws] of Object.entries(GLOSS_KW)) {
    const score = kws!.filter((w) => q.includes(w)).length * 1.5;
    if (score > best.score) best = { score, text: entryText(GLOSSARY[k as keyof typeof GLOSSARY], lang) };
  }
  if (best.score > 0) return best.text;
  return lang === "es"
    ? "No encontré eso en la guía. Puedo explicarte: cómo empezar, el % de los hexágonos, los colores de los rayos, el veredicto, la batería, la temperatura, la ventana dorada, las estaciones, el retraso, o decirte cuál de tus escenarios es mejor. Para preguntas libres con IA, configura LLM_API_KEY en .env.local."
    : "I could not find that in the guide. I can explain: getting started, hexagon %, beam colours, verdict, battery, temperature, golden window, seasons, delay, or tell you which scenario is best. For free-form AI questions set LLM_API_KEY in .env.local.";
}

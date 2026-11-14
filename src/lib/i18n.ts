"use client";
// Diccionario ES/EN de la interfaz. Uso: const t = useT(); t("sunset")
import { useMissionStore } from "@/store/useMissionStore";

const dict = {
  appSubtitle: ["Simulador de sitios, fechas y retrasos", "Landing site, date & delay simulator"],
  scenario: ["Escenario", "Scenario"],
  addScenario: ["Escenario", "Scenario"],
  remove: ["Quitar", "Remove"],
  site: ["Sitio", "Site"],
  useLatLon: ["Usar lat/lon", "Use lat/lon"],
  landingDate: ["Fecha de alunizaje (UTC)", "Landing date (UTC)"],
  delay: ["Retraso", "Delay"],
  days: ["días", "days"],
  effectiveLanding: ["Alunizaje efectivo", "Effective landing"],
  engineer: ["Ingeniero", "Engineer"],
  educator: ["Educador", "Educator"],
  battery: ["Batería", "Battery"],
  quality: ["Calidad", "Quality"],
  view: ["Vista", "View"],
  view3d: ["Horizonte 3D", "3D horizon"],
  viewPano: ["Panorama 2D", "2D panorama"],
  viewGlobe: ["Globo lunar", "Lunar globe"],
  clone: ["Clonar", "Clone"],
  hoursToSunset: ["Horas a Sunset", "Hours to sunset"],
  lightLeft: ["Luz restante", "Light left"],
  inShadow: ["EN SOMBRA", "IN SHADOW"],
  hoursToEarthset: ["Horas a Earthset", "Hours to Earthset"],
  earthSignal: ["Señal con la Tierra", "Earth signal"],
  noDte: ["SIN DTE", "NO DTE"],
  degraded: ["degradado", "degraded"],
  solarEl: ["Elevación solar", "Solar elevation"],
  power: ["Potencia", "Power"],
  soc: ["Batería (SoC)", "Battery (SoC)"],
  temp: ["Temp. superficie", "Surface temp."],
  sunlight: ["Luz", "Sunlight"],
  golden: ["Ventana dorada", "Golden window"],
  longestShadow: ["Sombra más larga", "Longest shadow"],
  minSoc: ["SoC mínimo", "Min SoC"],
  viable: ["MISIÓN VIABLE", "MISSION VIABLE"],
  relay: ["REQUIERE RELÉ", "RELAY REQUIRED"],
  freeze: ["RIESGO DE CONGELAMIENTO", "FREEZE RISK"],
  loading: ["Cargando…", "Loading…"],
  timeline: ["Línea de tiempo", "Timeline"],
  legendSun: ["Luz solar", "Sunlight"],
  legendDte: ["Comunicación directa (DTE)", "Direct-to-Earth (DTE)"],
  legendDeg: ["DTE degradado (multipath)", "Degraded DTE (multipath)"],
  legendGolden: ["Ventana dorada (Sol + Tierra)", "Golden window (Sun + Earth)"],
  honeyTitle: ["Selección de coordenadas · Panal de abeja", "Coordinate selection · Honeycomb"],
  honeyHelp: [
    "Muestreo hexagonal alrededor del escenario activo: cada celda equidista de sus 6 vecinas, cubriendo el área sin huecos ni sesgo de dirección. Para cada celda se calcula su horizonte real (LOLA) y se trasladan las efemérides de JPL.",
    "Hexagonal sampling around the active scenario: every cell is equidistant to its 6 neighbours, covering the area with no gaps or directional bias. Each cell gets its own real horizon (LOLA) and transferred JPL ephemerides.",
  ],
  spacing: ["Separación", "Spacing"],
  rings: ["Anillos", "Rings"],
  metric: ["Métrica", "Metric"],
  compute: ["Calcular", "Compute"],
  assignTo: ["Asignar a", "Assign to"],
  seasonsTitle: ["Días lunares y estaciones · 12 meses", "Lunar days & seasons · 12 months"],
  seasonsHelp: [
    "Cada celda = alunizar ese día y evaluar la misión completa. Clic para usar esa fecha.",
    "Each cell = landing on that day and evaluating the full mission. Click to use that date.",
  ],
  allSites: ["Todos los sitios", "All sites"],
  polarTitle: ["Mapa polar sur (LOLA)", "South polar map (LOLA)"],
  polarHelp: ["Clic para colocar el escenario activo en esa coordenada.", "Click to place the active scenario at that coordinate."],
  earthVsMoon: ["Tierra vs. Luna", "Earth vs. Moon"],
  tour: ["Tour", "Tour"],
  demo: ["Demo narrada", "Narrated demo"],
  brief: ["Informe de misión", "Mission brief"],
  energyThermal: ["Energía y temperatura", "Energy & temperature"],
  active: ["activo", "active"],
  next: ["Siguiente", "Next"],
  prev: ["Anterior", "Back"],
  close: ["Cerrar", "Close"],
} as const;

export type I18nKey = keyof typeof dict;

export function useT() {
  const lang = useMissionStore((s) => s.lang);
  return (k: I18nKey) => dict[k][lang === "es" ? 0 : 1];
}

export function tStatic(k: I18nKey, lang: "es" | "en") {
  return dict[k][lang === "es" ? 0 : 1];
}

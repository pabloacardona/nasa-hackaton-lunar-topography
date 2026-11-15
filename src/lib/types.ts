// ============================================================================
// CONTRATO DE DATOS (Persona 1 <-> Persona 2)
// Si cambian algo aquí, avisen al compañero: todo el frontend lee estos tipos.
// ============================================================================

export type Region = "south_pole" | "equatorial" | "far_side";
export type PanelType = "vertical" | "horizontal";
export type ScenarioLabel = "A" | "B" | "C" | "D";
export const SCENARIO_LABELS: ScenarioLabel[] = ["A", "B", "C", "D"];
export const SCENARIO_COLORS: Record<ScenarioLabel, string> = { A: "#5f8fb8", B: "#b594c4", C: "#8fb07a", D: "#c79a6a" };
export type ViewMode = "split_3d" | "orbital_globe" | "horizon_panorama";
export type AudienceMode = "engineer" | "educator";
export type Viability = "VIABLE" | "RELAY_REQUIRED" | "CRITICAL_FREEZE_RISK";
export type DteQuality = "full" | "degraded" | "none";

/** [azimut_deg, elevacion_deg] – azimut medido desde el Norte en sentido horario. */
export type AzEl = [number, number];

/** Sitio curado (public/data/sites.json). Las efemérides van en un binario aparte. */
export interface CuratedSite {
  id: string;
  name: string;
  mission: string;
  region: Region;
  lat: number;
  lon: number;
  /** Coordenada usada en JPL Horizons (si difiere, se trasladan las efemérides) */
  ephemOrigin?: { lat: number; lon: number };
  elevationM?: number;
  panelType: PanelType;
  description: string;
  horizonSource: string;
  /** 360 valores: altura angular del terreno (°) para azimut 0..359 (LOLA) */
  horizonProfileDeg: number[];
}

export interface SitesDataset {
  source: string;
  startUtc: string;
  stepHours: number;
  hours: number;
  ephemerisFile: string;
  note: string;
  sites: CuratedSite[];
}

/** Parámetros del modelo de energía (editables). */
export interface PowerParams {
  batteryHours: number; // horas de autonomía a carga nominal
  loadW: number; // consumo medio
  panelAreaM2: number;
  panelEfficiency: number;
}

/** Una hora del timeline ya cruzada (Horizons x LOLA) */
export interface HourSample {
  hourIndex: number;
  timestamp: string;
  sunAz: number;
  sunEl: number;
  terrainAtSun: number;
  sunVisible: boolean;
  earthAz: number;
  earthEl: number;
  terrainAtEarth: number;
  earthVisible: boolean;
  /** Margen de la Tierra sobre la cresta (°). <1° = multipath (solo telemetría) */
  earthMarginDeg: number;
  dte: DteQuality;
  goldenWindow: boolean;
  solarPowerWM2: number;
  hoursToSunset: number;
  hoursToEarthset: number;
  /** Estado de carga de la batería (0-100 %) */
  socPct: number;
  /** Temperatura superficial estimada del regolito (°C), modelo simple */
  surfaceTempC: number;
}

export interface ScenarioMetrics {
  sunlightPct: number;
  dtePct: number;
  dteDegradedPct: number;
  goldenPct: number;
  sunlightFromLandingH: number;
  longestSunlightStreakH: number;
  longestShadowH: number;
  longestDteBlackoutH: number;
  peakSunEl: number;
  avgPowerWM2: number;
  minSocPct: number;
  /** Hora en que la batería se agota (null si nunca) */
  batteryDepletedAtH: number | null;
  tempMinC: number;
  tempMaxC: number;
  sunAtLanding: boolean;
  earthAtLanding: boolean;
  viability: Viability;
  viabilityReason: string;
}

export interface Scenario {
  label: ScenarioLabel;
  siteId: string; // id curado o "custom"
  siteName: string;
  lat: number;
  lon: number;
  region: Region;
  panelType: PanelType;
  horizonProfileDeg: number[];
  horizonSource: string;
  /** Sitio curado de donde se trasladan las efemérides (coordenadas personalizadas cercanas) */
  parentSiteId: string | null;
  /** Fecha base de alunizaje (ISO UTC) */
  baseDate: string;
  delayDays: number;
  timeline: HourSample[];
  metrics: ScenarioMetrics | null;
  source: "cache" | "transfer" | "live" | "none";
  loading: boolean;
  error: string | null;
}

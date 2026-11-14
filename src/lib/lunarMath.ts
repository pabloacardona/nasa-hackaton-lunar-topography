// ============================================================================
// MOTOR DE CRUCE: JPL Horizons (Sol/Tierra) x LOLA (perfil de horizonte)
// Regla sin atmósfera: un astro es visible si su elevación > altura del terreno
// en ese mismo azimut. No hay refracción ni crepúsculo.
// + Modelo de batería (SoC), DTE degradado (multipath) y temperatura superficial.
// ============================================================================
import type {
  DteQuality,
  HourSample,
  PanelType,
  PowerParams,
  Region,
  ScenarioMetrics,
  Viability,
} from "./types";
import type { Ephem } from "./ephemeris";

export const SOLAR_CONSTANT = 1361; // W/m² (sin atmósfera)
export const WINDOW_HOURS = 720; // 30 días ≈ 1 día sinódico lunar (29.5 d)
export const MOON_RADIUS_KM = 1737.4;
export const MULTIPATH_DEG = 1; // Tierra a menos de 1° sobre la cresta => enlace degradado

export const DEFAULT_POWER: PowerParams = { batteryHours: 48, loadW: 150, panelAreaM2: 3, panelEfficiency: 0.29 };

/** Perfiles de misión (horas en superficie) */
export const MISSION_PROFILES = [
  { hours: 156, label: "Artemis tripulada (6.5 d)", labelEn: "Crewed Artemis (6.5 d)" },
  { hours: 240, label: "CLPS lander (10 d)", labelEn: "CLPS lander (10 d)" },
  { hours: 336, label: "CLPS extendida (14 d)", labelEn: "Extended CLPS (14 d)" },
  { hours: 720, label: "Rover polar (30 d)", labelEn: "Polar rover (30 d)" },
] as const;

/** Altura del terreno en un azimut arbitrario (interpolación lineal 0..359). */
export function terrainAt(profile: number[], az: number): number {
  if (!profile.length) return 0;
  const n = profile.length;
  const step = 360 / n;
  const a = (((az % 360) + 360) % 360) / step;
  const i0 = Math.floor(a) % n;
  const i1 = (i0 + 1) % n;
  const t = a - Math.floor(a);
  return profile[i0] * (1 - t) + profile[i1] * t;
}

/**
 * Potencia instantánea por m² de panel.
 * - Paneles verticales (polo sur): ∝ cos(el)  (el Sol va al ras del horizonte)
 * - Paneles horizontales (ecuador/Apolo): ∝ sin(el)
 */
export function solarPower(el: number, visible: boolean, panel: PanelType): number {
  if (!visible || el <= 0) return 0;
  const rad = (el * Math.PI) / 180;
  const f = panel === "vertical" ? Math.cos(rad) : Math.sin(rad);
  return Math.round(SOLAR_CONSTANT * Math.max(0, f));
}

// Temperatura superficial (modelo de equilibrio radiativo + enfriamiento exponencial)
const SIGMA = 5.67e-8, ALBEDO = 0.12, EMISS = 0.95, T_MIN_K = 90;
export function equilibriumTempK(sunEl: number, lit: boolean): number {
  if (!lit || sunEl <= 0) return T_MIN_K;
  const flux = (1 - ALBEDO) * SOLAR_CONSTANT * Math.sin((sunEl * Math.PI) / 180);
  return Math.max(T_MIN_K, Math.pow(flux / (EMISS * SIGMA), 0.25));
}

export function crossLunarData(
  e: Ephem,
  horizonProfile: number[],
  panel: PanelType,
  startUtc: string,
  power: PowerParams = DEFAULT_POWER
): HourSample[] {
  const t0 = new Date(startUtc).getTime();
  const n = e.sunAz.length;
  const out: HourSample[] = new Array(n);
  const capacityWh = power.batteryHours * power.loadW;
  let soc = capacityWh;
  let tempK = equilibriumTempK(e.sunEl[0], e.sunEl[0] > terrainAt(horizonProfile, e.sunAz[0]));
  for (let i = 0; i < n; i++) {
    const sunAz = e.sunAz[i], sunEl = e.sunEl[i], earthAz = e.earthAz[i], earthEl = e.earthEl[i];
    const terrainAtSun = terrainAt(horizonProfile, sunAz);
    const terrainAtEarth = terrainAt(horizonProfile, earthAz);
    const sunVisible = sunEl > terrainAtSun;
    const earthMarginDeg = earthEl - terrainAtEarth;
    const earthVisible = earthMarginDeg > 0;
    const dte: DteQuality = !earthVisible ? "none" : earthMarginDeg < MULTIPATH_DEG ? "degraded" : "full";
    const solarPowerWM2 = solarPower(sunEl, sunVisible, panel);
    // Batería: entra la energía del panel, sale el consumo
    const inW = solarPowerWM2 * power.panelAreaM2 * power.panelEfficiency;
    soc = Math.max(0, Math.min(capacityWh, soc + inW - power.loadW));
    // Temperatura: se acerca al equilibrio (rápido al calentar, lento al enfriar)
    const target = equilibriumTempK(sunEl, sunVisible);
    const tau = target > tempK ? 2 : 10;
    tempK = target + (tempK - target) * Math.exp(-1 / tau);
    out[i] = {
      hourIndex: i,
      timestamp: new Date(t0 + i * 3600_000).toISOString(),
      sunAz,
      sunEl,
      terrainAtSun: Math.round(terrainAtSun * 100) / 100,
      sunVisible,
      earthAz,
      earthEl,
      terrainAtEarth: Math.round(terrainAtEarth * 100) / 100,
      earthVisible,
      earthMarginDeg: Math.round(earthMarginDeg * 100) / 100,
      dte,
      goldenWindow: sunVisible && earthVisible,
      solarPowerWM2,
      hoursToSunset: 0,
      hoursToEarthset: 0,
      socPct: Math.round((soc / capacityWh) * 1000) / 10,
      surfaceTempC: Math.round(tempK - 273.15),
    };
  }
  // Cuentas regresivas en O(n) recorriendo hacia atrás
  let runSun = 0;
  let runEarth = 0;
  for (let i = n - 1; i >= 0; i--) {
    runSun = out[i].sunVisible ? runSun + 1 : 0;
    runEarth = out[i].earthVisible ? runEarth + 1 : 0;
    out[i].hoursToSunset = out[i].sunVisible ? runSun - 1 : 0;
    out[i].hoursToEarthset = out[i].earthVisible ? runEarth - 1 : 0;
  }
  return out;
}

function longestRun(arr: boolean[], value: boolean): number {
  let best = 0;
  let cur = 0;
  for (const v of arr) {
    cur = v === value ? cur + 1 : 0;
    if (cur > best) best = cur;
  }
  return best;
}

/** Las métricas y el semáforo se evalúan sobre la duración de la misión desde el alunizaje. */
export function computeMetrics(fullTimeline: HourSample[], region: Region, missionHours = 240): ScenarioMetrics {
  const timeline = fullTimeline.slice(0, Math.max(1, missionHours));
  const n = timeline.length || 1;
  const sunArr = timeline.map((h) => h.sunVisible);
  const earthArr = timeline.map((h) => h.earthVisible);
  const sunlight = sunArr.filter(Boolean).length;
  const dte = earthArr.filter(Boolean).length;
  const degraded = timeline.filter((h) => h.dte === "degraded").length;
  const golden = timeline.filter((h) => h.goldenWindow).length;
  const first = timeline[0];
  const sunlightFromLandingH = first?.sunVisible ? Math.min(missionHours, first.hoursToSunset + 1) : 0;
  const depletedIdx = timeline.findIndex((h) => h.socPct <= 0);
  const temps = timeline.map((h) => h.surfaceTempC);

  let viability: Viability = "VIABLE";
  let viabilityReason = `Energía y comunicación suficientes durante las ${missionHours} h de misión.`;
  if (!first?.sunVisible) {
    viability = "CRITICAL_FREEZE_RISK";
    viabilityReason = "Sin Sol en el momento del alunizaje (cámaras de descenso ciegas, sin carga).";
  } else if (depletedIdx >= 0) {
    viability = "CRITICAL_FREEZE_RISK";
    viabilityReason = `La batería se agota en T+${depletedIdx} h (sombra de ${longestRun(sunArr, false)} h).`;
  } else if (dte === 0 || region === "far_side") {
    viability = "RELAY_REQUIRED";
    viabilityReason = "La Tierra nunca es visible: requiere satélite relé.";
  } else if (!first.earthVisible || dte / n < 0.5) {
    viability = "RELAY_REQUIRED";
    viabilityReason = !first.earthVisible
      ? "Tierra oculta al alunizar: descenso sin seguimiento directo."
      : `Comunicación directa solo ${Math.round((dte / n) * 100)}% del tiempo.`;
  }

  return {
    sunlightPct: Math.round((sunlight / n) * 100),
    dtePct: Math.round((dte / n) * 100),
    dteDegradedPct: Math.round((degraded / n) * 100),
    goldenPct: Math.round((golden / n) * 100),
    sunlightFromLandingH,
    longestSunlightStreakH: longestRun(sunArr, true),
    longestShadowH: longestRun(sunArr, false),
    longestDteBlackoutH: longestRun(earthArr, false),
    peakSunEl: Math.round(Math.max(...timeline.map((h) => h.sunEl)) * 100) / 100,
    avgPowerWM2: Math.round(timeline.reduce((s, h) => s + h.solarPowerWM2, 0) / n),
    minSocPct: Math.min(...timeline.map((h) => h.socPct)),
    batteryDepletedAtH: depletedIdx >= 0 ? depletedIdx : null,
    tempMinC: Math.min(...temps),
    tempMaxC: Math.max(...temps),
    sunAtLanding: !!first?.sunVisible,
    earthAtLanding: !!first?.earthVisible,
    viability,
    viabilityReason,
  };
}

// ---------------------------------------------------------------------------
// Análisis anual rápido (heatmap sitio × fecha y buscador de ventanas)
// ---------------------------------------------------------------------------
export interface YearVisibility {
  sun: Uint8Array;
  earth: Uint8Array;
  powerW: Float32Array; // potencia neta disponible por hora (W) con los parámetros dados
}

export function yearVisibility(e: Ephem, profile: number[], panel: PanelType, power: PowerParams = DEFAULT_POWER): YearVisibility {
  const n = e.sunAz.length;
  const sun = new Uint8Array(n), earth = new Uint8Array(n), powerW = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const sv = e.sunEl[i] > terrainAt(profile, e.sunAz[i]);
    sun[i] = sv ? 1 : 0;
    earth[i] = e.earthEl[i] > terrainAt(profile, e.earthAz[i]) ? 1 : 0;
    powerW[i] = solarPower(e.sunEl[i], sv, panel) * power.panelAreaM2 * power.panelEfficiency;
  }
  return { sun, earth, powerW };
}

export interface WindowStats {
  sunPct: number;
  dtePct: number;
  goldenPct: number;
  /** 0 = viable, 1 = requiere relé, 2 = riesgo de congelamiento */
  status: 0 | 1 | 2;
  /** Puntaje 0..100 para ordenar ventanas */
  score: number;
}

export function windowStats(v: YearVisibility, start: number, hours: number, power: PowerParams = DEFAULT_POWER): WindowStats | null {
  if (start + hours > v.sun.length) return null;
  let s = 0, e = 0, g = 0;
  const cap = power.batteryHours * power.loadW;
  let soc = cap, dead = false;
  for (let i = start; i < start + hours; i++) {
    s += v.sun[i];
    e += v.earth[i];
    g += v.sun[i] & v.earth[i];
    soc = Math.min(cap, soc + v.powerW[i] - power.loadW);
    if (soc <= 0) dead = true;
  }
  const status: 0 | 1 | 2 = !v.sun[start] || dead ? 2 : !v.earth[start] || e / hours < 0.5 ? 1 : 0;
  const goldenPct = Math.round((g / hours) * 100);
  const score = status === 2 ? goldenPct * 0.2 : status === 1 ? 40 + goldenPct * 0.3 : 60 + goldenPct * 0.4;
  return { sunPct: Math.round((s / hours) * 100), dtePct: Math.round((e / hours) * 100), goldenPct, status, score: Math.round(score) };
}

/** Busca las mejores horas de alunizaje (paso en horas) dentro de un rango. */
export function findBestWindows(v: YearVisibility, fromHour: number, toHour: number, missionHours: number, power: PowerParams, step = 6, top = 5) {
  const res: { hour: number; stats: WindowStats }[] = [];
  for (let h = Math.max(0, fromHour); h <= toHour; h += step) {
    const st = windowStats(v, h, missionHours, power);
    if (st) res.push({ hour: h, stats: st });
  }
  res.sort((a, b) => b.stats.score - a.stats.score);
  // evitar devolver horas casi iguales
  const picked: typeof res = [];
  for (const r of res) {
    if (picked.every((p) => Math.abs(p.hour - r.hour) > 48)) picked.push(r);
    if (picked.length >= top) break;
  }
  return picked;
}

/** Busca el próximo evento crítico desde una hora dada (para el slider y Copilot). */
export function findEvent(
  timeline: HourSample[],
  from: number,
  event: "next_sunset" | "next_earthset" | "peak_power" | "next_sunrise" | "battery_empty"
): number {
  if (event === "peak_power") {
    let best = 0;
    timeline.forEach((h, i) => {
      if (h.solarPowerWM2 > timeline[best].solarPowerWM2) best = i;
    });
    return best;
  }
  for (let i = Math.max(1, from + 1); i < timeline.length; i++) {
    const prev = timeline[i - 1];
    const cur = timeline[i];
    if (event === "next_sunset" && prev.sunVisible && !cur.sunVisible) return i;
    if (event === "next_earthset" && prev.earthVisible && !cur.earthVisible) return i;
    if (event === "next_sunrise" && !prev.sunVisible && cur.sunVisible) return i;
    if (event === "battery_empty" && cur.socPct <= 0) return i;
  }
  return from;
}

export function regionFromLat(lat: number, lon: number): "south_pole" | "equatorial" | "far_side" {
  const lonN = ((lon + 540) % 360) - 180;
  if (Math.abs(lonN) > 100) return "far_side"; // aproximación: hemisferio oculto
  return lat < -75 ? "south_pole" : "equatorial";
}

/** Coordenadas de azimut/elevación → vector 3D (Y arriba, Norte = -Z, Este = +X). */
export function azElToVec3(az: number, el: number, r: number): [number, number, number] {
  const a = (az * Math.PI) / 180;
  const e = (el * Math.PI) / 180;
  return [r * Math.cos(e) * Math.sin(a), r * Math.sin(e), -r * Math.cos(e) * Math.cos(a)];
}

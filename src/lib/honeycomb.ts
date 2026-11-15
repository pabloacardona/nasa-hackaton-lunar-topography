// ============================================================================
// Metodología "panal de abeja": muestreo hexagonal de coordenadas alrededor de un sitio.
// Para cada celda: horizonte real (LOLA) + efemérides trasladadas + métricas de misión.
// ============================================================================
import { hexGrid, offsetKm, type HexCell, type LatLon } from "./geo";
import { horizonProfile, loadDem } from "./dem";
import { transferEphem, type Ephem } from "./ephemeris";
import { aptitude, computeMetrics, crossLunarData } from "./lunarMath";
import type { HourSample, PanelType, PowerParams, Region, ScenarioMetrics } from "./types";

export interface HoneyResult {
  cell: HexCell;
  lat: number;
  lon: number;
  metrics: ScenarioMetrics;
  horizonMaxDeg: number;
  /** Aptitud de aterrizaje 0-100 (ver lunarMath.aptitude) */
  aptitude: number;
}

export function timelineToEphem(tl: HourSample[]): Ephem {
  const n = tl.length;
  const e: Ephem = { sunAz: new Float32Array(n), sunEl: new Float32Array(n), earthAz: new Float32Array(n), earthEl: new Float32Array(n) };
  tl.forEach((h, i) => {
    e.sunAz[i] = h.sunAz;
    e.sunEl[i] = h.sunEl;
    e.earthAz[i] = h.earthAz;
    e.earthEl[i] = h.earthEl;
  });
  return e;
}

export async function computeHoneycomb(opts: {
  center: LatLon;
  timeline: HourSample[];
  startUtc: string;
  rings: number;
  spacingKm: number;
  missionHours: number;
  power: PowerParams;
  panel: PanelType;
  region: Region;
  onProgress?: (done: number, total: number) => void;
}): Promise<HoneyResult[]> {
  await loadDem();
  const base = timelineToEphem(opts.timeline);
  const cells = hexGrid(opts.rings, opts.spacingKm);
  const out: HoneyResult[] = [];
  for (const [i, cell] of cells.entries()) {
    const p = offsetKm(opts.center, cell.northKm, cell.eastKm);
    const profile = horizonProfile(p.lat, p.lon);
    const e = cell.ring === 0 ? base : transferEphem(base, opts.center, p);
    const tl = crossLunarData(e, profile, opts.panel, opts.startUtc, opts.power);
    const metrics = computeMetrics(tl, opts.region, opts.missionHours);
    out.push({ cell, lat: p.lat, lon: p.lon, metrics, horizonMaxDeg: Math.max(...profile), aptitude: aptitude(metrics) });
    opts.onProgress?.(i + 1, cells.length);
    if (i % 3 === 2) await new Promise((r) => setTimeout(r, 0)); // mantener la UI fluida
  }
  return out;
}

export type HoneyMetric = "golden" | "sun" | "dte" | "minSoc";
export const honeyValue = (r: HoneyResult, m: HoneyMetric) =>
  m === "golden" ? r.metrics.goldenPct : m === "sun" ? r.metrics.sunlightPct : m === "dte" ? r.metrics.dtePct : r.metrics.minSocPct;

/** Puntaje para ordenar celdas = aptitud de aterrizaje. */
export const honeyScore = (r: HoneyResult) => r.aptitude;

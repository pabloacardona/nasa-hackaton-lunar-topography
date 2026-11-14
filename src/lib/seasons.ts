// Análisis anual: matriz fila(escenario/sitio) × día de alunizaje y resumen por lunación.
import { useMissionStore } from "@/store/useMissionStore";
import { findBestWindows, windowStats, yearVisibility, type WindowStats, type YearVisibility } from "./lunarMath";
import type { PanelType, PowerParams } from "./types";
import type { Ephem } from "./ephemeris";

export const SYNODIC_H = 29.530589 * 24;

export interface SeasonRow {
  key: string;
  label: string;
  color: string;
  scenarioLabel?: string;
  siteId?: string;
  vis: YearVisibility;
  days: (WindowStats | null)[];
  lunations: { sunPct: number; dtePct: number }[];
}

const visCache = new Map<string, YearVisibility>();

export function buildRow(key: string, e: Ephem, profile: number[], panel: PanelType, power: PowerParams, missionHours: number) {
  const ck = `${key}|${panel}|${power.panelAreaM2}|${power.panelEfficiency}|${profile.length}|${profile[0]}|${profile[90]}`;
  let vis = visCache.get(ck);
  if (!vis) {
    vis = yearVisibility(e, profile, panel, power);
    visCache.set(ck, vis);
  }
  const nDays = Math.floor(vis.sun.length / 24);
  const days = Array.from({ length: nDays }, (_, d) => windowStats(vis!, d * 24, missionHours, power));
  const lunations: { sunPct: number; dtePct: number }[] = [];
  for (let k = 0; (k + 1) * SYNODIC_H <= vis.sun.length; k++) {
    const a = Math.round(k * SYNODIC_H), b = Math.round((k + 1) * SYNODIC_H);
    let s = 0, t = 0;
    for (let i = a; i < b; i++) {
      s += vis.sun[i];
      t += vis.earth[i];
    }
    lunations.push({ sunPct: Math.round((s / (b - a)) * 100), dtePct: Math.round((t / (b - a)) * 100) });
  }
  return { vis, days, lunations };
}

/** Buscador de mejores ventanas para un escenario dentro de un rango de fechas (usa la caché anual). */
export function bestWindowsForScenario(label: string, fromIso: string, toIso: string, top = 5) {
  const st = useMissionStore.getState();
  const sc = st.scenarios.find((s) => s.label === label);
  const ds = st.dataset;
  if (!sc || !ds) return null;
  const e = st.getYearEphem(sc.label);
  if (!e) return null;
  const vis = buildRow(`${sc.label}:${sc.lat},${sc.lon}`, e, sc.horizonProfileDeg, sc.panelType, st.power, st.missionHours).vis;
  const t0 = new Date(ds.startUtc).getTime();
  const from = Math.max(0, Math.round((new Date(fromIso).getTime() - t0) / 3600_000));
  const to = Math.min(vis.sun.length - st.missionHours, Math.round((new Date(toIso).getTime() - t0) / 3600_000));
  return findBestWindows(vis, from, to, st.missionHours, st.power, 6, top).map((w) => ({
    landingUtc: new Date(t0 + w.hour * 3600_000).toISOString(),
    ...w.stats,
  }));
}

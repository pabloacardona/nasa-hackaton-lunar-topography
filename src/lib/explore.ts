// Exploración con un clic: mover el escenario activo al punto, calcular el panal de abeja
// alrededor y enfocar la cámara del globo en la zona.
import { effectiveStart, useMissionStore } from "@/store/useMissionStore";
import { useUiStore } from "@/store/useUiStore";
import { computeHoneycomb, honeyScore } from "./honeycomb";
import type { ScenarioLabel } from "./types";

let runId = 0;

export async function exploreAt(lat: number, lon: number, opts: { label?: ScenarioLabel; spacingKm?: number; rings?: number; moveScenario?: boolean } = {}) {
  const ui = useUiStore.getState();
  const st = useMissionStore.getState();
  const label = opts.label ?? st.activeLabel;
  const spacingKm = opts.spacingKm ?? ui.honeySpacingKm;
  const rings = opts.rings ?? ui.honeyRings;
  const id = ++runId;
  ui.setHoneyError(null);
  ui.focusGlobe(lat, lon, spacingKm * (rings + 1) * 2.4);
  ui.setHoneyBusy({ done: 0, total: 1 + 3 * rings * (rings + 1) });

  if (opts.moveScenario !== false) await st.setCustomCoords(label, lat, lon);
  const sc = useMissionStore.getState().getScenario(label);
  if (id !== runId) return null; // hubo otro clic mientras tanto
  if (!sc?.timeline.length || sc.error) {
    ui.setHoneyBusy(null);
    ui.setHoneyError(sc?.error ?? "No hay efemérides para ese punto (lejos de los sitios en caché y sin conexión a JPL).");
    return null;
  }
  const s2 = useMissionStore.getState();
  const results = await computeHoneycomb({
    center: { lat: sc.lat, lon: sc.lon }, timeline: sc.timeline, startUtc: effectiveStart(sc), rings, spacingKm,
    missionHours: s2.missionHours, power: s2.power, panel: sc.panelType, region: sc.region,
    onProgress: (done, total) => { if (id === runId) useUiStore.getState().setHoneyBusy({ done, total }); },
  });
  if (id !== runId) return null;
  useUiStore.getState().setHoney({ center: label, centerLat: sc.lat, centerLon: sc.lon, spacingKm, rings, results });
  useUiStore.getState().setHoneyBusy(null);
  return [...results].sort((a, b) => honeyScore(b) - honeyScore(a));
}

/** Mueve el escenario activo a una celda del panal SIN recalcular el panal (para comparar). */
export async function applyCell(lat: number, lon: number, label?: ScenarioLabel) {
  const st = useMissionStore.getState();
  await st.setCustomCoords(label ?? st.activeLabel, lat, lon, `Celda panal (${lat.toFixed(3)}°, ${lon.toFixed(2)}°)`);
}

"use client";
// ============================================================================
// ESTADO GLOBAL (Zustand): lo leen el 3D, el dashboard y CopilotKit.
// - Hasta 4 escenarios (A-D)
// - `playhead` (float) cambia cada frame y SOLO lo lee el 3D vía getState() en useFrame.
// - `currentHourIndex` (entero) se publica con límite de frecuencia para los paneles DOM.
// ============================================================================
import { create } from "zustand";
import type {
  AudienceMode,
  CuratedSite,
  PowerParams,
  Scenario,
  ScenarioLabel,
  SitesDataset,
  ViewMode,
} from "@/lib/types";
import { SCENARIO_LABELS } from "@/lib/types";
import { DEFAULT_POWER, WINDOW_HOURS, computeMetrics, crossLunarData, findEvent, regionFromLat } from "@/lib/lunarMath";
import { type Ephem, decodeEphemeris, fromAzEl, sliceEphem, transferEphem } from "@/lib/ephemeris";
import { distanceKm } from "@/lib/geo";
import { horizonProfile, loadDem, demResolutionKm } from "@/lib/dem";

const DEFAULT_DATE = "2026-11-15T00:00:00Z";
const TRANSFER_MAX_KM = 120;
export type Lang = "es" | "en";
export type EventType = "next_sunset" | "next_earthset" | "peak_power" | "next_sunrise" | "battery_empty";

function emptyScenario(label: ScenarioLabel, siteId: string): Scenario {
  return {
    label, siteId, siteName: "", lat: 0, lon: 0, region: "south_pole", panelType: "vertical",
    horizonProfileDeg: [], horizonSource: "", parentSiteId: null, baseDate: DEFAULT_DATE, delayDays: 0,
    timeline: [], metrics: null, source: "none", loading: false, error: null,
  };
}

export const effectiveStart = (s: Scenario) =>
  new Date(new Date(s.baseDate).getTime() + s.delayDays * 86400_000).toISOString();

// Cache de efemérides anuales para coordenadas personalizadas (clave lat,lon)
const yearCache = new Map<string, Ephem>();
let lastHourCommit = 0;

interface MissionState {
  dataset: SitesDataset | null;
  ephem: Record<string, Ephem>;
  scenarios: Scenario[];
  activeLabel: ScenarioLabel;
  view3d: ScenarioLabel[];
  playhead: number;
  currentHourIndex: number;
  isPlaying: boolean;
  speed: 1 | 10 | 30;
  viewMode: ViewMode;
  audienceMode: AudienceMode;
  missionHours: number;
  power: PowerParams;
  lang: Lang;

  loadDataset: () => Promise<void>;
  getSite: (id: string) => CuratedSite | undefined;
  getScenario: (label: ScenarioLabel) => Scenario | undefined;
  /** Efemérides de un año completo para el escenario (caché, traslado o null si solo hay datos en vivo). */
  getYearEphem: (label: ScenarioLabel) => Ephem | null;
  addScenario: (siteId?: string) => ScenarioLabel | null;
  removeScenario: (label: ScenarioLabel) => void;
  setActive: (label: ScenarioLabel) => void;
  toggleView3d: (label: ScenarioLabel) => void;
  setSite: (label: ScenarioLabel, siteId: string) => Promise<void>;
  setCustomCoords: (label: ScenarioLabel, lat: number, lon: number, name?: string) => Promise<void>;
  setBaseDate: (label: ScenarioLabel, iso: string) => Promise<void>;
  setDelay: (label: ScenarioLabel, days: number) => Promise<void>;
  addDelay: (label: ScenarioLabel, days: number) => Promise<void>;
  cloneScenario: (from: ScenarioLabel, to?: ScenarioLabel) => Promise<ScenarioLabel | null>;
  setHour: (h: number) => void;
  setPlayhead: (h: number) => void;
  jumpToEvent: (label: ScenarioLabel, ev: EventType) => number;
  togglePlay: () => void;
  setSpeed: (s: 1 | 10 | 30) => void;
  setViewMode: (m: ViewMode) => void;
  setAudienceMode: (m: AudienceMode) => void;
  setMissionHours: (h: number) => void;
  setPower: (p: Partial<PowerParams>) => void;
  setLang: (l: Lang) => void;
  recompute: (label: ScenarioLabel) => Promise<void>;
  recomputeAll: () => Promise<void>;
}

export const useMissionStore = create<MissionState>((set, get) => {
  const patch = (label: ScenarioLabel, p: Partial<Scenario>) =>
    set((st) => ({ scenarios: st.scenarios.map((s) => (s.label === label ? { ...s, ...p } : s)) }));

  /** Sitio curado más cercano con efemérides en caché. */
  const nearestSite = (lat: number, lon: number) => {
    let best: CuratedSite | undefined, bd = Infinity;
    for (const s of get().dataset?.sites ?? []) {
      const d = distanceKm({ lat, lon }, s);
      if (d < bd) [best, bd] = [s, d];
    }
    return best && bd <= TRANSFER_MAX_KM ? best : undefined;
  };

  return {
    dataset: null,
    ephem: {},
    scenarios: [emptyScenario("A", "mons_mouton"), emptyScenario("B", "shackleton_rim")],
    activeLabel: "A",
    view3d: ["A", "B"],
    playhead: 0,
    currentHourIndex: 0,
    isPlaying: false,
    speed: 10,
    viewMode: "split_3d",
    audienceMode: "engineer",
    missionHours: 240,
    power: DEFAULT_POWER,
    lang: "es",

    loadDataset: async () => {
      if (get().dataset) return;
      const ds = (await (await fetch("/data/sites.json")).json()) as SitesDataset;
      const res = await fetch(ds.ephemerisFile);
      const buf = await new Response(res.body!.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
      const raw = decodeEphemeris(buf, ds.sites.length, ds.hours);
      const ephem: Record<string, Ephem> = {};
      ds.sites.forEach((s, i) => {
        const o = s.ephemOrigin;
        ephem[s.id] = o && (o.lat !== s.lat || o.lon !== s.lon) ? transferEphem(raw[i], o, s) : raw[i];
      });
      set({ dataset: ds, ephem });
      void loadDem(); // en segundo plano (panal, mapa polar, coordenadas personalizadas)
      await Promise.all(get().scenarios.map((s) => get().setSite(s.label, s.siteId)));
    },

    getSite: (id) => get().dataset?.sites.find((s) => s.id === id),
    getScenario: (label) => get().scenarios.find((s) => s.label === label),

    getYearEphem: (label) => {
      const sc = get().getScenario(label);
      if (!sc) return null;
      if (sc.siteId !== "custom") return get().ephem[sc.siteId] ?? null;
      const key = `${sc.lat.toFixed(4)},${sc.lon.toFixed(4)}`;
      if (yearCache.has(key)) return yearCache.get(key)!;
      const parent = sc.parentSiteId ? get().getSite(sc.parentSiteId) : undefined;
      if (!parent) return null;
      const e = transferEphem(get().ephem[parent.id], parent, sc);
      yearCache.set(key, e);
      return e;
    },

    addScenario: (siteId) => {
      const used = new Set(get().scenarios.map((s) => s.label));
      const label = SCENARIO_LABELS.find((l) => !used.has(l));
      if (!label) return null;
      const base = get().scenarios[get().scenarios.length - 1];
      const sc = { ...emptyScenario(label, siteId ?? base?.siteId ?? "malapert_massif"), baseDate: base?.baseDate ?? DEFAULT_DATE };
      set((st) => ({ scenarios: [...st.scenarios, sc].sort((a, b) => a.label.localeCompare(b.label)) }));
      void get().setSite(label, sc.siteId);
      return label;
    },

    removeScenario: (label) => {
      if (get().scenarios.length <= 1) return;
      set((st) => {
        const scenarios = st.scenarios.filter((s) => s.label !== label);
        const view3d = st.view3d.filter((l) => l !== label);
        return {
          scenarios,
          view3d: view3d.length ? view3d : [scenarios[0].label],
          activeLabel: st.activeLabel === label ? scenarios[0].label : st.activeLabel,
        };
      });
    },

    setActive: (activeLabel) => set({ activeLabel }),

    toggleView3d: (label) =>
      set((st) => {
        if (st.view3d.includes(label)) return st.view3d.length > 1 ? { view3d: st.view3d.filter((l) => l !== label) } : {};
        const next = [...st.view3d, label];
        return { view3d: next.slice(-2) }; // máximo 2 vistas 3D simultáneas (rendimiento)
      }),

    setSite: async (label, siteId) => {
      const site = get().getSite(siteId);
      if (!site) return;
      patch(label, {
        siteId, siteName: site.name, lat: site.lat, lon: site.lon, region: site.region, panelType: site.panelType,
        horizonProfileDeg: site.horizonProfileDeg, horizonSource: site.horizonSource, parentSiteId: null,
      });
      await get().recompute(label);
    },

    setCustomCoords: async (label, lat, lon, name) => {
      const region = regionFromLat(lat, lon);
      patch(label, {
        siteId: "custom",
        siteName: name ?? `(${lat.toFixed(3)}°, ${lon.toFixed(2)}°)`,
        lat, lon, region,
        panelType: region === "south_pole" ? "vertical" : "horizontal",
        parentSiteId: nearestSite(lat, lon)?.id ?? null,
        loading: true,
      });
      await loadDem();
      patch(label, {
        horizonProfileDeg: horizonProfile(lat, lon),
        horizonSource: `LOLA LDEM (~${demResolutionKm(lat)} km/px), calculado en el navegador`,
      });
      await get().recompute(label);
    },

    setBaseDate: async (label, iso) => {
      patch(label, { baseDate: iso });
      await get().recompute(label);
    },

    setDelay: async (label, days) => {
      patch(label, { delayDays: Math.max(0, Math.round(days)) });
      await get().recompute(label);
    },

    addDelay: async (label, days) => get().setDelay(label, (get().getScenario(label)?.delayDays ?? 0) + days),

    cloneScenario: async (from, to) => {
      const src = get().getScenario(from);
      if (!src) return null;
      let target = to;
      if (!target || !get().getScenario(target)) target = get().addScenario(src.siteId) ?? undefined;
      if (!target) return null;
      patch(target, { ...src, label: target });
      return target;
    },

    setHour: (h) => {
      const v = Math.max(0, Math.min(WINDOW_HOURS - 1, h));
      set({ playhead: v, currentHourIndex: Math.floor(v) });
    },

    setPlayhead: (h) => {
      const v = ((h % WINDOW_HOURS) + WINDOW_HOURS) % WINDOW_HOURS;
      const now = performance.now();
      const idx = Math.floor(v);
      // Los paneles DOM se actualizan como máximo ~8 veces por segundo durante la reproducción
      if (idx !== get().currentHourIndex && now - lastHourCommit > (get().speed >= 30 ? 200 : 120)) {
        lastHourCommit = now;
        set({ playhead: v, currentHourIndex: idx });
      } else {
        set({ playhead: v });
      }
    },

    jumpToEvent: (label, ev) => {
      const tl = get().getScenario(label)?.timeline ?? [];
      const idx = findEvent(tl, get().currentHourIndex, ev);
      set({ currentHourIndex: idx, playhead: idx, isPlaying: false });
      return idx;
    },

    togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying, currentHourIndex: Math.floor(s.playhead) })),
    setSpeed: (speed) => set({ speed }),
    setViewMode: (viewMode) => set({ viewMode }),
    setAudienceMode: (audienceMode) => set({ audienceMode }),
    setMissionHours: (missionHours) => {
      set({ missionHours });
      void get().recomputeAll();
    },
    setPower: (p) => {
      set((s) => ({ power: { ...s.power, ...p } }));
      void get().recomputeAll();
    },
    setLang: (lang) => set({ lang }),

    recomputeAll: async () => {
      await Promise.all(get().scenarios.map((s) => get().recompute(s.label)));
    },

    recompute: async (label) => {
      const st = get();
      const sc = st.getScenario(label);
      const ds = st.dataset;
      if (!sc || !ds) return;
      const start = effectiveStart(sc);
      const offset = Math.round((new Date(start).getTime() - new Date(ds.startUtc).getTime()) / 3600_000);
      const inCache = offset >= 0 && offset + WINDOW_HOURS <= ds.hours;

      let e: Ephem | null = null;
      let source: Scenario["source"] = "cache";
      if (inCache) {
        if (sc.siteId !== "custom") e = sliceEphem(st.ephem[sc.siteId], offset, WINDOW_HOURS);
        else if (sc.parentSiteId) {
          const parent = st.getSite(sc.parentSiteId)!;
          e = transferEphem(sliceEphem(st.ephem[parent.id], offset, WINDOW_HOURS), parent, sc);
          source = "transfer";
        }
      }
      // Fuera de la caché (o lejos de cualquier sitio): JPL Horizons en vivo vía /api/horizons
      if (!e) {
        source = "live";
        patch(label, { loading: true, error: null });
        try {
          const res = await fetch(`/api/horizons?lat=${sc.lat}&lon=${sc.lon}&start=${encodeURIComponent(start)}&hours=${WINDOW_HOURS}`);
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? res.statusText);
          e = fromAzEl(json.sun, json.earth);
        } catch (err) {
          patch(label, { loading: false, error: `JPL Horizons no disponible: ${String(err)}` });
          return;
        }
      }
      const cur = get().getScenario(label);
      if (!cur) return;
      const timeline = crossLunarData(e, cur.horizonProfileDeg, cur.panelType, start, get().power);
      const metrics = computeMetrics(timeline, cur.region, get().missionHours);
      patch(label, { timeline, metrics, source, loading: false, error: null });
    },
  };
});

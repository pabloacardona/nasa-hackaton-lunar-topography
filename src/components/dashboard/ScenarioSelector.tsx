"use client";
import { useState } from "react";
import { Box, Copy, Plus, Rocket, Satellite, X } from "lucide-react";
import { effectiveStart, useMissionStore } from "@/store/useMissionStore";
import { SCENARIO_COLORS, type Scenario } from "@/lib/types";
import { MISSION_PROFILES } from "@/lib/lunarMath";
import { useGfxStore, useTier } from "@/store/useGfxStore";
import { useT } from "@/lib/i18n";
import InfoTip from "@/components/ui/InfoTip";

function ScenarioCard({ sc, count }: { sc: Scenario; count: number }) {
  const t = useT();
  const dataset = useMissionStore((s) => s.dataset);
  const active = useMissionStore((s) => s.activeLabel === sc.label);
  const in3d = useMissionStore((s) => s.view3d.includes(sc.label));
  const { setSite, setCustomCoords, setBaseDate, addDelay, setDelay, removeScenario, setActive, toggleView3d, cloneScenario } =
    useMissionStore.getState();
  const [lat, setLat] = useState(String(sc.lat || -85));
  const [lon, setLon] = useState(String(sc.lon || 30));
  const color = SCENARIO_COLORS[sc.label];
  const src = { cache: "caché JPL", transfer: "JPL trasladado", live: "JPL en vivo", none: "—" }[sc.source];

  return (
    <div
      onClick={() => setActive(sc.label)}
      className={`min-w-[260px] flex-1 rounded-xl border bg-slate-900/70 p-3 text-sm transition ${active ? "ring-2 ring-offset-1 ring-offset-slate-950" : ""}`}
      style={{ borderColor: color + "99", ...(active ? { boxShadow: `0 0 0 2px ${color}` } : {}) }}
    >
      <div className="mb-2 flex items-center justify-between gap-1">
        <span className="font-semibold tracking-wide text-slate-200">
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          {t("scenario")} {sc.label}
          {active && <span className="ml-1 text-[10px] text-slate-400">({t("active")})</span>}
          {sc.loading && <span className="ml-2 text-xs text-amber-300">…</span>}
        </span>
        <span className="flex items-center gap-1">
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase text-slate-400">{src}</span>
          <button title="Ver en 3D" aria-pressed={in3d} aria-label={`Mostrar ${sc.label} en 3D`} onClick={(e) => { e.stopPropagation(); toggleView3d(sc.label); }}
            className={`rounded p-1 ${in3d ? "bg-sky-700 text-white" : "bg-slate-800 text-slate-400"}`}>
            <Box className="h-3 w-3" />
          </button>
          {count < 4 && (
            <button title={t("clone")} aria-label={`${t("clone")} ${sc.label}`} onClick={(e) => { e.stopPropagation(); void cloneScenario(sc.label); }} className="rounded bg-slate-800 p-1 text-slate-300 hover:bg-slate-700">
              <Copy className="h-3 w-3" />
            </button>
          )}
          {count > 1 && (
            <button title={t("remove")} aria-label={`${t("remove")} ${sc.label}`} onClick={(e) => { e.stopPropagation(); removeScenario(sc.label); }} className="rounded bg-slate-800 p-1 text-slate-300 hover:bg-red-800">
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-400">{t("site")}</span>
        <select className="rounded bg-slate-800 px-2 py-1" value={sc.siteId} onChange={(e) => setSite(sc.label, e.target.value)}>
          {dataset?.sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {s.mission}
            </option>
          ))}
          {sc.siteId === "custom" && <option value="custom">{sc.siteName}</option>}
        </select>
      </label>

      <div className="mt-2 flex items-end gap-1">
        <input className="w-20 rounded bg-slate-800 px-2 py-1" value={lat} onChange={(e) => setLat(e.target.value)} aria-label="Latitud" />
        <input className="w-20 rounded bg-slate-800 px-2 py-1" value={lon} onChange={(e) => setLon(e.target.value)} aria-label="Longitud" />
        <button className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600" onClick={() => setCustomCoords(sc.label, Number(lat), Number(lon))}>
          {t("useLatLon")}
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">{t("landingDate")}</span>
          <input type="datetime-local" className="rounded bg-slate-800 px-2 py-1" value={sc.baseDate.slice(0, 16)}
            onChange={(e) => setBaseDate(sc.label, new Date(e.target.value + ":00Z").toISOString())} />
        </label>
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1 text-xs text-slate-400">{t("delay")}: {sc.delayDays} {t("days")} <InfoTip k="delay" /></span>
          <div className="flex gap-1">
            <button className="rounded bg-amber-600/80 px-2 py-1 hover:bg-amber-500" onClick={() => addDelay(sc.label, 7)}>+7d</button>
            <button className="rounded bg-amber-600/80 px-2 py-1 hover:bg-amber-500" onClick={() => addDelay(sc.label, 14)}>+14d</button>
            <button className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600" onClick={() => setDelay(sc.label, 0)}>0</button>
          </div>
        </div>
      </div>
      <input type="range" min={0} max={180} value={sc.delayDays} onChange={(e) => setDelay(sc.label, Number(e.target.value))}
        className="mt-1 w-full accent-amber-500" aria-label={`${t("delay")} ${sc.label}`} />
      <p className="text-[11px] text-slate-400">
        <InfoTip k="horizonSource" /> {t("effectiveLanding")}: {effectiveStart(sc).slice(0, 16).replace("T", " ")} UTC · {sc.lat.toFixed(3)}°, {sc.lon.toFixed(2)}°
      </p>
      {sc.error && <p className="mt-1 text-xs text-red-400">{sc.error}</p>}
    </div>
  );
}

export default function ScenarioSelector() {
  const t = useT();
  const scenarios = useMissionStore((s) => s.scenarios);
  const audienceMode = useMissionStore((s) => s.audienceMode);
  const power = useMissionStore((s) => s.power);
  const missionHours = useMissionStore((s) => s.missionHours);
  const lang = useMissionStore((s) => s.lang);
  const { setAudienceMode, setPower, setMissionHours, addScenario, setLang } = useMissionStore.getState();
  const qualityPref = useGfxStore((s) => s.pref);
  const vfx = useGfxStore((s) => s.vfx);
  const tier = useTier();
  const { setPref, setVfx } = useGfxStore.getState();

  return (
    <header className="flex flex-col gap-2" id="tour-scenarios">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-lg font-bold tracking-wider text-slate-100">
          <Rocket className="h-5 w-5 text-sky-400" aria-hidden /> LUNAR MISSION NAVIGATOR
          <span className="text-xs font-normal text-slate-400">{t("appSubtitle")}</span>
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <InfoTip k="missionProfile" />
          <select className="rounded bg-slate-800 px-2 py-1" value={missionHours} onChange={(e) => setMissionHours(Number(e.target.value))} aria-label="Perfil de misión">
            {MISSION_PROFILES.map((p) => (
              <option key={p.hours} value={p.hours}>{lang === "es" ? p.label : p.labelEn}</option>
            ))}
          </select>
          <label className="flex items-center gap-1">
            <Satellite className="h-4 w-4" aria-hidden /> {t("battery")}
            <select className="rounded bg-slate-800 px-2 py-1" value={power.batteryHours} onChange={(e) => setPower({ batteryHours: Number(e.target.value) })}>
              {[12, 24, 48, 72, 120].map((h) => (
                <option key={h} value={h}>{h} h</option>
              ))}
            </select>
          </label>
          <select className="rounded bg-slate-800 px-2 py-1" value={qualityPref} onChange={(e) => setPref(e.target.value as typeof qualityPref)} aria-label={t("quality")}>
            <option value="auto">{t("quality")}: Auto ({tier === "high" ? "HD" : "lite"})</option>
            <option value="high">{t("quality")}: HD</option>
            <option value="low">{t("quality")}: Lite</option>
          </select>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={vfx} onChange={(e) => setVfx(e.target.checked)} /> VFX
          </label>
          <div className="flex overflow-hidden rounded border border-slate-600" role="group" aria-label="Modo">
            {(["engineer", "educator"] as const).map((m) => (
              <button key={m} onClick={() => setAudienceMode(m)} aria-pressed={audienceMode === m}
                className={`px-2 py-1 ${audienceMode === m ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-300"}`}>
                {m === "engineer" ? t("engineer") : t("educator")}
              </button>
            ))}
          </div>
          <button onClick={() => setLang(lang === "es" ? "en" : "es")} className="rounded border border-slate-600 bg-slate-800 px-2 py-1 font-semibold" aria-label="Idioma / Language">
            {lang === "es" ? "EN" : "ES"}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {scenarios.map((sc) => (
          <ScenarioCard key={sc.label} sc={sc} count={scenarios.length} />
        ))}
        {scenarios.length < 4 && (
          <button onClick={() => addScenario()} className="flex min-w-[120px] items-center justify-center gap-1 rounded-xl border border-dashed border-slate-600 text-sm text-slate-300 hover:bg-slate-900">
            <Plus className="h-4 w-4" /> {t("addScenario")}
          </button>
        )}
      </div>
    </header>
  );
}

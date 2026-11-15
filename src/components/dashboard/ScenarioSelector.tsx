"use client";
import Image from "next/image";
import { useState } from "react";
import { Box, Clapperboard, Compass, Copy, FileText, Plus, Satellite, Settings, Square, X } from "lucide-react";
import { effectiveStart, useMissionStore } from "@/store/useMissionStore";
import Switch from "@/components/ui/Switch";
import { SCENARIO_COLORS, type Scenario } from "@/lib/types";
import { MISSION_PROFILES } from "@/lib/lunarMath";
import { useGfxStore, useTier } from "@/store/useGfxStore";
import { useT } from "@/lib/i18n";
import InfoTip from "@/components/ui/InfoTip";
import Collapsible from "@/components/ui/Collapsible";
import { useUiStore } from "@/store/useUiStore";
import { generateMissionBrief } from "@/lib/brief";
import { cancelDemo, runNarratedDemo } from "@/lib/demo";

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
      className={`min-w-[260px] flex-1 rounded-2xl border-2 bg-slate-900/70 p-3 text-sm transition ${active ? "ring-2 ring-offset-1 ring-offset-slate-950" : ""}`}
      style={{ borderColor: color + "99", ...(active ? { boxShadow: `0 0 0 2px ${color}` } : {}) }}
    >
      <div className="mb-2 flex items-center justify-between gap-1">
        <span className="font-semibold tracking-wide text-slate-200">
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          {t("scenario")} {sc.label}
          {active && <span className="ml-1 text-[10px] text-slate-400">({t("active")})</span>}
          {sc.loading && <span className="ml-2 text-xs text-[#dcc08f]">…</span>}
        </span>
        <span className="flex items-center gap-1">
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase text-slate-400">{src}</span>
          <button title="Ver en 3D" aria-pressed={in3d} aria-label={`Mostrar ${sc.label} en 3D`} onClick={(e) => { e.stopPropagation(); toggleView3d(sc.label); }}
            className={`rounded p-1 ${in3d ? "bg-[#3a5a7a] text-white" : "bg-slate-800 text-slate-400"}`}>
            <Box className="h-3 w-3" />
          </button>
          {count < 4 && (
            <button title={t("clone")} aria-label={`${t("clone")} ${sc.label}`} onClick={(e) => { e.stopPropagation(); void cloneScenario(sc.label); }} className="rounded bg-slate-800 p-1 text-slate-300 hover:bg-slate-700">
              <Copy className="h-3 w-3" />
            </button>
          )}
          {count > 1 && (
            <button title={t("remove")} aria-label={`${t("remove")} ${sc.label}`} onClick={(e) => { e.stopPropagation(); removeScenario(sc.label); }} className="rounded bg-slate-800 p-1 text-slate-300 hover:bg-[#6e3d41]">
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
            <button className="rounded bg-[#9e7c4c]/80 px-2 py-1 hover:bg-[#b8925a]" onClick={() => addDelay(sc.label, 7)}>+7d</button>
            <button className="rounded bg-[#9e7c4c]/80 px-2 py-1 hover:bg-[#b8925a]" onClick={() => addDelay(sc.label, 14)}>+14d</button>
            <button className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600" onClick={() => setDelay(sc.label, 0)}>0</button>
          </div>
        </div>
      </div>
      <input type="range" min={0} max={180} value={sc.delayDays} onChange={(e) => setDelay(sc.label, Number(e.target.value))}
        className="mt-1 w-full accent-[#b8925a]" aria-label={`${t("delay")} ${sc.label}`} />
      <p className="text-[11px] text-slate-400">
        <InfoTip k="horizonSource" /> {t("effectiveLanding")}: {effectiveStart(sc).slice(0, 16).replace("T", " ")} UTC · {sc.lat.toFixed(3)}°, {sc.lon.toFixed(2)}°
      </p>
      {sc.error && <p className="mt-1 text-xs text-[#c98486]">{sc.error}</p>}
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
  const es = lang === "es";
  const kid = audienceMode === "educator";
  const { setAudienceMode, setPower, setMissionHours, addScenario, setLang } = useMissionStore.getState();
  const qualityPref = useGfxStore((s) => s.pref);
  const vfx = useGfxStore((s) => s.vfx);
  const tier = useTier();
  const { setPref, setVfx } = useGfxStore.getState();
  const demoRunning = useUiStore((s) => s.demoRunning);
  const { setTourStep, openBrief } = useUiStore.getState();
  const sel = "rounded-lg bg-slate-800 px-2 py-1.5";

  return (
    <header className="flex flex-col gap-3" id="tour-scenarios">
      <div className="flex flex-col items-center gap-3 px-2 text-center">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Image src="/emblem.png" alt="" aria-hidden width={1536} height={1024} className="h-12 w-auto drop-shadow-[0_0_10px_rgba(120,190,255,0.35)]" />
          <div>
            <h1 className="font-title text-2xl leading-none tracking-wide text-white">Lunar Mission Navigator</h1>
            <p className="text-sm font-semibold text-[#c4d6e6]">{kid ? (es ? "¡Encuentra el mejor lugar para alunizar! " : "Find the best place to land on the Moon! ") : t("appSubtitle")}</p>
          </div>
        <Image src="/space-apps-logo.png" alt="NASA Space Apps Challenge" width={440} height={172} className="ml-1 h-10 w-auto self-center opacity-95" />
        <span className="self-center max-w-[15rem] text-xs font-semibold leading-snug text-[#c4d6e6]">{es ? "Proyecto realizado para la hackatón NASA Space Apps 2026, 14 y 15 de noviembre" : "Project built for the NASA Space Apps 2026 hackathon, November 14–15"}</span>
        </div>
      </div>
      <div className="card flex flex-wrap items-center justify-center gap-2 px-3 py-2 text-xs bg-slate-900/70 border border-slate-700/60">
          <button type="button" onClick={() => setTourStep(0)} title={es ? "Recorrido guiado por la página" : "Guided tour of the page"} className="btn-fun border-[#6f93b5] bg-[#4f7396] hover:bg-[#5b82aa]"><Compass className="h-4 w-4" aria-hidden /> {es ? "Enséñame" : "Show me"}</button>
          {demoRunning ? (
            <button type="button" onClick={cancelDemo} title={es ? "Detener la demo" : "Stop the demo"} className="btn-fun border-[#b86b6e] bg-[#884a4e] hover:bg-[#9a5559]"><Square className="h-4 w-4" aria-hidden /> {es ? "Detener" : "Stop"}</button>
          ) : (
            <button type="button" onClick={() => void runNarratedDemo()} title={es ? "Demo narrada de 1 minuto con voz" : "1-minute narrated demo with voice"} className="btn-fun"><Clapperboard className="h-4 w-4" aria-hidden /> Demo</button>
          )}
          <button type="button" onClick={() => openBrief(generateMissionBrief())} title={es ? "Resumen de la misión, listo para copiar" : "Mission summary, ready to copy"} className="btn-fun"><FileText className="h-4 w-4" aria-hidden /> {es ? "Informe" : "Report"}</button>
          <div className="flex overflow-hidden rounded-full border-2 border-slate-600" role="group" aria-label={es ? "Nivel de detalle" : "Detail level"}>
            {(["educator", "engineer"] as const).map((m) => (
              <button key={m} onClick={() => setAudienceMode(m)} aria-pressed={audienceMode === m} title={m === "educator" ? (es ? "Lenguaje sencillo" : "Simple language") : (es ? "Todos los datos técnicos" : "All technical data")}
                className={`px-3 py-1.5 font-bold ${audienceMode === m ? (m === "educator" ? "bg-[#7fb39a] text-black" : "bg-[#4f7396] text-white") : "bg-slate-800 text-slate-300"}`}>
                {m === "educator" ? (es ? " Explorador" : " Explorer") : (es ? " Ingeniero" : " Engineer")}
              </button>
            ))}
          </div>
          <Switch checked={!es} onChange={(v) => setLang(v ? "en" : "es")} left="ES" right="EN" label={es ? "Cambiar idioma a inglés" : "Switch language to Spanish"} />
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full border-2 border-slate-600 bg-slate-800 px-3 py-1.5 font-bold"><Settings className="h-4 w-4" /> {es ? "Ajustes" : "Settings"}</summary>
            <div className="card pop absolute right-0 z-40 mt-2 flex w-72 flex-col gap-2 p-3 shadow-2xl">
              <label className="flex flex-col gap-1">
                <span className="flex items-center gap-1 text-slate-300">{es ? "Tipo de misión" : "Mission type"} <InfoTip k="missionProfile" /></span>
                <select className={sel} value={missionHours} onChange={(e) => setMissionHours(Number(e.target.value))}>
                  {MISSION_PROFILES.map((p) => (
                    <option key={p.hours} value={p.hours}>{es ? p.label : p.labelEn}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="flex items-center gap-1 text-slate-300"><Satellite className="h-4 w-4" aria-hidden /> {es ? "Batería: horas sin Sol que aguanta" : "Battery: hours it lasts without Sun"}</span>
                <select className={sel} value={power.batteryHours} onChange={(e) => setPower({ batteryHours: Number(e.target.value) })}>
                  {[12, 24, 48, 72, 120].map((h) => (
                    <option key={h} value={h}>{h} h</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-slate-300">{es ? "Calidad de los gráficos 3D" : "3D graphics quality"}</span>
                <select className={sel} value={qualityPref} onChange={(e) => setPref(e.target.value as typeof qualityPref)}>
                  <option value="auto">Auto ({tier === "high" ? "HD" : "lite"})</option>
                  <option value="high">HD</option>
                  <option value="low">{es ? "Lite (más rápido)" : "Lite (faster)"}</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-slate-300">
                <input type="checkbox" checked={vfx} onChange={(e) => setVfx(e.target.checked)} /> {es ? "Efectos (rayos, brillo, polvo)" : "Effects (beams, glow, dust)"}
              </label>
            </div>
          </details>
        </div>
      <Collapsible id="sec-scenarios" tint="#9d8fc2" title={kid ? (es ? "Mis lugares para comparar" : "My places to compare") : (es ? "Escenarios: sitio, fecha y retraso" : "Scenarios: site, date and delay")}
        summary={scenarios.map((sc) => (
          <span key={sc.label} className="rounded-full bg-slate-800 px-2 py-0.5"><b style={{ color: SCENARIO_COLORS[sc.label] }}>{sc.label}</b> {sc.siteName}</span>
        ))}>
        <div className="flex flex-wrap gap-2">
          {scenarios.map((sc) => (
            <ScenarioCard key={sc.label} sc={sc} count={scenarios.length} />
          ))}
          {scenarios.length < 4 && (
            <button onClick={() => addScenario()} className="flex min-h-[90px] min-w-[140px] flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-[#9d8fc2]/70 text-sm font-bold text-[#cfc3e3] hover:bg-violet-950/50">
              <Plus className="h-6 w-6" /> {es ? "Añadir lugar" : "Add place"}
            </button>
          )}
        </div>
      </Collapsible>
    </header>
  );
}

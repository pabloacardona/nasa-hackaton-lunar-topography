"use client";
// Línea de tiempo de 30 días: Sol, DTE (completo / degradado), Ventana Dorada, SoC y marcadores de eventos.
import { memo, useMemo } from "react";
import { Pause, Play, SkipForward } from "lucide-react";
import { useMissionStore } from "@/store/useMissionStore";
import { WINDOW_HOURS } from "@/lib/lunarMath";
import { SCENARIO_COLORS, type HourSample, type Scenario } from "@/lib/types";
import { useT } from "@/lib/i18n";

function runs(tl: HourSample[], pick: (h: HourSample) => boolean) {
  const out: [number, number][] = [];
  let start = -1;
  tl.forEach((h, i) => {
    if (pick(h) && start < 0) start = i;
    if (!pick(h) && start >= 0) {
      out.push([start, i]);
      start = -1;
    }
  });
  if (start >= 0) out.push([start, tl.length]);
  return out;
}

const Tracks = memo(function Tracks({ sc, missionHours }: { sc: Scenario; missionHours: number }) {
  const { tracks, socPath, events } = useMemo(() => {
    const tl = sc.timeline;
    const tracks = [
      { color: "#f59e0b", r: runs(tl, (h) => h.sunVisible) },
      { color: "#06b6d4", r: runs(tl, (h) => h.dte === "full") },
      { color: "#a78bfa", r: runs(tl, (h) => h.dte === "degraded") },
      { color: "#10b981", r: runs(tl, (h) => h.goldenWindow) },
    ];
    let socPath = "";
    tl.forEach((h, i) => (socPath += `${i ? "L" : "M"}${i},${48 - (h.socPct / 100) * 8}`));
    const events: { x: number; c: string }[] = [];
    for (let i = 1; i < tl.length; i++) {
      if (tl[i - 1].sunVisible && !tl[i].sunVisible) events.push({ x: i, c: "#f59e0b" });
      if (tl[i - 1].earthVisible && !tl[i].earthVisible) events.push({ x: i, c: "#06b6d4" });
    }
    return { tracks, socPath, events };
  }, [sc.timeline]);
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 text-xs font-bold" style={{ color: SCENARIO_COLORS[sc.label] }}>{sc.label}</span>
      <svg viewBox={`0 0 ${WINDOW_HOURS} 50`} preserveAspectRatio="none" className="h-12 w-full rounded bg-slate-950" role="img" aria-label={`Ventanas ${sc.label}`}>
        <rect x={missionHours} y={0} width={WINDOW_HOURS - missionHours} height={50} fill="#000" opacity={0.45} />
        {tracks.map((t, ti) => t.r.map(([s, e]) => <rect key={`${ti}-${s}`} x={s} y={ti * 9 + 1} width={e - s} height={7} fill={t.color} />))}
        <path d={socPath} stroke="#a3e635" strokeWidth={1} fill="none" vectorEffect="non-scaling-stroke" />
        {events.map((e, i) => <line key={i} x1={e.x} x2={e.x} y1={0} y2={37} stroke={e.c} strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.9} />)}
      </svg>
    </div>
  );
});

export default function LunarTimelineGantt() {
  const t = useT();
  const scenarios = useMissionStore((s) => s.scenarios);
  const hour = useMissionStore((s) => s.currentHourIndex);
  const isPlaying = useMissionStore((s) => s.isPlaying);
  const speed = useMissionStore((s) => s.speed);
  const missionHours = useMissionStore((s) => s.missionHours);
  const active = useMissionStore((s) => s.activeLabel);
  const { setHour, togglePlay, setSpeed, jumpToEvent } = useMissionStore.getState();
  const ts = scenarios[0]?.timeline[hour]?.timestamp ?? "";

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-3" id="tour-timeline">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-300">
        <button className="rounded bg-sky-600 p-1.5 hover:bg-sky-500" onClick={togglePlay} aria-label={isPlaying ? "Pausa" : "Reproducir"}>
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        {([1, 10, 30] as const).map((s) => (
          <button key={s} onClick={() => setSpeed(s)} aria-pressed={speed === s} className={`rounded px-2 py-1 ${speed === s ? "bg-slate-600" : "bg-slate-800"}`}>{s}x</button>
        ))}
        <span className="ml-2 font-mono">T+{hour} h ({(hour / 24).toFixed(1)} d) · {ts.slice(0, 16).replace("T", " ")} UTC</span>
        <div className="ml-auto flex flex-wrap gap-1">
          {(["next_sunset", "next_earthset", "next_sunrise", "battery_empty"] as const).map((ev) => (
            <button key={ev} className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 hover:bg-slate-700" onClick={() => jumpToEvent(active, ev)}>
              <SkipForward className="h-3 w-3" /> {{ next_sunset: "Sunset", next_earthset: "Earthset", next_sunrise: "Sunrise", battery_empty: "Batería 0%" }[ev]} {active}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {scenarios.map((sc) => (
          <Tracks key={sc.label} sc={sc} missionHours={missionHours} />
        ))}
        <input type="range" min={0} max={WINDOW_HOURS - 1} value={hour} onChange={(e) => setHour(Number(e.target.value))}
          className="ml-8 w-[calc(100%-2rem)] accent-sky-400" aria-label={t("timeline")} />
      </div>
      <div className="mt-1 flex flex-wrap gap-3 pl-8 text-[11px] text-slate-400">
        <span><i className="mr-1 inline-block h-2 w-3 bg-amber-500" />{t("legendSun")}</span>
        <span><i className="mr-1 inline-block h-2 w-3 bg-cyan-500" />{t("legendDte")}</span>
        <span><i className="mr-1 inline-block h-2 w-3 bg-violet-400" />{t("legendDeg")}</span>
        <span><i className="mr-1 inline-block h-2 w-3 bg-emerald-500" />{t("legendGolden")}</span>
        <span><i className="mr-1 inline-block h-0.5 w-3 bg-lime-400 align-middle" />SoC</span>
        <span>▮ fuera de la misión ({missionHours} h)</span>
      </div>
    </section>
  );
}

"use client";
// Línea de tiempo simplificada: 3 pistas por escenario (Sol, Tierra, Ambos) durante 30 días.
import { memo, useMemo } from "react";
import { Pause, Play, SkipForward } from "lucide-react";
import { useMissionStore } from "@/store/useMissionStore";
import { WINDOW_HOURS } from "@/lib/lunarMath";
import { SCENARIO_COLORS, type HourSample, type Scenario } from "@/lib/types";
import InfoTip from "@/components/ui/InfoTip";

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
  const tracks = useMemo(() => {
    const tl = sc.timeline;
    return [
      { color: "#f59e0b", r: runs(tl, (h) => h.sunVisible) },
      { color: "#06b6d4", r: runs(tl, (h) => h.earthVisible) },
      { color: "#10b981", r: runs(tl, (h) => h.goldenWindow) },
    ];
  }, [sc.timeline]);
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 text-xs font-bold" style={{ color: SCENARIO_COLORS[sc.label] }}>{sc.label}</span>
      <svg viewBox={`0 0 ${WINDOW_HOURS} 30`} preserveAspectRatio="none" className="h-9 w-full rounded bg-slate-950" role="img" aria-label={`Ventanas ${sc.label}`}>
        {tracks.map((t, ti) => t.r.map(([s, e]) => <rect key={`${ti}-${s}`} x={s} y={ti * 10 + 1} width={e - s} height={8} fill={t.color} />))}
        <rect x={missionHours} y={0} width={WINDOW_HOURS - missionHours} height={30} fill="#000" opacity={0.55} />
      </svg>
    </div>
  );
});

export default function LunarTimelineGantt() {
  const scenarios = useMissionStore((s) => s.scenarios);
  const hour = useMissionStore((s) => s.currentHourIndex);
  const isPlaying = useMissionStore((s) => s.isPlaying);
  const speed = useMissionStore((s) => s.speed);
  const missionHours = useMissionStore((s) => s.missionHours);
  const active = useMissionStore((s) => s.activeLabel);
  const es = useMissionStore((s) => s.lang) === "es";
  const { setHour, togglePlay, setSpeed, jumpToEvent } = useMissionStore.getState();
  const ts = scenarios[0]?.timeline[hour]?.timestamp ?? "";
  const day = Math.floor(hour / 24) + 1;

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-3" id="tour-timeline">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-300">
        <InfoTip k="timeline"><span className="text-sm font-semibold text-slate-200">{es ? "Línea de tiempo · 30 días" : "Timeline · 30 days"}</span></InfoTip>
        <button className="rounded bg-sky-600 p-1.5 hover:bg-sky-500" onClick={togglePlay} aria-label={isPlaying ? "Pausa" : "Reproducir"}>
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        {([1, 10, 30] as const).map((s) => (
          <button key={s} onClick={() => setSpeed(s)} aria-pressed={speed === s} className={`rounded px-2 py-1 ${speed === s ? "bg-slate-600" : "bg-slate-800"}`}>{s}x</button>
        ))}
        <span className="ml-1 rounded bg-slate-800 px-2 py-1 font-mono">{es ? "Día" : "Day"} {day} · {ts.slice(0, 16).replace("T", " ")} UTC</span>
        <div className="ml-auto flex gap-1">
          <button className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 hover:bg-slate-700" onClick={() => jumpToEvent(active, "next_sunset")}>
            <SkipForward className="h-3 w-3" /> {es ? "Próximo ocaso" : "Next sunset"} ({active})
          </button>
          <button className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 hover:bg-slate-700" onClick={() => jumpToEvent(active, "next_earthset")}>
            <SkipForward className="h-3 w-3" /> {es ? "Se pierde la Tierra" : "Earth lost"} ({active})
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {scenarios.map((sc) => (
          <Tracks key={sc.label} sc={sc} missionHours={missionHours} />
        ))}
        <input type="range" min={0} max={WINDOW_HOURS - 1} value={hour} onChange={(e) => setHour(Number(e.target.value))}
          className="ml-8 w-[calc(100%-2rem)] accent-sky-400" aria-label="Línea de tiempo" />
      </div>
      <div className="mt-1 flex flex-wrap gap-4 pl-8 text-[11px] text-slate-400">
        <span><i className="mr-1 inline-block h-2 w-3 bg-amber-500" />{es ? "Sol visible" : "Sun visible"}</span>
        <span><i className="mr-1 inline-block h-2 w-3 bg-cyan-500" />{es ? "Tierra visible" : "Earth visible"}</span>
        <span><i className="mr-1 inline-block h-2 w-3 bg-emerald-500" />{es ? "Ambos (ideal)" : "Both (ideal)"}</span>
        <span><i className="mr-1 inline-block h-2 w-3 bg-black ring-1 ring-slate-600" />{es ? "Después de la misión" : "After mission"}</span>
      </div>
    </section>
  );
}

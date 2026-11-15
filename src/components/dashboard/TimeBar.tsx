"use client";
// Barra de tiempo: vive junto a las vistas 3D (como el control de un reproductor de video).
// Mueve la hora de la misión que se ve en todos los viewports.
import { memo, useMemo, useState } from "react";
import { Moon, Pause, Play, RotateCcw, SkipForward, Sun } from "lucide-react";
import { useMissionStore } from "@/store/useMissionStore";
import { WINDOW_HOURS } from "@/lib/lunarMath";
import { SCENARIO_COLORS, type HourSample, type Scenario } from "@/lib/types";
import InfoTip from "@/components/ui/InfoTip";

export function runs(tl: HourSample[], pick: (h: HourSample) => boolean) {
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

/** Franja fina del escenario activo: ámbar = Sol, verde = Sol y Tierra a la vez. */
const Strip = memo(function Strip({ sc, missionHours }: { sc: Scenario; missionHours: number }) {
  const r = useMemo(() => ({ sun: runs(sc.timeline, (h) => h.sunVisible), both: runs(sc.timeline, (h) => h.goldenWindow) }), [sc.timeline]);
  return (
    <svg viewBox={`0 0 ${WINDOW_HOURS} 10`} preserveAspectRatio="none" className="pointer-events-none h-2 w-full rounded bg-slate-950" aria-hidden>
      {r.sun.map(([s, e]) => <rect key={`s${s}`} x={s} y={0} width={e - s} height={10} fill="#f59e0b" />)}
      {r.both.map(([s, e]) => <rect key={`b${s}`} x={s} y={0} width={e - s} height={10} fill="#10b981" />)}
      <rect x={missionHours} y={0} width={WINDOW_HOURS - missionHours} height={10} fill="#000" opacity={0.55} />
    </svg>
  );
});

export default function TimeBar() {
  const hour = useMissionStore((s) => s.currentHourIndex);
  const isPlaying = useMissionStore((s) => s.isPlaying);
  const speed = useMissionStore((s) => s.speed);
  const missionHours = useMissionStore((s) => s.missionHours);
  const activeLabel = useMissionStore((s) => s.activeLabel);
  const active = useMissionStore((s) => s.scenarios.find((x) => x.label === s.activeLabel));
  const es = useMissionStore((s) => s.lang) === "es";
  const { setHour, togglePlay, setSpeed, jumpToEvent, pausePlayback } = useMissionStore.getState();
  // Al acercarse a los controles, la reproducción se detiene y el control pasa al usuario.
  const hold = () => pausePlayback();
  // Guía «Oprime aquí» sobre el botón de reproducir: desaparece la primera vez que se usa.
  const [guide, setGuide] = useState(true);
  const press = () => { setGuide(false); togglePlay(); };
  const ts = active?.timeline[hour]?.timestamp ?? "";
  const day = Math.floor(hour / 24) + 1;
  const sunNow = active?.timeline[hour]?.sunVisible;
  const b = "flex items-center gap-1 rounded-full bg-slate-800 px-3 py-1.5 font-bold hover:bg-slate-700";

  return (
    <div id="tour-timebar" onPointerEnter={hold} onFocus={hold} className="sticky bottom-[76px] z-30 flex flex-wrap items-center gap-2 rounded-2xl border-2 border-[#b594c4]/70 bg-slate-950/95 px-3 py-2 text-xs text-slate-200 shadow-xl backdrop-blur">
      <div className="relative">
        {guide && !isPlaying && (
          <div role="note" className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#c9a66b] px-2.5 py-1 text-[11px] font-extrabold text-black shadow-lg animate-bounce">
            {es ? "Oprime aquí" : "Press here"}
            <span className="absolute left-1/2 top-full -translate-x-1/2 border-x-[6px] border-t-[6px] border-x-transparent border-t-[#c9a66b]" aria-hidden />
          </div>
        )}
        <button type="button" className="flex rounded-full bg-[#c9a66b] p-3 text-black shadow-lg transition hover:bg-[#d8b47a]" onClick={press} aria-label={isPlaying ? (es ? "Pausa" : "Pause") : (es ? "Reproducir" : "Play")}>
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
      </div>
      <div className="flex overflow-hidden rounded-full border border-slate-700" role="group" aria-label={es ? "Velocidad" : "Speed"}>
        {([1, 10, 30] as const).map((s) => (
          <button key={s} onClick={() => setSpeed(s)} aria-pressed={speed === s} title={`${s}x`} className={`px-2.5 py-1.5 font-bold ${speed === s ? "bg-[#c9a66b] text-black" : "bg-slate-800 hover:bg-slate-700"}`}>{s}x</button>
        ))}
      </div>
      <InfoTip k="timeline">
        <span className="rounded-full bg-slate-800 px-3 py-1 font-bold">{sunNow ? <Sun className="h-3.5 w-3.5 text-[#dcc08f]" aria-hidden /> : <Moon className="h-3.5 w-3.5 text-slate-400" aria-hidden />} {es ? "Día" : "Day"} {day} <span className="font-mono font-normal text-slate-400">· {ts.slice(5, 16).replace("T", " ")} UTC</span></span>
      </InfoTip>
      <div className="flex min-w-[220px] flex-1 flex-col gap-0.5">
        {active && <Strip sc={active} missionHours={missionHours} />}
        <input type="range" min={0} max={WINDOW_HOURS - 1} value={hour} onChange={(e) => setHour(Number(e.target.value))} onPointerDown={hold}
          className="w-full accent-[#7fa6c9]" aria-label={es ? "Tiempo de misión" : "Mission time"} style={{ accentColor: SCENARIO_COLORS[activeLabel] }} />
      </div>
      <button className={b} onClick={() => setHour(0)} title={es ? "Volver al momento del alunizaje" : "Back to landing"}><RotateCcw className="h-3 w-3" /> {es ? "Inicio" : "Start"}</button>
      <button className={b} onClick={() => jumpToEvent(activeLabel, "next_sunset")}><SkipForward className="h-3 w-3" /> {es ? "Ir al próximo ocaso" : "Go to next sunset"}</button>
      <button className={b} onClick={() => jumpToEvent(activeLabel, "next_earthset")}><SkipForward className="h-3 w-3" /> {es ? "Ir a: se pierde la Tierra" : "Go to: Earth lost"}</button>
    </div>
  );
}

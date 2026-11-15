"use client";
// Batería simplificada: una línea por escenario + zona roja (agotada). Temperatura opcional.
import { memo, useMemo, useState } from "react";
import { BatteryMedium } from "lucide-react";
import { useMissionStore } from "@/store/useMissionStore";
import { SCENARIO_COLORS, type Scenario } from "@/lib/types";
import { WINDOW_HOURS } from "@/lib/lunarMath";
import InfoTip from "@/components/ui/InfoTip";

const H = 100;

const Line = memo(function Line({ sc, kind }: { sc: Scenario; kind: "soc" | "temp" }) {
  const d = useMemo(() => {
    const y = (v: number) => (kind === "soc" ? H - (v / 100) * (H - 8) - 4 : H - ((v + 200) / 330) * (H - 8) - 4);
    return sc.timeline.map((h, i) => `${i ? "L" : "M"}${i},${y(kind === "soc" ? h.socPct : h.surfaceTempC).toFixed(1)}`).join("");
  }, [sc.timeline, kind]);
  return <path d={d} stroke={SCENARIO_COLORS[sc.label]} strokeWidth={2} fill="none" vectorEffect="non-scaling-stroke" />;
});

export default function EnergyThermalChart() {
  const scenarios = useMissionStore((s) => s.scenarios);
  const hour = useMissionStore((s) => s.currentHourIndex);
  const missionHours = useMissionStore((s) => s.missionHours);
  const power = useMissionStore((s) => s.power);
  const es = useMissionStore((s) => s.lang) === "es";
  const { setPower } = useMissionStore.getState();
  const [kind, setKind] = useState<"soc" | "temp">("soc");

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-3 text-sm" id="tour-energy">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <InfoTip k={kind === "soc" ? "battery" : "temperature"}>
          <h2 className="flex items-center gap-1 font-semibold text-slate-200">
            <BatteryMedium className="h-4 w-4 text-[#a3bb84]" aria-hidden /> {kind === "soc" ? (es ? "Batería durante la misión" : "Battery over the mission") : (es ? "Temperatura del suelo" : "Surface temperature")}
          </h2>
        </InfoTip>
        <div className="flex overflow-hidden rounded border border-slate-600 text-xs" role="group">
          <button onClick={() => setKind("soc")} aria-pressed={kind === "soc"} className={`px-2 py-0.5 ${kind === "soc" ? "bg-slate-600" : "bg-slate-800"}`}>{es ? "Batería" : "Battery"}</button>
          <button onClick={() => setKind("temp")} aria-pressed={kind === "temp"} className={`px-2 py-0.5 ${kind === "temp" ? "bg-slate-600" : "bg-slate-800"}`}>{es ? "Temperatura" : "Temperature"}</button>
        </div>
        {kind === "soc" && (
          <span className="flex flex-wrap gap-3 text-xs text-slate-400">
            <label>{es ? "Consumo" : "Load"} <input type="number" className="w-16 rounded bg-slate-800 px-1" value={power.loadW} min={20} max={1000} step={10} onChange={(e) => setPower({ loadW: Number(e.target.value) })} /> W</label>
            <label>{es ? "Paneles" : "Panels"} <input type="number" className="w-14 rounded bg-slate-800 px-1" value={power.panelAreaM2} min={0.5} max={20} step={0.5} onChange={(e) => setPower({ panelAreaM2: Number(e.target.value) })} /> m²</label>
          </span>
        )}
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${WINDOW_HOURS} ${H}`} preserveAspectRatio="none" className="h-28 w-full rounded bg-slate-950" role="img" aria-label={kind === "soc" ? "Batería" : "Temperatura"}>
          {kind === "soc" ? (
            <rect x={0} y={H - 12} width={WINDOW_HOURS} height={12} fill="#7f1d1d" opacity={0.5} />
          ) : (
            <line x1={0} x2={WINDOW_HOURS} y1={H - (200 / 330) * (H - 8) - 4} y2={H - (200 / 330) * (H - 8) - 4} stroke="#475569" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          )}
          {scenarios.map((sc) => <Line key={sc.label} sc={sc} kind={kind} />)}
          <rect x={missionHours} y={0} width={WINDOW_HOURS - missionHours} height={H} fill="#000" opacity={0.5} />
          <line x1={hour} x2={hour} y1={0} y2={H} stroke="#fff" strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.7} />
        </svg>
        <div className="pointer-events-none absolute left-1 top-0 text-[10px] text-slate-500">{kind === "soc" ? "100 %" : "+130 °C"}</div>
        <div className="pointer-events-none absolute bottom-0 left-1 text-[10px] text-[#e0a4a8]">{kind === "soc" ? (es ? "0 % = se congela" : "0% = freezes") : "−200 °C"}</div>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        {kind === "soc"
          ? es ? "Si una línea toca la franja roja, el lander se queda sin energía. Sube los paneles o baja el consumo para ver qué pasa." : "If a line touches the red band, the lander runs out of power."
          : es ? "Línea punteada = 0 °C. Al Sol el suelo se calienta; en sombra cae hacia −180 °C." : "Dashed line = 0 °C."}
      </p>
    </section>
  );
}

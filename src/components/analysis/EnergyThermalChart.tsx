"use client";
// Estado de carga de la batería y temperatura superficial (todos los escenarios) durante 30 días.
import { memo, useMemo } from "react";
import { BatteryMedium } from "lucide-react";
import { useMissionStore } from "@/store/useMissionStore";
import { SCENARIO_COLORS, type Scenario } from "@/lib/types";
import { WINDOW_HOURS } from "@/lib/lunarMath";
import { useT } from "@/lib/i18n";

const H = 110;

const Lines = memo(function Lines({ sc, kind }: { sc: Scenario; kind: "soc" | "temp" }) {
  const d = useMemo(() => {
    const y = (v: number) => (kind === "soc" ? H - (v / 100) * (H - 8) - 4 : H - ((v + 200) / 330) * (H - 8) - 4);
    return sc.timeline.map((h, i) => `${i ? "L" : "M"}${i},${y(kind === "soc" ? h.socPct : h.surfaceTempC).toFixed(1)}`).join("");
  }, [sc.timeline, kind]);
  return <path d={d} stroke={SCENARIO_COLORS[sc.label]} strokeWidth={1.5} fill="none" vectorEffect="non-scaling-stroke" />;
});

export default function EnergyThermalChart() {
  const t = useT();
  const scenarios = useMissionStore((s) => s.scenarios);
  const hour = useMissionStore((s) => s.currentHourIndex);
  const missionHours = useMissionStore((s) => s.missionHours);
  const power = useMissionStore((s) => s.power);
  const { setPower } = useMissionStore.getState();
  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-3 text-sm" id="tour-energy">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-1 font-semibold text-slate-200"><BatteryMedium className="h-4 w-4 text-lime-400" aria-hidden /> {t("energyThermal")}</h2>
        <label className="text-xs text-slate-400">Consumo{" "}
          <input type="number" className="w-16 rounded bg-slate-800 px-1" value={power.loadW} min={20} max={1000} step={10} onChange={(e) => setPower({ loadW: Number(e.target.value) })} /> W
        </label>
        <label className="text-xs text-slate-400">Panel{" "}
          <input type="number" className="w-14 rounded bg-slate-800 px-1" value={power.panelAreaM2} min={0.5} max={20} step={0.5} onChange={(e) => setPower({ panelAreaM2: Number(e.target.value) })} /> m²
        </label>
        <span className="text-[11px] text-slate-500">Eficiencia {Math.round(power.panelEfficiency * 100)}% · capacidad = {power.batteryHours} h × consumo</span>
      </div>
      {(["soc", "temp"] as const).map((kind) => (
        <div key={kind} className="mb-1">
          <div className="text-[11px] text-slate-400">{kind === "soc" ? "Batería (SoC %)" : "Temperatura superficial estimada (−200 … 130 °C)"}</div>
          <svg viewBox={`0 0 ${WINDOW_HOURS} ${H}`} preserveAspectRatio="none" className="h-24 w-full rounded bg-slate-950" role="img" aria-label={kind === "soc" ? "Estado de carga" : "Temperatura"}>
            <rect x={missionHours} y={0} width={WINDOW_HOURS - missionHours} height={H} fill="#000" opacity={0.45} />
            {kind === "temp" && <line x1={0} x2={WINDOW_HOURS} y1={H - (200 / 330) * (H - 8) - 4} y2={H - (200 / 330) * (H - 8) - 4} stroke="#334155" vectorEffect="non-scaling-stroke" />}
            {scenarios.map((sc) => <Lines key={sc.label} sc={sc} kind={kind} />)}
            <line x1={hour} x2={hour} y1={0} y2={H} stroke="#fff" strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.6} />
          </svg>
        </div>
      ))}
      <p className="text-[11px] text-slate-500">Modelo simple: SoC = carga solar (W/m² × área × eficiencia) − consumo; temperatura por equilibrio radiativo del regolito (albedo 0,12, ε 0,95) con enfriamiento exponencial en sombra.</p>
    </section>
  );
}

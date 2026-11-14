"use client";
import { memo } from "react";
import { BatteryCharging, Radio, Sun, Thermometer, Timer, Zap } from "lucide-react";
import { useMissionStore } from "@/store/useMissionStore";
import { SCENARIO_COLORS, type Scenario } from "@/lib/types";
import { useT } from "@/lib/i18n";

const Card = memo(function Card({ sc, hour, ref0 }: { sc: Scenario; hour: number; ref0: Scenario | undefined }) {
  const t = useT();
  const mode = useMissionStore((s) => s.audienceMode);
  const h = sc.timeline[hour];
  const m = sc.metrics;
  if (!h || !m) return <div className="flex-1 rounded-xl bg-slate-900/70 p-3 text-slate-500">{t("loading")}</div>;
  const badge = {
    VIABLE: { cls: "bg-emerald-600", txt: t("viable") },
    RELAY_REQUIRED: { cls: "bg-amber-500 text-black", txt: t("relay") },
    CRITICAL_FREEZE_RISK: { cls: "bg-red-600", txt: t("freeze") },
  }[m.viability];
  const edu = mode === "educator";
  const delta = (v: number, r: number | undefined, unit = "") =>
    ref0 && ref0.label !== sc.label && r !== undefined ? (
      <span className={`ml-1 text-[10px] ${v - r >= 0 ? "text-emerald-400" : "text-red-400"}`}>{v - r >= 0 ? "+" : ""}{v - r}{unit}</span>
    ) : null;

  return (
    <div className="min-w-[280px] flex-1 rounded-xl border bg-slate-900/70 p-3 text-sm" style={{ borderColor: SCENARIO_COLORS[sc.label] + "66" }}>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold text-slate-200">{sc.label} · {sc.siteName}</span>
        <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${badge.cls}`} title={m.viabilityReason}>{badge.txt}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-3" aria-live="polite">
        <Kpi icon={<Timer className="h-4 w-4 text-amber-300" />} label={edu ? t("lightLeft") : t("hoursToSunset")}
          value={h.sunVisible ? `${h.hoursToSunset} h` : t("inShadow")}
          hint={edu ? (h.sunVisible ? `☀ ${h.hoursToSunset} h` : "⛰ ☀") : `terreno@Sol ${h.terrainAtSun.toFixed(1)}°`} />
        <Kpi icon={<Radio className="h-4 w-4 text-cyan-300" />} label={edu ? t("earthSignal") : t("hoursToEarthset")}
          value={h.earthVisible ? `${h.hoursToEarthset} h` : t("noDte")}
          hint={`🌍 ${h.earthEl.toFixed(2)}° · margen ${h.earthMarginDeg.toFixed(2)}°${h.dte === "degraded" ? ` · ${t("degraded")}` : ""}`} />
        <Kpi icon={<Sun className="h-4 w-4 text-yellow-300" />} label={t("solarEl")} value={`${h.sunEl.toFixed(2)}°`}
          hint={`az ${h.sunAz.toFixed(1)}° · pico ${m.peakSunEl}°`} />
        <Kpi icon={<Zap className="h-4 w-4 text-emerald-300" />} label={t("power")} value={`${h.solarPowerWM2} W/m²`}
          hint={`media ${m.avgPowerWM2} W/m² · ${sc.panelType === "vertical" ? "panel vertical" : "panel horizontal"}`} />
        <Kpi icon={<BatteryCharging className="h-4 w-4 text-lime-300" />} label={t("soc")} value={`${h.socPct.toFixed(0)} %`}
          hint={m.batteryDepletedAtH !== null ? `⚠ agotada en T+${m.batteryDepletedAtH} h` : `mín ${m.minSocPct.toFixed(0)} %`} warn={h.socPct < 20} />
        <Kpi icon={<Thermometer className="h-4 w-4 text-rose-300" />} label={t("temp")} value={`${h.surfaceTempC} °C`}
          hint={`${m.tempMinC} … ${m.tempMaxC} °C (modelo simple)`} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-300 lg:grid-cols-6">
        <Stat k={t("sunlight")} v={<>{m.sunlightPct}%{delta(m.sunlightPct, ref0?.metrics?.sunlightPct, "")}</>} />
        <Stat k="DTE" v={<>{m.dtePct}%{delta(m.dtePct, ref0?.metrics?.dtePct)}</>} />
        <Stat k={t("golden")} v={<>{m.goldenPct}%{delta(m.goldenPct, ref0?.metrics?.goldenPct)}</>} />
        <Stat k="DTE multipath" v={`${m.dteDegradedPct}%`} />
        <Stat k={t("longestShadow")} v={`${m.longestShadowH} h`} />
        <Stat k={t("minSoc")} v={`${m.minSocPct.toFixed(0)}%`} />
      </div>
      <p className="mt-2 text-xs text-slate-400">{m.viabilityReason}</p>
    </div>
  );
});

function Kpi({ icon, label, value, hint, warn }: { icon: React.ReactNode; label: string; value: string; hint: string; warn?: boolean }) {
  return (
    <div className={`rounded-lg p-2 ${warn ? "bg-red-950/70" : "bg-slate-800/80"}`}>
      <div className="flex items-center gap-1 text-[11px] uppercase text-slate-400">{icon}{label}</div>
      <div className="text-lg font-bold text-slate-100">{value}</div>
      <div className="text-[11px] text-slate-400">{hint}</div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="rounded bg-slate-800/50 px-2 py-1">
      <div className="text-[10px] uppercase text-slate-500">{k}</div>
      <div className="font-semibold">{v}</div>
    </div>
  );
}

export default function MetricsComparison() {
  const scenarios = useMissionStore((s) => s.scenarios);
  const hour = useMissionStore((s) => s.currentHourIndex);
  return (
    <section className="grid grid-cols-1 gap-2 lg:grid-cols-2" id="tour-metrics" aria-label="KPIs">
      {scenarios.map((sc) => (
        <Card key={sc.label} sc={sc} hour={hour} ref0={scenarios[0]} />
      ))}
    </section>
  );
}

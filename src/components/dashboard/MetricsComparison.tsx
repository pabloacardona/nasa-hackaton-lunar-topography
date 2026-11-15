"use client";
// Tarjetas simplificadas: veredicto + 4 indicadores clave. El resto, en "Más detalles".
// Cada número tiene su ayuda flotante (qué es, cómo se calcula, para qué sirve, cómo usarlo).
import { memo } from "react";
import { BatteryCharging, Radio, Sparkles, Timer } from "lucide-react";
import { useMissionStore } from "@/store/useMissionStore";
import { SCENARIO_COLORS, type Scenario } from "@/lib/types";
import { aptitude } from "@/lib/lunarMath";
import type { GlossaryKey } from "@/lib/glossary";
import InfoTip from "@/components/ui/InfoTip";
import { useT } from "@/lib/i18n";

const Card = memo(function Card({ sc, hour }: { sc: Scenario; hour: number }) {
  const t = useT();
  const lang = useMissionStore((s) => s.lang);
  const es = lang === "es";
  const h = sc.timeline[hour];
  const m = sc.metrics;
  if (!h || !m) return <div className="flex-1 rounded-xl bg-slate-900/70 p-3 text-slate-500">{t("loading")}</div>;
  const v = {
    VIABLE: { cls: "bg-emerald-600", txt: "🟢 " + t("viable") },
    RELAY_REQUIRED: { cls: "bg-amber-500 text-black", txt: "🟡 " + t("relay") },
    CRITICAL_FREEZE_RISK: { cls: "bg-red-600", txt: "🔴 " + t("freeze") },
  }[m.viability];
  const apt = aptitude(m);

  return (
    <div className="min-w-[280px] flex-1 rounded-xl border bg-slate-900/70 p-3 text-sm" style={{ borderColor: SCENARIO_COLORS[sc.label] + "66" }}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-slate-200">
          <span style={{ color: SCENARIO_COLORS[sc.label] }}>●</span> {sc.label} · {sc.siteName}
        </span>
        <InfoTip k="verdict" icon={false}>
          <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${v.cls}`}>{v.txt}</span>
        </InfoTip>
      </div>
      <p className="mb-2 text-xs text-slate-400">{m.viabilityReason}</p>

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4" aria-live="polite">
        <Big k="hoursToSunset" icon={<Timer className="h-4 w-4 text-amber-300" />} label={es ? "Sol restante" : "Sun left"}
          value={h.sunVisible ? `${h.hoursToSunset} h` : es ? "Sin Sol" : "No Sun"} bad={!h.sunVisible} />
        <Big k="hoursToEarthset" icon={<Radio className="h-4 w-4 text-cyan-300" />} label={es ? "Señal Tierra" : "Earth link"}
          value={h.earthVisible ? `${h.hoursToEarthset} h` : es ? "Sin señal" : "No link"} bad={!h.earthVisible} warn={h.dte === "degraded"} />
        <Big k="battery" icon={<BatteryCharging className="h-4 w-4 text-lime-300" />} label={es ? "Batería" : "Battery"}
          value={`${h.socPct.toFixed(0)} %`} bad={h.socPct <= 0} warn={h.socPct < 25} />
        <Big k="aptitude" icon={<Sparkles className="h-4 w-4 text-yellow-300" />} label={es ? "Aptitud" : "Suitability"} value={`${apt} / 100`} bad={apt < 35} warn={apt < 65} />
      </div>

      <details className="mt-2 text-xs text-slate-300">
        <summary className="cursor-pointer select-none text-slate-400 hover:text-slate-200">{es ? "Más detalles" : "More details"}</summary>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
          <Small k="sunlightPct" label={es ? "% con Sol" : "% sunlight"} value={`${m.sunlightPct} %`} />
          <Small k="dtePct" label={es ? "% con Tierra" : "% Earth"} value={`${m.dtePct} %${m.dteDegradedPct ? ` (${m.dteDegradedPct} % débil)` : ""}`} />
          <Small k="goldenPct" label={es ? "Sol y Tierra" : "Sun & Earth"} value={`${m.goldenPct} %`} />
          <Small k="longestShadow" label={es ? "Sombra más larga" : "Longest shadow"} value={`${m.longestShadowH} h`} />
          <Small k="solarElevation" label={es ? "Altura del Sol" : "Sun elevation"} value={`${h.sunEl.toFixed(2)}°`} />
          <Small k="power" label={es ? "Energía solar" : "Solar power"} value={`${h.solarPowerWM2} W/m²`} />
          <Small k="temperature" label={es ? "Temperatura suelo" : "Surface temp."} value={`${h.surfaceTempC} °C`} />
          <Small k="battery" label={es ? "Batería mínima" : "Min battery"} value={`${m.minSocPct.toFixed(0)} %`} />
          <Small k="horizonSource" label={es ? "Relieve" : "Terrain"} value={sc.horizonSource.split(",")[0]} />
        </div>
      </details>
    </div>
  );
});

function Big({ k, icon, label, value, bad, warn }: { k: GlossaryKey; icon: React.ReactNode; label: string; value: string; bad?: boolean; warn?: boolean }) {
  return (
    <div className={`rounded-lg p-2 ${bad ? "bg-red-950/70" : warn ? "bg-amber-950/50" : "bg-slate-800/80"}`}>
      <InfoTip k={k}>
        <span className="flex items-center gap-1 text-[11px] uppercase text-slate-400">{icon}{label}</span>
      </InfoTip>
      <div className="text-xl font-bold text-slate-100">{value}</div>
    </div>
  );
}

function Small({ k, label, value }: { k: GlossaryKey; label: string; value: string }) {
  return (
    <div className="rounded bg-slate-800/50 px-2 py-1">
      <InfoTip k={k}><span className="text-[10px] uppercase text-slate-500">{label}</span></InfoTip>
      <div className="truncate font-semibold" title={value}>{value}</div>
    </div>
  );
}

export default function MetricsComparison() {
  const scenarios = useMissionStore((s) => s.scenarios);
  const hour = useMissionStore((s) => s.currentHourIndex);
  return (
    <section className="grid grid-cols-1 gap-2 lg:grid-cols-2" id="tour-metrics" aria-label="KPIs">
      {scenarios.map((sc) => (
        <Card key={sc.label} sc={sc} hour={hour} />
      ))}
    </section>
  );
}

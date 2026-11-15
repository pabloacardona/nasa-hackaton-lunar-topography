"use client";
// Tarjetas de misión: veredicto grande con estrellas + 4 medidores visuales.
// Modo Explorador: frases sencillas. Modo Ingeniero: términos técnicos. Los números son los mismos
// y cada uno tiene su ayuda flotante (qué es, cómo se calcula, para qué sirve, cómo usarlo).
import { memo } from "react";
import { useMissionStore } from "@/store/useMissionStore";
import { SCENARIO_COLORS, type Scenario } from "@/lib/types";
import { aptitude } from "@/lib/lunarMath";
import type { GlossaryKey } from "@/lib/glossary";
import InfoTip from "@/components/ui/InfoTip";
import { useT } from "@/lib/i18n";

export function Stars({ value, size = "text-base" }: { value: number; size?: string }) {
  const n = Math.round(value / 20);
  return <span className={`${size} tracking-tight`} role="img" aria-label={`${n} / 5`}>{"★".repeat(n)}<span className="opacity-25">{"★".repeat(5 - n)}</span></span>;
}

const Card = memo(function Card({ sc, hour }: { sc: Scenario; hour: number }) {
  const t = useT();
  const es = useMissionStore((s) => s.lang) === "es";
  const kid = useMissionStore((s) => s.audienceMode) === "educator";
  const missionHours = useMissionStore((s) => s.missionHours);
  const h = sc.timeline[hour];
  const m = sc.metrics;
  if (!h || !m) return <div className="card flex-1 p-4 text-slate-400"> {t("loading")}</div>;
  const v = {
    VIABLE: { cls: "from-[#7fb39a] to-[#b8cc98] text-black glow-ok", kid: es ? "¡Sí se puede alunizar!" : "Yes, we can land!", pro: t("viable") },
    RELAY_REQUIRED: { cls: "from-[#c9a66b] to-[#d8c07a] text-black", kid: es ? "Se puede, pero con un satélite ayudante" : "Possible, with a helper satellite", pro: t("relay") },
    CRITICAL_FREEZE_RISK: { cls: "from-[#9a5559] to-[#b86b78] text-white", kid: es ? "¡Peligro! Aquí el lander se congela" : "Danger! The lander freezes here", pro: t("freeze") },
  }[m.viability];
  const apt = aptitude(m);

  return (
    <div className="card min-w-[290px] flex-1 p-3 text-sm" style={{ borderColor: SCENARIO_COLORS[sc.label] }}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full font-display text-lg font-extrabold text-black" style={{ background: SCENARIO_COLORS[sc.label] }}>{sc.label}</span>
        <span className="font-display text-base font-bold text-slate-100">{sc.siteName}</span>
        <span className="ml-auto text-[#dcc08f]"><Stars value={apt} size="text-xl" /></span>
      </div>
      <InfoTip k="verdict" icon={false} className="block">
        <div className={`flex items-center gap-2 rounded-2xl bg-gradient-to-r px-3 py-2 ${v.cls}`}>
          <div className="leading-tight">
            <div className="font-display text-lg font-extrabold">{kid ? v.kid : v.pro}</div>
            <div className="text-xs font-semibold opacity-80">{kid ? v.pro : m.viabilityReason}</div>
          </div>
        </div>
      </InfoTip>
      {kid && <p className="mt-1 text-xs text-slate-400">{m.viabilityReason}</p>}

      <div className="mt-2 grid grid-cols-2 gap-2" aria-live="polite">
        <Meter k="hoursToSunset" color="#c9a25e" label={kid ? (es ? "Luz del Sol" : "Sunlight") : (es ? "Sol restante" : "Sun left")}
          value={h.sunVisible ? `${h.hoursToSunset} h` : es ? "Sin Sol" : "No Sun"} sub={kid ? (h.sunVisible ? (es ? "de luz seguidas" : "of light in a row") : (es ? "está de noche" : "it is night")) : undefined}
          pct={h.sunVisible ? (h.hoursToSunset / missionHours) * 100 : 0} bad={!h.sunVisible} />
        <Meter k="hoursToEarthset" color="#7ab8c4" label={kid ? (es ? "Llamada a la Tierra" : "Call to Earth") : (es ? "Señal Tierra (DTE)" : "Earth link (DTE)")}
          value={h.earthVisible ? `${h.hoursToEarthset} h` : es ? "Sin señal" : "No link"} sub={kid ? (h.earthVisible ? (h.dte === "degraded" ? (es ? "señal débil" : "weak signal") : (es ? "de señal seguidas" : "of signal in a row")) : (es ? "una montaña la tapa" : "a mountain blocks it")) : undefined}
          pct={h.earthVisible ? (h.hoursToEarthset / missionHours) * 100 : 0} bad={!h.earthVisible} warn={h.dte === "degraded"} />
        <Meter k="battery" color="#8fb07a" label={es ? "Batería" : "Battery"} value={`${h.socPct.toFixed(0)} %`}
          sub={kid ? (h.socPct > 60 ? (es ? "¡bien cargada!" : "well charged!") : h.socPct > 0 ? (es ? "se está gastando" : "running down") : (es ? "¡vacía!" : "empty!")) : undefined}
          pct={h.socPct} bad={h.socPct <= 0} warn={h.socPct < 25} />
        <Meter k="aptitude" color="#a88bb8" label={kid ? (es ? "Puntaje del lugar" : "Place score") : (es ? "Aptitud" : "Suitability")} value={`${apt} / 100`}
          sub={kid ? (apt >= 65 ? (es ? "¡excelente lugar!" : "great place!") : apt >= 35 ? (es ? "más o menos" : "so-so") : (es ? "mejor busca otro" : "try another")) : undefined}
          pct={apt} bad={apt < 35} warn={apt < 65} />
      </div>

      <details className="mt-2 text-xs text-slate-300" open={!kid}>
        <summary className="cursor-pointer select-none rounded-full bg-slate-800 px-3 py-1 font-bold text-slate-200 hover:bg-slate-700"> {es ? "Datos técnicos" : "Technical data"}</summary>
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

function Meter({ k, label, value, sub, pct, color, bad, warn }: { k: GlossaryKey; label: string; value: string; sub?: string; pct: number; color: string; bad?: boolean; warn?: boolean }) {
  const c = bad ? "#b86b6e" : warn ? "#f59e0b" : color;
  return (
    <div className={`rounded-2xl p-2 ${bad ? "bg-[#2e1a1c]/70" : "bg-slate-800/80"}`}>
      <InfoTip k={k}>
        <span className="flex items-center gap-1 text-xs font-bold text-slate-300">{label}</span>
      </InfoTip>
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-2xl font-extrabold leading-tight text-white">{value}</span>
        {sub && <span className="text-[11px] text-slate-400">{sub}</span>}
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-950" aria-hidden>
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.max(3, Math.min(100, pct))}%`, background: c }} />
      </div>
    </div>
  );
}

function Small({ k, label, value }: { k: GlossaryKey; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-800/50 px-2 py-1">
      <InfoTip k={k}><span className="text-[10px] uppercase text-slate-400">{label}</span></InfoTip>
      <div className="truncate font-bold" title={value}>{value}</div>
    </div>
  );
}

export default function MetricsComparison() {
  const scenarios = useMissionStore((s) => s.scenarios);
  const hour = useMissionStore((s) => s.currentHourIndex);
  return (
    <section className="grid grid-cols-1 gap-3 lg:grid-cols-2" id="tour-metrics" aria-label="KPIs">
      {scenarios.map((sc) => (
        <Card key={sc.label} sc={sc} hour={hour} />
      ))}
    </section>
  );
}

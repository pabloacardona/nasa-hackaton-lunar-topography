"use client";
// Comparación Tierra (Medellín) vs. Luna (escenario activo): el mismo "día" visto en los dos mundos.
import { useMemo } from "react";
import { Scale } from "lucide-react";
import { effectiveStart, useMissionStore } from "@/store/useMissionStore";
import { SCENARIO_COLORS } from "@/lib/types";
import { useT } from "@/lib/i18n";

const D2R = Math.PI / 180;
/** Elevación solar aproximada en la Tierra (algoritmo NOAA simplificado). */
function earthSunElevation(lat: number, lon: number, date: Date) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = (357.528 + 0.9856003 * n) % 360;
  const lambda = L + 1.915 * Math.sin(g * D2R) + 0.02 * Math.sin(2 * g * D2R);
  const eps = 23.439 - 0.0000004 * n;
  const dec = Math.asin(Math.sin(eps * D2R) * Math.sin(lambda * D2R));
  const ra = Math.atan2(Math.cos(eps * D2R) * Math.sin(lambda * D2R), Math.cos(lambda * D2R));
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  const ha = ((gmst * 15 + lon) * D2R - ra);
  return Math.asin(Math.sin(lat * D2R) * Math.sin(dec) + Math.cos(lat * D2R) * Math.cos(dec) * Math.cos(ha)) / D2R;
}

export default function EarthVsMoon() {
  const t = useT();
  const scenarios = useMissionStore((s) => s.scenarios);
  const activeLabel = useMissionStore((s) => s.activeLabel);
  const sc = scenarios.find((s) => s.label === activeLabel) ?? scenarios[0];

  const data = useMemo(() => {
    if (!sc?.timeline.length) return null;
    const start = new Date(effectiveStart(sc));
    const earth = Array.from({ length: 24 * 30 }, (_, i) => earthSunElevation(6.25, -75.56, new Date(start.getTime() + i * 3600_000)));
    const moon = sc.timeline.map((h) => h.sunEl);
    const earthDay = earth.slice(0, 24).filter((e) => e > -0.833).length;
    const moonLit = sc.timeline.filter((h) => h.sunVisible).length;
    return { earth, moon, earthDay, moonLit, earthMax: Math.max(...earth.slice(0, 24)), moonMax: Math.max(...moon) };
  }, [sc]);
  if (!data) return null;

  const W = 720, H = 120;
  const y = (el: number) => H / 2 - (Math.max(-90, Math.min(90, el)) / 90) * (H / 2 - 4);
  const line = (arr: number[]) => arr.map((v, i) => `${i ? "L" : "M"}${(i / arr.length) * W},${y(v).toFixed(1)}`).join("");

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-3 text-sm" id="tour-earthmoon">
      <h2 className="mb-2 flex items-center gap-1 font-semibold text-slate-200"><Scale className="h-4 w-4 text-[#7fa6c9]" aria-hidden /> {t("earthVsMoon")}: Medellín vs. <span style={{ color: SCENARIO_COLORS[sc.label] }}>{sc.label} · {sc.siteName}</span></h2>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full rounded bg-slate-950" role="img" aria-label="Elevación del Sol en la Tierra y en la Luna durante 30 días">
        <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="#475569" />
        <path d={line(data.earth)} stroke="#7ea4c9" fill="none" strokeWidth={1} opacity={0.8} />
        <path d={line(data.moon)} stroke="#c9a25e" fill="none" strokeWidth={2} />
        <text x={6} y={14} fill="#7ea4c9" fontSize={8}>Tierra: el Sol sale y se pone cada 24 h</text>
        <text x={6} y={H - 6} fill="#c9a25e" fontSize={8}>Luna: un solo «día» de ~29,5 días terrestres</text>
      </svg>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-300 md:grid-cols-5">
        <Cell k="Duración del día" a={`${data.earthDay} h`} b={`${data.moonLit} h de Sol en 30 d`} />
        <Cell k="Sol más alto" a={`${data.earthMax.toFixed(0)}°`} b={`${data.moonMax.toFixed(1)}°`} />
        <Cell k="Crepúsculo" a="~25 min (atmósfera)" b="0 min: sombra instantánea" />
        <Cell k="Temperatura" a="17 … 27 °C" b={`${sc.metrics?.tempMinC} … ${sc.metrics?.tempMaxC} °C`} />
        <Cell k="Cielo de día" a="Azul (dispersión)" b="Negro, estrellas visibles" />
      </div>
    </section>
  );
}

function Cell({ k, a, b }: { k: string; a: string; b: string }) {
  return (
    <div className="rounded bg-slate-800/60 p-2">
      <div className="text-[10px] uppercase text-slate-500">{k}</div>
      <div className="text-[#9dbdd9]">Tierra {a}</div>
      <div className="text-[#dcc08f]"> {b}</div>
    </div>
  );
}

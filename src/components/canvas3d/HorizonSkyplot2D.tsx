"use client";
// Panorama 360° del horizonte: silueta del terreno (LOLA) + trayectoria del Sol y de la Tierra.
// Optimizado: la parte estática (terreno + trayectorias) se memoriza; solo se mueven los marcadores.
import { memo, useMemo } from "react";
import { useMissionStore } from "@/store/useMissionStore";
import { SCENARIO_COLORS, type Scenario } from "@/lib/types";

const W = 720;
const H = 200;

const StaticLayer = memo(function StaticLayer({ sc, yMax }: { sc: Scenario; yMax: number }) {
  const yMin = -5;
  const x = (az: number) => (((az % 360) + 360) % 360) * (W / 360);
  const y = (el: number) => H - ((Math.min(yMax, el) - yMin) / (yMax - yMin)) * H;
  const terrain = useMemo(() => {
    const pts = sc.horizonProfileDeg.map((h, az) => `${x(az).toFixed(1)},${y(h).toFixed(1)}`).join(" ");
    return `0,${H} ${pts} ${W},${y(sc.horizonProfileDeg[0] ?? 0)} ${W},${H}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sc.horizonProfileDeg, yMax]);
  const path = (body: "sun" | "earth") => {
    let d = "";
    sc.timeline.forEach((h, i) => {
      if (i % 3) return;
      const az = body === "sun" ? h.sunAz : h.earthAz;
      const el = body === "sun" ? h.sunEl : h.earthEl;
      d += `M${x(az).toFixed(1)},${y(el).toFixed(1)}h0.01`;
    });
    return d;
  };
  return (
    <>
      <rect width={W} height={H} fill="#020617" />
      {[0, 90, 180, 270].map((az, i) => (
        <g key={az}>
          <line x1={x(az)} x2={x(az)} y1={0} y2={H} stroke="#334155" strokeDasharray="2 4" />
          <text x={x(az) + 3} y={12} fill="#64748b" fontSize={10}>{["N", "E", "S", "O"][i]}</text>
        </g>
      ))}
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="#475569" />
      <path d={path("sun")} stroke="#fbbf24" strokeWidth={1.8} strokeLinecap="round" opacity={0.35} />
      <path d={path("earth")} stroke="#22d3ee" strokeWidth={1.8} strokeLinecap="round" opacity={0.45} />
      <polygon points={terrain} fill="#1f2937" stroke="#94a3b8" strokeWidth={0.8} />
    </>
  );
});

export function Skyplot({ sc }: { sc: Scenario }) {
  const hour = useMissionStore((s) => s.currentHourIndex);
  const yMax = sc.region === "south_pole" ? 12 : 90;
  const yMin = -5;
  const x = (az: number) => (((az % 360) + 360) % 360) * (W / 360);
  const y = (el: number) => H - ((Math.min(yMax, el) - yMin) / (yMax - yMin)) * H;
  const h = sc.timeline[hour];
  return (
    <div className="rounded-lg bg-black/60 p-1">
      <div className="px-1 text-[11px] text-slate-400">
        <span style={{ color: SCENARIO_COLORS[sc.label] }}>●</span> {sc.label} · {sc.siteName} — {yMin}° … {yMax}° · {sc.horizonSource}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Panorama del horizonte ${sc.label}`}>
        <StaticLayer sc={sc} yMax={yMax} />
        {h && (
          <>
            <circle cx={x(h.sunAz)} cy={y(h.sunEl)} r={6} fill={h.sunVisible ? "#facc15" : "#ef4444"} stroke="white" />
            <circle cx={x(h.earthAz)} cy={y(h.earthEl)} r={5} fill={h.dte === "full" ? "#38bdf8" : h.dte === "degraded" ? "#a78bfa" : "#ef4444"} stroke="white" />
          </>
        )}
      </svg>
    </div>
  );
}

export default function HorizonSkyplot2D() {
  const scenarios = useMissionStore((s) => s.scenarios);
  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-2" id="tour-panorama">
      {scenarios.map((sc) => (
        <Skyplot key={sc.label} sc={sc} />
      ))}
    </div>
  );
}

"use client";
// Mapa polar sur (estereográfico, 80°S–90°S) con relieve LOLA. Clic = colocar el escenario activo.
import { useState } from "react";
import { Map as MapIcon } from "lucide-react";
import { useMissionStore } from "@/store/useMissionStore";
import { useUiStore } from "@/store/useUiStore";
import { SCENARIO_COLORS } from "@/lib/types";
import { southPolarStereo, southPolarStereoInv } from "@/lib/geo";
import { useT } from "@/lib/i18n";
import { exploreAt } from "@/lib/explore";
import { aptitudeColor } from "@/lib/lunarMath";

const RMAX = Math.tan(((10 * Math.PI) / 180) / 2); // 80°S en el borde
const VB = 1000;

const toXY = (lat: number, lon: number) => {
  const p = southPolarStereo(lat, lon);
  return { x: VB / 2 + (p.x / RMAX) * (VB / 2), y: VB / 2 - (p.y / RMAX) * (VB / 2) };
};

export default function PolarMap() {
  const t = useT();
  const dataset = useMissionStore((s) => s.dataset);
  const scenarios = useMissionStore((s) => s.scenarios);
  const activeLabel = useMissionStore((s) => s.activeLabel);
  const honey = useUiStore((s) => s.honey);
  const { setSite } = useMissionStore.getState();
  const [hover, setHover] = useState<{ lat: number; lon: number } | null>(null);

  const fromEvent = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (((e.clientX - r.left) / r.width) * VB - VB / 2) / (VB / 2) * RMAX;
    const y = -(((e.clientY - r.top) / r.height) * VB - VB / 2) / (VB / 2) * RMAX;
    const p = southPolarStereoInv(x, y);
    return p.lat <= -80 ? p : null;
  };

  const polarSites = dataset?.sites.filter((s) => s.lat <= -80) ?? [];
  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-3 text-sm" id="tour-polar">
      <h2 className="mb-1 flex items-center gap-1 font-semibold text-slate-200"><MapIcon className="h-4 w-4 text-sky-400" aria-hidden /> {t("polarTitle")}</h2>
      <p className="mb-2 text-xs text-slate-400">{t("polarHelp")} → <b style={{ color: SCENARIO_COLORS[activeLabel] }}>{activeLabel}</b></p>
      <svg viewBox={`0 0 ${VB} ${VB}`} className="mx-auto h-auto w-full max-w-[400px] cursor-crosshair" role="img" aria-label="Mapa del polo sur lunar"
        onMouseMove={(e) => setHover(fromEvent(e))} onMouseLeave={() => setHover(null)}
        onClick={(e) => { const p = fromEvent(e); if (p) void exploreAt(p.lat, p.lon); }}>
        <image href="/textures/moon/south_pole_map_1k.webp" x={0} y={0} width={VB} height={VB} />
        {[-82, -84, -86, -88].map((lat) => (
          <circle key={lat} cx={VB / 2} cy={VB / 2} r={toXY(lat, 0).y - VB / 2 < 0 ? VB / 2 - toXY(lat, 0).y : toXY(lat, 0).y - VB / 2} fill="none" stroke="#38bdf8" strokeOpacity={0.15} />
        ))}
        {[0, 90, 180, 270].map((lon) => {
          const p = toXY(-80, lon);
          return <text key={lon} x={p.x} y={p.y} fill="#94a3b8" fontSize={22} textAnchor="middle" dy={lon === 0 ? 24 : lon === 180 ? -8 : 6}>{lon === 0 ? "0° (Tierra)" : `${lon}°E`}</text>;
        })}
        {polarSites.map((s) => {
          const p = toXY(s.lat, s.lon);
          return (
            <g key={s.id} onClick={async (e) => { e.stopPropagation(); await setSite(activeLabel, s.id); void exploreAt(s.lat, s.lon, { moveScenario: false }); }} className="cursor-pointer">
              <circle cx={p.x} cy={p.y} r={9} fill="#facc15" stroke="#000" strokeWidth={2} />
              <text x={p.x + 12} y={p.y + 5} fontSize={20} fill="#fde68a" stroke="#000" strokeWidth={4} paintOrder="stroke">{s.name}</text>
            </g>
          );
        })}
        {honey?.results.filter((r) => r.lat <= -80).map((r) => {
          const p = toXY(r.lat, r.lon);
          return <circle key={`${r.cell.q},${r.cell.r}`} cx={p.x} cy={p.y} r={4} fill={aptitudeColor(r.aptitude)} opacity={0.9} />;
        })}
        {scenarios.filter((s) => s.lat <= -80).map((s) => {
          const p = toXY(s.lat, s.lon);
          return (
            <g key={s.label}>
              <circle cx={p.x} cy={p.y} r={14} fill="none" stroke={SCENARIO_COLORS[s.label]} strokeWidth={5} />
              <text x={p.x - 6} y={p.y - 18} fontSize={24} fontWeight={700} fill={SCENARIO_COLORS[s.label]} stroke="#000" strokeWidth={4} paintOrder="stroke">{s.label}</text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 h-4 text-[11px] text-slate-400">{hover ? `${hover.lat.toFixed(3)}°, ${hover.lon.toFixed(2)}°E` : "Relieve: LOLA LDEM 16 px/° (NASA)."}</p>
    </section>
  );
}

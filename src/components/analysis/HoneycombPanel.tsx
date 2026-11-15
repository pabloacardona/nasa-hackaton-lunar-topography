"use client";
// Panal de abeja simplificado: instrucciones, separación, progreso y ranking de las mejores celdas.
// El cálculo se lanza con un clic en la Luna (globo) o en el mapa polar.
import { useMemo } from "react";
import { Crosshair, Hexagon, Loader2 } from "lucide-react";
import { useMissionStore } from "@/store/useMissionStore";
import { useUiStore } from "@/store/useUiStore";
import { aptitudeColor } from "@/lib/lunarMath";
import { applyCell, exploreAt } from "@/lib/explore";
import { SCENARIO_COLORS } from "@/lib/types";
import InfoTip from "@/components/ui/InfoTip";

const DIRS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
const dirOf = (n: number, e: number) => DIRS[Math.round(((Math.atan2(e, n) * 180) / Math.PI + 360) % 360 / 45) % 8];

export default function HoneycombPanel() {
  const es = useMissionStore((s) => s.lang) === "es";
  const activeLabel = useMissionStore((s) => s.activeLabel);
  const active = useMissionStore((s) => s.scenarios.find((x) => x.label === s.activeLabel));
  const honey = useUiStore((s) => s.honey);
  const busy = useUiStore((s) => s.honeyBusy);
  const err = useUiStore((s) => s.honeyError);
  const spacing = useUiStore((s) => s.honeySpacingKm);
  const selIdx = useUiStore((s) => s.honeySel);
  const { setHoneySpacing, setHoneySel } = useUiStore.getState();

  const ranked = useMemo(() => (honey ? honey.results.map((r, i) => ({ r, i })).sort((a, b) => b.r.aptitude - a.r.aptitude) : []), [honey]);
  const sel = selIdx != null && honey ? honey.results[selIdx] : null;
  const center = honey?.results.find((r) => r.cell.ring === 0);

  return (
    <section className="flex h-full flex-col gap-2 rounded-xl border border-slate-700 bg-slate-900/70 p-3 text-sm" id="tour-honeycomb">
      <InfoTip k="honeycomb">
        <h2 className="flex items-center gap-1 font-semibold text-slate-200"><Hexagon className="h-4 w-4 text-amber-400" aria-hidden /> {es ? "Panal de abeja" : "Honeycomb"}</h2>
      </InfoTip>
      <ol className="list-decimal pl-4 text-xs text-slate-400">
        <li>{es ? "Haz clic en la Luna o en el mapa polar." : "Click on the Moon or the polar map."}</li>
        <li>{es ? "Se calculan 37 puntos cercanos con su relieve real." : "37 nearby points are computed with real terrain."}</li>
        <li>{es ? "Elige el hexágono verde con mayor %." : "Pick the greenest hexagon with the highest %."}</li>
      </ol>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400">{es ? "Distancia entre puntos" : "Spacing"}:</span>
        {[1, 2, 5].map((km) => (
          <button key={km} onClick={() => setHoneySpacing(km)} aria-pressed={spacing === km} className={`rounded px-2 py-0.5 ${spacing === km ? "bg-amber-500 font-semibold text-black" : "bg-slate-800"}`}>{km} km</button>
        ))}
        {active && (
          <button onClick={() => void exploreAt(active.lat, active.lon, { moveScenario: false })} disabled={!!busy}
            className="ml-auto flex items-center gap-1 rounded bg-slate-700 px-2 py-0.5 hover:bg-slate-600 disabled:opacity-50">
            <Crosshair className="h-3 w-3" /> {es ? "Alrededor de" : "Around"} {activeLabel}
          </button>
        )}
      </div>

      {busy && (
        <div className="flex items-center gap-2 text-xs text-amber-200">
          <Loader2 className="h-3 w-3 animate-spin" /> {busy.done}/{busy.total}
          <div className="h-1.5 flex-1 overflow-hidden rounded bg-slate-700"><div className="h-full bg-amber-400 transition-all" style={{ width: `${(busy.done / busy.total) * 100}%` }} /></div>
        </div>
      )}
      {err && <p className="text-xs text-red-300">{err}</p>}

      {honey && !busy && (
        <>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <InfoTip k="aptitude"><span>{es ? "Aptitud de aterrizaje" : "Landing suitability"}</span></InfoTip>
            <span className="h-2 flex-1 rounded" style={{ background: `linear-gradient(90deg, ${aptitudeColor(0)}, ${aptitudeColor(50)}, ${aptitudeColor(100)})` }} />
            <span>0 → 100</span>
          </div>
          {center && (
            <p className="text-xs text-slate-400">
              {es ? "Punto elegido" : "Chosen point"}: <b style={{ color: aptitudeColor(center.aptitude) }}>{center.aptitude}%</b> · {es ? "mejor cercano" : "best nearby"}: <b style={{ color: aptitudeColor(ranked[0].r.aptitude) }}>{ranked[0].r.aptitude}%</b>
            </p>
          )}
          <ul className="flex flex-col gap-1" aria-label="Mejores celdas">
            {ranked.slice(0, 5).map(({ r, i }, k) => {
              const dist = Math.hypot(r.cell.northKm, r.cell.eastKm);
              return (
                <li key={i} className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${selIdx === i ? "bg-slate-700" : "bg-slate-800/70"}`}>
                  <button className="flex flex-1 items-center gap-2 text-left" onClick={() => setHoneySel(i)}>
                    <span className="w-4 text-slate-500">{k + 1}</span>
                    <span className="w-12 rounded px-1 text-center font-bold text-black" style={{ background: aptitudeColor(r.aptitude) }}>{r.aptitude}%</span>
                    <span className="flex-1 text-slate-300">
                      {dist < 0.01 ? (es ? "punto elegido" : "chosen point") : `${dist.toFixed(1)} km ${es ? "al" : "to"} ${dirOf(r.cell.northKm, r.cell.eastKm)}`}
                      <span className="ml-1 text-slate-500">☀{r.metrics.sunlightPct}% 🌍{r.metrics.dtePct}%</span>
                    </span>
                  </button>
                  <button onClick={() => void applyCell(r.lat, r.lon)} className="rounded px-2 py-0.5 font-semibold text-black" style={{ background: SCENARIO_COLORS[activeLabel] }}>
                    {es ? "Usar" : "Use"} → {activeLabel}
                  </button>
                </li>
              );
            })}
          </ul>
          {sel && (
            <div className="rounded border border-slate-600 p-2 text-xs text-slate-300">
              <p className="font-semibold text-slate-100">{es ? "Celda seleccionada" : "Selected cell"}: {sel.aptitude}% · {sel.lat.toFixed(4)}°, {sel.lon.toFixed(3)}°</p>
              <p>☀ {sel.metrics.sunlightPct}% · 🌍 {sel.metrics.dtePct}% · ✦ {sel.metrics.goldenPct}% · 🔋 {sel.metrics.minSocPct.toFixed(0)}%</p>
              <p className="text-slate-400">{sel.metrics.viabilityReason}</p>
              <button onClick={() => void applyCell(sel.lat, sel.lon)} className="mt-1 rounded px-2 py-0.5 font-semibold text-black" style={{ background: SCENARIO_COLORS[activeLabel] }}>
                {es ? "Mover escenario" : "Move scenario"} {activeLabel} {es ? "aquí" : "here"}
              </button>
            </div>
          )}
        </>
      )}
      {!honey && !busy && !err && (
        <p className="text-xs text-slate-500">{es ? "Aún no hay cálculo. Prueba haciendo clic cerca del polo sur." : "No computation yet. Try clicking near the south pole."}</p>
      )}
    </section>
  );
}

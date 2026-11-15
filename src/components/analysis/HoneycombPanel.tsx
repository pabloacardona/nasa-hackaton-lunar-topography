"use client";
// Panal de abeja simplificado: instrucciones, separación, progreso y ranking de las mejores celdas.
// El cálculo se lanza con un clic en la Luna (globo) o en el mapa polar.
import { useMemo, useState } from "react";
import { Crosshair, Hexagon, Loader2 } from "lucide-react";
import { useMissionStore } from "@/store/useMissionStore";
import { useUiStore } from "@/store/useUiStore";
import { aptitudeColor } from "@/lib/lunarMath";
import { exploreAt, goToCell } from "@/lib/explore";
import { SCENARIO_COLORS } from "@/lib/types";
import InfoTip from "@/components/ui/InfoTip";
import { Stars } from "@/components/dashboard/MetricsComparison";

const DIRS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
const dirOf = (n: number, e: number) => DIRS[Math.round(((Math.atan2(e, n) * 180) / Math.PI + 360) % 360 / 45) % 8];

export default function HoneycombPanel() {
  const es = useMissionStore((s) => s.lang) === "es";
  const kid = useMissionStore((s) => s.audienceMode) === "educator";
  const activeLabel = useMissionStore((s) => s.activeLabel);
  const active = useMissionStore((s) => s.scenarios.find((x) => x.label === s.activeLabel));
  const honey = useUiStore((s) => s.honey);
  const busy = useUiStore((s) => s.honeyBusy);
  const err = useUiStore((s) => s.honeyError);
  const spacing = useUiStore((s) => s.honeySpacingKm);
  const selIdx = useUiStore((s) => s.honeySel);
  const { setHoneySpacing, setHoneySel } = useUiStore.getState();
  const [moved, setMoved] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const goHere = async (lat: number, lon: number, label: string) => {
    setMoving(true); setMoved(null);
    const ok = await goToCell(lat, lon, activeLabel);
    setMoving(false);
    setMoved(ok ? (es ? `Listo: la nave está en ${label}. El panal se recalculó alrededor de ese punto.` : `Done: the lander is at ${label}. The panel was recalculated around that point.`) : (es ? "No hubo datos para esa celda. Prueba otra." : "No data for that cell. Try another one."));
  };

  const ranked = useMemo(() => (honey ? honey.results.map((r, i) => ({ r, i })).sort((a, b) => b.r.aptitude - a.r.aptitude) : []), [honey]);
  const sel = selIdx != null && honey ? honey.results[selIdx] : null;
  const center = honey?.results.find((r) => r.cell.ring === 0);
  const nViable = honey ? honey.results.filter((r) => r.metrics.viability === "VIABLE").length : 0;

  return (
    <section className="card flex h-full flex-col gap-2 border-[#c9a66b]/60 p-3 text-sm" id="tour-honeycomb">
      <InfoTip k="honeycomb">
        <h2 className="flex items-center gap-1.5 font-display text-lg font-extrabold text-[#dcc08f]"><Hexagon className="h-5 w-5" aria-hidden /> {kid ? (es ? "El panal explorador " : "The explorer honeycomb ") : (es ? "Panal de abeja" : "Honeycomb")}</h2>
      </InfoTip>
      <ol className="flex flex-col gap-1 text-xs text-slate-300">
        {(es
          ? [["", "Toca un punto de la Luna."], ["", kid ? "El panal revisa 37 lugares vecinos." : "Se evalúan 37 puntos vecinos con su relieve LOLA."], ["", kid ? "¡Elige uno verde con  y más estrellas!" : "Las celdas con  y borde verde son viables; elige la de mayor %."]]
          : [["", "Tap a point on the Moon."], ["", kid ? "The honeycomb checks 37 nearby places." : "37 neighbouring points are evaluated with LOLA terrain."], ["", kid ? "Pick a green one with  and more stars!" : "Cells with  and a green edge are viable; pick the highest %."]]
        ).map(([e, txt], i) => (
          <li key={i} className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800" aria-hidden>{e}</span>{txt}</li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400">{kid ? (es ? "Tamaño del panal" : "Honeycomb size") : (es ? "Distancia entre puntos" : "Spacing")}:</span>
        {[1, 2, 5].map((km) => (
          <button key={km} onClick={() => setHoneySpacing(km)} aria-pressed={spacing === km} className={`rounded-full px-2.5 py-0.5 font-bold ${spacing === km ? "bg-[#c9a66b] text-black" : "bg-slate-800"}`}>{km} km</button>
        ))}
        {active && (
          <button onClick={() => void exploreAt(active.lat, active.lon, { moveScenario: false })} disabled={!!busy}
            className="ml-auto flex items-center gap-1 rounded bg-slate-700 px-2 py-0.5 hover:bg-slate-600 disabled:opacity-50">
            <Crosshair className="h-3 w-3" /> {es ? "Alrededor de" : "Around"} {activeLabel}
          </button>
        )}
      </div>

      {busy && (
        <div className="flex items-center gap-2 text-xs text-[#e6d3ad]">
          <Loader2 className="h-3 w-3 animate-spin" /> {busy.done}/{busy.total}
          <div className="h-1.5 flex-1 overflow-hidden rounded bg-slate-700"><div className="h-full bg-[#c9a66b] transition-all" style={{ width: `${(busy.done / busy.total) * 100}%` }} /></div>
        </div>
      )}
      {err && <p className="text-xs text-[#e0a4a8]">{err}</p>}

      {honey && !busy && (
        <>
          <div role="status" className={`pop rounded-2xl px-3 py-2 font-display text-base font-extrabold ${nViable ? "glow-ok bg-[#7fb39a] text-black" : "bg-[#884a4e] text-white"}`}>
            {nViable
              ? (kid ? (es ? ` ¡Encontraste ${nViable} lugar${nViable > 1 ? "es" : ""} para alunizar!` : ` You found ${nViable} place${nViable > 1 ? "s" : ""} to land!`) : (es ? ` ALUNIZAJE VIABLE en ${nViable} de ${honey.results.length} celdas` : ` LANDING VIABLE in ${nViable} of ${honey.results.length} cells`))
              : (kid ? (es ? " Aquí no se puede. ¡Prueba otro punto u otro día!" : " Not here. Try another point or day!") : (es ? " Aquí no hay celdas viables. Prueba otro punto u otra fecha." : " No viable cells here. Try another point or date."))}
          </div>
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
                    {r.metrics.viability === "VIABLE" && <span className="rounded bg-[#7fb39a] px-1 text-[10px] font-extrabold text-black"> VIABLE</span>}
                    <span className="text-[#dcc08f]"><Stars value={r.aptitude} size="text-xs" /></span>
                    <span className="flex-1 text-slate-300">
                      {dist < 0.01 ? (es ? "punto elegido" : "chosen point") : `${dist.toFixed(1)} km ${es ? "al" : "to"} ${dirOf(r.cell.northKm, r.cell.eastKm)}`}
                      {!kid && <span className="ml-1 text-slate-500">Sol {r.metrics.sunlightPct}% Tierra {r.metrics.dtePct}%</span>}
                    </span>
                  </button>
                  <button type="button" disabled={moving || !!busy} onClick={() => void goHere(r.lat, r.lon, `${dist < 0.01 ? (es ? "el punto elegido" : "the chosen point") : `${dist.toFixed(1)} km ${dirOf(r.cell.northKm, r.cell.eastKm)}`}`)} className="rounded-full px-2.5 py-0.5 font-bold text-black transition hover:scale-105 disabled:opacity-50" style={{ background: SCENARIO_COLORS[activeLabel] }}>
                    {kid ? (es ? "¡Ir aquí!" : "Go here!") : `${es ? "Usar" : "Use"} → ${activeLabel}`}
                  </button>
                </li>
              );
            })}
          </ul>
          {moving && <p className="text-xs text-[#dcc08f]">{es ? "Moviendo la nave y recalculando el panal…" : "Moving the lander and recalculating the panel…"}</p>}
          {moved && <p role="status" className="rounded bg-[#7fb39a]/15 px-2 py-1 text-xs text-[#a6cdb8]">{moved}</p>}
          {sel && (
            <div className="rounded border border-slate-600 p-2 text-xs text-slate-300">
              <p className="font-semibold text-slate-100">{es ? "Celda seleccionada" : "Selected cell"}: {sel.aptitude}% · {sel.lat.toFixed(4)}°, {sel.lon.toFixed(3)}°</p>
              <p>Sol {sel.metrics.sunlightPct}% · Tierra {sel.metrics.dtePct}% · ✦ {sel.metrics.goldenPct}% ·  {sel.metrics.minSocPct.toFixed(0)}%</p>
              <p className="text-slate-400">{sel.metrics.viabilityReason}</p>
              <button type="button" disabled={moving || !!busy} onClick={() => void goHere(sel.lat, sel.lon, es ? "la celda elegida" : "the selected cell")} className="mt-1 rounded px-2 py-0.5 font-semibold text-black" style={{ background: SCENARIO_COLORS[activeLabel] }}>
                {es ? "Mover escenario" : "Move scenario"} {activeLabel} {es ? "aquí" : "here"}
              </button>
            </div>
          )}
        </>
      )}
      {!honey && !busy && !err && (
        <p className="text-xs text-slate-500">{es ? " Aún no has explorado. Toca la Luna cerca del polo sur (la parte de abajo)." : " Nothing explored yet. Tap the Moon near the south pole (the bottom part)."}</p>
      )}
    </section>
  );
}

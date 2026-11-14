"use client";
// Selección de coordenadas con metodología de panal de abeja (retícula hexagonal).
import { useMemo, useState } from "react";
import { Hexagon, Loader2 } from "lucide-react";
import { effectiveStart, useMissionStore } from "@/store/useMissionStore";
import { useUiStore } from "@/store/useUiStore";
import { computeHoneycomb, honeyScore, honeyValue, type HoneyMetric, type HoneyResult } from "@/lib/honeycomb";
import { SCENARIO_COLORS, SCENARIO_LABELS } from "@/lib/types";
import { useT } from "@/lib/i18n";

const SQ3 = Math.sqrt(3);

function colorFor(v: number, metric: HoneyMetric) {
  const t = Math.max(0, Math.min(1, v / 100));
  // rojo -> ámbar -> verde (perceptualmente ordenado, distinguible en daltonismo por luminancia)
  const stops = metric === "dte" ? ["#3b0764", "#6d28d9", "#22d3ee"] : ["#7f1d1d", "#d97706", "#22c55e"];
  const [a, b] = t < 0.5 ? [stops[0], stops[1]] : [stops[1], stops[2]];
  const k = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
  return `rgb(${Math.round(r1 + (r2 - r1) * k)},${Math.round(g1 + (g2 - g1) * k)},${Math.round(b1 + (b2 - b1) * k)})`;
}

export default function HoneycombPanel() {
  const t = useT();
  const activeLabel = useMissionStore((s) => s.activeLabel);
  const scenarios = useMissionStore((s) => s.scenarios);
  const missionHours = useMissionStore((s) => s.missionHours);
  const power = useMissionStore((s) => s.power);
  const { setCustomCoords, addScenario } = useMissionStore.getState();
  const honey = useUiStore((s) => s.honey);
  const setHoney = useUiStore((s) => s.setHoney);
  const [spacing, setSpacing] = useState(1);
  const [rings, setRings] = useState(3);
  const [metric, setMetric] = useState<HoneyMetric>("golden");
  const [busy, setBusy] = useState<[number, number] | null>(null);
  const [sel, setSel] = useState<HoneyResult | null>(null);
  const center = scenarios.find((s) => s.label === activeLabel) ?? scenarios[0];

  const run = async () => {
    if (!center?.timeline.length) return;
    setBusy([0, 1]);
    setSel(null);
    const results = await computeHoneycomb({
      center: { lat: center.lat, lon: center.lon }, timeline: center.timeline, startUtc: effectiveStart(center),
      rings, spacingKm: spacing, missionHours, power, panel: center.panelType, region: center.region,
      onProgress: (d, n) => setBusy([d, n]),
    });
    setHoney({ center: center.label, spacingKm: spacing, results });
    setBusy(null);
  };

  const results = useMemo(() => honey?.results ?? [], [honey]);
  const best = useMemo(() => results.reduce<HoneyResult | null>((b, r) => (!b || honeyScore(r) > honeyScore(b) ? r : b), null), [results]);
  const S = 26; // radio del hexágono en px
  const R = Math.max(1, ...results.map((r) => r.cell.ring));
  const size = (2 * R + 1) * S * SQ3 + S * 2;

  const assign = async (label: string) => {
    if (!sel) return;
    let target = label;
    if (label === "new") target = addScenario() ?? "";
    if (!target) return;
    const name = `Panal ${honey?.center}${sel.cell.ring ? ` · ${sel.cell.northKm.toFixed(1)}N ${sel.cell.eastKm.toFixed(1)}E km` : " · centro"}`;
    await setCustomCoords(target as never, sel.lat, sel.lon, name);
  };

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-3 text-sm" id="tour-honeycomb">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-1 font-semibold text-slate-200"><Hexagon className="h-4 w-4 text-amber-400" aria-hidden /> {t("honeyTitle")}</h2>
        <span className="text-xs text-slate-400">· centro: <b style={{ color: SCENARIO_COLORS[center.label] }}>{center.label}</b> {center.siteName}</span>
      </div>
      <p className="mb-2 text-xs text-slate-400">{t("honeyHelp")}</p>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <label>{t("spacing")}{" "}
          <select className="rounded bg-slate-800 px-1 py-0.5" value={spacing} onChange={(e) => setSpacing(Number(e.target.value))}>
            {[0.5, 1, 2, 5].map((s) => <option key={s} value={s}>{s} km</option>)}
          </select>
        </label>
        <label>{t("rings")}{" "}
          <select className="rounded bg-slate-800 px-1 py-0.5" value={rings} onChange={(e) => setRings(Number(e.target.value))}>
            {[2, 3, 4].map((r) => <option key={r} value={r}>{r} ({1 + 3 * r * (r + 1)} celdas)</option>)}
          </select>
        </label>
        <label>{t("metric")}{" "}
          <select className="rounded bg-slate-800 px-1 py-0.5" value={metric} onChange={(e) => setMetric(e.target.value as HoneyMetric)}>
            <option value="golden">{t("golden")} %</option>
            <option value="sun">{t("sunlight")} %</option>
            <option value="dte">DTE %</option>
            <option value="minSoc">{t("minSoc")} %</option>
          </select>
        </label>
        <button onClick={run} disabled={!!busy} className="flex items-center gap-1 rounded bg-amber-600 px-3 py-1 font-semibold text-black hover:bg-amber-500 disabled:opacity-60">
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Hexagon className="h-3 w-3" />} {busy ? `${busy[0]}/${busy[1]}` : t("compute")}
        </button>
        {best && (
          <span className="text-xs text-emerald-300">
            Mejor celda: anillo {best.cell.ring} · {best.metrics.goldenPct}% dorada · {best.metrics.sunlightPct}% Sol · {best.metrics.viability === "VIABLE" ? "viable" : best.metrics.viability === "RELAY_REQUIRED" ? "relé" : "riesgo"}
          </span>
        )}
      </div>

      {results.length > 0 && (
        <div className="flex flex-wrap items-start gap-4">
          <svg viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} className="h-auto w-full max-w-[460px]" role="img" aria-label="Panal de abeja de coordenadas">
            {results.map((r) => {
              const cx = S * SQ3 * (r.cell.q + r.cell.r / 2);
              const cy = -S * 1.5 * r.cell.r;
              const pts = Array.from({ length: 6 }, (_, k) => {
                const a = (Math.PI / 180) * (60 * k - 30);
                return `${(cx + (S - 1.5) * Math.cos(a)).toFixed(1)},${(cy + (S - 1.5) * Math.sin(a)).toFixed(1)}`;
              }).join(" ");
              const v = honeyValue(r, metric);
              const isBest = r === best, isSel = r === sel;
              return (
                <g key={`${r.cell.q},${r.cell.r}`} onClick={() => setSel(r)} className="cursor-pointer" role="button" aria-label={`Celda ${r.cell.q},${r.cell.r}: ${v}%`}>
                  <polygon points={pts} fill={colorFor(v, metric)} stroke={isSel ? "#fff" : isBest ? "#fde047" : "#0f172a"} strokeWidth={isSel || isBest ? 3 : 1.5} />
                  <text x={cx} y={cy + 4} textAnchor="middle" fontSize={11} fill="#fff" fontWeight={600} pointerEvents="none">{v.toFixed(0)}</text>
                  {r.cell.ring === 0 && <text x={cx} y={cy - 9} textAnchor="middle" fontSize={8} fill="#fff" pointerEvents="none">●</text>}
                  {r.metrics.viability === "CRITICAL_FREEZE_RISK" && <text x={cx} y={cy + 15} textAnchor="middle" fontSize={8} fill="#fecaca" pointerEvents="none">✕</text>}
                </g>
              );
            })}
            <text x={0} y={-size / 2 + 12} textAnchor="middle" fontSize={10} fill="#94a3b8">N ↑ · separación {honey?.spacingKm} km</text>
          </svg>
          <div className="min-w-[220px] flex-1 text-xs text-slate-300">
            {sel ? (
              <>
                <p className="font-semibold text-slate-100">Celda anillo {sel.cell.ring} · {sel.cell.northKm.toFixed(2)} km N, {sel.cell.eastKm.toFixed(2)} km E</p>
                <p>{sel.lat.toFixed(4)}°, {sel.lon.toFixed(3)}° · horizonte máx {sel.horizonMaxDeg.toFixed(2)}°</p>
                <ul className="my-2 grid grid-cols-2 gap-1">
                  <li>☀ Sol {sel.metrics.sunlightPct}%</li>
                  <li>🌍 DTE {sel.metrics.dtePct}% ({sel.metrics.dteDegradedPct}% multipath)</li>
                  <li>✦ Dorada {sel.metrics.goldenPct}%</li>
                  <li>🔋 SoC mín {sel.metrics.minSocPct.toFixed(0)}%</li>
                  <li>🌡 {sel.metrics.tempMinC}…{sel.metrics.tempMaxC} °C</li>
                  <li>⏱ Sombra máx {sel.metrics.longestShadowH} h</li>
                </ul>
                <p className="mb-2 text-slate-400">{sel.metrics.viabilityReason}</p>
                <div className="flex flex-wrap gap-1">
                  <span className="self-center">{t("assignTo")}:</span>
                  {SCENARIO_LABELS.filter((l) => scenarios.some((s) => s.label === l)).map((l) => (
                    <button key={l} onClick={() => assign(l)} className="rounded px-2 py-1 font-semibold text-black" style={{ background: SCENARIO_COLORS[l] }}>{l}</button>
                  ))}
                  {scenarios.length < 4 && <button onClick={() => assign("new")} className="rounded bg-slate-700 px-2 py-1">+ nuevo</button>}
                </div>
              </>
            ) : (
              <p className="text-slate-400">Haz clic en una celda para ver su detalle y asignarla a un escenario. Borde amarillo = mejor celda; ✕ = riesgo de congelamiento.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

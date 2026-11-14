"use client";
// Días lunares y estaciones: mapa de calor (fila = escenario/sitio, columna = día de alunizaje, 12 meses)
// y resumen por lunación. Clic en una celda = usar esa fecha.
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarRange } from "lucide-react";
import { effectiveStart, useMissionStore } from "@/store/useMissionStore";
import { SCENARIO_COLORS } from "@/lib/types";
import { buildRow, type SeasonRow } from "@/lib/seasons";
import { useT } from "@/lib/i18n";

type Metric = "golden" | "sun" | "dte" | "status";
const CELL_H = 18;

function cellColor(st: SeasonRow["days"][number], m: Metric) {
  if (!st) return "#0b1220";
  if (m === "status") return st.status === 0 ? "#16a34a" : st.status === 1 ? "#d97706" : "#991b1b";
  const v = m === "golden" ? st.goldenPct : m === "sun" ? st.sunPct : st.dtePct;
  const t = v / 100;
  const hue = m === "dte" ? 190 : 40 + 100 * t; // ámbar->verde (Sol/dorada) o cian (DTE)
  return `hsl(${hue} ${m === "dte" ? 80 : 75}% ${8 + t * 42}%)`;
}

export default function SeasonsHeatmap() {
  const t = useT();
  const dataset = useMissionStore((s) => s.dataset);
  const scenarios = useMissionStore((s) => s.scenarios);
  const missionHours = useMissionStore((s) => s.missionHours);
  const power = useMissionStore((s) => s.power);
  const activeLabel = useMissionStore((s) => s.activeLabel);
  const { getYearEphem, setBaseDate, setDelay, setSite } = useMissionStore.getState();
  const [metric, setMetric] = useState<Metric>("status");
  const [allSites, setAllSites] = useState(false);
  const [hover, setHover] = useState<{ row: SeasonRow; day: number; x: number; y: number } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  const rows = useMemo<SeasonRow[]>(() => {
    if (!dataset) return [];
    const out: SeasonRow[] = [];
    for (const sc of scenarios) {
      const e = getYearEphem(sc.label);
      if (!e || !sc.horizonProfileDeg.length) continue;
      out.push({ key: sc.label, label: `${sc.label} · ${sc.siteName}`, color: SCENARIO_COLORS[sc.label], scenarioLabel: sc.label,
        ...buildRow(`${sc.label}:${sc.lat},${sc.lon}`, e, sc.horizonProfileDeg, sc.panelType, power, missionHours) });
    }
    if (allSites) {
      for (const s of dataset.sites) {
        const e = useMissionStore.getState().ephem[s.id];
        out.push({ key: s.id, label: s.name, color: "#94a3b8", siteId: s.id, ...buildRow(s.id, e, s.horizonProfileDeg, s.panelType, power, missionHours) });
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset, scenarios, power, missionHours, allSites]);

  const nDays = rows[0]?.days.length ?? 0;
  const t0 = dataset ? new Date(dataset.startUtc).getTime() : 0;

  useEffect(() => {
    const c = canvas.current;
    if (!c || !rows.length) return;
    c.width = nDays * 3;
    c.height = rows.length * CELL_H;
    const ctx = c.getContext("2d")!;
    rows.forEach((r, ri) => {
      r.days.forEach((d, di) => {
        ctx.fillStyle = cellColor(d, metric);
        ctx.fillRect(di * 3, ri * CELL_H, 3, CELL_H - 2);
      });
    });
    // Fecha efectiva de cada escenario
    for (const sc of scenarios) {
      const d = Math.floor((new Date(effectiveStart(sc)).getTime() - t0) / 86400_000);
      const ri = rows.findIndex((r) => r.scenarioLabel === sc.label);
      if (d < 0 || d >= nDays || ri < 0) continue;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(d * 3, ri * CELL_H, 3, CELL_H - 2);
    }
  }, [rows, metric, nDays, scenarios, t0]);

  const onPick = (e: React.MouseEvent<HTMLCanvasElement>, click: boolean) => {
    const c = canvas.current!;
    const rect = c.getBoundingClientRect();
    const day = Math.floor(((e.clientX - rect.left) / rect.width) * nDays);
    const ri = Math.floor(((e.clientY - rect.top) / rect.height) * rows.length);
    const row = rows[ri];
    if (!row || day < 0 || day >= nDays) return setHover(null);
    if (!click) return setHover({ row, day, x: e.clientX - rect.left, y: e.clientY - rect.top });
    const iso = new Date(t0 + day * 86400_000).toISOString();
    const label = (row.scenarioLabel ?? activeLabel) as never;
    if (row.siteId) void setSite(label, row.siteId);
    void setDelay(label, 0).then(() => setBaseDate(label, iso));
  };

  const months = useMemo(() => {
    const out: { x: number; label: string }[] = [];
    for (let d = 0; d < nDays; d++) {
      const dt = new Date(t0 + d * 86400_000);
      if (dt.getUTCDate() === 1) out.push({ x: d / nDays, label: dt.toLocaleString("es", { month: "short", timeZone: "UTC" }) + (dt.getUTCMonth() === 0 ? ` ${dt.getUTCFullYear()}` : "") });
    }
    return out;
  }, [nDays, t0]);

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-3 text-sm" id="tour-seasons">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-1 font-semibold text-slate-200"><CalendarRange className="h-4 w-4 text-sky-400" aria-hidden /> {t("seasonsTitle")}</h2>
        <select className="rounded bg-slate-800 px-1 py-0.5 text-xs" value={metric} onChange={(e) => setMetric(e.target.value as Metric)} aria-label={t("metric")}>
          <option value="status">Semáforo de viabilidad</option>
          <option value="golden">{t("golden")} %</option>
          <option value="sun">{t("sunlight")} %</option>
          <option value="dte">DTE %</option>
        </select>
        <label className="text-xs"><input type="checkbox" checked={allSites} onChange={(e) => setAllSites(e.target.checked)} /> {t("allSites")}</label>
        <span className="text-[11px] text-slate-400">{t("seasonsHelp")} Misión: {missionHours} h · ▮ blanco = fecha actual</span>
      </div>
      <div className="flex gap-2">
        <div className="flex w-44 shrink-0 flex-col pt-4 text-[11px] text-slate-300">
          {rows.map((r) => (
            <div key={r.key} style={{ height: CELL_H, color: r.color }} className="truncate leading-[16px]" title={r.label}>{r.label}</div>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="relative h-4 text-[10px] text-slate-500">
            {months.map((m) => <span key={m.label + m.x} className="absolute" style={{ left: `${m.x * 100}%` }}>{m.label}</span>)}
          </div>
          <canvas ref={canvas} className="h-auto w-full cursor-crosshair" style={{ height: rows.length * CELL_H, imageRendering: "pixelated" }}
            onMouseMove={(e) => onPick(e, false)} onMouseLeave={() => setHover(null)} onClick={(e) => onPick(e, true)} role="img" aria-label="Mapa de calor sitio por fecha" />
          {hover && hover.row.days[hover.day] && (
            <div className="pointer-events-none absolute z-10 rounded bg-slate-950/95 px-2 py-1 text-[11px] text-slate-200 shadow" style={{ left: Math.min(hover.x + 10, 600), top: hover.y + 20 }}>
              <b>{hover.row.label}</b> · {new Date(t0 + hover.day * 86400_000).toISOString().slice(0, 10)}<br />
              ☀ {hover.row.days[hover.day]!.sunPct}% · 🌍 {hover.row.days[hover.day]!.dtePct}% · ✦ {hover.row.days[hover.day]!.goldenPct}% ·{" "}
              {["viable", "requiere relé", "riesgo de congelamiento"][hover.row.days[hover.day]!.status]}
            </div>
          )}
        </div>
      </div>
      {rows.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[11px] text-slate-300">
            <caption className="mb-1 text-left text-slate-400">Por lunación (≈29,5 d): % de horas con Sol / con Tierra — muestra las «estaciones» polares</caption>
            <thead>
              <tr><th className="text-left font-normal text-slate-500">Fila</th>{rows[0].lunations.map((_, i) => <th key={i} className="font-normal text-slate-500">L{i + 1}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="truncate pr-2" style={{ color: r.color, maxWidth: 160 }}>{r.label}</td>
                  {r.lunations.map((l, i) => (
                    <td key={i} className="px-0.5">
                      <div className="flex h-6 items-end gap-px" title={`☀ ${l.sunPct}% · 🌍 ${l.dtePct}%`}>
                        <div className="w-1.5 bg-amber-400" style={{ height: `${Math.max(2, l.sunPct * 0.24)}px` }} />
                        <div className="w-1.5 bg-cyan-400" style={{ height: `${Math.max(2, l.dtePct * 0.24)}px` }} />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

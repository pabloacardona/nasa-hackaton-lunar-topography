"use client";
// Tarjetas que el copiloto dibuja dentro del chat (UI generativa).
import { useMissionStore } from "@/store/useMissionStore";
import { SCENARIO_COLORS, type ScenarioLabel } from "@/lib/types";

const verdict = { VIABLE: ["Viable", "bg-[#4f8569]"], RELAY_REQUIRED: ["Relé", "bg-[#b8925a] text-black"], CRITICAL_FREEZE_RISK: ["Riesgo", "bg-[#9a5559]"] } as const;

export function ScenarioCompareCard({ labels }: { labels?: string[] }) {
  const scenarios = useMissionStore((s) => s.scenarios);
  const shown = labels?.length ? scenarios.filter((s) => labels.includes(s.label)) : scenarios;
  return (
    <div className="my-2 rounded-lg border border-slate-600 bg-slate-900 p-2 text-xs text-slate-200">
      <table className="w-full">
        <thead className="text-slate-400"><tr><th className="text-left">Esc.</th><th>Veredicto</th><th>Sol</th><th>DTE</th><th>Dorada</th><th>SoC mín</th></tr></thead>
        <tbody>
          {shown.map((s) => (
            <tr key={s.label}>
              <td style={{ color: SCENARIO_COLORS[s.label] }}>{s.label} · {s.siteName.slice(0, 22)}{s.delayDays ? ` (+${s.delayDays}d)` : ""}</td>
              <td className="text-center">{s.metrics && <span className={`rounded px-1 ${verdict[s.metrics.viability][1]}`}>{verdict[s.metrics.viability][0]}</span>}</td>
              <td className="text-center">{s.metrics?.sunlightPct}%</td>
              <td className="text-center">{s.metrics?.dtePct}%</td>
              <td className="text-center">{s.metrics?.goldenPct}%</td>
              <td className="text-center">{s.metrics?.minSocPct.toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WindowsCard({ label, windows }: { label: string; windows: { landingUtc: string; goldenPct: number; sunPct: number; dtePct: number; status: number }[] }) {
  const setBaseDate = useMissionStore((s) => s.setBaseDate);
  const setDelay = useMissionStore((s) => s.setDelay);
  return (
    <div className="my-2 rounded-lg border border-slate-600 bg-slate-900 p-2 text-xs text-slate-200">
      <div className="mb-1 text-slate-400">Mejores ventanas para {label} (clic para aplicar)</div>
      {windows.map((w, i) => (
        <button key={w.landingUtc} onClick={async () => { await setDelay(label as ScenarioLabel, 0); await setBaseDate(label as ScenarioLabel, w.landingUtc); }}
          className="mb-1 flex w-full items-center justify-between rounded bg-slate-800 px-2 py-1 text-left hover:bg-slate-700">
          <span>#{i + 1} {w.landingUtc.slice(0, 16).replace("T", " ")} UTC</span>
          <span>✦ {w.goldenPct}% · Sol {w.sunPct}% · Tierra {w.dtePct}% · {["Viable", "Con relé", "Riesgo"][w.status]}</span>
        </button>
      ))}
    </div>
  );
}

export function ApprovalCard({ text, onApprove, onReject, done }: { text: string; onApprove?: () => void; onReject?: () => void; done?: string }) {
  return (
    <div className="my-2 rounded-lg border border-[#b8925a] bg-slate-900 p-2 text-xs text-slate-200">
      <p className="mb-2">{text}</p>
      {done ? (
        <p className="text-slate-400">{done}</p>
      ) : (
        <div className="flex gap-2">
          <button onClick={onApprove} className="rounded bg-[#4f8569] px-3 py-1 font-semibold">Aprobar</button>
          <button onClick={onReject} className="rounded bg-slate-700 px-3 py-1">Rechazar</button>
        </div>
      )}
    </div>
  );
}

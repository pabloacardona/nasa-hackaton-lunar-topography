"use client";
// Interruptor de dos estados con etiquetas a cada lado (accesible: role="switch").
export default function Switch({ checked, onChange, left, right, label }: { checked: boolean; onChange: (v: boolean) => void; left: string; right: string; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} title={label} onClick={() => onChange(!checked)}
      className="flex items-center gap-2 rounded-full border border-[#7dd3fc]/30 bg-slate-950/70 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide">
      <span className={checked ? "text-slate-500" : "text-[#e0f2fe]"}>{left}</span>
      <span className="relative h-5 w-10 rounded-full transition-colors" style={{ background: checked ? "#4f7396" : "#1e293b", boxShadow: checked ? "0 0 10px rgba(125,211,252,0.35)" : "none" }} aria-hidden>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </span>
      <span className={checked ? "text-[#e0f2fe]" : "text-slate-500"}>{right}</span>
    </button>
  );
}

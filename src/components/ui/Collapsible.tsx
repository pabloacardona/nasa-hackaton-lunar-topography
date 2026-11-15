"use client";
// Sección desplegable. El contenido solo se monta cuando está abierta (menos trabajo para el navegador).
import { ChevronDown } from "lucide-react";
import { useUiStore } from "@/store/useUiStore";

export default function Collapsible({ id, title, emoji, tint = "#5f8fb8", summary, children }: { id: string; title: string; emoji?: string; tint?: string; summary?: React.ReactNode; children: React.ReactNode }) {
  const open = useUiStore((s) => !!s.sections[id]);
  const toggle = useUiStore((s) => s.toggleSection);
  return (
    <section id={id} className="card overflow-hidden" style={open ? { borderColor: tint + "99" } : undefined}>
      <h3>
        <button onClick={() => toggle(id)} aria-expanded={open} aria-controls={`${id}-body`}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-800/60">
          {emoji && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg" style={{ background: tint + "33" }} aria-hidden>{emoji}</span>}
          <span className="font-display text-base font-bold leading-tight text-slate-100">{title}</span>
          {summary && <span className="ml-1 flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-xs text-slate-400">{summary}</span>}
          <span className="ml-auto flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold text-slate-900" style={{ background: tint }}>
            {open ? "−" : "+"} <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
          </span>
        </button>
      </h3>
      {open && <div id={`${id}-body`} data-collapsible-body className="pop border-t border-slate-800 p-2">{children}</div>}
    </section>
  );
}

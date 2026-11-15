"use client";
// Ayuda flotante accesible: aparece al pasar el mouse o con el teclado (foco).
// Se pinta en un portal con posición fija para que nunca la recorten los paneles.
import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { GLOSSARY, type GlossaryKey } from "@/lib/glossary";
import { useMissionStore } from "@/store/useMissionStore";

export default function InfoTip({ k, children, icon = true, className = "" }: { k: GlossaryKey; children?: React.ReactNode; icon?: boolean; className?: string }) {
  const lang = useMissionStore((s) => s.lang);
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; below: boolean } | null>(null);
  const id = useId();
  const e = GLOSSARY[k];
  const i = lang === "es" ? 0 : 1;
  const L = lang === "es" ? ["Qué es", "Cómo se calcula", "Para qué sirve", "Cómo usarlo"] : ["What it is", "How it is computed", "Why it matters", "How to use it"];

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const below = r.top < 260;
    setPos({ x: Math.min(Math.max(8, r.left + r.width / 2 - 170), window.innerWidth - 348), y: below ? r.bottom + 8 : r.top - 8, below });
  };

  return (
    <span
      ref={ref}
      tabIndex={0}
      aria-describedby={pos ? id : undefined}
      onMouseEnter={show}
      onMouseLeave={() => setPos(null)}
      onFocus={show}
      onBlur={() => setPos(null)}
      className={`inline-flex cursor-help items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 ${className}`}
    >
      {children}
      {icon && <Info className="h-3 w-3 shrink-0 text-slate-500" aria-hidden />}
      {pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            className="pointer-events-none fixed z-[100] w-[340px] rounded-lg border border-sky-700 bg-slate-950/97 p-3 text-left text-xs normal-case leading-relaxed text-slate-200 shadow-2xl"
            style={{ left: pos.x, top: pos.y, transform: pos.below ? undefined : "translateY(-100%)" }}
          >
            <div className="mb-1 text-sm font-semibold text-sky-300">{e.title[i]}</div>
            {[e.what, e.how, e.why, e.use].map((t, j) => (
              <p key={j} className="mb-1">
                <span className="font-semibold text-slate-400">{L[j]}: </span>
                {t[i]}
              </p>
            ))}
          </div>,
          document.body
        )}
    </span>
  );
}

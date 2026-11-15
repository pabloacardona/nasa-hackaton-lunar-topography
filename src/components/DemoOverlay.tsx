"use client";
// Capa de grabación de la demo: subtítulos grandes y un puntero virtual que se mueve
// hasta cada control y hace clic. Solo se ve mientras la demo está corriendo.
import { useEffect, useState } from "react";
import { useUiStore } from "@/store/useUiStore";

export default function DemoOverlay() {
  const running = useUiStore((s) => s.demoRunning);
  const caption = useUiStore((s) => s.demoCaption);
  const cursor = useUiStore((s) => s.demoCursor);
  const [ripple, setRipple] = useState(0);

  useEffect(() => { if (cursor) setRipple(cursor.click); }, [cursor]);
  if (!running) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[80]">
      {caption && (
        <div className="absolute left-1/2 top-[68px] w-[min(960px,92vw)] -translate-x-1/2 rounded-2xl border border-[#6f93b5]/60 bg-slate-950/90 px-5 py-3 text-center text-lg font-semibold leading-snug text-slate-100 shadow-2xl backdrop-blur">
          {caption}
        </div>
      )}
      {cursor && (
        <div className="absolute" style={{ left: cursor.x, top: cursor.y, transition: "left 0.9s cubic-bezier(.4,.1,.2,1), top 0.9s cubic-bezier(.4,.1,.2,1)" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" className="-translate-x-1 -translate-y-1 drop-shadow-lg"><path d="M3 2l15 9-6.5 1.6L15 20l-3 1.4-3.2-7.2L3 18z" fill="#f1f5f9" stroke="#0f172a" strokeWidth="1.2" /></svg>
          <span key={ripple} className="absolute -left-4 -top-4 h-8 w-8 animate-ping rounded-full bg-[#c9a66b]/60" />
        </div>
      )}
    </div>
  );
}

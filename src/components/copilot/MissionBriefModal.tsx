"use client";
import { Copy, Download, X } from "lucide-react";
import { useUiStore } from "@/store/useUiStore";

export default function MissionBriefModal() {
  const open = useUiStore((s) => s.briefOpen);
  const text = useUiStore((s) => s.briefText);
  const close = useUiStore((s) => s.closeBrief);
  if (!open) return null;
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
    a.download = `informe-mision-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="brief-title" className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={close}>
      <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-xl border border-slate-600 bg-slate-950 p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <h2 id="brief-title" className="font-semibold text-slate-100">Informe de misión</h2>
          <div className="flex gap-2">
            <button onClick={() => navigator.clipboard.writeText(text)} className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-xs"><Copy className="h-3 w-3" /> Copiar</button>
            <button onClick={download} className="flex items-center gap-1 rounded bg-sky-700 px-2 py-1 text-xs"><Download className="h-3 w-3" /> .md</button>
            <button onClick={close} aria-label="Cerrar" className="rounded bg-slate-800 p-1"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <pre className="whitespace-pre-wrap text-xs leading-relaxed text-slate-200">{text}</pre>
      </div>
    </div>
  );
}

"use client";
import { useMissionStore } from "@/store/useMissionStore";

const facts = [
  { t: "Sin atmósfera = sin crepúsculo", d: "En la Luna no hay aire que disperse la luz. Si una montaña tapa el Sol, la oscuridad es total e instantánea." },
  { t: "El Sol gira al ras en el Polo Sur", d: "El eje lunar solo se inclina 1.54°. En el polo el Sol nunca sube más de unos pocos grados y da la vuelta completa al horizonte en ~29.5 días." },
  { t: "La Tierra casi no se mueve", d: "La Luna siempre muestra la misma cara. La Tierra solo 'bambolea' unos ±7° (libración); en el polo ese bamboleo la esconde tras los cráteres." },
  { t: "Paneles verticales vs. horizontales", d: "Con el Sol bajo, los landers polares usan paneles verticales (∝ cos α). En el ecuador (Apolo) son horizontales (∝ sin α)." },
  { t: "La racha importa más que el %", d: "Un lander sin batería nuclear muere si la sombra dura más que su batería. 10 días seguidos de Sol valen más que 20 días cortados." },
];

export default function EducatorOverlay() {
  const mode = useMissionStore((s) => s.audienceMode);
  if (mode !== "educator") return null;
  return (
    <section className="grid grid-cols-1 gap-2 md:grid-cols-5">
      {facts.map((f) => (
        <div key={f.t} className="rounded-lg border border-sky-800 bg-sky-950/40 p-2 text-xs">
          <div className="font-semibold text-sky-200">{f.t}</div>
          <div className="text-slate-300">{f.d}</div>
        </div>
      ))}
    </section>
  );
}

"use client";
// «¿Sabías que…?»: un dato curioso a la vez (modo Explorador). Cambia solo o con el botón.
import { useEffect, useState } from "react";
import { Lightbulb } from "lucide-react";
import { useMissionStore } from "@/store/useMissionStore";

const FACTS: [string, string, string][] = [
  ["", "En la Luna no hay aire. Por eso no existe el atardecer: el Sol se apaga de golpe cuando una montaña lo tapa.", "The Moon has no air, so there is no twilight: the Sun switches off the instant a mountain hides it."],
  ["", "En el polo sur hay cráteres donde NUNCA llega el Sol. Allí puede haber hielo de agua, ¡por eso queremos ir!", "At the south pole some craters NEVER see the Sun. They may hold water ice — that is why we want to go!"],
  ["", "En el polo sur el Sol nunca sube: da vueltas pegado al horizonte, como una linterna rodando por el suelo.", "At the south pole the Sun never climbs: it circles hugging the horizon, like a torch rolling on the floor."],
  ["", "Una noche en la Luna dura unas 2 semanas y llega a −180 °C. Sin Sol, la nave depende solo de su batería.", "A lunar night lasts about 2 weeks and drops to −180 °C. Without the Sun the lander relies on its battery."],
  ["", "Desde la Luna la Tierra casi no se mueve en el cielo: solo se balancea un poquito. Si una montaña la tapa, no hay llamada a casa.", "From the Moon, Earth barely moves in the sky: it only wobbles a little. If a mountain hides it, no call home."],
  ["", "Moverse solo 1 km puede cambiar todo: de estar a oscuras a tener Sol casi siempre. Por eso probamos muchos puntos con el panal.", "Moving just 1 km can change everything: from darkness to near-constant sunlight. That is why we test many points with the honeycomb."],
];

export default function EducatorOverlay() {
  const mode = useMissionStore((s) => s.audienceMode);
  const es = useMissionStore((s) => s.lang) === "es";
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % FACTS.length), 12000);
    return () => clearInterval(t);
  }, []);
  if (mode !== "educator") return null;
  const f = FACTS[i];
  return (
    <aside className="card flex items-center gap-3 border-[#c9a66b]/60 bg-[#2e2618]/30 px-3 py-2" aria-live="polite">
      <Lightbulb className="h-5 w-5 shrink-0 text-[#dcc08f]" aria-hidden />
      <p className="flex-1 text-sm text-amber-50"><b className="font-display text-[#dcc08f]">{es ? "¿Sabías que…? " : "Did you know…? "}</b>{es ? f[1] : f[2]}</p>
      <button type="button" onClick={() => setI((x) => (x + 1) % FACTS.length)} className="btn-fun shrink-0">{es ? "Otro dato" : "Another fact"} <span aria-hidden>➜</span></button>
    </aside>
  );
}

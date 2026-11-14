// Informe de misión (Markdown) generado a partir del estado actual: listo para el pitch o para el equipo.
import { effectiveStart, useMissionStore } from "@/store/useMissionStore";
import { useUiStore } from "@/store/useUiStore";
import { honeyScore } from "./honeycomb";
import type { Scenario } from "./types";

const rank = (s: Scenario) =>
  (s.metrics?.viability === "VIABLE" ? 200 : s.metrics?.viability === "RELAY_REQUIRED" ? 100 : 0) + (s.metrics?.goldenPct ?? 0) + (s.metrics?.minSocPct ?? 0) * 0.3;

export function generateMissionBrief(): string {
  const st = useMissionStore.getState();
  const honey = useUiStore.getState().honey;
  const ok = st.scenarios.filter((s) => s.metrics);
  const best = [...ok].sort((a, b) => rank(b) - rank(a))[0];
  const L: string[] = [];
  L.push(`# Informe de misión lunar — ${new Date().toISOString().slice(0, 10)}`);
  L.push("");
  L.push(`**Perfil:** ${st.missionHours} h en superficie · batería ${st.power.batteryHours} h a ${st.power.loadW} W · panel ${st.power.panelAreaM2} m² (${Math.round(st.power.panelEfficiency * 100)}%).`);
  L.push("");
  L.push("## Escenarios evaluados");
  L.push("");
  L.push("| Esc. | Sitio | Alunizaje (UTC) | Veredicto | Sol | DTE | Dorada | SoC mín | Sombra máx | Temp. |");
  L.push("|---|---|---|---|---|---|---|---|---|---|");
  for (const s of ok) {
    const m = s.metrics!;
    L.push(`| ${s.label} | ${s.siteName} (${s.lat.toFixed(3)}°, ${s.lon.toFixed(2)}°) | ${effectiveStart(s).slice(0, 16).replace("T", " ")}${s.delayDays ? ` (+${s.delayDays} d)` : ""} | ${m.viability} | ${m.sunlightPct}% | ${m.dtePct}% | ${m.goldenPct}% | ${m.minSocPct.toFixed(0)}% | ${m.longestShadowH} h | ${m.tempMinC}…${m.tempMaxC} °C |`);
  }
  L.push("");
  L.push("## Riesgos");
  for (const s of ok) L.push(`- **${s.label}:** ${s.metrics!.viabilityReason}${s.metrics!.dteDegradedPct ? ` DTE degradado (multipath) ${s.metrics!.dteDegradedPct}% del tiempo.` : ""}`);
  L.push("");
  if (best) {
    L.push("## Recomendación");
    L.push(`Escenario **${best.label} — ${best.siteName}**, alunizando el ${effectiveStart(best).slice(0, 16).replace("T", " ")} UTC: ${best.metrics!.goldenPct}% de ventana dorada, ${best.metrics!.sunlightFromLandingH} h de Sol continuo desde el alunizaje y SoC mínimo ${best.metrics!.minSocPct.toFixed(0)}%.`);
    L.push("");
  }
  if (honey?.results.length) {
    const h = [...honey.results].sort((a, b) => honeyScore(b) - honeyScore(a))[0];
    L.push("## Análisis de puntos cercanos (panal de abeja)");
    L.push(`Alrededor de ${honey.center} (${honey.results.length} celdas, separación ${honey.spacingKm} km): mejor celda en ${h.lat.toFixed(4)}°, ${h.lon.toFixed(3)}° (${h.cell.northKm.toFixed(1)} km N, ${h.cell.eastKm.toFixed(1)} km E) con ${h.metrics.goldenPct}% de ventana dorada y ${h.metrics.sunlightPct}% de Sol.`);
    L.push("");
  }
  L.push("## Datos y método");
  L.push("- Efemérides: NASA/JPL Horizons (DE441), observador sobre la Luna (coord@301), sin refracción; caché horaria de 12 meses.");
  L.push("- Horizonte: LOLA LDEM (NASA CGI Moon Kit) 16 px/° en el polo sur, 4 px/° global; curvatura lunar incluida.");
  L.push("- Visible ⇔ elevación del astro > altura del terreno en ese azimut. DTE degradado si la Tierra está < 1° sobre la cresta.");
  L.push("- Batería y temperatura: modelos simplificados (orden de magnitud), no sustituyen el análisis térmico de ingeniería.");
  return L.join("\n");
}

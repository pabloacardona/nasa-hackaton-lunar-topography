# Plan de trabajo — 2 personas + agente

La base ya compila y funciona con datos reales de JPL. El contrato de datos está en `src/lib/types.ts`: **no lo rompan sin avisarse**.

## Persona 1 — Datos NASA, matemática y copiloto

| Prioridad | Tarea | Archivo |
|---|---|---|
| 🔴 1 | Generar **perfiles de horizonte LOLA reales** (360°) para los 9 sitios desde los DEM de PGDA y reemplazar el placeholder sintético | `scripts/lola_horizon_profile.py` → `public/data/curated_sites.json` |
| 🔴 2 | Verificar coordenadas de los sitios del polo sur (Shackleton, Malapert, Nobile, Mons Mouton) con fuentes oficiales | `scripts/generate_nasa_cache.mjs` |
| 🟠 3 | Poner `LLM_API_KEY` y probar las acciones del copiloto por voz | `.env.local`, `MissionVoiceAgent.tsx` |
| 🟠 4 | Endpoint `/api/horizon-profile?lat&lon` para coordenadas personalizadas (hoy se usa horizonte plano) | nuevo |
| 🟢 5 | "Mission Window Finder": recorrer fechas y rankear la mejor hora/fecha de alunizaje por sitio (heatmap) | `lunarMath.ts` |
| 🟢 6 | Zona multipath (Tierra < 1° sobre la cresta = solo telemetría) | `lunarMath.ts` |

## Persona 2 — 3D, interfaz y demo

| Prioridad | Tarea | Archivo |
|---|---|---|
| 🔴 1 | Pulir el horizonte 3D: terreno más realista, modelo del lander, brillo del Sol, rayo DTE choca contra el relieve | `LocalHorizon3D.tsx` |
| 🔴 2 | Textura de la Luna (NASA CGI Moon Kit) + transición de cámara globo → superficie | `LunarGlobe3D.tsx`, `public/textures/` |
| 🟠 3 | Indicadores delta B−A en los KPIs y la cuenta regresiva grande | `MetricsComparison.tsx` |
| 🟠 4 | Botón "Demo guiada" (Mons Mouton +14 d vs Shackleton) | `page.tsx` |
| 🟢 5 | Responsive y accesibilidad (contraste, teclado) | todo |
| 🟢 6 | Deploy en Vercel + video de 3 min | — |

## Guion de la demo (3 min)
"Somos el equipo de una misión CLPS a Mons Mouton. Alunizaje: 15 nov 2026 → **VIABLE** (240 h de Sol y Tierra). El cohete se retrasa 14 días → **RIESGO DE CONGELAMIENTO** (llegamos de noche). Le pedimos al Flight Director por voz que lo compare con otro sitio y en 10 segundos sabemos a dónde cambiar."

## Flujo de trabajo con git
- `main` siempre compila. Cada uno en su rama: `p1/datos`, `p2/3d`.
- PRs pequeños; antes de subir: `npx tsc --noEmit && npm run build`.

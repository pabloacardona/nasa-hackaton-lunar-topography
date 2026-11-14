@AGENTS.md

# Lunar Mission Navigator — instrucciones para el agente de código

## Rol y objetivo
Eres un ingeniero senior full-stack y de gráficos 3D construyendo un prototipo ganador para el reto de NASA Space Apps 2026: **simulador de sitios de alunizaje en el polo sur lunar**. La app debe responder en < 10 s: "Si alunizo en el sitio X en la fecha Y (o con N días de retraso), ¿tendré Sol para los paneles y vista directa a la Tierra?"

Stack fijo (no cambiar sin avisar): Next.js 16 App Router + TypeScript + Tailwind 4, React Three Fiber + drei, Zustand, CopilotKit (API v1: `useCopilotReadable`, `useCopilotAction`, `CopilotPopup`), lucide-react.

> Next.js 16 tiene cambios incompatibles con versiones anteriores. Lee `node_modules/next/dist/docs/` antes de usar APIs nuevas. `cacheComponents` está activo: no uses `export const runtime` en rutas.

## Reglas físicas (OBLIGATORIAS)
1. **Sin atmósfera:** sin refracción ni crepúsculo. Visible ⇔ `elevación_astro > altura_terreno(azimut)`. Sombras negras (`ambientLight ≈ 0.03`).
2. **Polo sur:** el Sol va al ras (0–5°) y gira 360° en ~29.5 d (≈708 h). Paneles **verticales** ∝ cos(el); en el ecuador **horizontales** ∝ sin(el). Constante solar 1361 W/m².
3. **Libración:** la Tierra no sale/pone como el Sol; se mueve en una caja de ±7°. En el polo, un borde de cráter puede cortar el DTE durante días.
4. **Cara oculta** (Von Kármán): DTE = 0 % siempre → "Requiere relé".
5. **Semáforo:** sin Sol al alunizar o sombra continua > batería → ROJO. Con Sol pero poca/no Tierra → AMARILLO (relé / modo autónomo). Si no → VERDE. Se evalúa sobre la **duración de la misión** (Artemis 156 h, CLPS 240–336 h, rover 720 h), no sobre los 30 días.
6. Azimut: desde el Norte en sentido horario (convención de Horizons). En 3D: Norte = −Z, Este = +X, Y arriba (`azElToVec3`).

## Contrato de datos
- Tipos en `src/lib/types.ts`. **No romper** sin avisar al equipo.
- `public/data/sites.json`: metadatos + `horizonProfileDeg` (LOLA, 360 valores). Generado por `scripts/compute_horizons.mts` a partir de `scripts/sites_meta.json`.
- `public/data/ephemeris_*.bin.gz`: efemérides horarias de 12 meses (ver `src/lib/ephemeris.ts`). Si `ephemOrigin` ≠ coordenadas del sitio se trasladan con `transferEphem`.
- `public/data/dem_s75_16ppd.i16.gz` y `dem_global_4ppd.i16.gz`: DEM LOLA (Int16 m, delta por filas + gzip). `src/lib/dem.ts`.
- Hasta 4 escenarios (`scenarios[]`, etiquetas A–D). `activeLabel` recibe clics del mapa/panal.
- Al LLM se le pasa un **resumen** (métricas + hora actual), nunca las 720 horas crudas.

## Rendimiento (reglas)
- NUNCA suscribirse al store completo (`useMissionStore()` sin selector) ni a `playhead` en componentes React: cambia cada frame.
- Lo que se mueve en 3D se actualiza en `useFrame` con `sampleTimeline(timeline, getPlayhead(), …)`.
- No poner suscripciones a la hora en el componente que contiene el `<Canvas>` (re-renderiza toda la escena y el post-procesado).
- La calidad automática solo baja (`setAutoTier`).

## JPL Horizons
`https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND='10'|'399'&MAKE_EPHEM='YES'&EPHEM_TYPE='OBSERVER'&CENTER='coord@301'&COORD_TYPE='GEODETIC'&SITE_COORD='{lon},{lat},0'&QUANTITIES='4'&ANG_FORMAT='DEG'&CSV_FORMAT='YES'&STEP_SIZE='1 h'`
Líneas entre `$$SOE` y `$$EOE`: `fecha, solarFlag, interfererFlag, Az, El,`. Usa `src/lib/horizonsParser.ts`.

## Convenciones
- UI en español. Tema oscuro espacial (`slate-900/950`, acentos sky = A, fuchsia = B, ámbar = Sol, cian = Tierra, esmeralda = ventana dorada).
- Componentes 3D siempre con `dynamic(..., { ssr: false })`.
- Lee el store con selectores (`useMissionStore((s) => s.x)`), acciones vía `useMissionStore.getState()`.
- Antes de terminar una tarea: `npx tsc --noEmit` y `npm run build` deben pasar.

## Gráficos 3D (reglas)
- Texturas por nivel con `texPaths(tier)` y `usePbrSet()` (`src/components/canvas3d/textures.ts`). Albedo en sRGB; normal/ORM en espacio lineal. ORM: R=AO, G=roughness, B=metalness.
- Calidad: `useTier()` / `useGfxStore` (`auto` | `high` | `low`); parámetros en `TIER`. Todo efecto nuevo debe respetar `tier` y el toggle `vfx`.
- Canvas con `flat` (sin tone mapping del renderer): el tone mapping lo hace `<ToneMapping>` del post-procesado.
- La cresta del terreno (`TERRAIN_R`) DEBE coincidir con `horizonProfileDeg`; el interior nunca la supera.
- Sol/Tierra a `SKY_R` (más allá de la falda del terreno) para que el relieve los ocluya de verdad.
- No mutar en render valores creados con `useMemo` (regla react-hooks/immutability): actualizar uniforms dentro de `useFrame` vía ref.

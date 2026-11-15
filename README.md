# 🌙 Lunar Mission Navigator — NASA Space Apps 2026

Simulador web para comparar **sitios y fechas de alunizaje** en segundos y responder dos preguntas:

1. **¿Tendrá el lander luz solar?** (energía y temperatura)
2. **¿Verá la Tierra?** (comunicación directa, DTE, sin satélite relé)

…y qué pasa si **el lanzamiento se retrasa** o hay que cambiar a un sitio de respaldo.

## Arrancar en VS Code

```bash
npm install
cp .env.example .env.local   # pon tu LLM_API_KEY para el copiloto
npm run dev                  # http://localhost:3000
```

Abre la carpeta en VS Code y acepta las extensiones recomendadas (Tailwind, ESLint, Prettier).

> Sin `LLM_API_KEY` todo funciona (3D, comparador, línea de tiempo); solo el chat/voz del copiloto no responde.

## Qué ya funciona

| Pieza | Dónde | Estado |
|---|---|---|
| **Hasta 4 escenarios** (A–D) lado a lado, con delta respecto a A | `ScenarioSelector`, `MetricsComparison` | ✅ |
| **Efemérides reales JPL Horizons, 12 meses** (9 sitios, paso 1 h, binario comprimido 440 KB) | `public/data/ephemeris_*.bin.gz` | ✅ |
| **Terreno real LOLA**: DEM 16 px/° (~1,9 km) en 75–90°S y 4 px/° global; horizonte 360° con curvatura | `src/lib/dem.ts`, `public/data/dem_*.gz` | ✅ |
| Coordenadas personalizadas: horizonte LOLA calculado en el navegador + efemérides trasladadas (≤120 km) o JPL en vivo | `useMissionStore.setCustomCoords` | ✅ |
| **Panal de abeja**: muestreo hexagonal 0,5–5 km (19/37/61 celdas), cada celda con su horizonte real | `HoneycombPanel`, `src/lib/honeycomb.ts` | ✅ |
| **Días lunares y estaciones**: heatmap sitio × fecha (12 meses) + resumen por lunación | `SeasonsHeatmap`, `src/lib/seasons.ts` | ✅ |
| **Batería (SoC)**, **DTE degradado (multipath < 1°)** y **temperatura** superficial | `src/lib/lunarMath.ts`, `EnergyThermalChart` | ✅ (modelos simples) |
| Mapa polar sur LOLA con clic | `PolarMap` | ✅ |
| Horizonte 3D PBR + VFX optimizados (10x/30x fluidos) | `canvas3d/LocalHorizon3D.tsx`, `scene/` | ✅ |
| Globo lunar 4K (LROC + normal LOLA) con sombreado Lunar-Lambert y terminador real | `canvas3d/LunarGlobe3D.tsx` | ✅ |
| Tour guiado, Tierra vs. Luna, ES/EN, foco visible y aria | `TourGuide`, `EarthVsMoon`, `src/lib/i18n.ts` | ✅ |
| CopilotKit: 12 acciones, tarjetas en el chat, aprobación humana, sugerencias, informe, demo narrada, voz | `copilot/MissionVoiceAgent.tsx` | ✅ (falta API key para el chat) |
| Demo narrada sin LLM (para el video) | `src/lib/demo.ts` | ✅ |

## Hallazgo con datos reales

La coordenada que usábamos para Shackleton (−89,9°, 0°) cae en la **pared interior** del cráter: 25 % de Sol al año. El punto óptimo del borde, a pocos km, tiene **~70 %**. En Malapert pasa de 28 % a **76 %** al mover el sitio a la cima. Es exactamente el «cambios pequeños, gran impacto» del reto, y el panal de abeja lo hace visible.

## Rendimiento

- El cabezal de reproducción (`playhead`) avanza con `requestAnimationFrame`; el 3D lo lee en `useFrame` sin re-renderizar React.
- Los paneles DOM se actualizan como máximo 5–8 veces/s; el HUD del 3D está aislado para no re-renderizar el `<Canvas>`.
- Sombras con actualización manual (solo si el Sol se mueve; máx. 5/s reproduciendo).
- Calidad automática que solo baja (sin oscilaciones que reconstruyan terreno/texturas).
- Sin GodRays/Noise; Bloom a media resolución; canvas fuera de pantalla en pausa; máximo 2 vistas 3D.
- Medido (build de producción, 30x): JS de la app < 30 ms/s (antes ~490 ms/s en dev).

## Datos y APIs

- **JPL Horizons API** — `https://ssd.jpl.nasa.gov/api/horizons.api` (gratis, sin key). Observador `coord@301`, `QUANTITIES='4'`, `CSV_FORMAT='YES'`.
- **NASA PGDA LOLA DEMs (polo sur)** — https://pgda.gsfc.nasa.gov/products/78 y /81
- **Moon Trek WMTS** — https://moontrek.jpl.nasa.gov (mapas/teselas)
- **NASA Image and Video Library** — https://images-api.nasa.gov

Regenerar datos: `node scripts/generate_nasa_cache.mjs` (JPL, necesita internet) y luego `npx tsx scripts/compute_horizons.mts` (horizontes LOLA).

## Gráficos 3D

- **Texturas** (`public/textures/`, WebP, 2K y 1K): Luna = NASA CGI Moon Kit (LROC color + normal derivado de LOLA); Tierra = Blue Marble Next Generation (diciembre); regolito, aislante MLI y celdas solares = PBR procedural tileable (albedo + normal + ORM empaquetado: AO/rugosidad/metalicidad en un solo archivo).
- Regenerar o subir a 4K: `pip install numpy pillow && python scripts/build_textures.py --size 4096`.
- **VFX**: Bloom HDR, GodRays (solo calidad alta), viñeta, grano, tone mapping ACES, haz DTE animado (verde/rojo + chispas al bloquearse), polvo lunar levitante, halo solar, atmósfera y fase real de la Tierra, luz cenicienta.
- **Rendimiento**: `PerformanceMonitor` baja de HD a ligera si caen los FPS; DPR adaptativo; rocas instanciadas (1 draw call); terreno con densidad radial; texturas con anisotropía y mipmaps.
- **Física visual**: la cresta del terreno coincide con el perfil de horizonte usado en el cálculo, así el Sol/Tierra quedan ocultos en 3D exactamente cuando el cálculo dice "no visible". Tamaños aparentes del Sol y la Tierra exagerados ~4× por legibilidad.

## Novedades (v4)
- **Ayuda en cada métrica**: pasa el mouse (o tabula) sobre el ícono ⓘ de cualquier KPI, gráfica o control para ver qué es, cómo se calcula, para qué sirve y cómo usarlo (`src/lib/glossary.ts`, `src/components/ui/InfoTip.tsx`).
- **Hasta 4 vistas 3D**: chips A–D y botón «Ver los 4» encima de las vistas. Con 3–4 vistas se activa un modo compacto (menos resolución, sin polvo) para mantener la fluidez.
- **Panal interactivo**: clic en la Luna (globo 3D) o en el mapa polar → se calculan 37 celdas, la cámara hace zoom y cada hexágono muestra su % de aptitud. «Usar → A» mueve el escenario a la celda elegida (`src/lib/explore.ts`).
- **Lander detallado y rayos**: rayo Tierra (verde/violeta/rojo) desde la antena y rayo Sol hacia los paneles, cuyo color va de ámbar (Sol rasante) a blanco (Sol alto) y rojo si una montaña lo tapa.
- **Datos simplificados**: 4 KPIs grandes + «Más detalles», línea de tiempo de 3 pistas, gráfica de batería/temperatura con zona de peligro, semáforo de estaciones.
> La «aptitud» (0–100) es un índice de idoneidad (veredicto + ventana dorada + batería mínima), no una probabilidad estadística.

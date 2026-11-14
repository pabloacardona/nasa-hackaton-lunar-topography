# Propuesta para llegar al 100 % en cada punto del reto

## Estado tras la 2.ª iteración (14 nov 2026)

| Punto del reto | Antes | Ahora | Qué se hizo | Qué falta para 100 % |
|---|---|---|---|---|
| Selección y comparación | 80 % | **95 %** | 4 escenarios, mapa polar con clic, panal de abeja, sitios corregidos con LOLA | Más sitios (Artemis III 13 regiones, Chandrayaan-3, SLIM) |
| Flexibilidad de fechas | 70 % | **95 %** | Caché JPL de 12 meses, slider de retraso 0–180 d, heatmap sitio × fecha, resumen por lunación | Caché multi-año |
| Sol/Tierra + tiempo a sunset | 75 % | **90 %** | Horizonte LOLA real (1,9 km), oclusión real en 3D, cuentas regresivas | DEM 5–20 m para el campo cercano |
| Energía y comunicación | 85 % | **95 %** | SoC de batería, DTE degradado (multipath), temperatura | Modelo térmico del lander (no solo del suelo) |
| Varias visualizaciones | 70 % | **95 %** | Globo 4K Lunar-Lambert, mapa polar, panal, heatmap, energía/temperatura | Capa WMTS de Moon Trek opcional |
| Dinámica temporal | 85 % | **95 %** | 10x/30x fluidos, marcadores de eventos, SoC en la línea de tiempo | Exportar video |
| Accesibilidad | 65 % | **88 %** | Tour, Tierra vs. Luna, ES/EN, aria, foco visible, reduced-motion | Traducir el 100 % de textos; auditoría Lighthouse |
| Topografía LOLA | 20 % | **85 %** | DEM LDEM 16 px/° + horizonte con curvatura, mismo código en navegador y scripts | DEM PGDA alta resolución |
| Libración | 60 % | **70 %** | Bucle de la Tierra visible en el panorama y explicado | Panel dedicado a la "caja de libración" |
| Pendientes y cráteres profundos | 25 % | **55 %** | Relieve real en mapa polar y horizonte | Mapa de pendientes + PSR |
| Ciencia vs. ingeniería | 20 % | **35 %** | Panal permite el trade-off por distancia | Capa de hielo/PSR + puntaje combinado |
| CopilotKit | — | **95 %** | 12 acciones, tarjetas, aprobación, sugerencias, informe, demo, buscador de ventanas, panal | Migrar a API v2 |

**Nota global estimada: ≈ 88/100** (antes ≈ 68).

---

Calificación de partida: **≈ 68/100**. Cada punto lleva *qué falta*, *cómo resolverlo* y un **criterio de aceptación** verificable. "P1" = datos/IA, "P2" = 3D/UI.

> El 100 % de "cumplimiento" se demuestra con los criterios de aceptación. Algunos puntos (exactitud del terreno) dependen de datos LOLA que hay que procesar: sin eso ningún punto del polo sur pasa del ~80 %.

---

## 0. Prioridad absoluta: terreno real (desbloquea 4 puntos)

| | |
|---|---|
| **Falta** | `horizonProfileDeg` es sintético. Afecta: visualización Sol/Tierra, energía/comunicación, topografía, cráteres. |
| **Cómo** | 1) Descargar DEM LOLA polo sur de PGDA (productos 78/81, 20 m/px para el radio de 30–100 km). 2) `python scripts/lola_horizon_profile.py DEM.tif --lat --lon --site` para los 5 sitios polares; para los ecuatoriales usar el LDEM global 118 m. 3) Radio de búsqueda ≥ 100 km en el polo (los macizos lejanos tapan el Sol rasante). 4) Endpoint `/api/horizon-profile?lat&lon` que calcule el perfil para coordenadas personalizadas desde un DEM recortado en el servidor. |
| **Aceptación** | `horizonSource` ≠ `synthetic-placeholder` en los 9 sitios. % de iluminación de Shackleton/Malapert dentro de ±10 % de valores publicados (Mazarico et al. 2011, LOLA). |
| **Dueño / esfuerzo** | P1 · 4–6 h |

---

## 1. Selección y comparación de sitios — 80 % → 100 %

| Falta | Solución | Aceptación |
|---|---|---|
| Solo 2 escenarios | Generalizar el store a `scenarios: Scenario[]` (hasta 4) con columnas dinámicas y tabla comparativa con deltas | Comparar 4 sitios a la vez sin bajar de 30 FPS |
| Sin clic en mapa real | Mapa 2D del polo sur con teselas WMTS de Moon Trek (MapLibre, proyección polar) + clic = coordenadas personalizadas | Clic en el mapa → escenario recalculado en < 3 s |
| Faltan sitios | Agregar Artemis III (13 regiones), Chandrayaan-3, SLIM, Luna-25, IM-2, Griffin | ≥ 15 sitios con fuente citada |

## 2. Flexibilidad de fechas — 70 % → 100 %

| Falta | Solución | Aceptación |
|---|---|---|
| Sin vista de estaciones / varios días lunares | **Mapa de calor sitio × fecha** (12 meses, paso 1 día) con % de "ventana dorada" | Heatmap de 9 sitios × 365 días en < 2 s (Web Worker) |
| Caché de 60 días | Regenerar caché a 12–24 meses con `node scripts/generate_nasa_cache.mjs 2026-11-01T00:00:00Z 8760`, comprimido (Float16 / Int16 ×100) | Archivo < 6 MB; sin llamadas en vivo para sitios curados |
| Retraso solo +7/+14 | Slider de retraso 0–180 días con preview instantáneo | Mover el slider actualiza KPIs a 60 FPS |

## 3. Posición Sol/Tierra + tiempo a sunset/earthset — 75 % → 100 %

| Falta | Solución | Aceptación |
|---|---|---|
| Terreno sintético | Punto 0 | — |
| Cuenta regresiva corta al final de la ventana | Calcular con la caché extendida (no truncar a 720 h) | `hoursToSunset` correcto aunque el ocaso caiga fuera de la ventana |
| ✅ **Hecho** | Cámaras "Mirar al Sol / a la Tierra", HUD con estado, oclusión real por el relieve | — |

## 4. Energía y comunicación — 85 % → 100 %

| Falta | Solución | Aceptación |
|---|---|---|
| Energía sin batería simulada | Curva de **estado de carga (SoC)** hora a hora: panel (W/m² × área × eficiencia) – consumo; parámetros editables | Gráfica SoC; semáforo rojo cuando SoC = 0 |
| DTE binario | Zona *multipath* (Tierra < 1° sobre la cresta) = solo telemetría; estimar tasa de datos según elevación | Tres estados DTE: completo / degradado / sin enlace |
| Sin temperatura | Estimación térmica simple (radiación solar incidente vs. sombra) | KPI de temperatura con rango |

## 5. Varias visualizaciones — 70 % → 100 %

| Falta | Solución | Aceptación |
|---|---|---|
| ✅ **Hecho** | Texturas PBR HD (LROC + LOLA + Blue Marble), terreno PBR, lander PBR, VFX, calidad adaptativa | — |
| Sin mapa 2D | Mapa polar Moon Trek (ver 1) con capa de iluminación promedio LOLA | Mapa con sitios y capa de iluminación |
| Sin transición globo → superficie | Animación de cámara "aterrizaje" del globo al horizonte 3D | Transición < 2 s al cambiar de sitio |
| Diagrama solar | Gráfico polar (cielo visto desde arriba) además del panorama | 3 visualizaciones distintas de la misma hora |

## 6. Dinámica temporal — 85 % → 100 %

| Falta | Solución | Aceptación |
|---|---|---|
| Sin animación multi-mes | Timeline con zoom (día / lunación / año) | Reproducir un año en < 60 s |
| Sin marcadores de eventos | Marcar sunset/earthset/sunrise sobre el Gantt, con clic para saltar | Todos los eventos marcados |
| Exportar | Grabar GIF/MP4 de la animación (MediaRecorder sobre el canvas) | Botón "Exportar video" |

## 7. Accesibilidad para distintos niveles — 65 % → 100 %

| Falta | Solución | Aceptación |
|---|---|---|
| Modo educador superficial | **Tour guiado** de 5 pasos y comparación lado a lado Tierra vs. Luna (mismo día en Medellín vs. polo sur) | Un estudiante entiende "por qué el polo es difícil" en < 2 min (prueba con 3 personas) |
| "Cambios pequeños, gran impacto" | **Análisis de sensibilidad**: anillo de 8–16 puntos a 0,5/1/2/5 km del sitio con su % de luz | Mapa de calor local alrededor del sitio |
| a11y | Auditoría WCAG AA: contraste, navegación por teclado, `aria-live` en KPIs, alternativa textual al 3D | Lighthouse Accessibility ≥ 95 |
| Idioma | i18n español/inglés (los jueces son internacionales) | Botón ES/EN |

---

## Consideraciones sugeridas

| Consideración | Hoy | Acción | Meta |
|---|---|---|---|
| Efemérides | 95 % | Caché 12–24 meses + verificar contra WebGeocalc | 100 % |
| Topografía LOLA | 20 % | Punto 0 | 100 % |
| Sin atmósfera / borde de la esfera | 80 % | Con LOLA real la curvatura ya está en el script | 100 % |
| Elevación solar destacada | 90 % | Gauge grande + umbrales (0°, 2°, 5°) | 100 % |
| Libración | 60 % | Panel "Caja de libración" que dibuje la trayectoria de la Tierra en 1 mes y explique ±7° | 100 % |
| Pendientes y cráteres profundos | 25 % | Malla 3D desde el DEM real (no solo anillo) + mapa de pendientes (< 10° seguro) + zonas en sombra permanente (PSR) | 100 % |
| Por qué cambios pequeños importan | 50 % | Análisis de sensibilidad (punto 7) | 100 % |
| Ciencia vs. ingeniería | 20 % | Capa de interés científico (PSR / hielo) + **puntaje combinado** ciencia/ingeniería con pesos editables | 100 % |

---

## CopilotKit: mejoras

| # | Mejora | Qué aporta |
|---|---|---|
| 1 | `findBestLandingWindow` (servidor) | "Busca la mejor fecha de diciembre en Mons Mouton con 48 h de batería" → ranking real |
| 2 | Tarjetas en el chat (`render` en las acciones) | Comparativas visuales dentro de la conversación |
| 3 | Aprobación humana (human-in-the-loop) | "¿Apruebas cambiar a Shackleton?" con botones |
| 4 | Sugerencias dinámicas | Chips contextuales según el estado (A en rojo → "¿Probar +7 días?") |
| 5 | `sensitivityAnalysis` | Evalúa puntos cercanos y explica |
| 6 | `generateMissionBrief` | Informe de decisión exportable |
| 7 | Demo guiada narrada | Guion de 3 min automático para el video |
| 8 | Voz HD + interrupción | TTS realista, barge-in, ES/EN automático |
| 9 | Migración a API v2 | Quita la dependencia de la API v1 deprecada |

---

## Cronograma sugerido (2 personas)

| Bloque | P1 (datos / IA) | P2 (3D / UI) |
|---|---|---|
| 1 (4–6 h) | LOLA real (punto 0) | Mapa polar Moon Trek + clic |
| 2 (4 h) | Caché 12 meses + heatmap (Worker) | Transición globo → superficie, gráfico polar |
| 3 (4 h) | `findBestLandingWindow` + sensibilidad | Timeline con zoom y marcadores |
| 4 (3 h) | SoC de batería + multipath | Tour guiado + Tierra vs. Luna + a11y |
| 5 (3 h) | Tarjetas en chat, aprobación humana | i18n, pulido, video demo |

Nota estimada al completar los bloques 1–3: **≈ 88**; con 4–5: **95–100**.

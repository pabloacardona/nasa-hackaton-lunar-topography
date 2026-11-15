// ============================================================================
// GLOSARIO: explica CADA cálculo de la herramienta (qué es, cómo se calcula,
// para qué sirve y cómo usarlo). Se muestra en las ayudas flotantes (InfoTip).
// ============================================================================
export interface GlossaryEntry {
  title: [string, string];
  what: [string, string];
  how: [string, string];
  why: [string, string];
  use: [string, string];
}

export const GLOSSARY = {
  verdict: {
    title: ["Veredicto de la misión", "Mission verdict"],
    what: ["Semáforo que resume si el sitio y la fecha sirven para la misión completa.", "Traffic light summarising whether the site and date work for the whole mission."],
    how: ["🔴 Riesgo: no hay Sol al alunizar o la batería llega a 0 %. 🟡 Relé: hay energía, pero la Tierra no se ve al alunizar o se ve menos del 50 % del tiempo. 🟢 Viable: lo demás. Se evalúa solo durante la duración de la misión elegida.", "🔴 Risk: no Sun at landing or battery hits 0%. 🟡 Relay: power is fine but Earth is hidden at landing or visible <50% of the time. 🟢 Viable: otherwise. Evaluated only over the selected mission duration."],
    why: ["Es la respuesta rápida a «¿podemos aterrizar aquí ese día?».", "The quick answer to “can we land here that day?”."],
    use: ["Si sale rojo, prueba otra fecha (heatmap de estaciones) o un punto cercano (panal de abeja).", "If red, try another date (seasons heatmap) or a nearby point (honeycomb)."],
  },
  hoursToSunset: {
    title: ["Horas hasta el ocaso", "Hours to sunset"],
    what: ["Cuántas horas seguidas quedan de Sol en el sitio desde la hora actual.", "How many consecutive hours of sunlight remain from the current hour."],
    how: ["Se cuentan las horas consecutivas en que la elevación del Sol (JPL Horizons) supera la altura de las montañas en esa dirección (LOLA). Sin atmósfera no hay crepúsculo: el ocaso es instantáneo.", "Consecutive hours where the Sun's elevation (JPL Horizons) exceeds the terrain height in that direction (LOLA). No atmosphere means no twilight: sunset is instant."],
    why: ["Marca cuánto tiempo puede cargar los paneles y mantenerse caliente el lander.", "Tells how long the lander can charge and stay warm."],
    use: ["Úsalo para planear operaciones de alto consumo antes del ocaso.", "Plan power-hungry operations before sunset."],
  },
  hoursToEarthset: {
    title: ["Horas hasta perder la Tierra", "Hours to Earthset"],
    what: ["Horas seguidas que quedan con la Tierra visible (comunicación directa).", "Consecutive hours left with Earth in view (direct communication)."],
    how: ["Igual que el ocaso, pero con la posición de la Tierra. La Tierra casi no se mueve en el cielo lunar: solo oscila unos ±7° (libración), por eso en el polo una montaña puede taparla durante días.", "Same as sunset but for Earth. Earth barely moves in the lunar sky — it only wobbles ±7° (libration) — so near the pole a ridge can hide it for days."],
    why: ["Sin Tierra visible no hay enlace directo: hace falta un satélite relé o el lander debe operar solo.", "Without Earth in view there is no direct link: you need a relay satellite or autonomous operation."],
    use: ["Programa la subida de datos y comandos críticos dentro de esta ventana.", "Schedule critical data downlink and commands within this window."],
  },
  solarElevation: {
    title: ["Elevación solar", "Solar elevation"],
    what: ["Altura del Sol sobre el horizonte ideal (en grados).", "Height of the Sun above the ideal horizon (degrees)."],
    how: ["Dato directo de NASA/JPL Horizons para un observador en esas coordenadas lunares, hora por hora.", "Direct from NASA/JPL Horizons for an observer at those lunar coordinates, hour by hour."],
    why: ["En el polo sur el Sol nunca sube más de ~1,5° + la altura del sitio: va rozando el horizonte. Por eso las sombras son larguísimas y los paneles van verticales.", "At the south pole the Sun never rises more than ~1.5° plus site height: it skims the horizon. Hence huge shadows and vertical panels."],
    use: ["Compárala con la altura de las montañas (panorama 2D) para ver qué tan cerca está de esconderse.", "Compare it with terrain height (2D panorama) to see how close it is to hiding."],
  },
  power: {
    title: ["Potencia solar", "Solar power"],
    what: ["Energía solar que recibe cada metro cuadrado de panel (W/m²).", "Solar energy received per square metre of panel (W/m²)."],
    how: ["1361 W/m² (constante solar, sin atmósfera) × cos(elevación) para paneles verticales (polo) o × sen(elevación) para paneles horizontales (ecuador). 0 si el Sol está oculto.", "1361 W/m² (solar constant, no atmosphere) × cos(elevation) for vertical panels (pole) or × sin(elevation) for horizontal panels (equator). 0 if the Sun is hidden."],
    why: ["Define cuánto se carga la batería cada hora.", "Defines how fast the battery charges."],
    use: ["Si es baja todo el tiempo, aumenta el área de panel en el gráfico de batería.", "If it is always low, increase panel area in the battery chart."],
  },
  battery: {
    title: ["Batería (estado de carga)", "Battery (state of charge)"],
    what: ["Porcentaje de batería restante, simulado hora a hora.", "Remaining battery percentage, simulated hour by hour."],
    how: ["Empieza al 100 %. Cada hora: + potencia × área × eficiencia (29 %) − consumo. Capacidad = horas de autonomía × consumo (p. ej. 48 h × 150 W = 7,2 kWh).", "Starts at 100%. Each hour: + power × area × efficiency (29%) − load. Capacity = autonomy hours × load (e.g. 48 h × 150 W = 7.2 kWh)."],
    why: ["Si llega a 0 % en la sombra, la electrónica se congela: fin de la misión.", "If it hits 0% in shadow, electronics freeze: mission over."],
    use: ["Ajusta batería, consumo y área de panel para ver qué diseño sobrevive a la sombra más larga.", "Tune battery, load and panel area to see which design survives the longest shadow."],
  },
  temperature: {
    title: ["Temperatura de la superficie", "Surface temperature"],
    what: ["Temperatura estimada del suelo lunar alrededor del lander.", "Estimated lunar soil temperature around the lander."],
    how: ["Equilibrio radiativo: T = ((1−0,12) × 1361 × sen(elevación) / (0,95 × σ))^¼. En sombra se enfría exponencialmente hacia −183 °C. Es un modelo simple (orden de magnitud).", "Radiative equilibrium: T = ((1−0.12) × 1361 × sin(elevation) / (0.95 × σ))^¼. In shadow it cools exponentially toward −183 °C. A simple order-of-magnitude model."],
    why: ["Muestra el contraste extremo: +120 °C en el ecuador a mediodía, −180 °C en la noche polar.", "Shows the extreme contrast: +120 °C at equatorial noon, −180 °C in the polar night."],
    use: ["Útil para explicar por qué los landers necesitan calentadores y aislante dorado.", "Useful to explain why landers need heaters and gold insulation."],
  },
  sunlightPct: {
    title: ["% de luz", "% sunlight"],
    what: ["Porcentaje de horas de la misión con el Sol visible.", "Share of mission hours with the Sun visible."],
    how: ["Horas con Sol ÷ horas de misión × 100.", "Hours with Sun ÷ mission hours × 100."],
    why: ["Más luz = más energía y menos frío.", "More light = more power and less cold."],
    use: ["Compara sitios: en el polo, puntos a 1 km pueden pasar del 25 % al 70 %.", "Compare sites: at the pole, points 1 km apart can go from 25% to 70%."],
  },
  dtePct: {
    title: ["% de comunicación directa (DTE)", "% direct-to-Earth (DTE)"],
    what: ["Porcentaje de horas con la Tierra visible sobre las montañas.", "Share of hours with Earth visible above the terrain."],
    how: ["Horas con Tierra visible ÷ horas de misión × 100. Si la Tierra está a menos de 1° sobre la cresta se cuenta como enlace degradado (rebotes de señal o «multipath»).", "Hours with Earth visible ÷ mission hours × 100. If Earth is less than 1° above the ridge it counts as a degraded link (multipath)."],
    why: ["Sin Tierra no se pueden enviar datos ni recibir órdenes sin un satélite relé.", "Without Earth you cannot send data or receive commands without a relay."],
    use: ["La cara oculta (Von Kármán) siempre da 0 %: allí el relé es obligatorio.", "The far side (Von Kármán) is always 0%: a relay is mandatory there."],
  },
  goldenPct: {
    title: ["Ventana dorada", "Golden window"],
    what: ["Porcentaje de horas con Sol Y Tierra visibles a la vez.", "Share of hours with both Sun AND Earth visible."],
    how: ["Horas con ambos ÷ horas de misión × 100.", "Hours with both ÷ mission hours × 100."],
    why: ["Es el tiempo ideal: hay energía y se puede transmitir.", "The ideal time: you have power and can transmit."],
    use: ["Es la mejor métrica única para comparar sitios y fechas.", "The best single metric to compare sites and dates."],
  },
  longestShadow: {
    title: ["Sombra más larga", "Longest shadow"],
    what: ["Mayor número de horas seguidas sin Sol durante la misión.", "Longest run of consecutive hours without Sun during the mission."],
    how: ["Se busca la racha más larga de horas con el Sol oculto.", "Longest streak of hours with the Sun hidden."],
    why: ["Si supera la autonomía de la batería, el lander se congela.", "If it exceeds battery autonomy, the lander freezes."],
    use: ["Compárala con las horas de batería elegidas arriba.", "Compare with the battery hours selected above."],
  },
  aptitude: {
    title: ["Aptitud de aterrizaje", "Landing suitability"],
    what: ["Índice de 0 a 100 que resume qué tan buen lugar es una celda para aterrizar ese día. No es una probabilidad estadística, es un puntaje comparativo.", "0–100 index of how good a cell is for landing that day. Not a statistical probability, a comparative score."],
    how: ["Base según el veredicto (🟢 60, 🟡 30, 🔴 0) + 0,3 × ventana dorada % + 0,1 × batería mínima %.", "Base from the verdict (🟢 60, 🟡 30, 🔴 0) + 0.3 × golden window % + 0.1 × minimum battery %."],
    why: ["Permite elegir de un vistazo la mejor zona entre decenas de puntos cercanos.", "Lets you pick the best spot among dozens of nearby points at a glance."],
    use: ["Busca las celdas verdes con número alto; clic en una para moverle tu escenario.", "Look for green cells with high numbers; click one to move your scenario there."],
  },
  honeycomb: {
    title: ["Panal de abeja", "Honeycomb"],
    what: ["Retícula de hexágonos alrededor del punto elegido para comparar lugares cercanos.", "Hexagon grid around the chosen point to compare nearby places."],
    how: ["Cada hexágono está a la misma distancia de sus 6 vecinos (sin huecos ni sesgo de dirección). Para cada uno se calcula su propio horizonte con el relieve LOLA y se trasladan las efemérides de JPL.", "Each hexagon is equidistant from its 6 neighbours (no gaps or directional bias). Each gets its own LOLA horizon and transferred JPL ephemerides."],
    why: ["En el polo, moverse 1–2 km cambia por completo la luz y la señal: «cambios pequeños, gran impacto».", "At the pole, moving 1–2 km completely changes light and signal: “small changes, big impact”."],
    use: ["Haz clic en la Luna o en el mapa polar: el panal se calcula solo.", "Click on the Moon or the polar map: the honeycomb is computed automatically."],
  },
  panorama: {
    title: ["Panorama del horizonte", "Horizon panorama"],
    what: ["Vista de 360° del horizonte: la silueta gris son las montañas; los puntos, el camino del Sol (ámbar) y de la Tierra (cian) en 30 días.", "360° horizon view: grey silhouette is terrain; dots are the 30-day paths of the Sun (amber) and Earth (cyan)."],
    how: ["Silueta: ángulo máximo del relieve LOLA en cada dirección, incluyendo la curvatura lunar, hasta 180 km. Caminos: JPL Horizons.", "Silhouette: maximum LOLA terrain angle per direction, including lunar curvature, out to 180 km. Paths: JPL Horizons."],
    why: ["Explica visualmente por qué el Sol o la Tierra se ocultan.", "Visually explains why the Sun or Earth hide."],
    use: ["Si el círculo grande queda debajo de la silueta, está oculto (rojo).", "If the big dot is below the silhouette, it is hidden (red)."],
  },
  timeline: {
    title: ["Línea de tiempo", "Timeline"],
    what: ["30 días desde el alunizaje: barras de Sol, Tierra y ambos a la vez.", "30 days from landing: bars for Sun, Earth and both."],
    how: ["Cada barra es una hora con el astro visible. La zona oscura queda fuera de la duración de la misión.", "Each bar is an hour with the body visible. The dark area is beyond the mission duration."],
    why: ["Muestra cuándo empiezan y terminan las ventanas de energía y comunicación.", "Shows when power and communication windows start and end."],
    use: ["Arrastra el control o pulsa ▶ para animar; los botones saltan al próximo ocaso o pérdida de la Tierra.", "Drag the slider or press ▶ to animate; buttons jump to the next sunset or Earthset."],
  },
  seasons: {
    title: ["Días lunares y estaciones", "Lunar days & seasons"],
    what: ["Cada casilla = alunizar ese día y evaluar la misión completa. 12 meses.", "Each cell = land on that day and evaluate the whole mission. 12 months."],
    how: ["Para cada día se repite el cálculo del veredicto con la caché anual de JPL y el horizonte LOLA del sitio.", "For every day the verdict is recomputed with the yearly JPL cache and the site's LOLA horizon."],
    why: ["Los polos tienen «estaciones» (el eje lunar se inclina 1,54°): hay meses buenos y meses imposibles.", "Poles have “seasons” (1.54° axial tilt): some months are good, others impossible."],
    use: ["Clic en una casilla verde para usar esa fecha; útil cuando hay un retraso de lanzamiento.", "Click a green cell to use that date; useful after a launch delay."],
  },
  delay: {
    title: ["Retraso de lanzamiento", "Launch delay"],
    what: ["Días que se corre la fecha de alunizaje.", "Days the landing date slips."],
    how: ["Fecha efectiva = fecha base + retraso. Se recalcula todo con la caché de 12 meses (o JPL en vivo si se sale de ella).", "Effective date = base date + delay. Everything is recomputed from the 12-month cache (or live JPL beyond it)."],
    why: ["Los retrasos son comunes; un sitio bueno puede volverse inviable con 14 días de retraso.", "Delays are common; a good site can become unviable after a 14-day slip."],
    use: ["Prueba +7 / +14 días y mira cómo cambia el semáforo.", "Try +7 / +14 days and watch the traffic light change."],
  },
  missionProfile: {
    title: ["Duración de la misión", "Mission duration"],
    what: ["Horas que el lander debe operar en la superficie.", "Hours the lander must operate on the surface."],
    how: ["Todas las métricas y el veredicto se calculan solo dentro de este periodo desde el alunizaje.", "All metrics and the verdict are computed only within this period from landing."],
    why: ["Una misión de 6,5 días puede ser viable donde una de 30 días no lo es.", "A 6.5-day mission can be viable where a 30-day one is not."],
    use: ["Elige el tipo de misión que estás planeando.", "Pick the mission type you are planning."],
  },
  horizonSource: {
    title: ["Fuente del horizonte", "Horizon source"],
    what: ["De dónde sale la altura de las montañas alrededor del sitio.", "Where terrain heights around the site come from."],
    how: ["Modelo de elevación LOLA (láser del Lunar Reconnaissance Orbiter, NASA): ~1,9 km por píxel en el polo sur y ~7,6 km en el resto. Se trazan rayos en 360 direcciones hasta 180 km.", "LOLA elevation model (Lunar Reconnaissance Orbiter laser, NASA): ~1.9 km per pixel at the south pole, ~7.6 km elsewhere. Rays are traced in 360 directions out to 180 km."],
    why: ["Sin atmósfera, el horizonte lo definen las montañas, no el aire.", "With no atmosphere, mountains define the horizon, not air."],
    use: ["Las rocas pequeñas cerca del lander no aparecen: para sitios finales se usaría un modelo de 5–20 m.", "Small nearby rocks are not resolved: final site selection would use a 5–20 m model."],
  },
} satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;

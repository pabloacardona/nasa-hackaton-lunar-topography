// ============================================================================
// Terreno real LOLA (NASA CGI Moon Kit, LDEM 16 px/grado) y cálculo de horizonte.
//   - Casquete polar sur 75°S–90°S a 16 px/° (~1,9 km/px)
//   - Global a 4 px/° (~7,6 km/px)
// Alturas en metros respecto a la esfera de 1737,4 km. Columna 0 = lon -180°.
// ============================================================================
import { R_MOON_M, destination } from "./geo";

const POLAR_W = 5760, POLAR_H = 240, POLAR_PPD = 16, POLAR_LAT0 = -75;
const GLOB_W = 1440, GLOB_H = 720, GLOB_PPD = 4;

let polar: Int16Array | null = null;
let globe: Int16Array | null = null;

export const demReady = () => !!polar && !!globe;

/** Deshace la codificación delta por filas usada para comprimir. */
export function undelta(d: Int16Array, w: number): Int16Array {
  const out = new Int16Array(d.length);
  for (let i = 0; i < d.length; i++) out[i] = i % w === 0 ? d[i] : out[i - 1] + d[i];
  return out;
}

export function setDem(p: Int16Array, g: Int16Array) {
  polar = p;
  globe = g;
}

async function fetchGz(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const ds = res.body!.pipeThrough(new DecompressionStream("gzip"));
  return new Response(ds).arrayBuffer();
}

let loading: Promise<void> | null = null;
export function loadDem(base = "/data"): Promise<void> {
  if (demReady()) return Promise.resolve();
  loading ??= (async () => {
    const [p, g] = await Promise.all([fetchGz(`${base}/dem_s75_16ppd.i16.gz`), fetchGz(`${base}/dem_global_4ppd.i16.gz`)]);
    setDem(undelta(new Int16Array(p), POLAR_W), undelta(new Int16Array(g), GLOB_W));
  })();
  return loading;
}

function bilinear(grid: Int16Array, w: number, h: number, row: number, col: number) {
  row = Math.min(Math.max(row, 0), h - 1.0001);
  const r0 = Math.floor(row), fr = row - r0;
  const c = ((col % w) + w) % w;
  const c0 = Math.floor(c), fc = c - c0, c1 = (c0 + 1) % w;
  const a = grid[r0 * w + c0], b = grid[r0 * w + c1], d = grid[(r0 + 1) * w + c0], e = grid[(r0 + 1) * w + c1];
  return (a * (1 - fc) + b * fc) * (1 - fr) + (d * (1 - fc) + e * fc) * fr;
}

/** Elevación (m) en una coordenada. */
export function elevation(lat: number, lon: number): number {
  if (!polar || !globe) return 0;
  if (lat <= POLAR_LAT0) {
    return bilinear(polar, POLAR_W, POLAR_H, (POLAR_LAT0 - lat) * POLAR_PPD - 0.5, (lon + 180) * POLAR_PPD - 0.5);
  }
  return bilinear(globe, GLOB_W, GLOB_H, (90 - lat) * GLOB_PPD - 0.5, (lon + 180) * GLOB_PPD - 0.5);
}

/** Resolución del DEM disponible en esa latitud (km por píxel). */
export const demResolutionKm = (lat: number) => (lat <= POLAR_LAT0 ? 1.9 : 7.6);

// Distancias de muestreo: densas cerca, espaciadas lejos (progresión geométrica)
const DISTS: number[] = (() => {
  const d: number[] = [];
  for (let x = 300; x < 180_000; x *= 1.04) d.push(x);
  return d;
})();

/**
 * Perfil de horizonte real: para cada azimut (0..359) el ángulo máximo del terreno
 * visto desde el sitio, sin atmósfera y con la curvatura lunar:
 *   θ(az) = max_d  atan( (h(d) − h0 − d²/2R) / d )
 */
export function horizonProfile(lat: number, lon: number, observerHeightM = 2): number[] {
  const h0 = elevation(lat, lon) + observerHeightM;
  const out = new Array<number>(360);
  for (let az = 0; az < 360; az++) {
    let best = -90;
    for (const d of DISTS) {
      const p = destination(lat, lon, az, d);
      const h = elevation(p.lat, p.lon);
      const ang = Math.atan((h - h0 - (d * d) / (2 * R_MOON_M)) / d);
      if (ang > best) best = ang;
    }
    out[az] = Math.round(((best * 180) / Math.PI) * 100) / 100;
  }
  return out;
}

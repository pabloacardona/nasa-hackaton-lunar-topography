// ============================================================================
// Efemérides precalculadas (NASA/JPL Horizons, DE441) – 1 año, paso 1 h.
// Binario: por sitio [sunAz u16, sunEl i16, earthAz u16, earthEl i16] × N (valor×100)
// ============================================================================
import { type Basis, type LatLon, azElToBody, bodyToAzEl, enuBasis } from "./geo";
import type { AzEl } from "./types";

export interface Ephem {
  sunAz: Float32Array;
  sunEl: Float32Array;
  earthAz: Float32Array;
  earthEl: Float32Array;
}

export const ephemLength = (e: Ephem) => e.sunAz.length;

export function decodeEphemeris(buf: ArrayBuffer, siteCount: number, n: number): Ephem[] {
  const out: Ephem[] = [];
  for (let s = 0; s < siteCount; s++) {
    const blk = (k: number) => s * 4 * n * 2 + k * n * 2;
    const sAz = new Uint16Array(buf, blk(0), n), sEl = new Int16Array(buf, blk(1), n);
    const eAz = new Uint16Array(buf, blk(2), n), eEl = new Int16Array(buf, blk(3), n);
    const e: Ephem = { sunAz: new Float32Array(n), sunEl: new Float32Array(n), earthAz: new Float32Array(n), earthEl: new Float32Array(n) };
    for (let i = 0; i < n; i++) {
      e.sunAz[i] = sAz[i] / 100;
      e.sunEl[i] = sEl[i] / 100;
      e.earthAz[i] = eAz[i] / 100;
      e.earthEl[i] = eEl[i] / 100;
    }
    out.push(e);
  }
  return out;
}

export function sliceEphem(e: Ephem, start: number, len: number): Ephem {
  const end = Math.min(start + len, e.sunAz.length);
  return { sunAz: e.sunAz.subarray(start, end), sunEl: e.sunEl.subarray(start, end), earthAz: e.earthAz.subarray(start, end), earthEl: e.earthEl.subarray(start, end) };
}

export function fromAzEl(sun: AzEl[], earth: AzEl[]): Ephem {
  const n = Math.min(sun.length, earth.length);
  const e: Ephem = { sunAz: new Float32Array(n), sunEl: new Float32Array(n), earthAz: new Float32Array(n), earthEl: new Float32Array(n) };
  for (let i = 0; i < n; i++) {
    e.sunAz[i] = sun[i][0];
    e.sunEl[i] = sun[i][1];
    e.earthAz[i] = earth[i][0];
    e.earthEl[i] = earth[i][1];
  }
  return e;
}

/**
 * Traslada efemérides de un sitio a otro cercano (rotando la base local).
 * El Sol está a 1 UA y la Tierra a 384 000 km: el paralaje por moverse ≤100 km
 * es < 0,015°, así que la dirección en el marco lunar es la misma; solo cambian
 * el "norte" y el "cénit" locales (esto incluye el cambio de elevación ≈ d/R).
 */
export function transferEphem(e: Ephem, from: LatLon, to: LatLon): Ephem {
  const bf: Basis = enuBasis(from), bt: Basis = enuBasis(to);
  const n = e.sunAz.length;
  const out: Ephem = { sunAz: new Float32Array(n), sunEl: new Float32Array(n), earthAz: new Float32Array(n), earthEl: new Float32Array(n) };
  for (let i = 0; i < n; i++) {
    const [sa, se] = bodyToAzEl(azElToBody(e.sunAz[i], e.sunEl[i], bf), bt);
    const [ea, ee] = bodyToAzEl(azElToBody(e.earthAz[i], e.earthEl[i], bf), bt);
    out.sunAz[i] = sa;
    out.sunEl[i] = se;
    out.earthAz[i] = ea;
    out.earthEl[i] = ee;
  }
  return out;
}

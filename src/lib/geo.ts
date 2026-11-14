// ============================================================================
// Geometría lunar: puntos destino, cambio de observador y retícula hexagonal.
// ============================================================================
export const R_MOON_M = 1_737_400;
export const R_MOON_KM = 1737.4;
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export interface LatLon {
  lat: number;
  lon: number;
}

/** Punto a `distM` metros desde (lat,lon) con rumbo `bearingDeg` (desde el norte, horario). */
export function destination(lat: number, lon: number, bearingDeg: number, distM: number): LatLon {
  const φ = lat * D2R, λ = lon * D2R, θ = bearingDeg * D2R, δ = distM / R_MOON_M;
  const sinφ2 = Math.sin(φ) * Math.cos(δ) + Math.cos(φ) * Math.sin(δ) * Math.cos(θ);
  const φ2 = Math.asin(Math.max(-1, Math.min(1, sinφ2)));
  const λ2 = λ + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ), Math.cos(δ) - Math.sin(φ) * sinφ2);
  return { lat: φ2 * R2D, lon: ((((λ2 * R2D + 180) % 360) + 360) % 360) - 180 };
}

/** Desplazamiento local norte/este en km -> lat/lon (vía rumbo y distancia: válido también junto al polo). */
export function offsetKm(origin: LatLon, northKm: number, eastKm: number): LatLon {
  const d = Math.hypot(northKm, eastKm) * 1000;
  if (d < 1e-6) return { ...origin };
  return destination(origin.lat, origin.lon, Math.atan2(eastKm, northKm) * R2D, d);
}

export function distanceKm(a: LatLon, b: LatLon): number {
  const φ1 = a.lat * D2R, φ2 = b.lat * D2R, dφ = φ2 - φ1, dλ = (b.lon - a.lon) * D2R;
  const h = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * R_MOON_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Base local Este/Norte/Arriba en el marco fijo lunar. */
export function enuBasis(p: LatLon) {
  const φ = p.lat * D2R, λ = p.lon * D2R;
  const sφ = Math.sin(φ), cφ = Math.cos(φ), sλ = Math.sin(λ), cλ = Math.cos(λ);
  return {
    e: [-sλ, cλ, 0] as const,
    n: [-sφ * cλ, -sφ * sλ, cφ] as const,
    u: [cφ * cλ, cφ * sλ, sφ] as const,
  };
}
export type Basis = ReturnType<typeof enuBasis>;

/** Vector unitario (marco lunar) de un astro visto con (az, el) desde una base local. */
export function azElToBody(az: number, el: number, b: Basis): [number, number, number] {
  const a = az * D2R, e = el * D2R;
  const ce = Math.cos(e), x = ce * Math.sin(a), y = ce * Math.cos(a), z = Math.sin(e);
  return [
    x * b.e[0] + y * b.n[0] + z * b.u[0],
    x * b.e[1] + y * b.n[1] + z * b.u[1],
    x * b.e[2] + y * b.n[2] + z * b.u[2],
  ];
}

/** (az, el) de una dirección del marco lunar vista desde otra base local. */
export function bodyToAzEl(v: readonly number[], b: Basis): [number, number] {
  const x = v[0] * b.e[0] + v[1] * b.e[1] + v[2] * b.e[2];
  const y = v[0] * b.n[0] + v[1] * b.n[1] + v[2] * b.n[2];
  const z = v[0] * b.u[0] + v[1] * b.u[1] + v[2] * b.u[2];
  const az = (Math.atan2(x, y) * R2D + 360) % 360;
  return [az, Math.asin(Math.max(-1, Math.min(1, z))) * R2D];
}

// ---------------------------------------------------------------------------
// Retícula hexagonal ("panal de abeja")
// Ventajas: cada celda equidista de sus 6 vecinas, cubre el área sin huecos ni
// solapes y con el menor perímetro (muestreo isótropo, sin sesgo de dirección).
// Celdas totales con k anillos: 1 + 3k(k+1)  (k=2 -> 19, k=3 -> 37, k=4 -> 61)
// ---------------------------------------------------------------------------
export interface HexCell {
  q: number;
  r: number;
  ring: number;
  eastKm: number;
  northKm: number;
}

export function hexGrid(rings: number, spacingKm: number): HexCell[] {
  const out: HexCell[] = [];
  for (let q = -rings; q <= rings; q++) {
    for (let r = Math.max(-rings, -q - rings); r <= Math.min(rings, -q + rings); r++) {
      const ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
      // "pointy-top": vecinos a distancia exacta = spacing
      out.push({ q, r, ring, eastKm: spacingKm * (q + r / 2), northKm: spacingKm * ((Math.sqrt(3) / 2) * r) });
    }
  }
  return out.sort((a, b) => a.ring - b.ring);
}

/** Proyección estereográfica polar sur (lon 0 arriba, 90°E a la derecha). x,y en unidades de 2R. */
export function southPolarStereo(lat: number, lon: number): { x: number; y: number } {
  const colat = (90 + lat) * D2R;
  const r = Math.tan(colat / 2);
  return { x: r * Math.sin(lon * D2R), y: r * Math.cos(lon * D2R) };
}
export function southPolarStereoInv(x: number, y: number): LatLon {
  const r = Math.hypot(x, y);
  return { lat: -90 + 2 * Math.atan(r) * R2D, lon: Math.atan2(x, y) * R2D };
}

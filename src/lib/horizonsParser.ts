// ============================================================================
// JPL Horizons: construcción de URL y parser del bloque $$SOE ... $$EOE
// Formato verificado (CSV_FORMAT='YES', QUANTITIES='4', ANG_FORMAT='DEG'):
//   " 2026-Nov-15 00:00,*,i,  83.605868,     2.166357,"
//   fecha, presencia solar, cuerpo interferente, Azimut, Elevación
// ============================================================================
import type { AzEl } from "./types";

export const HORIZONS_BASE = "https://ssd.jpl.nasa.gov/api/horizons.api";
export const BODY = { SUN: "10", EARTH: "399" } as const;

/** "2026-11-15T00:00:00Z" -> "2026-11-15 00:00" */
export function toHorizonsTime(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16).replace("T", " ");
}

export function buildHorizonsUrl(opts: {
  command: string;
  lat: number;
  lon: number;
  startIso: string;
  hours: number;
  stepHours?: number;
}): string {
  const step = opts.stepHours ?? 1;
  const stopIso = new Date(
    new Date(opts.startIso).getTime() + (opts.hours - 1) * step * 3600_000
  ).toISOString();
  const p: Record<string, string> = {
    format: "json",
    COMMAND: `'${opts.command}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'OBSERVER'",
    CENTER: "'coord@301'", // observador sobre la Luna
    COORD_TYPE: "'GEODETIC'",
    SITE_COORD: `'${opts.lon},${opts.lat},0'`, // E-lon, lat, alt(km)
    START_TIME: `'${toHorizonsTime(opts.startIso)}'`,
    STOP_TIME: `'${toHorizonsTime(stopIso)}'`,
    STEP_SIZE: `'${step} h'`,
    QUANTITIES: "'4'", // Azimut y elevación aparentes (sin aire)
    ANG_FORMAT: "'DEG'",
    CSV_FORMAT: "'YES'",
  };
  const qs = Object.entries(p)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  return `${HORIZONS_BASE}?${qs}`;
}

export function parseHorizonsResult(result: string): { time: string; az: number; el: number }[] {
  const s = result.indexOf("$$SOE");
  const e = result.indexOf("$$EOE");
  if (s < 0 || e < 0) {
    throw new Error("Respuesta de Horizons sin bloque $$SOE/$$EOE: " + result.slice(0, 300));
  }
  return result
    .slice(s + 5, e)
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(",");
      return {
        time: parts[0].trim(),
        az: Number(parts[3]),
        el: Number(parts[4]),
      };
    });
}

export function toAzEl(rows: { az: number; el: number }[]): AzEl[] {
  return rows.map((r) => [+r.az.toFixed(2), +r.el.toFixed(2)]);
}

// Calcula los perfiles de horizonte reales (LOLA) de los sitios curados con el MISMO
// código que usa la app (src/lib/dem.ts) y escribe public/data/sites.json.
// Uso: npx tsx scripts/compute_horizons.mts
import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";
import { setDem, undelta, horizonProfile, elevation } from "../src/lib/dem.ts";
import { decodeEphemeris, transferEphem } from "../src/lib/ephemeris.ts";
import { terrainAt } from "../src/lib/lunarMath.ts";

const root = path.resolve(import.meta.dirname, "..");
const gz = (f: string) => zlib.gunzipSync(fs.readFileSync(path.join(root, "public/data", f)));
const toI16 = (b: Buffer) => new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
setDem(undelta(toI16(gz("dem_s75_16ppd.i16.gz")), 5760), undelta(toI16(gz("dem_global_4ppd.i16.gz")), 1440));

const meta = JSON.parse(fs.readFileSync(path.join(root, "scripts/sites_meta.json"), "utf8"));
const ephBuf = gz("ephemeris_2026-11_2027-11.bin.gz");
const eph = decodeEphemeris(ephBuf.buffer.slice(ephBuf.byteOffset, ephBuf.byteOffset + ephBuf.byteLength), meta.sites.length, meta.hours);

for (const [i, s] of meta.sites.entries()) {
  const t0 = Date.now();
  s.elevationM = Math.round(elevation(s.lat, s.lon));
  s.horizonProfileDeg = horizonProfile(s.lat, s.lon);
  s.horizonSource = s.lat <= -75 ? "LOLA LDEM 16 px/° (~1,9 km), r ≤ 180 km" : "LOLA LDEM 4 px/° (~7,6 km), r ≤ 180 km";
  const e = s.ephemOrigin && (s.ephemOrigin.lat !== s.lat || s.ephemOrigin.lon !== s.lon) ? transferEphem(eph[i], s.ephemOrigin, s) : eph[i];
  let sun = 0, earth = 0;
  for (let h = 0; h < e.sunAz.length; h++) {
    if (e.sunEl[h] > terrainAt(s.horizonProfileDeg, e.sunAz[h])) sun++;
    if (e.earthEl[h] > terrainAt(s.horizonProfileDeg, e.earthAz[h])) earth++;
  }
  const n = e.sunAz.length;
  console.log(
    s.id.padEnd(16), `elev ${s.elevationM} m`, `horizonte máx ${Math.max(...s.horizonProfileDeg).toFixed(2)}°`,
    `| Sol anual ${((sun / n) * 100).toFixed(1)}%  Tierra anual ${((earth / n) * 100).toFixed(1)}%`, `(${Date.now() - t0} ms)`
  );
}
fs.writeFileSync(path.join(root, "public/data/sites.json"), JSON.stringify(meta));
console.log("OK public/data/sites.json");

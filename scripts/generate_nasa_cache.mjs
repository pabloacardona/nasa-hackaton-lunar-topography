// Regenera la caché binaria de efemérides desde JPL Horizons (necesita internet).
// Uso: node scripts/generate_nasa_cache.mjs [inicioISO] [horas]
//   por defecto: 2026-11-01T00:00:00Z, 8784 h (366 días)
// Formato (src/lib/ephemeris.ts): por sitio [sunAz u16, sunEl i16, earthAz u16, earthEl i16] × N, valores ×100, gzip.
// Las efemérides se piden en `ephemOrigin` de cada sitio (scripts/sites_meta.json).
// Después ejecuta: npx tsx scripts/compute_horizons.mts
import fs from "node:fs";
import zlib from "node:zlib";

const root = new URL("..", import.meta.url);
const meta = JSON.parse(fs.readFileSync(new URL("scripts/sites_meta.json", root), "utf8"));
const start = process.argv[2] ?? meta.startUtc;
const N = Number(process.argv[3] ?? meta.hours);

const fmt = (d) => d.toISOString().slice(0, 16).replace("T", " ");
const url = (cmd, lat, lon, s, e) =>
  "https://ssd.jpl.nasa.gov/api/horizons.api?" +
  Object.entries({
    format: "json", COMMAND: `'${cmd}'`, OBJ_DATA: "'NO'", MAKE_EPHEM: "'YES'", EPHEM_TYPE: "'OBSERVER'",
    CENTER: "'coord@301'", COORD_TYPE: "'GEODETIC'", SITE_COORD: `'${lon},${lat},0'`,
    START_TIME: `'${fmt(s)}'`, STOP_TIME: `'${fmt(e)}'`, STEP_SIZE: "'1 h'",
    QUANTITIES: "'4'", ANG_FORMAT: "'DEG'", CSV_FORMAT: "'YES'",
  }).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");

const buf = Buffer.alloc(meta.sites.length * 4 * N * 2);
for (const [si, site] of meta.sites.entries()) {
  const o = site.ephemOrigin ?? site;
  for (const [bi, cmd] of [[0, "10"], [1, "399"]]) {
    const s = new Date(start), e = new Date(s.getTime() + (N - 1) * 3600e3);
    const j = await (await fetch(url(cmd, o.lat, o.lon, s, e))).json();
    const rows = j.result.slice(j.result.indexOf("$$SOE") + 5, j.result.indexOf("$$EOE")).trim().split("\n");
    if (rows.length !== N) throw new Error(`${site.id}/${cmd}: ${rows.length} filas (esperado ${N})`);
    const azOff = (si * 4 + bi * 2) * N * 2, elOff = azOff + N * 2;
    rows.forEach((r, i) => {
      const p = r.split(",");
      buf.writeUInt16LE(Math.round((Number(p[3]) % 360) * 100), azOff + i * 2);
      buf.writeInt16LE(Math.round(Number(p[4]) * 100), elOff + i * 2);
    });
    console.log(site.id, cmd === "10" ? "Sol" : "Tierra", rows.length);
    await new Promise((r) => setTimeout(r, 300));
  }
}
const name = `ephemeris_${start.slice(0, 7)}_${new Date(new Date(start).getTime() + N * 3600e3).toISOString().slice(0, 7)}.bin.gz`;
fs.writeFileSync(new URL(`public/data/${name}`, root), zlib.gzipSync(buf, { level: 9 }));
meta.startUtc = new Date(start).toISOString();
meta.hours = N;
meta.ephemerisFile = `/data/${name}`;
fs.writeFileSync(new URL("scripts/sites_meta.json", root), JSON.stringify(meta, null, 1));
console.log("OK ->", name, "· ahora ejecuta: npx tsx scripts/compute_horizons.mts");

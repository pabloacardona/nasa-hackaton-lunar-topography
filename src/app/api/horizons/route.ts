// Proxy a JPL Horizons para coordenadas personalizadas o fechas fuera de la caché.
// GET /api/horizons?lat=-84.6&lon=31&start=2026-11-15T00:00:00Z&hours=720
import { NextRequest, NextResponse } from "next/server";
import { BODY, buildHorizonsUrl, parseHorizonsResult, toAzEl } from "@/lib/horizonsParser";

async function fetchBody(command: string, lat: number, lon: number, start: string, hours: number) {
  const url = buildHorizonsUrl({ command, lat, lon, startIso: start, hours });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Horizons HTTP ${res.status}`);
  const json = (await res.json()) as { result?: string; error?: string };
  if (json.error) throw new Error(json.error);
  return toAzEl(parseHorizonsResult(json.result ?? ""));
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lon = Number(sp.get("lon"));
  const start = sp.get("start") ?? new Date().toISOString();
  const hours = Math.min(Number(sp.get("hours") ?? 720), 2000);

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90) {
    return NextResponse.json({ error: "lat/lon inválidos" }, { status: 400 });
  }
  try {
    const [sun, earth] = await Promise.all([
      fetchBody(BODY.SUN, lat, lon, start, hours),
      fetchBody(BODY.EARTH, lat, lon, start, hours),
    ]);
    return NextResponse.json({ startUtc: new Date(start).toISOString(), stepHours: 1, sun, earth });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}

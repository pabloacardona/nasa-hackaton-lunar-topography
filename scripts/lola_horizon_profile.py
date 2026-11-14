"""
Calcula el perfil de horizonte (360°) de un sitio a partir de un DEM LOLA (GeoTIFF).

Fuente de DEMs del polo sur (5 m/píxel, proyección estereográfica polar):
  https://pgda.gsfc.nasa.gov/products/78   y   https://pgda.gsfc.nasa.gov/products/81

Uso:
  pip install rasterio numpy pyproj
  python scripts/lola_horizon_profile.py DEM.tif --lat -84.6 --lon 31.0 --site mons_mouton

Escribe horizonProfileDeg en public/data/curated_sites.json para ese sitio.

Fórmula (sin atmósfera, con curvatura lunar R = 1737.4 km):
  theta(az) = max_d [ atan((h(d) - h0) / d) - d / (2R) ]
"""
import argparse
import json
import math
from pathlib import Path

import numpy as np
import rasterio
from pyproj import CRS, Transformer

R_MOON = 1_737_400.0  # m
DATA = Path(__file__).resolve().parents[1] / "public" / "data" / "curated_sites.json"

# Esfera lunar (IAU 30100) geográfica
MOON_GEO = CRS.from_proj4(f"+proj=longlat +a={R_MOON} +b={R_MOON} +no_defs")


def horizon_profile(dem_path: str, lat: float, lon: float, max_km: float = 30, step_m: float | None = None,
                    lander_height_m: float = 2.0) -> list[float]:
    with rasterio.open(dem_path) as src:
        dem = src.read(1).astype("float64")
        nodata = src.nodata
        if nodata is not None:
            dem[dem == nodata] = np.nan
        # Algunos DEM vienen en km
        if np.nanmax(np.abs(dem)) < 50:
            dem *= 1000.0
        to_xy = Transformer.from_crs(MOON_GEO, src.crs, always_xy=True)
        x0, y0 = to_xy.transform(lon, lat)
        res = abs(src.transform.a)
        step = step_m or res
        inv = ~src.transform

        def sample(x, y):
            c, r = inv * (x, y)
            r, c = int(r), int(c)
            if 0 <= r < dem.shape[0] and 0 <= c < dem.shape[1]:
                return dem[r, c]
            return np.nan

        h0 = sample(x0, y0) + lander_height_m
        # El norte local en proyección polar apunta hacia el polo; se calcula su dirección
        xn, yn = to_xy.transform(lon, min(lat + 0.01, 89.999) if lat < 0 else lat + 0.01)
        north = math.atan2(xn - x0, yn - y0)

        prof = []
        dists = np.arange(step, max_km * 1000, step)
        for az in range(360):
            a = north + math.radians(az)
            best = -90.0
            for d in dists:
                h = sample(x0 + d * math.sin(a), y0 + d * math.cos(a))
                if np.isnan(h):
                    continue
                ang = math.degrees(math.atan((h - h0) / d) - d / (2 * R_MOON))
                best = max(best, ang)
            prof.append(round(max(best, -2.0), 2))
        return prof


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dem")
    ap.add_argument("--lat", type=float, required=True)
    ap.add_argument("--lon", type=float, required=True)
    ap.add_argument("--site", required=True)
    ap.add_argument("--max-km", type=float, default=30)
    args = ap.parse_args()

    prof = horizon_profile(args.dem, args.lat, args.lon, args.max_km)
    ds = json.loads(DATA.read_text())
    for s in ds["sites"]:
        if s["id"] == args.site:
            s["horizonProfileDeg"] = prof
            s["horizonSource"] = f"LOLA DEM {Path(args.dem).name}"
            break
    else:
        raise SystemExit(f"Sitio {args.site} no encontrado")
    DATA.write_text(json.dumps(ds, separators=(",", ":")))
    print(args.site, "max", max(prof), "min", min(prof))


if __name__ == "__main__":
    main()

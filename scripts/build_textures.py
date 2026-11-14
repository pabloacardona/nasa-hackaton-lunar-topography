"""
Pipeline de texturas PBR para Lunar Mission Navigator.

Entradas (NASA, dominio público) en scripts/tex_src/:
  - lroc_color_2k.jpg      CGI Moon Kit (LRO LROC WAC)   https://svs.gsfc.nasa.gov/4720
  - ldem_3_8bit.jpg        CGI Moon Kit (LRO LOLA DEM)   https://svs.gsfc.nasa.gov/4720
  - earth_bmng_dec_2k.jpg  Blue Marble Next Gen (dic.)   https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/

Salidas en public/textures/ (WebP, mipmaps se generan en GPU):
  moon/    moon_albedo_{2k,1k}.webp, moon_normal_{2k,1k}.webp
  earth/   earth_day_{2k,1k}.webp
  regolith/ regolith_{albedo,normal,orm}_{2k,1k}.webp   (tileable, procedural)
  lander/  mli_{albedo,normal,orm}_1k.webp, solar_{albedo,normal,orm}_1k.webp
  vfx/     glow_256.webp, dust_64.webp, flare_ring_256.webp

ORM = R: ambient occlusion, G: roughness, B: metalness  (un solo archivo para 3 mapas)

Uso:  python scripts/build_textures.py [--size 4096]   (requiere numpy y pillow)
"""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(__file__).resolve().parent / "tex_src"
OUT = ROOT / "public" / "textures"
rng = np.random.default_rng(42)


# ---------------------------------------------------------------- utilidades
def save(arr: np.ndarray, path: Path, q=86, sizes=(2048, 1024), lossless=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    im = Image.fromarray(arr)
    for s in sizes:
        w = s
        h = int(round(im.height * s / im.width))
        tag = f"{s // 1024}k" if s >= 1024 else str(s)
        out = path.with_name(f"{path.stem}_{tag}.webp")
        im.resize((w, h), Image.LANCZOS).save(out, "WEBP", quality=q, method=6, lossless=lossless)
        print(f"  {out.relative_to(ROOT)}  {out.stat().st_size // 1024} KB")


def periodic_fbm(n, octaves=7, beta=2.0, seed=0):
    """Ruido fractal tileable (síntesis espectral: periódico por construcción)."""
    r = np.random.default_rng(seed)
    kx = np.fft.fftfreq(n)[:, None]
    ky = np.fft.fftfreq(n)[None, :]
    k = np.sqrt(kx**2 + ky**2)
    k[0, 0] = 1
    spec = (r.normal(size=(n, n)) + 1j * r.normal(size=(n, n))) / k ** (beta / 2 + 0.5)
    spec[0, 0] = 0
    f = np.real(np.fft.ifft2(spec))
    f = (f - f.min()) / (f.max() - f.min())
    return f


def craters(n, count, rmin, rmax, seed=1):
    """Cráteres tileables (cuenco + borde elevado), con envoltura en los bordes."""
    r = np.random.default_rng(seed)
    h = np.zeros((n, n), np.float32)
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    for _ in range(count):
        cx, cy = r.uniform(0, n, 2)
        rad = rmin * (rmax / rmin) ** (r.uniform(0, 1) ** 2.5)  # ley de potencia: muchos pequeños, pocos grandes
        deg = r.uniform(0.35, 1.0)  # cráteres viejos más erosionados
        dx = np.minimum(np.abs(xx - cx), n - np.abs(xx - cx))
        dy = np.minimum(np.abs(yy - cy), n - np.abs(yy - cy))
        d = np.sqrt(dx**2 + dy**2) / rad
        bowl = np.where(d < 1, (d**2 - 1) * 0.8, 0)
        rim = 0.3 * np.exp(-((d - 1.0) ** 2) / (0.03 + 0.08 * (1 - deg)))
        ejecta = np.where(d > 1, 0.1 * np.exp(-(d - 1) * 2.5), 0)
        h += (bowl + rim + ejecta) * deg * (rad / rmax) ** 0.7
    return h


def normal_from_height(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * strength
    nz = np.ones_like(h)
    l = np.sqrt(dx**2 + dy**2 + nz**2)
    # Convención OpenGL (three.js): Y hacia arriba
    return np.stack([(-dx / l + 1) * 127.5, (dy / l + 1) * 127.5, (nz / l + 1) * 127.5], -1)


def ao_from_height(h, radius=6):
    blur = h.copy()
    for _ in range(radius):
        blur = (blur + np.roll(blur, 1, 0) + np.roll(blur, -1, 0) + np.roll(blur, 1, 1) + np.roll(blur, -1, 1)) / 5
    ao = 1 - np.clip((blur - h) * 6, 0, 0.6)
    return ao


# ---------------------------------------------------------------- NASA
def nasa_maps(size):
    print("Luna (LROC + LOLA)")
    color = np.asarray(Image.open(SRC / "lroc_color_2k.jpg").convert("RGB"), np.float32)
    save(color, OUT / "moon" / "moon_albedo.webp", q=88, sizes=(size, 1024))
    dem = np.asarray(Image.open(SRC / "ldem_3_8bit.jpg").convert("L").resize((2048, 1024), Image.BICUBIC), np.float32) / 255
    save(normal_from_height(dem, 18), OUT / "moon" / "moon_normal.webp", q=90, sizes=(size, 1024))

    print("Tierra (Blue Marble)")
    earth = np.asarray(Image.open(SRC / "earth_bmng_dec_2k.jpg").convert("RGB"), np.float32)
    save(earth, OUT / "earth" / "earth_day.webp", q=88, sizes=(size, 1024))


# ---------------------------------------------------------------- regolito
def regolith(n):
    print("Regolito (tileable)")
    base = periodic_fbm(n, beta=2.2, seed=3)
    fine = periodic_fbm(n, beta=1.2, seed=4)
    cr = craters(n, 420, n * 0.003, n * 0.08, seed=5)
    mid = periodic_fbm(n, beta=1.6, seed=6)
    h = base * 0.7 + cr * 0.55 + mid * 0.25 + fine * 0.12
    h = (h - h.min()) / (h.max() - h.min())

    grain = rng.normal(0, 1, (n, n))
    tone = 0.6 + (base - 0.5) * 0.22 + (mid - 0.5) * 0.14 + (fine - 0.5) * 0.08 + grain * 0.02
    tone += np.clip(cr, 0, None) * 0.07  # eyecta algo más clara (material fresco)
    rgb = np.stack([tone * 1.0, tone * 0.985, tone * 0.955], -1) * 255
    save(rgb, OUT / "regolith" / "regolith_albedo.webp", sizes=(n, 1024))
    save(normal_from_height(h, 45), OUT / "regolith" / "regolith_normal.webp", q=80, sizes=(n, 1024))
    ao = ao_from_height(h)
    rough = 0.88 + (fine - 0.5) * 0.1
    orm = np.stack([ao, rough, np.zeros_like(ao)], -1) * 255
    save(orm, OUT / "regolith" / "regolith_orm.webp", sizes=(n, 1024))


# ---------------------------------------------------------------- lander
def lander():
    n = 1024
    print("Lander: aislante MLI dorado")
    crinkle = periodic_fbm(n, beta=0.8, seed=8) * 0.7 + periodic_fbm(n, beta=1.6, seed=9) * 0.3
    albedo = np.stack([0.83 + crinkle * 0.1, 0.62 + crinkle * 0.08, 0.25 + crinkle * 0.05], -1) * 255
    save(albedo, OUT / "lander" / "mli_albedo.webp", sizes=(n,))
    save(normal_from_height(crinkle, 40), OUT / "lander" / "mli_normal.webp", q=78, sizes=(n,))
    orm = np.stack([np.ones_like(crinkle), 0.22 + crinkle * 0.25, np.full_like(crinkle, 1.0)], -1) * 255
    save(orm, OUT / "lander" / "mli_orm.webp", sizes=(n,))

    print("Lander: celdas solares")
    yy, xx = np.mgrid[0:n, 0:n]
    cell = 64
    gx, gy = xx % cell, yy % cell
    gap = (gx < 3) | (gy < 3)
    finger = (gx % 8 == 0) & ~gap
    h = np.where(gap, 0.0, 1.0) - finger * 0.2
    albedo = np.where(gap[..., None], [[180, 180, 185]], [[18, 30, 72]]).astype(np.float32)
    albedo[finger] = [120, 125, 140]
    albedo += rng.normal(0, 3, albedo.shape)
    save(albedo, OUT / "lander" / "solar_albedo.webp", sizes=(n,))
    save(normal_from_height(h.astype(np.float32), 3), OUT / "lander" / "solar_normal.webp", sizes=(n,))
    orm = np.stack([np.ones_like(h), np.where(gap, 0.5, 0.12), np.where(gap, 0.9, 0.3)], -1) * 255
    save(orm, OUT / "lander" / "solar_orm.webp", sizes=(n,))


# ---------------------------------------------------------------- vfx
def vfx():
    print("VFX sprites")
    for name, n, fn in [
        ("glow", 256, lambda d: (np.exp(-d * 4.5) + 0.25 * np.exp(-d * 1.2)) * (1 - d) ** 2),
        ("dust", 64, lambda d: np.clip(1 - d, 0, 1) ** 2),
        ("flare_ring", 256, lambda d: np.exp(-((d - 0.72) ** 2) / 0.002) * 0.8),
    ]:
        yy, xx = np.mgrid[-1:1:n * 1j, -1:1:n * 1j]
        d = np.sqrt(xx**2 + yy**2)
        a = np.clip(fn(d), 0, 1) * (d < 1)
        rgba = np.stack([np.ones_like(a), np.ones_like(a), np.ones_like(a), a], -1) * 255
        p = OUT / "vfx" / f"{name}_{n}.webp"
        p.parent.mkdir(parents=True, exist_ok=True)
        Image.fromarray(rgba.astype(np.uint8), "RGBA").save(p, "WEBP", quality=90)
        print(f"  {p.relative_to(ROOT)}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--size", type=int, default=2048, help="Resolución alta (2048 o 4096)")
    a = ap.parse_args()
    nasa_maps(a.size)
    regolith(a.size)
    lander()
    vfx()

"use client";
// Carga de texturas PBR con configuración optimizada (sRGB solo en albedo, anisotropía, repetición).
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { TIER, type Tier } from "@/store/useGfxStore";

const T = "/textures";

export const texPaths = (tier: Tier) => {
  const r = TIER[tier].tex;
  return {
    moon: {
      map: `${T}/moon/moon_albedo_${tier === "high" ? "4k" : "1k"}.webp`,
      normalMap: `${T}/moon/moon_normal_${tier === "high" ? "4k" : "1k"}.webp`,
    },
    polarMap: `${T}/moon/south_pole_map_1k.webp`,
    earth: { map: `${T}/earth/earth_day_${r}.webp` },
    regolith: {
      map: `${T}/regolith/regolith_albedo_${r}.webp`,
      normalMap: `${T}/regolith/regolith_normal_${r}.webp`,
      orm: `${T}/regolith/regolith_orm_${r}.webp`,
    },
    mli: { map: `${T}/lander/mli_albedo_1k.webp`, normalMap: `${T}/lander/mli_normal_1k.webp`, orm: `${T}/lander/mli_orm_1k.webp` },
    solar: { map: `${T}/lander/solar_albedo_1k.webp`, normalMap: `${T}/lander/solar_normal_1k.webp`, orm: `${T}/lander/solar_orm_1k.webp` },
    vfx: { glow: `${T}/vfx/glow_256.webp`, dust: `${T}/vfx/dust_64.webp`, ring: `${T}/vfx/flare_ring_256.webp` },
  };
};

function configure(t: THREE.Texture, srgb: boolean, repeat: number, aniso: number, tile = false) {
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  if (tile || repeat !== 1) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
  }
  t.needsUpdate = true;
  return t;
}

/** Set PBR (albedo + normal + ORM). ORM: R=AO, G=roughness, B=metalness. */
export function usePbrSet(
  set: { map: string; normalMap: string; orm?: string },
  opts: { repeat?: number; aniso?: number; tile?: boolean } = {}
) {
  const urls = set.orm ? [set.map, set.normalMap, set.orm] : [set.map, set.normalMap];
  const tex = useTexture(urls) as THREE.Texture[];
  const repeat = opts.repeat ?? 1;
  const aniso = opts.aniso ?? 8;
  const tile = opts.tile ?? false;
  configure(tex[0], true, repeat, aniso, tile);
  configure(tex[1], false, repeat, aniso, tile);
  if (tex[2]) configure(tex[2], false, repeat, aniso, tile);
  return { map: tex[0], normalMap: tex[1], orm: tex[2] as THREE.Texture | undefined };
}

export function useSrgbTexture(url: string, aniso = 8) {
  const t = useTexture(url) as THREE.Texture;
  return configure(t, true, 1, aniso);
}

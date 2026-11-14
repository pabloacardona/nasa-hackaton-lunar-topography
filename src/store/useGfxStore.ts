"use client";
// Calidad gráfica adaptativa: "auto" baja a "low" si los FPS caen (PerformanceMonitor).
import { create } from "zustand";

export type QualityPref = "auto" | "high" | "low";
export type Tier = "high" | "low";

interface GfxState {
  pref: QualityPref;
  autoTier: Tier;
  vfx: boolean;
  setPref: (p: QualityPref) => void;
  setAutoTier: (t: Tier) => void;
  setVfx: (v: boolean) => void;
}

export const useGfxStore = create<GfxState>((set) => ({
  pref: "auto",
  autoTier: "high",
  vfx: true,
  setPref: (pref) => set({ pref }),
  // Solo baja (nunca vuelve a subir sola): evita reconstruir terreno/texturas/shaders en bucle
  setAutoTier: (autoTier) => set((s) => (s.autoTier === "low" && autoTier === "high" ? {} : { autoTier })),
  setVfx: (vfx) => set({ vfx }),
}));

export const useTier = (): Tier =>
  useGfxStore((s) => (s.pref === "auto" ? s.autoTier : s.pref));

/** Parámetros de render por nivel de calidad. */
export const TIER = {
  high: { tex: "2k", dpr: [1, 1.75] as [number, number], shadow: 2048, terrainRings: 120, dust: 1400, bloom: true, godRays: true, aniso: 8 },
  low: { tex: "1k", dpr: [0.75, 1] as [number, number], shadow: 1024, terrainRings: 60, dust: 400, bloom: true, godRays: false, aniso: 4 },
} as const;

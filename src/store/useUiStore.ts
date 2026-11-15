"use client";
// Estado de interfaz: tour, informe, demo, panal (resultados + foco de la cámara del globo).
import { create } from "zustand";
import type { HoneyResult } from "@/lib/honeycomb";
import type { ScenarioLabel } from "@/lib/types";

export interface HoneyState {
  center: ScenarioLabel;
  centerLat: number;
  centerLon: number;
  spacingKm: number;
  rings: number;
  results: HoneyResult[];
}

interface UiState {
  tourStep: number | null;
  briefOpen: boolean;
  briefText: string;
  demoRunning: boolean;
  honey: HoneyState | null;
  /** Progreso del cálculo del panal (null = inactivo) */
  honeyBusy: { done: number; total: number } | null;
  honeySpacingKm: number;
  honeyRings: number;
  honeyError: string | null;
  /** Índice de la celda seleccionada en honey.results */
  honeySel: number | null;
  /** Foco de la cámara del globo (nonce cambia en cada clic para re-animar) */
  globeFocus: { lat: number; lon: number; extentKm: number; nonce: number } | null;
  setTourStep: (s: number | null) => void;
  openBrief: (text: string) => void;
  closeBrief: () => void;
  setDemoRunning: (v: boolean) => void;
  setHoney: (h: HoneyState | null) => void;
  setHoneyBusy: (b: UiState["honeyBusy"]) => void;
  setHoneySpacing: (km: number) => void;
  setHoneyRings: (n: number) => void;
  setHoneyError: (e: string | null) => void;
  setHoneySel: (i: number | null) => void;
  focusGlobe: (lat: number, lon: number, extentKm: number) => void;
  clearGlobeFocus: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  tourStep: null,
  briefOpen: false,
  briefText: "",
  demoRunning: false,
  honey: null,
  honeyBusy: null,
  honeySpacingKm: 2,
  honeyRings: 3,
  honeyError: null,
  honeySel: null,
  globeFocus: null,
  setTourStep: (tourStep) => set({ tourStep }),
  openBrief: (briefText) => set({ briefOpen: true, briefText }),
  closeBrief: () => set({ briefOpen: false }),
  setDemoRunning: (demoRunning) => set({ demoRunning }),
  setHoney: (honey) => set({ honey, honeySel: null }),
  setHoneyBusy: (honeyBusy) => set({ honeyBusy }),
  setHoneySpacing: (honeySpacingKm) => set({ honeySpacingKm }),
  setHoneyRings: (honeyRings) => set({ honeyRings }),
  setHoneyError: (honeyError) => set({ honeyError }),
  setHoneySel: (honeySel) => set({ honeySel }),
  focusGlobe: (lat, lon, extentKm) => set((s) => ({ globeFocus: { lat, lon, extentKm, nonce: (s.globeFocus?.nonce ?? 0) + 1 } })),
  clearGlobeFocus: () => set({ globeFocus: null }),
}));

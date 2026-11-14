"use client";
// Estado de interfaz: tour guiado, informe de misión, demo narrada y resultados del panal.
import { create } from "zustand";
import type { HoneyResult } from "@/lib/honeycomb";
import type { ScenarioLabel } from "@/lib/types";

interface UiState {
  tourStep: number | null;
  briefOpen: boolean;
  briefText: string;
  demoRunning: boolean;
  honey: { center: ScenarioLabel; spacingKm: number; results: HoneyResult[] } | null;
  setTourStep: (s: number | null) => void;
  openBrief: (text: string) => void;
  closeBrief: () => void;
  setDemoRunning: (v: boolean) => void;
  setHoney: (h: UiState["honey"]) => void;
}

export const useUiStore = create<UiState>((set) => ({
  tourStep: null,
  briefOpen: false,
  briefText: "",
  demoRunning: false,
  honey: null,
  setTourStep: (tourStep) => set({ tourStep }),
  openBrief: (briefText) => set({ briefOpen: true, briefText }),
  closeBrief: () => set({ briefOpen: false }),
  setDemoRunning: (demoRunning) => set({ demoRunning }),
  setHoney: (honey) => set({ honey }),
}));

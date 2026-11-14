// Muestreo interpolado del timeline en una hora fraccionaria (para animación suave sin re-render de React).
import type { HourSample } from "@/lib/types";
import { useMissionStore } from "@/store/useMissionStore";

const lerpAngle = (a: number, b: number, t: number) => {
  const d = ((b - a + 540) % 360) - 180;
  return (a + d * t + 360) % 360;
};

export interface FrameSample {
  sunAz: number;
  sunEl: number;
  earthAz: number;
  earthEl: number;
  sunVisible: boolean;
  earthVisible: boolean;
  dte: HourSample["dte"];
  hour: number;
}

export function sampleTimeline(tl: HourSample[], p: number, out: FrameSample): FrameSample | null {
  if (!tl.length) return null;
  const i0 = Math.min(tl.length - 1, Math.max(0, Math.floor(p)));
  const i1 = Math.min(tl.length - 1, i0 + 1);
  const f = Math.min(1, Math.max(0, p - i0));
  const a = tl[i0], b = tl[i1];
  out.sunAz = lerpAngle(a.sunAz, b.sunAz, f);
  out.sunEl = a.sunEl + (b.sunEl - a.sunEl) * f;
  out.earthAz = lerpAngle(a.earthAz, b.earthAz, f);
  out.earthEl = a.earthEl + (b.earthEl - a.earthEl) * f;
  const n = f < 0.5 ? a : b;
  out.sunVisible = n.sunVisible;
  out.earthVisible = n.earthVisible;
  out.dte = n.dte;
  out.hour = p;
  return out;
}

export const newFrameSample = (): FrameSample => ({
  sunAz: 0, sunEl: 0, earthAz: 0, earthEl: 0, sunVisible: false, earthVisible: false, dte: "none", hour: 0,
});

export const getPlayhead = () => useMissionStore.getState().playhead;

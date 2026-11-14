import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Lunar Mission Navigator — NASA Space Apps 2026",
  description:
    "Compara sitios y fechas de alunizaje: Sol y Tierra sobre el horizonte local, energía y comunicación directa.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full bg-[#020617] text-slate-100">
        <Suspense fallback={<p className="p-6 text-slate-400">Cargando simulador…</p>}>
          <Providers>{children}</Providers>
        </Suspense>
      </body>
    </html>
  );
}

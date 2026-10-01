"use client";

import { TrendingUp } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";

export default function IncomeStatementPage() {
  return (
    <div className="pl-0 md:pl-64 min-h-screen flex flex-col bg-(--color-background) w-full min-w-0 overflow-x-hidden">
      <ModuleHeader
        title="Estado de Resultados"
        subtitle="Ingresos, costos y utilidad del periodo"
        icon={TrendingUp}
        iconClassName="bg-emerald-100 text-emerald-800"
      />
      <main className="relative flex-1 min-h-0 w-full">
        <iframe
          src="/estado_resultados.html"
          title="Estado de Resultados"
          className="absolute inset-0 w-full h-full border-0"
        />
      </main>
    </div>
  );
}

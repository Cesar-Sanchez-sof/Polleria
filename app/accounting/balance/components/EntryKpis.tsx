"use client";

import { ArrowDown, Receipt, SlidersHorizontal, Store, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/services/journal-entries.service";

interface Props {
  /** true only while loading the first page (no data yet). */
  initialLoading: boolean;
  total: number;
  /** Percentage of entries with status "Registrado". */
  percentage: number;
  from: string;
  to: string;
}

/** Summary KPI row for the queried period. */
export function EntryKpis({ initialLoading, total, percentage, from, to }: Readonly<Props>) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* KPI 1: Asientos en Período */}
      <Card className="bg-white p-5 rounded-xl shadow-xs  border-0! flex flex-row items-center justify-between transition-all hover:shadow-sm">
        <div className="flex flex-col">
          <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
            Asientos en Período
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">
              {initialLoading ? "…" : total}
            </span>
            <Badge className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border-emerald-200 shadow-none">
              {percentage}% Validados
            </Badge>
          </div>
          <span className="text-slate-500 text-xs mt-1">
            {from || to
              ? `Rango: ${from ? formatDate(from) : "inicio"} – ${to ? formatDate(to) : "hoy"}`
              : "Período completo: may – jun 2025"}
          </span>
        </div>
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-red-700">
          <Receipt className="w-6 h-6" />
        </div>
      </Card>

      {/* KPI 2: Facturación Clientes */}
      <Card className="bg-white p-5 rounded-xl shadow-xs   flex flex-row items-center justify-between transition-all hover:shadow-sm">
        <div className="flex flex-col">
          <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
            Facturación Clientes
          </span>
          <div className="flex flex-col items-baseline mt-1">
            <span className="text-xl font-bold text-slate-900">S/ 1,420,850.00</span>
            <span className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> +14.2% vs mayo
            </span>
          </div>
        </div>
        <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center text-sky-700">
          <Receipt className="w-6 h-6" />
        </div>
      </Card>

      {/* KPI 3: Facturas Proveedor */}
      <Card className="bg-white p-5 rounded-xl shadow-xs   flex flex-row items-center justify-between transition-all hover:shadow-sm">
        <div className="flex flex-col">
          <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
            Facturas Proveedor
          </span>
          <div className="flex flex-col items-baseline mt-1">
            <span className="text-xl font-bold text-slate-900">S/ 895,400.00</span>
            <span className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <ArrowDown className="w-3.5 h-3.5" /> 16 asientos asociados
            </span>
          </div>
        </div>
        <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
          <Store className="w-6 h-6" />
        </div>
      </Card>

      {/* KPI 4: Ajustes & Operaciones */}
      <Card className="bg-white p-5 rounded-xl shadow-xs   flex flex-row items-center justify-between transition-all hover:shadow-sm">
        <div className="flex flex-col">
          <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
            Ajustes &amp; Operaciones
          </span>
          <div className="flex flex-col items-baseline mt-1">
            <span className="text-xl font-bold text-slate-900">S/ 48,250.00</span>
            <span className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5" /> 4 asientos manuales
            </span>
          </div>
        </div>
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
          <SlidersHorizontal className="w-6 h-6" />
        </div>
      </Card>
    </div>
  );
}

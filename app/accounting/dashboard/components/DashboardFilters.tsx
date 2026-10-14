"use client";

import {
  CalendarDays,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  Calendar,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPresetRange, shiftRange } from "./dashboard-utils";

interface DashboardFiltersProps {
  desde: string;
  hasta: string;
  onChange: (desde: string, hasta: string) => void;
  onLast12Months: () => void;
  hasOpenPeriod: boolean;
  onOpenPeriod: () => void;
  loading: boolean;
  onRefresh?: () => void;
  onExportCsv?: () => void;
}

export function DashboardFilters({
  desde,
  hasta,
  onChange,
  onLast12Months,
  hasOpenPeriod,
  onOpenPeriod,
  loading,
  onRefresh,
  onExportCsv,
}: Readonly<DashboardFiltersProps>) {
  const handlePreset = (preset: "current_month" | "previous_month" | "current_quarter" | "ytd" | "last_6_months") => {
    const range = getPresetRange(preset);
    onChange(range.desde, range.hasta);
  };

  const handleShift = (direction: "prev" | "next") => {
    const range = shiftRange(desde, hasta, direction);
    onChange(range.desde, range.hasta);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-3.5">
      {/* Fila 1: Filtro de fechas directo + atajos de navegación y exportación */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Controles de Fechas */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Navegación paso a paso de período */}
          <div className="inline-flex items-center rounded-lg border border-border bg-background p-0.5 shadow-2xs">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => handleShift("prev")}
              title="Período anterior de igual duración"
              disabled={loading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-1 text-xs text-muted-foreground select-none">|</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => handleShift("next")}
              title="Período siguiente de igual duración"
              disabled={loading}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-1.5 bg-background border border-border rounded-lg px-2.5 py-1 shadow-2xs">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-medium text-muted-foreground">Desde:</span>
              <input
                type="date"
                value={desde}
                onChange={(e) => onChange(e.target.value, hasta)}
                className="bg-transparent text-xs font-semibold text-foreground focus:outline-hidden cursor-pointer"
              />
              <span className="text-muted-foreground">—</span>
              <span className="font-medium text-muted-foreground">Hasta:</span>
              <input
                type="date"
                value={hasta}
                onChange={(e) => onChange(desde, e.target.value)}
                className="bg-transparent text-xs font-semibold text-foreground focus:outline-hidden cursor-pointer"
              />
            </div>
          </div>

          {onRefresh && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 px-2.5 shadow-2xs"
              onClick={onRefresh}
              disabled={loading}
              title="Recargar datos contables"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-primary" : "text-muted-foreground"}`} />
              <span className="hidden sm:inline text-xs">Actualizar</span>
            </Button>
          )}
        </div>

        {/* Acciones de reporte */}
        <div className="flex items-center gap-2">
          {onExportCsv && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs shadow-2xs"
              onClick={onExportCsv}
              title="Descargar datos en CSV para Excel"
            >
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Exportar CSV</span>
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs shadow-2xs"
            onClick={handlePrint}
            title="Imprimir resumen ejecutivo"
          >
            <Printer className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Imprimir</span>
          </Button>
        </div>
      </div>

      {/* Fila 2: Chips de rangos preestablecidos */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/50">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">
          Atajos rápidos:
        </span>
        {hasOpenPeriod && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 text-xs font-medium rounded-full px-3 gap-1 bg-primary/10 text-primary hover:bg-primary/20"
            onClick={onOpenPeriod}
          >
            <CalendarDays className="h-3 w-3" />
            Periodo contable abierto
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs font-normal rounded-full px-2.5"
          onClick={() => handlePreset("current_month")}
        >
          Este mes
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs font-normal rounded-full px-2.5"
          onClick={() => handlePreset("previous_month")}
        >
          Mes anterior
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs font-normal rounded-full px-2.5"
          onClick={() => handlePreset("current_quarter")}
        >
          Este trimestre
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs font-normal rounded-full px-2.5"
          onClick={() => handlePreset("ytd")}
        >
          Año actual (YTD)
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs font-normal rounded-full px-2.5"
          onClick={() => handlePreset("last_6_months")}
        >
          Últimos 6 meses
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs font-normal rounded-full px-2.5 gap-1"
          onClick={onLast12Months}
        >
          <RotateCcw className="h-3 w-3 text-muted-foreground" />
          Últimos 12 meses
        </Button>
      </div>
    </div>
  );
}

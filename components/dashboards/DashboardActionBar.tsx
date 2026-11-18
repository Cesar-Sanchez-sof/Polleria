"use client";

import React, { useState } from "react";
import { useSWRConfig } from "swr";
import {
  Calendar as CalendarIcon,
  RefreshCw,
  Maximize,
  Minimize,
  SlidersHorizontal,
  ChevronDown,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useDashboardEditorStore } from "@/lib/store/dashboard-editor-store";
import type { DatePreset } from "@/lib/dashboards/widget-schema";
import { formatUtcYmd } from "@/lib/dashboards/date-utils";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

const DATE_OPTIONS: { preset: DatePreset; label: string }[] = [
  { preset: "thisMonth", label: "Este mes" },
  { preset: "lastMonth", label: "Mes pasado" },
  { preset: "thisYear", label: "Este año" },
  { preset: "today", label: "Hoy" },
];

interface DashboardActionBarProps {
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
}

export function DashboardActionBar({
  onToggleFullscreen,
  isFullscreen = false,
}: DashboardActionBarProps) {
  const { mutate } = useSWRConfig();
  const globalDateRange = useDashboardEditorStore((s) => s.globalDateRange);
  const setGlobalDateRange = useDashboardEditorStore((s) => s.setGlobalDateRange);
  const isRefreshing = useDashboardEditorStore((s) => s.isRefreshing);
  const setIsRefreshing = useDashboardEditorStore((s) => s.setIsRefreshing);

  const [customRange, setCustomRange] = useState<DateRange | undefined>(() => {
    if (globalDateRange?.preset === "custom" && globalDateRange.from && globalDateRange.to) {
      return {
        from: new Date(globalDateRange.from + "T00:00:00"),
        to: new Date(globalDateRange.to + "T00:00:00"),
      };
    }
    return undefined;
  });

  const [popoverOpen, setPopoverOpen] = useState(false);

  // Etiqueta del botón actual de fecha
  const currentLabel = React.useMemo(() => {
    if (!globalDateRange) return "Fecha global (Predeterminada)";
    if (globalDateRange.preset === "custom") {
      if (globalDateRange.from && globalDateRange.to) {
        return `${globalDateRange.from} al ${globalDateRange.to}`;
      }
      return "Rango personalizado";
    }
    const found = DATE_OPTIONS.find((o) => o.preset === globalDateRange.preset);
    return found ? found.label : globalDateRange.preset;
  }, [globalDateRange]);

  const handleSelectPreset = (preset: DatePreset) => {
    setGlobalDateRange({ preset });
  };

  const handleApplyCustomRange = (range: DateRange | undefined) => {
    setCustomRange(range);
    if (range?.from && range?.to) {
      const fromStr = formatUtcYmd(range.from);
      const toStr = formatUtcYmd(range.to);
      setGlobalDateRange({
        preset: "custom",
        from: fromStr,
        to: toStr,
      });
      setPopoverOpen(false);
    }
  };

  const handleClearDateFilter = () => {
    setGlobalDateRange(null);
    setCustomRange(undefined);
  };

  // Revalidar todas las consultas SWR de tableros
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await mutate(
        (key) => {
          if (typeof key === "string") {
            return key.includes("/api/dashboards/query") || key.includes("/widgets/") || key.includes("/data");
          }
          if (Array.isArray(key)) {
            return key.some(
              (k) =>
                typeof k === "string" &&
                (k.includes("/api/dashboards/query") || k.includes("/widgets/") || k.includes("/data"))
            );
          }
          return false;
        },
        undefined,
        { revalidate: true }
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="w-full bg-card/90 backdrop-blur-md border-b border-border/70 px-6 py-2.5 flex items-center justify-between gap-3 flex-wrap shadow-xs">
      {/* Lado izquierdo: Controles de Filtros de Fecha */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
          <SlidersHorizontal className="size-3.5 text-primary" />
          <span className="font-semibold text-foreground tracking-tight">Filtros:</span>
        </div>

        {/* 1. Selector de Presets de Fecha */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "inline-flex items-center justify-center h-8 px-3 rounded-full text-xs font-medium gap-1.5 cursor-pointer bg-background hover:bg-muted/70 border border-border/80 shadow-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              globalDateRange && "border-primary/50 bg-primary/5 text-primary font-semibold"
            )}
          >
            <CalendarIcon className="size-3.5 text-muted-foreground" />
            <span>{currentLabel}</span>
            <ChevronDown className="size-3 opacity-60 ml-0.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44 p-1">
            {DATE_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.preset}
                onClick={() => handleSelectPreset(opt.preset)}
                className={cn(
                  "text-xs cursor-pointer rounded-md font-medium px-2.5 py-1.5",
                  globalDateRange?.preset === opt.preset && "bg-primary/10 text-primary font-semibold"
                )}
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 2. Rango Personalizado vía Calendar Popover */}
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger
            className={cn(
              "inline-flex items-center justify-center h-8 px-3 rounded-full text-xs font-medium gap-1.5 cursor-pointer bg-background hover:bg-muted/70 border border-border/80 shadow-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              globalDateRange?.preset === "custom" && "border-primary/50 bg-primary/5 text-primary font-semibold"
            )}
          >
            <CalendarIcon className="size-3.5 text-muted-foreground" />
            <span>Personalizado</span>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-3" sideOffset={6}>
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-border/60">
                <span className="text-xs font-semibold text-foreground">Seleccionar Rango de Fechas</span>
                <span className="text-[10px] text-muted-foreground">Zona horaria Lima (UTC-5)</span>
              </div>
              <Calendar
                mode="range"
                selected={customRange}
                onSelect={handleApplyCustomRange}
                numberOfMonths={2}
                className="rounded-md border border-border/60 shadow-xs"
              />
              {customRange?.from && (
                <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                  <span>
                    {formatUtcYmd(customRange.from)} {customRange.to ? `al ${formatUtcYmd(customRange.to)}` : "..."}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => {
                      setCustomRange(undefined);
                      setGlobalDateRange(null);
                      setPopoverOpen(false);
                    }}
                  >
                    Limpiar
                  </Button>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Botón para remover filtro de fecha global si está activo */}
        {globalDateRange && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearDateFilter}
            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
            title="Restablecer fechas predeterminadas de los gráficos"
          >
            <X className="size-3" />
            <span>Restablecer</span>
          </Button>
        )}
      </div>

      {/* Lado derecho: Acciones de Actualizar y Pantalla Completa */}
      <div className="flex items-center gap-1.5">
        {/* 3. Botón Actualizar */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="h-8 px-3 rounded-full text-xs font-medium gap-1.5 cursor-pointer bg-background hover:bg-muted/70 border-border/80 shadow-xs"
          title="Revalidar datos de todos los gráficos"
        >
          <RefreshCw
            className={cn(
              "size-3.5 text-muted-foreground transition-transform",
              isRefreshing && "animate-spin text-primary"
            )}
          />
          <span className="hidden sm:inline">Actualizar</span>
        </Button>

        {/* 4. Botón Pantalla Completa */}
        {onToggleFullscreen && (
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleFullscreen}
            className={cn(
              "h-8 px-3 rounded-full text-xs font-medium gap-1.5 cursor-pointer bg-background hover:bg-muted/70 border-border/80 shadow-xs",
              isFullscreen && "bg-primary/10 text-primary border-primary/40 font-semibold"
            )}
            title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {isFullscreen ? (
              <>
                <Minimize className="size-3.5 text-muted-foreground" />
                <span className="hidden sm:inline">Normal</span>
              </>
            ) : (
              <>
                <Maximize className="size-3.5 text-muted-foreground" />
                <span className="hidden sm:inline">Pantalla completa</span>
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

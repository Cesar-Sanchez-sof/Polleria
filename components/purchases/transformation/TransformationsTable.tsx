"use client";

import React, { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TransformationDetailDialog,
  TransformationDetailRecord,
} from "./TransformationDetailDialog";
import { AnnulTransformationDialog } from "./AnnulTransformationDialog";
import { TablePagination } from "@/components/purchases/shared/TablePagination";
import {
  Search,
  FileText,
  Repeat,
  Package,
  Sparkles,
  Calendar,
  Layers,
  Ban,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface TransformationsTableProps {
  transformations: TransformationDetailRecord[];
}

export function TransformationsTable({ transformations }: TransformationsTableProps) {
  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState<string>("");

  // Diálogos
  const [selectedRecordForDetail, setSelectedRecordForDetail] =
    useState<TransformationDetailRecord | null>(null);
  const [selectedRecordForAnnul, setSelectedRecordForAnnul] =
    useState<TransformationDetailRecord | null>(null);

  // KPIs
  const totalTransformations = transformations.length;
  const annulledTransformations = useMemo(() => {
    return transformations.filter((t) => t.anulado).length;
  }, [transformations]);

  const totalUnitsConsumed = useMemo(() => {
    return transformations
      .filter((t) => !t.anulado)
      .reduce((sum, t) => {
        const consumos = t.items.filter((i) => i.itemType === "Consumo");
        return sum + consumos.reduce((s, c) => s + (Number(c.quantity) || 0), 0);
      }, 0);
  }, [transformations]);

  const totalUnitsProduced = useMemo(() => {
    return transformations
      .filter((t) => !t.anulado)
      .reduce((sum, t) => {
        const producidos = t.items.filter((i) => i.itemType === "Producido");
        return sum + producidos.reduce((s, p) => s + (Number(p.quantity) || 0), 0);
      }, 0);
  }, [transformations]);

  // Filtrado
  const filteredTransformations = useMemo(() => {
    return transformations.filter((t) => {
      // Filtro por estado
      if (statusFilter === "ACTIVE" && t.anulado) return false;
      if (statusFilter === "ANNULLED" && !t.anulado) return false;

      // Filtro por fecha
      if (dateFilter) {
        const itemDateStr = new Date(t.date).toISOString().split("T")[0];
        if (itemDateStr !== dateFilter) return false;
      }

      // Buscador (incluye insumos, lote, responsable, notas)
      if (searchTerm.trim() !== "") {
        const query = searchTerm.toLowerCase().trim();
        const lotNumber = `tr-${t.id.toString().padStart(4, "0")}`.toLowerCase();
        const lotNumberSimple = `tr-${t.id}`.toLowerCase();
        const employeeName = `${t.employee.firstName} ${t.employee.paternalLastName || ""}`.toLowerCase();
        const notes = (t.notes || "").toLowerCase();
        const supplyNames = t.items.map((i) => i.supply.name.toLowerCase()).join(" ");

        const matches =
          lotNumber.includes(query) ||
          lotNumberSimple.includes(query) ||
          employeeName.includes(query) ||
          notes.includes(query) ||
          supplyNames.includes(query);

        if (!matches) return false;
      }

      return true;
    });
  }, [transformations, statusFilter, dateFilter, searchTerm]);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const paginatedTransformations = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransformations.slice(start, start + pageSize);
  }, [filteredTransformations, currentPage, pageSize]);

  return (
    <div className="space-y-5">
      {/* KPIs Cards Estilo Ejecutivo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Transformaciones */}
        <div className="rounded-2xl border border-amber-200/60 dark:border-amber-900/40 bg-gradient-to-br from-card via-card to-amber-50/30 dark:to-amber-950/20 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 flex items-center justify-center shrink-0 border border-amber-200/80 dark:border-amber-900/60 shadow-2xs">
              <Repeat className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/60 px-2 py-0.5 rounded-full">
              Operaciones
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Lotes Ejecutados</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono">
                {totalTransformations}
              </span>
              <span className="text-xs text-muted-foreground">lotes totales</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Activas: {totalTransformations - annulledTransformations}</span>
            <span>Histórico total</span>
          </div>
        </div>

        {/* Card 2: Materia Prima Consumida */}
        <div className="rounded-2xl border border-rose-200/60 dark:border-rose-900/40 bg-gradient-to-br from-card via-card to-rose-50/25 dark:to-rose-950/15 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 flex items-center justify-center shrink-0 border border-rose-200/80 dark:border-rose-900/60 shadow-2xs">
              <Package className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-semibold text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 px-2 py-0.5 rounded-full font-mono">
              Salida Stock
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Materia Prima Consumida</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-rose-700 dark:text-rose-400 font-mono">
                {totalUnitsConsumed.toFixed(2)}
              </span>
              <span className="text-xs text-muted-foreground">cant. total</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Insumos descontados</span>
            <span className="font-medium text-rose-600 dark:text-rose-400">Consumo efectivo</span>
          </div>
        </div>

        {/* Card 3: Productos Producidos */}
        <div className="rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40 bg-gradient-to-br from-card via-card to-emerald-50/25 dark:to-emerald-950/15 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-200/80 dark:border-emerald-900/60 shadow-2xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 px-2 py-0.5 rounded-full font-mono">
              Entrada Stock
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Productos Producidos</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400 font-mono">
                {totalUnitsProduced.toFixed(2)}
              </span>
              <span className="text-xs text-muted-foreground">cant. generada</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Listos para cocina / venta</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">Rendimiento</span>
          </div>
        </div>

        {/* Card 4: Anuladas */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-br from-card via-card to-slate-50/30 dark:to-slate-900/30 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 shadow-2xs">
              <Ban className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-full">
              Auditoría
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Lotes Anulados</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-700 dark:text-slate-300 font-mono">
                {annulledTransformations}
              </span>
              <span className="text-xs text-muted-foreground">revertidos</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Reversión de Kardex</span>
            <span className="text-zinc-500 font-semibold">{annulledTransformations === 0 ? "Sin anulaciones" : "Histórico"}</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border rounded-lg p-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por lote (TR-0001), insumo, responsable..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Segmented Control de Estados */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => {
                setStatusFilter("ALL");
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                statusFilter === "ALL"
                  ? "bg-white dark:bg-slate-800 text-foreground font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("ACTIVE");
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                statusFilter === "ACTIVE"
                  ? "bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Activas
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("ANNULLED");
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                statusFilter === "ANNULLED"
                  ? "bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-400 font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Anuladas
            </button>
          </div>


          {/* Filtro por Fecha */}
          <div className="w-[140px]">
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Tabla de Historial */}
      <div className="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">N° Lote</TableHead>
              <TableHead className="w-[140px]">Fecha / Hora</TableHead>
              <TableHead>Responsable</TableHead>
              <TableHead>Consumo (Salida)</TableHead>
              <TableHead>Producción (Entrada)</TableHead>
              <TableHead className="w-[100px]">Estado</TableHead>
              <TableHead className="text-right w-[160px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransformations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                  {transformations.length === 0
                    ? "No hay transformaciones registradas en el sistema."
                    : "No se encontraron transformaciones con los filtros seleccionados."}
                </TableCell>
              </TableRow>
            ) : (
              paginatedTransformations.map((t) => {
                const dateStr = new Date(t.date).toLocaleString("es-PE");
                const consumptions = t.items.filter((i) => i.itemType === "Consumo");
                const productions = t.items.filter((i) => i.itemType === "Producido");

                return (
                  <TableRow
                    key={t.id}
                    className={t.anulado ? "opacity-60 bg-muted/20" : undefined}
                  >
                    <TableCell className="font-mono font-semibold text-xs whitespace-nowrap">
                      TR-{t.id.toString().padStart(4, "0")}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{dateStr}</TableCell>
                    <TableCell className="text-xs">
                      {t.employee.firstName} {t.employee.paternalLastName || ""}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="space-y-0.5">
                        {consumptions.map((c) => (
                          <div
                            key={c.id}
                            className={
                              t.anulado
                                ? "text-muted-foreground line-through"
                                : "text-rose-700 font-medium"
                            }
                          >
                            - {Number(c.quantity).toFixed(2)} {c.supply.unitOfMeasure} {c.supply.name}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="space-y-0.5">
                        {productions.map((p) => (
                          <div
                            key={p.id}
                            className={
                              t.anulado
                                ? "text-muted-foreground line-through"
                                : "text-emerald-700 font-medium"
                            }
                          >
                            + {Number(p.quantity).toFixed(2)} {p.supply.unitOfMeasure} {p.supply.name}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {t.anulado ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-300">
                          <XCircle className="h-3 w-3" />
                          Anulada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" />
                          Activa
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedRecordForDetail(t)}
                          className="h-7 text-xs flex items-center gap-1 text-primary hover:text-primary"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Detalle
                        </Button>
                        {!t.anulado && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedRecordForAnnul(t)}
                            className="h-7 text-xs flex items-center gap-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          >
                            <Ban className="h-3.5 w-3.5" />
                            Anular
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <TablePagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={filteredTransformations.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="transformaciones"
        />
      </div>

      <TransformationDetailDialog
        transformation={selectedRecordForDetail}
        open={!!selectedRecordForDetail}
        onOpenChange={(open) => !open && setSelectedRecordForDetail(null)}
      />

      <AnnulTransformationDialog
        transformation={selectedRecordForAnnul}
        open={!!selectedRecordForAnnul}
        onOpenChange={(open) => !open && setSelectedRecordForAnnul(null)}
      />
    </div>
  );
}


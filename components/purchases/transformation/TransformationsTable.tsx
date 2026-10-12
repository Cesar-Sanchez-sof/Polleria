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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TransformationDetailDialog,
  TransformationDetailRecord,
} from "./TransformationDetailDialog";
import { AnnulTransformationDialog } from "./AnnulTransformationDialog";
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
  const [selectedSupplyFilter, setSelectedSupplyFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState<string>("");

  // Diálogos
  const [selectedRecordForDetail, setSelectedRecordForDetail] =
    useState<TransformationDetailRecord | null>(null);
  const [selectedRecordForAnnul, setSelectedRecordForAnnul] =
    useState<TransformationDetailRecord | null>(null);

  // Lista de insumos únicos presentes en las transformaciones para el filtro
  const uniqueSupplies = useMemo(() => {
    const map = new Map<number, string>();
    transformations.forEach((t) => {
      t.items.forEach((i) => {
        if (i.supply) map.set(i.supply.id, i.supply.name);
      });
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [transformations]);

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

      // Filtro por insumo
      if (selectedSupplyFilter !== "ALL") {
        const supplyIdNum = Number(selectedSupplyFilter);
        const hasSupply = t.items.some((i) => i.supply.id === supplyIdNum);
        if (!hasSupply) return false;
      }

      // Buscador
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
  }, [transformations, statusFilter, dateFilter, selectedSupplyFilter, searchTerm]);

  return (
    <div className="space-y-5">
      {/* KPIs Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-card border rounded-lg p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Total Transformaciones</span>
            <Repeat className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-xl font-bold">{totalTransformations}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Lotes ejecutados
          </p>
        </div>

        <div className="bg-card border rounded-lg p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Materia Prima Consumida</span>
            <Package className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-2 text-xl font-bold">{totalUnitsConsumed.toFixed(2)}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Unidades descontadas
          </p>
        </div>

        <div className="bg-card border rounded-lg p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Productos Producidos</span>
            <Sparkles className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-xl font-bold">{totalUnitsProduced.toFixed(2)}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Unidades ingresadas
          </p>
        </div>

        <div className="bg-card border rounded-lg p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Anuladas</span>
            <Ban className="h-4 w-4 text-zinc-500" />
          </div>
          <div className="mt-2 text-xl font-bold text-zinc-700 dark:text-zinc-300">
            {annulledTransformations}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Lotes revertidos
          </p>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border rounded-lg p-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por lote (TR-0001), insumo, responsable..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro por Estado */}
          <div className="w-[130px]">
            <Select
              value={statusFilter}
              onValueChange={(val) => setStatusFilter(val || "ALL")}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los estados</SelectItem>
                <SelectItem value="ACTIVE">Activas</SelectItem>
                <SelectItem value="ANNULLED">Anuladas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por Insumo */}
          <div className="w-[170px]">
            <Select
              value={selectedSupplyFilter}
              onValueChange={(val) => setSelectedSupplyFilter(val || "ALL")}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Insumo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los insumos</SelectItem>
                {uniqueSupplies.map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por Fecha */}
          <div className="w-[140px]">
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          {(dateFilter || statusFilter !== "ALL" || selectedSupplyFilter !== "ALL" || searchTerm) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFilter("");
                setStatusFilter("ALL");
                setSelectedSupplyFilter("ALL");
                setSearchTerm("");
              }}
              className="h-9 text-xs px-2 text-muted-foreground"
            >
              Limpiar filtros
            </Button>
          )}
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
              filteredTransformations.map((t) => {
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


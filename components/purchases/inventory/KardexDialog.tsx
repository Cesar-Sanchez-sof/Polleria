"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/purchases/shared/TablePagination";
import {
  getInventoryMovementsPaginated,
  type GetInventoryMovementsFilters,
  type EnrichedInventoryMovement,
} from "@/lib/services/purchases/inventory-movement";
import {
  Search,
  Loader2,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  Info,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { InventoryMovementType } from "@prisma/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const MOVEMENT_LABELS: Record<InventoryMovementType, string> = {
  Purchase: "Compra",
  InformalPurchase: "Compra Menor",
  TransformationIn: "Transformación (Entrada)",
  TransformationOut: "Transformación (Salida)",
  Sale: "Venta",
  Shrinkage: "Merma",
  Adjustment: "Ajuste",
};

const MOVEMENT_COLORS: Record<
  InventoryMovementType,
  { badge: string; qty: string }
> = {
  Purchase: {
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    qty: "text-emerald-700 font-semibold",
  },
  InformalPurchase: {
    badge: "bg-teal-100 text-teal-800 border-teal-200",
    qty: "text-teal-700 font-semibold",
  },
  TransformationIn: {
    badge: "bg-blue-100 text-blue-800 border-blue-200",
    qty: "text-blue-700 font-semibold",
  },
  TransformationOut: {
    badge: "bg-orange-100 text-orange-800 border-orange-200",
    qty: "text-orange-700 font-semibold",
  },
  Sale: {
    badge: "bg-purple-100 text-purple-800 border-purple-200",
    qty: "text-rose-700 font-semibold",
  },
  Shrinkage: {
    badge: "bg-rose-100 text-rose-800 border-rose-200",
    qty: "text-rose-700 font-semibold",
  },
  Adjustment: {
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    qty: "text-slate-700 font-semibold",
  },
};

/** Determina si un movimiento incrementa o decrementa el inventario */
function isMovementPositive(type: InventoryMovementType, quantity: number) {
  if (quantity < 0) return false;
  if (
    type === InventoryMovementType.TransformationOut ||
    type === InventoryMovementType.Sale ||
    type === InventoryMovementType.Shrinkage
  ) {
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface KardexDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

interface Supply {
  id: number;
  name: string;
  unitOfMeasure: string;
}

export function KardexDialog({
  open,
  onOpenChange,
  supplies = [],
}: KardexDialogProps & { supplies?: Supply[] }) {
  // ── Filtros ──
  const [search, setSearch] = useState("");
  const [supplyId, setSupplyId] = useState<string>("all");
  const [movementType, setMovementType] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // ── Paginación ──
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // ── Datos ──
  const [items, setItems] = useState<EnrichedInventoryMovement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Fetch
  // ─────────────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const filters: GetInventoryMovementsFilters = {
        page,
        pageSize,
        search: search.trim() || undefined,
        supplyId: supplyId !== "all" ? Number(supplyId) : undefined,
        movementType:
          movementType !== "all"
            ? (movementType as InventoryMovementType)
            : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate + "T23:59:59") : undefined,
      };

      const result = await getInventoryMovementsPaginated(filters);
      setItems(result.items);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, supplyId, movementType, startDate, endDate]);

  // Cargar datos al abrir el dialog o cambiar filtros/página
  useEffect(() => {
    if (open) fetchData();
  }, [open, fetchData]);

  // Resetear página cuando cambian los filtros
  const resetPage = () => setPage(1);

  const handleClearFilters = () => {
    setSearch("");
    setSupplyId("all");
    setMovementType("all");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const hasFilters =
    search.trim() !== "" ||
    supplyId !== "all" ||
    movementType !== "all" ||
    startDate !== "" ||
    endDate !== "";

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-6xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden shadow-2xl">
        {/* ── Header ── */}
        <DialogHeader className="px-5 py-3.5 border-b shrink-0 bg-slate-50/70 dark:bg-slate-900/50">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                <RefreshCw className="h-4 w-4" />
              </span>
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  Kardex de Movimientos de Inventario
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  Historial de entradas y salidas de insumos valorizado
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-medium text-muted-foreground bg-muted/80 border px-2.5 py-1 rounded-md">
              {total} movimiento{total !== 1 ? "s" : ""}
            </span>
          </div>
        </DialogHeader>

        {/* ── Filtros ── */}
        <div className="px-5 py-3 border-b bg-card shrink-0">
          <div className="flex flex-wrap items-end gap-2.5">
            {/* Selector de insumo específico */}
            <div className="flex flex-col gap-1.5 flex-1 min-w-[190px] max-w-[240px]">
              <span className="text-[11px] font-semibold text-muted-foreground h-4 flex items-center truncate">
                Insumo{" "}
                <span className="text-emerald-600 dark:text-emerald-400 font-bold ml-1">
                  (activa Saldo)
                </span>
              </span>
              <Select
                value={supplyId}
                onValueChange={(v) => {
                  setSupplyId(v ?? "all");
                  resetPage();
                }}
              >
                <SelectTrigger className="h-9 text-xs w-full">
                  <SelectValue placeholder="Todos los insumos">
                    {supplyId === "all"
                      ? "Todos los insumos"
                      : supplies.find((s) => s.id === Number(supplyId))?.name ?? "Todos los insumos"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    Todos los insumos
                  </SelectItem>
                  {supplies.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)} className="text-xs">
                      {s.name}{" "}
                      <span className="text-muted-foreground">({s.unitOfMeasure})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Búsqueda de texto libre */}
            <div className="flex flex-col gap-1.5 flex-1 min-w-[160px] max-w-[220px]">
              <span className="text-[11px] font-semibold text-muted-foreground h-4 flex items-center truncate">
                Buscar insumo
              </span>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Ej: Pollo, Papa..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    resetPage();
                  }}
                  className="pl-8 h-9 text-xs"
                />
              </div>
            </div>

            {/* Tipo de movimiento */}
            <div className="flex flex-col gap-1.5 flex-1 min-w-[160px] max-w-[200px]">
              <span className="text-[11px] font-semibold text-muted-foreground h-4 flex items-center truncate">
                Tipo de movimiento
              </span>
              <Select
                value={movementType}
                onValueChange={(v) => {
                  setMovementType(v ?? "all");
                  resetPage();
                }}
              >
                <SelectTrigger className="h-9 text-xs w-full">
                  <SelectValue placeholder="Todos los tipos">
                    {movementType === "all"
                      ? "Todos los tipos"
                      : MOVEMENT_LABELS[movementType as InventoryMovementType] ?? "Todos los tipos"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    Todos los tipos
                  </SelectItem>
                  {Object.entries(MOVEMENT_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key} className="text-xs">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Rango de fechas */}
            <div className="flex flex-col gap-1.5 min-w-[240px]">
              <span className="text-[11px] font-semibold text-muted-foreground h-4 flex items-center truncate">
                Rango de fechas
              </span>
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  value={startDate}
                  title="Desde"
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    resetPage();
                  }}
                  className="h-9 text-[11px] px-2 flex-1"
                />
                <span className="text-xs text-muted-foreground font-medium shrink-0">-</span>
                <Input
                  type="date"
                  value={endDate}
                  title="Hasta"
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    resetPage();
                  }}
                  className="h-9 text-[11px] px-2 flex-1"
                />
              </div>
            </div>

            {/* Botones de acción alineados con los inputs */}
            <div className="flex items-center gap-2 ml-auto">
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-9 text-xs text-muted-foreground hover:text-foreground px-2.5 cursor-pointer"
                >
                  Limpiar
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchData()}
                disabled={loading}
                className="h-9 text-xs px-3 cursor-pointer shadow-2xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                Refrescar
              </Button>
            </div>
          </div>
        </div>

        {/* ── Tabla ── */}
        <div className="flex-1 overflow-y-auto px-5 py-2">
          {loading ? (
            <div className="flex items-center justify-center h-56 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm">Cargando movimientos del Kardex...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 gap-2 text-muted-foreground">
              <RefreshCw className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm font-medium">Sin movimientos registrados</p>
              {hasFilters && (
                <p className="text-xs">Prueba cambiando o limpiando los filtros</p>
              )}
            </div>
          ) : (() => {
            // Saldo condicional: solo si el primer item tiene saldoCorrido definido
            const showBalance = items.length > 0 && items[0].runningBalance !== undefined;

            return (
              <div className="rounded-lg border overflow-x-auto">
                <Table className={showBalance ? "min-w-[900px]" : "min-w-[760px]"}>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="text-xs">
                      <TableHead className="w-[140px]">Fecha</TableHead>
                      <TableHead>Insumo</TableHead>
                      <TableHead className="w-[170px]">Tipo</TableHead>
                      <TableHead className="w-[130px]">Referencia</TableHead>
                      <TableHead className="text-right w-[95px]">Cantidad</TableHead>
                      {showBalance && (
                        <TableHead className="text-right w-[125px]">
                          <div className="inline-flex items-center justify-end gap-1.5 w-full">
                            <span>Stock después</span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger className="inline-flex items-center text-muted-foreground/80 hover:text-foreground cursor-help p-0.5 rounded transition-colors">
                                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent side="top" align="center" className="max-w-xs text-xs p-2.5">
                                  Stock del insumo después de aplicar este movimiento. El registro más reciente (arriba) refleja el stock actual.
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableHead>
                      )}
                      <TableHead className="w-[70px]">Unidad</TableHead>
                      <TableHead className="text-right w-[100px]">Costo Unit.</TableHead>
                      <TableHead className="w-[180px]">Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((m) => {
                      const colors = MOVEMENT_COLORS[m.movementType];
                      const rawQty = Number(m.quantity);
                      const positive = isMovementPositive(m.movementType, rawQty);

                      return (
                        <TableRow key={m.id} className="text-xs">
                          {/* Fecha */}
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {format(new Date(m.movedAt), "dd MMM yyyy HH:mm", { locale: es })}
                          </TableCell>

                          {/* Insumo */}
                          <TableCell className="font-medium">
                            {m.supply?.name ?? "—"}
                          </TableCell>

                          {/* Tipo */}
                          <TableCell>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colors.badge}`}
                            >
                              {positive ? (
                                <ArrowUpCircle className="h-3 w-3" />
                              ) : (
                                <ArrowDownCircle className="h-3 w-3" />
                              )}
                              {MOVEMENT_LABELS[m.movementType]}
                            </span>
                          </TableCell>

                          {/* Referencia */}
                          <TableCell className="text-muted-foreground">
                            {m.reference ?? (
                              <span className="italic text-muted-foreground/40">—</span>
                            )}
                          </TableCell>

                          {/* Cantidad */}
                          <TableCell
                            className={`text-right ${
                              positive
                                ? "text-emerald-700 font-semibold"
                                : "text-rose-700 font-semibold"
                            }`}
                          >
                            {positive ? "+" : "-"}
                            {Math.abs(rawQty).toFixed(2)}
                          </TableCell>

                          {/* Stock después (Saldo acumulado) — solo si corresponde */}
                          {showBalance && (
                            <TableCell className="text-right font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                              {m.runningBalance !== undefined
                                ? m.runningBalance.toFixed(2)
                                : "—"}
                            </TableCell>
                          )}

                          {/* Unidad */}
                          <TableCell className="text-muted-foreground">
                            {m.supply?.unitOfMeasure ?? "—"}
                          </TableCell>

                          {/* Costo unitario */}
                          <TableCell className="text-right text-muted-foreground">
                            {m.unitCost ? `S/ ${Number(m.unitCost).toFixed(2)}` : "—"}
                          </TableCell>

                          {/* Motivo — con tooltip al hacer hover */}
                          <TableCell className="max-w-[180px]">
                            {m.reason ? (
                              <span
                                title={m.reason}
                                className="block truncate text-muted-foreground cursor-help"
                              >
                                {m.reason}
                              </span>
                            ) : (
                              <span className="italic text-muted-foreground/40">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            );
          })()}
        </div>

        {/* ── Paginación ── */}
        {!loading && total > 0 && (
          <div className="px-6 py-3 border-t shrink-0">
            <TablePagination
              currentPage={page}
              pageSize={pageSize}
              totalItems={total}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SupplyDialog } from "./SupplyDialog";
import { AdjustmentDialog } from "./AdjustmentDialog";
import { KardexDialog } from "./KardexDialog";
import { TablePagination } from "@/components/purchases/shared/TablePagination";
import {
  Plus,
  Search,
  SlidersHorizontal,
  AlertTriangle,
  CheckCircle2,
  Power,
  Package,
  Wheat,
  UtensilsCrossed,
  TrendingDown,
  ShieldAlert,
  Boxes,
  Pencil,
  Info,
  ListOrdered,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SupplyType, AffectationIgv } from "@prisma/client";
import { updateSupplyMinimum, updateSupplyUnit, setSupplyStatus } from "@/lib/services/purchases/supply";
import { toast } from "sonner";

interface Supply {
  id: number;
  name: string;
  type: SupplyType;
  affectationIgv?: AffectationIgv;
  unitOfMeasure: string;
  currentStock: number | string;
  minimumStock: number | string;
  lastCost?: number | string | null;
  averageCost?: number | string | null;
  active: boolean;
}

interface InventoryTableProps {
  initialSupplies: Supply[];
}

const STATUS_LABELS: Record<string, string> = {
  all: "Todos",
  active: "Solo activos",
  inactive: "Solo inactivos",
};

export function InventoryTable({ initialSupplies }: InventoryTableProps) {
  const [supplies, setSupplies] = useState<Supply[]>(initialSupplies);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [supplyDialogOpen, setSupplyDialogOpen] = useState(false);
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [supplyToAdjust, setSupplyToAdjust] = useState<Supply | null>(null);
  const [kardexOpen, setKardexOpen] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [savingId, setSavingId] = useState<number | null>(null);

  // Unit editing (inline)
  const [editingUnitId, setEditingUnitId] = useState<number | null>(null);
  const [editUnitValue, setEditUnitValue] = useState<string>("");
  const [savingUnitId, setSavingUnitId] = useState<number | null>(null);
  // Pending unit change (awaiting confirm when supply has movements)
  const [pendingUnitChange, setPendingUnitChange] = useState<{ supplyId: number; unit: string } | null>(null);

  // KPIs — calculados sobre la lista completa (no sobre filtered)
  const totalSupplies = supplies.length;
  const rawMaterials = supplies.filter((s) => s.type === SupplyType.RawMaterial).length;
  const finishedProducts = supplies.filter((s) => s.type === SupplyType.FinishedProduct).length;

  const lowStockItems = useMemo(
    () => supplies.filter((s) => Number(s.currentStock) <= Number(s.minimumStock)),
    [supplies]
  );
  const lowStockCount = lowStockItems.length;

  // Valor estimado del inventario (stock actual × costo promedio)
  const inventoryValue = useMemo(
    () =>
      supplies.reduce((sum, s) => {
        const stock = Number(s.currentStock);
        const cost = Number(s.averageCost || s.lastCost || 0);
        return sum + stock * cost;
      }, 0),
    [supplies]
  );

  // Salud general: % de insumos cuyo stock supera su mínimo
  const healthPct = totalSupplies === 0
    ? 100
    : Math.round(((totalSupplies - lowStockCount) / totalSupplies) * 100);

  const rawPct = totalSupplies === 0 ? 0 : Math.round((rawMaterials / totalSupplies) * 100);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const filtered = supplies.filter((i) => {
    const q = search.toLowerCase();
    const code = `INS-${i.id.toString().padStart(3, "0")}`.toLowerCase();
    const typeLabel = i.type === SupplyType.RawMaterial ? "materia prima" : "producto terminado";
    const affectationLabel =
      i.affectationIgv === AffectationIgv.Included ? "incluido" : "excluido";
    const matchesSearch =
      i.name.toLowerCase().includes(q) ||
      code.includes(q) ||
      i.type.toLowerCase().includes(q) ||
      typeLabel.includes(q) ||
      affectationLabel.includes(q);

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && i.active) ||
      (statusFilter === "inactive" && !i.active);

    return matchesSearch && matchesStatus;
  });

  const paginatedSupplies = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const hasActiveFilter = search.trim() !== "" || statusFilter !== "all";

  const handleNewSupplySuccess = (created: Supply) => {
    setSupplies((prev) => [created, ...prev]);
  };

  const handleAdjustmentSuccess = (updated: Supply) => {
    setSupplies((prev) =>
      prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i))
    );
  };

  const handleOpenAdjustment = (supply: Supply) => {
    setSupplyToAdjust(supply);
    setAdjustmentDialogOpen(true);
  };

  const handleToggleStatus = async (item: Supply) => {
    const newStatus = !item.active;
    try {
      await setSupplyStatus(item.id, newStatus);
      setSupplies((prev) =>
        prev.map((s) => (s.id === item.id ? { ...s, active: newStatus } : s))
      );
      toast.success(`Insumo ${newStatus ? "activado" : "desactivado"} exitosamente`);
    } catch (err: any) {
      toast.error(err.message || "Error al cambiar estado del insumo");
    }
  };

  const handleStartEdit = (item: Supply) => {
    setEditingId(item.id);
    setEditValue(String(Number(item.minimumStock)));
  };

  const handleSaveMinimum = async (supplyId: number) => {
    if (editingId !== supplyId) return;
    const num = parseFloat(editValue);
    if (isNaN(num) || num < 0) {
      toast.error("El stock mínimo no puede ser negativo");
      setEditingId(null);
      return;
    }

    const currentItem = supplies.find((s) => s.id === supplyId);
    if (currentItem && Number(currentItem.minimumStock) === num) {
      setEditingId(null);
      return;
    }

    setSavingId(supplyId);
    try {
      const updated = await updateSupplyMinimum(supplyId, num);
      setSupplies((prev) =>
        prev.map((s) =>
          s.id === supplyId ? { ...s, minimumStock: Number(updated.minimumStock) } : s
        )
      );
      toast.success("Stock mínimo actualizado");
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar stock mínimo");
    } finally {
      setSavingId(null);
      setEditingId(null);
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    supplyId: number
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveMinimum(supplyId);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditingId(null);
    }
  };

  const handleStartEditUnit = (item: Supply) => {
    setEditingUnitId(item.id);
    setEditUnitValue(item.unitOfMeasure);
  };

  const doSaveUnit = async (supplyId: number, unit: string) => {
    setSavingUnitId(supplyId);
    try {
      const updated = await updateSupplyUnit(supplyId, unit);
      setSupplies((prev) =>
        prev.map((s) =>
          s.id === supplyId ? { ...s, unitOfMeasure: updated.unitOfMeasure } : s
        )
      );
      toast.success("Unidad actualizada exitosamente");
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar unidad de medida");
    } finally {
      setSavingUnitId(null);
      setPendingUnitChange(null);
    }
  };

  const handleSaveUnit = async (supplyId: number) => {
    if (editingUnitId !== supplyId) return;
    const newUnit = editUnitValue.trim().toUpperCase();
    const currentItem = supplies.find((s) => s.id === supplyId);
    if (!newUnit) {
      setEditingUnitId(null);
      return;
    }
    if (currentItem && currentItem.unitOfMeasure === newUnit) {
      setEditingUnitId(null);
      return;
    }
    setEditingUnitId(null);

    // Si el insumo tiene stock o movimientos, pedir confirmación
    const hasHistory = Number(currentItem?.currentStock || 0) !== 0;
    if (hasHistory) {
      setPendingUnitChange({ supplyId, unit: newUnit });
      return;
    }
    await doSaveUnit(supplyId, newUnit);
  };

  const handleKeyDownUnit = (
    e: React.KeyboardEvent<HTMLInputElement>,
    supplyId: number
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveUnit(supplyId);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditingUnitId(null);
    }
  };

  const formatCost = (cost?: number | string | null) => {
    const num = Number(cost || 0);
    if (!cost || num === 0) return "-";
    return `S/ ${num.toFixed(2)}`;
  };

  return (
    <div className="space-y-4">

      {/* ── Panel de Control Operativo ── */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-card shadow-xs overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200/80 dark:divide-slate-800">

          {/* Sección 1 — Salud del Almacén */}
          <div className="p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Boxes className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Salud del Almacén
              </span>
            </div>

            {/* Indicador principal */}
            <div className="flex items-center gap-5">
              {/* Anillo circular SVG */}
              <div className="relative shrink-0 h-16 w-16">
                <svg viewBox="0 0 56 56" className="h-full w-full -rotate-90">
                  <circle cx="28" cy="28" r="22" fill="none" stroke="currentColor"
                    className="text-slate-100 dark:text-slate-800" strokeWidth="6" />
                  <circle cx="28" cy="28" r="22" fill="none"
                    stroke={healthPct >= 80 ? "#10b981" : healthPct >= 50 ? "#f59e0b" : "#f43f5e"}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${(healthPct / 100) * 138.2} 138.2`} />
                </svg>
                <span className={`absolute inset-0 flex items-center justify-center text-sm font-black font-mono rotate-0 ${
                  healthPct >= 80 ? "text-emerald-700 dark:text-emerald-400"
                  : healthPct >= 50 ? "text-amber-700 dark:text-amber-400"
                  : "text-rose-700 dark:text-rose-400"
                }`}>
                  {healthPct}%
                </span>
              </div>
              <div>
                <p className="text-sm font-bold text-foreground leading-tight">
                  {healthPct >= 80 ? "Stock saludable" : healthPct >= 50 ? "Atención requerida" : "Estado crítico"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {totalSupplies - lowStockCount} de {totalSupplies} insumos sobre mínimo
                </p>
                <p className="text-xs text-muted-foreground mt-2 font-semibold font-mono">
                  Valor est. almacén:{" "}
                  <span className="text-foreground">S/ {inventoryValue.toFixed(2)}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Sección 2 — Distribución por Categoría */}
          <div className="p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Wheat className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Distribución por Categoría
              </span>
            </div>

            <div className="space-y-3">
              {/* Materia Prima */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300">
                    <Wheat className="h-3 w-3" /> Materias Primas
                  </span>
                  <span className="font-bold font-mono text-amber-800 dark:text-amber-300">
                    {rawMaterials} <span className="font-normal text-muted-foreground">/ {totalSupplies}</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-amber-100 dark:bg-amber-950/40 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-400 dark:bg-amber-500 transition-all duration-700"
                    style={{ width: `${rawPct}%` }}
                  />
                </div>
              </div>

              {/* Productos Terminados */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-orange-800 dark:text-orange-300">
                    <UtensilsCrossed className="h-3 w-3" /> Prod. Terminados
                  </span>
                  <span className="font-bold font-mono text-orange-800 dark:text-orange-300">
                    {finishedProducts} <span className="font-normal text-muted-foreground">/ {totalSupplies}</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-orange-100 dark:bg-orange-950/40 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-orange-400 dark:bg-orange-500 transition-all duration-700"
                    style={{ width: `${100 - rawPct}%` }}
                  />
                </div>
              </div>

              {/* Mini resumen */}
              <p className="text-[11px] text-muted-foreground pt-1 border-t border-slate-100 dark:border-slate-800">
                {rawPct}% materias primas · {100 - rawPct}% terminados
              </p>
            </div>
          </div>

          {/* Sección 3 — Alertas de Stock */}
          <div className="p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${
                  lowStockCount > 0
                    ? "bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400"
                    : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"
                }`}>
                  {lowStockCount > 0
                    ? <ShieldAlert className="h-4 w-4" />
                    : <CheckCircle2 className="h-4 w-4" />
                  }
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Alertas de Reabastecimiento
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {lowStockCount > 0 && (
                  <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 px-2 py-0.5 rounded-full">
                    {lowStockCount} crítico{lowStockCount > 1 ? "s" : ""}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setKardexOpen(true)}
                  className="h-6 px-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex items-center gap-1 cursor-pointer"
                  title="Consultar movimientos en el Kardex"
                >
                  <ListOrdered className="h-3 w-3" />
                  <span>Kardex</span>
                </Button>
              </div>
            </div>

            {lowStockCount === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 py-4 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-400 dark:text-emerald-500" />
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  Todo bajo control
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Ningún insumo está por debajo de su nivel mínimo.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-200">
                {lowStockItems.map((s) => {
                  const deficit = Number(s.minimumStock) - Number(s.currentStock);
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-800/40 px-2.5 py-1.5"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <TrendingDown className="h-3 w-3 text-rose-500 shrink-0" />
                        <span className="text-xs font-semibold text-rose-900 dark:text-rose-200 truncate">
                          {s.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-rose-700 dark:text-rose-300 shrink-0 bg-rose-100 dark:bg-rose-900/50 px-1.5 rounded">
                        -{deficit.toFixed(1)} {s.unitOfMeasure}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5 bg-card border p-3 rounded-xl shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por código, insumo o tipo..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Segmented Control de Estados */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => {
                setStatusFilter("all");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "all"
                  ? "bg-white dark:bg-slate-800 text-foreground font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Todos</span>
              <span className="text-[10px] bg-muted px-1.5 py-0.2 rounded-full font-mono">
                {supplies.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("active");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "active"
                  ? "bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Activos</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-1.5 py-0.2 rounded-full font-mono font-semibold">
                {supplies.filter((s) => s.active).length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("inactive");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "inactive"
                  ? "bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-400 font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Inactivos</span>
              <span className="text-[10px] bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 px-1.5 py-0.2 rounded-full font-mono font-semibold">
                {supplies.filter((s) => !s.active).length}
              </span>
            </button>
          </div>

          <Button
            variant="outline"
            onClick={() => setKardexOpen(true)}
            size="sm"
            className="h-9 px-3.5 text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <ListOrdered className="h-4 w-4" /> Ver Kardex
          </Button>

          <Button
            onClick={() => setSupplyDialogOpen(true)}
            size="sm"
            className="h-9 px-3.5 text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="h-4 w-4" /> Nuevo Insumo
          </Button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="rounded-md border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre Insumo</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Afectación IGV</TableHead>
              <TableHead className="w-[115px]">
                <div className="inline-flex items-center gap-1.5 select-none">
                  <div
                    className="inline-flex items-center gap-1 cursor-help text-foreground/80 hover:text-foreground transition-colors"
                    title="Clic en el valor para editar la unidad de medida"
                  >
                    <span>Unidad</span>
                    <Pencil className="h-3 w-3 text-muted-foreground/70" />
                  </div>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="inline-flex items-center text-muted-foreground/70 hover:text-foreground cursor-help transition-colors p-0.5 rounded">
                        <Info className="h-3 w-3" />
                      </TooltipTrigger>
                      <TooltipContent side="top" align="center" className="max-w-xs text-xs p-2.5 block space-y-1">
                        <p className="font-semibold text-background">Unidades permitidas:</p>
                        <div className="space-y-0.5 text-[11px] text-background/90">
                          <div>• <strong className="font-semibold text-background">UNID</strong> — piezas discretas (pollo, gaseosas)</div>
                          <div>• <strong className="font-semibold text-background">KG</strong> — peso (papa, arroz, carne)</div>
                          <div>• <strong className="font-semibold text-background">LT</strong> — volumen (aceite, leche)</div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </TableHead>
              <TableHead className="text-right w-[130px] whitespace-nowrap">Stock Actual</TableHead>
              <TableHead className="text-right w-[130px] whitespace-nowrap">Stock Mínimo</TableHead>
              <TableHead className="text-right w-[120px] whitespace-nowrap">Último Costo</TableHead>
              <TableHead className="text-right w-[120px] whitespace-nowrap">Costo Promedio</TableHead>
              <TableHead className="w-[90px]">Estado</TableHead>
              <TableHead className="w-[110px]">Estado Stock</TableHead>
              <TableHead className="text-right w-[110px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="py-12">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="rounded-full bg-muted p-4">
                      {hasActiveFilter ? (
                        <Search className="h-7 w-7 text-muted-foreground" />
                      ) : (
                        <Package className="h-7 w-7 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {hasActiveFilter
                          ? "No se encontraron coincidencias"
                          : "No hay insumos registrados"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {hasActiveFilter
                          ? "Prueba con otros términos o cambia el filtro de estado."
                          : "Registra tu primer insumo para comenzar a gestionar el inventario."}
                      </p>
                    </div>
                    {!hasActiveFilter && (
                      <Button
                        size="sm"
                        onClick={() => setSupplyDialogOpen(true)}
                        className="mt-1 flex items-center gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" /> Nuevo Insumo
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedSupplies.map((item) => {
                const code = `INS-${item.id.toString().padStart(3, "0")}`;
                const currentStock = Number(item.currentStock);
                const minStock = Number(item.minimumStock);
                const lowStock = currentStock <= minStock;
                const isRawMaterial = item.type === SupplyType.RawMaterial;
                const isIncludedIgv = item.affectationIgv === AffectationIgv.Included;

                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs font-semibold">{code}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          isRawMaterial
                            ? "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200 font-medium"
                            : "bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200 font-medium"
                        }
                      >
                        {isRawMaterial ? "Materia Prima" : "Producto Terminado"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.affectationIgv === null || item.affectationIgv === undefined ? (
                        <Badge
                          variant="outline"
                          className="bg-slate-100 text-slate-500 border-slate-200 font-medium dark:bg-slate-800 dark:text-slate-400"
                        >
                          —
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className={
                            isIncludedIgv
                              ? "bg-blue-50 text-blue-700 border-blue-200 font-medium"
                              : "bg-slate-50 text-slate-700 border-slate-200 font-medium"
                          }
                        >
                          {isIncludedIgv ? "Incluido" : "Excluido"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {/* Unidad de medida — editable inline */}
                      {editingUnitId === item.id ? (
                        <Input
                          type="text"
                          value={editUnitValue}
                          onChange={(e) => setEditUnitValue(e.target.value.toUpperCase())}
                          onKeyDown={(e) => handleKeyDownUnit(e, item.id)}
                          onBlur={() => handleSaveUnit(item.id)}
                          autoFocus
                          className="h-7 w-20 px-1.5 py-0 text-xs uppercase font-mono"
                          disabled={savingUnitId === item.id}
                          maxLength={10}
                        />
                      ) : (
                        <span
                          onClick={() => handleStartEditUnit(item)}
                          className="cursor-pointer hover:underline hover:text-foreground font-mono text-xs font-semibold inline-block"
                          title="Haz clic para editar la unidad de medida"
                        >
                          {item.unitOfMeasure}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-baseline justify-end">
                        <span className="font-mono font-medium text-foreground text-sm">
                          {currentStock.toFixed(2)}
                        </span>
                        <span className="ml-1.5 w-10 text-left text-xs text-muted-foreground font-normal truncate">
                          {item.unitOfMeasure}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === item.id ? (
                        <div className="inline-flex items-center justify-end">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, item.id)}
                            onBlur={() => handleSaveMinimum(item.id)}
                            autoFocus
                            className="h-7 w-18 text-right px-1.5 py-0 text-xs font-mono"
                            disabled={savingId === item.id}
                          />
                          <span className="ml-1.5 w-10 text-left text-xs text-muted-foreground font-normal shrink-0 truncate">
                            {item.unitOfMeasure}
                          </span>
                        </div>
                      ) : (
                        <div
                          onClick={() => handleStartEdit(item)}
                          className="inline-flex items-baseline justify-end cursor-pointer group"
                          title="Haz clic para editar stock mínimo"
                        >
                          <span className="font-mono text-sm text-muted-foreground group-hover:text-foreground group-hover:underline">
                            {minStock.toFixed(2)}
                          </span>
                          <span className="ml-1.5 w-10 text-left text-xs text-muted-foreground font-normal truncate">
                            {item.unitOfMeasure}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-foreground/90">
                      {formatCost(item.lastCost)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-foreground/90">
                      {formatCost(item.averageCost)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          item.active
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200"
                            : "bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200"
                        }
                      >
                        {item.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {lowStock ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                          <AlertTriangle className="h-3 w-3" /> Bajo Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="h-3 w-3" /> Óptimo
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenAdjustment(item)}
                        className="items-center gap-1.5 text-xs inline-flex"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" /> Ajustar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(item)}
                        className={item.active ? "text-destructive" : "text-emerald-600"}
                        title={item.active ? "Desactivar" : "Activar"}
                      >
                        <Power className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {filtered.length > 0 && (
          <TablePagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={filtered.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            itemLabel="insumos"
          />
        )}
      </div>

      <SupplyDialog
        open={supplyDialogOpen}
        onOpenChange={setSupplyDialogOpen}
        onSuccess={handleNewSupplySuccess}
      />

      <AdjustmentDialog
        open={adjustmentDialogOpen}
        onOpenChange={setAdjustmentDialogOpen}
        supply={supplyToAdjust}
        onSuccess={handleAdjustmentSuccess}
      />

      {/* Confirm dialog: cambiar unidad con historial */}
      <Dialog
        open={!!pendingUnitChange}
        onOpenChange={(open) => { if (!open) setPendingUnitChange(null); }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Cambiar unidad de medida</DialogTitle>
            <DialogDescription>
              Este insumo tiene stock registrado. Cambiar la unidad de medida{" "}
              <strong>no convierte los valores históricos</strong>: los movimientos
              anteriores mostrarán la nueva unidad pero las cantidades seguirán
              siendo las mismas. ¿Deseas continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setPendingUnitChange(null)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (pendingUnitChange) {
                  doSaveUnit(pendingUnitChange.supplyId, pendingUnitChange.unit);
                }
              }}
            >
              Sí, cambiar unidad
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Kardex Dialog ── */}
      <KardexDialog
        open={kardexOpen}
        onOpenChange={setKardexOpen}
        supplies={supplies.map((s) => ({
          id: s.id,
          name: s.name,
          unitOfMeasure: s.unitOfMeasure,
        }))}
      />
    </div>
  );
}

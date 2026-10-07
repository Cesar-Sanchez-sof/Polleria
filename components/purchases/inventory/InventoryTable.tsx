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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SupplyDialog } from "./SupplyDialog";
import { AdjustmentDialog } from "./AdjustmentDialog";
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
} from "lucide-react";
import { SupplyType, AffectationIgv } from "@prisma/client";
import { updateSupplyMinimum, setSupplyStatus } from "@/lib/services/purchases/supply";
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

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [savingId, setSavingId] = useState<number | null>(null);

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
              {lowStockCount > 0 && (
                <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 px-2 py-0.5 rounded-full">
                  {lowStockCount} crítico{lowStockCount > 1 ? "s" : ""}
                </span>
              )}
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
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código, insumo o tipo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(val) =>
              setStatusFilter((val as "all" | "active" | "inactive") ?? "all")
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue>{STATUS_LABELS[statusFilter]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Solo activos</SelectItem>
              <SelectItem value="inactive">Solo inactivos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => setSupplyDialogOpen(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Nuevo Insumo
        </Button>
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
              <TableHead>Unidad</TableHead>
              <TableHead className="text-right">Stock Actual</TableHead>
              <TableHead className="text-right">Stock Mínimo</TableHead>
              <TableHead className="text-right">Último Costo</TableHead>
              <TableHead className="text-right">Costo Promedio</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Estado Stock</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
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
              filtered.map((item) => {
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
                    </TableCell>
                    <TableCell>{item.unitOfMeasure}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {currentStock.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === item.id ? (
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, item.id)}
                          onBlur={() => handleSaveMinimum(item.id)}
                          autoFocus
                          className="h-7 w-20 text-right ml-auto px-1.5 py-0 text-xs"
                          disabled={savingId === item.id}
                        />
                      ) : (
                        <span
                          onClick={() => handleStartEdit(item)}
                          className="cursor-pointer hover:underline hover:text-foreground font-mono text-muted-foreground inline-block"
                          title="Haz clic para editar stock mínimo"
                        >
                          {minStock.toFixed(2)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCost(item.lastCost)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
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
    </div>
  );
}

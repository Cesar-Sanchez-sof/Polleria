"use client";

import React, { useState } from "react";
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
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { RowActions } from "@/components/shared/RowActions";
import {
  Plus,
  Search,
  SlidersHorizontal,
  AlertTriangle,
  CheckCircle2,
  Power,
  Package,
  Pencil,
  ListOrdered,
} from "lucide-react";
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

  const columns: DataTableColumn<Supply>[] = [
    {
      key: "code",
      header: "Código",
      sortable: true,
      sortValue: (item) => item.id,
      cellClassName: "font-mono text-xs font-semibold",
      cell: (item) => `INS-${item.id.toString().padStart(3, "0")}`,
    },
    {
      key: "name",
      header: "Nombre Insumo",
      sortable: true,
      sortValue: (item) => item.name,
      cellClassName: "font-medium",
      cell: (item) => item.name,
    },
    {
      key: "type",
      header: "Tipo",
      cell: (item) => {
        const isRawMaterial = item.type === SupplyType.RawMaterial;
        return (
          <Badge
            className={
              isRawMaterial
                ? "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200 font-medium"
                : "bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200 font-medium"
            }
          >
            {isRawMaterial ? "Materia Prima" : "Producto Terminado"}
          </Badge>
        );
      },
    },
    {
      key: "affectationIgv",
      header: "Afectación IGV",
      cell: (item) =>
        item.affectationIgv === null || item.affectationIgv === undefined ? (
          <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 font-medium dark:bg-slate-800 dark:text-slate-400">
            —
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className={
              item.affectationIgv === AffectationIgv.Included
                ? "bg-blue-50 text-blue-700 border-blue-200 font-medium"
                : "bg-slate-50 text-slate-700 border-slate-200 font-medium"
            }
          >
            {item.affectationIgv === AffectationIgv.Included ? "Incluido" : "Excluido"}
          </Badge>
        ),
    },
    {
      key: "unit",
      header: "Unidad",
      width: "w-[115px]",
      headerIcon: <Pencil />,
      info: (
        <div className="space-y-1">
          <p className="font-semibold text-white">Unidades permitidas:</p>
          <div className="space-y-0.5 text-[11px] text-slate-200">
            <div>• <strong className="font-semibold text-white">UNID</strong> — piezas discretas (pollo, gaseosas)</div>
            <div>• <strong className="font-semibold text-white">KG</strong> — peso (papa, arroz, carne)</div>
            <div>• <strong className="font-semibold text-white">LT</strong> — volumen (aceite, leche)</div>
          </div>
        </div>
      ),
      cell: (item) =>
        editingUnitId === item.id ? (
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
            className="inline-block cursor-pointer font-mono text-xs font-semibold hover:text-foreground hover:underline"
            title="Haz clic para editar la unidad de medida"
          >
            {item.unitOfMeasure}
          </span>
        ),
    },
    {
      key: "currentStock",
      header: "Stock Actual",
      align: "right",
      width: "w-[130px] whitespace-nowrap",
      sortable: true,
      sortValue: (item) => Number(item.currentStock),
      cell: (item) => (
        <div className="inline-flex items-baseline justify-end">
          <span className="font-mono text-sm font-medium text-foreground">{Number(item.currentStock).toFixed(2)}</span>
          <span className="ml-1.5 w-10 truncate text-left text-xs font-normal text-muted-foreground">{item.unitOfMeasure}</span>
        </div>
      ),
    },
    {
      key: "minimumStock",
      header: "Stock Mínimo",
      align: "right",
      width: "w-[130px] whitespace-nowrap",
      sortable: true,
      sortValue: (item) => Number(item.minimumStock),
      cell: (item) =>
        editingId === item.id ? (
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
              className="h-7 w-18 px-1.5 py-0 text-right text-xs font-mono"
              disabled={savingId === item.id}
            />
            <span className="ml-1.5 w-10 shrink-0 truncate text-left text-xs font-normal text-muted-foreground">{item.unitOfMeasure}</span>
          </div>
        ) : (
          <div
            onClick={() => handleStartEdit(item)}
            className="group inline-flex cursor-pointer items-baseline justify-end"
            title="Haz clic para editar stock mínimo"
          >
            <span className="font-mono text-sm text-muted-foreground group-hover:text-foreground group-hover:underline">
              {Number(item.minimumStock).toFixed(2)}
            </span>
            <span className="ml-1.5 w-10 truncate text-left text-xs font-normal text-muted-foreground">{item.unitOfMeasure}</span>
          </div>
        ),
    },
    {
      key: "lastCost",
      header: "Último Costo",
      align: "right",
      width: "w-[120px] whitespace-nowrap",
      cellClassName: "font-mono text-sm text-foreground/90",
      cell: (item) => formatCost(item.lastCost),
    },
    {
      key: "averageCost",
      header: "Costo Promedio",
      align: "right",
      width: "w-[120px] whitespace-nowrap",
      cellClassName: "font-mono text-sm text-foreground/90",
      cell: (item) => formatCost(item.averageCost),
    },
    {
      key: "active",
      header: "Estado",
      width: "w-[90px]",
      cell: (item) => (
        <Badge
          className={
            item.active
              ? "bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200"
              : "bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200"
          }
        >
          {item.active ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
    {
      key: "stockStatus",
      header: "Estado Stock",
      width: "w-[110px]",
      cell: (item) =>
        Number(item.currentStock) <= Number(item.minimumStock) ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-600">
            <AlertTriangle className="h-3 w-3" /> Bajo Stock
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
            <CheckCircle2 className="h-3 w-3" /> Óptimo
          </span>
        ),
    },
    {
      key: "actions",
      header: "Acciones",
      align: "right",
      width: "w-[110px]",
      cell: (item) => (
        <RowActions
          mode="both"
          variant="outline"
          size="sm"
          actions={[
            { key: "adjust", label: "Ajustar", icon: <SlidersHorizontal />, tone: "neutral", onClick: () => handleOpenAdjustment(item) },
            {
              key: "toggle",
              label: item.active ? "Desactivar" : "Activar",
              icon: <Power />,
              tone: item.active ? "rose" : "emerald",
              mode: "icon",
              onClick: () => handleToggleStatus(item),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5 bg-card border p-3 rounded-xl shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por código, insumo o tipo..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
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

      {/* ── Table (DataTable compartido) ── */}
      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(item) => item.id}
        pageResetKey={`${search}|${statusFilter}`}
        pagination={{ defaultPageSize: 15, itemLabel: "insumos" }}
        emptyState={{
          icon: hasActiveFilter ? <Search className="h-7 w-7" /> : <Package className="h-7 w-7" />,
          title: hasActiveFilter ? "No se encontraron coincidencias" : "No hay insumos registrados",
          description: hasActiveFilter
            ? "Prueba con otros términos o cambia el filtro de estado."
            : "Registra tu primer insumo para comenzar a gestionar el inventario.",
          action: hasActiveFilter ? undefined : (
            <Button size="sm" onClick={() => setSupplyDialogOpen(true)} className="mt-1 flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Nuevo Insumo
            </Button>
          ),
        }}
      />

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

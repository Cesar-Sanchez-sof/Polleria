"use client";

import React, { useState } from "react";
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

  // KPI calculations (over full supplies list, not filtered)
  const totalSupplies = supplies.length;
  const rawMaterials = supplies.filter((s) => s.type === SupplyType.RawMaterial).length;
  const finishedProducts = supplies.filter((s) => s.type === SupplyType.FinishedProduct).length;
  const lowStockCount = supplies.filter(
    (s) => Number(s.currentStock) <= Number(s.minimumStock)
  ).length;

  const filtered = supplies.filter((i) => {
    const q = search.toLowerCase();
    const code = `INS-${i.id.toString().padStart(3, "0")}`.toLowerCase();
    const typeLabel = i.type === SupplyType.RawMaterial ? "materia prima" : "producto terminado";
    const affectationLabel = i.affectationIgv === AffectationIgv.Included ? "incluido" : "excluido";
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
      toast.success(
        `Insumo ${newStatus ? "activado" : "desactivado"} exitosamente`
      );
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
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-4 flex items-center gap-3">
          <div className="rounded-full bg-blue-100 p-2 shrink-0">
            <Package className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold leading-none">{totalSupplies}</p>
            <p className="text-xs text-muted-foreground mt-1">Total insumos</p>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4 flex items-center gap-3">
          <div className="rounded-full bg-amber-100 p-2 shrink-0">
            <Wheat className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold leading-none text-amber-700">{rawMaterials}</p>
            <p className="text-xs text-muted-foreground mt-1">Materias Primas</p>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4 flex items-center gap-3">
          <div className="rounded-full bg-orange-100 p-2 shrink-0">
            <UtensilsCrossed className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <p className="text-2xl font-bold leading-none text-orange-700">{finishedProducts}</p>
            <p className="text-xs text-muted-foreground mt-1">Prod. Terminados</p>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4 flex items-center gap-3">
          <div className="rounded-full bg-rose-100 p-2 shrink-0">
            <AlertTriangle className="h-5 w-5 text-rose-600" />
          </div>
          <div>
            <p className="text-2xl font-bold leading-none text-rose-700">{lowStockCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Bajo Stock</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
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

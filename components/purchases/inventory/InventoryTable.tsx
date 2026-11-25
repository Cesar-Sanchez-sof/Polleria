"use client";

import React, { useMemo, useState } from "react";
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
import { ProductDialog } from "./ProductDialog";
import { AdjustmentDialog } from "./AdjustmentDialog";
import { KardexDialog } from "./KardexDialog";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import {
  AdvancedFilterBar,
  normalizeFilterText,
} from "@/components/shared/AdvancedFilterBar";
import { AdvancedFilterToggle } from "@/components/shared/AdvancedFilterToggle";
import { RowActions } from "@/components/shared/RowActions";
import { Tag } from "@/components/shared/TagCell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Boxes,
} from "lucide-react";
import { ProductType, AffectationIgv } from "@prisma/client";
import { updateProductMinimum, updateProductUnit, setProductStatus } from "@/lib/services/purchases/product";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";

interface Product {
  id: number;
  name: string;
  type: ProductType;
  affectationIgv?: AffectationIgv;
  unitOfMeasure: string;
  currentStock: number | string;
  minimumStock: number | string;
  lastCost?: number | string | null;
  averageCost?: number | string | null;
  sellable?: boolean;
  price?: number | string | null;
  active: boolean;
}

interface InventoryTableProps {
  initialProducts: Product[];
}

export function InventoryTable({ initialProducts }: InventoryTableProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "raw" | "finished">("all");
  const [stockFilter, setStockFilter] = useState<"all" | "out" | "low" | "healthy">("all");
  const [sellableFilter, setSellableFilter] = useState<"all" | "yes" | "no">("all");
  const [igvFilter, setIgvFilter] = useState<"all" | "included" | "excluded" | "unset">("all");
  const [minimumStockFilter, setMinimumStockFilter] = useState("");
  const [maximumStockFilter, setMaximumStockFilter] = useState("");
  const [costFieldFilter, setCostFieldFilter] = useState<"average" | "last">("average");
  const [minimumCostFilter, setMinimumCostFilter] = useState("");
  const [maximumCostFilter, setMaximumCostFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [productToAdjust, setProductToAdjust] = useState<Product | null>(null);
  const [kardexOpen, setKardexOpen] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [savingId, setSavingId] = useState<number | null>(null);

  // Unit editing (inline)
  const [editingUnitId, setEditingUnitId] = useState<number | null>(null);
  const [editUnitValue, setEditUnitValue] = useState<string>("");
  const [savingUnitId, setSavingUnitId] = useState<number | null>(null);
  // Pending unit change (awaiting confirm when product has movements)
  const [pendingUnitChange, setPendingUnitChange] = useState<{ productId: number; unit: string } | null>(null);


  const filtered = useMemo(() => products.filter((i) => {
    const q = normalizeFilterText(search.trim());
    const code = `INS-${i.id.toString().padStart(3, "0")}`;
    const typeLabel = i.type === ProductType.RawMaterial ? "materia prima" : "producto terminado";
    const affectationLabel =
      i.affectationIgv === AffectationIgv.Included ? "incluido" : "excluido";
    const matchesSearch =
      !q ||
      [i.name, code, i.type, typeLabel, affectationLabel, i.unitOfMeasure]
        .some((value) => normalizeFilterText(value).includes(q));

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && i.active) ||
      (statusFilter === "inactive" && !i.active);

    const matchesType =
      typeFilter === "all" ||
      (typeFilter === "raw" && i.type === ProductType.RawMaterial) ||
      (typeFilter === "finished" && i.type === ProductType.FinishedProduct);
    const currentStock = Number(i.currentStock);
    const minimumStock = Number(i.minimumStock);
    const matchesStock =
      stockFilter === "all" ||
      (stockFilter === "out" && currentStock <= 0) ||
      (stockFilter === "low" && currentStock > 0 && currentStock <= minimumStock) ||
      (stockFilter === "healthy" && currentStock > minimumStock);
    const matchesSellable =
      sellableFilter === "all" ||
      (sellableFilter === "yes" && Boolean(i.sellable)) ||
      (sellableFilter === "no" && !i.sellable);
    const matchesIgv =
      igvFilter === "all" ||
      (igvFilter === "included" && i.affectationIgv === AffectationIgv.Included) ||
      (igvFilter === "excluded" && i.affectationIgv === AffectationIgv.Excluded) ||
      (igvFilter === "unset" && !i.affectationIgv);
    const minStock =
      minimumStockFilter === "" ? undefined : Number(minimumStockFilter);
    const maxStock =
      maximumStockFilter === "" ? undefined : Number(maximumStockFilter);
    const matchesQuantity =
      (minStock === undefined || currentStock >= minStock) &&
      (maxStock === undefined || currentStock <= maxStock);
    const minCost =
      minimumCostFilter === "" ? undefined : Number(minimumCostFilter);
    const maxCost =
      maximumCostFilter === "" ? undefined : Number(maximumCostFilter);
    const rawCost = costFieldFilter === "average" ? i.averageCost : i.lastCost;
    const cost = Number(rawCost);
    const hasCostRange = minCost !== undefined || maxCost !== undefined;
    const matchesCost =
      !hasCostRange ||
      (rawCost !== null &&
        rawCost !== undefined &&
        rawCost !== "" &&
        Number.isFinite(cost) &&
        (minCost === undefined || cost >= minCost) &&
        (maxCost === undefined || cost <= maxCost));

    return (
      matchesSearch &&
      matchesStatus &&
      matchesType &&
      matchesStock &&
      matchesSellable &&
      matchesIgv &&
      matchesQuantity &&
      matchesCost
    );
  }), [
    products,
    search,
    statusFilter,
    typeFilter,
    stockFilter,
    sellableFilter,
    igvFilter,
    minimumStockFilter,
    maximumStockFilter,
    costFieldFilter,
    minimumCostFilter,
    maximumCostFilter,
  ]);

  const activeFilterCount =
    Number(statusFilter !== "all") +
    Number(typeFilter !== "all") +
    Number(stockFilter !== "all") +
    Number(sellableFilter !== "all") +
    Number(igvFilter !== "all") +
    Number(minimumStockFilter !== "") +
    Number(maximumStockFilter !== "") +
    Number(minimumCostFilter !== "") +
    Number(maximumCostFilter !== "");
  const hasActiveFilter = search.trim() !== "" || activeFilterCount > 0;
  const invalidStockRange =
    minimumStockFilter !== "" &&
    maximumStockFilter !== "" &&
    Number(minimumStockFilter) > Number(maximumStockFilter);
  const invalidCostRange =
    minimumCostFilter !== "" &&
    maximumCostFilter !== "" &&
    Number(minimumCostFilter) > Number(maximumCostFilter);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setTypeFilter("all");
    setStockFilter("all");
    setSellableFilter("all");
    setIgvFilter("all");
    setMinimumStockFilter("");
    setMaximumStockFilter("");
    setCostFieldFilter("average");
    setMinimumCostFilter("");
    setMaximumCostFilter("");
  };

  const handleNewProductSuccess = (created: Product) => {
    setProducts((prev) => [created, ...prev]);
  };

  const handleAdjustmentSuccess = (updated: Product) => {
    setProducts((prev) =>
      prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i))
    );
  };

  const handleOpenAdjustment = (product: Product) => {
    setProductToAdjust(product);
    setAdjustmentDialogOpen(true);
  };

  const handleToggleStatus = async (item: Product) => {
    const newStatus = !item.active;
    try {
      await setProductStatus(item.id, newStatus);
      setProducts((prev) =>
        prev.map((s) => (s.id === item.id ? { ...s, active: newStatus } : s))
      );
      toast.success(`Insumo ${newStatus ? "activado" : "desactivado"} exitosamente`);
    } catch (err: any) {
      toast.error(err.message || "Error al cambiar estado del insumo");
    }
  };

  const handleStartEdit = (item: Product) => {
    setEditingId(item.id);
    setEditValue(String(Number(item.minimumStock)));
  };

  const handleSaveMinimum = async (productId: number) => {
    if (editingId !== productId) return;
    const num = parseFloat(editValue);
    if (isNaN(num) || num < 0) {
      toast.error("El stock mínimo no puede ser negativo");
      setEditingId(null);
      return;
    }

    const currentItem = products.find((s) => s.id === productId);
    if (currentItem && Number(currentItem.minimumStock) === num) {
      setEditingId(null);
      return;
    }

    setSavingId(productId);
    try {
      const updated = await updateProductMinimum(productId, num);
      setProducts((prev) =>
        prev.map((s) =>
          s.id === productId ? { ...s, minimumStock: Number(updated.minimumStock) } : s
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
    productId: number
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveMinimum(productId);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditingId(null);
    }
  };

  const handleStartEditUnit = (item: Product) => {
    setEditingUnitId(item.id);
    setEditUnitValue(item.unitOfMeasure);
  };

  const doSaveUnit = async (productId: number, unit: string) => {
    setSavingUnitId(productId);
    try {
      const updated = await updateProductUnit(productId, unit);
      setProducts((prev) =>
        prev.map((s) =>
          s.id === productId ? { ...s, unitOfMeasure: updated.unitOfMeasure } : s
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

  const handleSaveUnit = async (productId: number) => {
    if (editingUnitId !== productId) return;
    const newUnit = editUnitValue.trim().toUpperCase();
    const currentItem = products.find((s) => s.id === productId);
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
      setPendingUnitChange({ productId, unit: newUnit });
      return;
    }
    await doSaveUnit(productId, newUnit);
  };

  const handleKeyDownUnit = (
    e: React.KeyboardEvent<HTMLInputElement>,
    productId: number
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveUnit(productId);
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

  const columns: DataTableColumn<Product>[] = [
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
      header: "Producto",
      sortable: true,
      sortValue: (item) => item.name,
      cellClassName: "font-medium",
      cell: (item) => (
        <span className="flex flex-wrap items-center gap-2">
          {item.name}
          {item.sellable ? (
            <Tag tone="blue" size="sm">
              En carta · S/ {Number(item.price ?? 0).toFixed(2)}
            </Tag>
          ) : null}
        </span>
      ),
    },
    {
      key: "type",
      header: "Tipo",
      cell: (item) => {
        const isRawMaterial = item.type === ProductType.RawMaterial;
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
    <>
      <ModuleHeader
        title="Kardex e Inventario"
        subtitle="Stock, estado, tipo y costo de materias primas y productos terminados"
        icon={Boxes}
        iconClassName="bg-emerald-100 text-emerald-800"
      >
        <Button
          variant="outline"
          onClick={() => setKardexOpen(true)}
          size="sm"
          className="h-9 px-3.5 text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <ListOrdered className="h-4 w-4" /> Ver Kardex
        </Button>

        <AdvancedFilterToggle
          open={filtersOpen}
          onToggle={() => setFiltersOpen((open) => !open)}
        />
        <Button
          onClick={() => setProductDialogOpen(true)}
          size="sm"
          className="h-9 px-3.5 text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <Plus className="h-4 w-4" /> Nuevo Insumo
        </Button>
      </ModuleHeader>

      <main className="relative flex-1 w-full min-w-0 space-y-4 p-3 sm:p-4 md:p-6">

      {filtersOpen && <AdvancedFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar código, producto, tipo, unidad o afectación IGV..."
        activeFilterCount={activeFilterCount}
        hasActiveFilters={hasActiveFilter}
        onClear={clearFilters}
        resultCount={filtered.length}
        itemLabel={`de ${products.length} productos`}
      >
        <InventoryFilterSelect
          label="Estado"
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}
          options={[
            { value: "all", label: "Todos" },
            { value: "active", label: "Activos" },
            { value: "inactive", label: "Inactivos" },
          ]}
        />
        <InventoryFilterSelect
          label="Tipo"
          value={typeFilter}
          onValueChange={(value) => setTypeFilter(value as typeof typeFilter)}
          options={[
            { value: "all", label: "Todos los tipos" },
            { value: "raw", label: "Materia prima" },
            { value: "finished", label: "Producto terminado" },
          ]}
        />
        <InventoryFilterSelect
          label="Stock"
          value={stockFilter}
          onValueChange={(value) => setStockFilter(value as typeof stockFilter)}
          options={[
            { value: "all", label: "Cualquier stock" },
            { value: "out", label: "Agotado" },
            { value: "low", label: "Bajo mínimo" },
            { value: "healthy", label: "Óptimo" },
          ]}
        />
        <InventoryFilterSelect
          label="Venta"
          value={sellableFilter}
          onValueChange={(value) => setSellableFilter(value as typeof sellableFilter)}
          options={[
            { value: "all", label: "Todos" },
            { value: "yes", label: "En carta" },
            { value: "no", label: "No vendible" },
          ]}
        />
        <InventoryFilterSelect
          label="IGV"
          value={igvFilter}
          onValueChange={(value) => setIgvFilter(value as typeof igvFilter)}
          options={[
            { value: "all", label: "Cualquier afectación" },
            { value: "included", label: "Incluido" },
            { value: "excluded", label: "Excluido" },
            { value: "unset", label: "Sin configurar" },
          ]}
        />
        <label className="flex min-w-[105px] flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Stock desde
          <Input
            type="number"
            min="0"
            step="0.01"
            value={minimumStockFilter}
            onChange={(event) => setMinimumStockFilter(event.target.value)}
            placeholder="Mínimo"
            className="h-9 rounded-lg text-xs"
          />
        </label>
        <label className="flex min-w-[105px] flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Stock hasta
          <Input
            type="number"
            min="0"
            step="0.01"
            value={maximumStockFilter}
            onChange={(event) => setMaximumStockFilter(event.target.value)}
            placeholder="Máximo"
            className="h-9 rounded-lg text-xs"
          />
        </label>
        <InventoryFilterSelect
          label="Costo de referencia"
          value={costFieldFilter}
          onValueChange={(value) => setCostFieldFilter(value as typeof costFieldFilter)}
          options={[
            { value: "average", label: "Costo promedio" },
            { value: "last", label: "Último costo" },
          ]}
        />
        <label className="flex min-w-[105px] flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Costo desde
          <Input
            type="number"
            min="0"
            step="0.01"
            value={minimumCostFilter}
            onChange={(event) => setMinimumCostFilter(event.target.value)}
            placeholder="Mínimo"
            className="h-9 rounded-lg text-xs"
          />
        </label>
        <label className="flex min-w-[105px] flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Costo hasta
          <Input
            type="number"
            min="0"
            step="0.01"
            value={maximumCostFilter}
            onChange={(event) => setMaximumCostFilter(event.target.value)}
            placeholder="Máximo"
            className="h-9 rounded-lg text-xs"
          />
        </label>
      </AdvancedFilterBar>}
      {invalidStockRange && (
        <p className="text-xs font-medium text-amber-700">
          El stock mínimo no puede ser mayor que el máximo.
        </p>
      )}
      {invalidCostRange && (
        <p className="text-xs font-medium text-amber-700">
          El costo mínimo no puede ser mayor que el máximo.
        </p>
      )}

      {/* ── Table (DataTable compartido) ── */}
      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(item) => item.id}
        pageResetKey={`${search}|${statusFilter}|${typeFilter}|${stockFilter}|${sellableFilter}|${igvFilter}|${minimumStockFilter}|${maximumStockFilter}|${costFieldFilter}|${minimumCostFilter}|${maximumCostFilter}`}
        pagination={{ defaultPageSize: 15, itemLabel: "insumos" }}
        emptyState={{
          icon: hasActiveFilter ? <Search className="h-7 w-7" /> : <Package className="h-7 w-7" />,
          title: hasActiveFilter ? "No se encontraron coincidencias" : "No hay insumos registrados",
          description: hasActiveFilter
            ? "Prueba con otros términos o cambia el filtro de estado."
            : "Registra tu primer insumo para comenzar a gestionar el inventario.",
          action: hasActiveFilter ? undefined : (
            <Button size="sm" onClick={() => setProductDialogOpen(true)} className="mt-1 flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Nuevo Insumo
            </Button>
          ),
        }}
      />

      <ProductDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        onSuccess={handleNewProductSuccess}
      />

      <AdjustmentDialog
        open={adjustmentDialogOpen}
        onOpenChange={setAdjustmentDialogOpen}
        product={productToAdjust}
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
                  doSaveUnit(pendingUnitChange.productId, pendingUnitChange.unit);
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
        products={products.map((s) => ({
          id: s.id,
          name: s.name,
          unitOfMeasure: s.unitOfMeasure,
        }))}
      />
      </main>
    </>
  );
}

function InventoryFilterSelect({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex min-w-[135px] flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
      {label}
      <Select
        value={value}
        items={options}
        onValueChange={(nextValue) => onValueChange(nextValue ?? options[0].value)}
      >
        <SelectTrigger className="h-9 w-full rounded-lg bg-background text-xs font-normal normal-case tracking-normal">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

"use client";

import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  UtensilsCrossed,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  ChefHat,
  Scale,
  Sparkles,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { StatCard } from "@/components/shared/StatCard";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { RowActions } from "@/components/shared/RowActions";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Tag } from "@/components/shared/TagCell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RecipeItem {
  id?: number;
  ingredientId: number;
  quantityRequired: number;
  ingredientName?: string;
  unitOfMeasure?: string;
  costPerUnit?: number;
  estimatedCost?: number;
}

interface ProductItem {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  active: boolean;
  stock: number;
  type: "FinishedProduct" | "RawMaterial";
  unitOfMeasure: string;
  available: boolean;
  recipe: RecipeItem[];
  recipeCost: number;
}

interface IngredientOption {
  id: number;
  name: string;
  type: string;
  unitOfMeasure: string;
  currentStock: number;
  lastCost: number;
  averageCost: number;
}

export default function ProductsCatalogPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [ingredients, setIngredients] = useState<IngredientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState<"todos" | "active" | "inactive">("todos");

  // Modal Crear / Editar Producto
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Formulario de Producto
  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formType, setFormType] = useState<"FinishedProduct" | "RawMaterial">("FinishedProduct");
  const [formUnit, setFormUnit] = useState("UND");
  const [formRecipes, setFormRecipes] = useState<
    Array<{ ingredientId: number; quantityRequired: number }>
  >([]);

  // Modal Confirmar Desactivación (Eliminar producto cambiando estado)
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [productToDeactivate, setProductToDeactivate] = useState<ProductItem | null>(null);

  // Cargar productos y suministros
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [resProducts, resIngredients] = await Promise.all([
        fetch("/api/products?sellable=true&includeInactive=true&includeRecipes=true"),
        fetch("/api/products"),
      ]);

      if (resProducts.ok) {
        const json = await resProducts.json();
        setProducts(json.data || []);
      }
      if (resIngredients.ok) {
        const json = await resIngredients.json();
        setIngredients(json.data || []);
      }
    } catch (err: any) {
      toast.error("Error al cargar la carta de productos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Abrir modal para crear producto nuevo
  const handleOpenCreateModal = () => {
    setEditingProduct(null);
    setFormName("");
    setFormPrice("");
    setFormDescription("");
    setFormType("FinishedProduct");
    setFormUnit("UND");
    setFormRecipes([]);
    setModalOpen(true);
  };

  // Abrir modal para editar producto
  const handleOpenEditModal = (product: ProductItem) => {
    setEditingProduct(product);
    setFormName(product.name);
    setFormPrice(String(product.price));
    setFormDescription(product.description || "");
    setFormType(product.type === "RawMaterial" ? "RawMaterial" : "FinishedProduct");
    setFormUnit(product.unitOfMeasure || "UND");
    setFormRecipes(
      product.recipe.map((r) => ({
        ingredientId: r.ingredientId,
        quantityRequired: r.quantityRequired,
      }))
    );
    setModalOpen(true);
  };

  // Añadir fila de ingrediente a la receta
  const handleAddRecipeItem = () => {
    if (ingredients.length === 0) {
      toast.error("No hay insumos registrados en el almacén.");
      return;
    }
    // Seleccionar el primer insumo disponible que aún no esté en la receta
    const usedIds = new Set(formRecipes.map((r) => r.ingredientId));
    const firstAvailable = ingredients.find((s) => !usedIds.has(s.id)) || ingredients[0];

    setFormRecipes([...formRecipes, { ingredientId: firstAvailable.id, quantityRequired: 1 }]);
  };

  // Actualizar fila de receta
  const handleUpdateRecipeItem = (
    index: number,
    field: "ingredientId" | "quantityRequired",
    val: number
  ) => {
    const updated = [...formRecipes];
    updated[index] = { ...updated[index], [field]: val };
    setFormRecipes(updated);
  };

  // Quitar ingrediente de la receta
  const handleRemoveRecipeItem = (index: number) => {
    setFormRecipes(formRecipes.filter((_, i) => i !== index));
  };

  // Calcular costo estimado en tiempo real en el formulario
  const calculatedFormRecipeCost = useMemo(() => {
    return formRecipes.reduce((sum, item) => {
      const sup = ingredients.find((s) => s.id === item.ingredientId);
      const unitCost = sup ? sup.averageCost || sup.lastCost || 0 : 0;
      return sum + item.quantityRequired * unitCost;
    }, 0);
  }, [formRecipes, ingredients]);

  const estimatedFormMargin = useMemo(() => {
    const priceNum = Number(formPrice);
    if (!priceNum || priceNum <= 0) return 0;
    const profit = priceNum - calculatedFormRecipeCost;
    return Math.round((profit / priceNum) * 100);
  }, [formPrice, calculatedFormRecipeCost]);

  // Guardar (Crear o Actualizar) Producto
  const handleSaveProduct = async () => {
    const name = formName.trim();
    const price = Number(formPrice);

    if (!name) {
      toast.error("Ingrese el nombre del producto.");
      return;
    }
    if (!price || price <= 0) {
      toast.error("El precio debe ser un monto mayor a cero.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        description: formDescription.trim(),
        price,
        type: formType,
        unitOfMeasure: formUnit.trim() || "UND",
        recipe: formRecipes
          .filter((r) => r.ingredientId && r.quantityRequired > 0)
          .map((r) => ({
            ingredientId: r.ingredientId,
            quantityRequired: r.quantityRequired,
          })),
      };

      const url = editingProduct ? `/api/products/${editingProduct.id}` : "/api/products";
      const method = editingProduct ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Error al guardar el producto.");
      }

      toast.success(editingProduct ? "Producto actualizado correctamente." : "Producto creado exitosamente.");
      setModalOpen(false);
      void loadData();
    } catch (err: any) {
      toast.error(err.message || "No se pudo guardar el producto.");
    } finally {
      setSaving(false);
    }
  };

  // Alternar estado activo / inactivo (Soft Delete / Pausar producto)
  const handleToggleProductStatus = async (product: ProductItem) => {
    const nextStatus = !product.active;
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextStatus }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al actualizar estado.");

      toast.success(
        nextStatus
          ? `Producto "${product.name}" habilitado en la carta.`
          : `Producto "${product.name}" pausado (desactivado de la carta).`
      );
      void loadData();
    } catch (err: any) {
      toast.error(err.message || "Error al cambiar estado.");
    }
  };

  // Confirmar eliminación / desactivación suave
  const handleConfirmDeactivate = async () => {
    if (!productToDeactivate) return;
    try {
      const res = await fetch(`/api/products/${productToDeactivate.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al desactivar producto.");

      toast.success(`Producto "${productToDeactivate.name}" marcado como inactivo.`);
      setDeactivateModalOpen(false);
      setProductToDeactivate(null);
      void loadData();
    } catch (err: any) {
      toast.error(err.message || "No se pudo desactivar el producto.");
    }
  };

  // Filtrado de productos
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(search.toLowerCase()) ||
        product.description.toLowerCase().includes(search.toLowerCase()) ||
        product.recipe.some((r) => r.ingredientName?.toLowerCase().includes(search.toLowerCase()));

      const matchesCat =
        categoryFilter === "todos" || product.category.toLowerCase() === categoryFilter.toLowerCase();

      const matchesStatus =
        statusFilter === "todos"
          ? true
          : statusFilter === "active"
          ? product.active
          : !product.active;

      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [products, search, categoryFilter, statusFilter]);

  // Métricas
  const metrics = useMemo(() => {
    const total = products.length;
    const active = products.filter((d) => d.active).length;
    const inactive = total - active;
    const withRecipe = products.filter((d) => d.recipe && d.recipe.length > 0).length;
    return { total, active, inactive, withRecipe };
  }, [products]);

  const columns: DataTableColumn<ProductItem>[] = [
    {
      key: "name",
      header: "Producto",
      width: "min-w-[240px]",
      sortable: true,
      sortValue: (product) => product.name,
      primary: {
        title: (product) => product.name,
        subtitle: (product) => product.description || undefined,
        icon: <UtensilsCrossed />,
        iconTone: "amber",
      },
    },
    {
      key: "category",
      header: "Categoría",
      width: "w-32",
      sortable: true,
      sortValue: (product) => product.category,
      cell: (product) => (
        <Tag tone={product.category === "pollos" ? "rose" : product.category === "bebidas" ? "blue" : "amber"} size="sm" className="capitalize">
          {product.category}
        </Tag>
      ),
    },
    {
      key: "price",
      header: "Precio Venta",
      width: "w-32",
      sortable: true,
      sortValue: (product) => product.price,
      cellClassName: "font-mono text-sm font-extrabold text-foreground",
      cell: (product) => `S/ ${product.price.toFixed(2)}`,
    },
    {
      key: "stock",
      header: "Stock",
      align: "right",
      width: "w-28",
      sortable: true,
      sortValue: (product) => product.stock,
      cell: (product) => (
        <span
          className={`font-mono text-sm font-bold ${product.stock <= 0 ? "text-rose-600" : "text-foreground"}`}
          title="Se llena con compras, transformaciones o ajustes en Kardex e Inventario"
        >
          {product.stock} <span className="text-[10px] font-normal text-muted-foreground">{product.unitOfMeasure}</span>
        </span>
      ),
    },
    {
      key: "recipe",
      header: "Receta e Ingredientes",
      width: "min-w-[240px]",
      cell: (product) =>
        product.recipe && product.recipe.length > 0 ? (
          <div className="flex max-w-xs flex-wrap gap-1">
            {product.recipe.map((r, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                title={`Costo unitario: S/ ${(r.costPerUnit || 0).toFixed(2)}`}
              >
                <span className="font-bold text-primary">
                  {r.quantityRequired} {r.unitOfMeasure}
                </span>
                <span>{r.ingredientName}</span>
              </span>
            ))}
          </div>
        ) : (
          <span className="flex items-center gap-1 text-[11px] italic text-muted-foreground">
            <Info className="h-3.5 w-3.5 text-amber-500" />
            Sin receta asignada
          </span>
        ),
    },
    {
      key: "cost",
      header: "Costo Estimado",
      width: "w-36",
      sortable: true,
      sortValue: (product) => product.recipeCost,
      cell: (product) =>
        product.recipeCost > 0 ? (
          <div>
            <span className="block font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
              S/ {product.recipeCost.toFixed(2)}
            </span>
            <span className={`text-[10px] font-bold ${product.price > product.recipeCost ? "text-emerald-600" : "text-rose-600"}`}>
              Margen: {Math.round(((product.price - product.recipeCost) / product.price) * 100)}%
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground">—</span>
        ),
    },
    {
      key: "status",
      header: "Disponibilidad",
      align: "center",
      width: "w-36",
      sortable: true,
      sortValue: (product) => (product.active ? 1 : 0),
      cell: (product) => (
        <button
          type="button"
          onClick={() => handleToggleProductStatus(product)}
          className="cursor-pointer"
          title="Haga clic para alternar disponibilidad en la carta"
        >
          <StatusBadge tone={product.active ? "success" : "neutral"} pulse={product.active}>
            {product.active ? "En Carta" : "Pausado"}
          </StatusBadge>
        </button>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      align: "right",
      width: "w-36",
      cell: (product) => (
        <RowActions
          size="sm"
          actions={[
            { key: "edit", label: "Editar producto y receta", icon: <Edit2 />, tone: "blue", onClick: () => handleOpenEditModal(product) },
            {
              key: "deactivate",
              label: "Desactivar / ocultar producto de la carta",
              icon: <Trash2 />,
              tone: "rose",
              onClick: () => {
                setProductToDeactivate(product);
                setDeactivateModalOpen(true);
              },
            },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <ModuleHeader
        title="Productos y Carta"
        subtitle="Lo que se vende en el salón: precio, receta (ingredientes por unidad) y stock disponible"
        icon={ChefHat}
        iconClassName="bg-amber-100 text-amber-800"
      >
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="relative w-56">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar producto o ingrediente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs rounded-xl h-9"
            />
          </div>
          <SegmentedTabs
            ariaLabel="Filtrar por categoría"
            value={categoryFilter}
            onValueChange={setCategoryFilter}
            className="max-w-full overflow-x-auto"
            items={[
              { value: "todos", label: "Todos", tone: "brand" },
              { value: "pollos", label: "Pollos", tone: "brand" },
              { value: "adicionales", label: "Guarniciones", tone: "brand" },
              { value: "bebidas", label: "Bebidas", tone: "brand" },
            ]}
          />
          <SegmentedTabs
            ariaLabel="Filtrar por estado"
            value={statusFilter}
            onValueChange={setStatusFilter}
            className="max-w-full overflow-x-auto"
            items={[
              { value: "todos", label: "Todo Estado", tone: "brand" },
              { value: "active", label: "Activos", tone: "success" },
              { value: "inactive", label: "Pausados", tone: "warning" },
            ]}
          />
          <Button
            size="sm"
            onClick={handleOpenCreateModal}
            className="text-xs h-9 font-bold gap-1.5 rounded-xl bg-red-700 hover:bg-red-800 text-white shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Producto</span>
          </Button>
        </div>
      </ModuleHeader>

      <main className="flex-1 w-full min-w-0 p-4 sm:p-6 flex flex-col gap-5">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <StatCard layout="label-first" tone="neutral" icon={<UtensilsCrossed />} label="Total Productos" value={metrics.total} />
          <StatCard layout="label-first" tone="emerald" icon={<CheckCircle2 />} label="Activos en Carta" value={metrics.active} colorValue />
          <StatCard layout="label-first" tone="amber" icon={<AlertCircle />} label="Pausados / Inactivos" value={metrics.inactive} colorValue />
          <StatCard layout="label-first" tone="blue" icon={<Scale />} label="Con Receta (Escandallo)" value={metrics.withRecipe} colorValue />
        </div>

        {/* Tabla / Listado de Productos */}
        <DataTable
          columns={columns}
          rows={filteredProducts}
          rowKey={(product) => product.id}
          defaultSort={{ key: "name", direction: "asc" }}
          pageResetKey={`${search}|${categoryFilter}|${statusFilter}`}
          pagination={{ defaultPageSize: 15, itemLabel: "productos" }}
          loading={loading}
          loadingMode="auto"
          rowClassName={(product) => (product.active ? undefined : "opacity-60")}
          emptyState={{
            icon: <UtensilsCrossed className="h-7 w-7" />,
            title: "No se encontraron productos que coincidan con los criterios de búsqueda.",
          }}
        />
      </main>

      {/* =================================================================== */}
      {/* MODAL: REGISTRAR / EDITAR PLATO CON INGREDIENTES */}
      {/* =================================================================== */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-5 bg-card">
          <DialogHeader className="pb-3 border-b border-border">
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-red-700" />
              <span>{editingProduct ? "Editar Producto y Receta" : "Registrar Nuevo Producto"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure los datos de venta del producto y vincule los ingredientes necesarios para su
              preparación y costeo automático.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {/* Datos Básicos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Nombre del Producto <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="Ej: 1/4 Pollo a la Brasa con Papas"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="text-xs h-9 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Precio de Venta (S/) <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  step="0.10"
                  placeholder="24.00"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  className="text-xs h-9 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Tipo de producto</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as "FinishedProduct" | "RawMaterial")}
                  className="w-full text-xs h-9 rounded-xl border border-input bg-background px-3 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="FinishedProduct">Producto terminado</option>
                  <option value="RawMaterial">Materia prima</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Unidad de medida</label>
                <Input
                  type="text"
                  placeholder="UND"
                  value={formUnit}
                  onChange={(e) => setFormUnit(e.target.value)}
                  className="text-xs h-9 rounded-xl font-mono uppercase"
                />
              </div>

              {editingProduct ? (
                <p className="sm:col-span-2 rounded-xl bg-muted/50 p-2.5 text-[11px] text-muted-foreground">
                  Stock actual: <strong className="font-mono text-foreground">{editingProduct.stock}</strong>{" "}
                  {editingProduct.unitOfMeasure}. El stock sube por compra o transformación y se corrige con un ajuste en{" "}
                  <strong>Kardex e Inventario</strong>.
                </p>
              ) : (
                <p className="sm:col-span-2 rounded-xl bg-muted/50 p-2.5 text-[11px] text-muted-foreground">
                  El producto nace con stock 0. Agrégalo con una compra, una transformación o un ajuste en{" "}
                  <strong>Kardex e Inventario</strong>.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1">
                Descripción / Notas de Carta (Opcional)
              </label>
              <textarea
                placeholder="Incluye papas fritas crocantes, ensalada fresca y salsas de la casa..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
                className="w-full text-xs rounded-xl border border-input bg-background p-2.5 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* SECCIÓN RECETA E INGREDIENTES */}
            <div className="border border-border/80 rounded-2xl p-4 bg-muted/30 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-extrabold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                    <Scale className="w-4 h-4 text-primary" />
                    <span>Ingredientes y Cantidades Requeridas (Escandallo)</span>
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Ingredientes por 1 unidad: sirven para costear y son los que consume una transformación (Compras → Transformación). La venta descuenta el stock del propio producto.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddRecipeItem}
                  className="text-xs h-8 px-2.5 rounded-xl font-bold gap-1 bg-background hover:bg-muted cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-primary" />
                  <span>Añadir Ingrediente</span>
                </Button>
              </div>

              {formRecipes.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-border rounded-xl text-muted-foreground text-xs">
                  <p className="font-medium">No se han vinculado ingredientes a este producto.</p>
                  <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                    Haga clic en &quot;Añadir Ingrediente&quot; para vincular insumos del almacén con sus
                    cantidades exactas.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {formRecipes.map((item, idx) => {
                    const selectedProduct = ingredients.find((s) => s.id === item.ingredientId);
                    const unitCost = selectedProduct
                      ? selectedProduct.averageCost || selectedProduct.lastCost || 0
                      : 0;
                    const lineCost = item.quantityRequired * unitCost;

                    return (
                      <div
                        key={idx}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 rounded-xl bg-background border border-border"
                      >
                        {/* Selector de Insumo */}
                        <div className="flex-1 min-w-[200px]">
                          <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">
                            Ingrediente #{idx + 1}
                          </label>
                          <select
                            value={item.ingredientId}
                            onChange={(e) =>
                              handleUpdateRecipeItem(idx, "ingredientId", Number(e.target.value))
                            }
                            className="w-full text-xs h-8 rounded-lg border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            {ingredients.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.unitOfMeasure}) — Stock: {s.currentStock}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Cantidad requerida */}
                        <div className="w-28">
                          <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">
                            Cantidad ({selectedProduct?.unitOfMeasure || "und"})
                          </label>
                          <Input
                            type="number"
                            step="0.0001"
                            min="0.0001"
                            value={item.quantityRequired}
                            onChange={(e) =>
                              handleUpdateRecipeItem(idx, "quantityRequired", Number(e.target.value))
                            }
                            className="text-xs h-8 rounded-lg font-mono"
                          />
                        </div>

                        {/* Costo de la línea */}
                        <div className="w-24 text-right">
                          <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">
                            Costo Insumo
                          </label>
                          <span className="font-mono text-xs font-semibold text-foreground">
                            S/ {lineCost.toFixed(2)}
                          </span>
                        </div>

                        {/* Botón quitar */}
                        <button
                          type="button"
                          onClick={() => handleRemoveRecipeItem(idx)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer self-end sm:self-center"
                          title="Quitar ingrediente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Resumen de Costeo de Receta */}
              {formRecipes.length > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-border/80 text-xs font-bold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Costo Estimado de Producción:</span>
                    <span className="font-mono text-primary font-extrabold">
                      S/ {calculatedFormRecipeCost.toFixed(2)}
                    </span>
                  </span>
                  {Number(formPrice) > 0 && (
                    <span
                      className={`font-semibold ${
                        estimatedFormMargin >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      Margen Bruto Estimado: {estimatedFormMargin}%
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex gap-2 pt-3 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalOpen(false)}
              disabled={saving}
              className="text-xs font-semibold rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveProduct}
              disabled={saving}
              className="bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <ChefHat className="w-3.5 h-3.5" />
              <span>{saving ? "Guardando..." : editingProduct ? "Actualizar Producto" : "Guardar Producto"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODAL: CONFIRMAR DESACTIVACIÓN (SOFT DELETE) */}
      {/* =================================================================== */}
      <Dialog open={deactivateModalOpen} onOpenChange={setDeactivateModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl p-5 bg-card">
          <DialogHeader className="pb-2 border-b border-border">
            <DialogTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>Pausar / Desactivar Producto</span>
            </DialogTitle>
          </DialogHeader>

          <div className="py-3 text-xs text-muted-foreground flex flex-col gap-2">
            <p>
              ¿Está seguro de que desea retirar el producto{" "}
              <strong className="text-foreground">&quot;{productToDeactivate?.name}&quot;</strong> de la
              carta?
            </p>
            <p className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-2.5 rounded-xl text-amber-800 dark:text-amber-200">
              ℹ️ El producto se marcará como <strong>Inactivo</strong>. No se eliminarán sus registros
              contables ni las ventas pasadas donde fue consumido, pero no aparecerá en el salón para
              nuevos pedidos.
            </p>
          </div>

          <DialogFooter className="flex gap-2 pt-2 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeactivateModalOpen(false)}
              className="text-xs font-semibold rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmDeactivate}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
            >
              Confirmar Desactivación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

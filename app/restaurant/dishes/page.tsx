"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  UtensilsCrossed,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  Layers,
  DollarSign,
  ChefHat,
  RefreshCw,
  Scale,
  Sparkles,
  Eye,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Card } from "@/components/ui/card";
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

interface RecipeItem {
  id?: number;
  supplyId: number;
  quantityRequired: number;
  supplyName?: string;
  unitOfMeasure?: string;
  costPerUnit?: number;
  estimatedCost?: number;
}

interface DishItem {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  active: boolean;
  stock: number;
  available: boolean;
  recipes: RecipeItem[];
  recipeCost: number;
}

interface SupplyOption {
  id: number;
  name: string;
  type: string;
  unitOfMeasure: string;
  currentStock: number;
  lastCost: number;
  averageCost: number;
}

export default function DishesManagementPage() {
  const [dishes, setDishes] = useState<DishItem[]>([]);
  const [supplies, setSupplies] = useState<SupplyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState<"todos" | "active" | "inactive">("todos");

  // Modal Crear / Editar Plato
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDish, setEditingDish] = useState<DishItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Formulario de Plato
  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formCategory, setFormCategory] = useState("pollos");
  const [formDescription, setFormDescription] = useState("");
  const [formStock, setFormStock] = useState("50");
  const [formRecipes, setFormRecipes] = useState<
    Array<{ supplyId: number; quantityRequired: number }>
  >([]);

  // Modal Confirmar Desactivación (Eliminar plato cambiando estado)
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [dishToDeactivate, setDishToDeactivate] = useState<DishItem | null>(null);

  // Cargar platos y suministros
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [resDishes, resSupplies] = await Promise.all([
        fetch("/api/dishes?includeInactive=true&includeRecipes=true"),
        fetch("/api/supplies"),
      ]);

      if (resDishes.ok) {
        const json = await resDishes.json();
        setDishes(json.data || []);
      }
      if (resSupplies.ok) {
        const json = await resSupplies.json();
        setSupplies(json.data || []);
      }
    } catch (err: any) {
      toast.error("Error al cargar carta de platos o insumos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Abrir modal para crear plato nuevo
  const handleOpenCreateModal = () => {
    setEditingDish(null);
    setFormName("");
    setFormPrice("");
    setFormCategory("pollos");
    setFormDescription("");
    setFormStock("50");
    setFormRecipes([]);
    setModalOpen(true);
  };

  // Abrir modal para editar plato
  const handleOpenEditModal = (dish: DishItem) => {
    setEditingDish(dish);
    setFormName(dish.name);
    setFormPrice(String(dish.price));
    setFormCategory(dish.category || "pollos");
    setFormDescription(dish.description || "");
    setFormStock(String(dish.stock || 50));
    setFormRecipes(
      dish.recipes.map((r) => ({
        supplyId: r.supplyId,
        quantityRequired: r.quantityRequired,
      }))
    );
    setModalOpen(true);
  };

  // Añadir fila de ingrediente a la receta
  const handleAddRecipeItem = () => {
    if (supplies.length === 0) {
      toast.error("No hay insumos registrados en el almacén.");
      return;
    }
    // Seleccionar el primer insumo disponible que aún no esté en la receta
    const usedIds = new Set(formRecipes.map((r) => r.supplyId));
    const firstAvailable = supplies.find((s) => !usedIds.has(s.id)) || supplies[0];

    setFormRecipes([...formRecipes, { supplyId: firstAvailable.id, quantityRequired: 1 }]);
  };

  // Actualizar fila de receta
  const handleUpdateRecipeItem = (
    index: number,
    field: "supplyId" | "quantityRequired",
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
      const sup = supplies.find((s) => s.id === item.supplyId);
      const unitCost = sup ? sup.averageCost || sup.lastCost || 0 : 0;
      return sum + item.quantityRequired * unitCost;
    }, 0);
  }, [formRecipes, supplies]);

  const estimatedFormMargin = useMemo(() => {
    const priceNum = Number(formPrice);
    if (!priceNum || priceNum <= 0) return 0;
    const profit = priceNum - calculatedFormRecipeCost;
    return Math.round((profit / priceNum) * 100);
  }, [formPrice, calculatedFormRecipeCost]);

  // Guardar (Crear o Actualizar) Plato
  const handleSaveDish = async () => {
    const name = formName.trim();
    const price = Number(formPrice);

    if (!name) {
      toast.error("Ingrese el nombre del plato.");
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
        stock: Number(formStock) || 50,
        ingredients: formRecipes
          .filter((r) => r.supplyId && r.quantityRequired > 0)
          .map((r) => ({
            supplyId: r.supplyId,
            quantityRequired: r.quantityRequired,
          })),
      };

      const url = editingDish ? `/api/dishes/${editingDish.id}` : "/api/dishes";
      const method = editingDish ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Error al guardar el plato.");
      }

      toast.success(editingDish ? "Plato actualizado correctamente." : "Plato creado exitosamente.");
      setModalOpen(false);
      void loadData();
    } catch (err: any) {
      toast.error(err.message || "No se pudo guardar el plato.");
    } finally {
      setSaving(false);
    }
  };

  // Alternar estado activo / inactivo (Soft Delete / Pausar plato)
  const handleToggleDishStatus = async (dish: DishItem) => {
    const nextStatus = !dish.active;
    try {
      const res = await fetch(`/api/dishes/${dish.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextStatus }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al actualizar estado.");

      toast.success(
        nextStatus
          ? `Plato "${dish.name}" habilitado en la carta.`
          : `Plato "${dish.name}" pausado (desactivado de la carta).`
      );
      void loadData();
    } catch (err: any) {
      toast.error(err.message || "Error al cambiar estado.");
    }
  };

  // Confirmar eliminación / desactivación suave
  const handleConfirmDeactivate = async () => {
    if (!dishToDeactivate) return;
    try {
      const res = await fetch(`/api/dishes/${dishToDeactivate.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al desactivar plato.");

      toast.success(`Plato "${dishToDeactivate.name}" marcado como inactivo.`);
      setDeactivateModalOpen(false);
      setDishToDeactivate(null);
      void loadData();
    } catch (err: any) {
      toast.error(err.message || "No se pudo desactivar el plato.");
    }
  };

  // Filtrado de platos
  const filteredDishes = useMemo(() => {
    return dishes.filter((dish) => {
      const matchesSearch =
        dish.name.toLowerCase().includes(search.toLowerCase()) ||
        dish.description.toLowerCase().includes(search.toLowerCase()) ||
        dish.recipes.some((r) => r.supplyName?.toLowerCase().includes(search.toLowerCase()));

      const matchesCat =
        categoryFilter === "todos" || dish.category.toLowerCase() === categoryFilter.toLowerCase();

      const matchesStatus =
        statusFilter === "todos"
          ? true
          : statusFilter === "active"
          ? dish.active
          : !dish.active;

      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [dishes, search, categoryFilter, statusFilter]);

  // Métricas
  const metrics = useMemo(() => {
    const total = dishes.length;
    const activos = dishes.filter((d) => d.active).length;
    const inactivos = total - activos;
    const conReceta = dishes.filter((d) => d.recipes && d.recipes.length > 0).length;
    return { total, activos, inactivos, conReceta };
  }, [dishes]);

  return (
    <>
      <ModuleHeader
        title="Gestión de Platos y Carta"
        subtitle="Registro de platos, vinculación con ingredientes/insumos del almacén y control de disponibilidad"
        icon={ChefHat}
        iconClassName="bg-amber-100 text-amber-800"
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadData()}
            className="text-xs h-9 font-semibold gap-1.5 rounded-xl border-border hover:bg-muted cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refrescar</span>
          </Button>
          <Button
            size="sm"
            onClick={handleOpenCreateModal}
            className="text-xs h-9 font-bold gap-1.5 rounded-xl bg-red-700 hover:bg-red-800 text-white shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Plato</span>
          </Button>
        </div>
      </ModuleHeader>

      <main className="flex-1 p-4 sm:p-6 flex flex-col gap-5 max-w-7xl mx-auto w-full">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <Card className="p-3.5 rounded-2xl border border-border/80 bg-card shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Total Platos
              </p>
              <p className="text-xl sm:text-2xl font-extrabold text-foreground mt-0.5">
                {metrics.total}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 flex items-center justify-center">
              <UtensilsCrossed className="w-4 h-4" />
            </div>
          </Card>

          <Card className="p-3.5 rounded-2xl border border-border/80 bg-card shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
                Activos en Carta
              </p>
              <p className="text-xl sm:text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-0.5">
                {metrics.activos}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </Card>

          <Card className="p-3.5 rounded-2xl border border-border/80 bg-card shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
                Pausados / Inactivos
              </p>
              <p className="text-xl sm:text-2xl font-extrabold text-amber-700 dark:text-amber-400 mt-0.5">
                {metrics.inactivos}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </Card>

          <Card className="p-3.5 rounded-2xl border border-border/80 bg-card shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                Con Receta (Escandallo)
              </p>
              <p className="text-xl sm:text-2xl font-extrabold text-blue-700 dark:text-blue-400 mt-0.5">
                {metrics.conReceta}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
          </Card>
        </div>

        {/* Controles de Filtros y Búsqueda */}
        <Card className="p-4 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar plato o ingrediente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs rounded-xl h-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Categorías */}
            <div className="flex items-center gap-1 bg-muted p-1 rounded-xl text-xs">
              {[
                { id: "todos", label: "Todos" },
                { id: "pollos", label: "Pollos" },
                { id: "adicionales", label: "Guarniciones" },
                { id: "bebidas", label: "Bebidas" },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategoryFilter(c.id)}
                  className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-all ${
                    categoryFilter === c.id
                      ? "bg-background text-foreground shadow-2xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Estado */}
            <div className="flex items-center gap-1 bg-muted p-1 rounded-xl text-xs">
              {[
                { id: "todos", label: "Todo Estado" },
                { id: "active", label: "Activos" },
                { id: "inactive", label: "Pausados" },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStatusFilter(s.id as any)}
                  className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-all ${
                    statusFilter === s.id
                      ? "bg-background text-foreground shadow-2xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Tabla / Listado de Platos */}
        <Card className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border bg-muted/60 text-muted-foreground font-bold uppercase text-[10px]">
                  <th className="py-3 px-4">Plato &amp; Categoría</th>
                  <th className="py-3 px-4">Precio Venta</th>
                  <th className="py-3 px-4">Receta e Ingredientes</th>
                  <th className="py-3 px-4">Costo Estimado</th>
                  <th className="py-3 px-4 text-center">Disponibilidad</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                      Cargando carta de platos e insumos...
                    </td>
                  </tr>
                ) : filteredDishes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      No se encontraron platos que coincidan con los criterios de búsqueda.
                    </td>
                  </tr>
                ) : (
                  filteredDishes.map((dish) => (
                    <tr
                      key={dish.id}
                      className={`hover:bg-muted/40 transition-colors ${
                        !dish.active ? "opacity-60 bg-muted/20" : ""
                      }`}
                    >
                      {/* Plato y Categoría */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                              dish.category === "pollos"
                                ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                                : dish.category === "bebidas"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            <UtensilsCrossed className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-foreground text-sm block">
                              {dish.name}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge variant="outline" className="text-[10px] capitalize py-0 px-1.5">
                                {dish.category}
                              </Badge>
                              {dish.description && (
                                <span className="text-[11px] text-muted-foreground line-clamp-1 italic max-w-xs">
                                  {dish.description}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Precio */}
                      <td className="py-3.5 px-4 font-mono font-extrabold text-sm text-foreground">
                        S/ {dish.price.toFixed(2)}
                      </td>

                      {/* Receta e Ingredientes vinculados */}
                      <td className="py-3.5 px-4">
                        {dish.recipes && dish.recipes.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {dish.recipes.map((r, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-lg text-[10px] font-medium border border-border"
                                title={`Costo unitario: S/ ${(r.costPerUnit || 0).toFixed(2)}`}
                              >
                                <span className="font-bold text-primary">
                                  {r.quantityRequired} {r.unitOfMeasure}
                                </span>
                                <span>{r.supplyName}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic flex items-center gap-1">
                            <Info className="w-3.5 h-3.5 text-amber-500" />
                            Sin receta asignada
                          </span>
                        )}
                      </td>

                      {/* Costo Estimado & Margen */}
                      <td className="py-3.5 px-4">
                        {dish.recipeCost > 0 ? (
                          <div>
                            <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 block">
                              S/ {dish.recipeCost.toFixed(2)}
                            </span>
                            <span
                              className={`text-[10px] font-bold ${
                                dish.price > dish.recipeCost ? "text-emerald-600" : "text-rose-600"
                              }`}
                            >
                              Margen:{" "}
                              {Math.round(((dish.price - dish.recipeCost) / dish.price) * 100)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">—</span>
                        )}
                      </td>

                      {/* Disponibilidad / Estado */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleToggleDishStatus(dish)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                            dish.active
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                          title="Haga clic para alternar disponibilidad en la carta"
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              dish.active ? "bg-emerald-600 animate-pulse" : "bg-slate-400"
                            }`}
                          />
                          <span>{dish.active ? "En Carta" : "Pausado"}</span>
                        </button>
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenEditModal(dish)}
                            className="h-7 px-2 text-xs rounded-lg font-semibold gap-1 hover:bg-muted cursor-pointer"
                            title="Editar plato y receta"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-primary" />
                            <span>Editar</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setDishToDeactivate(dish);
                              setDeactivateModalOpen(true);
                            }}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-600 rounded-lg cursor-pointer"
                            title="Desactivar / Ocultar plato de la carta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </main>

      {/* =================================================================== */}
      {/* MODAL: REGISTRAR / EDITAR PLATO CON INGREDIENTES */}
      {/* =================================================================== */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-5 bg-card">
          <DialogHeader className="pb-3 border-b border-border">
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-red-700" />
              <span>{editingDish ? "Editar Plato y Receta" : "Registrar Nuevo Plato"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure los datos de venta del plato y vincule los ingredientes necesarios para su
              preparación y costeo automático.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {/* Datos Básicos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Nombre del Plato <span className="text-red-500">*</span>
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
                <label className="block text-xs font-bold text-foreground mb-1">
                  Categoría
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full text-xs h-9 rounded-xl border border-input bg-background px-3 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="pollos">Pollos y Brasas</option>
                  <option value="adicionales">Guarniciones y Adicionales</option>
                  <option value="bebidas">Bebidas y Refrescos</option>
                  <option value="otros">Otros</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Stock Diario Sugerido (Porciones)
                </label>
                <Input
                  type="number"
                  placeholder="50"
                  value={formStock}
                  onChange={(e) => setFormStock(e.target.value)}
                  className="text-xs h-9 rounded-xl font-mono"
                />
              </div>
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
                    Vincula los insumos del almacén que se descuentan o costean por cada porción servida.
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
                  <p className="font-medium">No se han vinculado ingredientes a este plato.</p>
                  <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                    Haga clic en &quot;Añadir Ingrediente&quot; para vincular insumos del almacén con sus
                    cantidades exactas.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {formRecipes.map((item, idx) => {
                    const selectedSupply = supplies.find((s) => s.id === item.supplyId);
                    const unitCost = selectedSupply
                      ? selectedSupply.averageCost || selectedSupply.lastCost || 0
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
                            Insumo de Almacén #{idx + 1}
                          </label>
                          <select
                            value={item.supplyId}
                            onChange={(e) =>
                              handleUpdateRecipeItem(idx, "supplyId", Number(e.target.value))
                            }
                            className="w-full text-xs h-8 rounded-lg border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            {supplies.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.unitOfMeasure}) — Stock: {s.currentStock}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Cantidad requerida */}
                        <div className="w-28">
                          <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">
                            Cantidad ({selectedSupply?.unitOfMeasure || "und"})
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
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
              onClick={handleSaveDish}
              disabled={saving}
              className="bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <ChefHat className="w-3.5 h-3.5" />
              <span>{saving ? "Guardando..." : editingDish ? "Actualizar Plato" : "Guardar Plato"}</span>
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
              <span>Pausar / Desactivar Plato</span>
            </DialogTitle>
          </DialogHeader>

          <div className="py-3 text-xs text-muted-foreground flex flex-col gap-2">
            <p>
              ¿Está seguro de que desea retirar el plato{" "}
              <strong className="text-foreground">&quot;{dishToDeactivate?.name}&quot;</strong> de la
              carta?
            </p>
            <p className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-2.5 rounded-xl text-amber-800 dark:text-amber-200">
              ℹ️ El plato se marcará como <strong>Inactivo</strong>. No se eliminarán sus registros
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

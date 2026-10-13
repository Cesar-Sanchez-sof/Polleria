"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  GlassWater,
  RefreshCw,
  Search,
  ShoppingBag,
  Utensils,
  CheckCheck,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export interface DrinkOrderItem {
  itemId: number;
  orderId: number;
  orderCode: string;
  orderType: string;
  tableId: number | null;
  tableNumber: number | null;
  tableName: string;
  orderedAt: string;
  dishId: number;
  name: string;
  quantity: number;
  notes: string;
  dishStatus: string;
  isDelivered: boolean;
  orderStatus: string;
}

interface DrinksApiResponse {
  data: DrinkOrderItem[];
  summary: {
    total: number;
    totalPending: number;
    totalDelivered: number;
    activeTables: number;
  };
}

function formatDrinkTime(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

export function DrinksDispatchBoard() {
  const [drinks, setDrinks] = useState<DrinkOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingItemId, setUpdatingItemId] = useState<number | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"pendientes" | "entregados" | "todos">("pendientes");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentTime, setCurrentTime] = useState("");

  const loadDrinks = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/orders/drinks", { cache: "no-store" });
      if (!res.ok) throw new Error("Error al obtener bebidas.");
      const json: DrinksApiResponse = await res.json();
      setDrinks(json.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error de conexión al cargar bebidas.";
      if (!silent) toast.error(msg);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Polling automático cada 5 segundos para que el mozo tenga sincronización en tiempo real
  useEffect(() => {
    void loadDrinks();
    const interval = setInterval(() => void loadDrinks(true), 5000);
    return () => clearInterval(interval);
  }, [loadDrinks]);

  // Reloj
  useEffect(() => {
    const tick = () => {
      setCurrentTime(
        new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }),
      );
    };
    tick();
    const timer = setInterval(tick, 10_000);
    return () => clearInterval(timer);
  }, []);

  // Marcar estado de una bebida individual
  const updateDrinkStatus = async (item: DrinkOrderItem, newStatus: "Delivered" | "Pending") => {
    try {
      setUpdatingItemId(item.itemId);
      const res = await fetch("/api/orders/drinks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.itemId, status: newStatus }),
      });
      if (!res.ok) throw new Error("No se pudo actualizar el estado de la bebida.");

      if (newStatus === "Delivered") {
        toast.success(`✔ ${item.quantity}x ${item.name} entregado a ${item.tableName}`);
      } else {
        toast.info(`Estado de ${item.name} restablecido a pendiente`);
      }
      await loadDrinks(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al actualizar estado.";
      toast.error(msg);
    } finally {
      setUpdatingItemId(null);
    }
  };

  // Marcar todas las bebidas de una mesa/comanda
  const deliverAllForOrder = async (orderId: number, tableName: string) => {
    try {
      setUpdatingOrderId(orderId);
      const res = await fetch("/api/orders/drinks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: "Delivered" }),
      });
      if (!res.ok) throw new Error("No se pudieron marcar las bebidas.");
      toast.success(`✔ Todas las bebidas de ${tableName} marcadas como entregadas`);
      await loadDrinks(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al actualizar bebidas.";
      toast.error(msg);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Métricas
  const stats = useMemo(() => {
    const pendingList = drinks.filter((d) => !d.isDelivered);
    const deliveredList = drinks.filter((d) => d.isDelivered);
    const tablesWaiting = Array.from(new Set(pendingList.map((d) => d.tableName))).length;

    return {
      total: drinks.length,
      pendingCount: pendingList.reduce((sum, d) => sum + d.quantity, 0),
      deliveredCount: deliveredList.reduce((sum, d) => sum + d.quantity, 0),
      tablesWaiting,
    };
  }, [drinks]);

  // Filtrado y búsqueda
  const filteredDrinks = useMemo(() => {
    return drinks.filter((d) => {
      // Filtro de estado
      if (filter === "pendientes" && d.isDelivered) return false;
      if (filter === "entregados" && !d.isDelivered) return false;

      // Búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTable = d.tableName.toLowerCase().includes(q);
        const matchName = d.name.toLowerCase().includes(q);
        const matchCode = d.orderCode.toLowerCase().includes(q);
        const matchNotes = d.notes.toLowerCase().includes(q);
        if (!matchTable && !matchName && !matchCode && !matchNotes) return false;
      }

      return true;
    });
  }, [drinks, filter, searchQuery]);

  // Agrupación por Comanda / Mesa para la vista principal
  const groupedByOrder = useMemo(() => {
    const map = new Map<
      number,
      {
        orderId: number;
        orderCode: string;
        orderType: string;
        tableName: string;
        tableNumber: number | null;
        orderedAt: string;
        items: DrinkOrderItem[];
        hasPending: boolean;
      }
    >();

    for (const d of filteredDrinks) {
      if (!map.has(d.orderId)) {
        map.set(d.orderId, {
          orderId: d.orderId,
          orderCode: d.orderCode,
          orderType: d.orderType,
          tableName: d.tableName,
          tableNumber: d.tableNumber,
          orderedAt: d.orderedAt,
          items: [],
          hasPending: false,
        });
      }
      const group = map.get(d.orderId)!;
      group.items.push(d);
      if (!d.isDelivered) group.hasPending = true;
    }

    return Array.from(map.values()).sort((a, b) => {
      // Mesas con bebidas pendientes primero
      if (a.hasPending && !b.hasPending) return -1;
      if (!a.hasPending && b.hasPending) return 1;
      return new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime();
    });
  }, [filteredDrinks]);

  return (
    <div className="flex flex-col gap-5 w-full min-w-0">
      {/* Barra de estado con reloj y auto-refresco */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
            <GlassWater className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
              Despacho de Bebidas por Mozo
            </h2>
            <p className="text-xs text-slate-500">
              Entrega directa de gaseosas, refrescos, aguas y licores sin saturar a cocina
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-blue-200 dark:border-blue-900/60 bg-blue-50/80 dark:bg-blue-950/30 px-3 py-1">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
            </span>
            <span className="text-[11px] font-semibold text-blue-800 dark:text-blue-300">
              Sincronización en vivo
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-800 text-xs font-mono font-semibold text-slate-600 dark:text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            <span>{currentTime || "12:00"}</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadDrinks()}
            disabled={loading}
            className="h-8 px-3 rounded-xl border-slate-200 text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refrescar</span>
          </Button>
        </div>
      </div>

      {/* Tarjetas KPI de Estado */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Pendientes de entrega */}
        <Card className="p-3.5 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 shadow-xs flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-400">
              Bebidas por Entregar
            </p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-extrabold text-amber-700 dark:text-amber-300 tabular-nums">
                {stats.pendingCount}
              </span>
              <span className="text-[11px] text-amber-600 dark:text-amber-400">unidades</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
            <GlassWater className={`w-5 h-5 ${stats.pendingCount > 0 ? "animate-bounce" : ""}`} />
          </div>
        </Card>

        {/* KPI 2: Mesas Esperando */}
        <Card className="p-3.5 rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/20 shadow-xs flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-900 dark:text-blue-400">
              Mesas Esperando
            </p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-extrabold text-blue-700 dark:text-blue-300 tabular-nums">
                {stats.tablesWaiting}
              </span>
              <span className="text-[11px] text-blue-600 dark:text-blue-400">mesas</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
            <Utensils className="w-5 h-5" />
          </div>
        </Card>

        {/* KPI 3: Entregadas */}
        <Card className="p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20 shadow-xs flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-400">
              Bebidas Entregadas
            </p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 tabular-nums">
                {stats.deliveredCount}
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400">unidades</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </Card>

        {/* KPI 4: Total solicitadas */}
        <Card className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Solicitadas
            </p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-extrabold text-slate-800 dark:text-slate-200 tabular-nums">
                {stats.total}
              </span>
              <span className="text-[11px] text-slate-400">ítems</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-xs">
        {/* Buscador */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por mesa (ej. 'Mesa 2') o bebida (ej. 'Inca Kola')..."
            className="pl-9 h-9 text-xs rounded-xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40"
          />
        </div>

        {/* Filtros de Estado */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <Button
            size="sm"
            variant={filter === "pendientes" ? "default" : "outline"}
            onClick={() => setFilter("pendientes")}
            className={`h-8 px-3 rounded-xl text-xs font-bold cursor-pointer ${
              filter === "pendientes"
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <span>Por Entregar</span>
            {stats.pendingCount > 0 && (
              <Badge className="ml-1.5 bg-white text-amber-700 text-[10px] font-black px-1.5 py-0 h-4 rounded-full">
                {stats.pendingCount}
              </Badge>
            )}
          </Button>

          <Button
            size="sm"
            variant={filter === "entregados" ? "default" : "outline"}
            onClick={() => setFilter("entregados")}
            className={`h-8 px-3 rounded-xl text-xs font-bold cursor-pointer ${
              filter === "entregados"
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <span>Entregadas</span>
          </Button>

          <Button
            size="sm"
            variant={filter === "todos" ? "default" : "outline"}
            onClick={() => setFilter("todos")}
            className={`h-8 px-3 rounded-xl text-xs font-bold cursor-pointer ${
              filter === "todos"
                ? "bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900"
                : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <span>Todas</span>
          </Button>
        </div>
      </div>

      {/* Grid de Despacho por Mesas */}
      {groupedByOrder.length === 0 ? (
        <Card className="p-12 text-center rounded-2xl border-dashed border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
            {filter === "pendientes"
              ? "¡Todas las bebidas han sido entregadas!"
              : "No se encontraron bebidas con los filtros aplicados."}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {filter === "pendientes"
              ? "No hay comensales esperando bebidas en este momento. Las nuevas solicitudes aparecerán aquí automáticamente."
              : "Prueba modificando la búsqueda o seleccionando otro filtro."}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groupedByOrder.map((group) => {
            const pendingItemsInGroup = group.items.filter((it) => !it.isDelivered);
            const isAllDelivered = pendingItemsInGroup.length === 0;

            return (
              <Card
                key={group.orderId}
                className={`rounded-2xl border transition-all shadow-xs flex flex-col justify-between overflow-hidden ${
                  group.hasPending
                    ? "border-amber-300 dark:border-amber-900/60 bg-white dark:bg-slate-900"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 opacity-90"
                }`}
              >
                <div>
                  {/* Cabecera de Mesa / Comanda */}
                  <div
                    className={`p-3.5 border-b flex items-center justify-between gap-2 ${
                      group.hasPending
                        ? "bg-amber-500/10 border-amber-200/80 dark:border-amber-900/40"
                        : "bg-slate-100/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          group.orderType === "Llevar"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {group.orderType === "Llevar" ? (
                          <ShoppingBag className="w-4 h-4" />
                        ) : (
                          <Utensils className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white block truncate">
                          {group.tableName}
                        </span>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <span className="font-mono font-semibold">#{group.orderCode}</span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {formatDrinkTime(group.orderedAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Botón de acción masiva por comanda */}
                    {group.hasPending && (
                      <Button
                        size="sm"
                        onClick={() => deliverAllForOrder(group.orderId, group.tableName)}
                        disabled={updatingOrderId === group.orderId}
                        className="h-8 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] gap-1 shadow-xs cursor-pointer shrink-0"
                        title="Entregar todas las bebidas de esta mesa"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Entregar Todo</span>
                      </Button>
                    )}

                    {isAllDelivered && (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-bold border-none">
                        ✔ Todo Entregado
                      </Badge>
                    )}
                  </div>

                  {/* Lista de Bebidas de esta Mesa */}
                  <div className="p-3.5 space-y-2.5 divide-y divide-slate-100 dark:divide-slate-800/80">
                    {group.items.map((item) => {
                      const isUpdating = updatingItemId === item.itemId;

                      return (
                        <div
                          key={item.itemId}
                          className="pt-2.5 first:pt-0 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="h-6 px-2 rounded-md bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                                {item.quantity}x
                              </span>
                              <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                                {item.name}
                              </span>
                            </div>

                            {item.notes ? (
                              <div className="ml-8 mt-1 inline-flex items-center gap-1.5 flex-wrap">
                                {item.notes.toLowerCase().includes("helada") ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-blue-800 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/70 border border-blue-300 dark:border-blue-800 px-2 py-0.5 rounded-md">
                                    ❄️ Helada
                                  </span>
                                ) : item.notes.toLowerCase().includes("sin helar") ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 px-2 py-0.5 rounded-md">
                                    🥤 Sin helar
                                  </span>
                                ) : null}
                                {item.notes.replace(/helada|sin helar/gi, "").trim() && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                                    <AlertCircle className="w-3 h-3 text-slate-500" />
                                    <span>{item.notes}</span>
                                  </span>
                                )}
                              </div>
                            ) : null}
                          </div>

                          {/* Botón de cambio de estado individual */}
                          <div className="shrink-0">
                            {item.isDelivered ? (
                              <div className="flex items-center gap-1.5">
                                <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 text-[10px] font-bold">
                                  Entregado
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => updateDrinkStatus(item, "Pending")}
                                  disabled={isUpdating}
                                  title="Revertir a pendiente"
                                  className="h-7 w-7 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => updateDrinkStatus(item, "Delivered")}
                                disabled={isUpdating}
                                className="h-7 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold gap-1 shadow-xs cursor-pointer"
                              >
                                {isUpdating ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                  <CheckCheck className="w-3.5 h-3.5" />
                                )}
                                <span>Entregar</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

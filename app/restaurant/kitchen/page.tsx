"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  Clock,
  Flame,
  Inbox,
  ListOrdered,
  RefreshCw,
  ShoppingBag,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  listOrders,
  updateOrderStatus,
  type OrderSummary,
} from "@/lib/services/tables.service";

type KitchenFilter = "todos" | "Recibido" | "Preparando" | "Servido";
type KitchenStatus = "Recibido" | "Preparando" | "Servido";

const STATUS_ORDER: Record<KitchenStatus, number> = {
  Recibido: 1,
  Preparando: 2,
  Servido: 3,
};

function formatOrderTime(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

function nextKitchenStatus(estado: string): KitchenStatus | null {
  if (estado === "Recibido") return "Preparando";
  if (estado === "Preparando") return "Servido";
  return null;
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<KitchenFilter>("todos");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState("");

  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await listOrders({ estado: "activos" });
      setOrders(
        data.filter((order) =>
          ["Recibido", "Preparando", "Servido"].includes(order.estado),
        ),
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo cargar la cocina.";
      if (!silent) toast.error(message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
    const poll = setInterval(() => void loadOrders(true), 5000);
    return () => clearInterval(poll);
  }, [loadOrders]);

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

  const stats = useMemo(
    () => ({
      total: orders.length,
      received: orders.filter((o) => o.estado === "Recibido").length,
      preparing: orders.filter((o) => o.estado === "Preparando").length,
      served: orders.filter((o) => o.estado === "Servido").length,
    }),
    [orders],
  );

  const filteredOrders = useMemo(() => {
    const list =
      filter === "todos" ? [...orders] : orders.filter((order) => order.estado === filter);
    return list.sort(
      (a, b) =>
        (STATUS_ORDER[a.estado as KitchenStatus] ?? 99) -
        (STATUS_ORDER[b.estado as KitchenStatus] ?? 99),
    );
  }, [orders, filter]);

  const advanceOrder = async (order: OrderSummary) => {
    const next = nextKitchenStatus(order.estado);
    if (!next) return;
    try {
      setUpdatingId(order.id);
      await updateOrderStatus(order.id, next);
      toast.success(`Pedido #${order.codigo || order.id} → ${next}`);
      await loadOrders(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar el estado.";
      toast.error(message);
    } finally {
      setUpdatingId(null);
    }
  };

  const filters: Array<{ id: KitchenFilter; label: string }> = [
    { id: "todos", label: "Todos" },
    { id: "Recibido", label: "Recibidos" },
    { id: "Preparando", label: "En preparación" },
    { id: "Servido", label: "Servidos" },
  ];

  return (
    <div className="pl-0 md:pl-64 min-h-screen flex flex-col bg-surface w-full min-w-0 overflow-x-hidden">
      <ModuleHeader
        title="Cocina (KDS)"
        subtitle="Control de preparación y despacho de comandas"
        icon={ChefHat}
        iconClassName="bg-amber-100 text-amber-800"
      >
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-surface-container bg-surface-container-low px-3 py-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-semibold text-on-surface">Auto-refresco activo</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900">
          <Flame className="h-3.5 w-3.5" />
          <span>{currentTime || "—"}</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs cursor-pointer"
          onClick={() => void loadOrders()}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </ModuleHeader>

      <main className="flex-1 p-4 sm:p-6 flex flex-col gap-6">
        {/* KPI cards — always row: label+value left, icon right */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="flex min-h-[88px] items-center justify-between gap-3 rounded-xl border border-surface-container bg-surface-container-lowest p-4 shadow-xs">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
                Total comandas
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-on-surface">{stats.total}</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container text-primary">
              <ListOrdered className="h-5 w-5" />
            </div>
          </div>

          <div className="flex min-h-[88px] items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/60 p-4 shadow-xs">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-blue-900">
                1. Recibido (nuevos)
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-blue-700">{stats.received}</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <Inbox className="h-5 w-5" />
            </div>
          </div>

          <div className="flex min-h-[88px] items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-xs">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-amber-900">
                2. En preparación
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700">{stats.preparing}</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Flame className="h-5 w-5 animate-spin" />
            </div>
          </div>

          <div className="flex min-h-[88px] items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-xs">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-900">
                3. Servido (listo)
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">{stats.served}</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-surface-container bg-surface-container-lowest p-5 shadow-xs">
          <div className="flex flex-col gap-3 border-b border-surface-container pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <ListOrdered className="h-5 w-5 text-primary" />
              <h2 className="text-sm font-bold text-on-surface">Lista de pedidos en preparación</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {filters.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={`rounded-lg px-3 py-1 text-xs cursor-pointer transition ${
                    filter === item.id
                      ? "bg-primary font-bold text-on-primary shadow-xs"
                      : "bg-surface-container font-semibold text-on-surface hover:bg-surface-container-high"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="w-full overflow-x-auto rounded-xl border border-surface-container">
            <table className="w-full min-w-[960px] border-collapse text-left">
              <thead>
                <tr className="border-b border-surface-container bg-surface-container-low text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  <th className="w-28 px-4 py-3">Nº pedido</th>
                  <th className="w-36 px-4 py-3">Ubicación</th>
                  <th className="w-28 px-4 py-3">Hora</th>
                  <th className="px-4 py-3">Platos y observaciones</th>
                  <th className="w-36 px-4 py-3 text-center">Estado</th>
                  <th className="w-52 px-4 py-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container text-xs">
                {loading && orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                      Cargando comandas…
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                      <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-outline opacity-40" />
                      <p className="text-xs font-bold">No hay pedidos en este estado.</p>
                      <p className="text-[11px] text-outline">La cocina está al día.</p>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const next = nextKitchenStatus(order.estado);
                    return (
                      <tr
                        key={order.id}
                        className={`hover:bg-surface-container-low ${
                          order.estado === "Recibido" ? "bg-blue-50/20" : ""
                        }`}
                      >
                        <td className="px-4 py-3 font-mono text-sm font-bold text-primary">
                          #{order.codigo || order.id}
                        </td>
                        <td className="px-4 py-3">
                          {order.tipoPedido === "Llevar" ? (
                            <Badge className="gap-1 border-amber-200 bg-amber-100 text-amber-900 hover:bg-amber-100">
                              <ShoppingBag className="h-3 w-3" />
                              Para llevar
                            </Badge>
                          ) : (
                            <Badge className="gap-1 border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">
                              <Utensils className="h-3 w-3" />
                              Mesa {order.mesa?.numero ?? "—"}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-on-surface">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-on-surface-variant" />
                            {formatOrderTime(order.fecha)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1.5">
                            {order.items.map((item, idx) => (
                              <div key={`${order.id}-${item.idPlato}-${idx}`} className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="flex h-5 w-5 items-center justify-center rounded bg-surface-container font-mono text-[11px] font-bold text-primary">
                                    {item.cantidad}x
                                  </span>
                                  <span className="font-bold text-on-surface">{item.nombre}</span>
                                </div>
                                {item.observaciones ? (
                                  <div className="ml-7 mt-0.5 inline-flex items-center gap-1 self-start rounded-md border border-amber-300 bg-amber-100/90 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                                    <AlertTriangle className="h-3 w-3" />
                                    Obs: {item.observaciones}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {order.estado === "Recibido" && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
                              <span className="h-2 w-2 rounded-full bg-blue-600" />
                              recibido
                            </span>
                          )}
                          {order.estado === "Preparando" && (
                            <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                              <span className="h-2 w-2 rounded-full bg-amber-600" />
                              preparando
                            </span>
                          )}
                          {order.estado === "Servido" && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900">
                              <span className="h-2 w-2 rounded-full bg-emerald-600" />
                              servido
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {next === "Preparando" && (
                            <Button
                              type="button"
                              size="sm"
                              className="h-9 w-full cursor-pointer gap-1.5 rounded-xl bg-amber-500 text-xs font-bold text-white hover:bg-amber-600"
                              disabled={updatingId === order.id}
                              onClick={() => void advanceOrder(order)}
                            >
                              <Flame className="h-3.5 w-3.5" />
                              Avanzar → Preparando
                            </Button>
                          )}
                          {next === "Servido" && (
                            <Button
                              type="button"
                              size="sm"
                              className="h-9 w-full cursor-pointer gap-1.5 rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700"
                              disabled={updatingId === order.id}
                              onClick={() => void advanceOrder(order)}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Avanzar → Servido
                            </Button>
                          )}
                          {!next && (
                            <span className="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Completado
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-3 text-xs text-on-surface-variant sm:flex-row sm:items-center sm:justify-between">
            <span className="font-medium">
              Flujo: <strong>recibido</strong> → <strong>preparando</strong> → <strong>servido</strong>{" "}
              (sin retroceso).
            </span>
            <span className="font-mono text-[11px] text-outline">KDS Pollería</span>
          </div>
        </div>
      </main>
    </div>
  );
}

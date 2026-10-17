"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  Inbox,
  ListOrdered,
  RefreshCw,
  ShoppingBag,
  Utensils,
} from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { StatCard } from "@/components/shared/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  listOrders,
  updateOrderStatus,
  type OrderSummary,
} from "@/lib/services/tables.service";
import { isBeverage } from "@/lib/utils/product-category";

type KitchenFilter = "todos" | "Received" | "Preparing" | "Served";
type KitchenStatus = "Received" | "Preparing" | "Served";

const STATUS_ORDER: Record<KitchenStatus, number> = {
  Received: 1,
  Preparing: 2,
  Served: 3,
};

const STATUS_LABEL: Record<KitchenStatus, string> = {
  Received: "recibido",
  Preparing: "preparando",
  Served: "servido",
};

function formatOrderTime(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

function nextKitchenStatus(status: string): KitchenStatus | null {
  if (status === "Received") return "Preparing";
  if (status === "Preparing") return "Served";
  return null;
}

interface KitchenBoardProps {
  /** Muestra el reloj y botón de refresco en la barra superior del panel. */
  showToolbar?: boolean;
  /** Si se indica, el reloj y el refresco se dibujan ahí (p. ej. en el encabezado del módulo). */
  toolbarSlot?: HTMLElement | null;
}

export function KitchenBoard({ showToolbar = true, toolbarSlot }: KitchenBoardProps) {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<KitchenFilter>("todos");
  const [excludeBeverages, setExcludeBeverages] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState("");

  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await listOrders({ status: "activos" });
      setOrders(
        data.filter((order) =>
          ["Received", "Preparing", "Served"].includes(order.status),
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

  const kitchenOrders = useMemo(() => {
    if (!excludeBeverages) return orders;
    return orders.filter((order) => order.items.some((it) => !isBeverage(it.name)));
  }, [orders, excludeBeverages]);

  const stats = useMemo(
    () => ({
      total: kitchenOrders.length,
      received: kitchenOrders.filter((o) => o.status === "Received").length,
      preparing: kitchenOrders.filter((o) => o.status === "Preparing").length,
      served: kitchenOrders.filter((o) => o.status === "Served").length,
    }),
    [kitchenOrders],
  );

  const filteredOrders = useMemo(() => {
    const list =
      filter === "todos"
        ? [...kitchenOrders]
        : kitchenOrders.filter((order) => order.status === filter);
    return list.sort(
      (a, b) =>
        (STATUS_ORDER[a.status as KitchenStatus] ?? 99) -
        (STATUS_ORDER[b.status as KitchenStatus] ?? 99),
    );
  }, [kitchenOrders, filter]);

  const advanceOrder = async (order: OrderSummary) => {
    const next = nextKitchenStatus(order.status);
    if (!next) return;
    try {
      setUpdatingId(order.id);
      await updateOrderStatus(order.id, next);
      toast.success(`Pedido #${order.code || order.id} → ${STATUS_LABEL[next]}`);
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
    { id: "Received", label: "Recibidos" },
    { id: "Preparing", label: "En preparación" },
    { id: "Served", label: "Servidos" },
  ];

  const toolbar = (
    <>
      <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        <span className="text-xs font-semibold text-slate-700">Auto-refresco activo</span>
      </div>
      <div className="flex items-center gap-2">
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
      </div>
    </>
  );

  return (
    <div className="flex flex-col gap-5 w-full min-w-0">
      {!toolbarSlot && showToolbar && (
        <div className="flex flex-wrap items-center justify-between gap-2">{toolbar}</div>
      )}
      {toolbarSlot && createPortal(toolbar, toolbarSlot)}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard enableGradient={false} enableHover={false} tone="neutral" icon={<ListOrdered />} label="Total comandas" value={stats.total} />
        <StatCard enableGradient={false} enableHover={false} tone="blue" icon={<Inbox />} label="1. Recibido (nuevos)" value={stats.received} />
        <StatCard enableGradient={false} enableHover={false} tone="amber" icon={<Flame className="animate-spin" />} label="2. En preparación" value={stats.preparing} />
        <StatCard enableGradient={false} enableHover={false} tone="emerald" icon={<CheckCircle2 />} label="3. Servido (listo)" value={stats.served} />
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ListOrdered className="h-5 w-5 text-red-700" />
            <h2 className="text-sm font-bold text-slate-900">Lista de pedidos en preparación</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setExcludeBeverages(!excludeBeverages)}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold cursor-pointer transition border flex items-center gap-1.5 ${
                excludeBeverages
                  ? "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100"
                  : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
              }`}
              title="Alternar filtro de bebidas"
            >
              <span>{excludeBeverages ? "🔥 Solo Cocina (Sin bebidas)" : "📋 Todas las Líneas"}</span>
            </button>
            <div className="h-4 w-px bg-slate-300 hidden sm:block mx-1" />
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`rounded-lg px-3 py-1 text-xs cursor-pointer transition ${
                  filter === item.id
                    ? "bg-red-700 font-bold text-white shadow-xs"
                    : "bg-slate-100 font-semibold text-slate-700 hover:bg-slate-200"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[960px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="w-28 px-4 py-3">Nº pedido</th>
                <th className="w-36 px-4 py-3">Ubicación</th>
                <th className="w-28 px-4 py-3">Hora</th>
                <th className="px-4 py-3">Platos y observaciones</th>
                <th className="w-36 px-4 py-3 text-center">Estado</th>
                <th className="w-52 px-4 py-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading && orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Cargando comandas…
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                    <p className="text-xs font-bold">No hay pedidos en este estado.</p>
                    <p className="text-[11px] text-slate-400">La cocina está al día.</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const next = nextKitchenStatus(order.status);
                  return (
                    <tr
                      key={order.id}
                      className={`hover:bg-slate-50 ${
                        order.status === "Received" ? "bg-blue-50/20" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-sm font-bold text-red-700">
                        #{order.code || order.id}
                      </td>
                      <td className="px-4 py-3">
                        {order.orderType === "Llevar" ? (
                          <Badge className="gap-1 border-amber-200 bg-amber-100 text-amber-900 hover:bg-amber-100">
                            <ShoppingBag className="h-3 w-3" />
                            Para llevar
                          </Badge>
                        ) : (
                          <Badge className="gap-1 border-red-200 bg-red-50 text-red-800 hover:bg-red-50">
                            <Utensils className="h-3 w-3" />
                            Mesa {order.table?.number ?? "—"}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-slate-800">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          {formatOrderTime(order.orderedAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          {order.items
                            .filter((item) => !excludeBeverages || !isBeverage(item.name))
                            .map((item, idx) => (
                              <div key={`${order.id}-${item.productId}-${idx}`} className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 font-mono text-[11px] font-bold text-red-700">
                                    {item.quantity}x
                                  </span>
                                  <span className="font-bold text-slate-900">{item.name}</span>
                                </div>
                                {item.notes ? (
                                  <div className="ml-7 mt-0.5 inline-flex items-center gap-1 self-start rounded-md border border-amber-300 bg-amber-100/90 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                                    <AlertTriangle className="h-3 w-3" />
                                    Obs: {item.notes}
                                  </div>
                                ) : null}
                              </div>
                            ))}

                          {excludeBeverages &&
                            order.items.some((item) => isBeverage(item.name)) && (
                              <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-blue-800 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-md w-fit">
                                <span>🥤</span>
                                <span>
                                  {order.items
                                    .filter((item) => isBeverage(item.name))
                                    .reduce((sum, it) => sum + it.quantity, 0)}{" "}
                                  bebida(s) a cargo de mozo
                                </span>
                              </div>
                            )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {order.status === "Received" && (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
                            <span className="h-2 w-2 rounded-full bg-blue-600" />
                            recibido
                          </span>
                        )}
                        {order.status === "Preparing" && (
                          <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                            <span className="h-2 w-2 rounded-full bg-amber-600" />
                            preparando
                          </span>
                        )}
                        {order.status === "Served" && (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900">
                            <span className="h-2 w-2 rounded-full bg-emerald-600" />
                            servido
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {next === "Preparing" && (
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
                        {next === "Served" && (
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

        <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-medium">
            Flujo: <strong>recibido</strong> → <strong>preparando</strong> → <strong>servido</strong>{" "}
            (sin retroceso).
          </span>
          <span className="font-mono text-[11px] text-slate-400">KDS Pollería</span>
        </div>
      </div>
    </div>
  );
}

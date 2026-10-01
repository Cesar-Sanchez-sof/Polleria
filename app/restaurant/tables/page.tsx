"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Sidebar from "@/components/personalized/Sidebar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  } from "@/components/ui/dialog";
import {
  Utensils,
  Plus,
  Edit,
  CheckCircle2,
  Clock,
  Search,
  Trash2,
  Send,
  ShoppingBag,
  RefreshCw,
  Users,
  AlertCircle,
  FileText,
  CreditCard,
  ChefHat,
  X,
  MessageSquare
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import {
  listTables,
  listDishes,
  listOrders,
  createOrder,
  editOrder,
  updateOrderStatus,
  formatCurrency,
  type TableItem,
  type MenuDish,
  type OrderSummary,
  type TablesSummary,
  type OrderLineItem,
} from "@/lib/services/tables.service";

export default function DiningRoomTablesPage() {
  // Datos principales
  const [tables, setTables] = useState<TableItem[]>([]);
  const [summary, setSummary] = useState<TablesSummary>({ total: 0, disponibles: 0, ocupadas: 0 });
  const [takeoutOrders, setTakeoutOrders] = useState<OrderSummary[]>([]);
  const [dishes, setDishes] = useState<MenuDish[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [tableFilter, setTableFilter] = useState<"todas" | "disponibles" | "ocupadas">("todas");

  // Reloj en tiempo real
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Modal de Comanda (Tomar / Editar Pedido)
  const [orderModalOpen, setOrderModalOpen] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [selectedTable, setSelectedTable] = useState<TableItem | null>(null);
  const [isTakeaway, setIsTakeaway] = useState<boolean>(false);
  const [tableNote, setTableNote] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("todos");
  const [dishSearch, setDishSearch] = useState<string>("");
  const [orderItems, setOrderItems] = useState<
    Array<{ idPlato: number; nombre: string; precio: number; cantidad: number; observaciones: string }>
  >([]);
  const [savingOrder, setSavingOrder] = useState<boolean>(false);

  // Modal de Observaciones por Producto
  const [notesModalOpen, setNotesModalOpen] = useState<boolean>(false);
  const [noteIndex, setNoteIndex] = useState<number | null>(null);
  const [noteText, setNoteText] = useState<string>("");

  // Carga de datos
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [tablesRes, takeoutRes, dishesRes] = await Promise.all([
        listTables(),
        listOrders({ tipo: "Llevar", estado: "activos" }),
        listDishes(),
      ]);
      setTables(tablesRes.mesas);
      setSummary(tablesRes.resumen);
      setTakeoutOrders(takeoutRes);
      setDishes(dishesRes);
    } catch (err: any) {
      toast.error(err.message || "Error al cargar la información del salón.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Filtrado de mesas en UI
  const filteredTables = useMemo(() => {
    if (tableFilter === "disponibles") return tables.filter((m) => !m.ocupada);
    if (tableFilter === "ocupadas") return tables.filter((m) => m.ocupada);
    return tables;
  }, [tables, tableFilter]);

  // Filtrado de platos de la carta
  const filteredDishes = useMemo(() => {
    return dishes.filter((p) => {
      const matchesCategory =
        selectedCategory === "todos" || p.categoria === selectedCategory;
      const matchesText =
        !dishSearch.trim() ||
        p.nombre.toLowerCase().includes(dishSearch.toLowerCase()) ||
        p.descripcion.toLowerCase().includes(dishSearch.toLowerCase());
      return matchesCategory && matchesText;
    });
  }, [dishes, selectedCategory, dishSearch]);

  // Acciones de Comanda
  const openTakeTableOrder = (mesa: TableItem) => {
    if (mesa.ocupada) {
      toast.info(`La Mesa ${mesa.numero} ya está ocupada.`);
      return;
    }
    setIsEditing(false);
    setEditingOrderId(null);
    setSelectedTable(mesa);
    setIsTakeaway(false);
    setTableNote("");
    setOrderItems([]);
    setSelectedCategory("todos");
    setDishSearch("");
    setOrderModalOpen(true);
  };

  const openTakeawayOrder = () => {
    setIsEditing(false);
    setEditingOrderId(null);
    setSelectedTable(null);
    setIsTakeaway(true);
    setTableNote("");
    setOrderItems([]);
    setSelectedCategory("todos");
    setDishSearch("");
    setOrderModalOpen(true);
  };

  const openEditOrder = (pedido: {
    id: number;
    tableNote?: string;
    observacion?: string;
    items: OrderLineItem[];
    tipoPedido: string;
  }) => {
    setIsEditing(true);
    setEditingOrderId(pedido.id);
    setIsTakeaway(pedido.tipoPedido === "Llevar");
    setTableNote(pedido.tableNote || pedido.observacion || "");
    setOrderItems(
      pedido.items.map((it) => ({
        idPlato: it.idPlato,
        nombre: it.nombre,
        precio: it.precioUnitario,
        cantidad: it.cantidad,
        observaciones: it.observaciones || "",
      }))
    );
    setSelectedCategory("todos");
    setDishSearch("");
    setOrderModalOpen(true);
  };

  // Modificar ítems en la comanda
  const addDish = (plato: MenuDish) => {
    setOrderItems((prev) => {
      const exists = prev.findIndex((it) => it.idPlato === plato.id);
      if (exists >= 0) {
        return prev.map((it, i) =>
          i === exists ? { ...it, cantidad: it.cantidad + 1 } : it
        );
      }
      return [
        ...prev,
        {
          idPlato: plato.id,
          nombre: plato.nombre,
          precio: plato.precio,
          cantidad: 1,
          observaciones: "",
        },
      ];
    });
    toast.success(`Añadido: ${plato.nombre}`);
  };

  const modificarCantidad = (index: number, delta: number) => {
    setOrderItems((prev) => {
      const nextQty = prev[index].cantidad + delta;
      if (nextQty <= 0) {
        return prev.filter((_, i) => i !== index);
      }
      return prev.map((it, i) =>
        i === index ? { ...it, cantidad: nextQty } : it
      );
    });
  };

  const eliminarItem = (index: number) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Observaciones
  const openNote = (index: number) => {
    setNoteIndex(index);
    setNoteText(orderItems[index]?.observaciones || "");
    setNotesModalOpen(true);
  };

  const saveNote = () => {
    if (noteIndex !== null && orderItems[noteIndex]) {
      setOrderItems((prev) =>
        prev.map((it, i) =>
          i === noteIndex ? { ...it, observaciones: noteText.trim() } : it
        )
      );
    }
    setNotesModalOpen(false);
    setNoteIndex(null);
    setNoteText("");
  };

  // Totales
  const orderTotal = useMemo(() => {
    return orderItems.reduce((acc, it) => acc + it.precio * it.cantidad, 0);
  }, [orderItems]);

  // Enviar pedido a la API
  const saveOrder = async () => {
    if (orderItems.length === 0) {
      toast.warning("Debe agregar al menos un producto a la comanda.");
      return;
    }

    try {
      setSavingOrder(true);

      if (isEditing && editingOrderId) {
        await editOrder(editingOrderId, {
          observacion: tableNote,
          items: orderItems.map((it) => ({
            id_plato: it.idPlato,
            cantidad: it.cantidad,
            observaciones: it.observaciones,
          })),
        });
        toast.success("Pedido actualizado correctamente.");
      } else {
        await createOrder({
          tipo_pedido: isTakeaway ? "Llevar" : "Mesa",
          id_mesa: isTakeaway ? undefined : selectedTable?.id,
          observacion: tableNote,
          items: orderItems.map((it) => ({
            id_plato: it.idPlato,
            cantidad: it.cantidad,
            observaciones: it.observaciones,
          })),
        });
        toast.success(
          isTakeaway
            ? "Pedido para llevar registrado con éxito."
            : `Mesa ${selectedTable?.numero} ocupada. Comanda enviada a cocina.`
        );
      }

      setOrderModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Error al procesar el pedido.");
    } finally {
      setSavingOrder(false);
    }
  };

  // Cambio de estado de cocina
  const changeKitchenStatus = async (orderIdParam: number, newStatus: "Preparando" | "Servido") => {
    try {
      await updateOrderStatus(orderIdParam, newStatus);
      toast.success(`Pedido actualizado a estado: ${newStatus}`);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "No se pudo actualizar el estado.");
    }
  };

  return (
    <div className="flex bg-(--color-background) text-sm text-slate-900 antialiased min-h-screen">
      {/* Sidebar fijo */}
      <Sidebar />

      {/* Área principal */}
      <div className="pl-64 min-h-screen flex flex-col bg-(--color-background) w-full">
        {/* Header superior */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-700">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">
                Salón de Mesas &amp; Comandas
              </h1>
              <p className="text-xs text-slate-500">
                Atención en Sala y Para Llevar • Pollería Central
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={openTakeawayOrder}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-9 px-4 rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>+ Pedido Para Llevar</span>
            </Button>

            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200 text-xs font-mono font-semibold text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{currentTime || "12:00:00"}</span>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => void loadData()}
              title="Refrescar mesas"
              className="h-9 w-9 rounded-xl cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </header>

        {/* Contenido principal */}
        <main className="flex-1 p-6 flex flex-col gap-6">
          {/* Barra de Filtros y Leyenda de Estados */}
          <Card className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-700 mr-1">Filtro de Mesas:</span>
              <Button
                size="sm"
                variant={tableFilter === "todas" ? "default" : "outline"}
                onClick={() => setTableFilter("todas")}
                className={`text-xs font-bold h-8 rounded-lg ${tableFilter === "todas" ? "bg-red-700 hover:bg-red-800 text-white" : ""}`}
              >
                Todas ({summary.total})
              </Button>
              <Button
                size="sm"
                variant={tableFilter === "disponibles" ? "default" : "outline"}
                onClick={() => setTableFilter("disponibles")}
                className={`text-xs font-bold h-8 rounded-lg ${tableFilter === "disponibles" ? "bg-red-700 hover:bg-red-800 text-white" : ""}`}
              >
                Disponibles ({summary.disponibles})
              </Button>
              <Button
                size="sm"
                variant={tableFilter === "ocupadas" ? "default" : "outline"}
                onClick={() => setTableFilter("ocupadas")}
                className={`text-xs font-bold h-8 rounded-lg ${tableFilter === "ocupadas" ? "bg-red-700 hover:bg-red-800 text-white" : ""}`}
              >
                Ocupadas ({summary.ocupadas})
              </Button>
            </div>

            <div className="flex items-center gap-3 text-xs flex-wrap">
              <span className="font-bold text-slate-500">Estados de Cocina:</span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span> Recibido
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-spin"></span> Preparando
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Servido
              </span>
            </div>
          </Card>

          {/* GRID DE MESAS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredTables.map((mesa) => {
              const pedido = mesa.pedidoActivo;
              const isOccupied = mesa.ocupada;

              // Renderizado de Badge de Cocina
              let estadoTag = null;
              if (isOccupied && pedido) {
                if (pedido.estado === "Recibido") {
                  estadoTag = (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span> Recibido
                    </span>
                  );
                } else if (pedido.estado === "Preparando") {
                  estadoTag = (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-spin"></span> Preparando
                    </span>
                  );
                } else if (pedido.estado === "Servido") {
                  estadoTag = (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Servido
                    </span>
                  );
                }
              }

              return (
                <Card
                  key={mesa.id}
                  className={`rounded-2xl p-5 shadow-xs transition-all flex flex-col justify-between ${
                    isOccupied
                      ? "border-red-300 ring-1 ring-red-100 bg-white"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div>
                    {/* Header de la Card */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shadow-xs ${
                            isOccupied
                              ? "bg-red-700 text-white"
                              : "bg-slate-100 text-slate-800"
                          }`}
                        >
                          M{mesa.numero}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">
                            Mesa {mesa.numero}
                          </h3>
                          <span className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            Aforo: {mesa.aforo} personas
                          </span>
                        </div>
                      </div>

                      <Badge
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border-none shadow-none ${
                          isOccupied
                            ? "bg-rose-100 text-rose-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {isOccupied ? "OCUPADA" : "DISPONIBLE"}
                      </Badge>
                    </div>

                    {/* Contenido / Estado del Pedido */}
                    <div className="bg-slate-50 p-3.5 rounded-xl mb-4 flex flex-col gap-2 border border-slate-100 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Estado Cocina:
                        </span>
                        {estadoTag || (
                          <span className="text-[11px] text-slate-400 italic">Sin pedido</span>
                        )}
                      </div>

                      {isOccupied && pedido ? (
                        <>
                          <div className="text-[11px] text-slate-700 font-medium line-clamp-2">
                            {pedido.items.map((it) => `${it.cantidad}x ${it.nombre}`).join(", ")}
                          </div>

                          {pedido.observacionMesa && (
                            <p className="text-[10px] text-slate-500 italic bg-white p-1 rounded border border-slate-200">
                              Nota: {pedido.observacionMesa}
                            </p>
                          )}

                          <div className="flex items-center justify-between font-bold pt-1.5 border-t border-slate-200">
                            <span className="text-slate-600">Total Comanda:</span>
                            <span className="font-mono text-red-700 text-sm">
                              {formatCurrency(pedido.total)}
                            </span>
                          </div>

                          {/* Botones de transición de cocina rápidos */}
                          <div className="flex items-center gap-1.5 pt-1">
                            {pedido.estado === "Recibido" && (
                              <button
                                type="button"
                                onClick={() => void changeKitchenStatus(pedido.id, "Preparando")}
                                className="flex-1 py-1 px-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                              >
                                <ChefHat className="w-3 h-3" />
                                Pasar a Preparar
                              </button>
                            )}
                            {pedido.estado === "Preparando" && (
                              <button
                                type="button"
                                onClick={() => void changeKitchenStatus(pedido.id, "Servido")}
                                className="flex-1 py-1 px-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Marcar Servido
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-500 italic py-1">
                          Mesa disponible para nuevos comensales.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Acciones principales de la mesa */}
                  <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
                    {!isOccupied ? (
                      <Button
                        onClick={() => openTakeTableOrder(mesa)}
                        className="w-full bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-bold h-9 shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Tomar Pedido</span>
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        {pedido?.editable ? (
                          <Button
                            onClick={() => pedido && openEditOrder(pedido)}
                            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold h-9 shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </Button>
                        ) : (
                          <div
                            className="flex-1 bg-slate-100 text-slate-500 rounded-xl text-[11px] font-semibold h-9 flex items-center justify-center gap-1 text-center"
                            title="El pedido ya fue servido. No se permiten modificaciones."
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Servido</span>
                          </div>
                        )}

                        <Link
                          href={`/restaurant/cashier?orderId=${pedido?.id}&tableId=${mesa.id}`}
                          className="flex-1 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold h-9 shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Cobrar</span>
                        </Link>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* SECCIÓN PEDIDOS PARA LLEVAR ACTIVOS (TAKEOUT) */}
          <Card className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Pedidos Para Llevar Activos ({takeoutOrders.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Atención rápida sin ocupar tables del salón
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                onClick={openTakeawayOrder}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold h-8 rounded-lg flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuevo Para Llevar</span>
              </Button>
            </div>

            {takeoutOrders.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">
                No hay pedidos para llevar activos en este momento.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {takeoutOrders.map((t) => (
                  <div
                    key={t.id}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-xs text-slate-900">{t.codigo}</span>
                        <Badge
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border-none ${
                            t.estado === "Recibido"
                              ? "bg-blue-100 text-blue-700"
                              : t.estado === "Preparando"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {t.estado.toUpperCase()}
                        </Badge>
                      </div>

                      {t.observacion && (
                        <p className="text-[11px] font-medium text-slate-600 mb-1">
                          Cliente / Nota: {t.observacion}
                        </p>
                      )}

                      <div className="text-[11px] text-slate-500 line-clamp-2">
                        {t.items.map((it) => `${it.cantidad}x ${it.nombre}`).join(", ")}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                      <span className="font-mono font-bold text-red-700 text-xs">
                        {formatCurrency(t.total)}
                      </span>

                      <div className="flex items-center gap-2">
                        {t.editable && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditOrder(t)}
                            className="h-7 px-2.5 text-[11px] font-bold rounded-lg cursor-pointer"
                          >
                            <Edit className="w-3 h-3 mr-1" />
                            Editar
                          </Button>
                        )}
                        <Link
                          href={`/restaurant/cashier?orderId=${t.id}`}
                          className="h-7 px-3 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 transition-colors"
                        >
                          <CreditCard className="w-3 h-3" />
                          Cobrar
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </main>
      </div>

      {/* MODAL DE COMANDA (TOMAR / EDITAR PEDIDO CON CARTA, ADICIONALES Y NOTAS) */}
      <Dialog open={orderModalOpen} onOpenChange={setOrderModalOpen}>
        <DialogContent className="max-w-5xl! w-full p-0 overflow-hidden rounded-2xl flex flex-col max-h-[92vh]">
          {/* Header del modal */}
          <DialogHeader className="bg-red-700 text-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                  <Utensils className="w-5 h-5" />
                  <span>
                    {isEditing
                      ? `Editar Pedido (${isTakeaway ? "Para Llevar" : `Mesa ${selectedTable?.numero}`})`
                      : isTakeaway
                      ? "Registrar Pedido Para Llevar"
                      : `Tomar Pedido - Mesa ${selectedTable?.numero}`}
                  </span>
                </DialogTitle>
                <p className="text-xs text-red-100 mt-0.5">
                  Selecciona productos de la carta, agrega cantidades y notas especiales.
                </p>
              </div>
            </div>
          </DialogHeader>

          {/* Cuerpo dividido en 2 columnas: Izquierda Carta | Derecha Carrito de Comanda */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-125">
            {/* COLUMNA IZQUIERDA: CARTA */}
            <div className="flex-1 flex flex-col border-r border-slate-200 bg-slate-50/50 overflow-hidden">
              {/* Barra de Filtros y Búsqueda */}
              <div className="p-3 bg-white border-b border-slate-200 flex flex-col gap-2">
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {[
                    { id: "todos", label: "Todos" },
                    { id: "pollos", label: "Pollos a la Brasa" },
                    { id: "adicionales", label: "Adicionales / Porciones" },
                    { id: "bebidas", label: "Bebidas" },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                        selectedCategory === cat.id
                          ? "bg-red-700 text-white shadow-xs"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Buscar producto en la carta..."
                    value={dishSearch}
                    onChange={(e) => setDishSearch(e.target.value)}
                    className="pl-8 text-xs h-8 bg-slate-50 border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              {/* Grid de Productos */}
              <div className="flex-1 p-4 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredDishes.map((plato) => (
                  <div
                    key={plato.id}
                    className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col justify-between hover:shadow-sm transition-all"
                  >
                    <div className="relative h-28 w-full bg-slate-100 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={plato.imagen}
                        alt={plato.nombre}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <span className="absolute bottom-2 right-2 bg-slate-900/80 backdrop-blur-xs text-white text-[11px] font-bold font-mono px-2 py-0.5 rounded-md">
                        {formatCurrency(plato.precio)}
                      </span>
                    </div>

                    <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 leading-tight">
                          {plato.nombre}
                        </h4>
                        <p className="text-[10px] text-slate-500 line-clamp-2 mt-1">
                          {plato.descripcion}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => addDish(plato)}
                        className="w-full bg-red-50 hover:bg-red-700 text-red-700 hover:text-white border border-red-200 text-xs font-bold h-7.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Agregar</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* COLUMNA DERECHA: CARRITO / COMANDA */}
            <div className="w-full md:w-96 bg-white flex flex-col">
              {/* Resumen del Encabezado */}
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Detalle de Comanda
                  </span>
                  <Badge className="bg-red-700 text-white text-[10px] font-bold">
                    {isTakeaway ? "Para Llevar" : `Mesa ${selectedTable?.numero}`}
                  </Badge>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">
                    Mozo / Nota del Pedido (Opcional):
                  </label>
                  <Input
                    placeholder="Ej: Mozo Carlos / Familia López"
                    value={tableNote}
                    onChange={(e) => setTableNote(e.target.value)}
                    className="h-8 text-xs bg-white border-slate-300"
                  />
                </div>
              </div>

              {/* Lista de Ítems */}
              <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-2.5">
                {orderItems.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-10">
                    <Utensils className="w-8 h-8 stroke-1 mb-2 opacity-60" />
                    <p className="text-xs italic">No hay productos agregados.</p>
                    <p className="text-[10px] text-slate-400">
                      Haz clic en &quot;Agregar&quot; en la carta.
                    </p>
                  </div>
                ) : (
                  orderItems.map((item, idx) => (
                    <div
                      key={`${item.idPlato}-${idx}`}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col gap-1.5"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 pr-2">
                          <h5 className="text-xs font-bold text-slate-900 leading-tight">
                            {item.nombre}
                          </h5>
                          <span className="text-[10px] font-mono text-slate-500">
                            {formatCurrency(item.precio)} c/u
                          </span>
                        </div>

                        {/* Controlador de Cantidad */}
                        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => modificarCantidad(idx, -1)}
                            className="w-5 h-5 flex items-center justify-center rounded text-slate-600 hover:bg-slate-100 font-bold text-xs"
                          >
                            -
                          </button>
                          <span className="w-5 text-center font-bold text-xs">{item.cantidad}</span>
                          <button
                            type="button"
                            onClick={() => modificarCantidad(idx, 1)}
                            className="w-5 h-5 flex items-center justify-center rounded text-slate-600 hover:bg-slate-100 font-bold text-xs"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Observación y Acción de Eliminar */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                        <button
                          type="button"
                          onClick={() => openNote(idx)}
                          className={`text-[10px] font-semibold flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                            item.observaciones
                              ? "bg-amber-100 text-amber-900 font-bold"
                              : "text-slate-500 hover:bg-slate-200"
                          }`}
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>{item.observaciones ? item.observaciones : "+ Agregar Nota"}</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-slate-900">
                            {formatCurrency(item.precio * item.cantidad)}
                          </span>
                          <button
                            type="button"
                            onClick={() => eliminarItem(idx)}
                            className="text-slate-400 hover:text-red-600 p-0.5"
                            title="Quitar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer con Totales y Confirmación */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col gap-3">
                <div className="flex items-center justify-between text-base font-bold text-slate-900">
                  <span>TOTAL ESTIMADO:</span>
                  <span className="font-mono text-red-700 text-lg">
                    {formatCurrency(orderTotal)}
                  </span>
                </div>

                <Button
                  onClick={() => void saveOrder()}
                  disabled={savingOrder || orderItems.length === 0}
                  className="w-full bg-red-700 hover:bg-red-800 text-white font-bold text-xs h-10 rounded-xl flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {savingOrder
                      ? "Enviando comanda..."
                      : isEditing
                      ? "Guardar Cambios de Pedido"
                      : isTakeaway
                      ? "Confirmar Pedido Para Llevar"
                      : "Ocupar Mesa y Enviar a Cocina"}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL PEQUEÑO: AGREGAR OBSERVACIÓN A PRODUCTO */}
      <Dialog open={notesModalOpen} onOpenChange={setNotesModalOpen}>
        <DialogContent className="max-w-md rounded-xl p-5">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-red-700" />
              <span>Observaciones de Preparación</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <p className="text-xs text-slate-600">
              Producto:{" "}
              <strong>
                {noteIndex !== null && orderItems[noteIndex]
                  ? orderItems[noteIndex].nombre
                  : ""}
              </strong>
            </p>
            <textarea
              rows={3}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Ej: Papas bien crocantes, parte pecho, ensalada sin vinagreta, ají extra..."
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-red-700"
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNotesModalOpen(false)}
              className="text-xs font-semibold rounded-lg"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={saveNote}
              className="bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-lg cursor-pointer"
            >
              Guardar Nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

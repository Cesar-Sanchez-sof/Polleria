"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
  CreditCard,
  Banknote,
  QrCode,
  Smartphone,
  Receipt,
  Printer,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Building,
  User,
  Utensils,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  FileCheck
} from "lucide-react";
import { toast } from "sonner";
import { RestaurantHeader } from "@/components/shared/ModuleHeader";
import {
  listTables,
  listOrders,
  listPaymentMethods as listPaymentTypes,
  registerSale,
  formatCurrency,
  type TableItem,
  type OrderSummary,
  type PaymentMethodItem,
  type IssuedVoucher,
} from "@/lib/services/tables.service";

function CashierCheckoutContent() {
  const searchParams = useSearchParams();
  const urlOrderId = searchParams.get("orderId");

  // Datos
  const [tables, setTables] = useState<TableItem[]>([]);
  const [takeoutOrders, setTakeoutOrders] = useState<OrderSummary[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<PaymentMethodItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Pedido seleccionado a cobrar
  const [selectedOrder, setSelectedOrder] = useState<OrderSummary | null>(null);
  const [paymentSource, setPaymentSource] = useState<string>("");

  // Método de pago
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"efectivo" | "yape" | "pos">("efectivo");
  const [cashAmountGiven, setCashAmountGiven] = useState<string>("");

  // Modal Comprobante
  const [voucherModalOpen, setVoucherModalOpen] = useState<boolean>(false);
  const [voucherType, setVoucherType] = useState<"Boleta" | "Factura" | "Ticket">("Boleta");
  const [receiptSubtype, setReceiptSubtype] = useState<"simple" | "dni">("simple");
  const [customerDoc, setCustomerDoc] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [processingSale, setProcessingSale] = useState<boolean>(false);

  // Ticket Imprimible
  const [ticketModalOpen, setTicketModalOpen] = useState<boolean>(false);
  const [issuedVoucher, setIssuedVoucher] = useState<IssuedVoucher | null>(null);

  // Cargar mesas con pedido activo y pedidos takeout activos
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [tablesRes, takeoutRes, typesRes] = await Promise.all([
        listTables(),
        listOrders({ tipo: "Llevar", estado: "activos" }),
        listPaymentTypes(),
      ]);

      setTables(tablesRes.mesas);
      setTakeoutOrders(takeoutRes);
      setPaymentTypes(typesRes);

      // Si viene pedidoId por URL, cargarlo automáticamente
      if (urlOrderId) {
        const searchedId = Number(urlOrderId);
        // Buscar en mesas
        const tableWithOrder = tablesRes.mesas.find((m) => m.pedidoActivo?.id === searchedId);
        if (tableWithOrder && tableWithOrder.pedidoActivo) {
          setSelectedOrder({
            id: tableWithOrder.pedidoActivo.id,
            codigo: tableWithOrder.pedidoActivo.codigo,
            tipoPedido: "Mesa",
            fecha: tableWithOrder.pedidoActivo.fecha,
            estado: tableWithOrder.pedidoActivo.estado,
            mesa: { id: tableWithOrder.id, numero: tableWithOrder.numero },
            observacion: tableWithOrder.pedidoActivo.observacionMesa,
            items: tableWithOrder.pedidoActivo.items,
            total: tableWithOrder.pedidoActivo.total,
            editable: false,
          });
          setPaymentSource(`Mesa ${tableWithOrder.numero}`);
        } else {
          // Buscar en takeout
          const takeout = takeoutRes.find((t) => t.id === searchedId);
          if (takeout) {
            setSelectedOrder(takeout);
            setPaymentSource(`Para Llevar (${takeout.codigo})`);
          }
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Error al cargar la información de caja.");
    } finally {
      setLoading(false);
    }
  }, [urlOrderId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Totales calculados
  const total = selectedOrder ? selectedOrder.total : 0;
  const taxableSubtotal = Math.round((total / 1.18) * 100) / 100;
  const calculatedIgv = Math.round((total - taxableSubtotal) * 100) / 100;

  // Cálculo de vuelto para efectivo
  const changeDue = useMemo(() => {
    const amountGiven = Number(cashAmountGiven);
    if (!amountGiven || amountGiven < total) return 0;
    return Math.round((amountGiven - total) * 100) / 100;
  }, [cashAmountGiven, total]);

  // Selección de mesa
  const selectTable = (mesa: TableItem) => {
    if (!mesa.pedidoActivo) {
      toast.info(`La Mesa ${mesa.numero} no tiene ningún pedido activo pendiente.`);
      return;
    }
    setSelectedOrder({
      id: mesa.pedidoActivo.id,
      codigo: mesa.pedidoActivo.codigo,
      tipoPedido: "Mesa",
      fecha: mesa.pedidoActivo.fecha,
      estado: mesa.pedidoActivo.estado,
      mesa: { id: mesa.id, numero: mesa.numero },
      observacion: mesa.pedidoActivo.observacionMesa,
      items: mesa.pedidoActivo.items,
      total: mesa.pedidoActivo.total,
      editable: false,
    });
    setPaymentSource(`Mesa ${mesa.numero}`);
    setCashAmountGiven("");
  };

  const selectTakeout = (pedido: OrderSummary) => {
    setSelectedOrder(pedido);
    setPaymentSource(`Para Llevar (${pedido.codigo})`);
    setCashAmountGiven("");
  };

  // Autocompletado simulado para DNI y RUC si se ingresan
  const searchDocument = (doc: string) => {
    setCustomerDoc(doc);
    if (doc.length === 8) {
      if (doc === "47829103") setCustomerName("Juan Carlos Pérez Quispe");
      else if (doc === "71234567") setCustomerName("María Elena Flores");
      else if (!customerName) setCustomerName("Cliente DNI");
    } else if (doc.length === 11) {
      if (doc === "20601234567") setCustomerName("INVERSIONES GASTRONÓMICAS PERÚ S.A.C.");
      else if (!customerName) setCustomerName("EMPRESA CLIENTE S.A.C.");
    }
  };

  // Cierre de venta transaccional
  const executePayment = async () => {
    if (!selectedOrder) {
      toast.warning("Selecciona primero una mesa o pedido para cobrar.");
      return;
    }

    // Identificar el ID del tipo de pago
    const foundPaymentType = paymentTypes.find((tp) => {
      const nom = tp.nombre.toLowerCase();
      if (selectedPaymentMethod === "efectivo") return nom.includes("efectivo");
      if (selectedPaymentMethod === "yape") return nom.includes("yape");
      if (selectedPaymentMethod === "pos") return nom.includes("pos") || nom.includes("tarjeta");
      return false;
    });

    const paymentTypeId = foundPaymentType?.id || (paymentTypes[0]?.id ?? 1);

    // Validación de efectivo
    if (selectedPaymentMethod === "efectivo") {
      const amountGiven = Number(cashAmountGiven);
      if (amountGiven > 0 && amountGiven < total) {
        toast.error(`El monto entregado (S/ ${amountGiven.toFixed(2)}) no cubre el total (S/ ${total.toFixed(2)}).`);
        return;
      }
    }

    try {
      setProcessingSale(true);

      const res = await registerSale({
        id_pedido: selectedOrder.id,
        id_tipo_pago: paymentTypeId,
        tipo_comprobante: voucherType,
        cliente: {
          nro_doc: customerDoc.trim() || undefined,
          nombre: customerName.trim() || (voucherType === "Factura" ? "EMPRESA CLIENTE S.A.C." : "CLIENTE GENERAL"),
          tipo_persona: voucherType === "Factura" ? "Juridico" : "Natural",
        },
        monto_recibido: selectedPaymentMethod === "efectivo" && cashAmountGiven ? Number(cashAmountGiven) : total,
        // Pasarela de Mercado Pago / Tap to Pay preparada
        pasarela: {
          proveedor: "mercado_pago",
          modo: selectedPaymentMethod === "pos" ? "tap_to_pay" : selectedPaymentMethod === "yape" ? "qr" : "manual",
        },
      });

      toast.success(res.mensaje);
      setIssuedVoucher(res.comprobante);
      setVoucherModalOpen(false);
      setTicketModalOpen(true);

      // Limpiar selección actual y recargar mesas
      setSelectedOrder(null);
      setPaymentSource("");
      setCashAmountGiven("");
      setCustomerDoc("");
      setCustomerName("");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Error al completar el cobro.");
    } finally {
      setProcessingSale(false);
    }
  };

  return (
    <>
    <div className="pl-0 md:pl-64 min-h-screen flex flex-col bg-(--color-background) w-full min-w-0 overflow-x-hidden">
        <RestaurantHeader
          title="Módulo de Caja y Facturación"
          subtitle="Cobro de Comandas, Métodos de Pago y Emisión de Comprobantes"
          icon={Receipt}
          iconClassName="bg-slate-900 text-white"
        >
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-full border border-emerald-200 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Caja Principal Abierta</span>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => void loadData()}
            title="Refrescar comanda"
            className="h-9 w-9 rounded-xl cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </RestaurantHeader>

        {/* Contenido dividido en 2 columnas: 1. Selección y Comanda | 2. Pagos y Emisión */}
        <main className="flex-1 w-full min-w-0 p-3 sm:p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 items-start">
          {/* COLUMNA IZQUIERDA: 1. Elegir mesa + 2. Detalles del pedido (7 columnas) */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            {/* PASO 1: Elegir Mesa u Orden Para Llevar */}
            <Card className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h2 className="text-xs font-bold text-red-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Utensils className="w-4 h-4" />
                  <span>1. Elegir Mesa con Pedido Pendiente</span>
                </h2>
                <span className="text-[11px] text-slate-500">
                  {tables.filter((m) => m.ocupada).length} mesa(s) ocupada(s)
                </span>
              </div>

              {/* Grid de Mesas para Cobro */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {tables.map((m) => {
                  const hasOrder = m.ocupada && m.pedidoActivo;
                  const isSelected = selectedOrder?.mesa?.id === m.id;

                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => hasOrder && selectTable(m)}
                      disabled={!hasOrder}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                        isSelected
                          ? "border-red-700 bg-red-50/70 ring-2 ring-red-700/20"
                          : hasOrder
                          ? "border-slate-200 bg-white hover:border-slate-400 hover:shadow-xs"
                          : "border-slate-100 bg-slate-50 opacity-40 cursor-not-allowed"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">Mesa {m.numero}</span>
                        <Badge
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                            hasOrder ? "bg-rose-100 text-rose-800" : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {hasOrder ? "A COBRAR" : "LIBRE"}
                        </Badge>
                      </div>

                      {hasOrder ? (
                        <div className="mt-2">
                          <span className="font-mono font-bold text-red-700 text-xs block">
                            {formatCurrency(m.pedidoActivo!.total)}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {m.pedidoActivo!.items.length} producto(s)
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic mt-2">Sin consumos</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Pedidos Para Llevar Pendientes */}
              {takeoutOrders.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-600 block mb-2">
                    Pedidos Para Llevar Pendientes:
                  </span>
                  <div className="flex gap-2 flex-wrap">
                    {takeoutOrders.map((t) => {
                      const isSelected = selectedOrder?.id === t.id && !selectedOrder.mesa;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => selectTakeout(t)}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${
                            isSelected
                              ? "border-red-700 bg-red-50 text-red-800 ring-1 ring-red-700"
                              : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800"
                          }`}
                        >
                          <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
                          <span>{t.codigo}</span>
                          <span className="font-mono font-bold">{formatCurrency(t.total)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>

            {/* PASO 2: Detalle de Ítems del Pedido Seleccionado */}
            <Card className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-slate-700" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    2. Detalle de Consumos (
                    <span className="text-red-700">{paymentSource || "Ninguno"}</span>)
                  </h3>
                </div>
                <span className="text-xs text-slate-500">
                  {selectedOrder ? selectedOrder.codigo : "Selecciona una mesa"}
                </span>
              </div>

              {/* Tabla de Productos del Pedido */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold text-[10px] uppercase border-b border-slate-200">
                      <th className="py-2.5 px-3">Cant.</th>
                      <th className="py-2.5 px-3">Producto / Detalle</th>
                      <th className="py-2.5 px-3 text-right">P. Unit</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!selectedOrder || selectedOrder.items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-slate-400 italic">
                          No hay ninguna mesa isSelected para cobrar.
                        </td>
                      </tr>
                    ) : (
                      selectedOrder.items.map((it, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-bold text-slate-900 w-12">
                            {it.cantidad}x
                          </td>
                          <td className="py-2.5 px-3 text-slate-800">
                            <span className="font-semibold block">{it.nombre}</span>
                            {it.observaciones && (
                              <span className="text-[10px] text-amber-700 italic block">
                                Obs: {it.observaciones}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            {formatCurrency(it.precioUnitario)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(it.subTotal)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Resumen Numérico (Subtotal, IGV 18%, Total) */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Op. Gravadas (Subtotal sin IGV):</span>
                  <span className="font-mono">{formatCurrency(taxableSubtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>I.G.V. (18% Incluido en carta):</span>
                  <span className="font-mono">{formatCurrency(calculatedIgv)}</span>
                </div>
                <div className="flex items-center justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                  <span>TOTAL A COBRAR:</span>
                  <span className="font-mono text-xl text-red-700 font-extrabold">
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* COLUMNA DERECHA: 3. Opciones de Pago + Facturación (5 columnas) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <Card className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-slate-600" />
                  <span>3. Método de Pago</span>
                </h2>
                <Badge className="bg-slate-100 text-slate-700 text-[10px] font-bold">
                  Selecciona uno
                </Badge>
              </div>

              {/* Selector de Método de Pago */}
              <div className="grid grid-cols-3 gap-2">
                {/* 1. Efectivo */}
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethod("efectivo")}
                  className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 text-center transition-all cursor-pointer ${
                    selectedPaymentMethod === "efectivo"
                      ? "border-red-700 bg-red-50/50 shadow-xs"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <Banknote
                    className={`w-6 h-6 ${selectedPaymentMethod === "efectivo" ? "text-red-700" : "text-slate-500"}`}
                  />
                  <span className="text-xs font-bold text-slate-900">Efectivo</span>
                  <span className="text-[10px] text-slate-500">Cálculo changeDue</span>
                </button>

                {/* 2. Yape */}
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethod("yape")}
                  className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 text-center transition-all cursor-pointer ${
                    selectedPaymentMethod === "yape"
                      ? "border-purple-600 bg-purple-50/50 shadow-xs"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <QrCode
                    className={`w-6 h-6 ${selectedPaymentMethod === "yape" ? "text-purple-600" : "text-slate-500"}`}
                  />
                  <span className="text-xs font-bold text-slate-900">Yape</span>
                  <span className="text-[10px] text-slate-500">QR / App</span>
                </button>

                {/* 3. Tarjeta POS / Tap to Pay Celular */}
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethod("pos")}
                  className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 text-center transition-all cursor-pointer ${
                    selectedPaymentMethod === "pos"
                      ? "border-blue-600 bg-blue-50/50 shadow-xs"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <Smartphone
                    className={`w-6 h-6 ${selectedPaymentMethod === "pos" ? "text-blue-600" : "text-slate-500"}`}
                  />
                  <span className="text-xs font-bold text-slate-900">POS / Celular</span>
                  <span className="text-[10px] text-slate-500">Tap to Pay</span>
                </button>
              </div>

              {/* CONTENIDO SEGÚN MÉTODO DE PAGO */}
              {/* A. Efectivo */}
              {selectedPaymentMethod === "efectivo" && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Monto Entregado por Cliente (S/)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-500">
                        S/
                      </span>
                      <Input
                        type="number"
                        step="0.50"
                        placeholder={total > 0 ? total.toFixed(2) : "0.00"}
                        value={cashAmountGiven}
                        onChange={(e) => setCashAmountGiven(e.target.value)}
                        className="pl-8 text-sm font-mono font-bold bg-white h-9"
                      />
                    </div>
                  </div>

                  {/* Botones de billetes rápidos */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[20, 50, 100].map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setCashAmountGiven(String(b))}
                        className="px-2.5 py-1 bg-white border border-slate-200 rounded-md text-[11px] font-bold hover:bg-slate-100"
                      >
                        S/ {b}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCashAmountGiven(total.toFixed(2))}
                      className="px-2.5 py-1 bg-red-100 text-red-700 border border-red-200 rounded-md text-[11px] font-bold hover:bg-red-200"
                    >
                      Exacto
                    </button>
                  </div>

                  {/* Vuelto a devolver */}
                  <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs">
                    <span className="font-bold text-emerald-900">Vuelto a devolver:</span>
                    <span className="font-mono text-base font-extrabold text-emerald-700">
                      {formatCurrency(changeDue)}
                    </span>
                  </div>
                </div>
              )}

              {/* B. Yape */}
              {selectedPaymentMethod === "yape" && (
                <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 flex flex-col items-center text-center gap-3">
                  <div className="flex items-center gap-1.5 text-purple-900 font-bold text-xs">
                    <QrCode className="w-4 h-4" />
                    <span>Cobro mediante Yape / Mercado Pago</span>
                  </div>

                  {/* Espacio del QR preparado */}
                  <div className="w-36 h-36 bg-white p-2 rounded-xl shadow-xs border-2 border-purple-300 flex flex-col items-center justify-center">
                    <QrCode className="w-24 h-24 text-purple-700 opacity-80" />
                    <span className="text-[9px] text-purple-700 font-bold mt-1">QR POLERÍA</span>
                  </div>

                  <div className="text-xs text-purple-950">
                    <p className="font-bold">Pollería Central</p>
                    <p className="text-[11px] text-purple-800">
                      Monto a pagar: <strong>{formatCurrency(total)}</strong>
                    </p>
                    <p className="text-[10px] text-purple-600 italic mt-1">
                      Preparado para enlazar con pasarela QR Mercado Pago.
                    </p>
                  </div>
                </div>
              )}

              {/* C. Tarjeta POS / Tap to Pay Celular */}
              {selectedPaymentMethod === "pos" && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-blue-900 font-bold text-xs">
                    <Smartphone className="w-4 h-4 text-blue-700" />
                    <span>Terminal POS en Celular (Tap to Pay)</span>
                  </div>

                  <div className="bg-white p-3 rounded-lg border border-blue-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div className="text-xs">
                      <p className="font-bold text-slate-900">Cobro por Contactless / NFC</p>
                      <p className="text-[11px] text-slate-500">
                        Total: <strong className="text-blue-700">{formatCurrency(total)}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-blue-800 bg-blue-100/60 p-2 rounded">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                    <span>
                      Arquitectura lista para vincular con pasarela Mercado Pago Point / Tap to Pay.
                    </span>
                  </div>
                </div>
              )}

              {/* BOTONES PRINCIPALES DE ACCIÓN */}
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                <Button
                  onClick={() => {
                    if (!selectedOrder) {
                      toast.warning("Selecciona una mesa o comanda para emitir comprobante.");
                      return;
                    }
                    setVoucherModalOpen(true);
                  }}
                  disabled={!selectedOrder || processingSale}
                  className="w-full bg-red-700 hover:bg-red-800 text-white font-bold text-xs h-11 rounded-xl flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <Receipt className="w-4 h-4" />
                  <span>Emitir Comprobante y Cobrar</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    setVoucherType("Ticket");
                    void executePayment();
                  }}
                  disabled={!selectedOrder || processingSale}
                  className="w-full text-slate-700 font-semibold text-xs h-9 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Cierre Directo de Mesa (Ticket Rápido)</span>
                </Button>
              </div>
            </Card>
          </div>
        </main>
      </div>

      {/* MODAL: CONFIGURAR Y EMITIR COMPROBANTE (BOLETA / FACTURA) */}
      <Dialog open={voucherModalOpen} onOpenChange={setVoucherModalOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-red-700" />
              <span>Emitir Comprobante de Pago</span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Tipo de Comprobante:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setVoucherType("Boleta");
                    setReceiptSubtype("simple");
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer ${
                    voucherType === "Boleta"
                      ? "border-red-700 bg-red-50 text-red-700"
                      : "border-slate-200 text-slate-700"
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>Boleta de Venta</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVoucherType("Factura");
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer ${
                    voucherType === "Factura"
                      ? "border-red-700 bg-red-50 text-red-700"
                      : "border-slate-200 text-slate-700"
                  }`}
                >
                  <Building className="w-4 h-4" />
                  <span>Factura (RUC)</span>
                </button>
              </div>
            </div>

            {/* Subtipos de Boleta */}
            {voucherType === "Boleta" && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReceiptSubtype("simple");
                    setCustomerDoc("");
                    setCustomerName("CLIENTE GENERAL");
                  }}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border cursor-pointer ${
                    receiptSubtype === "simple"
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-slate-50 text-slate-600 border-slate-200"
                  }`}
                >
                  Sin DNI (Cliente General)
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptSubtype("dni")}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border cursor-pointer ${
                    receiptSubtype === "dni"
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-slate-50 text-slate-600 border-slate-200"
                  }`}
                >
                  Con DNI
                </button>
              </div>
            )}

            {/* Formulario de Cliente */}
            {(voucherType === "Factura" || receiptSubtype === "dni") && (
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col gap-2.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {voucherType === "Factura" ? "Número de RUC (11 dígitos):" : "Número de DNI (8 dígitos):"}
                  </label>
                  <Input
                    maxLength={voucherType === "Factura" ? 11 : 8}
                    placeholder={voucherType === "Factura" ? "Ej: 20601234567" : "Ej: 47829103"}
                    value={customerDoc}
                    onChange={(e) => searchDocument(e.target.value)}
                    className="h-8 text-xs font-mono font-bold bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {voucherType === "Factura" ? "Razón Social:" : "Nombres y Apellidos:"}
                  </label>
                  <Input
                    placeholder="Nombre del cliente o empresa"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-8 text-xs bg-white"
                  />
                </div>
              </div>
            )}

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs flex justify-between font-bold">
              <span>Monto a Cobrar:</span>
              <span className="font-mono text-red-700 text-sm">{formatCurrency(total)}</span>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVoucherModalOpen(false)}
              className="text-xs font-semibold rounded-lg"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => void executePayment()}
              disabled={processingSale}
              className="bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-lg cursor-pointer"
            >
              {processingSale ? "Registrando..." : "Confirmar e Imprimir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: TICKET DE VENTA IMPRIMIBLE */}
      <Dialog open={ticketModalOpen} onOpenChange={setTicketModalOpen}>
        <DialogContent className="max-w-sm rounded-xl p-5 bg-white text-black font-mono">
          <div id="ticket-imprimible" className="flex flex-col gap-2 text-[11px]">
            {/* Cabecera */}
            <div className="text-center border-b border-dashed border-slate-400 pb-2">
              <h3 className="font-black text-sm uppercase tracking-wider">POLLERÍA CENTRAL</h3>
              <p className="text-[10px]">RUC: 20601234567 • LIMA, PERÚ</p>
              <p className="text-[10px]">AV. PRINCIPAL 123</p>
              <p className="font-bold text-xs mt-1 uppercase text-slate-900">
                {issuedVoucher?.tipo === "Factura"
                  ? "FACTURA ELECTRÓNICA"
                  : "BOLETA DE VENTA ELECTRÓNICA"}
              </p>
              <p className="text-[11px] font-bold text-red-700">{issuedVoucher?.codigoCompleto}</p>
            </div>

            {/* Metadatos */}
            <div className="space-y-0.5 border-b border-dashed border-slate-400 pb-2 text-[10px]">
              <p>
                FECHA: <span>{new Date().toLocaleString("es-PE")}</span>
              </p>
              <p>ORIGEN: {issuedVoucher?.origen}</p>
              <p>CLIENTE: {issuedVoucher?.cliente.nombre}</p>
              {issuedVoucher?.cliente.nroDoc !== "00000000" && (
                <p>DOC: {issuedVoucher?.cliente.nroDoc}</p>
              )}
              <p>FORMA PAGO: {issuedVoucher?.metodoPago.toUpperCase()}</p>
            </div>

            {/* Ítems */}
            <div className="border-b border-dashed border-slate-400 py-2 space-y-1.5">
              {issuedVoucher?.items.map((it, idx) => (
                <div key={idx} className="flex justify-between items-start text-[10px]">
                  <div className="flex-1 pr-2">
                    <span>
                      {it.cantidad}x {it.nombre}
                    </span>
                    {it.observaciones && (
                      <span className="block text-[9px] text-slate-500 italic">
                        {it.observaciones}
                      </span>
                    )}
                  </div>
                  <span className="font-bold">{formatCurrency(it.subTotal)}</span>
                </div>
              ))}
            </div>

            {/* Totales */}
            <div className="space-y-1 pt-1 border-b border-dashed border-slate-400 pb-2 text-[11px]">
              <div className="flex justify-between text-slate-600">
                <span>OP. GRAVADA:</span>
                <span>{formatCurrency(issuedVoucher?.subtotal || 0)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>I.G.V. (18%):</span>
                <span>{formatCurrency(issuedVoucher?.igv || 0)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-sm pt-1 text-slate-900">
                <span>TOTAL PAGADO:</span>
                <span>{formatCurrency(issuedVoucher?.total || 0)}</span>
              </div>
              {issuedVoucher?.vuelto && issuedVoucher.vuelto > 0 ? (
                <div className="flex justify-between text-emerald-700 font-bold text-[10px] pt-1">
                  <span>VUELTO:</span>
                  <span>{formatCurrency(issuedVoucher.vuelto)}</span>
                </div>
              ) : null}
            </div>

            <div className="text-center text-[9px] text-slate-500 pt-1">
              <p>¡GRACIAS POR SU PREFERENCIA!</p>
              <p>Representación impresa de Comprobante de Pago</p>
            </div>
          </div>

          <DialogFooter className="flex gap-2 mt-4 pt-2 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTicketModalOpen(false)}
              className="text-xs font-semibold rounded-lg"
            >
              Cerrar
            </Button>
            <Button
              size="sm"
              onClick={() => window.print()}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir Ticket</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function CashierCheckoutPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Cargando Caja...</div>}>
      <CashierCheckoutContent />
    </Suspense>
  );
}

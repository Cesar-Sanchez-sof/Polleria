"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
  FileCheck,
  Menu,
} from "lucide-react";
import { toast } from "sonner";
import {
  listarMesas,
  listarPedidos,
  listarTiposPago,
  registrarVenta,
  formatearMoneda,
  type MesaItem,
  type PedidoResumen,
  type TipoPagoItem,
  type ComprobanteEmitido,
} from "@/lib/services/mesas.service";

function CajaCobroContent() {
  const searchParams = useSearchParams();
  const urlPedidoId = searchParams.get("pedidoId");

  // Control de menú lateral en móviles
  const [menuMovilAbierto, setMenuMovilAbierto] = useState<boolean>(false);

  // Datos
  const [mesas, setMesas] = useState<MesaItem[]>([]);
  const [pedidosTakeout, setPedidosTakeout] = useState<PedidoResumen[]>([]);
  const [tiposPago, setTiposPago] = useState<TipoPagoItem[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);

  // Pedido seleccionado a cobrar
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<PedidoResumen | null>(null);
  const [origenCobro, setOrigenCobro] = useState<string>("");

  // Método de pago
  const [metodoPagoSeleccionado, setMetodoPagoSeleccionado] = useState<"efectivo" | "yape" | "pos">("efectivo");
  const [montoEntregadoEfectivo, setMontoEntregadoEfectivo] = useState<string>("");

  // Modal Comprobante
  const [modalComprobanteAbierto, setModalComprobanteAbierto] = useState<boolean>(false);
  const [tipoComprobante, setTipoComprobante] = useState<"Boleta" | "Factura" | "Ticket">("Boleta");
  const [subTipoBoleta, setSubTipoBoleta] = useState<"simple" | "dni">("simple");
  const [clienteDoc, setClienteDoc] = useState<string>("");
  const [clienteNombre, setClienteNombre] = useState<string>("");
  const [procesandoVenta, setProcesandoVenta] = useState<boolean>(false);

  // Ticket Imprimible
  const [modalTicketAbierto, setModalTicketAbierto] = useState<boolean>(false);
  const [comprobanteEmitido, setComprobanteEmitido] = useState<ComprobanteEmitido | null>(null);

  // Cargar mesas con pedido activo y pedidos takeout activos
  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);
      const [mesasRes, takeoutRes, tiposRes] = await Promise.all([
        listarMesas(),
        listarPedidos({ tipo: "Llevar", estado: "activos" }),
        listarTiposPago(),
      ]);

      setMesas(mesasRes.mesas);
      setPedidosTakeout(takeoutRes);
      setTiposPago(tiposRes);

      // Si viene pedidoId por URL, cargarlo automáticamente
      if (urlPedidoId) {
        const idBuscado = Number(urlPedidoId);
        // Buscar en mesas
        const mesaConPedido = mesasRes.mesas.find((m) => m.pedidoActivo?.id === idBuscado);
        if (mesaConPedido && mesaConPedido.pedidoActivo) {
          setPedidoSeleccionado({
            id: mesaConPedido.pedidoActivo.id,
            codigo: mesaConPedido.pedidoActivo.codigo,
            tipoPedido: "Mesa",
            fecha: mesaConPedido.pedidoActivo.fecha,
            estado: mesaConPedido.pedidoActivo.estado,
            mesa: { id: mesaConPedido.id, numero: mesaConPedido.numero },
            observacion: mesaConPedido.pedidoActivo.observacionMesa,
            items: mesaConPedido.pedidoActivo.items,
            total: mesaConPedido.pedidoActivo.total,
            editable: false,
          });
          setOrigenCobro(`Mesa ${mesaConPedido.numero}`);
        } else {
          // Buscar en takeout
          const takeout = takeoutRes.find((t) => t.id === idBuscado);
          if (takeout) {
            setPedidoSeleccionado(takeout);
            setOrigenCobro(`Para Llevar (${takeout.codigo})`);
          }
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Error al cargar la información de caja.");
    } finally {
      setCargando(false);
    }
  }, [urlPedidoId]);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  // Totales calculados
  const total = pedidoSeleccionado ? pedidoSeleccionado.total : 0;
  const subtotalGravado = Math.round((total / 1.18) * 100) / 100;
  const igvCalculado = Math.round((total - subtotalGravado) * 100) / 100;

  // Cálculo de vuelto para efectivo
  const vuelto = useMemo(() => {
    const entregado = Number(montoEntregadoEfectivo);
    if (!entregado || entregado < total) return 0;
    return Math.round((entregado - total) * 100) / 100;
  }, [montoEntregadoEfectivo, total]);

  // Selección de mesa
  const seleccionarMesa = (mesa: MesaItem) => {
    if (!mesa.pedidoActivo) {
      toast.info(`La Mesa ${mesa.numero} no tiene ningún pedido activo pendiente.`);
      return;
    }
    setPedidoSeleccionado({
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
    setOrigenCobro(`Mesa ${mesa.numero}`);
    setMontoEntregadoEfectivo("");
  };

  const seleccionarTakeout = (pedido: PedidoResumen) => {
    setPedidoSeleccionado(pedido);
    setOrigenCobro(`Para Llevar (${pedido.codigo})`);
    setMontoEntregadoEfectivo("");
  };

  // Autocompletado simulado para DNI y RUC si se ingresan
  const buscarDocumento = (doc: string) => {
    setClienteDoc(doc);
    if (doc.length === 8) {
      if (doc === "47829103") setClienteNombre("Juan Carlos Pérez Quispe");
      else if (doc === "71234567") setClienteNombre("María Elena Flores");
      else if (!clienteNombre) setClienteNombre("Cliente DNI");
    } else if (doc.length === 11) {
      if (doc === "20601234567") setClienteNombre("INVERSIONES GASTRONÓMICAS PERÚ S.A.C.");
      else if (!clienteNombre) setClienteNombre("EMPRESA CLIENTE S.A.C.");
    }
  };

  // Cierre de venta transaccional
  const ejecutarCobro = async () => {
    if (!pedidoSeleccionado) {
      toast.warning("Selecciona primero una mesa o pedido para cobrar.");
      return;
    }

    // Identificar el ID del tipo de pago
    const tipoPagoEncontrado = tiposPago.find((tp) => {
      const nom = tp.nombre.toLowerCase();
      if (metodoPagoSeleccionado === "efectivo") return nom.includes("efectivo");
      if (metodoPagoSeleccionado === "yape") return nom.includes("yape");
      if (metodoPagoSeleccionado === "pos") return nom.includes("pos") || nom.includes("tarjeta");
      return false;
    });

    const idTipoPago = tipoPagoEncontrado?.id || (tiposPago[0]?.id ?? 1);

    // Validación de efectivo
    if (metodoPagoSeleccionado === "efectivo") {
      const entregado = Number(montoEntregadoEfectivo);
      if (entregado > 0 && entregado < total) {
        toast.error(`El monto entregado (S/ ${entregado.toFixed(2)}) no cubre el total (S/ ${total.toFixed(2)}).`);
        return;
      }
    }

    try {
      setProcesandoVenta(true);

      const res = await registrarVenta({
        id_pedido: pedidoSeleccionado.id,
        id_tipo_pago: idTipoPago,
        tipo_comprobante: tipoComprobante,
        cliente: {
          nro_doc: clienteDoc.trim() || undefined,
          nombre: clienteNombre.trim() || (tipoComprobante === "Factura" ? "EMPRESA CLIENTE S.A.C." : "CLIENTE GENERAL"),
          tipo_persona: tipoComprobante === "Factura" ? "Juridico" : "Natural",
        },
        monto_recibido: metodoPagoSeleccionado === "efectivo" && montoEntregadoEfectivo ? Number(montoEntregadoEfectivo) : total,
        // Pasarela de Mercado Pago / Tap to Pay preparada
        pasarela: {
          proveedor: "mercado_pago",
          modo: metodoPagoSeleccionado === "pos" ? "tap_to_pay" : metodoPagoSeleccionado === "yape" ? "qr" : "manual",
        },
      });

      toast.success(res.mensaje);
      setComprobanteEmitido(res.comprobante);
      setModalComprobanteAbierto(false);
      setModalTicketAbierto(true);

      // Limpiar selección actual y recargar mesas
      setPedidoSeleccionado(null);
      setOrigenCobro("");
      setMontoEntregadoEfectivo("");
      setClienteDoc("");
      setClienteNombre("");
      await cargarDatos();
    } catch (err: any) {
      toast.error(err.message || "Error al completar el cobro.");
    } finally {
      setProcesandoVenta(false);
    }
  };

  return (
    <div className="w-full min-w-full min-h-screen flex bg-(--color-background) text-sm text-slate-900 antialiased overflow-x-hidden">
      {/* Sidebar fijo en desktop y desplegable en móvil */}
      <Sidebar mobileOpen={menuMovilAbierto} onCloseMobile={() => setMenuMovilAbierto(false)} />

      {/* Área principal */}
      <div className="flex-1 w-full min-w-0 pl-0 md:pl-64 min-h-screen flex flex-col bg-(--color-background) transition-all duration-300">
        {/* Header */}
        <header className="w-full sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Botón Hamburguesa para Móviles */}
            <button
              type="button"
              onClick={() => setMenuMovilAbierto(true)}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              aria-label="Abrir Menú"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                Módulo de Caja y Facturación
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-1">
                Cobro de Comandas, Métodos de Pago y Emisión de Comprobantes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-full border border-emerald-200 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Caja Abierta</span>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => void cargarDatos()}
              title="Refrescar comanda"
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${cargando ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </header>

        {/* Contenido dividido en 2 columnas: 1. Selección y Comanda | 2. Pagos y Emisión */}
        <main className="flex-1 w-full p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
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
                  {mesas.filter((m) => m.ocupada).length} mesa(s) ocupada(s)
                </span>
              </div>

              {/* Grid de Mesas para Cobro */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {mesas.map((m) => {
                  const tienePedido = m.ocupada && m.pedidoActivo;
                  const seleccionado = pedidoSeleccionado?.mesa?.id === m.id;

                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => tienePedido && seleccionarMesa(m)}
                      disabled={!tienePedido}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                        seleccionado
                          ? "border-red-700 bg-red-50/70 ring-2 ring-red-700/20"
                          : tienePedido
                          ? "border-slate-200 bg-white hover:border-slate-400 hover:shadow-xs"
                          : "border-slate-100 bg-slate-50 opacity-40 cursor-not-allowed"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">Mesa {m.numero}</span>
                        <Badge
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                            tienePedido ? "bg-rose-100 text-rose-800" : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {tienePedido ? "A COBRAR" : "LIBRE"}
                        </Badge>
                      </div>

                      {tienePedido ? (
                        <div className="mt-2">
                          <span className="font-mono font-bold text-red-700 text-xs block">
                            {formatearMoneda(m.pedidoActivo!.total)}
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
              {pedidosTakeout.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-600 block mb-2">
                    Pedidos Para Llevar Pendientes:
                  </span>
                  <div className="flex gap-2 flex-wrap">
                    {pedidosTakeout.map((t) => {
                      const seleccionado = pedidoSeleccionado?.id === t.id && !pedidoSeleccionado.mesa;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => seleccionarTakeout(t)}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${
                            seleccionado
                              ? "border-red-700 bg-red-50 text-red-800 ring-1 ring-red-700"
                              : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800"
                          }`}
                        >
                          <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
                          <span>{t.codigo}</span>
                          <span className="font-mono font-bold">{formatearMoneda(t.total)}</span>
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
                    <span className="text-red-700">{origenCobro || "Ninguno"}</span>)
                  </h3>
                </div>
                <span className="text-xs text-slate-500">
                  {pedidoSeleccionado ? pedidoSeleccionado.codigo : "Selecciona una mesa"}
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
                    {!pedidoSeleccionado || pedidoSeleccionado.items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-slate-400 italic">
                          No hay ninguna mesa seleccionada para cobrar.
                        </td>
                      </tr>
                    ) : (
                      pedidoSeleccionado.items.map((it, i) => (
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
                            {formatearMoneda(it.precioUnitario)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {formatearMoneda(it.subTotal)}
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
                  <span className="font-mono">{formatearMoneda(subtotalGravado)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>I.G.V. (18% Incluido en carta):</span>
                  <span className="font-mono">{formatearMoneda(igvCalculado)}</span>
                </div>
                <div className="flex items-center justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                  <span>TOTAL A COBRAR:</span>
                  <span className="font-mono text-xl text-red-700 font-extrabold">
                    {formatearMoneda(total)}
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
                  onClick={() => setMetodoPagoSeleccionado("efectivo")}
                  className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 text-center transition-all cursor-pointer ${
                    metodoPagoSeleccionado === "efectivo"
                      ? "border-red-700 bg-red-50/50 shadow-xs"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <Banknote
                    className={`w-6 h-6 ${metodoPagoSeleccionado === "efectivo" ? "text-red-700" : "text-slate-500"}`}
                  />
                  <span className="text-xs font-bold text-slate-900">Efectivo</span>
                  <span className="text-[10px] text-slate-500">Cálculo vuelto</span>
                </button>

                {/* 2. Yape */}
                <button
                  type="button"
                  onClick={() => setMetodoPagoSeleccionado("yape")}
                  className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 text-center transition-all cursor-pointer ${
                    metodoPagoSeleccionado === "yape"
                      ? "border-purple-600 bg-purple-50/50 shadow-xs"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <QrCode
                    className={`w-6 h-6 ${metodoPagoSeleccionado === "yape" ? "text-purple-600" : "text-slate-500"}`}
                  />
                  <span className="text-xs font-bold text-slate-900">Yape</span>
                  <span className="text-[10px] text-slate-500">QR / App</span>
                </button>

                {/* 3. Tarjeta POS / Tap to Pay Celular */}
                <button
                  type="button"
                  onClick={() => setMetodoPagoSeleccionado("pos")}
                  className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 text-center transition-all cursor-pointer ${
                    metodoPagoSeleccionado === "pos"
                      ? "border-blue-600 bg-blue-50/50 shadow-xs"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <Smartphone
                    className={`w-6 h-6 ${metodoPagoSeleccionado === "pos" ? "text-blue-600" : "text-slate-500"}`}
                  />
                  <span className="text-xs font-bold text-slate-900">POS / Celular</span>
                  <span className="text-[10px] text-slate-500">Tap to Pay</span>
                </button>
              </div>

              {/* CONTENIDO SEGÚN MÉTODO DE PAGO */}
              {/* A. Efectivo */}
              {metodoPagoSeleccionado === "efectivo" && (
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
                        value={montoEntregadoEfectivo}
                        onChange={(e) => setMontoEntregadoEfectivo(e.target.value)}
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
                        onClick={() => setMontoEntregadoEfectivo(String(b))}
                        className="px-2.5 py-1 bg-white border border-slate-200 rounded-md text-[11px] font-bold hover:bg-slate-100"
                      >
                        S/ {b}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setMontoEntregadoEfectivo(total.toFixed(2))}
                      className="px-2.5 py-1 bg-red-100 text-red-700 border border-red-200 rounded-md text-[11px] font-bold hover:bg-red-200"
                    >
                      Exacto
                    </button>
                  </div>

                  {/* Vuelto a devolver */}
                  <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs">
                    <span className="font-bold text-emerald-900">Vuelto a devolver:</span>
                    <span className="font-mono text-base font-extrabold text-emerald-700">
                      {formatearMoneda(vuelto)}
                    </span>
                  </div>
                </div>
              )}

              {/* B. Yape */}
              {metodoPagoSeleccionado === "yape" && (
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
                      Monto a pagar: <strong>{formatearMoneda(total)}</strong>
                    </p>
                    <p className="text-[10px] text-purple-600 italic mt-1">
                      Preparado para enlazar con pasarela QR Mercado Pago.
                    </p>
                  </div>
                </div>
              )}

              {/* C. Tarjeta POS / Tap to Pay Celular */}
              {metodoPagoSeleccionado === "pos" && (
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
                        Total: <strong className="text-blue-700">{formatearMoneda(total)}</strong>
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
                    if (!pedidoSeleccionado) {
                      toast.warning("Selecciona una mesa o comanda para emitir comprobante.");
                      return;
                    }
                    setModalComprobanteAbierto(true);
                  }}
                  disabled={!pedidoSeleccionado || procesandoVenta}
                  className="w-full bg-red-700 hover:bg-red-800 text-white font-bold text-xs h-11 rounded-xl flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <Receipt className="w-4 h-4" />
                  <span>Emitir Comprobante y Cobrar</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    setTipoComprobante("Ticket");
                    void ejecutarCobro();
                  }}
                  disabled={!pedidoSeleccionado || procesandoVenta}
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
      <Dialog open={modalComprobanteAbierto} onOpenChange={setModalComprobanteAbierto}>
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
                    setTipoComprobante("Boleta");
                    setSubTipoBoleta("simple");
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer ${
                    tipoComprobante === "Boleta"
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
                    setTipoComprobante("Factura");
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer ${
                    tipoComprobante === "Factura"
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
            {tipoComprobante === "Boleta" && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSubTipoBoleta("simple");
                    setClienteDoc("");
                    setClienteNombre("CLIENTE GENERAL");
                  }}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border cursor-pointer ${
                    subTipoBoleta === "simple"
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-slate-50 text-slate-600 border-slate-200"
                  }`}
                >
                  Sin DNI (Cliente General)
                </button>
                <button
                  type="button"
                  onClick={() => setSubTipoBoleta("dni")}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border cursor-pointer ${
                    subTipoBoleta === "dni"
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-slate-50 text-slate-600 border-slate-200"
                  }`}
                >
                  Con DNI
                </button>
              </div>
            )}

            {/* Formulario de Cliente */}
            {(tipoComprobante === "Factura" || subTipoBoleta === "dni") && (
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col gap-2.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {tipoComprobante === "Factura" ? "Número de RUC (11 dígitos):" : "Número de DNI (8 dígitos):"}
                  </label>
                  <Input
                    maxLength={tipoComprobante === "Factura" ? 11 : 8}
                    placeholder={tipoComprobante === "Factura" ? "Ej: 20601234567" : "Ej: 47829103"}
                    value={clienteDoc}
                    onChange={(e) => buscarDocumento(e.target.value)}
                    className="h-8 text-xs font-mono font-bold bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {tipoComprobante === "Factura" ? "Razón Social:" : "Nombres y Apellidos:"}
                  </label>
                  <Input
                    placeholder="Nombre del cliente o empresa"
                    value={clienteNombre}
                    onChange={(e) => setClienteNombre(e.target.value)}
                    className="h-8 text-xs bg-white"
                  />
                </div>
              </div>
            )}

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs flex justify-between font-bold">
              <span>Monto a Cobrar:</span>
              <span className="font-mono text-red-700 text-sm">{formatearMoneda(total)}</span>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalComprobanteAbierto(false)}
              className="text-xs font-semibold rounded-lg"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => void ejecutarCobro()}
              disabled={procesandoVenta}
              className="bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-lg cursor-pointer"
            >
              {procesandoVenta ? "Registrando..." : "Confirmar e Imprimir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: TICKET DE VENTA IMPRIMIBLE */}
      <Dialog open={modalTicketAbierto} onOpenChange={setModalTicketAbierto}>
        <DialogContent className="max-w-sm rounded-xl p-5 bg-white text-black font-mono">
          <div id="ticket-imprimible" className="flex flex-col gap-2 text-[11px]">
            {/* Cabecera */}
            <div className="text-center border-b border-dashed border-slate-400 pb-2">
              <h3 className="font-black text-sm uppercase tracking-wider">POLLERÍA CENTRAL</h3>
              <p className="text-[10px]">RUC: 20601234567 • LIMA, PERÚ</p>
              <p className="text-[10px]">AV. PRINCIPAL 123</p>
              <p className="font-bold text-xs mt-1 uppercase text-slate-900">
                {comprobanteEmitido?.tipo === "Factura"
                  ? "FACTURA ELECTRÓNICA"
                  : "BOLETA DE VENTA ELECTRÓNICA"}
              </p>
              <p className="text-[11px] font-bold text-red-700">{comprobanteEmitido?.codigoCompleto}</p>
            </div>

            {/* Metadatos */}
            <div className="space-y-0.5 border-b border-dashed border-slate-400 pb-2 text-[10px]">
              <p>
                FECHA: <span>{new Date().toLocaleString("es-PE")}</span>
              </p>
              <p>ORIGEN: {comprobanteEmitido?.origen}</p>
              <p>CLIENTE: {comprobanteEmitido?.cliente.nombre}</p>
              {comprobanteEmitido?.cliente.nroDoc !== "00000000" && (
                <p>DOC: {comprobanteEmitido?.cliente.nroDoc}</p>
              )}
              <p>FORMA PAGO: {comprobanteEmitido?.metodoPago.toUpperCase()}</p>
            </div>

            {/* Ítems */}
            <div className="border-b border-dashed border-slate-400 py-2 space-y-1.5">
              {comprobanteEmitido?.items.map((it, idx) => (
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
                  <span className="font-bold">{formatearMoneda(it.subTotal)}</span>
                </div>
              ))}
            </div>

            {/* Totales */}
            <div className="space-y-1 pt-1 border-b border-dashed border-slate-400 pb-2 text-[11px]">
              <div className="flex justify-between text-slate-600">
                <span>OP. GRAVADA:</span>
                <span>{formatearMoneda(comprobanteEmitido?.subtotal || 0)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>I.G.V. (18%):</span>
                <span>{formatearMoneda(comprobanteEmitido?.igv || 0)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-sm pt-1 text-slate-900">
                <span>TOTAL PAGADO:</span>
                <span>{formatearMoneda(comprobanteEmitido?.total || 0)}</span>
              </div>
              {comprobanteEmitido?.vuelto && comprobanteEmitido.vuelto > 0 ? (
                <div className="flex justify-between text-emerald-700 font-bold text-[10px] pt-1">
                  <span>VUELTO:</span>
                  <span>{formatearMoneda(comprobanteEmitido.vuelto)}</span>
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
              onClick={() => setModalTicketAbierto(false)}
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
    </div>
  );
}

export default function CajaCobroPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Cargando Caja...</div>}>
      <CajaCobroContent />
    </Suspense>
  );
}

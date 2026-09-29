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
  Utensils,
  Plus,
  Edit,
  CheckCircle2,
  Search,
  Trash2,
  Send,
  ShoppingBag,
  RefreshCw,
  Users,
  CreditCard,
  ChefHat,
  MessageSquare,
  Receipt,
  Banknote,
  QrCode,
  Smartphone,
  Printer,
  User,
  Building,
  ShieldCheck,
  LayoutGrid,
  Clock,
  CircleDollarSign,
  Menu,
  X,
  Phone,
  Calendar,
  AlertCircle,
  FileText,
  DollarSign,
  TrendingUp,
  Tag,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  listarMesas,
  listarPlatos,
  listarPedidos,
  listarTiposPago,
  crearPedido,
  editarPedido,
  actualizarEstadoPedido,
  registrarVenta,
  listarClientes,
  crearCliente,
  listarVentasDiarias,
  formatearMoneda,
  type MesaItem,
  type PlatoCarta,
  type PedidoResumen,
  type ResumenMesas,
  type ItemDetallePedido,
  type TipoPagoItem,
  type ComprobanteEmitido,
  type ClienteItem,
  type VentasDiariasResumen,
} from "@/lib/services/mesas.service";
import {
  calcularTotales,
  calcularVuelto,
  validarDocumentoCliente,
  puedeEditarPedido,
} from "@/lib/utils/ventas-helpers";

type TabTipo = "mesas" | "cobros" | "caja" | "clientes" | "facturas";

function VentasGestionMesasContent() {
  const searchParams = useSearchParams();

  // Control de menú lateral en dispositivos móviles (smartphones/tablets)
  const [menuMovilAbierto, setMenuMovilAbierto] = useState<boolean>(false);

  // Pestaña principal: "mesas" | "cobros" | "caja" | "clientes" | "facturas"
  const [tabActiva, setTabActiva] = useState<TabTipo>("mesas");

  // Sincronizar pestaña activa con parámetro de URL (?tab=...)
  useEffect(() => {
    const tabParam = searchParams.get("tab") as TabTipo | null;
    if (tabParam && ["mesas", "cobros", "caja", "clientes", "facturas"].includes(tabParam)) {
      setTabActiva(tabParam);
    }
  }, [searchParams]);

  // Reloj en tiempo real
  const [horaActual, setHoraActual] = useState<string>("");
  useEffect(() => {
    const actualizar = () => {
      setHoraActual(
        new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    };
    actualizar();
    const t = setInterval(actualizar, 1000);
    return () => clearInterval(t);
  }, []);

  // ---------------------------------------------------------------------------
  // DATOS GLOBALES
  // ---------------------------------------------------------------------------
  const [mesas, setMesas] = useState<MesaItem[]>([]);
  const [resumen, setResumen] = useState<ResumenMesas>({ total: 0, disponibles: 0, ocupadas: 0 });
  const [takeoutPedidos, setTakeoutPedidos] = useState<PedidoResumen[]>([]);
  const [todosPedidos, setTodosPedidos] = useState<PedidoResumen[]>([]);
  const [platos, setPlatos] = useState<PlatoCarta[]>([]);
  const [tiposPago, setTiposPago] = useState<TipoPagoItem[]>([]);
  const [clientes, setClientes] = useState<ClienteItem[]>([]);
  const [comprobantesVenta, setComprobantesVenta] = useState<ComprobanteEmitido[]>([]);
  const [resumenDiario, setResumenDiario] = useState<VentasDiariasResumen>({
    totalRecaudado: 0,
    cantidadVentas: 0,
    desgloseMetodos: { efectivo: 0, yape: 0, tarjeta: 0, otros: 0 },
    desgloseComprobantes: { boletas: 0, facturas: 0, tickets: 0 },
  });
  const [cargando, setCargando] = useState<boolean>(true);

  // Filtro de mesas
  const [filtroMesa, setFiltroMesa] = useState<"todas" | "disponibles" | "ocupadas">("todas");

  // Filtro de fecha para ventas diarias
  const [filtroFechaVentas, setFiltroFechaVentas] = useState<string>("hoy");

  // Búsqueda de clientes
  const [busquedaCliente, setBusquedaCliente] = useState<string>("");

  // Carga general de datos desde la API
  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);
      const [mesasRes, takeoutRes, pedidosRes, platosRes, tiposRes, clientesRes, ventasRes] = await Promise.all([
        listarMesas(),
        listarPedidos({ tipo: "Llevar", estado: "activos" }),
        listarPedidos(),
        listarPlatos(),
        listarTiposPago(),
        listarClientes(),
        listarVentasDiarias(filtroFechaVentas),
      ]);
      setMesas(mesasRes.mesas);
      setResumen(mesasRes.resumen);
      setTakeoutPedidos(takeoutRes);
      setTodosPedidos(pedidosRes);
      setPlatos(platosRes);
      setTiposPago(tiposRes);
      setClientes(clientesRes);
      setComprobantesVenta(ventasRes.data);
      setResumenDiario(ventasRes.resumenDiario);
    } catch (err: any) {
      toast.error(err.message || "Error al conectar con la base de datos.");
    } finally {
      setCargando(false);
    }
  }, [filtroFechaVentas]);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  // ---------------------------------------------------------------------------
  // ESTADO MODAL COMANDA (TOMAR / EDITAR PEDIDO)
  // ---------------------------------------------------------------------------
  const [modalPedidoAbierto, setModalPedidoAbierto] = useState<boolean>(false);
  const [esEdicion, setEsEdicion] = useState<boolean>(false);
  const [pedidoEdicionId, setPedidoEdicionId] = useState<number | null>(null);
  const [mesaSeleccionada, setMesaSeleccionada] = useState<MesaItem | null>(null);
  const [esParaLlevar, setEsParaLlevar] = useState<boolean>(false);
  const [observacionMesa, setObservacionMesa] = useState<string>("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>("todos");
  const [busquedaPlato, setBusquedaPlato] = useState<string>("");
  const [itemsComanda, setItemsComanda] = useState<
    Array<{ idPlato: number; nombre: string; precio: number; cantidad: number; observaciones: string }>
  >([]);
  const [guardandoPedido, setGuardandoPedido] = useState<boolean>(false);

  // Modal para agregar observación a un plato de la comanda
  const [modalObsAbierto, setModalObsAbierto] = useState<boolean>(false);
  const [obsIndex, setObsIndex] = useState<number | null>(null);
  const [obsTexto, setObsTexto] = useState<string>("");

  // ---------------------------------------------------------------------------
  // ESTADO CAJA Y COBRO EN VENTANILLA
  // ---------------------------------------------------------------------------
  const [pedidoACobrar, setPedidoACobrar] = useState<PedidoResumen | null>(null);
  const [origenCobro, setOrigenCobro] = useState<string>("");
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "yape" | "pos">("efectivo");
  const [montoEntregado, setMontoEntregado] = useState<string>("");
  const [modalComprobanteAbierto, setModalComprobanteAbierto] = useState<boolean>(false);
  const [tipoComprobante, setTipoComprobante] = useState<"Boleta" | "Factura" | "Ticket">("Boleta");
  const [clienteDoc, setClienteDoc] = useState<string>("");
  const [clienteNombre, setClienteNombre] = useState<string>("");
  const [clienteTelefono, setClienteTelefono] = useState<string>("");
  const [procesandoVenta, setProcesandoVenta] = useState<boolean>(false);

  // ---------------------------------------------------------------------------
  // ESTADO COBRO MÓVIL / MOZO (COBRO CON CELULAR / TAP TO PAY / YAPE)
  // ---------------------------------------------------------------------------
  const [modalCobroMozoAbierto, setModalCobroMozoAbierto] = useState<boolean>(false);
  const [pedidoCobroMozo, setPedidoCobroMozo] = useState<PedidoResumen | null>(null);
  const [metodoPagoMozo, setMetodoPagoMozo] = useState<"efectivo" | "yape" | "pos">("pos");
  const [montoEntregadoMozo, setMontoEntregadoMozo] = useState<string>("");
  const [procesandoCobroMozo, setProcesandoCobroMozo] = useState<boolean>(false);
  const [tapToPayDetectado, setTapToPayDetectado] = useState<boolean>(false);

  // ---------------------------------------------------------------------------
  // ESTADO MODAL REGISTRO DE CLIENTE
  // ---------------------------------------------------------------------------
  const [modalNuevoClienteAbierto, setModalNuevoClienteAbierto] = useState<boolean>(false);
  const [nuevoClienteTipo, setNuevoClienteTipo] = useState<"Natural" | "Juridico">("Natural");
  const [nuevoClienteDoc, setNuevoClienteDoc] = useState<string>("");
  const [nuevoClienteNombre, setNuevoClienteNombre] = useState<string>("");
  const [nuevoClienteApellido, setNuevoClienteApellido] = useState<string>("");
  const [nuevoClienteTelefono, setNuevoClienteTelefono] = useState<string>("");
  const [guardandoCliente, setGuardandoCliente] = useState<boolean>(false);

  // Consulta de DNI y RUC con json.pe
  const [consultandoDoc, setConsultandoDoc] = useState<boolean>(false);

  const consultarDocIdentidad = async (
    tipo: "dni" | "ruc",
    numero: string,
    destino: "caja" | "nuevo_cliente"
  ) => {
    const num = (numero || "").trim();
    if (!num) {
      toast.warning("Ingrese un número de documento para consultar.");
      return;
    }

    try {
      setConsultandoDoc(true);
      const res = await fetch(`/api/consulta-documento?tipo=${tipo}&numero=${encodeURIComponent(num)}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "No se pudo obtener información del documento.");
      }

      const data = json.data;
      if (destino === "caja") {
        setClienteNombre(data.razonSocial || data.nombreCompleto);
        toast.success(`Datos RENIEC/SUNAT: ${data.razonSocial || data.nombreCompleto}`);
      } else {
        if (tipo === "dni") {
          setNuevoClienteNombre(data.nombres || data.nombreCompleto);
          setNuevoClienteApellido(
            `${data.apellidoPaterno || ""} ${data.apellidoMaterno || ""}`.trim()
          );
        } else {
          setNuevoClienteNombre(data.razonSocial || data.nombreCompleto);
        }
        toast.success(`Datos encontrados: ${data.razonSocial || data.nombreCompleto}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Error al consultar documento.");
    } finally {
      setConsultandoDoc(false);
    }
  };

  // ---------------------------------------------------------------------------
  // ESTADO TICKET IMPRIMIBLE (80MM TÉRMICO)
  // ---------------------------------------------------------------------------
  const [modalTicketAbierto, setModalTicketAbierto] = useState<boolean>(false);
  const [comprobanteEmitido, setComprobanteEmitido] = useState<ComprobanteEmitido | null>(null);

  // ---------------------------------------------------------------------------
  // FILTRADOS Y CÁLCULOS
  // ---------------------------------------------------------------------------
  const mesasFiltradas = useMemo(() => {
    if (filtroMesa === "disponibles") return mesas.filter((m) => !m.ocupada);
    if (filtroMesa === "ocupadas") return mesas.filter((m) => m.ocupada);
    return mesas;
  }, [mesas, filtroMesa]);

  const platosFiltrados = useMemo(() => {
    return platos.filter((p) => {
      const matchCat = categoriaSeleccionada === "todos" || p.categoria === categoriaSeleccionada;
      const matchText =
        !busquedaPlato.trim() ||
        p.nombre.toLowerCase().includes(busquedaPlato.toLowerCase()) ||
        p.descripcion.toLowerCase().includes(busquedaPlato.toLowerCase());
      return matchCat && matchText;
    });
  }, [platos, categoriaSeleccionada, busquedaPlato]);

  const totalComanda = useMemo(() => {
    return itemsComanda.reduce((sum, it) => sum + it.precio * it.cantidad, 0);
  }, [itemsComanda]);

  // Cálculos para cobro en Ventanilla
  const totalCobroVentanilla = pedidoACobrar ? pedidoACobrar.total : 0;
  const desgloseVentanilla = useMemo(() => {
    return calcularTotales(
      pedidoACobrar ? pedidoACobrar.items.map((i) => ({ cantidad: i.cantidad, precioUnitario: i.precioUnitario })) : []
    );
  }, [pedidoACobrar]);

  const vueltoVentanilla = useMemo(() => {
    const entregado = Number(montoEntregado);
    if (!entregado || entregado < totalCobroVentanilla) return 0;
    return Math.round((entregado - totalCobroVentanilla) * 100) / 100;
  }, [montoEntregado, totalCobroVentanilla]);

  // Cálculos para cobro móvil del Mozo
  const totalCobroMozo = pedidoCobroMozo ? pedidoCobroMozo.total : 0;
  const vueltoMozo = useMemo(() => {
    const entregado = Number(montoEntregadoMozo);
    if (!entregado || entregado < totalCobroMozo) return 0;
    return Math.round((entregado - totalCobroMozo) * 100) / 100;
  }, [montoEntregadoMozo, totalCobroMozo]);

  // Listado de cobros no cobrados (comandas activas de mesas ocupadas + comandas activas para llevar)
  const cobrosNoCobrados = useMemo(() => {
    const pendientes: Array<{
      idPedido: number;
      codigo: string;
      tipo: "Mesa" | "Llevar";
      identificador: string;
      fecha: string;
      estadoCocina: string;
      items: ItemDetallePedido[];
      total: number;
      editable: boolean;
      mesaObj?: MesaItem;
      pedidoObj: PedidoResumen;
    }> = [];

    // Mesas ocupadas
    for (const m of mesas) {
      if (m.ocupada && m.pedidoActivo) {
        const pedObj: PedidoResumen = {
          id: m.pedidoActivo.id,
          idPedidoMesa: m.pedidoActivo.idPedidoMesa,
          codigo: m.pedidoActivo.codigo,
          tipoPedido: "Mesa",
          fecha: m.pedidoActivo.fecha,
          estado: m.pedidoActivo.estado,
          mesa: { id: m.id, numero: m.numero },
          observacion: m.pedidoActivo.observacionMesa,
          items: m.pedidoActivo.items,
          total: m.pedidoActivo.total,
          editable: m.pedidoActivo.editable,
        };

        pendientes.push({
          idPedido: m.pedidoActivo.id,
          codigo: m.pedidoActivo.codigo,
          tipo: "Mesa",
          identificador: `Mesa ${m.numero}`,
          fecha: m.pedidoActivo.fecha,
          estadoCocina: m.pedidoActivo.estado,
          items: m.pedidoActivo.items,
          total: m.pedidoActivo.total,
          editable: m.pedidoActivo.editable,
          mesaObj: m,
          pedidoObj: pedObj,
        });
      }
    }

    // Pedidos para llevar que aún no se cobraron
    for (const p of takeoutPedidos) {
      if (p.estado !== "Cerrado" && p.estado !== "Cancelado") {
        pendientes.push({
          idPedido: p.id,
          codigo: p.codigo,
          tipo: "Llevar",
          identificador: `Para Llevar (${p.codigo})`,
          fecha: p.fecha,
          estadoCocina: p.estado,
          items: p.items,
          total: p.total,
          editable: p.editable,
          pedidoObj: p,
        });
      }
    }

    return pendientes;
  }, [mesas, takeoutPedidos]);

  const totalPorCobrar = useMemo(() => {
    return cobrosNoCobrados.reduce((sum, c) => sum + c.total, 0);
  }, [cobrosNoCobrados]);

  // Clientes filtrados por búsqueda
  const clientesFiltrados = useMemo(() => {
    if (!busquedaCliente.trim()) return clientes;
    const q = busquedaCliente.toLowerCase();
    return clientes.filter(
      (c) =>
        c.nroDoc.toLowerCase().includes(q) ||
        c.nombre.toLowerCase().includes(q) ||
        c.apellido.toLowerCase().includes(q) ||
        c.nombreCompleto.toLowerCase().includes(q)
    );
  }, [clientes, busquedaCliente]);

  // ---------------------------------------------------------------------------
  // ACCIONES COMANDA
  // ---------------------------------------------------------------------------
  const abrirTomarPedidoMesa = (mesa: MesaItem) => {
    if (mesa.ocupada) {
      toast.info(`La Mesa ${mesa.numero} ya tiene un pedido en curso.`);
      return;
    }
    setEsEdicion(false);
    setPedidoEdicionId(null);
    setMesaSeleccionada(mesa);
    setEsParaLlevar(false);
    setObservacionMesa("");
    setItemsComanda([]);
    setCategoriaSeleccionada("todos");
    setBusquedaPlato("");
    setModalPedidoAbierto(true);
  };

  const abrirTomarPedidoLlevar = () => {
    setEsEdicion(false);
    setPedidoEdicionId(null);
    setMesaSeleccionada(null);
    setEsParaLlevar(true);
    setObservacionMesa("");
    setItemsComanda([]);
    setCategoriaSeleccionada("todos");
    setBusquedaPlato("");
    setModalPedidoAbierto(true);
  };

  const abrirEditarPedido = (pedido: {
    id: number;
    observacionMesa?: string;
    observacion?: string;
    items: ItemDetallePedido[];
    tipoPedido: string;
    estado?: string;
  }) => {
    if (pedido.estado && !puedeEditarPedido(pedido.estado)) {
      toast.warning("El pedido no puede ser modificado porque ya fue servido o cerrado.");
      return;
    }
    setEsEdicion(true);
    setPedidoEdicionId(pedido.id);
    setEsParaLlevar(pedido.tipoPedido === "Llevar");
    setObservacionMesa(pedido.observacionMesa || pedido.observacion || "");
    setItemsComanda(
      pedido.items.map((it) => ({
        idPlato: it.idPlato,
        nombre: it.nombre,
        precio: it.precioUnitario,
        cantidad: it.cantidad,
        observaciones: it.observaciones || "",
      }))
    );
    setCategoriaSeleccionada("todos");
    setBusquedaPlato("");
    setModalPedidoAbierto(true);
  };

  const agregarItemComanda = (plato: PlatoCarta) => {
    setItemsComanda((prev) => {
      const idx = prev.findIndex((it) => it.idPlato === plato.id);
      if (idx >= 0) {
        const clon = [...prev];
        clon[idx].cantidad += 1;
        return clon;
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
  };

  const cambiarCantidadItem = (index: number, delta: number) => {
    setItemsComanda((prev) => {
      const clon = [...prev];
      const nueva = clon[index].cantidad + delta;
      if (nueva <= 0) {
        return clon.filter((_, i) => i !== index);
      }
      clon[index].cantidad = nueva;
      return clon;
    });
  };

  const eliminarItem = (index: number) => {
    setItemsComanda((prev) => prev.filter((_, i) => i !== index));
  };

  const guardarPedido = async () => {
    if (itemsComanda.length === 0) {
      toast.warning("Debe agregar al menos un plato a la comanda.");
      return;
    }

    try {
      setGuardandoPedido(true);
      if (esEdicion && pedidoEdicionId) {
        await editarPedido(pedidoEdicionId, {
          observacion: observacionMesa,
          items: itemsComanda.map((it) => ({
            id_plato: it.idPlato,
            cantidad: it.cantidad,
            observaciones: it.observaciones,
          })),
        });
        toast.success("Comanda actualizada correctamente.");
      } else {
        await crearPedido({
          tipo_pedido: esParaLlevar ? "Llevar" : "Mesa",
          id_mesa: esParaLlevar ? undefined : mesaSeleccionada?.id,
          observacion: observacionMesa,
          items: itemsComanda.map((it) => ({
            id_plato: it.idPlato,
            cantidad: it.cantidad,
            observaciones: it.observaciones,
          })),
        });
        toast.success(
          esParaLlevar
            ? "Pedido para llevar registrado con éxito."
            : `Mesa ${mesaSeleccionada?.numero} ocupada. Comanda enviada a cocina.`
        );
      }

      setModalPedidoAbierto(false);
      await cargarDatos();
    } catch (err: any) {
      toast.error(err.message || "Error al procesar el pedido.");
    } finally {
      setGuardandoPedido(false);
    }
  };

  const cambiarEstadoCocina = async (pedidoId: number, nuevoEstado: "Preparando" | "Servido") => {
    try {
      await actualizarEstadoPedido(pedidoId, nuevoEstado);
      toast.success(`Pedido actualizado a estado: ${nuevoEstado}`);
      await cargarDatos();
    } catch (err: any) {
      toast.error(err.message || "No se pudo actualizar el estado.");
    }
  };

  // ---------------------------------------------------------------------------
  // ACCIONES COBRO EN VENTANILLA / CAJA
  // ---------------------------------------------------------------------------
  const irACobrarVentanilla = (pedido: PedidoResumen, origen: string) => {
    setPedidoACobrar(pedido);
    setOrigenCobro(origen);
    setMontoEntregado("");
    setTabActiva("caja");
  };

  const ejecutarCobroVentanilla = async () => {
    if (!pedidoACobrar) {
      toast.warning("Selecciona una comanda a cobrar.");
      return;
    }

    const tpObj = tiposPago.find((t) => {
      const n = t.nombre.toLowerCase();
      if (metodoPago === "efectivo") return n.includes("efectivo");
      if (metodoPago === "yape") return n.includes("yape");
      if (metodoPago === "pos") return n.includes("pos") || n.includes("tarjeta");
      return false;
    });

    const idTipoPago = tpObj?.id || (tiposPago[0]?.id ?? 1);

    if (metodoPago === "efectivo" && montoEntregado) {
      const validacionVuelto = calcularVuelto(totalCobroVentanilla, Number(montoEntregado));
      if (!validacionVuelto.esValido) {
        toast.error(validacionVuelto.error || "Monto en efectivo insuficiente.");
        return;
      }
    }

    // Validar documento si se ingresó
    if (clienteDoc.trim()) {
      const tipoPer = tipoComprobante === "Factura" ? "Juridico" : "Natural";
      const validacionDoc = validarDocumentoCliente(tipoPer, clienteDoc.trim());
      if (!validacionDoc.esValido) {
        toast.error(validacionDoc.error || "Documento de cliente no válido.");
        return;
      }
    }

    try {
      setProcesandoVenta(true);
      const res = await registrarVenta({
        id_pedido: pedidoACobrar.id,
        id_tipo_pago: idTipoPago,
        tipo_comprobante: tipoComprobante,
        cliente: {
          nro_doc: clienteDoc.trim() || undefined,
          nombre: clienteNombre.trim() || (tipoComprobante === "Factura" ? "EMPRESA S.A.C." : "CLIENTE GENERAL"),
          tipo_persona: tipoComprobante === "Factura" ? "Juridico" : "Natural",
          telefono: clienteTelefono.trim() || undefined,
        },
        monto_recibido: metodoPago === "efectivo" && montoEntregado ? Number(montoEntregado) : totalCobroVentanilla,
        pasarela: {
          proveedor: "mercado_pago",
          modo: metodoPago === "pos" ? "tap_to_pay" : metodoPago === "yape" ? "qr" : "manual",
        },
      });

      toast.success(res.mensaje);
      setComprobanteEmitido(res.comprobante);
      setModalTicketAbierto(true);

      setPedidoACobrar(null);
      setOrigenCobro("");
      setMontoEntregado("");
      setClienteDoc("");
      setClienteNombre("");
      setClienteTelefono("");
      await cargarDatos();
    } catch (err: any) {
      toast.error(err.message || "Error al procesar el cobro en ventanilla.");
    } finally {
      setProcesandoVenta(false);
    }
  };

  // ---------------------------------------------------------------------------
  // ACCIONES COBRO MÓVIL / MOZO (CELULAR / TAP TO PAY / YAPE / EFECTIVO)
  // ---------------------------------------------------------------------------
  const abrirCobroMozo = (pedido: PedidoResumen) => {
    setPedidoCobroMozo(pedido);
    setMetodoPagoMozo("pos");
    setMontoEntregadoMozo("");
    setTapToPayDetectado(false);
    setModalCobroMozoAbierto(true);
  };

  const ejecutarCobroMozo = async () => {
    if (!pedidoCobroMozo) return;

    const tpObj = tiposPago.find((t) => {
      const n = t.nombre.toLowerCase();
      if (metodoPagoMozo === "efectivo") return n.includes("efectivo");
      if (metodoPagoMozo === "yape") return n.includes("yape");
      if (metodoPagoMozo === "pos") return n.includes("pos") || n.includes("tarjeta");
      return false;
    });

    const idTipoPago = tpObj?.id || (tiposPago[0]?.id ?? 1);

    if (metodoPagoMozo === "efectivo" && montoEntregadoMozo) {
      const validacionVuelto = calcularVuelto(totalCobroMozo, Number(montoEntregadoMozo));
      if (!validacionVuelto.esValido) {
        toast.error(validacionVuelto.error || "Monto recibido insuficiente.");
        return;
      }
    }

    try {
      setProcesandoCobroMozo(true);
      const res = await registrarVenta({
        id_pedido: pedidoCobroMozo.id,
        id_tipo_pago: idTipoPago,
        tipo_comprobante: "Ticket",
        cliente: {
          nro_doc: "00000000",
          nombre: "CLIENTE SALÓN",
          tipo_persona: "Natural",
        },
        monto_recibido: metodoPagoMozo === "efectivo" && montoEntregadoMozo ? Number(montoEntregadoMozo) : totalCobroMozo,
        pasarela: {
          proveedor: "mercado_pago",
          modo: metodoPagoMozo === "pos" ? "tap_to_pay" : metodoPagoMozo === "yape" ? "qr" : "manual",
        },
      });

      toast.success(`¡Cobro realizado por el Mozo! Mesa liberada con éxito.`);
      setComprobanteEmitido(res.comprobante);
      setModalCobroMozoAbierto(false);
      setModalTicketAbierto(true);
      await cargarDatos();
    } catch (err: any) {
      toast.error(err.message || "Error al procesar el cobro móvil.");
    } finally {
      setProcesandoCobroMozo(false);
    }
  };

  // ---------------------------------------------------------------------------
  // ACCIONES CLIENTE
  // ---------------------------------------------------------------------------
  const registrarNuevoCliente = async () => {
    if (!nuevoClienteNombre.trim()) {
      toast.warning("El nombre o razón social es obligatorio.");
      return;
    }

    const val = validarDocumentoCliente(nuevoClienteTipo, nuevoClienteDoc.trim());
    if (!val.esValido) {
      toast.error(val.error || "Documento inválido.");
      return;
    }

    try {
      setGuardandoCliente(true);
      const res = await crearCliente({
        tipo_persona: nuevoClienteTipo,
        nro_doc: nuevoClienteDoc.trim() || undefined,
        nombre: nuevoClienteNombre.trim(),
        apellido: nuevoClienteTipo === "Natural" ? nuevoClienteApellido.trim() : undefined,
        telefono: nuevoClienteTelefono.trim() || undefined,
      });

      toast.success(res.mensaje);
      setModalNuevoClienteAbierto(false);
      setNuevoClienteDoc("");
      setNuevoClienteNombre("");
      setNuevoClienteApellido("");
      setNuevoClienteTelefono("");
      await cargarDatos();
    } catch (err: any) {
      toast.error(err.message || "No se pudo registrar el cliente.");
    } finally {
      setGuardandoCliente(false);
    }
  };

  const seleccionarClienteParaVenta = (cli: ClienteItem) => {
    setClienteDoc(cli.nroDoc);
    setClienteNombre(cli.nombreCompleto);
    setClienteTelefono(cli.telefono);
    setTipoComprobante(cli.tipoPersona === "Juridico" ? "Factura" : "Boleta");
    setTabActiva("caja");
    toast.info(`Cliente ${cli.nombreCompleto} seleccionado para facturación.`);
  };

  return (
    <div className="flex bg-slate-50 text-sm text-slate-900 antialiased min-h-screen">
      {/* Sidebar Fijo en Desktop y Desplegable en Móvil */}
      <Sidebar mobileOpen={menuMovilAbierto} onCloseMobile={() => setMenuMovilAbierto(false)} />

      {/* Contenedor Principal (pl-0 en móviles, pl-64 en desktop) */}
      <div className="pl-0 md:pl-64 min-h-screen flex flex-col bg-slate-50 w-full transition-all duration-300">
        {/* Header Superior Responsivo */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            {/* Botón Hamburguesa para Móviles */}
            <button
              type="button"
              onClick={() => setMenuMovilAbierto(true)}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              aria-label="Abrir Menú ERP"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-red-700 flex items-center justify-center text-white shadow-xs shrink-0">
              <Utensils className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                  Módulo de Ventas &amp; Salón
                </h1>
                <Badge className="hidden sm:inline-flex bg-red-100 text-red-800 text-[10px] font-bold border-none">
                  ERP Pollería
                </Badge>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-1">
                Mesas, Clientes, Ventas Diarias, Cobro Mozo &amp; Ventanilla
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              onClick={abrirTomarPedidoLlevar}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-8 sm:h-9 px-2.5 sm:px-4 rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">+ Para Llevar</span>
              <span className="sm:hidden">+ Llevar</span>
            </Button>

            <div className="hidden lg:flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200 text-xs font-mono font-semibold text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{horaActual || "12:00:00"}</span>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => void cargarDatos()}
              title="Refrescar datos"
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${cargando ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </header>

        {/* Barra de Navegación por Pestañas del Módulo Ventas (Scroll horizontal en móvil) */}
        <div className="px-4 sm:px-6 pt-3 bg-white border-b border-slate-200 flex items-center overflow-x-auto no-scrollbar gap-1 sm:gap-2">
          {/* Pestaña 1: Mesas y Salón */}
          <button
            type="button"
            onClick={() => setTabActiva("mesas")}
            className={`px-3 sm:px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-1.5 sm:gap-2 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              tabActiva === "mesas"
                ? "border-red-700 text-red-700 bg-red-50/60"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <LayoutGrid className="w-4 h-4 shrink-0" />
            <span>Salón de Mesas ({resumen.ocupadas}/{resumen.total})</span>
          </button>

          {/* Pestaña 2: Cobros No Cobrados */}
          <button
            type="button"
            onClick={() => setTabActiva("cobros")}
            className={`px-3 sm:px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-1.5 sm:gap-2 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              tabActiva === "cobros"
                ? "border-red-700 text-red-700 bg-red-50/60"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Cobros No Cobrados ({cobrosNoCobrados.length})</span>
          </button>

          {/* Pestaña 3: Caja y Cobro en Ventanilla */}
          <button
            type="button"
            onClick={() => setTabActiva("caja")}
            className={`px-3 sm:px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-1.5 sm:gap-2 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              tabActiva === "caja"
                ? "border-red-700 text-red-700 bg-red-50/60"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <CircleDollarSign className="w-4 h-4 shrink-0" />
            <span>Caja y Ventanilla {pedidoACobrar ? `(${origenCobro})` : ""}</span>
          </button>

          {/* Pestaña 4: Clientes */}
          <button
            type="button"
            onClick={() => setTabActiva("clientes")}
            className={`px-3 sm:px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-1.5 sm:gap-2 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              tabActiva === "clientes"
                ? "border-red-700 text-red-700 bg-red-50/60"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span>Clientes ({clientes.length})</span>
          </button>

          {/* Pestaña 5: Ventas Diarias & Facturas */}
          <button
            type="button"
            onClick={() => setTabActiva("facturas")}
            className={`px-3 sm:px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-1.5 sm:gap-2 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              tabActiva === "facturas"
                ? "border-red-700 text-red-700 bg-red-50/60"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Receipt className="w-4 h-4 shrink-0" />
            <span>Ventas Diarias &amp; Facturas ({comprobantesVenta.length})</span>
          </button>
        </div>

        {/* =================================================================== */}
        {/* PESTAÑA 1: SALÓN DE MESAS Y PEDIDOS */}
        {/* =================================================================== */}
        {tabActiva === "mesas" && (
          <main className="flex-1 p-3 sm:p-6 flex flex-col gap-5">
            {/* Barra de Filtros y Leyenda */}
            <Card className="bg-white rounded-xl shadow-xs border border-slate-200 p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-700 mr-1">Filtrar Salón:</span>
                <Button
                  size="sm"
                  variant={filtroMesa === "todas" ? "default" : "outline"}
                  onClick={() => setFiltroMesa("todas")}
                  className={`text-xs font-bold h-8 rounded-lg cursor-pointer ${
                    filtroMesa === "todas" ? "bg-red-700 hover:bg-red-800 text-white" : ""
                  }`}
                >
                  Todas ({resumen.total})
                </Button>
                <Button
                  size="sm"
                  variant={filtroMesa === "disponibles" ? "default" : "outline"}
                  onClick={() => setFiltroMesa("disponibles")}
                  className={`text-xs font-bold h-8 rounded-lg cursor-pointer ${
                    filtroMesa === "disponibles" ? "bg-red-700 hover:bg-red-800 text-white" : ""
                  }`}
                >
                  Disponibles ({resumen.disponibles})
                </Button>
                <Button
                  size="sm"
                  variant={filtroMesa === "ocupadas" ? "default" : "outline"}
                  onClick={() => setFiltroMesa("ocupadas")}
                  className={`text-xs font-bold h-8 rounded-lg cursor-pointer ${
                    filtroMesa === "ocupadas" ? "bg-red-700 hover:bg-red-800 text-white" : ""
                  }`}
                >
                  Ocupadas ({resumen.ocupadas})
                </Button>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 text-xs flex-wrap">
                <span className="font-bold text-slate-500">Cocina:</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span> Recibido
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-spin"></span> Preparando
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Servido
                </span>
              </div>
            </Card>

            {/* Grid Responsivo de Mesas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {mesasFiltradas.map((mesa) => {
                const tienePedido = mesa.ocupada && mesa.pedidoActivo;
                const pedido = mesa.pedidoActivo;

                return (
                  <Card
                    key={mesa.id}
                    className={`rounded-2xl transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                      mesa.ocupada
                        ? "border-red-200 bg-white shadow-sm ring-1 ring-red-100"
                        : "border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md cursor-pointer"
                    }`}
                  >
                    <div>
                      {/* Cabecera de la Mesa */}
                      <div
                        className={`p-3.5 flex items-center justify-between border-b ${
                          mesa.ocupada
                            ? "bg-red-50/80 border-red-100"
                            : "bg-emerald-50/50 border-slate-100"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-3 h-3 rounded-full ${
                              mesa.ocupada ? "bg-red-600 animate-pulse" : "bg-emerald-500"
                            }`}
                          />
                          <h3 className="font-bold text-sm sm:text-base text-slate-900">
                            Mesa {mesa.numero}
                          </h3>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="secondary"
                            className="bg-white/80 text-[10px] font-semibold text-slate-600 border border-slate-200"
                          >
                            <Users className="w-3 h-3 mr-1 text-slate-400" />
                            Aforo {mesa.aforo}
                          </Badge>
                          <Badge
                            className={`text-[10px] font-bold border-none ${
                              mesa.ocupada
                                ? "bg-red-600 text-white"
                                : "bg-emerald-600 text-white"
                            }`}
                          >
                            {mesa.ocupada ? "Ocupada" : "Libre"}
                          </Badge>
                        </div>
                      </div>

                      {/* Cuerpo de la Mesa */}
                      <div className="p-3.5">
                        {tienePedido && pedido ? (
                          <div className="flex flex-col gap-2.5">
                            {/* Meta del pedido */}
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span className="font-mono font-semibold text-slate-700">
                                {pedido.codigo}
                              </span>
                              <span className="flex items-center gap-1 text-[11px]">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {new Date(pedido.fecha).toLocaleTimeString("es-PE", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>

                            {/* Estado de cocina interactivo */}
                            <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                              <div className="flex items-center gap-1.5">
                                <ChefHat className="w-4 h-4 text-slate-500" />
                                <span className="text-xs font-semibold text-slate-700">
                                  Cocina:
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                {pedido.estado === "Recibido" && (
                                  <button
                                    onClick={() => cambiarEstadoCocina(pedido.id, "Preparando")}
                                    className="bg-blue-100 hover:bg-blue-200 text-blue-800 text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors cursor-pointer"
                                    title="Pasar a Preparando"
                                  >
                                    Recibido → Iniciar
                                  </button>
                                )}
                                {pedido.estado === "Preparando" && (
                                  <button
                                    onClick={() => cambiarEstadoCocina(pedido.id, "Servido")}
                                    className="bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors cursor-pointer"
                                    title="Marcar como Servido"
                                  >
                                    Preparando → Servir
                                  </button>
                                )}
                                {pedido.estado === "Servido" && (
                                  <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                                    ✓ Servido en Mesa
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Observación de la mesa */}
                            {pedido.observacionMesa && (
                              <p className="text-[11px] text-amber-800 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200/60 italic line-clamp-1">
                                💬 &quot;{pedido.observacionMesa}&quot;
                              </p>
                            )}

                            {/* Detalle rápido de platos */}
                            <div className="bg-slate-50 rounded-xl p-2.5 max-h-32 overflow-y-auto border border-slate-100 flex flex-col gap-1">
                              {pedido.items.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-xs text-slate-700 py-0.5 border-b border-slate-200/50 last:border-none"
                                >
                                  <span className="line-clamp-1">
                                    <strong className="text-red-700 mr-1.5 font-mono">
                                      {item.cantidad}x
                                    </strong>
                                    {item.nombre}
                                  </span>
                                  <span className="font-semibold shrink-0 ml-2">
                                    S/ {item.subTotal.toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Total Consumido */}
                            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                              <span className="text-xs font-bold text-slate-600">Total Cuenta:</span>
                              <span className="text-base font-extrabold text-red-700">
                                {formatearMoneda(pedido.total)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => abrirTomarPedidoMesa(mesa)}
                            className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-emerald-700 transition-colors"
                          >
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                              <Plus className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-bold text-slate-600">
                              Mesa Disponible
                            </span>
                            <span className="text-[11px] text-slate-400">
                              Toca para tomar comanda
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Botones de Acción al pie de la tarjeta */}
                    <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex flex-col gap-2">
                      {mesa.ocupada && pedido ? (
                        <>
                          {/* Botón para Cobro Móvil desde el Mozo */}
                          <Button
                            onClick={() =>
                              abrirCobroMozo({
                                id: pedido.id,
                                idPedidoMesa: pedido.idPedidoMesa,
                                codigo: pedido.codigo,
                                tipoPedido: "Mesa",
                                fecha: pedido.fecha,
                                estado: pedido.estado,
                                mesa: { id: mesa.id, numero: mesa.numero },
                                observacion: pedido.observacionMesa,
                                items: pedido.items,
                                total: pedido.total,
                                editable: pedido.editable,
                              })
                            }
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 rounded-xl flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <Smartphone className="w-4 h-4" />
                            <span>Cobrar en Mesa (Mozo)</span>
                          </Button>

                          <div className="grid grid-cols-2 gap-2">
                            {/* Modificar Comanda */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                abrirEditarPedido({
                                  id: pedido.id,
                                  observacionMesa: pedido.observacionMesa,
                                  items: pedido.items,
                                  tipoPedido: "Mesa",
                                  estado: pedido.estado,
                                })
                              }
                              disabled={!pedido.editable}
                              className="text-xs font-semibold h-8 rounded-lg border-slate-300 cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5 mr-1" />
                              Modificar
                            </Button>

                            {/* Enviar a Cobro en Ventanilla */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                irACobrarVentanilla(
                                  {
                                    id: pedido.id,
                                    idPedidoMesa: pedido.idPedidoMesa,
                                    codigo: pedido.codigo,
                                    tipoPedido: "Mesa",
                                    fecha: pedido.fecha,
                                    estado: pedido.estado,
                                    mesa: { id: mesa.id, numero: mesa.numero },
                                    observacion: pedido.observacionMesa,
                                    items: pedido.items,
                                    total: pedido.total,
                                    editable: pedido.editable,
                                  },
                                  `Mesa ${mesa.numero}`
                                )
                              }
                              className="text-xs font-semibold h-8 rounded-lg border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                              <Receipt className="w-3.5 h-3.5 mr-1 text-slate-500" />
                              A Ventanilla
                            </Button>
                          </div>
                        </>
                      ) : (
                        <Button
                          onClick={() => abrirTomarPedidoMesa(mesa)}
                          className="w-full bg-red-700 hover:bg-red-800 text-white font-bold text-xs h-8 rounded-xl flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Tomar Pedido</span>
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </main>
        )}

        {/* =================================================================== */}
        {/* PESTAÑA 2: COBROS NO COBRADOS (PENDIENTES EN SALA Y LLEVAR) */}
        {/* =================================================================== */}
        {tabActiva === "cobros" && (
          <main className="flex-1 p-3 sm:p-6 flex flex-col gap-5">
            {/* Banner de Resumen de Cuentas por Cobrar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="bg-amber-500/10 border-amber-200 p-4 rounded-2xl flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-bold text-amber-900 uppercase">
                    Comandas por Cobrar
                  </span>
                  <p className="text-2xl font-extrabold text-amber-950">
                    {cobrosNoCobrados.length} Pendientes
                  </p>
                </div>
              </Card>

              <Card className="bg-red-500/10 border-red-200 p-4 rounded-2xl flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-red-700 text-white flex items-center justify-center shrink-0">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-bold text-red-900 uppercase">
                    Importe Total por Cobrar
                  </span>
                  <p className="text-2xl font-extrabold text-red-950">
                    {formatearMoneda(totalPorCobrar)}
                  </p>
                </div>
              </Card>

              <Card className="bg-emerald-500/10 border-emerald-200 p-4 rounded-2xl flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-bold text-emerald-900 uppercase">
                    Canales de Cobro
                  </span>
                  <p className="text-xs font-semibold text-emerald-800 mt-0.5">
                    Cobro con Mozo en Mesa ó Caja Ventanilla
                  </p>
                </div>
              </Card>
            </div>

            {/* Listado de Comandas Pendientes */}
            <Card className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Detalle de Comandas Activas Sin Cobrar</span>
                </h3>
                <span className="text-xs text-slate-500">
                  Actualizado en tiempo real
                </span>
              </div>

              {cobrosNoCobrados.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center justify-center gap-2 text-slate-400">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                  <span className="text-sm font-bold text-slate-700">
                    ¡Al día! No hay cuentas pendientes de cobro
                  </span>
                  <p className="text-xs text-slate-500">
                    Todas las mesas y pedidos para llevar se encuentran cobrados y cerrados.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cobrosNoCobrados.map((cobro) => (
                    <Card
                      key={cobro.idPedido}
                      className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 flex flex-col justify-between hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-col gap-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                            {cobro.tipo === "Mesa" ? (
                              <Utensils className="w-4 h-4 text-red-700" />
                            ) : (
                              <ShoppingBag className="w-4 h-4 text-amber-600" />
                            )}
                            {cobro.identificador}
                          </span>
                          <Badge
                            className={`text-[10px] font-bold border-none ${
                              cobro.estadoCocina === "Servido"
                                ? "bg-emerald-100 text-emerald-800"
                                : cobro.estadoCocina === "Preparando"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {cobro.estadoCocina}
                          </Badge>
                        </div>

                        <div className="text-xs text-slate-500 flex items-center justify-between">
                          <span className="font-mono">{cobro.codigo}</span>
                          <span>
                            {new Date(cobro.fecha).toLocaleTimeString("es-PE", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        {/* Ítems pedidos */}
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 max-h-24 overflow-y-auto text-xs text-slate-700 flex flex-col gap-1">
                          {cobro.items.map((it, idx) => (
                            <div key={idx} className="flex justify-between">
                              <span className="line-clamp-1">
                                {it.cantidad}x {it.nombre}
                              </span>
                              <span className="font-semibold ml-2">
                                S/ {it.subTotal.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs font-bold text-slate-600">Total a Cobrar:</span>
                          <span className="text-base font-extrabold text-red-700">
                            {formatearMoneda(cobro.total)}
                          </span>
                        </div>
                      </div>

                      {/* Botones de cobro directo */}
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200">
                        {cobro.tipo === "Mesa" && (
                          <Button
                            size="sm"
                            onClick={() => abrirCobroMozo(cobro.pedidoObj)}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-8 rounded-lg cursor-pointer"
                          >
                            <Smartphone className="w-3.5 h-3.5 mr-1" />
                            Cobro Mozo
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => irACobrarVentanilla(cobro.pedidoObj, cobro.identificador)}
                          className="flex-1 text-xs font-bold h-8 rounded-lg border-slate-300 hover:bg-slate-100 cursor-pointer"
                        >
                          <Receipt className="w-3.5 h-3.5 mr-1 text-slate-600" />
                          Ventanilla
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </main>
        )}

        {/* =================================================================== */}
        {/* PESTAÑA 3: CAJA Y COBRO EN VENTANILLA */}
        {/* =================================================================== */}
        {tabActiva === "caja" && (
          <main className="flex-1 p-3 sm:p-6 flex flex-col gap-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Columna Izquierda: Selección de Comanda a Cobrar */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                <Card className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center justify-between">
                    <span>1. Seleccionar Cuenta a Cobrar</span>
                    <Badge variant="outline" className="text-[10px]">
                      {cobrosNoCobrados.length} Pendientes
                    </Badge>
                  </h3>

                  {cobrosNoCobrados.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No hay comandas activas pendientes de cobro.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-[460px] overflow-y-auto pr-1">
                      {cobrosNoCobrados.map((c) => {
                        const seleccionada = pedidoACobrar?.id === c.idPedido;
                        return (
                          <div
                            key={c.idPedido}
                            onClick={() => {
                              setPedidoACobrar(c.pedidoObj);
                              setOrigenCobro(c.identificador);
                              setMontoEntregado("");
                            }}
                            className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                              seleccionada
                                ? "bg-red-50/80 border-red-500 ring-2 ring-red-500/20 shadow-xs"
                                : "bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100/70"
                            }`}
                          >
                            <div className="flex items-center justify-between font-bold text-slate-900 mb-1">
                              <span className="flex items-center gap-1.5">
                                {c.tipo === "Mesa" ? (
                                  <Utensils className="w-3.5 h-3.5 text-red-700" />
                                ) : (
                                  <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
                                )}
                                {c.identificador}
                              </span>
                              <span className="text-red-700 font-extrabold text-sm">
                                {formatearMoneda(c.total)}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex justify-between">
                              <span>Comanda {c.codigo}</span>
                              <span>{c.items.length} productos</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </div>

              {/* Columna Derecha: Proceso de Cobro y Facturación en Ventanilla */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                <Card className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-800 mb-4 pb-2 border-b border-slate-200 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-red-700" />
                      <span>2. Facturación y Medio de Pago en Ventanilla</span>
                    </span>
                    {pedidoACobrar && (
                      <Badge className="bg-red-700 text-white font-bold text-xs">
                        {origenCobro}
                      </Badge>
                    )}
                  </h3>

                  {!pedidoACobrar ? (
                    <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                      <Receipt className="w-12 h-12 text-slate-300" />
                      <span className="text-sm font-semibold text-slate-600">
                        Selecciona una cuenta en la columna izquierda
                      </span>
                      <p className="text-xs text-slate-400">
                        Elige la mesa o pedido para llevar que deseas facturar y cobrar.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {/* Desglose de Productos */}
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs">
                        <span className="font-bold text-slate-700 mb-2 block">
                          Consumo de la Cuenta:
                        </span>
                        <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
                          {pedidoACobrar.items.map((it, idx) => (
                            <div
                              key={idx}
                              className="flex justify-between py-1 border-b border-slate-200/50 last:border-none text-slate-700"
                            >
                              <span>
                                {it.cantidad}x {it.nombre}
                              </span>
                              <span className="font-semibold">
                                S/ {it.subTotal.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Tipo de Comprobante Fiscal */}
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1.5">
                          Tipo de Comprobante:
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {(["Boleta", "Factura", "Ticket"] as const).map((tipo) => (
                            <button
                              key={tipo}
                              type="button"
                              onClick={() => {
                                setTipoComprobante(tipo);
                                if (tipo === "Factura" && (!clienteDoc || clienteDoc.length !== 11)) {
                                  setClienteDoc("20601234567");
                                  setClienteNombre("EMPRESA GASTRONÓMICA S.A.C.");
                                }
                              }}
                              className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                tipoComprobante === tipo
                                  ? "bg-red-700 text-white border-red-700 shadow-xs"
                                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              {tipo}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Datos del Cliente */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">
                            {tipoComprobante === "Factura" ? "RUC (11 dígitos):" : "DNI / Documento:"}
                          </label>
                          <div className="flex gap-1.5">
                            <Input
                              placeholder={tipoComprobante === "Factura" ? "Ej: 20601234567" : "Ej: 47829103"}
                              value={clienteDoc}
                              onChange={(e) => setClienteDoc(e.target.value)}
                              className="bg-white text-xs h-9 rounded-lg"
                            />
                            <Button
                              type="button"
                              size="sm"
                              disabled={consultandoDoc}
                              onClick={() =>
                                consultarDocIdentidad(
                                  tipoComprobante === "Factura" ? "ruc" : "dni",
                                  clienteDoc,
                                  "caja"
                                )
                              }
                              className="bg-slate-800 hover:bg-slate-900 text-white text-[11px] h-9 px-2.5 rounded-lg shrink-0 cursor-pointer shadow-xs"
                              title="Consultar en RENIEC / SUNAT con json.pe"
                            >
                              {consultandoDoc ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Search className="w-3.5 h-3.5" />
                              )}
                              <span className="ml-1 hidden sm:inline">SUNAT/RENIEC</span>
                            </Button>
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">
                            {tipoComprobante === "Factura" ? "Razón Social:" : "Nombre del Cliente:"}
                          </label>
                          <Input
                            placeholder={tipoComprobante === "Factura" ? "EMPRESA S.A.C." : "CLIENTE GENERAL"}
                            value={clienteNombre}
                            onChange={(e) => setClienteNombre(e.target.value)}
                            className="bg-white text-xs h-9 rounded-lg"
                          />
                        </div>
                      </div>

                      {/* Selección de Método de Pago */}
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1.5">
                          Método de Pago:
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setMetodoPago("efectivo")}
                            className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold transition-all cursor-pointer ${
                              metodoPago === "efectivo"
                                ? "bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <Banknote className="w-5 h-5 text-emerald-600" />
                            <span>Efectivo</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setMetodoPago("yape")}
                            className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold transition-all cursor-pointer ${
                              metodoPago === "yape"
                                ? "bg-purple-50 border-purple-500 text-purple-800 ring-2 ring-purple-500/20"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <QrCode className="w-5 h-5 text-purple-600" />
                            <span>Yape QR</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setMetodoPago("pos")}
                            className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold transition-all cursor-pointer ${
                              metodoPago === "pos"
                                ? "bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-500/20"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <CreditCard className="w-5 h-5 text-blue-600" />
                            <span>Tarjeta / POS</span>
                          </button>
                        </div>
                      </div>

                      {/* Campo de vuelto para pago en efectivo */}
                      {metodoPago === "efectivo" && (
                        <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <label className="text-xs font-bold text-emerald-900 block mb-1">
                              Monto Entregado por el Cliente:
                            </label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                step="any"
                                placeholder={`Ej: ${totalCobroVentanilla}`}
                                value={montoEntregado}
                                onChange={(e) => setMontoEntregado(e.target.value)}
                                className="bg-white text-xs h-9 w-36 rounded-lg font-bold"
                              />
                              <div className="flex gap-1">
                                {[20, 50, 100, 200].map((billete) => (
                                  <button
                                    key={billete}
                                    type="button"
                                    onClick={() => setMontoEntregado(String(billete))}
                                    className="px-2 py-1 bg-white border border-emerald-300 rounded text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 cursor-pointer"
                                  >
                                    S/{billete}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[11px] font-bold text-emerald-800 block">
                              Vuelto a Entregar:
                            </span>
                            <span className="text-xl font-extrabold text-emerald-700">
                              S/ {vueltoVentanilla.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Totales con desglose de IGV (18%) */}
                      <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200 flex flex-col gap-1 text-xs">
                        <div className="flex justify-between text-slate-600">
                          <span>Subtotal Base Imponible:</span>
                          <span className="font-semibold">
                            S/ {desgloseVentanilla.subtotal.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>IGV (18% incluido):</span>
                          <span className="font-semibold">
                            S/ {desgloseVentanilla.igv.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-900 font-extrabold text-base pt-1 border-t border-slate-200 mt-1">
                          <span>TOTAL A PAGAR:</span>
                          <span className="text-red-700">
                            {formatearMoneda(totalCobroVentanilla)}
                          </span>
                        </div>
                      </div>

                      {/* Botón de Confirmación y Cierre de Venta */}
                      <Button
                        onClick={ejecutarCobroVentanilla}
                        disabled={procesandoVenta}
                        className="w-full bg-red-700 hover:bg-red-800 text-white font-bold text-sm h-11 rounded-xl flex items-center justify-center gap-2 shadow-md cursor-pointer"
                      >
                        {procesandoVenta ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Procesando Venta y Liberando Mesa...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-5 h-5" />
                            <span>Emitir Comprobante y Cobrar en Ventanilla</span>
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </main>
        )}

        {/* =================================================================== */}
        {/* PESTAÑA 4: CLIENTES (LISTADO, BÚSQUEDA Y REGISTRO) */}
        {/* =================================================================== */}
        {tabActiva === "clientes" && (
          <main className="flex-1 p-3 sm:p-6 flex flex-col gap-5">
            <Card className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
              {/* Barra Superior con Búsqueda y Botón Nuevo */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                <div className="flex items-center gap-2 w-full sm:w-80">
                  <div className="relative w-full">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <Input
                      placeholder="Buscar por DNI, RUC o Nombre..."
                      value={busquedaCliente}
                      onChange={(e) => setBusquedaCliente(e.target.value)}
                      className="pl-9 bg-slate-50 text-xs h-9 rounded-xl"
                    />
                  </div>
                </div>

                <Button
                  onClick={() => {
                    setNuevoClienteTipo("Natural");
                    setNuevoClienteDoc("");
                    setNuevoClienteNombre("");
                    setNuevoClienteApellido("");
                    setNuevoClienteTelefono("");
                    setModalNuevoClienteAbierto(true);
                  }}
                  className="bg-red-700 hover:bg-red-800 text-white font-bold text-xs h-9 px-4 rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Nuevo Cliente</span>
                </Button>
              </div>

              {/* Tabla Responsiva de Clientes */}
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] bg-slate-50/70">
                      <th className="py-2.5 px-3">Documento</th>
                      <th className="py-2.5 px-3">Tipo</th>
                      <th className="py-2.5 px-3">Cliente / Razón Social</th>
                      <th className="py-2.5 px-3">Teléfono</th>
                      <th className="py-2.5 px-3 text-center">Compras</th>
                      <th className="py-2.5 px-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clientesFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No se encontraron clientes registrados.
                        </td>
                      </tr>
                    ) : (
                      clientesFiltrados.map((cli) => (
                        <tr key={cli.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-3 font-mono font-bold text-slate-900">
                            {cli.nroDoc}
                          </td>
                          <td className="py-3 px-3">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                cli.tipoPersona === "Juridico"
                                  ? "border-blue-300 text-blue-800 bg-blue-50"
                                  : "border-slate-300 text-slate-700 bg-slate-100"
                              }`}
                            >
                              {cli.tipoPersona}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-800">
                            {cli.nombreCompleto}
                          </td>
                          <td className="py-3 px-3 text-slate-600 font-mono">
                            {cli.telefono || "—"}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold text-[10px]">
                              {cli.totalCompras}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => seleccionarClienteParaVenta(cli)}
                              className="text-[11px] h-7 px-2.5 rounded-lg border-slate-300 hover:bg-slate-100 font-semibold cursor-pointer"
                            >
                              Facturar
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </main>
        )}

        {/* =================================================================== */}
        {/* PESTAÑA 5: VENTAS DIARIAS & FACTURAS DE VENTA */}
        {/* =================================================================== */}
        {tabActiva === "facturas" && (
          <main className="flex-1 p-3 sm:p-6 flex flex-col gap-5">
            {/* Tarjetas KPI de Resumen de Ventas Diarias */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Card className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-bold uppercase">Total Recaudado</span>
                  <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  {formatearMoneda(resumenDiario.totalRecaudado)}
                </p>
                <span className="text-[11px] text-slate-500 mt-1">
                  {resumenDiario.cantidadVentas} comprobantes emitidos
                </span>
              </Card>

              <Card className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-emerald-700 mb-1">
                  <span className="text-xs font-bold uppercase">Efectivo en Caja</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Banknote className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-xl sm:text-2xl font-extrabold text-emerald-700">
                  {formatearMoneda(resumenDiario.desgloseMetodos.efectivo)}
                </p>
                <span className="text-[11px] text-slate-500 mt-1">
                  Dinero físico disponible
                </span>
              </Card>

              <Card className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-purple-700 mb-1">
                  <span className="text-xs font-bold uppercase">Yape QR</span>
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                    <QrCode className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-xl sm:text-2xl font-extrabold text-purple-700">
                  {formatearMoneda(resumenDiario.desgloseMetodos.yape)}
                </p>
                <span className="text-[11px] text-slate-500 mt-1">
                  Pagos digitales QR
                </span>
              </Card>

              <Card className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-blue-700 mb-1">
                  <span className="text-xs font-bold uppercase">POS / Tap to Pay</span>
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <CreditCard className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-xl sm:text-2xl font-extrabold text-blue-700">
                  {formatearMoneda(resumenDiario.desgloseMetodos.tarjeta)}
                </p>
                <span className="text-[11px] text-slate-500 mt-1">
                  Mercado Pago &amp; Tarjetas
                </span>
              </Card>
            </div>

            {/* Listado y Filtro de Comprobantes Emitidos */}
            <Card className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-red-700" />
                    <span>Comprobantes de Venta Emitidos</span>
                  </h3>
                  <Badge variant="outline" className="text-[10px]">
                    {comprobantesVenta.length} Emitidos
                  </Badge>
                </div>

                {/* Filtro de Fecha */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 font-semibold">Filtrar:</span>
                  <Button
                    size="sm"
                    variant={filtroFechaVentas === "hoy" ? "default" : "outline"}
                    onClick={() => setFiltroFechaVentas("hoy")}
                    className={`text-xs h-7 rounded-lg cursor-pointer ${
                      filtroFechaVentas === "hoy" ? "bg-red-700 text-white" : ""
                    }`}
                  >
                    Hoy
                  </Button>
                  <Button
                    size="sm"
                    variant={filtroFechaVentas === "todas" ? "default" : "outline"}
                    onClick={() => setFiltroFechaVentas("todas")}
                    className={`text-xs h-7 rounded-lg cursor-pointer ${
                      filtroFechaVentas === "todas" ? "bg-red-700 text-white" : ""
                    }`}
                  >
                    Todas las Fechas
                  </Button>
                </div>
              </div>

              {/* Tabla de Facturas y Boletas */}
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] bg-slate-50/70">
                      <th className="py-2.5 px-3">Comprobante</th>
                      <th className="py-2.5 px-3">Fecha y Hora</th>
                      <th className="py-2.5 px-3">Cliente</th>
                      <th className="py-2.5 px-3">Origen</th>
                      <th className="py-2.5 px-3">Método Pago</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                      <th className="py-2.5 px-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {comprobantesVenta.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No se han emitido comprobantes para la fecha seleccionada.
                        </td>
                      </tr>
                    ) : (
                      comprobantesVenta.map((comp) => (
                        <tr key={comp.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-3">
                            <span className="font-mono font-bold text-slate-900 block">
                              {comp.codigoCompleto}
                            </span>
                            <Badge
                              className={`text-[9px] font-bold border-none ${
                                comp.tipo === "Factura"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-slate-100 text-slate-800"
                              }`}
                            >
                              {comp.tipo}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                            {new Date(comp.fecha).toLocaleString("es-PE", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-slate-800 block line-clamp-1">
                              {comp.cliente.nombre}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Doc: {comp.cliente.nroDoc}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-600 font-semibold">
                            {comp.origen}
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                              {comp.metodoPago}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-extrabold text-sm text-red-700 font-mono">
                            {formatearMoneda(comp.total)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setComprobanteEmitido(comp);
                                setModalTicketAbierto(true);
                              }}
                              className="text-[11px] h-7 px-2.5 rounded-lg border-slate-300 hover:bg-slate-100 font-semibold cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5 mr-1" />
                              Ver Ticket
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </main>
        )}
      </div>

      {/* =================================================================== */}
      {/* MODAL 1: TOMAR / EDITAR COMANDA (MESA O PARA LLEVAR) */}
      {/* =================================================================== */}
      <Dialog open={modalPedidoAbierto} onOpenChange={setModalPedidoAbierto}>
        <DialogContent className="w-[95vw] sm:max-w-2xl md:max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl p-4 sm:p-6 bg-white">
          <DialogHeader className="pb-3 border-b border-slate-200">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Utensils className="w-5 h-5 text-red-700" />
                {esEdicion
                  ? "Modificar Comanda Activa"
                  : esParaLlevar
                  ? "Nuevo Pedido Para Llevar (Ventanilla)"
                  : `Comanda de Salón — Mesa ${mesaSeleccionada?.numero}`}
              </span>
              <span className="text-xs font-mono font-bold text-red-700 bg-red-50 px-2 py-1 rounded-lg">
                Total: {formatearMoneda(totalComanda)}
              </span>
            </DialogTitle>
          </DialogHeader>

          {/* Observación general */}
          <div className="mt-2">
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Observaciones de la Comanda / Mesa:
            </label>
            <Input
              placeholder="Ej: Mesa con niños pequeños, traer servilletas extra, etc."
              value={observacionMesa}
              onChange={(e) => setObservacionMesa(e.target.value)}
              className="bg-slate-50 text-xs h-8 rounded-lg"
            />
          </div>

          {/* Categorías y Filtro */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-2">
            {[
              { id: "todos", label: "Todos" },
              { id: "pollos", label: "Pollos a la Brasa" },
              { id: "adicionales", label: "Guarniciones" },
              { id: "bebidas", label: "Bebidas" },
              { id: "otros", label: "Otros" },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoriaSeleccionada(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  categoriaSeleccionada === cat.id
                    ? "bg-red-700 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Grid de Platos de la Carta */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1 border rounded-xl bg-slate-50/50">
            {platosFiltrados.map((plato) => (
              <div
                key={plato.id}
                onClick={() => agregarItemComanda(plato)}
                className="bg-white p-2.5 rounded-xl border border-slate-200 hover:border-red-400 hover:shadow-xs cursor-pointer flex flex-col justify-between transition-all"
              >
                <div>
                  <h4 className="font-bold text-xs text-slate-900 line-clamp-1">
                    {plato.nombre}
                  </h4>
                  <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                    {plato.descripcion}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100">
                  <span className="font-bold text-xs text-red-700">
                    S/ {plato.precio.toFixed(2)}
                  </span>
                  <span className="text-[10px] font-bold text-white bg-red-700 px-1.5 py-0.5 rounded-md">
                    + Añadir
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Resumen de Ítems Seleccionados */}
          <div className="mt-3">
            <span className="text-xs font-bold text-slate-700 block mb-1">
              Platos Seleccionados en la Comanda ({itemsComanda.length}):
            </span>
            {itemsComanda.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2 text-center">
                Toca cualquier plato de la lista superior para agregarlo.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
                {itemsComanda.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs"
                  >
                    <div className="flex-1 mr-2">
                      <span className="font-bold text-slate-900 block line-clamp-1">
                        {item.nombre}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-slate-500">
                          Unit: S/ {item.precio.toFixed(2)}
                        </span>
                        {item.observaciones && (
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded italic">
                            &quot;{item.observaciones}&quot;
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setObsIndex(idx);
                            setObsTexto(item.observaciones);
                            setModalObsAbierto(true);
                          }}
                          className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                        >
                          Nota
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
                        <button
                          type="button"
                          onClick={() => cambiarCantidadItem(idx, -1)}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 flex items-center justify-center cursor-pointer"
                        >
                          -
                        </button>
                        <span className="w-6 text-center font-bold font-mono">
                          {item.cantidad}
                        </span>
                        <button
                          type="button"
                          onClick={() => cambiarCantidadItem(idx, 1)}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 flex items-center justify-center cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      <span className="font-extrabold text-slate-900 w-16 text-right font-mono">
                        S/ {(item.precio * item.cantidad).toFixed(2)}
                      </span>

                      <button
                        type="button"
                        onClick={() => eliminarItem(idx)}
                        className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                        title="Eliminar plato"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2 mt-4 pt-3 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalPedidoAbierto(false)}
              className="text-xs font-semibold rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={guardarPedido}
              disabled={guardandoPedido || itemsComanda.length === 0}
              className="bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {guardandoPedido ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>{esEdicion ? "Guardar Cambios" : "Confirmar y Enviar a Cocina"}</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODAL 2: COBRO MÓVIL DEL MOZO (CON CELULAR / TAP TO PAY / YAPE) */}
      {/* =================================================================== */}
      <Dialog open={modalCobroMozoAbierto} onOpenChange={setModalCobroMozoAbierto}>
        <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl p-4 sm:p-6 bg-white">
          <DialogHeader className="pb-3 border-b border-slate-200">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-600" />
                <span>Cobro Móvil / Mozo</span>
              </span>
              {pedidoCobroMozo?.mesa && (
                <Badge className="bg-red-700 text-white font-bold">
                  Mesa {pedidoCobroMozo.mesa.numero}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {pedidoCobroMozo && (
            <div className="flex flex-col gap-4 mt-2">
              {/* Importe Total en Grande */}
              <div className="bg-slate-900 text-white p-4 rounded-2xl text-center">
                <span className="text-xs text-slate-400 font-bold uppercase block">
                  Total a Cobrar en Mesa
                </span>
                <span className="text-3xl font-extrabold text-emerald-400">
                  {formatearMoneda(pedidoCobroMozo.total)}
                </span>
                <span className="text-[11px] text-slate-400 block mt-1">
                  Comanda {pedidoCobroMozo.codigo} • {pedidoCobroMozo.items.length} platos
                </span>
              </div>

              {/* Selector de Método de Cobro Móvil */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Selecciona Medio de Pago en Mesa:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMetodoPagoMozo("pos")}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold cursor-pointer transition-all ${
                      metodoPagoMozo === "pos"
                        ? "bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-500/20 shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600"
                    }`}
                  >
                    <Smartphone className="w-5 h-5 text-blue-600" />
                    <span>Tap to Pay</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMetodoPagoMozo("yape")}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold cursor-pointer transition-all ${
                      metodoPagoMozo === "yape"
                        ? "bg-purple-50 border-purple-500 text-purple-900 ring-2 ring-purple-500/20 shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600"
                    }`}
                  >
                    <QrCode className="w-5 h-5 text-purple-600" />
                    <span>Yape QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMetodoPagoMozo("efectivo")}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold cursor-pointer transition-all ${
                      metodoPagoMozo === "efectivo"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20 shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600"
                    }`}
                  >
                    <Banknote className="w-5 h-5 text-emerald-600" />
                    <span>Efectivo</span>
                  </button>
                </div>
              </div>

              {/* Modo Tap to Pay (El celular como Terminal POS con Mercado Pago) */}
              {metodoPagoMozo === "pos" && (
                <div className="bg-blue-50/70 border border-blue-200 p-4 rounded-2xl flex flex-col items-center text-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center animate-pulse">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-blue-950">
                    Terminal POS en Celular (Tap to Pay Mercado Pago)
                  </span>
                  <p className="text-[11px] text-blue-800">
                    Pide al cliente que acerque su tarjeta sin contacto o celular con NFC al dorso de este dispositivo.
                  </p>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-white px-2 py-0.5 rounded-full border border-blue-200">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    Listo para sincronizar con Mercado Pago Point
                  </div>
                </div>
              )}

              {/* Modo Yape QR */}
              {metodoPagoMozo === "yape" && (
                <div className="bg-purple-50/70 border border-purple-200 p-4 rounded-2xl flex flex-col items-center text-center gap-2">
                  <div className="w-12 h-12 rounded-xl bg-purple-600 text-white flex items-center justify-center">
                    <QrCode className="w-7 h-7" />
                  </div>
                  <span className="text-xs font-bold text-purple-950">
                    Código QR Local / Yape
                  </span>
                  <p className="text-[11px] text-purple-800">
                    Muestra el QR del restaurante al comensal para que escanee y confirme el abono de {formatearMoneda(pedidoCobroMozo.total)}.
                  </p>
                </div>
              )}

              {/* Modo Efectivo con Vuelto Rápido */}
              {metodoPagoMozo === "efectivo" && (
                <div className="bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-2xl flex flex-col gap-2">
                  <label className="text-xs font-bold text-emerald-950 block">
                    Monto que entrega el comensal:
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="any"
                      placeholder={`Ej: ${pedidoCobroMozo.total}`}
                      value={montoEntregadoMozo}
                      onChange={(e) => setMontoEntregadoMozo(e.target.value)}
                      className="bg-white text-xs h-9 rounded-lg font-bold"
                    />
                    <div className="flex gap-1">
                      {[50, 100].map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setMontoEntregadoMozo(String(b))}
                          className="px-2 py-1 bg-white border border-emerald-300 rounded text-xs font-bold text-emerald-900 cursor-pointer"
                        >
                          S/{b}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-emerald-200/60 text-xs">
                    <span className="font-bold text-emerald-900">Vuelto a devolver:</span>
                    <span className="font-extrabold text-emerald-700 text-base">
                      S/ {vueltoMozo.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <DialogFooter className="flex gap-2 pt-2 border-t border-slate-200">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModalCobroMozoAbierto(false)}
                  className="text-xs font-semibold rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={ejecutarCobroMozo}
                  disabled={procesandoCobroMozo}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 rounded-xl flex-1 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {procesandoCobroMozo ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Cobrando y Liberando Mesa...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirmar Cobro y Liberar Mesa</span>
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODAL 3: REGISTRO DE NUEVO CLIENTE */}
      {/* =================================================================== */}
      <Dialog open={modalNuevoClienteAbierto} onOpenChange={setModalNuevoClienteAbierto}>
        <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl p-4 sm:p-6 bg-white">
          <DialogHeader className="pb-3 border-b border-slate-200">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-red-700" />
              <span>Registrar Nuevo Cliente</span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3 mt-2">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Tipo de Persona:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNuevoClienteTipo("Natural")}
                  className={`py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    nuevoClienteTipo === "Natural"
                      ? "bg-red-700 text-white border-red-700"
                      : "bg-slate-50 border-slate-200 text-slate-700"
                  }`}
                >
                  Persona Natural (DNI)
                </button>
                <button
                  type="button"
                  onClick={() => setNuevoClienteTipo("Juridico")}
                  className={`py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    nuevoClienteTipo === "Juridico"
                      ? "bg-red-700 text-white border-red-700"
                      : "bg-slate-50 border-slate-200 text-slate-700"
                  }`}
                >
                  Persona Jurídica (RUC)
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {nuevoClienteTipo === "Natural" ? "DNI (8 dígitos):" : "RUC (11 dígitos):"}
              </label>
              <div className="flex gap-1.5">
                <Input
                  placeholder={nuevoClienteTipo === "Natural" ? "Ej: 47829103" : "Ej: 20601234567"}
                  value={nuevoClienteDoc}
                  onChange={(e) => setNuevoClienteDoc(e.target.value)}
                  className="bg-slate-50 text-xs h-9 rounded-xl"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={consultandoDoc}
                  onClick={() =>
                    consultarDocIdentidad(
                      nuevoClienteTipo === "Natural" ? "dni" : "ruc",
                      nuevoClienteDoc,
                      "nuevo_cliente"
                    )
                  }
                  className="bg-slate-800 hover:bg-slate-900 text-white text-xs h-9 px-3 rounded-xl shrink-0 cursor-pointer shadow-xs"
                  title="Consultar en RENIEC / SUNAT con json.pe"
                >
                  {consultandoDoc ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  <span className="ml-1">Consultar</span>
                </Button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {nuevoClienteTipo === "Natural" ? "Nombres:" : "Razón Social:"}
              </label>
              <Input
                placeholder={nuevoClienteTipo === "Natural" ? "Ej: Juan Carlos" : "Ej: INVERSIONES GASTRONÓMICAS PERÚ S.A.C."}
                value={nuevoClienteNombre}
                onChange={(e) => setNuevoClienteNombre(e.target.value)}
                className="bg-slate-50 text-xs h-9 rounded-xl"
              />
            </div>

            {nuevoClienteTipo === "Natural" && (
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Apellidos:
                </label>
                <Input
                  placeholder="Ej: Pérez Rodríguez"
                  value={nuevoClienteApellido}
                  onChange={(e) => setNuevoClienteApellido(e.target.value)}
                  className="bg-slate-50 text-xs h-9 rounded-xl"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Teléfono / Celular (Opcional):
              </label>
              <Input
                placeholder="Ej: 987654321"
                value={nuevoClienteTelefono}
                onChange={(e) => setNuevoClienteTelefono(e.target.value)}
                className="bg-slate-50 text-xs h-9 rounded-xl"
              />
            </div>

            <DialogFooter className="flex gap-2 pt-3 border-t border-slate-200 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalNuevoClienteAbierto(false)}
                className="text-xs font-semibold rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={registrarNuevoCliente}
                disabled={guardandoCliente}
                className="bg-red-700 hover:bg-red-800 text-white font-bold text-xs h-9 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {guardandoCliente ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Guardar Cliente</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODAL 4: OBSERVACIÓN DE PLATO */}
      {/* =================================================================== */}
      <Dialog open={modalObsAbierto} onOpenChange={setModalObsAbierto}>
        <DialogContent className="w-[90vw] sm:max-w-sm rounded-2xl p-4 bg-white">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-900">
              Observación para el Plato
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="Ej: Papas bien doradas, sin mayonesa, etc."
              value={obsTexto}
              onChange={(e) => setObsTexto(e.target.value)}
              className="bg-slate-50 text-xs h-9 rounded-xl"
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalObsAbierto(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (obsIndex !== null) {
                  setItemsComanda((prev) => {
                    const c = [...prev];
                    c[obsIndex].observaciones = obsTexto;
                    return c;
                  });
                }
                setModalObsAbierto(false);
              }}
              className="bg-red-700 hover:bg-red-800 text-white text-xs font-bold"
            >
              Guardar Nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODAL 5: TICKET FISCAL IMPRIMIBLE (80MM TÉRMICO) */}
      {/* =================================================================== */}
      <Dialog open={modalTicketAbierto} onOpenChange={setModalTicketAbierto}>
        <DialogContent className="w-[95vw] sm:max-w-sm max-h-[90vh] overflow-y-auto rounded-2xl p-4 bg-white print:p-0 print:border-none print:shadow-none print:max-w-none">
          <DialogHeader className="pb-2 border-b border-slate-200 no-print">
            <DialogTitle className="text-sm font-bold text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <span>Comprobante Emitido</span>
              </span>
              <Badge className="bg-emerald-100 text-emerald-800 font-mono text-[10px]">
                {comprobanteEmitido?.codigoCompleto}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {/* Formato 80mm Térmico optimizado para Ticketera POS */}
          <div
            id="ticket-termico"
            className="ticket-termico-print bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-800 flex flex-col gap-2"
          >
            <div className="text-center pb-2 border-b border-dashed border-slate-300">
              <h2 className="font-extrabold text-sm text-slate-900 uppercase">
                POLLERÍA RESTAURANTE
              </h2>
              <p className="text-[10px] text-slate-500">RUC: 20601234567</p>
              <p className="text-[10px] text-slate-500">Av. Gastronómica 123 - Lima, Perú</p>
            </div>

            <div className="flex flex-col gap-0.5 text-[10px] text-slate-600 pb-2 border-b border-dashed border-slate-300">
              <div className="flex justify-between">
                <span>COMPROBANTE:</span>
                <span className="font-bold text-slate-900">{comprobanteEmitido?.tipo}</span>
              </div>
              <div className="flex justify-between">
                <span>NÚMERO:</span>
                <span className="font-bold text-slate-900">{comprobanteEmitido?.codigoCompleto}</span>
              </div>
              <div className="flex justify-between">
                <span>FECHA:</span>
                <span>
                  {comprobanteEmitido?.fecha
                    ? new Date(comprobanteEmitido.fecha).toLocaleString("es-PE")
                    : ""}
                </span>
              </div>
              <div className="flex justify-between">
                <span>CLIENTE:</span>
                <span className="font-bold">{comprobanteEmitido?.cliente.nombre}</span>
              </div>
              <div className="flex justify-between">
                <span>DOC:</span>
                <span>{comprobanteEmitido?.cliente.nroDoc}</span>
              </div>
              <div className="flex justify-between">
                <span>ORIGEN:</span>
                <span>{comprobanteEmitido?.origen}</span>
              </div>
            </div>

            {/* Ítems */}
            <div className="flex flex-col gap-1 pb-2 border-b border-dashed border-slate-300">
              {comprobanteEmitido?.items.map((it, idx) => (
                <div key={idx} className="flex justify-between text-[10px]">
                  <span className="line-clamp-1">
                    {it.cantidad}x {it.nombre}
                  </span>
                  <span className="font-semibold">S/ {it.subTotal.toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Totales */}
            <div className="flex flex-col gap-0.5 text-[10px] pb-2 border-b border-dashed border-slate-300">
              <div className="flex justify-between">
                <span>OP. GRAVADA:</span>
                <span>S/ {comprobanteEmitido?.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>I.G.V. (18%):</span>
                <span>S/ {comprobanteEmitido?.igv.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-xs text-slate-900 pt-1">
                <span>TOTAL A PAGAR:</span>
                <span>S/ {comprobanteEmitido?.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-0.5 text-[10px]">
              <div className="flex justify-between">
                <span>MÉTODO DE PAGO:</span>
                <span className="font-bold">{comprobanteEmitido?.metodoPago}</span>
              </div>
              {comprobanteEmitido?.vuelto ? (
                <div className="flex justify-between text-emerald-800 font-bold">
                  <span>VUELTO:</span>
                  <span>S/ {comprobanteEmitido.vuelto.toFixed(2)}</span>
                </div>
              ) : null}
            </div>

            <div className="text-center text-[9px] text-slate-400 pt-2 border-t border-dashed border-slate-300">
              <p>¡GRACIAS POR SU PREFERENCIA!</p>
              <p>Representación impresa de Ticket Térmico 80mm</p>
            </div>
          </div>

          <DialogFooter className="flex gap-2 pt-2 border-t border-slate-200 no-print">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalTicketAbierto(false)}
              className="text-xs font-semibold rounded-xl"
            >
              Cerrar
            </Button>
            <Button
              size="sm"
              onClick={() => window.print()}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir en Ticketera</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function VentasPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Cargando Módulo de Ventas...</div>}>
      <VentasGestionMesasContent />
    </Suspense>
  );
}
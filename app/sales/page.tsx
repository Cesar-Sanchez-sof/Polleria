"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Eye,
  CheckCircle2,
  Search,
  Trash2,
  Send,
  ShoppingBag,
  RefreshCw,
  Users,
  CreditCard,
  ChefHat,
  BellRing,
  PackageCheck,
  Flame,
  Check,
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
  Phone,
  Calendar,
  AlertCircle,
  FileText,
  DollarSign,
  TrendingUp,
  Tag,
  ArrowRight,
  XCircle,
  Lock,
  Unlock,
  Coins,
  ShieldAlert,
  ArrowDownCircle,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  listTables,
  listDishes,
  listOrders,
  listPaymentMethods as listPaymentTypes,
  createOrder,
  editOrder,
  updateOrderStatus,
  cancelOrder,
  registerSale,
  listCustomers,
  createCustomer,
  listDailySales,
  formatCurrency,
  type TableItem,
  type MenuDish,
  type OrderSummary,
  type TablesSummary,
  type OrderLineItem,
  type PaymentMethodItem,
  type IssuedVoucher,
  type CustomerItem,
  type DailySalesSummary,
} from "@/lib/services/tables.service";
import {
  calculateTotals,
  calculateChangeAmount,
  validateCustomerDocument,
  canEditOrder,
} from "@/lib/utils/sales-helpers";
import { KitchenBoard } from "@/components/restaurant/KitchenBoard";
import {
  getCashSessionStatus,
  openCashSession,
  closeCashSession,
  registerCashMovement,
  type CashRegisterStatus,
  type CloseCashAudit,
  type CashDenominations,
  type CashMovementItem,
  INITIAL_DENOMINATIONS,
  calculateDenominationsTotal,
  formatDenominationsSummary,
} from "@/lib/services/cash-register.service";
import { DenominationsCounter } from "@/components/restaurant/DenominationsCounter";

type TabType = "tables" | "kitchen" | "payments" | "cashier" | "customers" | "invoices";

const SALES_TABS: TabType[] = ["tables", "kitchen", "payments", "cashier", "customers", "invoices"];

function SalesManagementContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Pestaña principal del módulo de ventas
  const [activeTab, setActiveTab] = useState<TabType>("tables");

  const goToTab = useCallback((tab: TabType) => {
    setActiveTab(tab);
    router.replace(`/sales?tab=${tab}`, { scroll: false });
  }, [router]);

  // Sincronizar pestaña activa con parámetro de URL (?tab=...)
  useEffect(() => {
    const tabParam = searchParams.get("tab") as TabType | null;
    if (tabParam && SALES_TABS.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Reloj en tiempo real
  const [currentTime, setCurrentTime] = useState<string>("");
  useEffect(() => {
    const tick = () => {
      setCurrentTime(
        new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // ---------------------------------------------------------------------------
  // DATOS GLOBALES
  // ---------------------------------------------------------------------------
  const [tables, setTables] = useState<TableItem[]>([]);
  const [summary, setSummary] = useState<TablesSummary>({ total: 0, available: 0, occupied: 0 });
  const [takeoutOrders, setTakeoutOrders] = useState<OrderSummary[]>([]);
  const [allOrders, setAllOrders] = useState<OrderSummary[]>([]);
  const [dishes, setDishes] = useState<MenuDish[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<PaymentMethodItem[]>([]);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [saleVouchers, setSaleVouchers] = useState<IssuedVoucher[]>([]);
  const [dailySummary, setDailySummary] = useState<DailySalesSummary>({
    totalRecaudado: 0,
    cantidadVentas: 0,
    desgloseMetodos: { efectivo: 0, yape: 0, tarjeta: 0, otros: 0 },
    desgloseComprobantes: { boletas: 0, facturas: 0, tickets: 0 },
  });
  const [loading, setLoading] = useState<boolean>(true);

  // Filtro de mesas
  const [tableFilter, setTableFilter] = useState<"todas" | "disponibles" | "ocupadas">("todas");

  // Filtro de fecha para ventas diarias
  const [salesDateFilter, setSalesDateFilter] = useState<string>("hoy");

  // Búsqueda de clientes
  const [customerSearch, setCustomerSearch] = useState<string>("");

  // Estados para vista de Pedidos Listos (Meseros / Despacho)
  const [readySearch, setReadySearch] = useState<string>("");
  const [readyFilter, setReadyFilter] = useState<"todos" | "mesas" | "llevar">("todos");
  const [readyStatusMode, setReadyStatusMode] = useState<"solo-listos" | "todos-activos">("solo-listos");
  const [deliveredOrderIds, setDeliveredOrderIds] = useState<Set<number>>(new Set());

  // Carga general de datos desde la API
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [tablesRes, takeoutRes, ordersRes, dishesRes, typesRes, customersRes, salesRes] = await Promise.all([
        listTables(),
        listOrders({ orderType: "Llevar", status: "activos" }),
        listOrders(),
        listDishes(),
        listPaymentTypes(),
        listCustomers(),
        listDailySales(salesDateFilter),
      ]);
      setTables(tablesRes.tables);
      setSummary(tablesRes.summary);
      setTakeoutOrders(takeoutRes);
      setAllOrders(ordersRes);
      setDishes(dishesRes);
      setPaymentTypes(typesRes);
      setCustomers(customersRes);
      setSaleVouchers(salesRes.data);
      setDailySummary(salesRes.dailySummary);

      // Cargar estado de sesión de caja
      try {
        const cashStatus = await getCashSessionStatus();
        setCashSessionState(cashStatus);
      } catch (e) {
        console.warn("Estado de caja no disponible:", e);
      }
    } catch (err: any) {
      toast.error(err.message || "Error al conectar con la base de datos.");
    } finally {
      setLoading(false);
    }
  }, [salesDateFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ---------------------------------------------------------------------------
  // ESTADO MODAL COMANDA (TOMAR / EDITAR PEDIDO)
  // ---------------------------------------------------------------------------
  const [orderModalOpen, setOrderModalOpen] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [selectedTable, setSelectedTable] = useState<TableItem | null>(null);
  const [additionalTables, setAdditionalTables] = useState<number[]>([]);
  const [isTakeaway, setIsTakeaway] = useState<boolean>(false);
  const [tableNote, setTableNote] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("todos");
  const [dishSearch, setDishSearch] = useState<string>("");
  const [orderItems, setOrderItems] = useState<
    Array<{ dishId: number; name: string; unitPrice: number; quantity: number; notes: string }>
  >([]);
  const [savingOrder, setSavingOrder] = useState<boolean>(false);

  // Modal para agregar observación a un plato de la comanda
  const [notesModalOpen, setNotesModalOpen] = useState<boolean>(false);
  const [noteIndex, setNoteIndex] = useState<number | null>(null);
  const [noteText, setNoteText] = useState<string>("");

  // ---------------------------------------------------------------------------
  // ESTADO MODAL CANCELACIÓN DE COMANDA (AUDITORÍA & LIBERACIÓN)
  // ---------------------------------------------------------------------------
  const [cancelModalOpen, setCancelModalOpen] = useState<boolean>(false);
  const [orderToCancel, setOrderToCancel] = useState<OrderSummary | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [cancelUser, setCancelUser] = useState<string>("Mozo Salón");
  const [cancellingOrder, setCancellingOrder] = useState<boolean>(false);

  // ---------------------------------------------------------------------------
  // ESTADO MODAL VISTA DETALLADA DE COMANDA (CONSULTA DE CONSUMO EN TODO MOMENTO)
  // ---------------------------------------------------------------------------
  const [viewOrderModal, setViewOrderModal] = useState<{
    open: boolean;
    order: OrderSummary | null;
    tableName?: string;
  }>({
    open: false,
    order: null,
    tableName: "",
  });

  // ---------------------------------------------------------------------------
  // ESTADO CAJA Y COBRO EN VENTANILLA
  // ---------------------------------------------------------------------------
  const [orderToCharge, setOrderToCharge] = useState<OrderSummary | null>(null);
  const [paymentSource, setPaymentSource] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "yape" | "pos" | "mixto">("efectivo");
  const [amountGiven, setAmountGiven] = useState<string>("");
  // Partes de pago dinámicas para Pagar en Partes (Caja Ventanilla)
  const [paymentParts, setPaymentParts] = useState<
    Array<{ id: string; paymentTypeId: number; monto: string; cashGiven?: string }>
  >([
    { id: "p-1", paymentTypeId: 1, monto: "" },
    { id: "p-2", paymentTypeId: 2, monto: "" },
  ]);

  const [voucherModalOpen, setVoucherModalOpen] = useState<boolean>(false);
  const [voucherType, setVoucherType] = useState<"Boleta" | "Factura">("Boleta");
  const [customerDoc, setCustomerDoc] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [processingSale, setProcessingSale] = useState<boolean>(false);

  // ---------------------------------------------------------------------------
  // ESTADO APERTURA Y CIERRE DE CAJA
  // ---------------------------------------------------------------------------
  const [cashSessionState, setCashSessionState] = useState<CashRegisterStatus>({
    isOpened: false,
    register: null,
    activeSession: null,
  });
  const [openCashModal, setOpenCashModal] = useState<boolean>(false);
  const [closeCashModal, setCloseCashModal] = useState<boolean>(false);
  const [initialCashInput, setInitialCashInput] = useState<string>("100.00");
  const [openNotesInput, setOpenNotesInput] = useState<string>("");
  const [countedCashInput, setCountedCashInput] = useState<string>("");
  const [closeNotesInput, setCloseNotesInput] = useState<string>("");
  const [savingCashSession, setSavingCashSession] = useState<boolean>(false);
  const [lastClosedAudit, setLastClosedAudit] = useState<CloseCashAudit | null>(null);
  const [auditModalOpen, setAuditModalOpen] = useState<boolean>(false);

  // Estados Arqueo detallado de Billetes y Monedas
  const [openDenominations, setOpenDenominations] = useState<CashDenominations>(INITIAL_DENOMINATIONS);
  const [closeDenominations, setCloseDenominations] = useState<CashDenominations>(INITIAL_DENOMINATIONS);

  // Estados para Registro de Salida de Dinero / Emergencia (Egreso de Caja)
  const [expenseModalOpen, setExpenseModalOpen] = useState<boolean>(false);
  const [expenseAmount, setExpenseAmount] = useState<string>("");
  const [expenseReason, setExpenseReason] = useState<string>("");
  const [savingExpense, setSavingExpense] = useState<boolean>(false);

  // ---------------------------------------------------------------------------
  // ESTADO COBRO MÓVIL / MOZO (COBRO CON CELULAR / TAP TO PAY / YAPE / PARTES)
  // ---------------------------------------------------------------------------
  const [waiterPaymentModalOpen, setWaiterPaymentModalOpen] = useState<boolean>(false);
  const [waiterPaymentOrder, setWaiterPaymentOrder] = useState<OrderSummary | null>(null);
  const [waiterPaymentMethod, setWaiterPaymentMethod] = useState<"efectivo" | "yape" | "pos" | "mixto">("pos");
  const [waiterPaymentParts, setWaiterPaymentParts] = useState<
    Array<{ id: string; paymentTypeId: number; monto: string; cashGiven?: string }>
  >([
    { id: "pm-1", paymentTypeId: 1, monto: "" },
    { id: "pm-2", paymentTypeId: 2, monto: "" },
  ]);
  const [waiterAmountGiven, setWaiterAmountGiven] = useState<string>("");
  const [processingWaiterPayment, setProcessingWaiterPayment] = useState<boolean>(false);
  const [tapToPayDetectado, setTapToPayDetectado] = useState<boolean>(false);

  // ---------------------------------------------------------------------------
  // ESTADO MODAL REGISTRO DE CLIENTE
  // ---------------------------------------------------------------------------
  const [newCustomerModalOpen, setNewCustomerModalOpen] = useState<boolean>(false);
  const [newCustomerType, setNewCustomerType] = useState<"Natural" | "Legal">("Natural");
  const [newCustomerDoc, setNewCustomerDoc] = useState<string>("");
  const [newCustomerName, setNewCustomerName] = useState<string>("");
  const [newCustomerLastName, setNewCustomerLastName] = useState<string>("");
  const [newCustomerPhone, setNewCustomerPhone] = useState<string>("");
  const [savingCustomer, setSavingCustomer] = useState<boolean>(false);

  // Consulta de DNI y RUC con json.pe
  const [lookingUpDoc, setLookingUpDoc] = useState<boolean>(false);

  const lookupIdentityDocument = async (
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
      setLookingUpDoc(true);
      const res = await fetch(`/api/document-lookup?tipo=${tipo}&numero=${encodeURIComponent(num)}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "No se pudo obtener información del documento.");
      }

      const data = json.data;
      if (destino === "caja") {
        setCustomerName(data.razonSocial || data.nombreCompleto);
        toast.success(`Datos RENIEC/SUNAT: ${data.razonSocial || data.nombreCompleto}`);
      } else {
        if (tipo === "dni") {
          setNewCustomerName(data.nombres || data.nombreCompleto);
          const apellidos =
            [data.apellidoPaterno, data.apellidoMaterno].filter(Boolean).join(" ") ||
            data.apellidos ||
            data.lastNamePaterno ||
            "";
          setNewCustomerLastName(apellidos);
        } else {
          setNewCustomerName(data.razonSocial || data.nombreCompleto);
        }
        toast.success(`Datos encontrados: ${data.razonSocial || data.nombreCompleto}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Error al consultar documento.");
    } finally {
      setLookingUpDoc(false);
    }
  };

  // ---------------------------------------------------------------------------
  // ESTADO TICKET IMPRIMIBLE (80MM TÉRMICO)
  // ---------------------------------------------------------------------------
  const [ticketModalOpen, setTicketModalOpen] = useState<boolean>(false);
  const [issuedVoucher, setIssuedVoucher] = useState<IssuedVoucher | null>(null);

  // ---------------------------------------------------------------------------
  // FILTRADOS Y CÁLCULOS
  // ---------------------------------------------------------------------------
  const filteredTables = useMemo(() => {
    if (tableFilter === "disponibles") return tables.filter((m) => !m.occupied);
    if (tableFilter === "ocupadas") return tables.filter((m) => m.occupied);
    return tables;
  }, [tables, tableFilter]);

  const filteredDishes = useMemo(() => {
    return dishes.filter((p) => {
      const matchCat = selectedCategory === "todos" || p.category === selectedCategory;
      const matchText =
        !dishSearch.trim() ||
        p.name.toLowerCase().includes(dishSearch.toLowerCase()) ||
        p.description.toLowerCase().includes(dishSearch.toLowerCase());
      return matchCat && matchText;
    });
  }, [dishes, selectedCategory, dishSearch]);

  const orderTotal = useMemo(() => {
    return orderItems.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
  }, [orderItems]);

  // Cálculos para cobro en Ventanilla
  const counterPaymentTotal = orderToCharge ? orderToCharge.total : 0;
  const counterBreakdown = useMemo(() => {
    return calculateTotals(
      orderToCharge ? orderToCharge.items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice })) : []
    );
  }, [orderToCharge]);

  const counterChangeDue = useMemo(() => {
    const given = Number(amountGiven);
    if (!given || given < counterPaymentTotal) return 0;
    return Math.round((given - counterPaymentTotal) * 100) / 100;
  }, [amountGiven, counterPaymentTotal]);

  // Cálculos para cobro móvil del Mozo
  const waiterPaymentTotal = waiterPaymentOrder ? waiterPaymentOrder.total : 0;
  const waiterChangeDue = useMemo(() => {
    const given = Number(waiterAmountGiven);
    if (!given || given < waiterPaymentTotal) return 0;
    return Math.round((given - waiterPaymentTotal) * 100) / 100;
  }, [waiterAmountGiven, waiterPaymentTotal]);

  // Listado de cobros no cobrados (comandas activas de mesas ocupadas + comandas activas para llevar)
  const uncollectedPayments = useMemo(() => {
    const pendientes: Array<{
      orderId: number;
      code: string;
      tipo: "Mesa" | "Llevar";
      identificador: string;
      orderedAt: string;
      kitchenStatus: string;
      items: OrderLineItem[];
      total: number;
      editable: boolean;
      tableObj?: TableItem;
      orderObj: OrderSummary;
    }> = [];

    // Mesas ocupadas
    for (const m of tables) {
      if (m.occupied && m.activeOrder) {
        const pedObj: OrderSummary = {
          id: m.activeOrder.id,
          orderTableId: m.activeOrder.orderTableId,
          code: m.activeOrder.code,
          orderType: "Mesa",
          orderedAt: m.activeOrder.orderedAt,
          status: m.activeOrder.status,
          table: { id: m.id, number: m.number },
          notes: m.activeOrder.tableNotes,
          items: m.activeOrder.items,
          total: m.activeOrder.total,
          editable: m.activeOrder.editable,
        };

        pendientes.push({
          orderId: m.activeOrder.id,
          code: m.activeOrder.code,
          tipo: "Mesa",
          identificador: `Mesa ${m.number}`,
          orderedAt: m.activeOrder.orderedAt,
          kitchenStatus: m.activeOrder.status,
          items: m.activeOrder.items,
          total: m.activeOrder.total,
          editable: m.activeOrder.editable,
          tableObj: m,
          orderObj: pedObj,
        });
      }
    }

    // Pedidos para llevar que aún no se cobraron
    for (const p of takeoutOrders) {
      if (p.status !== "Closed" && p.status !== "Cancelled") {
        pendientes.push({
          orderId: p.id,
          code: p.code,
          tipo: "Llevar",
          identificador: `Para Llevar (${p.code})`,
          orderedAt: p.orderedAt,
          kitchenStatus: p.status,
          items: p.items,
          total: p.total,
          editable: p.editable,
          orderObj: p,
        });
      }
    }

    return pendientes;
  }, [tables, takeoutOrders]);

  const readyOrdersForDelivery = useMemo(() => {
    const list: Array<{
      orderId: number;
      code: string;
      tipo: "Mesa" | "Llevar";
      identificador: string;
      clienteOInfo: string;
      tableNumber?: number;
      orderedAt: string;
      kitchenStatus: string;
      items: OrderLineItem[];
      total: number;
      notes: string;
      orderObj: OrderSummary;
      isDelivered: boolean;
    }> = [];

    // 1. Comandas de Mesas en Salón
    for (const m of tables) {
      if (m.occupied && m.activeOrder) {
        const pedObj: OrderSummary = {
          id: m.activeOrder.id,
          orderTableId: m.activeOrder.orderTableId,
          code: m.activeOrder.code,
          orderType: "Mesa",
          orderedAt: m.activeOrder.orderedAt,
          status: m.activeOrder.status,
          table: { id: m.id, number: m.number },
          notes: m.activeOrder.tableNotes,
          items: m.activeOrder.items,
          total: m.activeOrder.total,
          editable: m.activeOrder.editable,
        };

        const isDelivered = deliveredOrderIds.has(m.activeOrder.id);

        list.push({
          orderId: m.activeOrder.id,
          code: m.activeOrder.code,
          tipo: "Mesa",
          identificador: `Mesa #${m.number}`,
          clienteOInfo: m.activeOrder.tableNotes
            ? m.activeOrder.tableNotes
            : `Mesa en Salón (${m.capacity} comensales)`,
          tableNumber: m.number,
          orderedAt: m.activeOrder.orderedAt,
          kitchenStatus: m.activeOrder.status,
          items: m.activeOrder.items,
          total: m.activeOrder.total,
          notes: m.activeOrder.tableNotes,
          orderObj: pedObj,
          isDelivered,
        });
      }
    }

    // 2. Comandas Para Llevar en Ventanilla
    for (const p of takeoutOrders) {
      if (p.status !== "Closed" && p.status !== "Cancelled") {
        let clientName = p.notes || "Cliente en mostrador";
        if (clientName.toLowerCase().startsWith("cliente:")) {
          clientName = clientName.substring(8).trim();
        }

        const isDelivered = deliveredOrderIds.has(p.id);

        list.push({
          orderId: p.id,
          code: p.code,
          tipo: "Llevar",
          identificador: `Para Llevar — ${p.code}`,
          clienteOInfo: clientName,
          orderedAt: p.orderedAt,
          kitchenStatus: p.status,
          items: p.items,
          total: p.total,
          notes: p.notes,
          orderObj: p,
          isDelivered,
        });
      }
    }

    // Ordenar: Los que están "Served" (Listos para entregar) y no entregados van primero
    return list.sort((a, b) => {
      const aReady = a.kitchenStatus === "Served" && !a.isDelivered;
      const bReady = b.kitchenStatus === "Served" && !b.isDelivered;
      if (aReady && !bReady) return -1;
      if (!aReady && bReady) return 1;
      return new Date(a.orderedAt).getTime() - new Date(b.orderedAt).getTime();
    });
  }, [tables, takeoutOrders, deliveredOrderIds]);

  const onlyReadyCount = useMemo(() => {
    return readyOrdersForDelivery.filter(
      (o) => o.kitchenStatus === "Served" && !o.isDelivered
    ).length;
  }, [readyOrdersForDelivery]);

  const displayedDeliveryOrders = useMemo(() => {
    return readyOrdersForDelivery.filter((ord) => {
      // Filtro de estado de entrega
      if (readyStatusMode === "solo-listos") {
        if (ord.kitchenStatus !== "Served" || ord.isDelivered) {
          return false;
        }
      }

      // Filtro de origen
      if (readyFilter === "mesas" && ord.tipo !== "Mesa") return false;
      if (readyFilter === "llevar" && ord.tipo !== "Llevar") return false;

      // Búsqueda textual
      if (readySearch.trim()) {
        const q = readySearch.toLowerCase();
        const matchCode = ord.code.toLowerCase().includes(q);
        const matchIdent = ord.identificador.toLowerCase().includes(q);
        const matchClient = ord.clienteOInfo.toLowerCase().includes(q);
        const matchItems = ord.items.some((i) => (i.name || i.dishName || "").toLowerCase().includes(q));
        if (!matchCode && !matchIdent && !matchClient && !matchItems) {
          return false;
        }
      }

      return true;
    });
  }, [readyOrdersForDelivery, readyStatusMode, readyFilter, readySearch]);

  const toggleDelivered = (orderId: number, identificador: string) => {
    setDeliveredOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
        toast.info(`Comanda ${identificador} marcada como pendiente de entrega.`);
      } else {
        next.add(orderId);
        toast.success(`¡Comanda ${identificador} entregada con éxito!`);
      }
      return next;
    });
  };

  const totalPorCobrar = useMemo(() => {
    return uncollectedPayments.reduce((sum, c) => sum + c.total, 0);
  }, [uncollectedPayments]);

  // Clientes filtrados por búsqueda
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.documentNumber.toLowerCase().includes(q) ||
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        c.fullName.toLowerCase().includes(q)
    );
  }, [customers, customerSearch]);

  // ---------------------------------------------------------------------------
  // ACCIONES COMANDA
  // ---------------------------------------------------------------------------
  const openTakeTableOrder = (mesa: TableItem) => {
    if (!cashSessionState.isOpened) {
      toast.error("La caja se encuentra cerrada. Debe aperturar el turno en Caja antes de tomar pedidos.");
      setActiveTab("cashier");
      setOpenCashModal(true);
      return;
    }
    if (mesa.occupied) {
      if (mesa.activeOrder) {
        openEditOrder({
          id: mesa.activeOrder.id,
          tableNote: mesa.activeOrder.tableNotes,
          items: mesa.activeOrder.items,
          orderType: "Mesa",
          status: mesa.activeOrder.status,
          table: { id: mesa.id, number: mesa.number },
        });
        return;
      }
      toast.info(`La Mesa ${mesa.number} ya tiene un pedido en curso.`);
      return;
    }
    setIsEditing(false);
    setEditingOrderId(null);
    setSelectedTable(mesa);
    setAdditionalTables([]);
    setIsTakeaway(false);
    setTableNote("");
    setOrderItems([]);
    setSelectedCategory("todos");
    setDishSearch("");
    setOrderModalOpen(true);
  };

  const openTakeawayOrder = () => {
    if (!cashSessionState.isOpened) {
      toast.error("La caja se encuentra cerrada. Debe aperturar el turno en Caja antes de tomar pedidos.");
      setActiveTab("cashier");
      setOpenCashModal(true);
      return;
    }
    setIsEditing(false);
    setEditingOrderId(null);
    setSelectedTable(null);
    setAdditionalTables([]);
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
    notes?: string;
    items: OrderLineItem[];
    orderType: string;
    status?: string;
    table?: { id: number; number: number } | null;
  }) => {
    if (pedido.status && !canEditOrder(pedido.status)) {
      toast.warning("El pedido no puede ser modificado porque ya fue cerrado o cancelado.");
      return;
    }
    setIsEditing(true);
    setEditingOrderId(pedido.id);
    if (pedido.table) {
      setSelectedTable({
        id: pedido.table.id,
        number: pedido.table.number,
        capacity: 4,
        occupied: true,
        activeOrder: null,
      });
    }
    setAdditionalTables([]);
    setIsTakeaway(pedido.orderType === "Llevar");
    setTableNote(pedido.tableNote || pedido.notes || "");
    setOrderItems(
      pedido.items.map((it) => ({
        dishId: it.dishId,
        name: it.name || (it as any).dishName || "",
        unitPrice: it.unitPrice,
        quantity: it.quantity,
        notes: it.notes || "",
        dishStatus: it.dishStatus,
      }))
    );
    setSelectedCategory("todos");
    setDishSearch("");
    setOrderModalOpen(true);
  };

  const addOrderItem = (plato: MenuDish) => {
    setOrderItems((prev) => {
      const idx = prev.findIndex((it) => it.dishId === plato.id);
      if (idx >= 0) {
        return prev.map((it, i) =>
          i === idx ? { ...it, quantity: it.quantity + 1 } : it
        );
      }
      return [
        ...prev,
        {
          dishId: plato.id,
          name: plato.name,
          unitPrice: plato.price,
          quantity: 1,
          notes: "",
        },
      ];
    });
  };

  const changeItemQuantity = (index: number, delta: number) => {
    setOrderItems((prev) => {
      const nextQty = prev[index].quantity + delta;
      if (nextQty <= 0) {
        return prev.filter((_, i) => i !== index);
      }
      return prev.map((it, i) =>
        i === index ? { ...it, quantity: nextQty } : it
      );
    });
  };

  const eliminarItem = (index: number) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
  };

  const saveOrder = async () => {
    if (!cashSessionState.isOpened && !isEditing) {
      toast.error("La caja se encuentra cerrada. Debe aperturar el turno en Caja antes de registrar pedidos.");
      setActiveTab("cashier");
      setOpenCashModal(true);
      return;
    }

    if (orderItems.length === 0) {
      toast.warning("Debe agregar al menos un plato a la comanda.");
      return;
    }

    try {
      setSavingOrder(true);
      if (isEditing && editingOrderId) {
        await editOrder(editingOrderId, {
          notes: tableNote,
          items: orderItems.map((it) => ({
            dishId: it.dishId,
            quantity: it.quantity,
            notes: it.notes,
            dishStatus: (it as any).dishStatus,
          })),
        });
        toast.success("Comanda actualizada. Nuevos platos registrados y enviados.");
      } else {
        await createOrder({
          orderType: isTakeaway ? "Llevar" : "Mesa",
          tableId: isTakeaway ? undefined : selectedTable?.id,
          additionalTables: !isTakeaway && additionalTables.length > 0 ? additionalTables : undefined,
          notes: tableNote,
          items: orderItems.map((it) => ({
            dishId: it.dishId,
            quantity: it.quantity,
            notes: it.notes,
          })),
        });
        toast.success(
          isTakeaway
            ? "Pedido para llevar registrado con éxito."
            : additionalTables.length > 0
              ? `Mesa ${selectedTable?.number} ocupada con ${additionalTables.length} mesa(s) unida(s). Comanda enviada a cocina.`
              : `Mesa ${selectedTable?.number} ocupada. Comanda enviada a cocina.`
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

  const changeKitchenStatus = async (orderIdParam: number, newStatus: "Preparing" | "Served") => {
    try {
      await updateOrderStatus(orderIdParam, newStatus);
      const statusLabel =
        newStatus === "Preparing" ? "Preparando" : newStatus === "Served" ? "Servido" : newStatus;
      toast.success(`Pedido actualizado a estado: ${statusLabel}`);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "No se pudo actualizar el estado.");
    }
  };

  // Cancelación de comanda con auditoría y liberación de mesas
  const openCancelModal = (pedido: OrderSummary) => {
    if (pedido.status === "Closed") {
      toast.warning("No se puede cancelar un pedido que ya fue cobrado y cerrado.");
      return;
    }
    setOrderToCancel(pedido);
    setCancelReason("");
    setCancelUser("Mozo Salón");
    setCancelModalOpen(true);
  };

  const executeCancellation = async () => {
    if (!orderToCancel) return;
    if (!cancelReason.trim()) {
      toast.warning("Debe indicar el motivo de la cancelación.");
      return;
    }

    try {
      setCancellingOrder(true);
      const res = await cancelOrder(
        orderToCancel.id,
        cancelReason.trim(),
        cancelUser.trim() || "Mozo Salón"
      );
      toast.success(res.message || "Pedido cancelado, mesa(s) liberada(s) y stock devuelto exitosamente.");
      setCancelModalOpen(false);
      setOrderToCancel(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Error al cancelar la comanda.");
    } finally {
      setCancellingOrder(false);
    }
  };

  // ---------------------------------------------------------------------------
  // FUNCIONES AUXILIARES PARA PAGAR EN PARTES (DINÁMICO)
  // ---------------------------------------------------------------------------
  const addPaymentPart = (destino: "caja" | "mozo") => {
    const fnSet = destino === "caja" ? setPaymentParts : setWaiterPaymentParts;
    fnSet((prev) => {
      const usedIds = new Set(prev.map((p) => p.paymentTypeId));
      const availableId = paymentTypes.find((t) => !usedIds.has(t.id))?.id || paymentTypes[0]?.id || 1;
      return [
        ...prev,
        {
          id: `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          paymentTypeId: availableId,
          monto: "",
        },
      ];
    });
  };

  const removePaymentPart = (id: string, destino: "caja" | "mozo") => {
    const fnSet = destino === "caja" ? setPaymentParts : setWaiterPaymentParts;
    fnSet((prev) => {
      if (prev.length <= 2) {
        toast.warning("Debe mantener al menos 2 partes para dividir el pago.");
        return prev;
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  const updatePaymentPart = (
    id: string,
    campo: "paymentTypeId" | "monto" | "cashGiven",
    valor: any,
    destino: "caja" | "mozo"
  ) => {
    const fnSet = destino === "caja" ? setPaymentParts : setWaiterPaymentParts;
    fnSet((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [campo]: valor } : p))
    );
  };

  const autofillRemaining = (partId: string, accountTotal: number, destino: "caja" | "mozo") => {
    const currentParts = destino === "caja" ? paymentParts : waiterPaymentParts;
    const fnSet = destino === "caja" ? setPaymentParts : setWaiterPaymentParts;
    const othersSum = currentParts
      .filter((p) => p.id !== partId)
      .reduce((sum, p) => sum + (Number(p.monto) || 0), 0);
    const remaining = Math.max(0, Math.round((accountTotal - othersSum) * 100) / 100);
    fnSet((prev) =>
      prev.map((p) =>
        p.id === partId ? { ...p, monto: remaining > 0 ? String(remaining) : "" } : p
      )
    );
  };

  // ---------------------------------------------------------------------------
  // ACCIONES COBRO EN VENTANILLA / CAJA
  // ---------------------------------------------------------------------------
  const goToCounterPayment = (pedido: OrderSummary, origen: string) => {
    setOrderToCharge(pedido);
    setPaymentSource(origen);
    setAmountGiven("");
    const idEf = paymentTypes.find((t) => t.name.toLowerCase().includes("efectivo"))?.id ?? 1;
    const idYap = paymentTypes.find((t) => t.name.toLowerCase().includes("yape"))?.id ?? 2;
    setPaymentParts([
      { id: "p-1", paymentTypeId: idEf, monto: "" },
      { id: "p-2", paymentTypeId: idYap, monto: "" },
    ]);
    goToTab("cashier");
  };

  const executeCounterPayment = async () => {
    if (!orderToCharge) {
      toast.warning("Selecciona una comanda a cobrar.");
      return;
    }

    if (!cashSessionState.isOpened) {
      toast.error("La caja se encuentra cerrada. Debe aperturar el turno antes de cobrar.");
      setOpenCashModal(true);
      return;
    }

    // Validar documento si se ingresó
    if (customerDoc.trim()) {
      const tipoPer = voucherType === "Factura" ? "Legal" : "Natural";
      const docValidation = validateCustomerDocument(tipoPer, customerDoc.trim());
      if (!docValidation.isValid) {
        toast.error(docValidation.error || "Documento de cliente no válido.");
        return;
      }
    }

    const salePayload: any = {
      orderId: orderToCharge.id,
      cashSessionId: cashSessionState.activeSession?.id,
      voucherType: voucherType,
      customer: {
        documentNumber: customerDoc.trim() || undefined,
        firstName: customerName.trim() || (voucherType === "Factura" ? "EMPRESA S.A.C." : "CLIENTE GENERAL"),
        personType: voucherType === "Factura" ? "Legal" : "Natural",
        phone: customerPhone.trim() || undefined,
      },
    };

    if (paymentMethod === "mixto") {
      const isListValid = paymentParts
        .map((p) => ({
          paymentTypeId: p.paymentTypeId, amount: Math.round((Number(p.monto) || 0) * 100) / 100,
        }))
        .filter((p) => p.amount > 0);

      if (isListValid.length < 2) {
        toast.error("Para pagar en partes debe ingresar al menos 2 formas de pago con montos mayores a S/ 0.");
        return;
      }

      const partsSum = Math.round(isListValid.reduce((sum, p) => sum + p.amount, 0) * 100) / 100;

      if (Math.abs(partsSum - counterPaymentTotal) > 0.05) {
        toast.error(
          `La suma de las partes (S/ ${partsSum.toFixed(2)}) debe coincidir con el total de la cuenta (S/ ${counterPaymentTotal.toFixed(2)}).`
        );
        return;
      }

      salePayload.pagos = isListValid;
      salePayload.amountReceived = counterPaymentTotal;
    } else {
      const tpObj = paymentTypes.find((t) => {
        const n = t.name.toLowerCase();
        if (paymentMethod === "efectivo") return n.includes("efectivo");
        if (paymentMethod === "yape") return n.includes("yape");
        if (paymentMethod === "pos") return n.includes("pos") || n.includes("tarjeta");
        return false;
      });

      const paymentTypeId = tpObj?.id || (paymentTypes[0]?.id ?? 1);

      if (paymentMethod === "efectivo" && amountGiven) {
        const changeValidation = calculateChangeAmount(counterPaymentTotal, Number(amountGiven));
        if (!changeValidation.isValid) {
          toast.error(changeValidation.error || "Monto en efectivo insuficiente.");
          return;
        }
      }

      salePayload.paymentTypeId = paymentTypeId;
      salePayload.amountReceived = paymentMethod === "efectivo" && amountGiven ? Number(amountGiven) : counterPaymentTotal;
      salePayload.gateway = {
        provider: "mercado_pago",
        mode: paymentMethod === "pos" ? "tap_to_pay" : paymentMethod === "yape" ? "qr" : "manual",
      };
    }

    try {
      setProcessingSale(true);
      const res = await registerSale(salePayload);

      toast.success(res.message);
      setIssuedVoucher(res.invoice);
      setTicketModalOpen(true);

      setOrderToCharge(null);
      setPaymentSource("");
      setAmountGiven("");
      const idEf = paymentTypes.find((t) => t.name.toLowerCase().includes("efectivo"))?.id ?? 1;
      const idYap = paymentTypes.find((t) => t.name.toLowerCase().includes("yape"))?.id ?? 2;
      setPaymentParts([
        { id: "p-1", paymentTypeId: idEf, monto: "" },
        { id: "p-2", paymentTypeId: idYap, monto: "" },
      ]);
      setCustomerDoc("");
      setCustomerName("");
      setCustomerPhone("");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Error al procesar el cobro en ventanilla.");
    } finally {
      setProcessingSale(false);
    }
  };

  // ---------------------------------------------------------------------------
  // ACCIONES COBRO MÓVIL / MOZO (CELULAR / TAP TO PAY / YAPE / EFECTIVO / PARTES)
  // ---------------------------------------------------------------------------
  const openWaiterPayment = (pedido: OrderSummary) => {
    setWaiterPaymentOrder(pedido);
    setWaiterPaymentMethod("pos");
    setWaiterAmountGiven("");
    setTapToPayDetectado(false);
    const idEf = paymentTypes.find((t) => t.name.toLowerCase().includes("efectivo"))?.id ?? 1;
    const idYap = paymentTypes.find((t) => t.name.toLowerCase().includes("yape"))?.id ?? 2;
    setWaiterPaymentParts([
      { id: "pm-1", paymentTypeId: idEf, monto: "" },
      { id: "pm-2", paymentTypeId: idYap, monto: "" },
    ]);
    setWaiterPaymentModalOpen(true);
  };

  const executeWaiterPayment = async () => {
    if (!waiterPaymentOrder) return;

    let waiterSalePayload: any;

    if (waiterPaymentMethod === "mixto") {
      const isListValid = waiterPaymentParts
        .map((p) => ({
          paymentTypeId: p.paymentTypeId, amount: Math.round((Number(p.monto) || 0) * 100) / 100,
        }))
        .filter((p) => p.amount > 0);

      if (isListValid.length < 2) {
        toast.error("Para pagar en partes debe ingresar al menos 2 formas de pago con montos mayores a S/ 0.");
        return;
      }

      const partsSum = Math.round(isListValid.reduce((sum, p) => sum + p.amount, 0) * 100) / 100;

      if (Math.abs(partsSum - waiterPaymentTotal) > 0.05) {
        toast.error(
          `La suma de las partes (S/ ${partsSum.toFixed(2)}) debe coincidir con el total de la cuenta (S/ ${waiterPaymentTotal.toFixed(2)}).`
        );
        return;
      }

      waiterSalePayload = {
        orderId: waiterPaymentOrder.id,
        cashSessionId: cashSessionState.activeSession?.id,
        voucherType: "Boleta",
        customer: {
          documentNumber: "00000000",
          firstName: "CLIENTE SALÓN",
          personType: "Natural",
        },
        payments: isListValid,
        amountReceived: waiterPaymentTotal,
      };
    } else {
      const tpObj = paymentTypes.find((t) => {
        const n = t.name.toLowerCase();
        if (waiterPaymentMethod === "efectivo") return n.includes("efectivo");
        if (waiterPaymentMethod === "yape") return n.includes("yape");
        if (waiterPaymentMethod === "pos") return n.includes("pos") || n.includes("tarjeta");
        return false;
      });

      const paymentTypeId = tpObj?.id || (paymentTypes[0]?.id ?? 1);

      if (waiterPaymentMethod === "efectivo" && waiterAmountGiven) {
        const changeValidation = calculateChangeAmount(waiterPaymentTotal, Number(waiterAmountGiven));
        if (!changeValidation.isValid) {
          toast.error(changeValidation.error || "Monto recibido insuficiente.");
          return;
        }
      }

      waiterSalePayload = {
        orderId: waiterPaymentOrder.id,
        cashSessionId: cashSessionState.activeSession?.id,
        paymentTypeId: paymentTypeId,
        voucherType: "Boleta",
        customer: {
          documentNumber: "00000000",
          firstName: "CLIENTE SALÓN",
          personType: "Natural",
        },
        amountReceived: waiterPaymentMethod === "efectivo" && waiterAmountGiven ? Number(waiterAmountGiven) : waiterPaymentTotal,
        gateway: {
          provider: "mercado_pago",
          mode: waiterPaymentMethod === "pos" ? "tap_to_pay" : waiterPaymentMethod === "yape" ? "qr" : "manual",
        },
      };
    }

    try {
      setProcessingWaiterPayment(true);
      const res = await registerSale(waiterSalePayload);

      toast.success(`¡Cobro realizado por el Mozo! Mesa liberada con éxito.`);
      setIssuedVoucher(res.invoice);
      setWaiterPaymentModalOpen(false);
      setTicketModalOpen(true);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Error al procesar el cobro móvil.");
    } finally {
      setProcessingWaiterPayment(false);
    }
  };

  // ---------------------------------------------------------------------------
  // ACCIONES APERTURA Y CIERRE DE CAJA
  // ---------------------------------------------------------------------------
  const handleOpenCashSession = async () => {
    const initAmt = parseFloat(initialCashInput);
    if (isNaN(initAmt) || initAmt < 0) {
      toast.error("Ingrese un monto inicial válido mayor o igual a 0.");
      return;
    }
    try {
      setSavingCashSession(true);
      const res = await openCashSession({
        initialAmount: initAmt,
        notesOpening: openNotesInput.trim(),
        denominations: openDenominations,
      });
      toast.success(res.message);
      setOpenCashModal(false);
      const updatedStatus = await getCashSessionStatus();
      setCashSessionState(updatedStatus);
    } catch (err: any) {
      toast.error(err.message || "Error al abrir la caja.");
    } finally {
      setSavingCashSession(false);
    }
  };

  const handleCloseCashSession = async () => {
    if (!cashSessionState.activeSession) return;
    const counted = parseFloat(countedCashInput);
    if (isNaN(counted) || counted < 0) {
      toast.error("Ingrese un monto contado válido.");
      return;
    }
    try {
      setSavingCashSession(true);
      const res = await closeCashSession(cashSessionState.activeSession.id, {
        countedAmount: counted,
        notesClosing: closeNotesInput.trim(),
        denominations: closeDenominations,
      });
      toast.success(res.message);
      setLastClosedAudit(res.audit);
      setCloseCashModal(false);
      setAuditModalOpen(true);
      const updatedStatus = await getCashSessionStatus();
      setCashSessionState(updatedStatus);
    } catch (err: any) {
      toast.error(err.message || "Error al cerrar la caja.");
    } finally {
      setSavingCashSession(false);
    }
  };

  const handleRegisterExpense = async () => {
    if (!cashSessionState.activeSession) {
      toast.error("No hay una sesión de caja activa.");
      return;
    }
    const amt = parseFloat(expenseAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Ingrese un monto válido mayor a S/ 0.00.");
      return;
    }
    if (!expenseReason.trim() || expenseReason.trim().length < 3) {
      toast.error("Indique el motivo o justificación de la salida de dinero.");
      return;
    }
    try {
      setSavingExpense(true);
      const res = await registerCashMovement({
        sessionId: cashSessionState.activeSession.id,
        type: "EXPENSE",
        amount: amt,
        reason: expenseReason.trim(),
      });
      toast.success(res.message);
      setExpenseModalOpen(false);
      setExpenseAmount("");
      setExpenseReason("");
      const updatedStatus = await getCashSessionStatus();
      setCashSessionState(updatedStatus);
    } catch (err: any) {
      toast.error(err.message || "Error al registrar la salida de dinero.");
    } finally {
      setSavingExpense(false);
    }
  };

  // ---------------------------------------------------------------------------
  // ACCIONES CLIENTE
  // ---------------------------------------------------------------------------
  const registerNewCustomer = async () => {
    if (!newCustomerName.trim()) {
      toast.warning("El nombre o razón social es obligatorio.");
      return;
    }

    const val = validateCustomerDocument(newCustomerType, newCustomerDoc.trim());
    if (!val.isValid) {
      toast.error(val.error || "Documento inválido.");
      return;
    }

    try {
      setSavingCustomer(true);
      const res = await createCustomer({
        personType: newCustomerType,
        documentNumber: newCustomerDoc.trim() || undefined,
        firstName: newCustomerName.trim(),
        lastName: newCustomerType === "Natural" ? newCustomerLastName.trim() : undefined,
        phone: newCustomerPhone.trim() || undefined,
      });

      toast.success(res.message);
      setNewCustomerModalOpen(false);
      setNewCustomerDoc("");
      setNewCustomerName("");
      setNewCustomerLastName("");
      setNewCustomerPhone("");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "No se pudo registrar el cliente.");
    } finally {
      setSavingCustomer(false);
    }
  };

  const selectCustomerForSale = (cli: CustomerItem) => {
    setCustomerDoc(cli.documentNumber);
    setCustomerName(cli.fullName);
    setCustomerPhone(cli.phone);
    setVoucherType(cli.personType === "Legal" ? "Factura" : "Boleta");
    goToTab("cashier");
    toast.info(`Cliente ${cli.fullName} seleccionado para facturación.`);
  };

  return (
    <>
      {/* Header Superior Responsivo */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-slate-200 pl-12 pr-3 sm:px-6 py-3.5 flex items-center justify-between gap-2 shadow-xs">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-red-700 flex items-center justify-center text-white shadow-xs shrink-0">
            <Utensils className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">
                Módulo de Ventas &amp; Salón
              </h1>
              <Badge className="hidden sm:inline-flex bg-red-100 text-red-800 text-[10px] font-bold border-none shrink-0">
                ERP Pollería
              </Badge>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 truncate">
              Mesas, Clientes, Ventas Diarias, Cobro Mozo &amp; Ventanilla
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Button
            onClick={openTakeawayOrder}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-8 sm:h-9 px-2.5 sm:px-4 rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">+ Para Llevar</span>
            <span className="sm:hidden">+ Llevar</span>
          </Button>

          <div className="hidden lg:flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200 text-xs font-mono font-semibold text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{currentTime || "12:00:00"}</span>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => void loadData()}
            title="Refrescar datos"
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      {/* Barra de Navegación por Pestañas del Módulo Ventas (Scroll horizontal en móvil) */}
      <div className="px-3 sm:px-6 pt-3 bg-white border-b border-slate-200 flex items-center overflow-x-auto no-scrollbar gap-1 sm:gap-2">
        {/* Pestaña 1: Mesas y Salón */}
        <button
          type="button"
          onClick={() => goToTab("tables")}
          className={`px-3 sm:px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-1.5 sm:gap-2 border-b-2 whitespace-nowrap transition-all cursor-pointer ${activeTab === "tables"
            ? "border-red-700 text-red-700 dark:text-white dark:border-white bg-red-50/60 dark:bg-slate-800/60"
            : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50 hover:dark:bg-slate-800"
            }`}
        >
          <LayoutGrid className="w-4 h-4 shrink-0" />
          <span className="sm:hidden">Mesas ({summary.occupied}/{summary.total})</span>
          <span className="hidden sm:inline">Salón de Mesas ({summary.occupied}/{summary.total})</span>
        </button>

        {/* Pestaña: Pedidos Listos para Entrega */}
        <button
          type="button"
          onClick={() => goToTab("kitchen")}
          className={`px-3 sm:px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-1.5 sm:gap-2 border-b-2 whitespace-nowrap transition-all cursor-pointer ${activeTab === "kitchen"
            ? "border-red-700 text-red-700 dark:text-white dark:border-white bg-red-50/60 dark:bg-slate-800/60"
            : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
        >
          <BellRing className={`w-4 h-4 shrink-0 ${onlyReadyCount > 0 ? "text-red-600 animate-bounce" : ""}`} />
          <span className="sm:hidden">Listos {onlyReadyCount > 0 ? `(${onlyReadyCount})` : ""}</span>
          <span className="hidden sm:inline">Pedidos Listos {onlyReadyCount > 0 ? `(${onlyReadyCount})` : ""}</span>
          {onlyReadyCount > 0 && (
            <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-red-600 text-white shadow-xs">
              {onlyReadyCount}
            </span>
          )}
        </button>

        {/* Pestaña 2: Cobros No Cobrados */}
        <button
          type="button"
          onClick={() => goToTab("payments")}
          className={`px-3 sm:px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-1.5 sm:gap-2 border-b-2 whitespace-nowrap transition-all cursor-pointer ${activeTab === "payments"
            ? "border-red-700 text-red-700 dark:text-white dark:border-white bg-red-50/60 dark:bg-slate-800/60"
            : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
        >
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="sm:hidden">Cobros ({uncollectedPayments.length})</span>
          <span className="hidden sm:inline">Cobros No Cobrados ({uncollectedPayments.length})</span>
        </button>

        {/* Pestaña 3: Caja y Cobro en Ventanilla */}
        <button
          type="button"
          onClick={() => goToTab("cashier")}
          className={`px-3 sm:px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-1.5 sm:gap-2 border-b-2 whitespace-nowrap transition-all cursor-pointer ${activeTab === "cashier"
            ? "border-red-700 text-red-700 dark:text-white dark:border-white bg-red-50/60 dark:bg-slate-800/60"
            : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
        >
          <CircleDollarSign className="w-4 h-4 shrink-0" />
          <span className="sm:hidden">Caja {orderToCharge ? `(${paymentSource})` : ""}</span>
          <span className="hidden sm:inline">Caja y Ventanilla {orderToCharge ? `(${paymentSource})` : ""}</span>
        </button>

        {/* Pestaña 4: Clientes */}
        <button
          type="button"
          onClick={() => goToTab("customers")}
          className={`px-3 sm:px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-1.5 sm:gap-2 border-b-2 whitespace-nowrap transition-all cursor-pointer ${activeTab === "customers"
            ? "border-red-700 text-red-700 dark:text-white dark:border-white bg-red-50/60 dark:bg-slate-800/60"
            : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          <span>Clientes ({customers.length})</span>
        </button>

        {/* Pestaña 5: Ventas Diarias & Facturas */}
        <button
          type="button"
          onClick={() => goToTab("invoices")}
          className={`px-3 sm:px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-1.5 sm:gap-2 border-b-2 whitespace-nowrap transition-all cursor-pointer ${activeTab === "invoices"
            ? "border-red-700 text-red-700 dark:text-white dark:border-white bg-red-50/60 dark:bg-slate-800/60"
            : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
        >
          <Receipt className="w-4 h-4 shrink-0" />
          <span className="sm:hidden">Ventas ({saleVouchers.length})</span>
          <span className="hidden sm:inline">Ventas Diarias &amp; Facturas ({saleVouchers.length})</span>
        </button>
      </div>

      {/* =================================================================== */}
      {/* PESTAÑA 1: SALÓN DE MESAS Y PEDIDOS */}
      {/* =================================================================== */}
      {activeTab === "tables" && (
        <main className="flex-1 w-full min-w-0 p-3 sm:p-6 flex flex-col gap-5">
          {/* Alerta si la caja está cerrada */}
          {!cashSessionState.isOpened && (
            <div className="p-3 bg-amber-50/90 border border-amber-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-amber-900 shadow-2xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Caja Cerrada:</strong> Debe aperturar el turno de caja antes de poder abrir comandas y tomar pedidos.
                </span>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setActiveTab("cashier");
                  setOpenCashModal(true);
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-7 rounded-lg shadow-xs cursor-pointer shrink-0 self-end sm:self-auto"
              >
                Abrir Caja Ahora
              </Button>
            </div>
          )}

          {/* Barra de Filtros y Leyenda */}
          <Card className="bg-white rounded-xl shadow-xs border border-slate-200 p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-700 mr-1">Filtrar Salón:</span>
              <Button
                size="sm"
                variant={tableFilter === "todas" ? "default" : "outline"}
                onClick={() => setTableFilter("todas")}
                className={`text-xs font-bold h-8 rounded-lg cursor-pointer ${tableFilter === "todas" ? "bg-red-700 hover:bg-red-800 text-white" : ""
                  }`}
              >
                Todas ({summary.total})
              </Button>
              <Button
                size="sm"
                variant={tableFilter === "disponibles" ? "default" : "outline"}
                onClick={() => setTableFilter("disponibles")}
                className={`text-xs font-bold h-8 rounded-lg cursor-pointer ${tableFilter === "disponibles" ? "bg-red-700 hover:bg-red-800 text-white" : ""
                  }`}
              >
                Disponibles ({summary.available})
              </Button>
              <Button
                size="sm"
                variant={tableFilter === "ocupadas" ? "default" : "outline"}
                onClick={() => setTableFilter("ocupadas")}
                className={`text-xs font-bold h-8 rounded-lg cursor-pointer ${tableFilter === "ocupadas" ? "bg-red-700 hover:bg-red-800 text-white" : ""
                  }`}
              >
                Ocupadas ({summary.occupied})
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
            {filteredTables.map((mesa) => {
              const hasOrder = mesa.occupied && mesa.activeOrder;
              const pedido = mesa.activeOrder;

              return (
                <Card
                  key={mesa.id}
                  className={`rounded-2xl transition-all duration-200 overflow-hidden flex flex-col justify-between ${mesa.occupied
                    ? "border-red-200 bg-white shadow-sm ring-1 ring-red-100"
                    : "border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md cursor-pointer"
                    }`}
                >
                  <div>
                    {/* Cabecera de la Mesa */}
                    <div
                      className={`p-3.5 flex items-center justify-between gap-2 flex-wrap border-b ${mesa.occupied
                        ? "bg-red-50/80 dark:bg-red-900/50 border-red-100"
                        : "bg-emerald-50/50 dark:bg-emerald-900/50 border-slate-100"
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-3 h-3 rounded-full ${mesa.occupied ? "bg-red-600 animate-pulse" : "bg-emerald-500"
                            }`}
                        />
                        <h3 className="font-bold text-sm sm:text-base text-slate-900">
                          Mesa {mesa.number}
                        </h3>
                        {hasOrder && pedido?.tableNotes?.includes("Mesas unidas:") && (
                          <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] font-bold">
                            {pedido.tableNotes.match(/\[Mesas unidas:\s*([0-9,\s]+)\]/i)?.[0].replace("[", "").replace("]", "")}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="secondary"
                          className="bg-white/80 text-[10px] font-semibold text-slate-600 border border-slate-200"
                        >
                          <Users className="w-3 h-3 mr-1 text-slate-400" />
                          Aforo {mesa.capacity}
                        </Badge>
                        <Badge
                          className={`text-[10px] font-bold border-none ${mesa.occupied
                            ? "bg-red-600 text-white"
                            : "bg-emerald-600 text-white"
                            }`}
                        >
                          {mesa.occupied ? "Ocupada" : "Libre"}
                        </Badge>
                      </div>
                    </div>

                    {/* Cuerpo de la Mesa */}
                    <div className="p-3.5">
                      {hasOrder && pedido ? (
                        <div className="flex flex-col gap-2.5">
                          {/* Meta del pedido */}
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span className="font-mono font-semibold text-slate-700">
                              {pedido.code}
                            </span>
                            <span className="flex items-center gap-1 text-[11px]">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {new Date(pedido.orderedAt).toLocaleTimeString("es-PE", {
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
                              {pedido.status === "Received" && (
                                <button
                                  onClick={() => changeKitchenStatus(pedido.id, "Preparing")}
                                  className="bg-blue-100 hover:bg-blue-200 text-blue-800 text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors cursor-pointer"
                                  title="Pasar a Preparando"
                                >
                                  Recibido → Iniciar
                                </button>
                              )}
                              {pedido.status === "Preparing" && (
                                <button
                                  onClick={() => changeKitchenStatus(pedido.id, "Served")}
                                  className="bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors cursor-pointer"
                                  title="Marcar como Servido"
                                >
                                  Preparando → Servir
                                </button>
                              )}
                              {pedido.status === "Served" && (
                                <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                                  ✓ Servido en Mesa
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Observación de la mesa */}
                          {pedido.tableNotes && (
                            <p className="text-[11px] text-amber-800 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200/60 italic line-clamp-1">
                              💬 &quot;{pedido.tableNotes}&quot;
                            </p>
                          )}

                          {/* Detalle rápido de platos */}
                          <div className="bg-slate-50 rounded-xl p-2.5 max-h-36 overflow-y-auto border border-slate-100 flex flex-col gap-1">
                            {pedido.items.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between text-xs text-slate-700 py-0.5 border-b border-slate-200/50 last:border-none"
                              >
                                <span className="line-clamp-1 flex-1 pr-1">
                                  <strong className="text-red-700 mr-1.5 font-mono">
                                    {item.quantity}x
                                  </strong>
                                  {item.name}
                                  {item.notes && (
                                    <span className="text-[10px] text-amber-700 italic ml-1">
                                      ({item.notes})
                                    </span>
                                  )}
                                </span>
                                <span className="font-semibold shrink-0 ml-1">
                                  S/ {item.subtotal.toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Total Consumido */}
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                            <span className="text-xs font-bold text-slate-600">Total Cuenta:</span>
                            <span className="text-base font-extrabold text-red-700">
                              {formatCurrency(pedido.total)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => openTakeTableOrder(mesa)}
                          className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-emerald-700 transition-colors cursor-pointer"
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
                  <div className="p-3 border-t border-slate-100 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col gap-2">
                    {mesa.occupied && pedido ? (
                      <>
                        {/* Botón principal: Adicionar / Agregar más platos al pedido */}
                        <Button
                          onClick={() =>
                            openEditOrder({
                              id: pedido.id,
                              tableNote: pedido.tableNotes,
                              items: pedido.items,
                              orderType: "Mesa",
                              status: pedido.status,
                              table: { id: mesa.id, number: mesa.number },
                            })
                          }
                          className="w-full bg-red-700 hover:bg-red-800 text-white font-bold text-xs h-9 rounded-xl flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>+ Adicionar / Agregar Platos</span>
                        </Button>

                        {/* Botón para Cobro Móvil desde el Mozo */}
                        <Button
                          onClick={() =>
                            openWaiterPayment({
                              id: pedido.id,
                              orderTableId: pedido.orderTableId,
                              code: pedido.code,
                              orderType: "Mesa",
                              orderedAt: pedido.orderedAt,
                              status: pedido.status,
                              table: { id: mesa.id, number: mesa.number },
                              notes: pedido.tableNotes,
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
                          {/* Ver Detalle Completo de la Comanda */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setViewOrderModal({
                                open: true,
                                order: {
                                  id: pedido.id,
                                  orderTableId: pedido.orderTableId,
                                  code: pedido.code,
                                  orderType: "Mesa",
                                  orderedAt: pedido.orderedAt,
                                  status: pedido.status,
                                  table: { id: mesa.id, number: mesa.number },
                                  notes: pedido.tableNotes,
                                  items: pedido.items,
                                  total: pedido.total,
                                  editable: pedido.editable,
                                },
                                tableName: `Mesa ${mesa.number}`,
                              })
                            }
                            className="text-xs font-semibold h-8 rounded-lg border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1 text-slate-500" />
                            Ver Detalle
                          </Button>

                          {/* Enviar a Cobro en Ventanilla */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              goToCounterPayment(
                                {
                                  id: pedido.id,
                                  orderTableId: pedido.orderTableId,
                                  code: pedido.code,
                                  orderType: "Mesa",
                                  orderedAt: pedido.orderedAt,
                                  status: pedido.status,
                                  table: { id: mesa.id, number: mesa.number },
                                  notes: pedido.tableNotes,
                                  items: pedido.items,
                                  total: pedido.total,
                                  editable: pedido.editable,
                                },
                                `Mesa ${mesa.number}`
                              )
                            }
                            className="text-xs font-semibold h-8 rounded-lg border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
                          >
                            <Receipt className="w-3.5 h-3.5 mr-1 text-slate-500" />
                            A Ventanilla
                          </Button>
                        </div>

                        {/* Cancelar Comanda con trazabilidad */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            openCancelModal({
                              id: pedido.id,
                              orderTableId: pedido.orderTableId,
                              code: pedido.code,
                              orderType: "Mesa",
                              orderedAt: pedido.orderedAt,
                              status: pedido.status,
                              table: { id: mesa.id, number: mesa.number },
                              notes: pedido.tableNotes,
                              items: pedido.items,
                              total: pedido.total,
                              editable: pedido.editable,
                            })
                          }
                          className="w-full text-[11px] font-semibold h-7 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1 text-rose-500" />
                          Cancelar Comanda
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={() => openTakeTableOrder(mesa)}
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
      {/* PESTAÑA: PEDIDOS LISTOS PARA ENTREGA (MOZOS Y DESPACHO) */}
      {/* =================================================================== */}
      {activeTab === "kitchen" && (
        <main className="flex-1 w-full min-w-0 p-3 sm:p-6 flex flex-col gap-5">
          {/* Tarjetas resumen de estado de entrega */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <Card className="bg-emerald-50 border-emerald-200 p-4 rounded-2xl flex items-center gap-3 shadow-xs">
              <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <BellRing className={`w-6 h-6 ${onlyReadyCount > 0 ? "animate-bounce" : ""}`} />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                  Listos para Servir
                </span>
                <p className="text-2xl font-black text-emerald-950">
                  {onlyReadyCount} {onlyReadyCount === 1 ? "Comanda" : "Comandas"}
                </p>
                <p className="text-[11px] text-emerald-700 font-medium truncate">
                  {onlyReadyCount > 0 ? "Esperando que el mozo las retire" : "Sin platos pendientes en mostrador"}
                </p>
              </div>
            </Card>

            <Card className="bg-amber-50 border-amber-200 p-4 rounded-2xl flex items-center gap-3 shadow-xs">
              <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <ChefHat className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block">
                  En Cocina (Preparando)
                </span>
                <p className="text-2xl font-black text-amber-950">
                  {readyOrdersForDelivery.filter((o) => o.kitchenStatus === "Preparing" || o.kitchenStatus === "Received").length} Comandas
                </p>
                <p className="text-[11px] text-amber-700 font-medium truncate">
                  El personal de cocina está cocinando
                </p>
              </div>
            </Card>

            <Card className="bg-slate-50 border-slate-200 p-4 rounded-2xl flex items-center gap-3 shadow-xs">
              <div className="w-12 h-12 rounded-xl bg-slate-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                <PackageCheck className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Entregados a Mesas
                </span>
                <p className="text-2xl font-black text-slate-900">
                  {deliveredOrderIds.size} Entregas
                </p>
                <p className="text-[11px] text-slate-600 font-medium truncate">
                  Confirmados por el mesero en salón
                </p>
              </div>
            </Card>
          </div>

          {/* Barra de Filtros y Controles de Despacho */}
          <Card className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 md:items-center justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {/* Filtro: Modo de visualización */}
              <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setReadyStatusMode("solo-listos")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${readyStatusMode === "solo-listos"
                      ? "bg-white text-emerald-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  <Flame className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Solo Listos ({onlyReadyCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReadyStatusMode("todos-activos")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${readyStatusMode === "todos-activos"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  <span>Todos los Activos ({readyOrdersForDelivery.length})</span>
                </button>
              </div>

              {/* Filtro: Tipo de Pedido */}
              <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setReadyFilter("todos")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${readyFilter === "todos"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setReadyFilter("mesas")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${readyFilter === "mesas"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  Mesas
                </button>
                <button
                  type="button"
                  onClick={() => setReadyFilter("llevar")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${readyFilter === "llevar"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                  Para Llevar
                </button>
              </div>
            </div>

            {/* Búsqueda y Botón Refrescar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={readySearch}
                  onChange={(e) => setReadySearch(e.target.value)}
                  placeholder="Buscar mesa, código o cliente..."
                  className="pl-9 h-9 rounded-xl text-xs bg-slate-50 border-slate-200 focus:bg-white"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadData()}
                disabled={loading}
                className="h-9 px-3 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer font-bold text-xs shrink-0"
                title="Actualizar estado de comandas"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline ml-1">Actualizar</span>
              </Button>
            </div>
          </Card>

          {/* Listado de tarjetas de entrega */}
          {displayedDeliveryOrders.length === 0 ? (
            <Card className="p-12 text-center rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {readyStatusMode === "solo-listos"
                  ? "¡No hay comandas esperando entrega!"
                  : "No se encontraron comandas con los filtros actuales"}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mt-1 mb-4">
                {readyStatusMode === "solo-listos"
                  ? "Todos los platos que la cocina ha terminado han sido entregados a sus mesas o clientes."
                  : "Intenta cambiar el criterio de búsqueda o el tipo de pedido seleccionado."}
              </p>
              {readyStatusMode === "solo-listos" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReadyStatusMode("todos-activos")}
                  className="text-xs font-bold rounded-xl border-slate-200 cursor-pointer"
                >
                  Ver todos los pedidos en cocina ({readyOrdersForDelivery.length})
                </Button>
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedDeliveryOrders.map((order) => {
                const isReady = order.kitchenStatus === "Served";
                const isDelivered = order.isDelivered;

                return (
                  <Card
                    key={`delivery-${order.tipo}-${order.orderId}`}
                    className={`rounded-2xl border transition-all overflow-hidden flex flex-col ${isReady && !isDelivered
                        ? "border-emerald-400 bg-white shadow-md ring-2 ring-emerald-500/20"
                        : isDelivered
                          ? "border-slate-200 bg-slate-50/70 opacity-80"
                          : "border-slate-200 bg-white shadow-xs"
                      }`}
                  >
                    {/* Header de la Tarjeta */}
                    <div
                      className={`p-3.5 border-b flex items-center justify-between ${isReady && !isDelivered
                          ? "bg-emerald-50/70 border-emerald-100"
                          : isDelivered
                            ? "bg-slate-100/70 border-slate-200"
                            : "bg-slate-50 border-slate-200"
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        {order.tipo === "Mesa" ? (
                          <div className="flex items-center gap-1.5">
                            <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-red-700 text-white shadow-xs">
                              {order.identificador}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-blue-600 text-white shadow-xs flex items-center gap-1">
                              <ShoppingBag className="w-3.5 h-3.5" />
                              Para Llevar
                            </span>
                          </div>
                        )}
                        <span className="text-[11px] font-bold text-slate-500">
                          #{order.code}
                        </span>
                      </div>

                      {/* Estado Cocina Badge */}
                      {isDelivered ? (
                        <Badge className="bg-slate-200 text-slate-800 hover:bg-slate-200 font-bold text-[10px] flex items-center gap-1">
                          <Check className="w-3 h-3 text-slate-600" />
                          Entregado
                        </Badge>
                      ) : isReady ? (
                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-[10px] animate-pulse flex items-center gap-1">
                          <Flame className="w-3 h-3" />
                          LISTO PARA SERVIR
                        </Badge>
                      ) : order.kitchenStatus === "Preparing" ? (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 font-bold text-[10px]">
                          En Cocina
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100 font-bold text-[10px]">
                          Recibido
                        </Badge>
                      )}
                    </div>

                    {/* Información Destino / Cliente */}
                    <div className="px-4 pt-3 pb-2 flex items-center justify-between text-xs border-b border-slate-100 bg-white">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800 truncate">
                        {order.tipo === "Mesa" ? (
                          <>
                            <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{order.clienteOInfo}</span>
                          </>
                        ) : (
                          <>
                            <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="text-blue-900 truncate">
                              Cliente: {order.clienteOInfo}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 shrink-0 ml-2">
                        <Clock className="w-3 h-3" />
                        <span>
                          {new Date(order.orderedAt).toLocaleTimeString("es-PE", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Lista de Platos de la Comanda */}
                    <div className="p-4 flex-1 flex flex-col gap-2">
                      <div className="space-y-1.5">
                        {order.items.map((item, idx) => (
                          <div
                            key={`item-${order.orderId}-${idx}`}
                            className="flex items-start justify-between text-xs py-1 px-2 rounded-lg bg-slate-50 border border-slate-100"
                          >
                            <div className="flex-1 pr-2">
                              <span className="font-bold text-slate-900 mr-1.5">
                                {item.quantity}x
                              </span>
                              <span className="text-slate-800 font-medium">
                                {item.name || item.dishName}
                              </span>
                              {item.notes && (
                                <p className="text-[10px] text-amber-700 italic mt-0.5 font-medium">
                                  Nota: {item.notes}
                                </p>
                              )}
                            </div>
                            <span className="font-bold text-slate-600 shrink-0 text-[11px]">
                              S/ {(item.quantity * item.unitPrice).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {order.notes && order.tipo === "Mesa" && (
                        <p className="text-[11px] text-slate-500 bg-amber-50/60 border border-amber-200/60 p-2 rounded-lg italic mt-1">
                          Nota comanda: {order.notes}
                        </p>
                      )}
                    </div>

                    {/* Pie de Tarjeta con Total y Botones de Acción para Mozo */}
                    <div className="p-3.5 bg-slate-50/80 border-t border-slate-200 mt-auto flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase">
                          Total Comanda:
                        </span>
                        <span className="text-base font-black text-slate-900">
                          S/ {order.total.toFixed(2)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {/* Botón 1: Marcar Entregado */}
                        <Button
                          onClick={() => toggleDelivered(order.orderId, order.identificador)}
                          size="sm"
                          className={`w-full font-bold text-xs h-9 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer col-span-2 ${isDelivered
                              ? "bg-slate-200 hover:bg-slate-300 text-slate-700"
                              : isReady
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                                : "bg-slate-800 hover:bg-slate-900 text-white"
                            }`}
                        >
                          {isDelivered ? (
                            <>
                              <Check className="w-4 h-4 text-emerald-600" />
                              <span>Entregado a Mesa (Deshacer)</span>
                            </>
                          ) : (
                            <>
                              <PackageCheck className="w-4 h-4" />
                              <span>Marcar como Entregado</span>
                            </>
                          )}
                        </Button>

                        {/* Botón 2: Cobro Mozo Móvil */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openWaiterPayment(order.orderObj)}
                          className="w-full bg-white hover:bg-red-50 hover:text-red-700 hover:border-red-300 border-slate-200 text-slate-700 font-bold text-xs h-8 rounded-xl flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Smartphone className="w-3.5 h-3.5 text-red-600" />
                          <span>Cobro Mozo</span>
                        </Button>

                        {/* Botón 3: Enviar a Ventanilla / Caja */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => goToCounterPayment(order.orderObj, order.identificador)}
                          className="w-full bg-white hover:bg-slate-100 border-slate-200 text-slate-700 font-bold text-xs h-8 rounded-xl flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Receipt className="w-3.5 h-3.5 text-blue-600" />
                          <span>Ir a Caja</span>
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* =================================================================== */}
      {/* PESTAÑA 2: COBROS NO COBRADOS (PENDIENTES EN SALA Y LLEVAR) */}
      {/* =================================================================== */}
      {activeTab === "payments" && (
        <main className="flex-1 w-full min-w-0 p-3 sm:p-6 flex flex-col gap-5">
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
                  {uncollectedPayments.length} Pendientes
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
                  {formatCurrency(totalPorCobrar)}
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

            {uncollectedPayments.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center justify-center gap-2 text-slate-400">
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                <span className="text-sm font-bold text-slate-700">
                  ¡Al día! No hay cuentas pendientes de cobro
                </span>
                <p className="text-xs text-slate-500">
                  Todas las tables y pedidos para llevar se encuentran cobrados y cerrados.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {uncollectedPayments.map((cobro) => (
                  <Card
                    key={cobro.orderId}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 dark:bg-slate-800/50 p-4 flex flex-col justify-between hover:shadow-md transition-shadow"
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
                          className={`text-[10px] font-bold border-none ${cobro.kitchenStatus === "Served"
                            ? "bg-emerald-100 text-emerald-800"
                            : cobro.kitchenStatus === "Preparing"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-100 text-blue-800"
                            }`}
                        >
                          {cobro.kitchenStatus === "Served"
                            ? "Servido"
                            : cobro.kitchenStatus === "Preparing"
                              ? "Preparando"
                              : cobro.kitchenStatus === "Received"
                                ? "Recibido"
                                : cobro.kitchenStatus}
                        </Badge>
                      </div>

                      <div className="text-xs text-slate-500 flex items-center justify-between">
                        <span className="font-mono">{cobro.code}</span>
                        <span>
                          {new Date(cobro.orderedAt).toLocaleTimeString("es-PE", {
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
                              {it.quantity}x {it.name}
                            </span>
                            <span className="font-semibold ml-2">
                              S/ {it.subtotal.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs font-bold text-slate-600">Total a Cobrar:</span>
                        <span className="text-base font-extrabold text-red-700">
                          {formatCurrency(cobro.total)}
                        </span>
                      </div>
                    </div>

                    {/* Botones de cobro directo y cancelación */}
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200">
                      {cobro.tipo === "Mesa" && (
                        <Button
                          size="sm"
                          onClick={() => openWaiterPayment(cobro.orderObj)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-8 rounded-lg cursor-pointer"
                        >
                          <Smartphone className="w-3.5 h-3.5 mr-1" />
                          Cobro Mozo
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => goToCounterPayment(cobro.orderObj, cobro.identificador)}
                        className="flex-1 text-xs font-bold h-8 rounded-lg border-slate-300 hover:bg-slate-100 cursor-pointer"
                      >
                        <Receipt className="w-3.5 h-3.5 mr-1 text-slate-600" />
                        Ventanilla
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openCancelModal(cobro.orderObj)}
                        title="Cancelar comanda"
                        className="text-xs font-bold h-8 px-2 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
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
      {activeTab === "cashier" && (
        <main className="flex-1 w-full min-w-0 p-3 sm:p-6 flex flex-col gap-5">
          {/* BANNER DE CONTROL DE APERTURA / CIERRE DE CAJA */}
          <Card
            className={`p-4 rounded-2xl border transition-all ${cashSessionState.isOpened
              ? "bg-gradient-to-r from-emerald-50/70 via-white to-slate-50 border-emerald-200 dark:from-emerald-800/70 dark:via-slate-800 dark:to-slate-900 shadow-xs"
              : "bg-gradient-to-r from-amber-50/80 via-white to-red-50/40 border-amber-300 shadow-xs"
              }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3">
                <div
                  className={`p-2.5 rounded-xl flex items-center justify-center ${cashSessionState.isOpened
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-amber-500 text-white shadow-sm"
                    }`}
                >
                  {cashSessionState.isOpened ? (
                    <Unlock className="w-5 h-5" />
                  ) : (
                    <Lock className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-extrabold text-slate-800">
                      {cashSessionState.register?.name || "Caja Principal - Salón"}
                    </span>
                    <Badge
                      className={
                        cashSessionState.isOpened
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold"
                          : "bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold"
                      }
                    >
                      {cashSessionState.isOpened ? "TURNO ABIERTO" : "TURNO CERRADO"}
                    </Badge>
                    {cashSessionState.activeSession && (
                      <span className="text-xs text-slate-500 font-medium">
                        Cajero:{" "}
                        <strong className="text-slate-700">
                          {cashSessionState.activeSession.openedBy || "Cajero Principal"}
                        </strong>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {cashSessionState.isOpened
                      ? `Turno iniciado a las ${new Date(
                        cashSessionState.activeSession?.openedAt || Date.now()
                      ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • Listo para emisión de Boletas y Facturas.`
                      : "La caja se encuentra cerrada. Debe realizar la apertura de turno antes de cobrar comandas."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap justify-end">
                {cashSessionState.isOpened && cashSessionState.activeSession && (
                  <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 bg-white rounded-xl border border-slate-200 text-xs shadow-2xs">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Fondo Apertura</div>
                      <div className="font-extrabold text-slate-700">
                        {formatCurrency(cashSessionState.activeSession.initialAmount)}
                      </div>
                    </div>
                    <div className="h-6 w-px bg-slate-200" />
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Ventas Efectivo</div>
                      <div className="font-extrabold text-emerald-600">
                        +{formatCurrency(cashSessionState.activeSession.salesCash)}
                      </div>
                    </div>
                    {Number(cashSessionState.activeSession.totalExpenses) > 0 && (
                      <>
                        <div className="h-6 w-px bg-slate-200" />
                        <div>
                          <div className="text-[10px] text-rose-500 font-bold uppercase">Salidas Emerg.</div>
                          <div className="font-extrabold text-rose-600">
                            -{formatCurrency(cashSessionState.activeSession.totalExpenses)}
                          </div>
                        </div>
                      </>
                    )}
                    <div className="h-6 w-px bg-slate-200" />
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Digital (Yape/POS)</div>
                      <div className="font-extrabold text-blue-600">
                        {formatCurrency(cashSessionState.activeSession.salesOther)}
                      </div>
                    </div>
                    <div className="h-6 w-px bg-slate-200" />
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Efectivo en Gaveta</div>
                      <div className="font-extrabold text-red-700">
                        {formatCurrency(cashSessionState.activeSession.expectedAmount)}
                      </div>
                    </div>
                  </div>
                )}

                {cashSessionState.isOpened ? (
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => {
                        setExpenseAmount("");
                        setExpenseReason("");
                        setExpenseModalOpen(true);
                      }}
                      variant="outline"
                      className="border-amber-300 hover:bg-amber-50 text-amber-800 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <ArrowDownCircle className="w-3.5 h-3.5 text-amber-600" />
                      <span>Salida de Emergencia</span>
                    </Button>
                    <Button
                      onClick={() => {
                        setCountedCashInput("");
                        setCloseNotesInput("");
                        setCloseDenominations(INITIAL_DENOMINATIONS);
                        setCloseCashModal(true);
                      }}
                      variant="outline"
                      className="border-red-300 hover:bg-red-50 text-red-700 dark:text-red-300 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Cerrar / Arqueo de Caja</span>
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => {
                      setInitialCashInput("0.00");
                      setOpenNotesInput("");
                      setOpenDenominations(INITIAL_DENOMINATIONS);
                      setOpenCashModal(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Abrir Turno de Caja</span>
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Tarjeta de Salidas y Movimientos de Emergencia de la Caja */}
          {cashSessionState.isOpened &&
            cashSessionState.activeSession?.movements &&
            cashSessionState.activeSession.movements.length > 0 && (
              <Card className="bg-amber-50/50 border border-amber-200/80 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-amber-200/80">
                  <div className="flex items-center gap-2">
                    <ArrowDownCircle className="w-4 h-4 text-amber-700" />
                    <span className="text-xs font-bold text-amber-950">
                      Salidas de Emergencia y Egresos de Caja ({cashSessionState.activeSession.movements.length})
                    </span>
                  </div>
                  <span className="text-xs font-black text-rose-700">
                    Total Retirado: -S/ {cashSessionState.activeSession.totalExpenses.toFixed(2)}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {cashSessionState.activeSession.movements.map((mov) => (
                    <div
                      key={`mov-${mov.id}`}
                      className="p-2.5 rounded-xl bg-white border border-amber-200 text-xs flex flex-col justify-between shadow-2xs"
                    >
                      <div>
                        <div className="flex items-center justify-between font-bold">
                          <span className="text-rose-700 font-extrabold">
                            -S/ {mov.amount.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {new Date(mov.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-700 mt-1 font-medium">
                          {mov.reason}
                        </p>
                      </div>
                      <div className="mt-2 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                        <span className="text-emerald-700 font-semibold">Asiento Contable ✔</span>
                        <span>Caja Chica</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Columna Izquierda: Selección de Comanda a Cobrar */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <Card className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center justify-between">
                  <span>1. Seleccionar Cuenta a Cobrar</span>
                  <Badge variant="outline" className="text-[10px]">
                    {uncollectedPayments.length} Pendientes
                  </Badge>
                </h3>

                {uncollectedPayments.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No hay comandas activas pendientes de cobro.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[460px] overflow-y-auto pr-1">
                    {uncollectedPayments.map((c) => {
                      const isSelected = orderToCharge?.id === c.orderId;
                      return (
                        <div
                          key={c.orderId}
                          onClick={() => {
                            setOrderToCharge(c.orderObj);
                            setPaymentSource(c.identificador);
                            setAmountGiven("");
                          }}
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${isSelected
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
                              {formatCurrency(c.total)}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex justify-between mb-1.5">
                            <span>Comanda {c.code}</span>
                            <span>{c.items.length} productos</span>
                          </div>

                          {/* Vista previa de lo ordenado para control de caja */}
                          <div className="bg-white/80 p-2 rounded-lg border border-slate-200/60 flex flex-col gap-1">
                            {c.items.map((it, idx) => (
                              <div key={idx} className="flex justify-between items-center text-[11px]">
                                <span className="truncate pr-2">
                                  <strong className="text-red-700 font-mono mr-1">{it.quantity}x</strong>
                                  {it.name || (it as any).dishName}
                                  {it.notes && (
                                    <span className="text-[10px] text-amber-700 italic ml-1">
                                      ({it.notes})
                                    </span>
                                  )}
                                </span>
                                <span className="font-semibold shrink-0 text-slate-700">
                                  S/ {it.subtotal.toFixed(2)}
                                </span>
                              </div>
                            ))}
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
                  {orderToCharge && (
                    <Badge className="bg-red-700 text-white font-bold text-xs">
                      {paymentSource}
                    </Badge>
                  )}
                </h3>

                {!orderToCharge ? (
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
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-800">
                          Consumo de la Cuenta ({orderToCharge.items.length} productos):
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              openEditOrder({
                                id: orderToCharge.id,
                                tableNote: orderToCharge.notes,
                                items: orderToCharge.items,
                                orderType: orderToCharge.orderType,
                                status: orderToCharge.status,
                                table: orderToCharge.table,
                              })
                            }
                            className="h-7 text-[11px] font-bold text-red-700 border-red-200 hover:bg-red-50 rounded-lg cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            + Adicionar Platos
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setViewOrderModal({
                                open: true,
                                order: orderToCharge,
                                tableName: paymentSource,
                              })
                            }
                            className="h-7 text-[11px] font-semibold text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Ver Todo
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 max-h-44 overflow-y-auto pr-1">
                        {orderToCharge.items.map((it, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between py-1.5 border-b border-slate-200/50 last:border-none text-slate-700"
                          >
                            <div className="flex flex-col min-w-0 pr-2">
                              <span className="font-medium">
                                <strong className="text-red-700 font-mono mr-1.5">
                                  {it.quantity}x
                                </strong>
                                {it.name || (it as any).dishName}
                              </span>
                              {it.notes && (
                                <span className="text-[10px] text-amber-700 italic">
                                  Nota: &quot;{it.notes}&quot;
                                </span>
                              )}
                            </div>
                            <span className="font-bold shrink-0 text-slate-900">
                              S/ {it.subtotal.toFixed(2)}
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
                      <div className="grid grid-cols-2 gap-2">
                        {(["Boleta", "Factura"] as const).map((tipo) => (
                          <button
                            key={tipo}
                            type="button"
                            onClick={() => {
                              setVoucherType(tipo);
                              if (tipo === "Factura" && (!customerDoc || customerDoc.length !== 11)) {
                                setCustomerDoc("20601234567");
                                setCustomerName("EMPRESA GASTRONÓMICA S.A.C.");
                              }
                            }}
                            className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${voucherType === tipo
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
                          {voucherType === "Factura" ? "RUC (11 dígitos):" : "DNI / Documento:"}
                        </label>
                        <div className="flex gap-1.5">
                          <Input
                            placeholder={voucherType === "Factura" ? "Ej: 20601234567" : "Ej: 47829103"}
                            value={customerDoc}
                            onChange={(e) => setCustomerDoc(e.target.value)}
                            className="bg-white text-xs h-9 rounded-lg"
                          />
                          <Button
                            type="button"
                            size="sm"
                            disabled={lookingUpDoc}
                            onClick={() =>
                              lookupIdentityDocument(
                                voucherType === "Factura" ? "ruc" : "dni",
                                customerDoc,
                                "caja"
                              )
                            }
                            className="bg-slate-800 hover:bg-slate-900 text-white text-[11px] h-9 px-2.5 rounded-lg shrink-0 cursor-pointer shadow-xs"
                            title="Consultar en RENIEC / SUNAT con json.pe"
                          >
                            {lookingUpDoc ? (
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
                          {voucherType === "Factura" ? "Razón Social:" : "Nombre del Cliente:"}
                        </label>
                        <Input
                          placeholder={voucherType === "Factura" ? "EMPRESA S.A.C." : "CLIENTE GENERAL"}
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="bg-white text-xs h-9 rounded-lg"
                        />
                      </div>
                    </div>

                    {/* Selección de Método de Pago */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1.5">
                        Método de Pago:
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("efectivo")}
                          className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold transition-all cursor-pointer ${paymentMethod === "efectivo"
                            ? "bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                        >
                          <Banknote className="w-5 h-5 text-emerald-600" />
                          <span>Efectivo</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentMethod("yape")}
                          className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold transition-all cursor-pointer ${paymentMethod === "yape"
                            ? "bg-purple-50 border-purple-500 text-purple-800 ring-2 ring-purple-500/20"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                        >
                          <QrCode className="w-5 h-5 text-purple-600" />
                          <span>Yape QR</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentMethod("pos")}
                          className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold transition-all cursor-pointer ${paymentMethod === "pos"
                            ? "bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-500/20"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                        >
                          <CreditCard className="w-5 h-5 text-blue-600" />
                          <span>Tarjeta / POS</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentMethod("mixto")}
                          className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold transition-all cursor-pointer ${paymentMethod === "mixto"
                            ? "bg-amber-50 border-amber-500 text-amber-800 ring-2 ring-amber-500/20"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                        >
                          <CircleDollarSign className="w-5 h-5 text-amber-600" />
                          <span>Pagar en Partes</span>
                        </button>
                      </div>
                    </div>

                    {/* Campo de vuelto para pago en efectivo */}
                    {paymentMethod === "efectivo" && (
                      <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <label className="text-xs font-bold text-emerald-900 block mb-1">
                            Monto Entregado por el Cliente:
                          </label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="any"
                              placeholder={`Ej: ${counterPaymentTotal}`}
                              value={amountGiven}
                              onChange={(e) => setAmountGiven(e.target.value)}
                              className="bg-white text-xs h-9 w-36 rounded-lg font-bold"
                            />
                            <div className="flex gap-1">
                              {[20, 50, 100, 200].map((billete) => (
                                <button
                                  key={billete}
                                  type="button"
                                  onClick={() => setAmountGiven(String(billete))}
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
                            S/ {counterChangeDue.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Configuración de Pagar en Partes (Múltiples Medios de Pago) */}
                    {paymentMethod === "mixto" && (
                      <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 flex flex-col gap-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-amber-200/80">
                          <div>
                            <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                              <CircleDollarSign className="w-4 h-4 text-amber-600" />
                              <span>Pagar en Partes (Múltiples Medios de Pago)</span>
                            </div>
                            <p className="text-[11px] text-amber-800">
                              Divide el total de la cuenta en 2 o más partes con cualquier medio de pago (Efectivo, Yape, Tarjeta, Plin).
                            </p>
                          </div>
                          <div className="text-xs font-bold text-slate-800 bg-white px-3 py-1 rounded-xl border border-amber-200 shrink-0 self-start sm:self-auto">
                            Total de la Cuenta: <span className="text-red-700 text-sm font-extrabold">{formatCurrency(counterPaymentTotal)}</span>
                          </div>
                        </div>

                        {/* Listado dinámico de partes de pago */}
                        <div className="flex flex-col gap-2">
                          {paymentParts.map((parte, index) => {
                            const selectedPaymentType = paymentTypes.find((t) => t.id === parte.paymentTypeId);
                            const esEfectivo = selectedPaymentType?.name.toLowerCase().includes("efectivo");

                            // Calcular cuánto falta considerando las otras partes
                            const otherSum = paymentParts
                              .filter((p) => p.id !== parte.id)
                              .reduce((s, p) => s + (Number(p.monto) || 0), 0);
                            const remainingForThis = Math.max(0, Math.round((counterPaymentTotal - otherSum) * 100) / 100);

                            return (
                              <div
                                key={parte.id}
                                className="bg-white p-2.5 rounded-xl border border-amber-200/90 shadow-2xs flex flex-col gap-2"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-900 text-xs font-bold flex items-center justify-center shrink-0">
                                    #{index + 1}
                                  </span>

                                  {/* Selector de método de pago */}
                                  <div className="flex-1 min-w-[130px]">
                                    <select
                                      value={parte.paymentTypeId}
                                      onChange={(e) =>
                                        updatePaymentPart(parte.id, "paymentTypeId", Number(e.target.value), "caja")
                                      }
                                      className="w-full h-8 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                                    >
                                      {paymentTypes.map((tp) => (
                                        <option key={tp.id} value={tp.id}>
                                          {tp.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  {/* Input del monto de la parte */}
                                  <div className="w-32 shrink-0 relative">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                                      S/
                                    </span>
                                    <Input
                                      type="number"
                                      step="any"
                                      placeholder="0.00"
                                      value={parte.monto}
                                      onChange={(e) =>
                                        updatePaymentPart(parte.id, "monto", e.target.value, "caja")
                                      }
                                      className="h-8 pl-7 text-xs font-bold text-slate-900 rounded-lg bg-slate-50"
                                    />
                                  </div>

                                  {/* Botón rápido para autocompletar lo que resta para esta parte */}
                                  {remainingForThis > 0 && Number(parte.monto) !== remainingForThis && (
                                    <button
                                      type="button"
                                      onClick={() => autofillRemaining(parte.id, counterPaymentTotal, "caja")}
                                      className="text-[10px] font-bold px-2 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg transition-colors cursor-pointer shrink-0 hidden sm:inline"
                                      title={`Asignar el saldo restante de S/ ${remainingForThis.toFixed(2)}`}
                                    >
                                      = S/ {remainingForThis.toFixed(2)}
                                    </button>
                                  )}

                                  {/* Botón eliminar parte (si hay más de 2) */}
                                  {paymentParts.length > 2 && (
                                    <button
                                      type="button"
                                      onClick={() => removePaymentPart(parte.id, "caja")}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer shrink-0"
                                      title="Eliminar esta parte"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>

                                {/* Helper para Efectivo: Vuelto si el cliente entrega un billete más grande */}
                                {esEfectivo && Number(parte.monto) > 0 && (
                                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100 text-[11px] text-slate-600">
                                    <span className="text-[10px] text-slate-500 font-semibold">
                                      ¿Cliente paga con billete mayor?
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                      <Input
                                        type="number"
                                        step="any"
                                        placeholder="Billete (ej: 20)"
                                        value={parte.cashGiven || ""}
                                        onChange={(e) =>
                                          updatePaymentPart(parte.id, "cashGiven", e.target.value, "caja")
                                        }
                                        className="h-6 w-24 text-[10px] rounded px-1.5 bg-slate-50"
                                      />
                                      {Number(parte.cashGiven) > Number(parte.monto) && (
                                        <span className="text-emerald-700 font-bold text-[10px]">
                                          Vuelto: S/ {(Number(parte.cashGiven) - Number(parte.monto)).toFixed(2)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Botón para agregar una nueva parte */}
                        <div className="flex items-center justify-between pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addPaymentPart("caja")}
                            className="text-xs font-bold text-amber-900 border-amber-300 hover:bg-amber-100/70 h-8 rounded-xl cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            <span>Agregar otra forma de pago</span>
                          </Button>

                          <span className="text-[10px] text-amber-800 hidden sm:inline">
                            Ingresa montos hasta cubrir el 100% de la cuenta.
                          </span>
                        </div>

                        {/* Balance y validación en tiempo real */}
                        {(() => {
                          const cubierto = Math.round(
                            paymentParts.reduce((sum, p) => sum + (Number(p.monto) || 0), 0) * 100
                          ) / 100;
                          const diferencia = Math.round((counterPaymentTotal - cubierto) * 100) / 100;
                          const esExacto = Math.abs(diferencia) <= 0.05 && cubierto > 0;
                          const porcentaje = counterPaymentTotal > 0
                            ? Math.min(100, Math.round((cubierto / counterPaymentTotal) * 100))
                            : 0;

                          return (
                            <div className="bg-white p-3 rounded-xl border border-amber-200 flex flex-col gap-2 text-xs">
                              {/* Barra visual de progreso */}
                              <div>
                                <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                                  <span>Progreso del Pago: {porcentaje}%</span>
                                  <span>
                                    Suma de Partes: <strong className="text-slate-900">S/ {cubierto.toFixed(2)}</strong> de{" "}
                                    <strong className="text-red-700">{formatCurrency(counterPaymentTotal)}</strong>
                                  </span>
                                </div>
                                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                                  <div
                                    className={`h-full transition-all duration-300 ${esExacto ? "bg-emerald-500" : diferencia > 0 ? "bg-amber-500" : "bg-rose-500"
                                      }`}
                                    style={{ width: `${Math.min(100, porcentaje)}%` }}
                                  />
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                                {esExacto ? (
                                  <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    <span>¡Excelente! Cuenta 100% cubierta con las partes indicadas.</span>
                                  </div>
                                ) : diferencia > 0 ? (
                                  <div className="flex items-center gap-1.5 text-amber-800 font-bold">
                                    <AlertCircle className="w-4 h-4 text-amber-600" />
                                    <span>Falta cubrir: S/ {diferencia.toFixed(2)}</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-rose-700 font-bold">
                                    <AlertCircle className="w-4 h-4 text-rose-600" />
                                    <span>Las partes exceden el total por: S/ {Math.abs(diferencia).toFixed(2)}</span>
                                  </div>
                                )}

                                {esExacto ? (
                                  <Badge className="bg-emerald-600 text-white font-bold text-[10px]">
                                    Listo para cobrar
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] text-slate-500">
                                    Ajuste requerido
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Totales con desglose de IGV (18%) */}
                    <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200 flex flex-col gap-1 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal Base Imponible:</span>
                        <span className="font-semibold">
                          S/ {counterBreakdown.subtotal.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>IGV (18% incluido):</span>
                        <span className="font-semibold">
                          S/ {counterBreakdown.igv.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-900 font-extrabold text-base pt-1 border-t border-slate-200 mt-1">
                        <span>TOTAL A PAGAR:</span>
                        <span className="text-red-700">
                          {formatCurrency(counterPaymentTotal)}
                        </span>
                      </div>
                    </div>

                    {/* Botón de Confirmación y Cierre de Venta */}
                    <Button
                      onClick={executeCounterPayment}
                      disabled={processingSale}
                      className="w-full bg-red-700 hover:bg-red-800 text-white font-bold text-sm h-11 rounded-xl flex items-center justify-center gap-2 shadow-md cursor-pointer"
                    >
                      {processingSale ? (
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
      {activeTab === "customers" && (
        <main className="flex-1 w-full min-w-0 p-3 sm:p-6 flex flex-col gap-5">
          <Card className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
            {/* Barra Superior con Búsqueda y Botón Nuevo */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2 w-full sm:w-80">
                <div className="relative w-full">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <Input
                    placeholder="Buscar por DNI, RUC o Nombre..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="pl-9 bg-slate-50 text-xs h-9 rounded-xl"
                  />
                </div>
              </div>

              <Button
                onClick={() => {
                  setNewCustomerType("Natural");
                  setNewCustomerDoc("");
                  setNewCustomerName("");
                  setNewCustomerLastName("");
                  setNewCustomerPhone("");
                  setNewCustomerModalOpen(true);
                }}
                className="bg-red-700 hover:bg-red-800 text-white font-bold text-xs h-9 px-4 rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Cliente</span>
              </Button>
            </div>

            {/* Tabla Responsiva de Clientes */}
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] bg-slate-50/70 dark:bg-slate-800/70">
                    <th className="py-2.5 px-3">Documento</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">Cliente / Razón Social</th>
                    <th className="py-2.5 px-3">Teléfono</th>
                    <th className="py-2.5 px-3 text-center">Compras</th>
                    <th className="py-2.5 px-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No se encontraron customers registrados.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((cli) => (
                      <tr key={cli.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          {cli.documentNumber}
                        </td>
                        <td className="py-3 px-3">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${cli.personType === "Legal"
                              ? "border-blue-300 text-blue-800 bg-blue-50"
                              : "border-slate-300 text-slate-700 bg-slate-100"
                              }`}
                          >
                            {cli.personType === "Legal" ? "Jurídica" : "Natural"}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800">
                          {cli.fullName}
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-mono">
                          {cli.phone || "—"}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold text-[10px]">
                            {cli.totalPurchases}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => selectCustomerForSale(cli)}
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
      {activeTab === "invoices" && (
        <main className="flex-1 w-full min-w-0 p-3 sm:p-6 flex flex-col gap-5">
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
                {formatCurrency(dailySummary.totalRecaudado)}
              </p>
              <span className="text-[11px] text-slate-500 mt-1">
                {dailySummary.cantidadVentas} comprobantes emitidos
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
                {formatCurrency(dailySummary.desgloseMetodos.efectivo)}
              </p>
              <span className="text-[11px] text-slate-500 mt-1">
                Dinero físico availableId
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
                {formatCurrency(dailySummary.desgloseMetodos.yape)}
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
                {formatCurrency(dailySummary.desgloseMetodos.tarjeta)}
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
                  {saleVouchers.length} Emitidos
                </Badge>
              </div>

              {/* Filtro de Fecha */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-semibold">Filtrar:</span>
                <Button
                  size="sm"
                  variant={salesDateFilter === "hoy" ? "default" : "outline"}
                  onClick={() => setSalesDateFilter("hoy")}
                  className={`text-xs h-7 rounded-lg cursor-pointer ${salesDateFilter === "hoy" ? "bg-red-700 text-white" : ""
                    }`}
                >
                  Hoy
                </Button>
                <Button
                  size="sm"
                  variant={salesDateFilter === "todas" ? "default" : "outline"}
                  onClick={() => setSalesDateFilter("todas")}
                  className={`text-xs h-7 rounded-lg cursor-pointer ${salesDateFilter === "todas" ? "bg-red-700 text-white" : ""
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
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] bg-slate-50/70 dark:bg-slate-800/70">
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
                  {saleVouchers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No se han emitido comprobantes para la fecha seleccionada.
                      </td>
                    </tr>
                  ) : (
                    saleVouchers.map((comp) => (
                      <tr key={comp.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3">
                          <span className="font-mono font-bold text-slate-900 block">
                            {comp.fullCode}
                          </span>
                          <Badge
                            className={`text-[9px] font-bold border-none ${comp.voucherType === "Factura"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-100 text-slate-800"
                              }`}
                          >
                            {comp.voucherType}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                          {new Date(comp.issuedAt).toLocaleString("es-PE", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-slate-800 block line-clamp-1">
                            {comp.customer.firstName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Doc: {comp.customer.documentNumber}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-semibold">
                          {comp.origin}
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                            {comp.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-extrabold text-sm text-red-700 font-mono">
                          {formatCurrency(comp.total)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setIssuedVoucher(comp);
                                setTicketModalOpen(true);
                              }}
                              className="text-[11px] h-7 px-2.5 rounded-lg border-slate-300 hover:bg-slate-100 font-semibold cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5 mr-1" />
                              Ver Ticket
                            </Button>
                            {comp.s3Url && (
                              <a
                                href={`/api/sales/voucher/${comp.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center text-[11px] h-7 px-2.5 rounded-lg border border-blue-200 hover:bg-blue-100 font-semibold text-blue-700 bg-blue-50 cursor-pointer transition-colors"
                                title="Ver archivo en S3"
                              >
                                <FileText className="w-3.5 h-3.5 mr-1" />
                                S3
                              </a>
                            )}
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
      )}

      {/* =================================================================== */}
      {/* MODAL 1: TOMAR / EDITAR COMANDA (MESA O PARA LLEVAR) */}
      {/* =================================================================== */}
      <Dialog open={orderModalOpen} onOpenChange={setOrderModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl md:max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl p-4 sm:p-6 bg-white">
          <DialogHeader className="pb-3 border-b border-slate-200">
            <DialogTitle className="text-base font-bold text-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2 pr-8">
              <span className="flex items-center gap-2 min-w-0">
                <Utensils className="w-5 h-5 text-red-700 shrink-0" />
                <span className="truncate">
                  {isEditing
                    ? "Modificar Comanda Activa"
                    : isTakeaway
                      ? "Nuevo Pedido Para Llevar (Ventanilla)"
                      : `Comanda de Salón — Mesa ${selectedTable?.number}`}
                </span>
              </span>
              <span className="text-xs font-mono font-bold text-red-700 bg-red-50 px-2 py-1 rounded-lg shrink-0 self-start sm:self-auto">
                Total: {formatCurrency(orderTotal)}
              </span>
            </DialogTitle>
          </DialogHeader>

          {/* Selección de Mesas Unidas (cuando el cliente ocupa más de 1 mesa) */}
          {!isTakeaway && !isEditing && selectedTable && (
            <div className="mt-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/70">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span>Unir mesa(s) adicional(es) para este cliente (Opcional):</span>
                </label>
                {additionalTables.length > 0 && (
                  <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] font-bold">
                    +{additionalTables.length} unida(s)
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {tables
                  .filter((m) => !m.occupied && m.id !== selectedTable.id)
                  .map((m) => {
                    const isSelected = additionalTables.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setAdditionalTables((prev) =>
                            isSelected ? prev.filter((id) => id !== m.id) : [...prev, m.id]
                          );
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${isSelected
                          ? "bg-amber-500 text-white border-amber-600 shadow-xs ring-2 ring-amber-300"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                          }`}
                      >
                        + Mesa {m.number} (Aforo {m.capacity})
                      </button>
                    );
                  })}
                {tables.filter((m) => !m.occupied && m.id !== selectedTable.id).length === 0 && (
                  <span className="text-[11px] text-slate-400 italic">No hay otras tables disponibles en el salón para unir.</span>
                )}
              </div>
            </div>
          )}

          {/* Observación general */}
          <div className="mt-2">
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Observaciones de la Comanda / Mesa:
            </label>
            <Input
              placeholder="Ej: Mesa con niños pequeños, traer servilletas extra, etc."
              value={tableNote}
              onChange={(e) => setTableNote(e.target.value)}
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
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${selectedCategory === cat.id
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
            {filteredDishes.map((plato) => (
              <div
                key={plato.id}
                onClick={() => addOrderItem(plato)}
                className="bg-white p-2.5 rounded-xl border border-slate-200 hover:border-red-400 hover:shadow-xs cursor-pointer flex flex-col justify-between transition-all"
              >
                <div>
                  <h4 className="font-bold text-xs text-slate-900 line-clamp-1">
                    {plato.name}
                  </h4>
                  <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                    {plato.description}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100">
                  <span className="font-bold text-xs text-red-700">
                    S/ {plato.price.toFixed(2)}
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
              Platos Seleccionados en la Comanda ({orderItems.length}):
            </span>
            {orderItems.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2 text-center">
                Toca cualquier plato de la lista superior para agregarlo.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
                {orderItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs"
                  >
                    <div className="flex-1 mr-2">
                      <span className="font-bold text-slate-900 block line-clamp-1">
                        {item.name}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-slate-500">
                          Unit: S/ {item.unitPrice.toFixed(2)}
                        </span>
                        {item.notes && (
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded italic">
                            &quot;{item.notes}&quot;
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setNoteIndex(idx);
                            setNoteText(item.notes);
                            setNotesModalOpen(true);
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
                          onClick={() => changeItemQuantity(idx, -1)}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 flex items-center justify-center cursor-pointer"
                        >
                          -
                        </button>
                        <span className="w-6 text-center font-bold font-mono">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => changeItemQuantity(idx, 1)}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 flex items-center justify-center cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      <span className="font-extrabold text-slate-900 w-16 text-right font-mono">
                        S/ {(item.unitPrice * item.quantity).toFixed(2)}
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
              onClick={() => setOrderModalOpen(false)}
              className="text-xs font-semibold rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={saveOrder}
              disabled={savingOrder || orderItems.length === 0}
              className="bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {savingOrder ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>{isEditing ? "Guardar Cambios" : "Confirmar y Enviar a Cocina"}</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODAL: VER DETALLE COMPLETO DE COMANDA EN TODO MOMENTO */}
      {/* =================================================================== */}
      <Dialog
        open={viewOrderModal.open}
        onOpenChange={(open) => setViewOrderModal((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="w-[95vw] sm:max-w-lg rounded-2xl p-4 sm:p-6 bg-white">
          <DialogHeader className="pb-3 border-b border-slate-200">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center justify-between pr-8">
              <span className="flex items-center gap-2">
                <Utensils className="w-5 h-5 text-red-700" />
                <span>
                  {viewOrderModal.tableName ||
                    (viewOrderModal.order?.table
                      ? `Mesa #${viewOrderModal.order.table.number}`
                      : "Pedido")}
                </span>
              </span>
              {viewOrderModal.order && (
                <Badge
                  className={
                    viewOrderModal.order.status === "Served"
                      ? "bg-emerald-600 text-white"
                      : viewOrderModal.order.status === "Preparing"
                        ? "bg-amber-500 text-white"
                        : "bg-blue-600 text-white"
                  }
                >
                  {viewOrderModal.order.status === "Served"
                    ? "Servido"
                    : viewOrderModal.order.status === "Preparing"
                      ? "En Preparación"
                      : "Recibido"}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {viewOrderModal.order && (
            <div className="flex flex-col gap-4 mt-2">
              <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="font-mono font-bold text-slate-800">
                  Comanda: {viewOrderModal.order.code}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {new Date(viewOrderModal.order.orderedAt).toLocaleTimeString("es-PE", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              {viewOrderModal.order.notes && (
                <div className="text-xs bg-amber-50 border border-amber-200/80 p-2.5 rounded-xl text-amber-900">
                  <strong className="block text-[11px] uppercase tracking-wider text-amber-800 mb-0.5">
                    Observación de la Mesa:
                  </strong>
                  &quot;{viewOrderModal.order.notes}&quot;
                </div>
              )}

              <div>
                <span className="text-xs font-bold text-slate-800 block mb-2">
                  Platos y Productos Ordenados ({viewOrderModal.order.items.length}):
                </span>
                <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
                  {viewOrderModal.order.items.map((it, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs"
                    >
                      <div className="flex-1 mr-2">
                        <span className="font-bold text-slate-900 block">
                          <span className="text-red-700 mr-1.5 font-mono">
                            {it.quantity}x
                          </span>
                          {it.name || (it as any).dishName}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                          <span>Unitario: S/ {it.unitPrice.toFixed(2)}</span>
                          {it.notes && (
                            <span className="text-[10px] text-amber-700 bg-amber-100/60 px-1.5 py-0.2 rounded italic">
                              &quot;{it.notes}&quot;
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="font-bold text-slate-900 font-mono text-sm shrink-0">
                        S/ {it.subtotal.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 flex flex-col gap-1 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal Base (sin IGV):</span>
                  <span className="font-semibold">
                    S/ {(viewOrderModal.order.total / 1.18).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>IGV (18% incluido):</span>
                  <span className="font-semibold">
                    S/ {(viewOrderModal.order.total - viewOrderModal.order.total / 1.18).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-900 font-extrabold text-base pt-1 border-t border-slate-200 mt-1">
                  <span>TOTAL DE LA CUENTA:</span>
                  <span className="text-red-700">
                    {formatCurrency(viewOrderModal.order.total)}
                  </span>
                </div>
              </div>

              <DialogFooter className="flex gap-2 pt-2 border-t border-slate-200">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewOrderModal((prev) => ({ ...prev, open: false }))}
                  className="text-xs font-semibold rounded-xl"
                >
                  Cerrar
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const ord = viewOrderModal.order;
                    setViewOrderModal({ open: false, order: null });
                    if (ord) {
                      openEditOrder({
                        id: ord.id,
                        tableNote: ord.notes,
                        items: ord.items,
                        orderType: ord.orderType,
                        status: ord.status,
                        table: ord.table,
                      });
                    }
                  }}
                  className="bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Adicionar más platos</span>
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODAL 2: COBRO MÓVIL DEL MOZO (CON CELULAR / TAP TO PAY / YAPE) */}
      {/* =================================================================== */}
      <Dialog open={waiterPaymentModalOpen} onOpenChange={setWaiterPaymentModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl p-4 sm:p-6 bg-white">
          <DialogHeader className="pb-3 border-b border-slate-200">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center justify-between pr-8">
              <span className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-600" />
                <span>Cobro Móvil / Mozo</span>
              </span>
              {waiterPaymentOrder?.table && (
                <Badge className="bg-red-700 hover:bg-red-800 text-white font-bold text-xs px-2.5 py-0.5 rounded-lg shadow-xs">
                  Mesa {waiterPaymentOrder.table.number}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {waiterPaymentOrder && (
            <div className="flex flex-col gap-4 mt-2">
              {/* Importe Total en Grande */}
              <div className="bg-slate-900 text-white p-4 rounded-2xl text-center">
                <span className="text-xs text-slate-400 font-bold uppercase block">
                  Total a Cobrar en Mesa
                </span>
                <span className="text-3xl font-extrabold text-emerald-400">
                  {formatCurrency(waiterPaymentOrder.total)}
                </span>
                <span className="text-[11px] text-slate-400 block mt-1">
                  Comanda {waiterPaymentOrder.code} • {waiterPaymentOrder.items.length} dishes
                </span>
              </div>

              {/* Selector de Método de Cobro Móvil */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Selecciona Medio de Pago en Mesa:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setWaiterPaymentMethod("pos")}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold cursor-pointer transition-all ${waiterPaymentMethod === "pos"
                      ? "bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-500/20 shadow-xs"
                      : "bg-slate-50 border-slate-200 text-slate-600"
                      }`}
                  >
                    <Smartphone className="w-5 h-5 text-blue-600" />
                    <span>Tap to Pay</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWaiterPaymentMethod("yape")}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold cursor-pointer transition-all ${waiterPaymentMethod === "yape"
                      ? "bg-purple-50 border-purple-500 text-purple-900 ring-2 ring-purple-500/20 shadow-xs"
                      : "bg-slate-50 border-slate-200 text-slate-600"
                      }`}
                  >
                    <QrCode className="w-5 h-5 text-purple-600" />
                    <span>Yape QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWaiterPaymentMethod("efectivo")}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold cursor-pointer transition-all ${waiterPaymentMethod === "efectivo"
                      ? "bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20 shadow-xs"
                      : "bg-slate-50 border-slate-200 text-slate-600"
                      }`}
                  >
                    <Banknote className="w-5 h-5 text-emerald-600" />
                    <span>Efectivo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWaiterPaymentMethod("mixto")}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1 text-xs font-bold cursor-pointer transition-all ${waiterPaymentMethod === "mixto"
                      ? "bg-amber-50 border-amber-500 text-amber-900 ring-2 ring-amber-500/20 shadow-xs"
                      : "bg-slate-50 border-slate-200 text-slate-600"
                      }`}
                  >
                    <CircleDollarSign className="w-5 h-5 text-amber-600" />
                    <span>En Partes</span>
                  </button>
                </div>
              </div>

              {/* Modo Tap to Pay (El celular como Terminal POS con Mercado Pago) */}
              {waiterPaymentMethod === "pos" && (
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
              {waiterPaymentMethod === "yape" && (
                <div className="bg-purple-50/70 border border-purple-200 p-4 rounded-2xl flex flex-col items-center text-center gap-2">
                  <div className="w-12 h-12 rounded-xl bg-purple-600 text-white flex items-center justify-center">
                    <QrCode className="w-7 h-7" />
                  </div>
                  <span className="text-xs font-bold text-purple-950">
                    Código QR Local / Yape
                  </span>
                  <p className="text-[11px] text-purple-800">
                    Muestra el QR del restaurante al comensal para que escanee y confirme el abono de {formatCurrency(waiterPaymentOrder.total)}.
                  </p>
                </div>
              )}

              {/* Modo Efectivo con Vuelto Rápido */}
              {waiterPaymentMethod === "efectivo" && (
                <div className="bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-2xl flex flex-col gap-2">
                  <label className="text-xs font-bold text-emerald-950 block">
                    Monto que entrega el comensal:
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="any"
                      placeholder={`Ej: ${waiterPaymentOrder.total}`}
                      value={waiterAmountGiven}
                      onChange={(e) => setWaiterAmountGiven(e.target.value)}
                      className="bg-white text-xs h-9 rounded-lg font-bold"
                    />
                    <div className="flex gap-1">
                      {[50, 100].map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setWaiterAmountGiven(String(b))}
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
                      S/ {waiterChangeDue.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Modo Pagar en Partes en Mesa */}
              {waiterPaymentMethod === "mixto" && (
                <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-200 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between pb-1 border-b border-amber-200/70">
                    <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <CircleDollarSign className="w-4 h-4 text-amber-600" />
                      <span>Pagar en Partes en Mesa</span>
                    </span>
                    <span className="text-[11px] font-bold text-amber-900">
                      Total: {formatCurrency(waiterPaymentOrder.total)}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    {waiterPaymentParts.map((parte, index) => {
                      const otherSum = waiterPaymentParts
                        .filter((p) => p.id !== parte.id)
                        .reduce((s, p) => s + (Number(p.monto) || 0), 0);
                      const remainingForThis = Math.max(0, Math.round((waiterPaymentOrder.total - otherSum) * 100) / 100);

                      return (
                        <div
                          key={parte.id}
                          className="bg-white p-2 rounded-xl border border-amber-200 flex items-center gap-2"
                        >
                          <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-bold flex items-center justify-center shrink-0">
                            #{index + 1}
                          </span>
                          <select
                            value={parte.paymentTypeId}
                            onChange={(e) =>
                              updatePaymentPart(parte.id, "paymentTypeId", Number(e.target.value), "mozo")
                            }
                            className="flex-1 h-7 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-1.5"
                          >
                            {paymentTypes.map((tp) => (
                              <option key={tp.id} value={tp.id}>
                                {tp.name}
                              </option>
                            ))}
                          </select>
                          <div className="w-24 relative shrink-0">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                              S/
                            </span>
                            <Input
                              type="number"
                              step="any"
                              placeholder="0.00"
                              value={parte.monto}
                              onChange={(e) =>
                                updatePaymentPart(parte.id, "monto", e.target.value, "mozo")
                              }
                              className="h-7 pl-6 text-xs font-bold rounded-lg bg-slate-50"
                            />
                          </div>
                          {remainingForThis > 0 && Number(parte.monto) !== remainingForThis && (
                            <button
                              type="button"
                              onClick={() => autofillRemaining(parte.id, waiterPaymentOrder.total, "mozo")}
                              className="text-[10px] font-bold px-1.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded transition-colors cursor-pointer shrink-0"
                              title="Asignar restante"
                            >
                              = S/{remainingForThis.toFixed(2)}
                            </button>
                          )}
                          {waiterPaymentParts.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removePaymentPart(parte.id, "mozo")}
                              className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addPaymentPart("mozo")}
                      className="text-xs font-bold text-amber-900 border-amber-300 hover:bg-amber-100/70 h-7 rounded-lg cursor-pointer"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      <span>Agregar parte</span>
                    </Button>
                  </div>

                  {/* Balance en mesa */}
                  {(() => {
                    const cubierto = Math.round(
                      waiterPaymentParts.reduce((s, p) => s + (Number(p.monto) || 0), 0) * 100
                    ) / 100;
                    const diferencia = Math.round((waiterPaymentOrder.total - cubierto) * 100) / 100;
                    const esExacto = Math.abs(diferencia) <= 0.05 && cubierto > 0;

                    return (
                      <div className="bg-white p-2.5 rounded-xl border border-amber-200 text-xs flex items-center justify-between">
                        <span>
                          Suma: <strong>S/ {cubierto.toFixed(2)}</strong>
                        </span>
                        {esExacto ? (
                          <Badge className="bg-emerald-600 text-white font-bold text-[10px]">
                            ✓ 100% Cubierto
                          </Badge>
                        ) : diferencia > 0 ? (
                          <Badge className="bg-amber-600 text-white font-bold text-[10px]">
                            Falta: S/ {diferencia.toFixed(2)}
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-600 text-white font-bold text-[10px]">
                            Excede: S/ {Math.abs(diferencia).toFixed(2)}
                          </Badge>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              <DialogFooter className="flex gap-2 pt-2 border-t border-slate-200">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWaiterPaymentModalOpen(false)}
                  className="text-xs font-semibold rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={executeWaiterPayment}
                  disabled={processingWaiterPayment}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 rounded-xl flex-1 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {processingWaiterPayment ? (
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
      <Dialog open={newCustomerModalOpen} onOpenChange={setNewCustomerModalOpen}>
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
                  onClick={() => setNewCustomerType("Natural")}
                  className={`py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${newCustomerType === "Natural"
                    ? "bg-red-700 text-white border-red-700"
                    : "bg-slate-50 border-slate-200 text-slate-700"
                    }`}
                >
                  Persona Natural (DNI)
                </button>
                <button
                  type="button"
                  onClick={() => setNewCustomerType("Legal")}
                  className={`py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${newCustomerType === "Legal"
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
                {newCustomerType === "Natural" ? "DNI (8 dígitos):" : "RUC (11 dígitos):"}
              </label>
              <div className="flex gap-1.5">
                <Input
                  placeholder={newCustomerType === "Natural" ? "Ej: 47829103" : "Ej: 20601234567"}
                  value={newCustomerDoc}
                  onChange={(e) => setNewCustomerDoc(e.target.value)}
                  className="bg-slate-50 text-xs h-9 rounded-xl"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={lookingUpDoc}
                  onClick={() =>
                    lookupIdentityDocument(
                      newCustomerType === "Natural" ? "dni" : "ruc",
                      newCustomerDoc,
                      "nuevo_cliente"
                    )
                  }
                  className="bg-slate-800 hover:bg-slate-900 text-white text-xs h-9 px-3 rounded-xl shrink-0 cursor-pointer shadow-xs"
                  title="Consultar en RENIEC / SUNAT con json.pe"
                >
                  {lookingUpDoc ? (
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
                {newCustomerType === "Natural" ? "Nombres:" : "Razón Social:"}
              </label>
              <Input
                placeholder={newCustomerType === "Natural" ? "Ej: Juan Carlos" : "Ej: INVERSIONES GASTRONÓMICAS PERÚ S.A.C."}
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                className="bg-slate-50 text-xs h-9 rounded-xl"
              />
            </div>

            {newCustomerType === "Natural" && (
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Apellidos:
                </label>
                <Input
                  placeholder="Ej: Pérez Rodríguez"
                  value={newCustomerLastName}
                  onChange={(e) => setNewCustomerLastName(e.target.value)}
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
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                className="bg-slate-50 text-xs h-9 rounded-xl"
              />
            </div>

            <DialogFooter className="flex gap-2 pt-3 border-t border-slate-200 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNewCustomerModalOpen(false)}
                className="text-xs font-semibold rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={registerNewCustomer}
                disabled={savingCustomer}
                className="bg-red-700 hover:bg-red-800 text-white font-bold text-xs h-9 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {savingCustomer ? (
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
      <Dialog open={notesModalOpen} onOpenChange={setNotesModalOpen}>
        <DialogContent className="w-[90vw] sm:max-w-sm rounded-2xl p-4 bg-white">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-900">
              Observación para el Plato
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="Ej: Papas bien doradas, sin mayonesa, etc."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="bg-slate-50 text-xs h-9 rounded-xl"
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNotesModalOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (noteIndex !== null) {
                  setOrderItems((prev) =>
                    prev.map((it, i) =>
                      i === noteIndex ? { ...it, notes: noteText } : it
                    )
                  );
                }
                setNotesModalOpen(false);
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
      <Dialog open={ticketModalOpen} onOpenChange={setTicketModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-sm max-h-[90vh] overflow-y-auto rounded-2xl p-4 bg-white print:p-0 print:border-none print:shadow-none print:max-w-none">
          <DialogHeader className="pb-2 border-b border-slate-200 no-print">
            <DialogTitle className="text-sm font-bold text-slate-900 flex items-center justify-between pr-8">
              <span className="flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <span>Comprobante Emitido</span>
              </span>
              <Badge className="bg-emerald-100 text-emerald-800 font-mono text-[10px]">
                {issuedVoucher?.fullCode}
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
                <span className="font-bold text-slate-900">{issuedVoucher?.voucherType}</span>
              </div>
              <div className="flex justify-between">
                <span>NÚMERO:</span>
                <span className="font-bold text-slate-900">{issuedVoucher?.fullCode}</span>
              </div>
              <div className="flex justify-between">
                <span>FECHA:</span>
                <span>
                  {issuedVoucher?.issuedAt
                    ? new Date(issuedVoucher.issuedAt).toLocaleString("es-PE")
                    : ""}
                </span>
              </div>
              <div className="flex justify-between">
                <span>CLIENTE:</span>
                <span className="font-bold">{issuedVoucher?.customer.firstName}</span>
              </div>
              <div className="flex justify-between">
                <span>DOC:</span>
                <span>{issuedVoucher?.customer.documentNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>ORIGEN:</span>
                <span>{issuedVoucher?.origin}</span>
              </div>
            </div>

            {/* Ítems */}
            <div className="flex flex-col gap-1 pb-2 border-b border-dashed border-slate-300">
              {issuedVoucher?.items.map((it, idx) => (
                <div key={idx} className="flex justify-between text-[10px]">
                  <span className="line-clamp-1">
                    {it.quantity}x {it.name}
                  </span>
                  <span className="font-semibold">S/ {it.subtotal.toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Totales */}
            <div className="flex flex-col gap-0.5 text-[10px] pb-2 border-b border-dashed border-slate-300">
              <div className="flex justify-between">
                <span>OP. GRAVADA:</span>
                <span>S/ {issuedVoucher?.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>I.G.V. (18%):</span>
                <span>S/ {issuedVoucher?.igv.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-xs text-slate-900 pt-1">
                <span>TOTAL A PAGAR:</span>
                <span>S/ {issuedVoucher?.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-0.5 text-[10px]">
              <div className="flex justify-between">
                <span>MÉTODO DE PAGO:</span>
                <span className="font-bold">{issuedVoucher?.paymentMethod}</span>
              </div>
              {issuedVoucher?.change ? (
                <div className="flex justify-between text-emerald-800 font-bold">
                  <span>VUELTO:</span>
                  <span>S/ {issuedVoucher.change.toFixed(2)}</span>
                </div>
              ) : null}
            </div>

            <div className="text-center text-[9px] text-slate-400 pt-2 border-t border-dashed border-slate-300">
              <p>¡GRACIAS POR SU PREFERENCIA!</p>
              <p>Representación impresa de Ticket Térmico 80mm</p>
            </div>
          </div>

          <DialogFooter className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 no-print">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTicketModalOpen(false)}
              className="text-xs font-semibold rounded-xl"
            >
              Cerrar
            </Button>
            {issuedVoucher?.s3Url && (
              <a
                href={`/api/sales/voucher/${issuedVoucher.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors shadow-2xs"
                title="Ver archivo del comprobante en S3"
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>Ver / Descargar S3</span>
              </a>
            )}
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

      {/* =================================================================== */}
      {/* MODAL 6: CANCELACIÓN AUDITADA DE COMANDA (LIBERACIÓN Y DEVOLUCIÓN) */}
      {/* =================================================================== */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl p-5 bg-white">
          <DialogHeader className="pb-3 border-b border-slate-200">
            <DialogTitle className="text-base font-bold text-rose-700 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-600" />
              <span>Cancelar Comanda #{orderToCancel?.code}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="py-3 flex flex-col gap-4">
            {/* Aviso informativo de reglas del negocio */}
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex flex-col gap-1.5">
              <div className="font-bold flex items-center gap-1.5 text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Acción irreversible bajo auditoría</span>
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-rose-800">
                <li>El pedido pasará inmediatamente a estado <strong>Cancelado</strong>.</li>
                <li>Si ocupaba mesa(s), <strong>quedarán disponibles</strong> de inmediato.</li>
                <li>Se repondrá el stock reservado en cocina para los dishes.</li>
                <li><strong>No generará ventas ni movimientos contables</strong>.</li>
              </ul>
            </div>

            {/* Datos del pedido a cancelar */}
            {orderToCancel && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs flex flex-col gap-1">
                <div className="flex justify-between font-semibold text-slate-800">
                  <span>Origen: {orderToCancel.orderType === "Mesa" && orderToCancel.table ? `Mesa ${orderToCancel.table.number}` : "Para Llevar"}</span>
                  <span className="text-red-700 font-bold">Total: {formatCurrency(orderToCancel.total)}</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Items: {orderToCancel.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                </div>
              </div>
            )}

            {/* Usuario responsable */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">
                Usuario / Mozo Responsable:
              </label>
              <Input
                value={cancelUser}
                onChange={(e) => setCancelUser(e.target.value)}
                placeholder="Nombre del mozo o supervisor"
                className="h-9 text-xs rounded-xl"
              />
            </div>

            {/* Motivo de la cancelación (Obligatorio) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Motivo de Cancelación:</span>
                <span className="text-rose-600 text-[10px] font-semibold">* Requerido</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Indique detalladamente el motivo de la cancelación..."
                rows={3}
                className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
              />

              {/* Botones rápidos de motivos comunes */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  "Cliente desistió de esperar",
                  "Error al registrar comanda",
                  "Cliente se retiró del salón",
                  "Pedido duplicado",
                ].map((motivo) => (
                  <button
                    key={motivo}
                    type="button"
                    onClick={() => setCancelReason(motivo)}
                    className="text-[10px] px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors cursor-pointer"
                  >
                    + {motivo}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2 pt-3 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCancelModalOpen(false)}
              disabled={cancellingOrder}
              className="text-xs font-semibold rounded-xl"
            >
              Regresar
            </Button>
            <Button
              size="sm"
              onClick={executeCancellation}
              disabled={cancellingOrder || !cancelReason.trim()}
              className="bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
            >
              {cancellingOrder ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                  <span>Cancelando...</span>
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5 mr-1" />
                  <span>Confirmar Cancelación</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODAL 1: APERTURA DE TURNO DE CAJA CON ARQUEO DE BILLETES Y MONEDAS */}
      {/* =================================================================== */}
      <Dialog open={openCashModal} onOpenChange={setOpenCashModal}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800 flex items-center justify-between pr-6">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <Unlock className="w-5 h-5" />
                </div>
                <span>Apertura de Turno de Caja</span>
              </div>
              <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                Conectado a Contabilidad
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-xl text-emerald-900 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-emerald-950">
                  {cashSessionState.register?.name || "Caja Principal - Salón"}
                </p>
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  El arqueo inicial quedará registrado en el Libro Diario contable (Asiento de Caja y Bancos) para el control del contador.
                </p>
              </div>
            </div>

            {/* Contador Interactivo de Billetes y Monedas */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-600" />
                  <span>Arqueo de Billetes y Monedas (Sencillo de Inicio)</span>
                </label>
                <span className="text-[11px] text-slate-500">
                  Total calculado: <strong className="text-emerald-700 font-extrabold">S/ {initialCashInput}</strong>
                </span>
              </div>

              <DenominationsCounter
                value={openDenominations}
                onChange={(updated, total) => {
                  setOpenDenominations(updated);
                  setInitialCashInput(total.toFixed(2));
                }}
              />
            </div>

            {/* Input Manual / Ajuste del Fondo */}
            <div className="pt-1">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Monto Inicial Total en Gaveta (S/.)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">
                  S/
                </span>
                <Input
                  type="number"
                  step="0.10"
                  min="0"
                  value={initialCashInput}
                  onChange={(e) => setInitialCashInput(e.target.value)}
                  placeholder="0.00"
                  className="pl-8 text-sm font-bold text-slate-800 rounded-xl bg-slate-50 border-slate-200 focus:bg-white"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Puedes ajustar el total directamente o contar las unidades arriba.
              </p>
            </div>

            {/* Observaciones de Apertura */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Observaciones de Apertura (Opcional)
              </label>
              <textarea
                value={openNotesInput}
                onChange={(e) => setOpenNotesInput(e.target.value)}
                placeholder="Ej. Recibido de administración para turno mañana..."
                rows={2}
                className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2 pt-3 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpenCashModal(false)}
              disabled={savingCashSession}
              className="text-xs font-semibold rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleOpenCashSession}
              disabled={savingCashSession}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {savingCashSession ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                  <span>Aperturando...</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5 mr-1" />
                  <span>Confirmar Apertura</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODAL 2: CIERRE Y ARQUEO DE CAJA CON BILLETES Y MONEDAS */}
      {/* =================================================================== */}
      <Dialog open={closeCashModal} onOpenChange={setCloseCashModal}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800 flex items-center justify-between pr-6">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-100 text-red-700 rounded-xl">
                  <Lock className="w-5 h-5" />
                </div>
                <span>Cierre y Arqueo de Caja</span>
              </div>
              <Badge className="bg-red-100 text-red-800 text-[10px] font-bold">
                Asiento Contable SUNAT
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {cashSessionState.activeSession && (() => {
            const exp = cashSessionState.activeSession.expectedAmount;
            const counted = parseFloat(countedCashInput);
            const hasCounted = !isNaN(counted) && countedCashInput.trim() !== "";
            const diff = hasCounted ? Math.round((counted - exp) * 100) / 100 : 0;

            return (
              <div className="space-y-4 py-2 text-xs">
                {/* Desglose de ingresos y egresos de la sesión */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Fondo Inicio</span>
                    <span className="text-xs font-bold text-slate-700">
                      {formatCurrency(cashSessionState.activeSession.initialAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Ventas Efectivo</span>
                    <span className="text-xs font-bold text-emerald-600">
                      +{formatCurrency(cashSessionState.activeSession.salesCash)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Salidas Emerg.</span>
                    <span className="text-xs font-bold text-rose-600">
                      -{formatCurrency(cashSessionState.activeSession.totalExpenses || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Digital (Yape/POS)</span>
                    <span className="text-xs font-bold text-blue-600">
                      {formatCurrency(cashSessionState.activeSession.salesOther)}
                    </span>
                  </div>
                  <div className="border-t pt-2 col-span-2 sm:col-span-4 flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800">Efectivo Real Esperado en Gaveta:</span>
                    <span className="text-sm font-black text-red-700">
                      {formatCurrency(exp)}
                    </span>
                  </div>
                </div>

                {/* Arqueo Detallado de Billetes y Monedas */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Banknote className="w-4 h-4 text-emerald-600" />
                      <span>Conteo Físico de Billetes y Monedas</span>
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Total Contado: <strong className="text-red-700 font-extrabold">S/ {countedCashInput || "0.00"}</strong>
                    </span>
                  </div>

                  <DenominationsCounter
                    value={closeDenominations}
                    onChange={(updated, total) => {
                      setCloseDenominations(updated);
                      setCountedCashInput(total.toFixed(2));
                    }}
                  />
                </div>

                {/* Input de Efectivo Contado Físicamente */}
                <div className="pt-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Efectivo Total Contado en Gaveta (S/.) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">
                      S/
                    </span>
                    <Input
                      type="number"
                      step="0.10"
                      min="0"
                      value={countedCashInput}
                      onChange={(e) => setCountedCashInput(e.target.value)}
                      placeholder="0.00"
                      className="pl-8 text-sm font-bold text-slate-800 rounded-xl bg-slate-50 border-slate-200 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Comparador y cálculo de discrepancia */}
                {hasCounted && (
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between ${diff === 0
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : diff > 0
                        ? "bg-blue-50 border-blue-200 text-blue-800"
                        : "bg-rose-50 border-rose-200 text-rose-800"
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      {diff === 0 ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <AlertCircle className={`w-4 h-4 ${diff > 0 ? "text-blue-600" : "text-rose-600"}`} />
                      )}
                      <div>
                        <div className="font-bold text-xs">
                          {diff === 0
                            ? "Caja Cuadrada Perfecta"
                            : diff > 0
                              ? "Sobrante de Caja"
                              : "Faltante de Caja"}
                        </div>
                        <div className="text-[11px] opacity-80">
                          {diff === 0
                            ? "El dinero contado coincide con el esperado."
                            : diff > 0
                              ? "Hay más dinero en gaveta del registrado por el sistema."
                              : "Hay menos dinero en gaveta del esperado por el sistema."}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-extrabold block">
                        {diff >= 0 ? `+S/ ${diff.toFixed(2)}` : `-S/ ${Math.abs(diff).toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                )}

                {/* Observaciones de Cierre */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Observaciones / Motivo de Discrepancia {diff !== 0 && hasCounted ? "(Recomendado)" : "(Opcional)"}
                  </label>
                  <textarea
                    value={closeNotesInput}
                    onChange={(e) => setCloseNotesInput(e.target.value)}
                    placeholder="Indique notas de cierre o justificación si existió faltante o sobrante..."
                    rows={2}
                    className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
              </div>
            );
          })()}

          <DialogFooter className="flex gap-2 pt-3 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCloseCashModal(false)}
              disabled={savingCashSession}
              className="text-xs font-semibold rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleCloseCashSession}
              disabled={savingCashSession || !countedCashInput.trim()}
              className="bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {savingCashSession ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                  <span>Procesando Arqueo...</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 mr-1" />
                  <span>Confirmar Cierre y Arqueo</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODAL 7: SALIDA DE DINERO POR EMERGENCIA (EGRESO DE CAJA) */}
      {/* =================================================================== */}
      <Dialog open={expenseModalOpen} onOpenChange={setExpenseModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md bg-white rounded-2xl p-5 sm:p-6">
          <DialogHeader className="pb-2 border-b border-slate-200">
            <DialogTitle className="text-base font-bold text-amber-900 flex items-center gap-2">
              <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                <ArrowDownCircle className="w-5 h-5" />
              </div>
              <span>Salida de Caja por Emergencia</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            {/* Alerta de Contabilidad */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-amber-950">
                  Descuento de Gaveta e Integración Contable
                </p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  El monto retirado se descontará del saldo esperado en caja y generará automáticamente un asiento de gasto menor en el Libro Diario para el contador.
                </p>
              </div>
            </div>

            {/* Saldo actual en gaveta */}
            {cashSessionState.activeSession && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Saldo actual en gaveta:</span>
                <span className="text-sm font-black text-slate-800">
                  {formatCurrency(cashSessionState.activeSession.expectedAmount)}
                </span>
              </div>
            )}

            {/* Input Monto */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ¿Cuánto dinero sacaste? (S/.) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">
                  S/
                </span>
                <Input
                  type="number"
                  step="0.50"
                  min="0.10"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-8 text-sm font-bold text-slate-800 rounded-xl bg-slate-50 border-slate-200 focus:bg-white"
                  autoFocus
                />
              </div>

              {/* Botones rápidos de monto */}
              <div className="flex gap-1.5 pt-2">
                {["10.00", "20.00", "30.00", "50.00", "100.00"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setExpenseAmount(preset)}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer border border-slate-200"
                  >
                    S/ {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Motivo */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ¿Por qué lo sacaste? (Motivo o Justificación) *
              </label>
              <textarea
                value={expenseReason}
                onChange={(e) => setExpenseReason(e.target.value)}
                placeholder="Ej. Balón de gas de cocina se terminó, compra urgente de bolsas y envases, delivery de emergencia..."
                rows={3}
                className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />

              {/* Botones rápidos de motivos comunes */}
              <div className="flex flex-wrap gap-1.5 pt-1.5">
                {[
                  "Compra urgente de balón de gas",
                  "Compra de verduras e insumos frescos",
                  "Bolsas y envases descartables",
                  "Pago de delivery / transporte de emergencia",
                  "Mantenimiento o reparación urgente",
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setExpenseReason(preset)}
                    className="text-[10px] px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition-colors cursor-pointer"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2 pt-3 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpenseModalOpen(false)}
              disabled={savingExpense}
              className="text-xs font-semibold rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleRegisterExpense}
              disabled={savingExpense || !expenseAmount || !expenseReason.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {savingExpense ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                  <span>Registrando...</span>
                </>
              ) : (
                <>
                  <ArrowDownCircle className="w-3.5 h-3.5 mr-1" />
                  <span>Confirmar Salida</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODAL 3: AUDITORÍA Y COMPROBANTE DE ARQUEO DE CAJA */}
      {/* =================================================================== */}
      <Dialog open={auditModalOpen} onOpenChange={setAuditModalOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span>Reporte de Cierre de Caja</span>
            </DialogTitle>
          </DialogHeader>

          {lastClosedAudit && (
            <div className="space-y-3 py-2 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="font-extrabold text-slate-800">{lastClosedAudit.registerName}</span>
                  <Badge className="bg-slate-700 text-white text-[10px]">CERRADA</Badge>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Apertura:</span>
                  <span className="font-medium text-slate-800">
                    {new Date(lastClosedAudit.openedAt).toLocaleString()} ({lastClosedAudit.openedBy})
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Cierre:</span>
                  <span className="font-medium text-slate-800">
                    {new Date(lastClosedAudit.closedAt).toLocaleString()} ({lastClosedAudit.closedBy})
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Fondo Inicial:</span>
                  <span className="font-medium text-slate-800">{formatCurrency(lastClosedAudit.initialAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Ventas en Efectivo:</span>
                  <span className="font-semibold text-emerald-600">+{formatCurrency(lastClosedAudit.salesCash)}</span>
                </div>
                {Number(lastClosedAudit.totalExpenses) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Salidas de Emergencia:</span>
                    <span className="font-semibold text-rose-600">-{formatCurrency(lastClosedAudit.totalExpenses)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Ventas Digitales:</span>
                  <span className="font-semibold text-blue-600">{formatCurrency(lastClosedAudit.salesOther)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-800 pt-1 border-t border-slate-200">
                  <span>Efectivo Esperado:</span>
                  <span>{formatCurrency(lastClosedAudit.expectedAmount)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-800">
                  <span>Efectivo Contado:</span>
                  <span>{formatCurrency(lastClosedAudit.countedAmount)}</span>
                </div>
                <div className={`flex justify-between font-extrabold text-xs pt-1.5 border-t ${lastClosedAudit.difference === 0
                  ? "text-emerald-700"
                  : lastClosedAudit.difference > 0
                    ? "text-blue-700"
                    : "text-rose-700"
                  }`}>
                  <span>Diferencia (Arqueo):</span>
                  <span>
                    {lastClosedAudit.difference === 0
                      ? "S/ 0.00 (Exacto)"
                      : lastClosedAudit.difference > 0
                        ? `+S/ ${lastClosedAudit.difference.toFixed(2)} (Sobrante)`
                        : `-S/ ${Math.abs(lastClosedAudit.difference).toFixed(2)} (Faltante)`}
                  </span>
                </div>
                {lastClosedAudit.denominationsSummary && (
                  <div className="text-[11px] text-slate-600 pt-2 border-t border-slate-200">
                    <span className="font-bold text-slate-700 block mb-0.5">Desglose físico:</span>
                    <span>{lastClosedAudit.denominationsSummary}</span>
                  </div>
                )}
                {lastClosedAudit.notesClosing && (
                  <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200 italic">
                    Notas: &ldquo;{lastClosedAudit.notesClosing}&rdquo;
                  </div>
                )}
                <div className="mt-2 pt-2 border-t border-emerald-200/60 bg-emerald-50/50 p-2 rounded-lg text-[10px] text-emerald-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Asientos contables comunicados y registrados en el Libro Diario para el contador.</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2 pt-3 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="text-xs font-semibold rounded-xl flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setAuditModalOpen(false)}
              className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>Entendido y Cerrar</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function SalesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Cargando Módulo de Ventas...</div>}>
      <SalesManagementContent />
    </Suspense>
  );
}
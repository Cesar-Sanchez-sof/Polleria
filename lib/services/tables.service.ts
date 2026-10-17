/**
 * Servicio frontend para el módulo Gestión de Mesas y Caja.
 * Centraliza las llamadas HTTP hacia /api/tables, /api/orders, /api/products, /api/sales y /api/payment-methods.
 */

export interface MenuProduct {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string; // "pollos" | "adicionales" | "bebidas" | "otros"
  image: string;
  /** Unidades en stock del producto (el mismo stock del Kardex). */
  stock?: number;
}

export interface OrderLineItem {
  id?: number;
  productId: number;
  name: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  itemStatus?: string;
  notes?: string;
}

export interface OrderSummary {
  id: number;
  orderTableId?: number;
  code: string;
  orderType: "Mesa" | "Llevar";
  orderedAt: string;
  status: string; // "Received" | "Preparing" | "Ready" | "Served" | "Closed" | "Cancelled"
  table: { id: number; number: number } | null;
  notes: string;
  items: OrderLineItem[];
  total: number;
  editable: boolean;
}

export interface TableItem {
  id: number;
  number: number;
  capacity: number;
  occupied: boolean;
  activeOrder: {
    id: number;
    orderTableId: number;
    code: string;
    orderType: string;
    orderedAt: string;
    status: string;
    tableNotes: string;
    items: OrderLineItem[];
    total: number;
    editable: boolean;
    isAnnexed?: boolean;
  } | null;
}

export interface TablesSummary {
  total: number;
  available: number;
  occupied: number;
}

export interface PaymentMethodItem {
  id: number;
  name: string;
  active: boolean;
  gatewayConfig?: {
    supportsTapToPay: boolean;
    supportsQr: boolean;
    preparedProvider: string;
  };
}

export interface IssuedVoucher {
  id: number;
  voucherType: "Boleta" | "Factura" | "Ticket";
  series: string;
  number: number;
  fullCode: string;
  s3Url?: string;
  issuedAt: string;
  subtotal: number;
  igv: number;
  total: number;
  paymentMethod: string;
  amountReceived: number;
  change: number;
  customer: {
    firstName: string;
    documentNumber: string;
    personType: string;
  };
  origin: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    notes: string;
  }>;
  gateway?: {
    provider: string;
    mode: string;
    status: string;
  } | null;
}

export interface CustomerItem {
  id: number;
  documentNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  personType: "Natural" | "Legal";
  active: boolean;
  totalPurchases: number;
}

export interface DailySalesSummary {
  totalCollected: number;
  salesCount: number;
  methodsBreakdown: {
    cash: number;
    yape: number;
    card: number;
    others: number;
  };
  vouchersBreakdown: {
    receipts: number;
    invoices: number;
    tickets: number;
  };
}

// Mapeo referencial de fotos para los platos de la carta (sin alterar la BD)
const DISH_IMAGES: Record<string, string> = {
  "1 pollo": "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=400&auto=format&fit=crop&q=80",
  "1/2 pollo": "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=400&auto=format&fit=crop&q=80",
  "1/4 pollo": "https://images.unsplash.com/photo-1594221708779-94832f4320d1?w=400&auto=format&fit=crop&q=80",
  "mostrito": "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&auto=format&fit=crop&q=80",
  "papas": "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&auto=format&fit=crop&q=80",
  "tequeño": "https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=400&auto=format&fit=crop&q=80",
  "chaufa": "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400&auto=format&fit=crop&q=80",
  "ensalada": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&auto=format&fit=crop&q=80",
  "inka": "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&auto=format&fit=crop&q=80",
  "chicha": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400&auto=format&fit=crop&q=80",
  "gaseosa": "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=400&auto=format&fit=crop&q=80",
};

export function getProductImage(name: string): string {
  const n = name.toLowerCase();
  for (const [key, url] of Object.entries(DISH_IMAGES)) {
    if (n.includes(key)) return url;
  }
  return "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&auto=format&fit=crop&q=80";
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(amount);
}

// ---------------------------------------------------------------------------
// Peticiones API
// ---------------------------------------------------------------------------

export async function listTables(): Promise<{ tables: TableItem[]; summary: TablesSummary }> {
  const res = await fetch("/api/tables", { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "No se pudo cargar el listado de mesas.");
  }
  const json = await res.json();
  return { tables: json.data, summary: json.summary };
}

export async function listProducts(category?: string): Promise<MenuProduct[]> {
  const url =
    category && category !== "todos"
      ? `/api/products?sellable=true&category=${category}`
      : "/api/products?sellable=true";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "No se pudo obtener la carta de productos.");
  }
  const json = await res.json();
  return (json.data || []).map((p: MenuProduct & { name: string }) => ({
    ...p,
    image: getProductImage(p.name),
  }));
}

export async function listOrders(filter?: { orderType?: string; status?: string }): Promise<OrderSummary[]> {
  const params = new URLSearchParams();
  if (filter?.orderType) params.set("orderType", filter.orderType);
  if (filter?.status) params.set("status", filter.status);

  const res = await fetch(`/api/orders?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "No se pudo listar los pedidos.");
  }
  const json = await res.json();
  return json.data || [];
}

export async function getOrder(id: number): Promise<OrderSummary> {
  const res = await fetch(`/api/orders/${id}`, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "No se pudo cargar el pedido.");
  }
  return res.json();
}

export async function createOrder(data: {
  orderType: "Mesa" | "Llevar";
  tableId?: number;
  additionalTables?: number[];
  notes?: string;
  items: Array<{ productId: number; quantity: number; notes?: string }>;
}): Promise<{ message: string; order: OrderSummary | null }> {
  const res = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error al crear el pedido.");
  }
  return res.json();
}

export async function editOrder(
  id: number,
  data: {
    notes?: string;
    items: Array<{ productId: number; quantity: number; notes?: string }>;
  }
): Promise<{ message: string }> {
  const res = await fetch(`/api/orders/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "No se pudo actualizar el pedido.");
  }
  return res.json();
}

export async function updateOrderStatus(
  id: number,
  status: "Received" | "Preparing" | "Ready" | "Served"
): Promise<{ message: string }> {
  const res = await fetch(`/api/orders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "No se pudo cambiar el estado del pedido.");
  }
  return res.json();
}

export async function cancelOrder(
  id: number,
  reason: string,
  user: string = "Mozo Salón"
): Promise<{ message: string }> {
  const res = await fetch(`/api/orders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "Cancelled", reason, user }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "No se pudo cancelar el pedido.");
  }
  return res.json();
}

export async function listPaymentMethods(): Promise<PaymentMethodItem[]> {
  const res = await fetch("/api/payment-methods", { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "No se pudieron obtener los tipos de pago.");
  }
  const json = await res.json();
  return json.data || [];
}

export async function registerSale(data: {
  orderId: number;
  paymentTypeId?: number;
  payments?: Array<{ paymentTypeId: number; amount: number }>;
  voucherType: "Boleta" | "Factura" | "Ticket";
  customer?: {
    documentNumber?: string;
    firstName: string;
    personType?: "Natural" | "Legal";
    phone?: string;
  };
  amountReceived?: number;
  gateway?: {
    provider?: string;
    mode?: "tap_to_pay" | "qr" | "manual";
    operationId?: string;
  };
}): Promise<{ message: string; invoice: IssuedVoucher }> {
  const res = await fetch("/api/sales", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "No se pudo registrar la venta.");
  }
  return res.json();
}

export async function listCustomers(search?: string): Promise<CustomerItem[]> {
  const url = search ? `/api/customers?q=${encodeURIComponent(search)}` : "/api/customers";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "No se pudo obtener el listado de clientes.");
  }
  const json = await res.json();
  return json.data || [];
}

export async function createCustomer(data: {
  documentNumber?: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  personType?: "Natural" | "Legal";
}): Promise<{ message: string; customer: CustomerItem }> {
  const res = await fetch("/api/customers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "No se pudo registrar el cliente.");
  }
  return res.json();
}

export async function listDailySales(
  date: string = "today"
): Promise<{ data: IssuedVoucher[]; dailySummary: DailySalesSummary }> {
  const res = await fetch(`/api/sales?date=${encodeURIComponent(date)}`, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "No se pudieron obtener las ventas del día.");
  }
  return res.json();
}

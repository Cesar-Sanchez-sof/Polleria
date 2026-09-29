/**
 * Servicio frontend para el módulo Gestión de Mesas y Caja.
 * Centraliza las llamadas HTTP hacia /api/mesas, /api/pedidos, /api/platos, /api/ventas y /api/tipos-pago.
 */

export interface PlatoCarta {
  id: number;
  nombre: string;
  descripcion: string;
  precio: number;
  categoria: string; // "pollos" | "adicionales" | "bebidas" | "otros"
  imagen: string;
}

export interface ItemDetallePedido {
  idDetalle?: number;
  idPlato: number;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subTotal: number;
  estadoPlato?: string;
  observaciones?: string;
}

export interface PedidoResumen {
  id: number;
  idPedidoMesa?: number;
  codigo: string;
  tipoPedido: "Mesa" | "Llevar";
  fecha: string;
  estado: string; // "Recibido" | "Preparando" | "Servido" | "Cerrado" | "Cancelado"
  mesa: { id: number; numero: number } | null;
  observacion: string;
  items: ItemDetallePedido[];
  total: number;
  editable: boolean;
}

export interface MesaItem {
  id: number;
  numero: number;
  aforo: number;
  ocupada: boolean;
  pedidoActivo: {
    id: number;
    idPedidoMesa: number;
    codigo: string;
    tipoPedido: string;
    fecha: string;
    estado: string;
    observacionMesa: string;
    items: ItemDetallePedido[];
    total: number;
    editable: boolean;
  } | null;
}

export interface ResumenMesas {
  total: number;
  disponibles: number;
  ocupadas: number;
}

export interface TipoPagoItem {
  id: number;
  nombre: string;
  estado: boolean;
  configPasarela?: {
    soportaTapToPay: boolean;
    soportaQr: boolean;
    proveedorPreparado: string;
  };
}

export interface ComprobanteEmitido {
  id: number;
  tipo: "Boleta" | "Factura" | "Ticket";
  serie: string;
  numero: number;
  codigoCompleto: string;
  fecha: string;
  subtotal: number;
  igv: number;
  total: number;
  metodoPago: string;
  montoRecibido: number;
  vuelto: number;
  cliente: {
    nombre: string;
    nroDoc: string;
    tipoPersona: string;
  };
  origen: string;
  items: Array<{
    nombre: string;
    cantidad: number;
    precioUnitario: number;
    subTotal: number;
    observaciones: string;
  }>;
  pasarela?: {
    proveedor: string;
    modo: string;
    estado: string;
  } | null;
}

export interface ClienteItem {
  id: number;
  nroDoc: string;
  nombre: string;
  apellido: string;
  nombreCompleto: string;
  telefono: string;
  tipoPersona: "Natural" | "Juridico";
  estado: boolean;
  totalCompras: number;
}

export interface VentasDiariasResumen {
  totalRecaudado: number;
  cantidadVentas: number;
  desgloseMetodos: {
    efectivo: number;
    yape: number;
    tarjeta: number;
    otros: number;
  };
  desgloseComprobantes: {
    boletas: number;
    facturas: number;
    tickets: number;
  };
}

// Mapeo referencial de fotos para los platos de la carta (sin alterar la BD)
const IMAGENES_PLATOS: Record<string, string> = {
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

export function obtenerImagenPlato(nombre: string): string {
  const n = nombre.toLowerCase();
  for (const [clave, url] of Object.entries(IMAGENES_PLATOS)) {
    if (n.includes(clave)) return url;
  }
  return "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&auto=format&fit=crop&q=80";
}

export function formatearMoneda(monto: number): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(monto);
}

// ---------------------------------------------------------------------------
// Peticiones API
// ---------------------------------------------------------------------------

export async function listarMesas(): Promise<{ mesas: MesaItem[]; resumen: ResumenMesas }> {
  const res = await fetch("/api/mesas", { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "No se pudo cargar el listado de mesas.");
  }
  const json = await res.json();
  return { mesas: json.data, resumen: json.resumen };
}

export async function listarPlatos(categoria?: string): Promise<PlatoCarta[]> {
  const url = categoria && categoria !== "todos" ? `/api/platos?categoria=${categoria}` : "/api/platos";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "No se pudo obtener la carta de productos.");
  }
  const json = await res.json();
  return (json.data || []).map((p: any) => ({
    ...p,
    imagen: obtenerImagenPlato(p.nombre),
  }));
}

export async function listarPedidos(filtro?: { tipo?: string; estado?: string }): Promise<PedidoResumen[]> {
  const params = new URLSearchParams();
  if (filtro?.tipo) params.set("tipo", filtro.tipo);
  if (filtro?.estado) params.set("estado", filtro.estado);

  const res = await fetch(`/api/pedidos?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "No se pudo listar los pedidos.");
  }
  const json = await res.json();
  return json.data || [];
}

export async function obtenerPedido(id: number): Promise<PedidoResumen> {
  const res = await fetch(`/api/pedidos/${id}`, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "No se pudo cargar el pedido.");
  }
  return res.json();
}

export async function crearPedido(datos: {
  tipo_pedido: "Mesa" | "Llevar";
  id_mesa?: number;
  observacion?: string;
  items: Array<{ id_plato: number; cantidad: number; observaciones?: string }>;
}): Promise<any> {
  const res = await fetch("/api/pedidos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error al crear el pedido.");
  }
  return res.json();
}

export async function editarPedido(
  id: number,
  datos: {
    observacion?: string;
    items: Array<{ id_plato: number; cantidad: number; observaciones?: string }>;
  }
): Promise<any> {
  const res = await fetch(`/api/pedidos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "No se pudo actualizar el pedido.");
  }
  return res.json();
}

export async function actualizarEstadoPedido(
  id: number,
  estado: "Recibido" | "Preparando" | "Servido"
): Promise<any> {
  const res = await fetch(`/api/pedidos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estado }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "No se pudo cambiar el estado del pedido.");
  }
  return res.json();
}

export async function listarTiposPago(): Promise<TipoPagoItem[]> {
  const res = await fetch("/api/tipos-pago", { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "No se pudieron obtener los tipos de pago.");
  }
  const json = await res.json();
  return json.data || [];
}

export async function registrarVenta(datos: {
  id_pedido: number;
  id_tipo_pago: number;
  tipo_comprobante: "Boleta" | "Factura" | "Ticket";
  cliente?: {
    nro_doc?: string;
    nombre: string;
    tipo_persona?: "Natural" | "Juridico";
    telefono?: string;
  };
  monto_recibido?: number;
  pasarela?: {
    proveedor?: string;
    modo?: "tap_to_pay" | "qr" | "manual";
    operacion_id?: string;
  };
}): Promise<{ mensaje: string; comprobante: ComprobanteEmitido }> {
  const res = await fetch("/api/ventas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "No se pudo registrar la venta.");
  }
  return res.json();
}

export async function listarClientes(busqueda?: string): Promise<ClienteItem[]> {
  const url = busqueda ? `/api/clientes?q=${encodeURIComponent(busqueda)}` : "/api/clientes";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "No se pudo obtener el listado de clientes.");
  }
  const json = await res.json();
  return json.data || [];
}

export async function crearCliente(datos: {
  nro_doc?: string;
  nombre: string;
  apellido?: string;
  telefono?: string;
  tipo_persona?: "Natural" | "Juridico";
}): Promise<{ mensaje: string; cliente: ClienteItem }> {
  const res = await fetch("/api/clientes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "No se pudo registrar el cliente.");
  }
  return res.json();
}

export async function listarVentasDiarias(
  fecha: string = "hoy"
): Promise<{ data: ComprobanteEmitido[]; resumenDiario: VentasDiariasResumen }> {
  const res = await fetch(`/api/ventas?fecha=${encodeURIComponent(fecha)}`, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "No se pudieron obtener las ventas del día.");
  }
  return res.json();
}


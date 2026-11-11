/**
 * Capa Semántica de Datos para el Motor Analítico estilo Power BI.
 *
 * Define la abstracción completa sobre Prisma:
 * - Datasets con baseFilter real verificado en código, requiredPermission, isTransactional y relaciones.
 * - Dimensiones con valueLabels (traducción de Enums/Strings), hasTime y soporte de granularidad temporal.
 * - Medidas con agregaciones permitidas (sum, avg, count, countDistinct, min, max) y fórmulas calculadas.
 */

export type FieldKind = "dimension" | "measure";
export type FieldDataType = "string" | "number" | "date";
export type MeasureAggregation = "sum" | "avg" | "count" | "countDistinct" | "min" | "max";
export type DateGranularity =
  | "year"
  | "quarter"
  | "month"
  | "weekday"
  | "day"
  | "hour"
  | "hourOfDay";

export interface SemanticField {
  id: string;
  label: string;
  kind: FieldKind;
  dataType: FieldDataType;
  /** Campo técnico interno que debe ocultarse en el panel de selección de campos de la UI */
  hidden?: boolean;
  /** Indica si el campo de fecha contiene componente de hora (Timestamp) o si es fecha pura (@db.Date) */
  hasTime?: boolean;
  /** Agregaciones permitidas si kind === 'measure' */
  allowedAggregations?: MeasureAggregation[];
  /** Granularidades soportadas si dataType === 'date' */
  supportedGranularities?: DateGranularity[];
  /** Mapeo directo a columna escalar en Prisma (si aplica) */
  prismaField?: string;
  /** Ruta anidada para relaciones (ej. 'customer.firstName', 'account.code', 'purchaseOrder.issuedAt') */
  prismaPath?: string;
  /** Diccionario de traducción para valores de enums o códigos crudos */
  valueLabels?: Record<string, string>;
  /** Indica si la medida es calculada mediante fórmula en memoria */
  isCalculated?: boolean;
  /** Función para extraer el valor de la dimensión desde un objeto cargado */
  customExtractor?: (row: Record<string, unknown>) => unknown;
  /** Dependencias métricas necesarias para calcular calculateGroup en memoria */
  groupDependencies?: Array<{ field: string; agg: MeasureAggregation }>;
  /** Cálculo a nivel de fila individual antes de agregar */
  calculate?: (row: Record<string, unknown>) => number;
  /** Cálculo a nivel de grupo métrico agregado (ej. ticketPromedio = sumaTotal / numPedidos) */
  calculateGroup?: (metrics: Record<string, number>) => number;
  /** Descripción para tooltips */
  description?: string;
}

export interface SemanticDataset {
  id: string;
  label: string;
  description: string;
  /** Delegado correspondiente en PrismaClient */
  prismaModel:
    | "salesInvoice"
    | "purchaseInvoice"
    | "product"
    | "journalEntryDetail"
    | "salesOrder"
    | "orderItem"
    | "salesPayment"
    | "purchaseOrderItem"
    | "inventoryMovement"
    | "informalPurchase";
  /** Permiso RBAC mínimo requerido para consultar este dataset */
  requiredPermission: string;
  /** Indica si es un dataset transaccional que exige filtro de fechas en memoria */
  isTransactional?: boolean;
  /** Filtro base obligatorio de negocio (ej. excluir ventas anuladas o pedidos cancelados) */
  baseFilter?: Record<string, unknown>;
  /** Campo de fecha por defecto para filtrado y series temporales */
  defaultDateField?: string;
  /** Relaciones que findMany debe incluir para dimensiones compuestas */
  includeRelations?: Record<string, unknown>;
  /** Lista de campos analíticos del dataset */
  fields: SemanticField[];
}

export const DATE_GRANULARITIES_WITH_TIME: DateGranularity[] = [
  "year",
  "quarter",
  "month",
  "weekday",
  "day",
  "hour",
  "hourOfDay",
];

export const DATE_GRANULARITIES_DATE_ONLY: DateGranularity[] = [
  "year",
  "quarter",
  "month",
  "weekday",
  "day",
];

export const ALL_DATE_GRANULARITIES: DateGranularity[] = DATE_GRANULARITIES_WITH_TIME;

export const SEMANTIC_DATASETS: Record<string, SemanticDataset> = {
  // ==========================================================================
  // 1. VENTAS (SalesInvoice)
  // Valores reales verificados: status 'Issued' / 'Paid', cancelado: 'Cancelled' | 'Anulado'
  // ==========================================================================
  ventas: {
    id: "ventas",
    label: "Ventas y Facturación",
    description: "Comprobantes emitidos (Boletas, Facturas) e ingresos por ventas.",
    prismaModel: "salesInvoice",
    requiredPermission: "ventas.ver",
    isTransactional: true,
    defaultDateField: "fecha",
    baseFilter: {
      status: { notIn: ["Cancelled"] },
    },
    includeRelations: {
      customer: { select: { id: true, firstName: true, lastName: true, personType: true } },
    },
    fields: [
      {
        id: "id",
        label: "ID Comprobante",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["count", "countDistinct"],
        prismaField: "id",
        hidden: true,
      },
      {
        id: "fecha",
        label: "Fecha de emisión (comprobante)",
        kind: "dimension",
        dataType: "date",
        hasTime: false,
        supportedGranularities: ALL_DATE_GRANULARITIES,
        prismaField: "issuedAt",
      },
      {
        id: "fechaCreacion",
        label: "Fecha y hora de la venta",
        kind: "dimension",
        dataType: "date",
        hasTime: true,
        supportedGranularities: ALL_DATE_GRANULARITIES,
        prismaField: "createdAt",
      },
      {
        id: "tipoComprobante",
        label: "Tipo de Comprobante",
        kind: "dimension",
        dataType: "string",
        prismaField: "voucherType",
        valueLabels: {
          "01": "Factura",
          "03": "Boleta",
          Factura: "Factura",
          Boleta: "Boleta",
          NotaVenta: "Nota de Venta",
        },
      },
      {
        id: "serie",
        label: "Serie",
        kind: "dimension",
        dataType: "string",
        prismaField: "series",
      },
      {
        id: "estado",
        label: "Estado",
        kind: "dimension",
        dataType: "string",
        prismaField: "status",
        valueLabels: {
          Issued: "Emitida",
          Paid: "Pagada",
          Pending: "Pendiente",
          Cancelled: "Anulada",
        },
      },
      {
        id: "cliente",
        label: "Cliente",
        kind: "dimension",
        dataType: "string",
        prismaPath: "customer.firstName",
        customExtractor: (r) => {
          const c = r.customer as { firstName?: string; lastName?: string } | undefined;
          if (!c) return "Cliente Varios";
          const full = `${c.firstName || ""} ${c.lastName || ""}`.trim();
          return full || "Cliente Varios";
        },
      },
      {
        id: "tipoPersona",
        label: "Tipo de Persona",
        kind: "dimension",
        dataType: "string",
        prismaPath: "customer.personType",
        valueLabels: {
          Natural: "Persona Natural",
          Legal: "Persona Jurídica",
          NATURAL: "Persona Natural",
          JURIDICA: "Persona Jurídica",
        },
        customExtractor: (r) => (r.customer as { personType?: string } | undefined)?.personType || "Natural",
      },
      {
        id: "sesionCaja",
        label: "Sesión de Caja",
        kind: "dimension",
        dataType: "number",
        prismaField: "cashSessionId",
        customExtractor: (r) => r.cashSessionId ? `Caja #${r.cashSessionId}` : "Sin Sesión",
      },
      {
        id: "subtotal",
        label: "Subtotal (S/)",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["sum", "avg", "min", "max"],
        prismaField: "subtotal",
      },
      {
        id: "igv",
        label: "IGV (S/)",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["sum", "avg", "min", "max"],
        prismaField: "igv",
      },
      {
        id: "total",
        label: "Total Ventas (S/)",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["sum", "avg", "count", "min", "max"],
        prismaField: "totalAmount",
      },
      {
        id: "numComprobantes",
        label: "Nº Comprobantes",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["count"],
        prismaField: "id",
      },
    ],
  },

  // ==========================================================================
  // 2. COMPRAS (PurchaseInvoice)
  // Nota: PurchaseInvoice no contiene ítems individuales; ver compras_detalle.
  // ==========================================================================
  compras: {
    id: "compras",
    label: "Compras a Proveedores (Comprobantes)",
    description:
      "Facturas y boletas de compra generales (Nota: PurchaseInvoice no contiene ítems directos; ver 'compras_detalle' para desglose de insumos).",
    prismaModel: "purchaseInvoice",
    requiredPermission: "compras.ver",
    isTransactional: true,
    defaultDateField: "fecha",
    baseFilter: {
      active: true,
    },
    includeRelations: {
      supplier: { select: { id: true, businessName: true, ruc: true } },
    },
    fields: [
      {
        id: "id",
        label: "ID Compra",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["count", "countDistinct"],
        prismaField: "id",
        hidden: true,
      },
      {
        id: "fecha",
        label: "Fecha de Emisión",
        kind: "dimension",
        dataType: "date",
        hasTime: false,
        supportedGranularities: ALL_DATE_GRANULARITIES,
        prismaField: "issuedAt",
      },
      {
        id: "fechaCreacion",
        label: "Fecha y Hora Registro",
        kind: "dimension",
        dataType: "date",
        hasTime: true,
        supportedGranularities: ALL_DATE_GRANULARITIES,
        prismaField: "createdAt",
      },
      {
        id: "tipoComprobante",
        label: "Tipo de Comprobante",
        kind: "dimension",
        dataType: "string",
        prismaField: "voucherType",
      },
      {
        id: "serie",
        label: "Serie",
        kind: "dimension",
        dataType: "string",
        prismaField: "series",
      },
      {
        id: "proveedor",
        label: "Proveedor",
        kind: "dimension",
        dataType: "string",
        prismaPath: "supplier.businessName",
        customExtractor: (r) => (r.supplier as { businessName?: string } | undefined)?.businessName || "Sin Proveedor",
      },
      {
        id: "rucProveedor",
        label: "RUC Proveedor",
        kind: "dimension",
        dataType: "string",
        prismaPath: "supplier.ruc",
        customExtractor: (r) => (r.supplier as { ruc?: string } | undefined)?.ruc || "-",
      },
      {
        id: "subtotal",
        label: "Subtotal Compra (S/)",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["sum", "avg", "min", "max"],
        prismaField: "subtotal",
      },
      {
        id: "igv",
        label: "IGV Compra (S/)",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["sum", "avg", "min", "max"],
        prismaField: "igv",
      },
      {
        id: "total",
        label: "Total Compras (S/)",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["sum", "avg", "count", "min", "max"],
        prismaField: "totalAmount",
      },
    ],
  },

  // ==========================================================================
  // 3. INVENTARIO (Product) - Maestro de productos (No transaccional)
  // ==========================================================================
  inventario: {
    id: "inventario",
    label: "Inventario y Stock de Productos",
    description: "Insumos, platos terminados, stock en almacén, costos promedio y valorización.",
    prismaModel: "product",
    requiredPermission: "inventario.ver",
    isTransactional: false,
    fields: [
      {
        id: "id",
        label: "ID Producto",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["count"],
        prismaField: "id",
        hidden: true,
      },
      {
        id: "nombre",
        label: "Nombre de Insumo / Plato",
        kind: "dimension",
        dataType: "string",
        prismaField: "name",
      },
      {
        id: "tipo",
        label: "Tipo de Producto",
        kind: "dimension",
        dataType: "string",
        prismaField: "type",
        valueLabels: {
          RawMaterial: "Insumo",
          FinishedProduct: "Producto Terminado",
        },
      },
      {
        id: "unidad",
        label: "Unidad de Medida",
        kind: "dimension",
        dataType: "string",
        prismaField: "unitOfMeasure",
      },
      {
        id: "stockActual",
        label: "Stock Actual",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["sum", "avg", "min", "max"],
        prismaField: "currentStock",
      },
      {
        id: "stockMinimo",
        label: "Stock Mínimo",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["sum", "avg", "min", "max"],
        prismaField: "minimumStock",
      },
      {
        id: "costoUltimo",
        label: "Último Costo (S/)",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["avg", "min", "max"],
        prismaField: "lastCost",
      },
      {
        id: "costoPromedio",
        label: "Costo Promedio (S/)",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["avg", "min", "max"],
        prismaField: "averageCost",
      },
      {
        id: "valorInventario",
        label: "Valor del Inventario (S/)",
        kind: "measure",
        dataType: "number",
        isCalculated: true,
        allowedAggregations: ["sum"],
        calculate: (row) =>
          (Number(row.currentStock) || 0) * (Number(row.averageCost) || 0),
      },
      {
        id: "productosBajoMinimo",
        label: "Productos Bajo Mínimo",
        kind: "measure",
        dataType: "number",
        isCalculated: true,
        allowedAggregations: ["count"],
        calculate: (row) =>
          Number(row.currentStock || 0) <= Number(row.minimumStock || 0) ? 1 : 0,
      },
    ],
  },

  // ==========================================================================
  // 4. CONTABILIDAD (JournalEntryDetail)
  // Origen con 5 valores: Venta, Compra, Planilla, Transformación, Manual.
  // Dimensiones: periodo, responsable, codigoAsiento y medida numLineas.
  // ==========================================================================
  contabilidad: {
    id: "contabilidad",
    label: "Contabilidad y Libro Diario",
    description: "Asientos y detalles contables, cuentas del PCGE, movimientos deudores y acreedores.",
    prismaModel: "journalEntryDetail",
    requiredPermission: "asientos.ver",
    isTransactional: true,
    defaultDateField: "fecha",
    baseFilter: {
      entry: { status: true },
    },
    includeRelations: {
      account: { select: { id: true, code: true, name: true, type: true } },
      entry: {
        select: {
          id: true,
          code: true,
          book: true,
          responsible: true,
          entryDate: true,
          createdAt: true,
          periodId: true,
          period: { select: { id: true, startDate: true, endDate: true } },
          salesInvoiceId: true,
          purchaseInvoiceId: true,
          payrollId: true,
          payrollPeriodId: true,
          transformationId: true,
        },
      },
    },
    fields: [
      {
        id: "cuenta",
        label: "Cuenta Contable",
        kind: "dimension",
        dataType: "string",
        prismaPath: "account.name",
        customExtractor: (r) => {
          const acc = r.account as { code?: string; name?: string } | undefined;
          return acc ? `${acc.code || ""} - ${acc.name || ""}`.trim() : "Cuenta Desconocida";
        },
      },
      {
        id: "tipoCuenta",
        label: "Tipo de Cuenta",
        kind: "dimension",
        dataType: "string",
        prismaPath: "account.type",
        customExtractor: (r) => (r.account as { type?: string } | undefined)?.type || "Balance",
      },
      {
        id: "claseContable",
        label: "Clase Contable (Elemento)",
        kind: "dimension",
        dataType: "string",
        customExtractor: (r) => {
          const acc = r.account as { code?: string } | undefined;
          const code = acc?.code || "";
          return code.length >= 2 ? code.slice(0, 2) : code || "Otras";
        },
      },
      {
        id: "libro",
        label: "Libro Contable",
        kind: "dimension",
        dataType: "string",
        prismaPath: "entry.book",
        customExtractor: (r) => (r.entry as { book?: string } | undefined)?.book || "Diario General",
      },
      {
        id: "fecha",
        label: "Fecha del Asiento",
        kind: "dimension",
        dataType: "date",
        hasTime: false,
        supportedGranularities: ALL_DATE_GRANULARITIES,
        prismaPath: "entry.entryDate",
        customExtractor: (r) => (r.entry as { entryDate?: Date } | undefined)?.entryDate || null,
      },
      {
        id: "fechaRegistro",
        label: "Fecha y hora de registro",
        kind: "dimension",
        dataType: "date",
        hasTime: true,
        supportedGranularities: ALL_DATE_GRANULARITIES,
        prismaPath: "entry.createdAt",
        customExtractor: (r) => (r.entry as { createdAt?: Date } | undefined)?.createdAt || null,
      },
      {
        id: "periodo",
        label: "Periodo Contable",
        kind: "dimension",
        dataType: "string",
        prismaPath: "entry.periodId",
        customExtractor: (r) => {
          const entry = r.entry as { period?: { startDate?: Date }; periodId?: number } | undefined;
          if (entry?.period?.startDate) {
            const d = new Date(entry.period.startDate);
            return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
          }
          return entry?.periodId ? `Periodo #${entry.periodId}` : "Sin Periodo";
        },
      },
      {
        id: "responsable",
        label: "Responsable",
        kind: "dimension",
        dataType: "string",
        prismaPath: "entry.responsible",
        customExtractor: (r) => (r.entry as { responsible?: string } | undefined)?.responsible || "Sistema",
      },
      {
        id: "codigoAsiento",
        label: "Código de Asiento",
        kind: "dimension",
        dataType: "string",
        prismaPath: "entry.code",
        customExtractor: (r) => (r.entry as { code?: string } | undefined)?.code || "-",
      },
      {
        id: "origen",
        label: "Origen del Asiento",
        kind: "dimension",
        dataType: "string",
        customExtractor: (r) => {
          const entry = r.entry as
            | {
                salesInvoiceId?: number | null;
                purchaseInvoiceId?: number | null;
                payrollId?: number | null;
                payrollPeriodId?: number | null;
                transformationId?: number | null;
              }
            | undefined;
          if (entry?.salesInvoiceId) return "Venta";
          if (entry?.purchaseInvoiceId) return "Compra";
          if (entry?.payrollId || entry?.payrollPeriodId) return "Planilla";
          if (entry?.transformationId) return "Transformación";
          return "Manual";
        },
      },
      {
        id: "debe",
        label: "Debe (S/)",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["sum", "avg", "min", "max"],
        prismaField: "debit",
      },
      {
        id: "haber",
        label: "Haber (S/)",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["sum", "avg", "min", "max"],
        prismaField: "credit",
      },
      {
        id: "saldoDeudor",
        label: "Saldo Deudor (S/)",
        kind: "measure",
        dataType: "number",
        isCalculated: true,
        allowedAggregations: ["sum"],
        calculateGroup: (metrics) =>
          Math.max(0, (metrics.debe_sum || 0) - (metrics.haber_sum || 0)),
      },
      {
        id: "saldoAcreedor",
        label: "Saldo Acreedor (S/)",
        kind: "measure",
        dataType: "number",
        isCalculated: true,
        allowedAggregations: ["sum"],
        calculateGroup: (metrics) =>
          Math.max(0, (metrics.haber_sum || 0) - (metrics.debe_sum || 0)),
      },
      {
        id: "numAsientos",
        label: "Nº Asientos",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["countDistinct"],
        prismaField: "entryId",
      },
      {
        id: "numLineas",
        label: "Nº Líneas",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["count"],
        prismaField: "id",
      },
    ],
  },

  // ==========================================================================
  // 5. PEDIDOS (SalesOrder)
  // Valores reales verificados: status 'Received'|'Preparing'|'Ready'|'Served'|'Closed', cancelado: 'Cancelled'
  // Medida: ticketPromedio = importeTotal / numPedidos (calculado a nivel de grupo sum/sum)
  // ==========================================================================
  pedidos: {
    id: "pedidos",
    label: "Pedidos del Salón y Despacho",
    description: "Comandas registradas en salón, delivery o para llevar.",
    prismaModel: "salesOrder",
    requiredPermission: "pedidos.ver",
    isTransactional: true,
    baseFilter: {
      status: { notIn: ["Cancelled"] },
    },
    includeRelations: {
      items: {
        where: { itemStatus: { notIn: ["Cancelled"] } },
        select: { id: true, subtotal: true, quantity: true, itemStatus: true },
      },
    },
    fields: [
      {
        id: "codigo",
        label: "Código de Pedido",
        kind: "dimension",
        dataType: "string",
        prismaField: "code",
      },
      {
        id: "fechaHora",
        label: "Fecha y Hora del Pedido",
        kind: "dimension",
        dataType: "date",
        hasTime: true,
        supportedGranularities: ALL_DATE_GRANULARITIES,
        prismaField: "orderedAt",
      },
      {
        id: "tipoPedido",
        label: "Tipo de Pedido",
        kind: "dimension",
        dataType: "string",
        prismaField: "orderType",
        valueLabels: {
          Mesa: "Salón (Mesa)",
          Llevar: "Para Llevar",
          Delivery: "Delivery",
        },
      },
      {
        id: "estado",
        label: "Estado",
        kind: "dimension",
        dataType: "string",
        prismaField: "status",
        valueLabels: {
          Pending: "Pendiente",
          Received: "Recibido",
          Preparing: "En Preparación",
          Ready: "Listo",
          Served: "Servido",
          Closed: "Cerrado",
          Cancelled: "Cancelado",
        },
      },
      {
        id: "numPedidos",
        label: "Nº Pedidos",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["count"],
        prismaField: "id",
      },
      {
        id: "importeTotal",
        label: "Importe Total (S/)",
        kind: "measure",
        dataType: "number",
        isCalculated: true,
        allowedAggregations: ["sum"],
        calculate: (r) => {
          const items = (r.items as Array<{ subtotal?: unknown; itemStatus?: string }>) || [];
          return items
            .filter((it) => it.itemStatus !== "Cancelled")
            .reduce((sum, it) => sum + (Number(it.subtotal) || 0), 0);
        },
      },
      {
        id: "ticketPromedio",
        label: "Ticket Promedio (S/)",
        kind: "measure",
        dataType: "number",
        isCalculated: true,
        allowedAggregations: ["avg"],
        groupDependencies: [
          { field: "importeTotal", agg: "sum" },
          { field: "numPedidos", agg: "count" },
        ],
        calculateGroup: (metrics) => {
          const total = metrics.importeTotal_sum || 0;
          const pedidosCount = metrics.numPedidos_count || 0;
          return pedidosCount > 0 ? total / pedidosCount : 0;
        },
      },
    ],
  },

  // ==========================================================================
  // 6. PLATOS VENDIDOS (OrderItem)
  // Valores reales verificados: itemStatus 'Pending'|'Preparing'|'Ready'|'Served', cancelado: 'Cancelled'
  // Dimensiones: tipoPedido, estadoPedido, tipoProducto
  // Medidas: Precio promedio por unidad, numPedidos (countDistinct orderId)
  // ==========================================================================
  platos_vendidos: {
    id: "platos_vendidos",
    label: "Platos y Productos Vendidos",
    description: "Desglose por plato de cada comanda, tiempos y cantidades vendidas.",
    prismaModel: "orderItem",
    requiredPermission: "ventas.ver",
    isTransactional: true,
    baseFilter: {
      itemStatus: { notIn: ["Cancelled"] },
      order: { status: { notIn: ["Cancelled"] } },
    },
    includeRelations: {
      product: { select: { id: true, name: true, type: true } },
      order: { select: { id: true, orderedAt: true, orderType: true, status: true } },
    },
    fields: [
      {
        id: "producto",
        label: "Plato / Bebida",
        kind: "dimension",
        dataType: "string",
        prismaPath: "product.name",
        customExtractor: (r) => (r.product as { name?: string } | undefined)?.name || "Desconocido",
      },
      {
        id: "tipoProducto",
        label: "Tipo de Producto",
        kind: "dimension",
        dataType: "string",
        prismaPath: "product.type",
        valueLabels: {
          RawMaterial: "Insumo",
          FinishedProduct: "Producto Terminado",
        },
        customExtractor: (r) => (r.product as { type?: string } | undefined)?.type || "FinishedProduct",
      },
      {
        id: "estadoPlato",
        label: "Estado del Plato en Cocina",
        kind: "dimension",
        dataType: "string",
        prismaField: "itemStatus",
        valueLabels: {
          Pending: "Pendiente",
          Preparing: "Preparando",
          Ready: "Listo",
          Served: "Servido",
          Cancelled: "Cancelado",
        },
      },
      {
        id: "tipoPedido",
        label: "Tipo de Pedido",
        kind: "dimension",
        dataType: "string",
        prismaPath: "order.orderType",
        valueLabels: {
          Mesa: "Salón (Mesa)",
          Llevar: "Para Llevar",
          Delivery: "Delivery",
        },
        customExtractor: (r) => (r.order as { orderType?: string } | undefined)?.orderType || "Mesa",
      },
      {
        id: "estadoPedido",
        label: "Estado del Pedido",
        kind: "dimension",
        dataType: "string",
        prismaPath: "order.status",
        valueLabels: {
          Pending: "Pendiente",
          Received: "Recibido",
          Preparing: "En Preparación",
          Ready: "Listo",
          Served: "Servido",
          Closed: "Cerrado",
          Cancelled: "Cancelado",
        },
        customExtractor: (r) => (r.order as { status?: string } | undefined)?.status || "Closed",
      },
      {
        id: "fechaHora",
        label: "Fecha y Hora del Pedido",
        kind: "dimension",
        dataType: "date",
        hasTime: true,
        supportedGranularities: ALL_DATE_GRANULARITIES,
        prismaPath: "order.orderedAt",
        customExtractor: (r) => (r.order as { orderedAt?: Date } | undefined)?.orderedAt || null,
      },
      {
        id: "cantidad",
        label: "Cantidad Vendida",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["sum", "avg", "min", "max"],
        prismaField: "quantity",
      },
      {
        id: "importe",
        label: "Importe Subtotal (S/)",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["sum", "avg", "min", "max"],
        prismaField: "subtotal",
      },
      {
        id: "precioPromedioUnidad",
        label: "Precio promedio por unidad (S/)",
        kind: "measure",
        dataType: "number",
        isCalculated: true,
        allowedAggregations: ["avg"],
        groupDependencies: [
          { field: "importe", agg: "sum" },
          { field: "cantidad", agg: "sum" },
        ],
        calculateGroup: (m) =>
          (m.cantidad_sum || 0) > 0 ? (m.importe_sum || 0) / m.cantidad_sum : 0,
      },
      {
        id: "numPedidos",
        label: "Nº Pedidos",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["countDistinct"],
        prismaField: "orderId",
      },
    ],
  },

  // ==========================================================================
  // 7. PAGOS DE VENTA (SalesPayment)
  // ==========================================================================
  pagos_venta: {
    id: "pagos_venta",
    label: "Cobros y Métodos de Pago",
    description: "Ingresos en efectivo, tarjetas POS, Yape, Plin y pasarelas de pago.",
    prismaModel: "salesPayment",
    requiredPermission: "caja.ver",
    isTransactional: true,
    includeRelations: {
      paymentType: { select: { id: true, name: true } },
    },
    fields: [
      {
        id: "metodoPago",
        label: "Método de Pago",
        kind: "dimension",
        dataType: "string",
        prismaPath: "paymentType.name",
        customExtractor: (r) => (r.paymentType as { name?: string } | undefined)?.name || "Efectivo",
      },
      {
        id: "fecha",
        label: "Fecha y Hora de Pago",
        kind: "dimension",
        dataType: "date",
        hasTime: true,
        supportedGranularities: ALL_DATE_GRANULARITIES,
        prismaField: "paidAt",
      },
      {
        id: "montoTotal",
        label: "Monto Total Pagado (S/)",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["sum", "avg", "min", "max"],
        prismaField: "amount",
      },
      {
        id: "numPagos",
        label: "Nº Transacciones",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["count"],
        prismaField: "id",
      },
    ],
  },

  // ==========================================================================
  // 8. COMPRAS DETALLE (PurchaseOrderItem)
  // ==========================================================================
  compras_detalle: {
    id: "compras_detalle",
    label: "Detalle de Compras e Insumos",
    description: "Líneas de órdenes de compra con cantidades, insumos, proveedores y costos.",
    prismaModel: "purchaseOrderItem",
    requiredPermission: "compras.ver",
    isTransactional: true,
    includeRelations: {
      product: { select: { id: true, name: true } },
      purchaseOrder: {
        select: {
          id: true,
          status: true,
          issuedAt: true,
          supplier: { select: { id: true, businessName: true } },
        },
      },
    },
    fields: [
      {
        id: "insumo",
        label: "Insumo / Producto",
        kind: "dimension",
        dataType: "string",
        prismaPath: "product.name",
        customExtractor: (r) => (r.product as { name?: string } | undefined)?.name || "Insumo",
      },
      {
        id: "proveedor",
        label: "Proveedor",
        kind: "dimension",
        dataType: "string",
        prismaPath: "purchaseOrder.supplier.businessName",
        customExtractor: (r) =>
          ((r.purchaseOrder as { supplier?: { businessName?: string } } | undefined)?.supplier?.businessName) ||
          "Proveedor",
      },
      {
        id: "estado",
        label: "Estado Orden de Compra",
        kind: "dimension",
        dataType: "string",
        prismaPath: "purchaseOrder.status",
        valueLabels: {
          Pending: "Pendiente",
          PartiallyReceived: "Recibido Parcial",
          FullyReceived: "Recibido Total",
          Cancelled: "Cancelada",
        },
        customExtractor: (r) =>
          (r.purchaseOrder as { status?: string } | undefined)?.status || "Pending",
      },
      {
        id: "fecha",
        label: "Fecha de Orden",
        kind: "dimension",
        dataType: "date",
        hasTime: false,
        supportedGranularities: ALL_DATE_GRANULARITIES,
        prismaPath: "purchaseOrder.issuedAt",
        customExtractor: (r) =>
          (r.purchaseOrder as { issuedAt?: Date } | undefined)?.issuedAt || null,
      },
      {
        id: "cantidad",
        label: "Cantidad Comprada",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["sum", "avg", "min", "max"],
        prismaField: "quantityOrdered",
      },
      {
        id: "subtotal",
        label: "Subtotal Línea (S/)",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["sum", "avg", "min", "max"],
        prismaField: "subtotalLine",
      },
      {
        id: "igv",
        label: "IGV Línea (S/)",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["sum", "avg", "min", "max"],
        prismaField: "igvLine",
      },
      {
        id: "precioUnitarioPromedio",
        label: "Precio Unitario Promedio (S/)",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["avg", "min", "max"],
        prismaField: "unitPrice",
      },
    ],
  },

  // ==========================================================================
  // 9. MOVIMIENTOS DE INVENTARIO (InventoryMovement)
  // ==========================================================================
  movimientos_inventario: {
    id: "movimientos_inventario",
    label: "Kardex y Movimientos de Stock",
    description: "Entradas por compras/transformación, salidas por ventas, mermas y ajustes.",
    prismaModel: "inventoryMovement",
    requiredPermission: "inventario.ver",
    isTransactional: true,
    includeRelations: {
      product: { select: { id: true, name: true, type: true } },
    },
    fields: [
      {
        id: "tipoMovimiento",
        label: "Tipo de Movimiento",
        kind: "dimension",
        dataType: "string",
        prismaField: "movementType",
        valueLabels: {
          Purchase: "Compra",
          TransformationOut: "Salida por Transformación",
          TransformationIn: "Entrada por Transformación",
          Sale: "Venta / Despacho",
          Shrinkage: "Merma / Pérdida",
          Adjustment: "Ajuste de Inventario",
          InformalPurchase: "Compra Menor",
        },
      },
      {
        id: "producto",
        label: "Producto / Insumo",
        kind: "dimension",
        dataType: "string",
        prismaPath: "product.name",
        customExtractor: (r) => (r.product as { name?: string } | undefined)?.name || "Producto",
      },
      {
        id: "fecha",
        label: "Fecha y Hora del Movimiento",
        kind: "dimension",
        dataType: "date",
        hasTime: true,
        supportedGranularities: ALL_DATE_GRANULARITIES,
        prismaField: "movedAt",
      },
      {
        id: "cantidad",
        label: "Cantidad Movida",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["sum", "avg", "min", "max"],
        prismaField: "quantity",
      },
      {
        id: "numMovimientos",
        label: "Nº Movimientos",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["count"],
        prismaField: "id",
      },
    ],
  },

  // ==========================================================================
  // 10. GASTOS MENORES (InformalPurchase)
  // ==========================================================================
  gastos_menores: {
    id: "gastos_menores",
    label: "Caja Chica y Gastos Menores",
    description: "Compras y salidas menores sin comprobante formal en mercado local.",
    prismaModel: "informalPurchase",
    requiredPermission: "compras.ver",
    isTransactional: true,
    baseFilter: {
      annulled: false,
    },
    includeRelations: {
      employee: { select: { id: true, firstName: true, paternalLastName: true } },
    },
    fields: [
      {
        id: "categoria",
        label: "Categoría de Gasto",
        kind: "dimension",
        dataType: "string",
        prismaField: "expenseCategory",
      },
      {
        id: "lugar",
        label: "Lugar / Proveedor Informal",
        kind: "dimension",
        dataType: "string",
        prismaField: "informalPlaceOrVendor",
      },
      {
        id: "empleado",
        label: "Empleado Responsable",
        kind: "dimension",
        dataType: "string",
        prismaPath: "employee.firstName",
        customExtractor: (r) => {
          const emp = r.employee as { firstName?: string; paternalLastName?: string } | undefined;
          return emp ? `${emp.firstName || ""} ${emp.paternalLastName || ""}`.trim() : "Empleado";
        },
      },
      {
        id: "fecha",
        label: "Fecha del Gasto",
        kind: "dimension",
        dataType: "date",
        hasTime: false,
        supportedGranularities: ALL_DATE_GRANULARITIES,
        prismaField: "date",
      },
      {
        id: "monto",
        label: "Monto Pagado (S/)",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["sum", "avg", "min", "max"],
        prismaField: "amountPaid",
      },
      {
        id: "numGastos",
        label: "Nº Gastos Menores",
        kind: "measure",
        dataType: "number",
        allowedAggregations: ["count"],
        prismaField: "id",
      },
    ],
  },
};

/** Lista de todos los datasets disponibles */
export const AVAILABLE_DATASETS: SemanticDataset[] = Object.values(SEMANTIC_DATASETS);

/** Helper para obtener un campo por id dentro de un dataset */
export function getSemanticField(datasetId: string, fieldId: string): SemanticField | undefined {
  const dataset = SEMANTIC_DATASETS[datasetId];
  if (!dataset) return undefined;
  return dataset.fields.find((f) => f.id === fieldId);
}

/**
 * Catálogo maestro de endpoints HTTP del ERP Pollería (Segunda Evaluación: Carga, Estrés y Concurrencia).
 *
 * Agrupa las 91 rutas activas en app/api/ por Bounded Context DDD y clasifica su perfil
 * de seguridad para pruebas concurrentes:
 * - read: Lectura HTTP idempotente segura para ráfagas masivas contra Neon/Prisma.
 * - auth: Endpoints de sesión (POST /api/auth/login somete CPU por bcrypt).
 * - realtime-sse: Stream Server-Sent Events (/api/realtime) en memoria de Node.js.
 * - external-read: Lectura que invoca servicio externo (RENIEC/SUNAT json.pe o Mercado Pago).
 * - external-heavy: Invocaciones pesadas externas (SUNAT SOAP UBL 2.1, SIRE, LLM IA).
 * - write: Endpoints de mutación transaccional (evaluados en pruebas controladas o Vitest).
 */

export const API_CATALOG = [
  // --- ACCOUNTING (Contabilidad y Tributación) ---
  { route: "/api/accounting/dashboard", domain: "accounting", methods: ["GET"], safety: "read", samplePath: ({ monthStart, today }) => `/api/accounting/dashboard?desde=${monthStart}&hasta=${today}` },
  { route: "/api/accounting/interpreter", domain: "accounting", methods: ["POST"], safety: "external-heavy" },
  { route: "/api/accounting-periods", domain: "accounting", methods: ["GET", "POST", "PATCH"], safety: "read", samplePath: () => "/api/accounting-periods" },
  { route: "/api/accounts", domain: "accounting", methods: ["GET", "POST"], safety: "read", samplePath: () => "/api/accounts" },
  { route: "/api/accounts/[id]", domain: "accounting", methods: ["GET", "PATCH"], safety: "read", samplePath: ({ ids }) => `/api/accounts/${ids.account ?? 1}` },
  { route: "/api/balance-sheet", domain: "accounting", methods: ["GET"], safety: "read", samplePath: ({ today }) => `/api/balance-sheet?hasta=${today}` },
  { route: "/api/cash-flow-statement", domain: "accounting", methods: ["GET"], safety: "read", samplePath: ({ monthStart, today }) => `/api/cash-flow-statement?desde=${monthStart}&hasta=${today}` },
  { route: "/api/daily-book", domain: "accounting", methods: ["GET"], safety: "read", samplePath: ({ monthStart, today }) => `/api/daily-book?desde=${monthStart}&hasta=${today}&page=1&pageSize=20` },
  { route: "/api/executive-summary", domain: "accounting", methods: ["GET"], safety: "read", samplePath: ({ year }) => `/api/executive-summary?year=${year}` },
  { route: "/api/general-ledger", domain: "accounting", methods: ["GET"], safety: "read", samplePath: ({ monthStart, today }) => `/api/general-ledger?codigo=101&desde=${monthStart}&hasta=${today}` },
  { route: "/api/income-statement", domain: "accounting", methods: ["GET"], safety: "read", samplePath: ({ monthStart, today }) => `/api/income-statement?desde=${monthStart}&hasta=${today}` },
  { route: "/api/journal-entries", domain: "accounting", methods: ["GET", "POST"], safety: "read", samplePath: () => "/api/journal-entries" },
  { route: "/api/journal-entries/[id]", domain: "accounting", methods: ["GET"], safety: "read", samplePath: ({ ids }) => `/api/journal-entries/${ids.journalEntry ?? 1}` },
  { route: "/api/journal-entries/accounts", domain: "accounting", methods: ["GET"], safety: "read", samplePath: () => "/api/journal-entries/accounts" },
  { route: "/api/journal-entries/next-code", domain: "accounting", methods: ["GET"], safety: "read", samplePath: () => "/api/journal-entries/next-code" },
  { route: "/api/journal-entries/options", domain: "accounting", methods: ["GET"], safety: "read", samplePath: () => "/api/journal-entries/options" },
  { route: "/api/ple/[book]", domain: "accounting", methods: ["GET"], safety: "read", samplePath: ({ year, month }) => `/api/ple/sales-register?year=${year}&month=${month}&mode=preview` },
  { route: "/api/trial-balance", domain: "accounting", methods: ["GET"], safety: "read", samplePath: ({ monthStart, today }) => `/api/trial-balance?desde=${monthStart}&hasta=${today}` },

  // --- SALES (Ventas, Pedidos, Caja, Clientes, Pagos, Realtime) ---
  { route: "/api/cash-sessions", domain: "sales", methods: ["GET", "POST"], safety: "read", samplePath: () => "/api/cash-sessions" },
  { route: "/api/cash-sessions/[id]/close", domain: "sales", methods: ["POST"], safety: "write" },
  { route: "/api/cash-sessions/drawer", domain: "sales", methods: ["GET", "POST"], safety: "read", samplePath: () => "/api/cash-sessions/drawer" },
  { route: "/api/cash-sessions/movements", domain: "sales", methods: ["GET", "POST"], safety: "read", samplePath: ({ ids }) => `/api/cash-sessions/movements?sessionId=${ids.cashSession ?? 1}` },
  { route: "/api/customers", domain: "sales", methods: ["GET", "POST"], safety: "read", samplePath: () => "/api/customers" },
  { route: "/api/orders", domain: "sales", methods: ["GET", "POST"], safety: "read", samplePath: () => "/api/orders" },
  { route: "/api/orders/[id]", domain: "sales", methods: ["GET", "PUT", "DELETE"], safety: "read", samplePath: ({ ids }) => `/api/orders/${ids.order ?? 1}` },
  { route: "/api/orders/drinks", domain: "sales", methods: ["GET", "PATCH"], safety: "read", samplePath: () => "/api/orders/drinks" },
  { route: "/api/payment-methods", domain: "sales", methods: ["GET"], safety: "read", samplePath: () => "/api/payment-methods" },
  { route: "/api/payments/mercadopago/preference", domain: "sales", methods: ["POST"], safety: "external-heavy" },
  { route: "/api/payments/mercadopago/status", domain: "sales", methods: ["GET"], safety: "external-read", samplePath: () => "/api/payments/mercadopago/status?orderId=1&simulate=true" },
  { route: "/api/payments/mercadopago/yape", domain: "sales", methods: ["POST"], safety: "external-heavy" },
  { route: "/api/realtime", domain: "sales", methods: ["GET", "POST"], safety: "realtime-sse", samplePath: () => "/api/realtime" },
  { route: "/api/sales", domain: "sales", methods: ["GET", "POST"], safety: "read", samplePath: () => "/api/sales" },
  { route: "/api/sales/voucher/[id]", domain: "sales", methods: ["GET"], safety: "read", samplePath: ({ ids }) => `/api/sales/voucher/${ids.sale ?? 1}` },
  { route: "/api/tables", domain: "sales", methods: ["GET", "POST"], safety: "read", samplePath: () => "/api/tables" },
  { route: "/api/tables/[id]", domain: "sales", methods: ["PUT", "DELETE"], safety: "write" },
  { route: "/api/webhooks/mercadopago", domain: "sales", methods: ["GET", "POST"], safety: "read", samplePath: () => "/api/webhooks/mercadopago" },

  // --- INVENTORY & PURCHASES (Productos, Stock, Compras) ---
  { route: "/api/products", domain: "inventory", methods: ["GET", "POST"], safety: "read", samplePath: () => "/api/products" },
  { route: "/api/products/[id]", domain: "inventory", methods: ["GET", "PUT", "PATCH", "DELETE"], safety: "read", samplePath: ({ ids }) => `/api/products/${ids.product ?? 1}` },
  { route: "/api/purchases/without-voucher", domain: "purchases", methods: ["GET"], safety: "read", samplePath: () => "/api/purchases/without-voucher" },

  // --- HR (Recursos Humanos, Asistencia, Planilla) ---
  { route: "/api/advances", domain: "hr", methods: ["GET", "POST"], safety: "read", samplePath: () => "/api/advances" },
  { route: "/api/advances/[id]", domain: "hr", methods: ["PATCH"], safety: "write" },
  { route: "/api/attendance", domain: "hr", methods: ["GET", "POST", "PUT"], safety: "read", samplePath: ({ today }) => `/api/attendance?date=${today}` },
  { route: "/api/attendance/marks", domain: "hr", methods: ["GET"], safety: "read", samplePath: ({ today }) => `/api/attendance/marks?date=${today}` },
  { route: "/api/contracts", domain: "hr", methods: ["GET", "POST"], safety: "read", samplePath: () => "/api/contracts" },
  { route: "/api/contracts/[id]", domain: "hr", methods: ["GET", "POST", "PUT"], safety: "read", samplePath: ({ ids }) => `/api/contracts/${ids.contract ?? 1}` },
  { route: "/api/contracts/[id]/settlement", domain: "hr", methods: ["GET", "POST"], safety: "read", samplePath: ({ ids }) => `/api/contracts/${ids.contract ?? 1}/settlement` },
  { route: "/api/contracts/alerts", domain: "hr", methods: ["GET"], safety: "read", samplePath: () => "/api/contracts/alerts" },
  { route: "/api/employees", domain: "hr", methods: ["GET", "POST"], safety: "read", samplePath: () => "/api/employees" },
  { route: "/api/employees/[id]", domain: "hr", methods: ["GET", "PUT"], safety: "read", samplePath: ({ ids }) => `/api/employees/${ids.employee ?? 1}` },
  { route: "/api/employees/[id]/access", domain: "hr", methods: ["POST"], safety: "write" },
  { route: "/api/insurances", domain: "hr", methods: ["GET", "POST"], safety: "read", samplePath: () => "/api/insurances" },
  { route: "/api/insurances/[id]", domain: "hr", methods: ["PUT", "PATCH"], safety: "write" },
  { route: "/api/leaves", domain: "hr", methods: ["GET", "POST"], safety: "read", samplePath: () => "/api/leaves" },
  { route: "/api/leaves/[id]", domain: "hr", methods: ["PATCH"], safety: "write" },
  { route: "/api/me", domain: "hr", methods: ["GET"], safety: "read", samplePath: () => "/api/me" },
  { route: "/api/me/advances", domain: "hr", methods: ["POST"], safety: "write" },
  { route: "/api/me/attendance", domain: "hr", methods: ["GET", "POST"], safety: "read", samplePath: () => "/api/me/attendance" },
  { route: "/api/me/leaves", domain: "hr", methods: ["POST", "PATCH"], safety: "write" },
  { route: "/api/me/payslips", domain: "hr", methods: ["GET"], safety: "read", samplePath: () => "/api/me/payslips" },
  { route: "/api/payroll", domain: "hr", methods: ["GET", "POST"], safety: "read", samplePath: () => "/api/payroll" },
  { route: "/api/payroll/[id]", domain: "hr", methods: ["GET", "PATCH"], safety: "read", samplePath: ({ ids }) => `/api/payroll/${ids.payroll ?? 1}` },
  { route: "/api/payroll/social-benefits", domain: "hr", methods: ["GET"], safety: "read", samplePath: ({ year }) => `/api/payroll/social-benefits?type=cts&year=${year}&half=2` },
  { route: "/api/payroll/lines/[id]", domain: "hr", methods: ["PUT"], safety: "write" },
  { route: "/api/schedules", domain: "hr", methods: ["GET", "POST"], safety: "read", samplePath: () => "/api/schedules" },
  { route: "/api/schedules/[id]", domain: "hr", methods: ["GET", "PUT", "DELETE"], safety: "read", samplePath: ({ ids }) => `/api/schedules/${ids.schedule ?? 1}` },
  { route: "/api/schedules/[id]/employees", domain: "hr", methods: ["PUT"], safety: "write" },
  { route: "/api/schedules/generate", domain: "hr", methods: ["POST"], safety: "write" },
  { route: "/api/shift-templates", domain: "hr", methods: ["GET", "POST"], safety: "read", samplePath: () => "/api/shift-templates" },
  { route: "/api/shift-templates/[id]", domain: "hr", methods: ["PUT", "PATCH"], safety: "write" },

  // --- SECURITY (Autenticación, Roles, Usuarios, Auditoría) ---
  { route: "/api/audit-logs", domain: "security", methods: ["GET"], safety: "read", samplePath: () => "/api/audit-logs" },
  { route: "/api/auth/login", domain: "security", methods: ["POST"], safety: "auth" },
  { route: "/api/auth/logout", domain: "security", methods: ["POST"], safety: "auth" },
  { route: "/api/auth/me", domain: "security", methods: ["GET"], safety: "read", samplePath: () => "/api/auth/me" },
  { route: "/api/roles", domain: "security", methods: ["GET", "POST"], safety: "read", samplePath: () => "/api/roles" },
  { route: "/api/roles/[id]", domain: "security", methods: ["GET", "PUT", "DELETE"], safety: "read", samplePath: ({ ids }) => `/api/roles/${ids.role ?? 1}` },
  { route: "/api/users", domain: "security", methods: ["GET", "POST"], safety: "read", samplePath: () => "/api/users" },
  { route: "/api/users/[id]", domain: "security", methods: ["PUT", "PATCH"], safety: "write" },

  // --- SETTINGS (Configuración, Branding, Impresoras, OpenAPI, Dashboards) ---
  { route: "/api/branding/assets/[slot]", domain: "settings", methods: ["GET"], safety: "read", samplePath: () => "/api/branding/assets/logo" },
  { route: "/api/dashboards/catalog", domain: "settings", methods: ["GET"], safety: "read", samplePath: () => "/api/dashboards/catalog" },
  { route: "/api/dashboards/query", domain: "settings", methods: ["POST"], safety: "write" },
  { route: "/api/openapi", domain: "settings", methods: ["GET"], safety: "read", samplePath: () => "/api/openapi" },
  { route: "/api/settings/areas", domain: "settings", methods: ["GET", "POST", "PUT", "DELETE"], safety: "read", samplePath: () => "/api/settings/areas" },
  { route: "/api/settings/branding", domain: "settings", methods: ["GET", "PUT"], safety: "read", samplePath: () => "/api/settings/branding" },
  { route: "/api/settings/branding/assets/[slot]", domain: "settings", methods: ["POST", "DELETE"], safety: "write" },
  { route: "/api/settings/developer", domain: "settings", methods: ["GET", "PUT"], safety: "read", samplePath: () => "/api/settings/developer" },
  { route: "/api/settings/printers", domain: "settings", methods: ["GET", "PUT"], safety: "read", samplePath: () => "/api/settings/printers" },
  { route: "/api/settings/restaurant", domain: "settings", methods: ["GET", "PUT"], safety: "read", samplePath: () => "/api/settings/restaurant" },
  { route: "/api/settings/restaurant/qr", domain: "settings", methods: ["GET"], safety: "read", samplePath: () => "/api/settings/restaurant/qr" },

  // --- INTEGRATIONS (RENIEC/json.pe, SUNAT UBL 2.1, SIRE, S3) ---
  { route: "/api/document-lookup", domain: "integrations", methods: ["GET", "POST"], safety: "external-read", samplePath: () => "/api/document-lookup?tipo=dni&numero=47829103" },
  { route: "/api/sire/purchases", domain: "integrations", methods: ["POST"], safety: "external-heavy" },
  { route: "/api/sire/test/[book]", domain: "integrations", methods: ["POST"], safety: "external-heavy" },
  { route: "/api/sunat/boleta", domain: "integrations", methods: ["GET", "POST"], safety: "external-heavy", samplePath: () => "/api/sunat/boleta" },
  { route: "/api/sunat/compras/validar-xml", domain: "integrations", methods: ["POST"], safety: "external-heavy" },
  { route: "/api/sunat/liquidacion-compra", domain: "integrations", methods: ["GET", "POST"], safety: "external-heavy", samplePath: () => "/api/sunat/liquidacion-compra" },

  // --- AI ASSISTANT ---
  { route: "/api/assistant", domain: "ai", methods: ["GET", "POST"], safety: "read", samplePath: () => "/api/assistant" },
  { route: "/api/assistant/transcribe", domain: "ai", methods: ["POST"], safety: "external-heavy" },
];

export function buildCatalogUrls(context = {}) {
  const now = new Date();
  const today = context.today || now.toISOString().slice(0, 10);
  const year = context.year || Number(today.slice(0, 4));
  const month = context.month || Number(today.slice(5, 7));
  const monthStart = context.monthStart || `${today.slice(0, 7)}-01`;
  const ids = context.ids || {};

  return API_CATALOG.map((entry) => ({
    ...entry,
    url: entry.samplePath ? entry.samplePath({ today, year, month, monthStart, ids }) : entry.route,
  }));
}

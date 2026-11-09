'use client';

import React from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  FolderGit2,
  Lock,
  Layers,
  Sparkles,
  Server,
  Database,
  FileCode2,
} from 'lucide-react';

interface BoundedContextSpec {
  name: string;
  path: string;
  entities: string[];
  responsibilities: string;
  endpoints: string[];
  compliance: string;
}

const BOUNDED_CONTEXTS: BoundedContextSpec[] = [
  {
    name: '1. Ventas & Salón (Sales)',
    path: 'lib/services/sales/',
    entities: ['Order', 'OrderItem', 'Sale', 'Payment', 'CashSession', 'CashCount', 'Table', 'Customer'],
    responsibilities: 'Gestión de mesas, comandas, cuentas divididas, sesiones de caja, arqueos y cobros multicanal.',
    endpoints: ['/api/orders', '/api/sales', '/api/cash-sessions', '/api/tables', '/api/payments'],
    compliance: '✅ 0 imports de Prisma en app/ | Transacciones ACID | Pruebas de caracterización',
  },
  {
    name: '2. Inventario & Kardex',
    path: 'lib/services/inventory/',
    entities: ['Product', 'Ingredient', 'Recipe', 'RecipeItem', 'KardexMovement', 'StockAlert'],
    responsibilities: 'Descarga automática de stock por venta, transformación de materias primas y kardex valorizado.',
    endpoints: ['/api/products', '/api/inventory', '/api/recipes', '/api/transformation'],
    compliance: '✅ Kardex promedio ponderado inmutable | 100% servicios puros',
  },
  {
    name: '3. Compras & Proveedores',
    path: 'lib/services/purchases/',
    entities: ['Supplier', 'PurchaseOrder', 'PurchaseOrderItem', 'PurchaseInvoice', 'AccountsPayable'],
    responsibilities: 'Órdenes de compra a proveedores, compras menores al contado, registro de facturas y cuentas por pagar.',
    endpoints: ['/api/purchases', '/api/suppliers', '/api/purchase-orders'],
    compliance: '✅ Validación RUC obligatoria | Asiento contable de compra automático',
  },
  {
    name: '4. Contabilidad & Libros',
    path: 'lib/services/accounting/',
    entities: ['Account', 'AccountingPeriod', 'JournalEntry', 'JournalEntryLine', 'FiscalYear'],
    responsibilities: 'Partida doble PCGE, Balance de Comprobación, Mayor, Resultados, Flujo de Caja y PLE SUNAT.',
    endpoints: ['/api/accounting/entries', '/api/accounting/reports/*', '/api/ple', '/api/accounts'],
    compliance: '✅ Integridad Débito == Crédito | Cierre contable inmutable | Conciliación SIRE',
  },
  {
    name: '5. Recursos Humanos & Planilla',
    path: 'lib/services/hr/',
    entities: ['Employee', 'Contract', 'Shift', 'AttendanceMark', 'Payroll', 'SalaryAdvance', 'LeaveRequest'],
    responsibilities: 'Control de asistencia con IP, cálculo de horas extra, asignación familiar, AFP/ONP y planilla.',
    endpoints: ['/api/attendance', '/api/hr/payroll', '/api/hr/employees', '/api/hr/schedules'],
    compliance: '✅ Marcación automática al login | Deducciones conforme ley peruana',
  },
  {
    name: '6. Seguridad & Roles (RBAC)',
    path: 'lib/services/security/',
    entities: ['User', 'Role', 'Permission', 'RolePermission', 'AuditLog', 'Session'],
    responsibilities: 'Autenticación con Bcrypt/JWT, 80+ permisos granulares, registro inmutable de auditoría y bloqueo por intentos.',
    endpoints: ['/api/auth/*', '/api/users', '/api/roles', '/api/audit-logs'],
    compliance: '✅ Principio de menor privilegio | Log de auditoría append-only',
  },
  {
    name: '7. Ajustes & Personalización',
    path: 'lib/services/settings/',
    entities: ['RestaurantProfile', 'VoucherSeries', 'Area', 'Printer', 'AppConfig'],
    responsibilities: 'Configuración general de la pollería, series de comprobantes (B001, F001), salones y comanderas.',
    endpoints: ['/api/settings/business', '/api/settings/series', '/api/settings/printers', '/api/settings/areas'],
    compliance: '✅ Series configurables validadas contra formato SUNAT',
  },
  {
    name: '8. Integraciones Externas',
    path: 'lib/services/integrations/',
    entities: ['ElectronicVoucher', 'CdrResponse', 'YapeWebhookLog', 'S3PresignedFile'],
    responsibilities: 'Facturación UBL 2.1 con SUNAT (SOAP), cobros QR Yape, Mercado Pago API y subida a AWS S3.',
    endpoints: ['/api/sunat/*', '/api/webhooks/mercadopago', '/api/webhooks/yape'],
    compliance: '✅ Verificación de firma HMAC | Fallback de contingencia ante caída SUNAT',
  },
];

export function ArchitectureSpecTable() {
  return (
    <div className="flex h-full flex-col gap-6 p-4 overflow-y-auto">
      {/* Architecture Principles Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-4 shadow-xs">
          <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 font-bold text-sm mb-1">
            <Server className="h-4 w-4" />
            1. Capa de Transporte HTTP
          </div>
          <p className="text-xs text-foreground/85 leading-relaxed">
            Todos los Route Handlers en <code className="font-mono text-primary">app/api/**</code> usan exclusivamente{' '}
            <code className="font-mono text-primary">createApiHandler</code> con RBAC obligatorio. 
            <strong className="block text-red-600 dark:text-red-400 mt-1">
              🚫 PROHIBIDO importar @/lib/prisma en app/
            </strong>
          </p>
        </div>

        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-xs">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm mb-1">
            <Layers className="h-4 w-4" />
            2. Servicios de Dominio Puros
          </div>
          <p className="text-xs text-foreground/85 leading-relaxed">
            Organizados en 8 Bounded Contexts bajo <code className="font-mono text-primary">lib/services/**</code>. 
            Reciben tipos primitivos, no aceptan objetos HTTP y lanzan excepciones tipadas de{' '}
            <code className="font-mono text-primary">DomainError</code>.
          </p>
        </div>

        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 shadow-xs">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm mb-1">
            <Database className="h-4 w-4" />
            3. Persistencia Aislada
          </div>
          <p className="text-xs text-foreground/85 leading-relaxed">
            <code className="font-mono text-primary">@/lib/prisma</code> es un singleton accesible únicamente 
            desde los servicios de dominio, respaldado por PostgreSQL en Neon Tech con connection pooling PgBouncer.
          </p>
        </div>
      </div>

      {/* Bounded Contexts Table */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/20">
          <h3 className="text-sm font-bold text-foreground">
            Matriz de Bounded Contexts DDD (Domain-Driven Design)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Estructura modular de los 8 dominios de negocio del ERP Pollería y su cumplimiento normativo.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Bounded Context</th>
                <th className="py-3 px-4">Directorio</th>
                <th className="py-3 px-4">Entidades Prisma</th>
                <th className="py-3 px-4">Responsabilidad de Negocio</th>
                <th className="py-3 px-4">Gobernanza & Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {BOUNDED_CONTEXTS.map((ctx) => (
                <tr key={ctx.name} className="hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4 font-bold text-foreground whitespace-nowrap">
                    {ctx.name}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-primary whitespace-nowrap">
                    {ctx.path}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {ctx.entities.map((e) => (
                        <span
                          key={e}
                          className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
                        >
                          {e}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-foreground/85 max-w-sm">
                    {ctx.responsibilities}
                  </td>
                  <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap">
                    {ctx.compliance}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

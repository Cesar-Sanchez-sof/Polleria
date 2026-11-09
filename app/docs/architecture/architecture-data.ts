export type ArchitectureTier =
  | 'clients'
  | 'presentation'
  | 'domain'
  | 'ai'
  | 'persistence'
  | 'external';

export type FunctionalModule =
  | 'all'
  | 'sales'
  | 'purchases'
  | 'inventory'
  | 'accounting'
  | 'hr'
  | 'security'
  | 'settings'
  | 'ai'
  | 'integrations';

export interface ArchitectureNodeData {
  id: string;
  title: string;
  subtitle: string;
  tier: ArchitectureTier;
  module: FunctionalModule;
  color: string;
  path?: string;
  technologies: string[];
  responsibilities: string[];
  rules?: string[];
  protocols?: string[];
  iconName: string;
  [key: string]: unknown;
}

export interface LayerMetadata {
  id: ArchitectureTier;
  name: string;
  color: string;
  description: string;
  badge: string;
}

export interface TierContainerData {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const ARCHITECTURE_LAYERS: Record<ArchitectureTier, LayerMetadata> = {
  clients: {
    id: 'clients',
    name: '1. Presentación / Frontend Web',
    color: '#0284c7', // Sky-600
    description: 'Interfaces de usuario React 19 para Ventas, Compras, Inventario, Contabilidad, RRHH, Seguridad y KDS.',
    badge: 'Frontends Web',
  },
  presentation: {
    id: 'presentation',
    name: '2. Transporte HTTP & API Gateway',
    color: '#7c3aed', // Violet-600
    description: 'createApiHandler unificado, Guard RBAC (80+ permisos), validación Zod y 0 Prisma en app/.',
    badge: 'API Gateway & RBAC',
  },
  domain: {
    id: 'domain',
    name: '3. Servicios de Dominio DDD (8 Bounded Contexts)',
    color: '#059669', // Emerald-600
    description: 'Lógica pura de negocio del restaurante, transacciones ACID y excepciones de dominio tipadas.',
    badge: 'Bounded Contexts',
  },
  ai: {
    id: 'ai',
    name: '4. Microservicios de IA Asistente',
    color: '#d97706', // Amber-600
    description: 'Microservicios Python (FastAPI/Render) con modelos LoRA Text-to-SQL y Gemini/Groq con filtro P-4.',
    badge: 'Microservicios IA',
  },
  persistence: {
    id: 'persistence',
    name: '5. Persistencia & PostgreSQL',
    color: '#4f46e5', // Indigo-600
    description: 'Prisma ORM Singleton y PostgreSQL Neon Tech con connection pooling PgBouncer.',
    badge: 'Persistencia & DB',
  },
  external: {
    id: 'external',
    name: '6. Servicios Externos & Cloud',
    color: '#e11d48', // Rose-600
    description: 'SUNAT (UBL 2.1 / SOAP), Mercado Pago, Yape QR, AWS S3, RENIEC e impresoras ESC/POS.',
    badge: 'Servicios Externos',
  },
};

export const TIER_CONTAINERS: TierContainerData[] = [
  {
    id: 'group-frontend',
    title: '1. CAPA DE PRESENTACIÓN / FRONTEND (app/)',
    subtitle: 'Interfaces Web React 19, Tailwind CSS y componentes de sala, cocina, compras y contabilidad',
    badge: 'Presentación',
    color: '#0284c7',
    x: 0,
    y: 0,
    width: 2980,
    height: 275,
  },
  {
    id: 'group-gateway',
    title: '2. CAPA DE TRANSPORTE HTTP & SEGURIDAD (app/api/**)',
    subtitle: 'API Gateway Centralizado: createApiHandler(), Guard RBAC (80+ Permisos) y 0 Prisma en app/',
    badge: 'Transporte & RBAC',
    color: '#7c3aed',
    x: 0,
    y: 320,
    width: 2980,
    height: 275,
  },
  {
    id: 'group-domain',
    title: '3. CAPA DE SERVICIOS DE DOMINIO DDD (lib/services/** - 8 Bounded Contexts)',
    subtitle: 'Lógica pura de negocio del restaurante, transacciones ACID y persistencia autorizada',
    badge: 'Reglas de Negocio',
    color: '#059669',
    x: 0,
    y: 640,
    width: 2980,
    height: 275,
  },
  {
    id: 'group-ai',
    title: '4. MICROSERVICIOS IA ASISTENTE',
    subtitle: 'Modelos R LoRA y Gemini/Groq con validación AST sobre rol ai_readonly',
    badge: 'Inteligencia Artificial',
    color: '#d97706',
    x: 0,
    y: 960,
    width: 1100,
    height: 275,
  },
  {
    id: 'group-persistence',
    title: '5. CAPA DE PERSISTENCIA (@/lib/prisma)',
    subtitle: 'Prisma ORM Singleton y PostgreSQL en Neon Tech con connection pooling PgBouncer',
    badge: 'PostgreSQL Neon',
    color: '#4f46e5',
    x: 1140,
    y: 960,
    width: 1840,
    height: 275,
  },
  {
    id: 'group-external',
    title: '6. SERVICIOS EXTERNOS & CLOUD',
    subtitle: 'SUNAT (UBL 2.1 / SOAP), Mercado Pago, Yape QR, AWS S3, RENIEC y Hardware ESC/POS',
    badge: 'Integraciones',
    color: '#e11d48',
    x: 0,
    y: 1280,
    width: 2980,
    height: 275,
  },
];

export const MODULE_FILTERS: { id: FunctionalModule; label: string; color: string }[] = [
  { id: 'all', label: 'Todos los Módulos', color: '#6366f1' },
  { id: 'sales', label: 'Ventas & Salón', color: '#0284c7' },
  { id: 'purchases', label: 'Compras & Proveedores', color: '#f59e0b' },
  { id: 'inventory', label: 'Inventario & Kardex', color: '#10b981' },
  { id: 'accounting', label: 'Contabilidad & PLE', color: '#8b5cf6' },
  { id: 'hr', label: 'Recursos Humanos', color: '#ec4899' },
  { id: 'security', label: 'Seguridad & RBAC', color: '#ef4444' },
  { id: 'settings', label: 'Ajustes & Sistema', color: '#64748b' },
  { id: 'ai', label: 'Asistente IA', color: '#d97706' },
  { id: 'integrations', label: 'SUNAT & Externos', color: '#e11d48' },
];

export const ARCHITECTURE_NODES: ArchitectureNodeData[] = [
  // ==========================================
  // CAPA 1: PRESENTACIÓN / FRONTEND (app/)
  // ==========================================
  {
    id: 'front-sales',
    title: 'POS Salón & Mesas',
    subtitle: 'app/sales/page.tsx',
    tier: 'clients',
    module: 'sales',
    color: '#0284c7',
    iconName: 'Monitor',
    path: 'app/sales',
    technologies: ['React 19', 'Tailwind CSS v4', 'Lucide Icons'],
    responsibilities: [
      'Plano visual de salones y mesas interactivas',
      'Toma de pedidos en mesa y comandas para llevar',
      'División de cuentas y cálculo dinámico de subtotales',
      'Control de estados: Disponible, Ocupada, Atendiendo, Limpieza',
    ],
    rules: ['Solo llamadas a endpoints API; 0 acceso a base de datos'],
    protocols: ['HTTPS / JSON', 'WebSockets / Polling'],
  },
  {
    id: 'front-mozo',
    title: 'Mozo Móvil (Comandera PWA)',
    subtitle: 'app/sales (Responsive PWA)',
    tier: 'clients',
    module: 'sales',
    color: '#0284c7',
    iconName: 'Smartphone',
    path: 'app/sales',
    technologies: ['PWA Móvil', 'Voice Dictation API', 'Tailwind'],
    responsibilities: [
      'Toma de pedidos en mesa desde teléfono o tablet',
      'Dictado por voz para instrucciones especiales al chef',
      'Notificaciones sonoras cuando el plato está listo en cocina',
    ],
    rules: ['Requiere sesión autenticada con rol Mozo o superior'],
    protocols: ['HTTPS', 'Voice Web API'],
  },
  {
    id: 'front-kitchen',
    title: 'KDS Pantalla Cocina / Bar',
    subtitle: 'app/sales/kitchen/kds/page.tsx',
    tier: 'clients',
    module: 'sales',
    color: '#0284c7',
    iconName: 'ChefHat',
    path: 'app/sales/kitchen/kds',
    technologies: ['React 19 Realtime', 'SSE / Polling', 'Tailwind'],
    responsibilities: [
      'Cola de comandas en tiempo real con semáforo de espera',
      'Enrutamiento automático: Platos a Cocina vs Bebidas a Barra',
      'Marcación táctil de plato en preparación y servido',
    ],
    rules: ['Actualización automática sin recarga de página'],
    protocols: ['Realtime SSE', 'HTTPS'],
  },
  {
    id: 'front-purchases',
    title: 'Compras & Proveedores',
    subtitle: 'app/purchases/**',
    tier: 'clients',
    module: 'purchases',
    color: '#f59e0b',
    iconName: 'Truck',
    path: 'app/purchases',
    technologies: ['Next.js App Router', 'React Hook Form', 'Zod'],
    responsibilities: [
      'Dashboard analítico de compras y gastos operativos',
      'Emisión y aprobación de órdenes de compra',
      'Registro de facturas con RUC y compras menores sin comprobante',
      'Catálogo de proveedores y cuentas por pagar',
    ],
    rules: ['Validación automática de RUC con SUNAT antes de guardar'],
    protocols: ['HTTPS / REST'],
  },
  {
    id: 'front-inventory',
    title: 'Inventario & Transformación',
    subtitle: 'app/purchases/inventory & transformation',
    tier: 'clients',
    module: 'inventory',
    color: '#10b981',
    iconName: 'Boxes',
    path: 'app/purchases/inventory',
    technologies: ['Recharts', 'Data Tables', 'Shadcn UI'],
    responsibilities: [
      'Kardex valorizado por método promedio ponderado',
      'Escandallos y recetas de platos (insumos por ración)',
      'Transformación de materia prima (pollo crudo ➔ marinado)',
      'Semáforo de stock mínimo y alertas de reposición',
    ],
    rules: ['Movimientos de inventario inmutables'],
    protocols: ['HTTPS / REST'],
  },
  {
    id: 'front-accounting',
    title: 'Contabilidad, Libros & PLE',
    subtitle: 'app/accounting/**',
    tier: 'clients',
    module: 'accounting',
    color: '#8b5cf6',
    iconName: 'BookOpen',
    path: 'app/accounting',
    technologies: ['Recharts Financiero', 'Excel XLSX Export', 'Base UI'],
    responsibilities: [
      'Libro Diario, Libro Mayor y Asientos automáticos',
      'Balance de Comprobación y Estado de Situación Financiera',
      'Estado de Resultados y Estado de Flujo de Efectivo',
      'Generador oficial de archivos PLE SUNAT (5.1, 5.2, 8.1, 14.1) y SIRE',
    ],
    rules: ['Principio de partida doble estricta (Debe == Haber)'],
    protocols: ['HTTPS / REST'],
  },
  {
    id: 'front-hr',
    title: 'Recursos Humanos & Planilla',
    subtitle: 'app/hr/**',
    tier: 'clients',
    module: 'hr',
    color: '#ec4899',
    iconName: 'Users',
    path: 'app/hr',
    technologies: ['Geolocalización Web', 'Calendario de Turnos', 'Shadcn'],
    responsibilities: [
      'Marcación de asistencia biométrica/web con IP de red local',
      'Programación de turnos semanales y contratos de trabajo',
      'Gestión de vacaciones, descansos médicos y adelantos de sueldo',
      'Cálculo mensual de planilla con aportes AFP/ONP y Essalud',
    ],
    rules: ['Marcación automática al iniciar sesión para el personal de turno'],
    protocols: ['HTTPS / REST'],
  },
  {
    id: 'front-security',
    title: 'Seguridad, Roles & Auditoría',
    subtitle: 'app/security/**',
    tier: 'clients',
    module: 'security',
    color: '#ef4444',
    iconName: 'ShieldCheck',
    path: 'app/security',
    technologies: ['RBAC Manager', 'Timeline Audit', 'Bcrypt UI'],
    responsibilities: [
      'Visor inmutable del historial de auditoría (AuditLog)',
      'Asignación dinámica de permisos granulares a roles de trabajo',
      'Administración de usuarios y bloqueo por intentos fallidos',
    ],
    rules: ['Solo usuarios con rol Superadministrador pueden editar roles'],
    protocols: ['HTTPS / REST'],
  },

  // ==========================================
  // CAPA 2: TRANSPORTE HTTP & SEGURIDAD (app/api/**)
  // ==========================================
  {
    id: 'api-gateway',
    title: 'API Gateway Centralizado',
    subtitle: 'createApiHandler() en lib/http/route-handler.ts',
    tier: 'presentation',
    module: 'settings',
    color: '#7c3aed',
    iconName: 'Server',
    path: 'lib/http/route-handler.ts',
    technologies: ['createApiHandler', 'Zod Schemas', 'DomainError'],
    responsibilities: [
      'Punto de entrada único para todos los Route Handlers de la aplicación',
      'Autenticación obligatoria y control granular RBAC',
      'Aislamiento de parámetros HTTP transformados a tipos primitivos',
    ],
    rules: ['Invocación obligatoria mediante createApiHandler'],
    protocols: ['JSON / REST'],
  },
  {
    id: 'auth-security',
    title: 'Guardián RBAC & Sesión JWT',
    subtitle: 'authorize("modulo.accion") + Cookies HttpOnly',
    tier: 'presentation',
    module: 'security',
    color: '#7c3aed',
    iconName: 'KeyRound',
    path: 'lib/auth/permissions.ts',
    technologies: ['Jose JWT', 'Cookies HttpOnly', '80+ Permisos Granulares'],
    responsibilities: [
      'Verificación criptográfica de token de sesión en cada request',
      'Validación de permisos granulares por módulo y acción',
      'Protección contra suplantación y timeout de inactividad',
    ],
    rules: ['Cero credenciales en texto plano; expiración automática'],
    protocols: ['SameSite=Strict Cookies', 'JWT'],
  },
  {
    id: 'zod-error-handler',
    title: 'Validación Zod & DomainError',
    subtitle: 'Mapeo Automático de Excepciones HTTP',
    tier: 'presentation',
    module: 'settings',
    color: '#7c3aed',
    iconName: 'FileText',
    path: 'lib/http/errors.ts',
    technologies: ['Zod Parse', 'DomainError Hierarchy'],
    responsibilities: [
      'Validación estricta de esquemas POST, PUT y PATCH',
      'Traducción de ValidationError a HTTP 400 y NotFoundError a HTTP 404',
      'Traducción de ConflictError y P2002 a HTTP 409',
    ],
    rules: ['Sanitización de errores 500 para no filtrar datos sensibles'],
    protocols: ['JSON Errors'],
  },
  {
    id: 'eslint-enforcement',
    title: 'Regla ESLint: 0 Prisma en app/',
    subtitle: 'eslint.config.mjs (no-restricted-imports)',
    tier: 'presentation',
    module: 'security',
    color: '#7c3aed',
    iconName: 'ShieldAlert',
    path: 'eslint.config.mjs',
    technologies: ['ESLint v9', 'AST Rule Enforcement (Error Level)'],
    responsibilities: [
      'Garantía en tiempo de compilación y CI de cero imports de Prisma en app/',
      'Forzado estricto de invocación exclusiva a la capa de servicios de dominio',
    ],
    rules: ['Rompe el build si algún archivo dentro de app/ importa @/lib/prisma'],
    protocols: ['CI / Build Linter'],
  },

  // ==========================================
  // CAPA 3: SERVICIOS DE DOMINIO DDD (lib/services/**)
  // ==========================================
  {
    id: 'domain-sales',
    title: 'sales/: Ventas & Caja',
    subtitle: 'lib/services/sales/*',
    tier: 'domain',
    module: 'sales',
    color: '#059669',
    iconName: 'ShoppingBag',
    path: 'lib/services/sales',
    technologies: ['Domain Service Puro', 'Transacciones ACID'],
    responsibilities: [
      'Lógica de comandas, mesas, cambio de mozo y división de cuenta',
      'Apertura, cierre y arqueo de sesiones de caja física',
      'Cobros multicanal (Efectivo, Tarjeta, Yape QR)',
    ],
    rules: ['Sin dependencias de NextRequest ni cabeceras HTTP'],
    protocols: ['TypeScript In-Process Call'],
  },
  {
    id: 'domain-purchases',
    title: 'purchases/: Compras & Proveedores',
    subtitle: 'lib/services/purchases/*',
    tier: 'domain',
    module: 'purchases',
    color: '#059669',
    iconName: 'Truck',
    path: 'lib/services/purchases',
    technologies: ['Validación SUNAT RUC', 'Gestión de Pasivos'],
    responsibilities: [
      'Ciclo de vida de órdenes de compra (Borrador ➔ Aprobada ➔ Recibida)',
      'Registro de facturas comerciales y compras menores al contado',
      'Control de cuentas por pagar y cronograma de vencimientos',
    ],
    rules: ['RUC de proveedor validado con dígito verificador'],
    protocols: ['TypeScript In-Process Call'],
  },
  {
    id: 'domain-inventory',
    title: 'inventory/: Inventario & Kardex',
    subtitle: 'lib/services/inventory/*',
    tier: 'domain',
    module: 'inventory',
    color: '#059669',
    iconName: 'Boxes',
    path: 'lib/services/inventory',
    technologies: ['Kardex Promedio Ponderado', 'Transformación Recetas'],
    responsibilities: [
      'Descuento automático de insumos al confirmar pedido en cocina',
      'Transformación de insumos (ej. pollo entero a cuartos aderezados)',
      'Kardex valorizado en tiempo real con costo promedio ponderado',
    ],
    rules: ['Movimientos de kardex no pueden modificarse hacia atrás'],
    protocols: ['TypeScript In-Process Call'],
  },
  {
    id: 'domain-accounting',
    title: 'accounting/: Contabilidad & PLE',
    subtitle: 'lib/services/accounting/*',
    tier: 'domain',
    module: 'accounting',
    color: '#059669',
    iconName: 'BookOpen',
    path: 'lib/services/accounting',
    technologies: ['PCGE Peruano', 'PLE 5.1/14.1', 'SIRE SUNAT'],
    responsibilities: [
      'Generación automática de asientos contables por ventas y compras',
      'Generación de Balance de Comprobación, Mayor y Situación',
      'Exportación oficial de Libros Electrónicos PLE SUNAT y SIRE',
    ],
    rules: ['Todo asiento contable debe cuadrar al centavo: Debe == Haber'],
    protocols: ['TypeScript In-Process Call'],
  },
  {
    id: 'domain-hr',
    title: 'hr/: Recursos Humanos & Nómina',
    subtitle: 'lib/services/hr/*',
    tier: 'domain',
    module: 'hr',
    color: '#059669',
    iconName: 'Users',
    path: 'lib/services/hr',
    technologies: ['Planilla Peruana', 'Cálculo de Gratificación/CTS'],
    responsibilities: [
      'Registro de marcaciones de asistencia con IP de red',
      'Gestión de turnos de mozos y cocineros',
      'Liquidación de planilla mensual con aportes de ley y adelantos',
    ],
    rules: ['Generación automática del asiento contable de planilla'],
    protocols: ['TypeScript In-Process Call'],
  },
  {
    id: 'domain-security',
    title: 'security/: Seguridad & Auditoría',
    subtitle: 'lib/services/security/*',
    tier: 'domain',
    module: 'security',
    color: '#059669',
    iconName: 'ShieldCheck',
    path: 'lib/services/security',
    technologies: ['Bcrypt Hashing', 'Audit Engine Inmutable'],
    responsibilities: [
      'Inserción obligatoria en AuditLog para eventos críticos',
      'Gestión de usuarios, contraseñas y asignación de permisos',
      'Bloqueo preventivo de cuentas ante ataques de fuerza bruta',
    ],
    rules: ['AuditLog es de solo inserción (Append-Only)'],
    protocols: ['TypeScript In-Process Call'],
  },
  {
    id: 'domain-settings',
    title: 'settings/: Series & Restaurante',
    subtitle: 'lib/services/settings/*',
    tier: 'domain',
    module: 'settings',
    color: '#059669',
    iconName: 'Settings',
    path: 'lib/services/settings',
    technologies: ['Configurador de Negocio', 'Mapeo de Hardware'],
    responsibilities: [
      'Perfil comercial, series de facturación y certificados',
      'Configuración de impresoras térmicas de comanda y caja',
      'Diseño y capacidad de salones y mesas',
    ],
    rules: ['Las series activas no pueden eliminarse si tienen comprobantes'],
    protocols: ['TypeScript In-Process Call'],
  },
  {
    id: 'domain-integrations',
    title: 'integrations/: Adaptadores Externos',
    subtitle: 'lib/services/integrations/*',
    tier: 'domain',
    module: 'integrations',
    color: '#059669',
    iconName: 'PlugZap',
    path: 'lib/services/integrations',
    technologies: ['UBL 2.1 Signer', 'Mercado Pago SDK', 'AWS S3 SDK'],
    responsibilities: [
      'Construcción y firma de comprobantes XML para SUNAT',
      'Procesamiento de Webhooks de Yape con firma criptográfica HMAC',
      'Subida de XMLs y CDRs a AWS S3 con URLs temporales seguras',
    ],
    rules: ['Aislar las librerías externas de la lógica del núcleo'],
    protocols: ['SOAP', 'REST', 'AWS S3 API'],
  },

  // ==========================================
  // CAPA 4: MICROSERVICIOS IA ASISTENTE
  // ==========================================
  {
    id: 'ai-service',
    title: 'ai-service (Python / FastAPI)',
    subtitle: 'Modelo R (XiYanSQL + LoRA)',
    tier: 'ai',
    module: 'ai',
    color: '#d97706',
    iconName: 'Brain',
    path: 'ai-service',
    technologies: ['Python 3.11', 'FastAPI', 'XiYanSQL', 'LoRA Fine-Tuning'],
    responsibilities: [
      'Inferencia Text-to-SQL adaptada al esquema contable del restaurante',
      'Conversión de preguntas gerenciales a consultas PostgreSQL seguras',
    ],
    rules: ['Solo ejecuta consultas SELECT mediante el rol ai_readonly'],
    protocols: ['HTTP REST Interno', 'Token de Servicio'],
  },
  {
    id: 'agents-service',
    title: 'agents-service (Python / Render)',
    subtitle: 'Gemini 2.5 + Groq (P-4 Filter)',
    tier: 'ai',
    module: 'ai',
    color: '#d97706',
    iconName: 'Bot',
    path: 'agents-service',
    technologies: ['Gemini 2.5', 'Groq GPT OSS 120B', 'SQL Allowlist Validator'],
    responsibilities: [
      'Agente de análisis financiero y dictado por voz',
      'Filtro P-4 contra inyección de SQL y validación de tablas permitidas',
      'Ejecución en transacción de solo lectura aislada',
    ],
    rules: ['Los datos de la base de datos nunca se reenvían al modelo externo'],
    protocols: ['HTTPS REST', 'X-ERP-Identity Token'],
  },
  {
    id: 'ai-readonly-db',
    title: 'Rol DB ai_readonly',
    subtitle: 'PostgreSQL Read-Only Role',
    tier: 'persistence',
    module: 'ai',
    color: '#4f46e5',
    iconName: 'Lock',
    path: 'ai-service/ai_readonly_pgadmin.sql',
    technologies: ['PostgreSQL Role', 'Read-Only Trans', 'Table Allowlist'],
    responsibilities: [
      'Conexión exclusiva para los microservicios de IA',
      'Bloqueo a nivel de motor de INSERT, UPDATE, DELETE o DDL',
      'Permiso exclusivo de lectura sobre tablas analíticas autorizadas',
    ],
    rules: ['Ningún servicio IA puede usar credenciales de escritura'],
    protocols: ['PostgreSQL Read-Only Session'],
  },

  // ==========================================
  // CAPA 5: PERSISTENCIA (@/lib/prisma)
  // ==========================================
  {
    id: 'prisma-orm',
    title: 'Prisma ORM Singleton',
    subtitle: 'lib/prisma/index.ts (Único con acceso a BD)',
    tier: 'persistence',
    module: 'settings',
    color: '#4f46e5',
    iconName: 'Database',
    path: 'lib/prisma',
    technologies: ['Prisma Client v6.19', 'PostgreSQL Adapter', 'ACID Engine'],
    responsibilities: [
      'Mapeo objeto-relacional tipado de las más de 55 entidades',
      'Ejecución de transacciones atómicas seguras con prisma.$transaction',
      'Garantía de integridad referencial y llaves foráneas',
    ],
    rules: [
      '🛡️ ÚNICO LUGAR AUTORIZADO para ser importado es lib/services/**',
      'Prohibida su importación en cualquier archivo dentro de app/**',
    ],
    protocols: ['Prisma Native Engine', 'TCP PostgreSQL Protocol'],
  },
  {
    id: 'neon-postgres',
    title: 'PostgreSQL 16 en Neon Tech',
    subtitle: 'Cloud Serverless + PgBouncer Pooling',
    tier: 'persistence',
    module: 'settings',
    color: '#4f46e5',
    iconName: 'Server',
    path: 'prisma/schema.prisma',
    technologies: ['PostgreSQL 16', 'PgBouncer Pool', 'Neon Storage'],
    responsibilities: [
      'Almacenamiento ACID de todas las tablas de Compras, Ventas, Kardex, RRHH y PLE',
      'Pool transaccional de conexiones PgBouncer para alto tráfico en salón',
      'Backups automáticos continuos y recuperación en punto del tiempo',
    ],
    rules: ['Esquema unificado bajo migraciones oficiales en prisma/migrations'],
    protocols: ['PostgreSQL Wire Protocol', 'SSL Encriptado'],
  },

  // ==========================================
  // CAPA 6: SERVICIOS EXTERNOS & CLOUD
  // ==========================================
  {
    id: 'hardware-escpos',
    title: 'Hardware ESC/POS',
    subtitle: 'Impresoras de red TCP 9100',
    tier: 'external',
    module: 'sales',
    color: '#e11d48',
    iconName: 'Printer',
    path: 'lib/services/settings/printer.service.ts',
    technologies: ['Protocolo ESC/POS', 'TCP RAW 9100', 'Red Ethernet'],
    responsibilities: [
      'Impresión física de comandas en cocina y barra al enviar orden',
      'Impresión de ticket de precuenta para el cliente',
      'Emisión de boletas y facturas térmicas de 80mm en caja',
    ],
    rules: ['Enrutamiento por área configurado en ajustes'],
    protocols: ['TCP RAW 9100', 'USB POS'],
  },
  {
    id: 'ext-payments',
    title: 'Mercado Pago & Yape QR Dinámico',
    subtitle: 'Pasarelas de Pago Digital (Webhooks HMAC)',
    tier: 'external',
    module: 'sales',
    color: '#e11d48',
    iconName: 'CreditCard',
    path: 'lib/services/integrations/mercadopago',
    technologies: ['Mercado Pago API', 'Yape QR Dinámico', 'Webhooks HMAC'],
    responsibilities: [
      'Generación de QR dinámico Yape con monto exacto en mesa',
      'Cobros con tarjeta de crédito/débito y Tap to Pay',
      'Notificaciones push asíncronas vía webhooks idempotentes',
    ],
    rules: ['Verificación estricta de firma HMAC-SHA256 en webhooks'],
    protocols: ['HTTPS REST', 'HMAC Webhooks'],
  },
  {
    id: 'ext-sunat',
    title: 'SUNAT (UBL 2.1 / SIRE / PLE)',
    subtitle: 'Facturación Electrónica SOAP + CDR',
    tier: 'external',
    module: 'integrations',
    color: '#e11d48',
    iconName: 'FileText',
    path: 'lib/services/integrations/sunat',
    technologies: ['SOAP XML', 'UBL 2.1', 'WS-Security SHA-256'],
    responsibilities: [
      'Emisión de Boletas Electrónicas (B001) y Facturas (F001)',
      'Notas de Crédito y Débito con afectación tributaria oficial',
      'Recepción de CDRs (Constancia de Recepción aceptada o rechazada)',
      'Validación de propuestas SIRE Compras y SIRE Ventas',
    ],
    rules: ['Modo de contingencia temporal con reintentos controlados'],
    protocols: ['SOAP 1.1 / WS-Security', 'HTTPS Mutual TLS'],
  },
  {
    id: 'ext-s3',
    title: 'AWS S3 / Neon Object Store',
    subtitle: 'Almacenamiento Cloud de XMLs, CDRs y PDFs',
    tier: 'external',
    module: 'integrations',
    color: '#e11d48',
    iconName: 'Cloud',
    path: 'lib/services/integrations/s3.service.ts',
    technologies: ['AWS S3 SDK v3', 'Presigned URLs'],
    responsibilities: [
      'Almacenamiento inmutable de XMLs firmados de facturación',
      'Guardado de constancias oficiales CDR ZIP de SUNAT',
      'Almacenamiento de representaciones impresas en PDF',
    ],
    rules: ['Conservación legal tributaria por al menos 5 años'],
    protocols: ['AWS SDK S3 REST', 'Presigned HTTPS URLs'],
  },
  {
    id: 'ext-reniec',
    title: 'RENIEC / SUNAT Lookup',
    subtitle: 'Consulta de DNI y RUC en Línea',
    tier: 'external',
    module: 'purchases',
    color: '#e11d48',
    iconName: 'Search',
    path: 'lib/services/integrations/document-lookup',
    technologies: ['API REST Document Lookup'],
    responsibilities: [
      'Consulta instantánea de DNI de clientes para boletas electrónicas',
      'Validación de RUC y estado tributario (Activo/Habido) para proveedores',
    ],
    rules: ['Caché de consultas para minimizar llamadas recurrentes'],
    protocols: ['HTTPS REST'],
  },
];

export interface ArchitectureEdgeData {
  id: string;
  source: string;
  target: string;
  label?: string;
  protocol?: string;
  animated?: boolean;
  style?: { stroke?: string; strokeWidth?: number; strokeDasharray?: string };
}

export const ARCHITECTURE_EDGES: ArchitectureEdgeData[] = [
  // Frontends -> API Gateway
  { id: 'e-fsales-gw', source: 'front-sales', target: 'api-gateway', label: 'HTTP / POS', animated: true },
  { id: 'e-fmozo-gw', source: 'front-mozo', target: 'api-gateway', label: 'Comanda Móvil', animated: true },
  { id: 'e-fkit-gw', source: 'front-kitchen', target: 'api-gateway', label: 'Realtime SSE', animated: true },
  { id: 'e-fpurch-gw', source: 'front-purchases', target: 'api-gateway', label: 'Compras / RUC', animated: false },
  { id: 'e-finv-gw', source: 'front-inventory', target: 'api-gateway', label: 'Kardex / Recetas', animated: false },
  { id: 'e-facc-gw', source: 'front-accounting', target: 'api-gateway', label: 'Asientos / PLE', animated: false },
  { id: 'e-fhr-gw', source: 'front-hr', target: 'api-gateway', label: 'Asistencia / Planilla', animated: false },
  { id: 'e-fsec-gw', source: 'front-security', target: 'api-gateway', label: 'Roles / AuditLog', animated: false },

  // API Gateway -> Seguridad / RBAC & Validación
  { id: 'e-gw-auth', source: 'api-gateway', target: 'auth-security', label: 'RBAC Check', animated: false },
  { id: 'e-gw-zod', source: 'api-gateway', target: 'zod-error-handler', label: 'Zod Parse', animated: false },
  { id: 'e-gw-eslint', source: 'api-gateway', target: 'eslint-enforcement', label: '0 Prisma Rule', animated: false },

  // API Gateway -> 8 Servicios de Dominio DDD
  { id: 'e-gw-sales', source: 'api-gateway', target: 'domain-sales', label: '/api/orders, /api/sales', animated: true },
  { id: 'e-gw-purch', source: 'api-gateway', target: 'domain-purchases', label: '/api/purchases, /api/suppliers', animated: false },
  { id: 'e-gw-inv', source: 'api-gateway', target: 'domain-inventory', label: '/api/inventory, /api/recipes', animated: false },
  { id: 'e-gw-acc', source: 'api-gateway', target: 'domain-accounting', label: '/api/accounting/*, /api/ple', animated: false },
  { id: 'e-gw-hr', source: 'api-gateway', target: 'domain-hr', label: '/api/attendance, /api/hr/*', animated: false },
  { id: 'e-gw-sec', source: 'api-gateway', target: 'domain-security', label: '/api/auth, /api/users, /api/roles', animated: false },
  { id: 'e-gw-set', source: 'api-gateway', target: 'domain-settings', label: '/api/settings/*', animated: false },
  { id: 'e-gw-agents', source: 'api-gateway', target: 'agents-service', label: 'X-ERP-Identity / POST', animated: true },
  { id: 'e-gw-ai', source: 'api-gateway', target: 'ai-service', label: 'Internal Token / POST', animated: true },

  // Servicios de Dominio -> Persistencia Prisma ORM (ACID)
  { id: 'e-sales-prisma', source: 'domain-sales', target: 'prisma-orm', label: 'prisma.$transaction', animated: true },
  { id: 'e-purch-prisma', source: 'domain-purchases', target: 'prisma-orm', label: 'prisma.$transaction', animated: false },
  { id: 'e-inv-prisma', source: 'domain-inventory', target: 'prisma-orm', label: 'Kardex Update', animated: false },
  { id: 'e-acc-prisma', source: 'domain-accounting', target: 'prisma-orm', label: 'Journal Posting', animated: false },
  { id: 'e-hr-prisma', source: 'domain-hr', target: 'prisma-orm', label: 'Attendance / Payroll', animated: false },
  { id: 'e-sec-prisma', source: 'domain-security', target: 'prisma-orm', label: 'Audit Insertion', animated: false },
  { id: 'e-set-prisma', source: 'domain-settings', target: 'prisma-orm', label: 'Settings Query', animated: false },

  // Interacción entre dominios
  { id: 'e-sales-inv', source: 'domain-sales', target: 'domain-inventory', label: 'Descarga de Insumos', animated: true },
  { id: 'e-sales-acc', source: 'domain-sales', target: 'domain-accounting', label: 'Asiento de Venta', animated: true },
  { id: 'e-purch-acc', source: 'domain-purchases', target: 'domain-accounting', label: 'Asiento de Compra', animated: false },
  { id: 'e-purch-inv', source: 'domain-purchases', target: 'domain-inventory', label: 'Ingreso a Kardex', animated: false },
  { id: 'e-hr-acc', source: 'domain-hr', target: 'domain-accounting', label: 'Asiento de Planilla', animated: false },
  { id: 'e-sales-integ', source: 'domain-sales', target: 'domain-integrations', label: 'Emitir Comprobante / Cobro', animated: true },
  { id: 'e-purch-integ', source: 'domain-purchases', target: 'domain-integrations', label: 'Validar RUC / Compras', animated: false },

  // Prisma -> Neon PostgreSQL
  { id: 'e-prisma-neon', source: 'prisma-orm', target: 'neon-postgres', label: 'Connection Pool PgBouncer', animated: true },

  // Microservicios IA -> Base de Datos Solo Lectura
  { id: 'e-agents-db', source: 'agents-service', target: 'ai-readonly-db', label: 'SELECT Validado P-4', animated: true },
  { id: 'e-ai-db', source: 'ai-service', target: 'ai-readonly-db', label: 'LoRA SELECT Query', animated: true },
  { id: 'e-readonly-pg', source: 'ai-readonly-db', target: 'neon-postgres', label: 'Transacción READ ONLY', animated: false },

  // Dominio Integraciones -> Servicios Externos
  { id: 'e-integ-sunat', source: 'domain-integrations', target: 'ext-sunat', label: 'SOAP UBL 2.1 / CDR', animated: true },
  { id: 'e-integ-pay', source: 'domain-integrations', target: 'ext-payments', label: 'Yape QR / Webhooks HMAC', animated: true },
  { id: 'e-integ-s3', source: 'domain-integrations', target: 'ext-s3', label: 'Subida XML, CDR y PDF', animated: false },
  { id: 'e-integ-reniec', source: 'domain-integrations', target: 'ext-reniec', label: 'Consulta DNI/RUC', animated: false },
  { id: 'e-sales-escpos', source: 'domain-sales', target: 'hardware-escpos', label: 'Impresión RAW 9100', animated: false },
];

export interface FlowLifecycle {
  id: string;
  title: string;
  description: string;
  badge: string;
  color: string;
  steps: {
    step: number;
    actor: string;
    action: string;
    target: string;
    protocol: string;
    description: string;
  }[];
}

export const LIFECYCLE_FLOWS: FlowLifecycle[] = [
  {
    id: 'sales-lifecycle',
    title: '1. Ciclo de Ventas, Salón & Cobro Digital',
    badge: 'Ventas & Salón',
    color: '#0284c7',
    description: 'Flujo completo desde la toma de comanda del mozo en mesa hasta la confirmación de pago Yape/Tarjeta y emisión de boleta.',
    steps: [
      {
        step: 1,
        actor: 'Mozo en Mesa',
        action: 'Toma pedido desde Comandera Móvil',
        target: 'app/sales/page.tsx',
        protocol: 'HTTPS / Mobile PWA',
        description: 'El mozo selecciona 1 Pollo a la Brasa + Papas + Ensalada y 1 Jarra de Chicha para la Mesa 4.',
      },
      {
        step: 2,
        actor: 'API Gateway',
        action: 'Valida permisos RBAC ("pedidos.crear")',
        target: 'lib/http/route-handler.ts',
        protocol: 'createApiHandler',
        description: 'Se valida la sesión JWT del mozo y se parsea el esquema Zod del pedido.',
      },
      {
        step: 3,
        actor: 'Servicio de Ventas',
        action: 'Registra comanda en transacción ACID',
        target: 'lib/services/sales/orders.service.ts',
        protocol: 'prisma.$transaction',
        description: 'Se crea la orden con estado "Atendiendo", se bloquea la mesa y se genera la comanda.',
      },
      {
        step: 4,
        actor: 'KDS Cocina / Bar',
        action: 'Notificación en tiempo real y preparación',
        target: 'app/sales/kitchen/kds',
        protocol: 'Realtime SSE & RAW TCP 9100',
        description: 'La orden aparece en pantalla de cocina y la comandera de bar imprime el ticket de bebidas.',
      },
      {
        step: 5,
        actor: 'Cajero / Cliente',
        action: 'Cobro con QR Dinámico de Yape',
        target: 'lib/services/integrations/mercadopago',
        protocol: 'QR Dinámico & Webhook HMAC',
        description: 'El cliente escanea el QR en mesa con el monto exacto. El webhook confirma la transacción con firma HMAC.',
      },
      {
        step: 6,
        actor: 'SUNAT & S3',
        action: 'Emisión de Boleta B001 y guardado de CDR',
        target: 'lib/services/integrations/sunat',
        protocol: 'XML UBL 2.1 Firmado + AWS S3',
        description: 'Se envía a SUNAT por SOAP, se recibe el CDR de aceptación y se almacena el XML/PDF en AWS S3.',
      },
    ],
  },
  {
    id: 'purchases-lifecycle',
    title: '2. Ciclo de Compras & Proveedores',
    badge: 'Compras',
    color: '#f59e0b',
    description: 'Flujo desde la generación de la orden de compra, validación de RUC, recepción de mercadería y pasivo contable.',
    steps: [
      {
        step: 1,
        actor: 'Jefe de Compras',
        action: 'Crea Orden de Compra para Avícola',
        target: 'app/purchases/add',
        protocol: 'HTTPS / REST',
        description: 'Solicitud de 50 pollos enteros beneficiados y 20 sacos de papa amarilla.',
      },
      {
        step: 2,
        actor: 'Servicio de Integraciones',
        action: 'Valida RUC del proveedor con SUNAT',
        target: 'lib/services/integrations/document-lookup',
        protocol: 'HTTPS REST Lookup',
        description: 'Se comprueba que el proveedor esté "Activo y Habido" en el padrón de contribuyentes SUNAT.',
      },
      {
        step: 3,
        actor: 'Servicio de Compras',
        action: 'Registra Orden de Compra en estado Pending',
        target: 'lib/services/purchases/purchase-order.ts',
        protocol: 'prisma.purchaseOrder.create',
        description: 'Se genera la orden con subtotal, IGV y total acordado con el proveedor.',
      },
      {
        step: 4,
        actor: 'Almacén / Recepción',
        action: 'Recepción de mercadería y Factura F001-XXXX',
        target: 'lib/services/purchases/purchase-invoice.ts',
        protocol: 'prisma.$transaction ACID',
        description: 'Se cambia el estado a Received, se ingresa la factura comercial y se actualiza el Kardex.',
      },
      {
        step: 5,
        actor: 'Contabilidad',
        action: 'Asiento contable de compra y Cuentas por Pagar',
        target: 'lib/services/accounting/accounting-entries.service.ts',
        protocol: 'PCGE (Cuentas 60, 40, 42)',
        description: 'Se genera el asiento automático en el Libro Diario y se alimenta el registro SIRE Compras.',
      },
    ],
  },
  {
    id: 'inventory-lifecycle',
    title: '3. Ciclo de Inventario, Recetas & Kardex',
    badge: 'Inventario',
    color: '#10b981',
    description: 'Control de stock por escandallos, transformación de materia prima y actualización de kardex valorizado.',
    steps: [
      {
        step: 1,
        actor: 'Área de Cocina',
        action: 'Transformación de Insumos (Marinado)',
        target: 'app/purchases/transformation',
        protocol: 'HTTPS / REST',
        description: 'Transformación de 20 pollos crudos + aderezos en 20 pollos marinados listos para hornear.',
      },
      {
        step: 2,
        actor: 'Servicio de Inventario',
        action: 'Descarga insumos origen y genera producto procesado',
        target: 'lib/services/inventory/transformation.service.ts',
        protocol: 'prisma.$transaction',
        description: 'Se registran los movimientos de salida de materia prima e ingreso del insumo transformado.',
      },
      {
        step: 3,
        actor: 'Venta de Platos',
        action: 'Explosión de receta al vender en salón',
        target: 'lib/services/inventory/recipes.service.ts',
        protocol: 'Receta Automática',
        description: 'Al despachar 1 Pollo a la Brasa se descuenta: 1 Pollo marinado, 1.2 kg papas, aceite y vegetales.',
      },
      {
        step: 4,
        actor: 'Motor de Kardex',
        action: 'Actualiza Kardex Valorizado Promedio Ponderado',
        target: 'lib/services/inventory/kardex.service.ts',
        protocol: 'Kardex Movement (Append-Only)',
        description: 'Se recalcula el costo unitario promedio ponderado y se emite alerta si el stock cae del mínimo.',
      },
    ],
  },
  {
    id: 'accounting-lifecycle',
    title: '4. Ciclo Contable, Estados Financieros & PLE',
    badge: 'Contabilidad',
    color: '#8b5cf6',
    description: 'Consolidación de asientos contables automáticos, Balance de Comprobación y exportación de Libros Electrónicos PLE.',
    steps: [
      {
        step: 1,
        actor: 'Motor de Asientos',
        action: 'Captura eventos de Venta, Compra y Planilla',
        target: 'lib/services/accounting/accounting-entries.service.ts',
        protocol: 'Partida Doble PCGE',
        description: 'Cada operación genera su asiento contable balanceado (Debe == Haber) en el periodo vigente.',
      },
      {
        step: 2,
        actor: 'Libro Mayor',
        action: 'Mayorización y cálculo de saldos por cuenta',
        target: 'lib/services/accounting/accounting-ledgers.service.ts',
        protocol: 'Consultas relacionales tipadas',
        description: 'Se agrupan débitos y créditos por código contable (Cuentas 10, 12, 40, 42, 60, 70).',
      },
      {
        step: 3,
        actor: 'Estados Financieros',
        action: 'Generación de Balance y Estado de Resultados',
        target: 'app/accounting/reports/balance & income-statement',
        protocol: 'Agregaciones Financieras',
        description: 'Cálculo de Utilidad Operativa, Margen Bruto, EBITDA y Flujo de Caja en tiempo real.',
      },
      {
        step: 4,
        actor: 'Exportador PLE / SIRE',
        action: 'Generación de archivos oficiales para SUNAT',
        target: 'lib/services/accounting/ple.service.ts',
        protocol: 'Formato PLE TXT & SIRE JSON',
        description: 'Generación de Libros Electrónicos 5.1 (Diario), 5.2 (Simplificado), 8.1 (Compras) y 14.1 (Ventas).',
      },
    ],
  },
  {
    id: 'hr-lifecycle',
    title: '5. Ciclo de Recursos Humanos & Asistencia',
    badge: 'RRHH',
    color: '#ec4899',
    description: 'Marcación de asistencia biométrica/web, turnos semanales y cálculo de planilla con aportes AFP/ONP.',
    steps: [
      {
        step: 1,
        actor: 'Empleado (Mozo/Cocinero)',
        action: 'Inicia sesión en el ERP',
        target: 'app/security/login',
        protocol: 'HTTPS POST /api/auth/login',
        description: 'El empleado ingresa credenciales desde una computadora o tablet del restaurante.',
      },
      {
        step: 2,
        actor: 'Servicio de Asistencia',
        action: 'Marcación automática con IP y horario',
        target: 'lib/services/hr/attendance.service.ts',
        protocol: 'checkInOnLogin',
        description: 'Se valida que la IP coincida con la red de la pollería y se registra la entrada en AttendanceMark.',
      },
      {
        step: 3,
        actor: 'Gestor de Turnos',
        action: 'Control de jornada, tardanzas y horas extra',
        target: 'lib/services/hr/schedule.service.ts',
        protocol: 'Cálculo de Jornada',
        description: 'Se contrasta la marcación con el horario programado para computar horas trabajadas y tardanzas.',
      },
      {
        step: 4,
        actor: 'Cierre de Mes',
        action: 'Cálculo de Planilla y Asiento de Sueldos',
        target: 'lib/services/hr/payroll.service.ts',
        protocol: 'Deducciones AFP / ONP / Essalud',
        description: 'Se calcula sueldo neto, descuentos de ley y se genera automáticamente el asiento contable de nómina.',
      },
    ],
  },
  {
    id: 'security-lifecycle',
    title: '6. Ciclo de Seguridad, RBAC & Auditoría',
    badge: 'Seguridad',
    color: '#ef4444',
    description: 'Control de accesos con 80+ permisos granulares y registro inmutable en el historial de auditoría.',
    steps: [
      {
        step: 1,
        actor: 'Cualquier Cliente HTTP',
        action: 'Petición a endpoint protegido',
        target: 'app/api/**',
        protocol: 'HTTPS con Cookie HttpOnly',
        description: 'Petición entrante para anular un comprobante o modificar el precio de un plato.',
      },
      {
        step: 2,
        actor: 'API Gateway',
        action: 'Verifica permiso requerido ("ventas.anular")',
        target: 'lib/auth/permissions.ts',
        protocol: 'authorize("modulo.accion")',
        description: 'Se comprueba si el rol asignado al usuario posee el permiso granular específico.',
      },
      {
        step: 3,
        actor: 'Ejecutor de Acción',
        action: 'Ejecución exitosa o rechazo con 403 Forbidden',
        target: 'lib/services/security/audit.service.ts',
        protocol: 'Domain Service',
        description: 'Si no tiene permiso se deniega. Si tiene permiso, se procede y se dispara la auditoría.',
      },
      {
        step: 4,
        actor: 'Motor de Auditoría',
        action: 'Registro inmutable en tabla AuditLog',
        target: 'prisma.auditLog.create',
        protocol: 'Append-Only ACID',
        description: 'Se registra userId, acción, módulo, entidad afectada, detalles JSON e IP del cliente de forma imborrable.',
      },
    ],
  },
  {
    id: 'ai-lifecycle',
    title: '7. Ciclo de Inteligencia Artificial Financiera',
    badge: 'Asistente IA',
    color: '#d97706',
    description: 'Consultas gerenciales en lenguaje natural con microservicios LoRA y Gemini ejecutando sobre rol ai_readonly.',
    steps: [
      {
        step: 1,
        actor: 'Gerente / Administrador',
        action: 'Pregunta: "¿Cuál fue el margen del pollo en octubre?"',
        target: 'app/api/assistant',
        protocol: 'HTTPS POST /api/assistant',
        description: 'El gerente ingresa la consulta por texto o mediante dictado por voz.',
      },
      {
        step: 2,
        actor: 'Microservicio IA',
        action: 'Inferencia Text-to-SQL con LoRA o Gemini',
        target: 'agents-service / ai-service',
        protocol: 'X-ERP-Identity Token',
        description: 'El modelo especializado traduce la pregunta a una sentencia SQL SELECT optimizada.',
      },
      {
        step: 3,
        actor: 'SQL Validator',
        action: 'Filtro de seguridad P-4 y allowlist de tablas',
        target: 'agents-service/src/validator.py',
        protocol: 'AST Syntax Validation',
        description: 'Se rechaza cualquier intento de UPDATE, DELETE, subconsultas no autorizadas o inyección SQL.',
      },
      {
        step: 4,
        actor: 'PostgreSQL Neon',
        action: 'Ejecución de SELECT bajo rol ai_readonly',
        target: 'ai-service/ai_readonly_pgadmin.sql',
        protocol: 'Transacción READ ONLY',
        description: 'Se ejecuta la consulta en la base de datos sin capacidad de alterar registros.',
      },
      {
        step: 5,
        actor: 'Frontend ERP',
        action: 'Renderizado interactivo con tablas y gráficos',
        target: 'app/assistant/components',
        protocol: 'Generative UI',
        description: 'El gerente observa el resultado formateado en tarjeta con gráfico comparativo de márgenes.',
      },
    ],
  },
];

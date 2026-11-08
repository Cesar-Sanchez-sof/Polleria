# 🍗 Pollería ERP – Sistema Integral de Gestión Gastronómica & Contable

Sistema web corporativo para la gestión operativa, comercial, de recursos humanos y contable-tributaria de pollerías y cadenas gastronómicas en el Perú. Diseñado bajo una **Arquitectura por Dominio en capas**, garantizando alta cohesión, desacoplamiento estricto, cumplimiento de la normativa SUNAT y un flujo de trabajo ágil desde el salón hasta los estados financieros.

---

## 🏛️ Arquitectura por Dominio y Principios de Diseño

El sistema opera bajo una arquitectura de capas estricta e unidireccional:

```mermaid
flowchart TD
    Client["Cliente Web / POS / KDS / Dashboard"] -->|HTTP / JSON| Presentation["Capa de Presentación & API (app/api, Server Actions)"]
    Presentation -->|createApiHandler / RBAC Guard| Domain["Capa de Servicios de Dominio (lib/services/*)"]
    Domain -->|Reglas de Negocio / Validaciones| Persistence["Capa de Persistencia & Integraciones"]
    Persistence -->|Prisma Client| DB[("PostgreSQL / Neon Tech")]
    Persistence -->|SOAP / UBL 2.1| SUNAT["SUNAT (Facturación / SIRE / PLE)"]
    Persistence -->|SDK v3| S3["AWS S3 / Neon Object Storage"]
    Persistence -->|API / Webhooks| MP["Mercado Pago / Yape"]
    Persistence -->|REST| Reniec["Consulta DNI / RUC (RENIEC / SUNAT)"]
```

### Reglas de Arquitectura y Gobernanza del Código

1. **Convención de Capas Unidireccional**: 
   $$\text{Route Handlers / Server Actions (Presentación)} \longrightarrow \text{Domain Services (Reglas de Negocio)} \longrightarrow \text{Prisma ORM / Persistencia}$$
2. **Enforcement Automatizado en ESLint (Nivel `error`)**:
   La regla `no-restricted-imports` en `eslint.config.mjs` bloquea a nivel de compilación y CI cualquier intento de importar `@/lib/prisma` directamente en la capa de presentación (`app/**/*.{ts,tsx}`). La persistencia está restringida exclusivamente a `lib/services/**`.
3. **Handlers Tipados y Seguros con `createApiHandler`**:
   Todos los endpoints de la API delegan a `createApiHandler` (`@/lib/http/route-handler`), el cual centraliza:
   - Verificación de sesión y permisos RBAC (`permission: "modulo.accion"`).
   - Parseo y validación de esquemas Zod o validadores funcionales.
   - Captura y traducción de excepciones de dominio (`ValidationError` 400, `NotFoundError` 404, `ConflictError` 409, etc.).
4. **Ciclo de Migración a Arquitectura por Dominio Completado (6/6)**:
   - **(1/6) Andamiaje y Convención**: Introducción de `createApiHandler`, jerarquía de excepciones y regla ESLint inicial.
   - **(2/6) Ajustes y Mesas (Piloto)**: Migración de `settings`, `tables`, `payment-methods` y `roles`.
   - **(3/6) Seguridad**: Migración de `users`, `audit`, autenticación y control de accesos RBAC.
   - **(4/6) Compras e Inventario**: Migración de `products`, `suppliers`, órdenes de compra y kardex valorizado.
   - **(5/6) Ventas, Caja y Pagos**: Migración de los 14 handlers críticos (`orders`, `sales`, `cash-sessions`, `customers`, `payments`, `webhooks`, `realtime`) con pruebas de caracterización previas.
   - **(6/6) Cierre y Reforzamiento**: Elevación de la regla ESLint a `error`, documentación formal en `AGENTS.md` y suite de validación arquitectónica.
5. **Control de Acceso Granular (RBAC)**: Más de 80 permisos configurables asignados dinámicamente a roles (Superadministrador, Administrador, Mozo, Cajero, Cocinero, Contador, etc.).
6. **Testing Centralizado**: 100% de las suites de prueba residen en la carpeta raíz `test/`, superando 1,080 pruebas automatizadas sin dependencias en código de producción.

---

## 🚀 Módulos y Funcionalidades del Sistema

### 🍽️ 1. Salón, Mesas y Punto de Venta (POS)
- **Gestión Visual de Ambientes y Mesas**: Configuración interactiva de áreas (Salón Principal, Terraza, Barra, Segundo Piso) con estados dinámicos (*Disponible, Ocupada, Reservada, Atendiendo, Limpieza*).
- **Toma de Comandas Ágil**: Registro de pedidos para consumo en mesa y pedidos para llevar (*Takeout*), con notas personalizadas para cocina y modificadores por producto.
- **División de Cuentas (Split Payments)**: Posibilidad de pagar comandas divididas entre varios comensales en distintos métodos de pago.
- **Impresión y Comandera**: Enrutamiento automático de comandas hacia impresoras de cocina o despacho de bar.

### 💳 2. Ventas, Caja y Pagos Multicanal
- **Sesiones de Caja y Turnos**: Apertura y cierre de caja con control de saldo inicial, ingresos, egresos de emergencia auditados y arqueo físico detallado por denominación de billetes y monedas peruanas (S/ 0.10 a S/ 200).
- **Pagos Digitales & Billeteras**:
  - Integración nativa con **Mercado Pago API** para cobros con tarjeta y Tap to Pay.
  - Generación de **QR Dinámico de Yape** con monto exacto de la comanda y confirmación por webhooks idempotentes protegidos con firma HMAC.
- **Emisión de Comprobantes de Pago**:
  - Emisión de Boletas de Venta (`B001`), Facturas (`F001`), Tickets de control y Notas de Crédito con cálculo normativo de IGV (18%).
  - Series de comprobantes configurables por terminal y punto de emisión.
- **Consulta de Identidad en Tiempo Real**: Validación y autocompletado de clientes mediante DNI (8 dígitos) y RUC (11 dígitos) con cache y resiliencia ante caídas de servicio.
- **Respaldo Digital en S3**: Almacenamiento seguro en la nube de los comprobantes emitidos en formato digital compatible con AWS S3 y Neon Object Storage.

### 📜 3. Facturación Electrónica SUNAT (UBL 2.1)
- **Generación de XML UBL 2.1**: Estructuración formal de comprobantes electrónicos con namespaces oficiales de SUNAT.
- **Firma Digital XMLDSIG**: Firmado criptográfico en memoria mediante certificado digital PKCS#12 (`.p12` / `.pfx`).
- **Comunicación SOAP Serverless**: Envío de trama comprimida en ZIP hacia los Web Services de SUNAT (Beta y Homologación/Producción).
- **Procesamiento de CDR**: Recepción, descompresión y parseo de la Constancia de Recepción (CDR) con actualización automática del estado fiscal del comprobante.

### 👨‍🍳 4. Cocina (KDS) y Barra de Bebidas
- **Kitchen Display System (KDS)**: Pantalla táctil en tiempo real para el equipo de cocina con actualización instantánea de comandas.
- **Flujo de Preparación por Fases**: Estados visuales de preparación: *Pendiente -> En Cocina -> Listo para Despachar -> Entregado*.
- **División de Estaciones**: Separación automática de ítems que van a parrilla/freidora vs. ítems que corresponden a la estación de bebidas y postres.

### 📦 5. Compras e Inventario (Kardex Valorizado)
- **Maestro de Productos y Recetas**: Catálogo unificado de platos vendibles e insumos directos. Formulación de recetas con costos unitarios e impacto directo en stock por plato vendido.
- **Gestión de Proveedores**: Directorio de proveedores con validación de razón social y RUC ante SUNAT.
- **Recepción de Compras y Facturas de Proveedor**: Registro de órdenes de compra, ingreso de facturas/boletas de compra y compras menores, actualizando automáticamente el costo promedio y último costo.
- **Control de Almacén**:
  - Kardex valorizado bajo método Promedio Ponderado y PEPS.
  - Registro de mermas justificadas (deterioro, vencimiento, roturas).
  - Transformación de insumos (ej. pollo beneficiado a piezas y cortes marinados).
  - Alertas visuales de stock mínimo y reposición.

### 👥 6. Recursos Humanos (RRHH) y Planilla
- **Expediente de Empleados**: Ficha del colaborador, cargos, datos bancarios, régimen pensionario (ONP / AFP Integra, Prima, Profuturo, Habitat).
- **Contratos Laborales**: Emisión y seguimiento de contratos (Plazo fijo, Indeterminado, Locación de Servicios).
- **Control de Turnos y Horarios**: Asignación semanal de cuadrillas, turnos de almuerzo y cena.
- **Planilla Mensual de Remuneraciones**:
  - Cálculo automatizado de Sueldo Base, Asignación Familiar, Horas Extra y Bonificaciones.
  - Retenciones de ley: Aporte obligatorio de pensión (ONP 13% o AFP aporte + comisión + prima de seguro), descuentos por inasistencias y adelantos.
  - Aportes del empleador: EsSalud (9%) o SIS Microempresa.
  - Generación de asientos automáticos de nómina y pago a trabajadores.

### 📊 7. Contabilidad Financiera & Tributación SUNAT
- **Asientos Automáticos por Partida Doble**:
  - Asientos generados al instante por Ventas, Cobranzas, Costo de Ventas, Compras, Pagos a Proveedores, Mermas y Planilla.
- **Libros Contables Principales**:
  - **Libro Diario**: Cronológico, agrupado por subdiarios (*Ventas, Compras, Caja/Bancos, Planilla, Operaciones Varias*).
  - **Libro Mayor**: Movimientos detallados agrupados por código contable del PCGE.
  - **Balance de Comprobación (Trial Balance)**: Verificación de sumas y saldos para cuadre fiscal.
- **Estados Financieros en Tiempo Real**:
  - Balance General (Estado de Situación Financiera).
  - Estado de Resultados (Por Función y Por Naturaleza).
  - Estado de Flujos de Efectivo (Método Directo).
  - Cierre de periodos contables mensuales y anuales con bloqueo anti-modificación.
- **Libros Electrónicos PLE SUNAT**:
  - **Libro 14.1**: Registro de Ventas e Ingresos Electrónico (con soporte para 35 columnas, ICBPER y CUO).
  - **Libro 8.1**: Registro de Compras Electrónico.
  - **Libro 5.1 & 6.1**: Libro Diario y Libro Mayor electrónico en formato oficial TXT estructurado.
- **Integración SIRE SUNAT**: Cliente y simulador para el Sistema Integrado de Registros Electrónicos (SIRE Compras - RCE y RVIE).

### 🤖 8. Asistente Financiero & Contable con IA
- **IA Especializada en Negocio**: Chatbot financiero contextualizado con la información en vivo de las ventas, compras, caja y estado de resultados.
- **Selector de Modelos**: Compatibilidad con Gemini 1.5/2.0 Flash/Pro, Llama 3 y modelos fine-tuneados con adaptadores LoRA para PCGE.
- **Dictado y Transcripción por Voz**: Entrada rápida de consultas y comandos mediante reconocimiento de voz en navegadores compatibles.
- **Aislamiento y Privacidad**: Restricción estricta del contexto inyectado según el rol y los permisos del usuario conectado.

### ⚙️ 9. Configuración del Restaurante y Seguridad
- **Datos de la Empresa**: RUC, Razón Social, Nombre Comercial, Dirección, Ubigeo, Teléfonos, Redes Sociales y Logotipo institucional.
- **Branding Personalizable**: Selección de temas visuales, orientación y colores de interfaz.
- **Bitácora de Auditoría**: Registro inmutable de cada acción sensible (aperturas de caja, anulaciones de comandas, modificaciones contables y cambios de roles).

---

## 🛠️ Stack Tecnológico

| Capa / Área | Tecnologías Principales |
| :--- | :--- |
| **Framework Full-Stack** | [Next.js 16.4](https://nextjs.org/) (App Router, Turbopack, React Server Components) |
| **Librería de UI** | [React 19](https://react.dev/), [TypeScript 5](https://www.typescriptlang.org/) |
| **Estilos & Diseño** | [Tailwind CSS v4](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/), [Lucide React](https://lucide.dev/), Sonner |
| **Base de Datos & ORM** | [PostgreSQL](https://www.postgresql.org/) ([Neon Serverless Postgres](https://neon.tech/)), [Prisma ORM v6](https://www.prisma.io/) |
| **Autenticación & Seguridad** | [jose](https://github.com/panva/jose) (JWT seguro en cookies HttpOnly), Argon2/bcrypt |
| **Almacenamiento Cloud** | AWS SDK v3 (`@aws-sdk/client-s3`) compatible con Neon Object Storage |
| **Pasarelas de Pago** | Mercado Pago SDK Node.js, Billetera Digital Yape (QR Dinámico) |
| **Caché & Rendimiento** | Redis / Upstash Redis |
| **Facturación & SUNAT** | SOAP XML, XMLDSIG, UBL 2.1, Archivos PLE/SIRE |
| **Testing & Calidad** | [Vitest](https://vitest.dev/) (1,080+ pruebas), ESLint v9, Prettier |

---

## 📁 Estructura del Proyecto

```plaintext
Polleria/
├── app/                        # Capa de Presentación (Next.js App Router)
│   ├── (auth)/                 # Rutas públicas (Login, logout)
│   ├── (dashboard)/            # Rutas protegidas (Salón, Cocina, Caja, Compras, RRHH, Contabilidad)
│   └── api/                    # API Route Handlers desacoplados mediante createApiHandler
│       ├── orders/             # Comandas, pedidos y bebidas (desacoplado de Prisma)
│       ├── sales/              # Ventas, comprobantes y arqueos (desacoplado de Prisma)
│       ├── cash-sessions/      # Sesiones de caja y movimientos (desacoplado de Prisma)
│       ├── customers/          # Clientes y validación SUNAT (desacoplado de Prisma)
│       ├── payments/           # Pasarelas de Mercado Pago y QR Yape
│       └── ...
├── components/                 # Componentes de UI reutilizables (Botones, Modales, Tablas, Layouts)
├── lib/                        # Núcleo de Lógica de Negocio y Utilidades
│   ├── auth/                   # Sesión, permisos y RBAC
│   ├── http/                   # createApiHandler y definición de errores de dominio
│   ├── prisma/                 # Instancia global de Prisma Client (Singleton)
│   ├── services/               # SERVICIOS DE DOMINIO (Orders, Sales, CashSessions, Products, etc.)
│   ├── sunat/                  # Generación y firma de XML UBL 2.1 y clientes SOAP
│   └── utils/                  # Cálculos de IGV, redondeo, formateadores
├── prisma/                     # Esquema de base de datos y migraciones
│   └── schema.prisma
├── specs/                      # Especificaciones funcionales y técnicas numeradas (001 a 058)
└── test/                       # SUITE COMPLETA DE PRUEBAS (Unitarias, Integración y API)
    ├── characterization/       # Tests de caracterización para refactorizaciones seguras
    ├── accounting/             # Pruebas de estados financieros y balances
    ├── ai-assistant/           # Pruebas del asistente contable
    ├── api/                    # Pruebas de Route Handlers
    ├── auth/                   # Pruebas de autenticación y permisos
    ├── hr/                     # Pruebas de contratos y nóminas
    ├── ple/                    # Pruebas de exportación PLE SUNAT
    ├── services/               # Pruebas de servicios de negocio
    └── sire/                   # Pruebas de integración SIRE SUNAT
```

---

## ⚙️ Instalación y Puesta en Marcha Local

### Prerrequisitos
- **Node.js**: v20.x o superior.
- **npm** o **pnpm**.
- Instancia activa de **PostgreSQL** (local o en la nube mediante [Neon](https://neon.tech/)).

### Pasos de Configuración

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/Cesar-Sanchez-sof/Polleria.git
   cd Polleria
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Variables de Entorno:**
   Copia el archivo de plantilla `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```
   Configura tus credenciales clave:
   ```env
   # Base de datos
   DATABASE_URL="postgresql://usuario:password@localhost:5432/polleria_db?schema=public"

   # Autenticación JWT
   JWT_SECRET="tu-clave-secreta-super-segura-de-32-caracteres"

   # Integraciones opcionales (Mercado Pago, S3, SUNAT)
   MERCADOPAGO_ACCESS_TOKEN=""
   AWS_S3_BUCKET_NAME=""
   SUNAT_RUC="20608976543"
   SUNAT_USUARIO_SOL="MODDATOS"
   SUNAT_CLAVE_SOL="MODDATOS"
   ```

4. **Sincronizar la Base de Datos:**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Ejecutar el Servidor de Desarrollo:**
   ```bash
   npm run dev
   ```
   Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## 🧪 Pruebas Automatizadas y Calidad de Código

El proyecto cuenta con una cobertura integral de más de 1,080 pruebas automatizadas con Vitest:

```bash
# Ejecutar todas las pruebas unitarias y de integración
npx vitest run

# Ejecutar pruebas en modo observador (watch mode)
npx vitest

# Ejecutar linter de código
npm run lint

# Compilación de producción (build check)
npm run build
```

---

## 📄 Licencia

Este proyecto está bajo la licencia [MIT](LICENSE). Desarrollado para optimizar y transformar digitalmente la gastronomía peruana.

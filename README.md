# 🍗 Pollería ERP – Sistema Integral de Gestión Gastronómica

Sistema web moderno para la gestión operativa, comercial y contable de restaurantes y pollerías. Diseñado para optimizar el flujo completo desde la toma de comandas en salón hasta el arqueo de caja y los asientos contables.

---

## 🚀 Módulos y Funcionalidades del Sistema

### 🍽️ 1. Salón de Mesas y Ventas
- **Gestión visual de salón:** Mapa de mesas en tiempo real con estados dinámicos (*Disponible, Ocupada, Reservada*).
- **Toma de comandas:** Pedidos continuos para consumo en salón y pedidos para llevar.
- **Cobro multicanal:** Pagos en Efectivo, Billeteras Digitales (*Yape / Plin*) y Tarjetas POS (*Tap to Pay / Mercado Pago*).
- **Comprobantes de pago:** Emisión de Boletas, Facturas y Tickets con desglose de IGV (18%).
- **Almacenamiento Cloud S3:** Respaldo digital automático de comprobantes en Cloud Storage compatible con S3 (Neon Object Storage / AWS).
- **Consulta de identidad:** Validación y consulta de DNI y RUC de clientes.

### 👨‍🍳 2. Cocina (KDS) y Recetas
- **Pantalla de Cocina:** Vista en tiempo real de comandas recibidas, en preparación y listas para despacho.
- **Gestión de Platos:** Catálogo de productos con receta base vinculada a insumos, unidades y cantidades.
- **Baja lógica:** Control de disponibilidad de platos sin eliminar historial histórico.

### 💵 3. Control de Caja y Arqueo Físico
- **Sesiones de Caja:** Control estricto de Apertura y Cierre de turno.
- **Arqueo por denominación:** Conteo detallado de billetes (S/ 10, 20, 50, 100, 200) y monedas (S/ 0.10, 0.20, 0.50, 1, 2, 5).
- **Salidas por emergencia:** Registro auditado de egresos de dinero con monto y justificación.

### 📊 4. Módulo Contable
- **Libro Diario:** Registro cronológico de asientos contables bajo el principio de partida doble (*Debe = Haber*).
- **Subdiarios:** Filtrado especializado para *Caja y bancos*, *Operaciones varias*, *Compras* y *Ventas*.
- **Exportación XLSX:** Descarga de reportes en formato Excel oficial tanto para el Libro Diario como para Contabilidad de Caja.
- **Plan de Cuentas:** Catálogo estructurado de cuentas y períodos contables.

### 📦 5. Inventario e Insumos
- Catálogo maestro de insumos para preparación y suministros de salón.
- Registro de proveedores y compras menores sin comprobante.

---

## 📌 Alcance Actual: ¿Qué tiene y qué NO tiene?

| Área | ✅ Implementado | ⏳ Pendiente / En Hoja de Ruta |
| :--- | :--- | :--- |
| **Comprobantes** | Emisión interna y almacenamiento S3 en PDF | Conexión directa a PSE/OSE SUNAT en vivo |
| **Pedidos** | Salón y Para Llevar | Integración con delivery externo (Rappi / PedidosYa) |
| **Notificaciones** | Interfaz reactiva en navegador | WebSockets / Server-Sent Events dedicados |
| **Plataforma** | Web App Responsiva (Móvil / Tablet / PC) | App móvil nativa (Android / iOS) |

---

## 🛠️ Stack Tecnológico

- **Frontend & Backend:** [Next.js 16](https://nextjs.org/) (App Router), [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/).
- **Estilos & UI:** [Tailwind CSS v4](https://tailwindcss.com/), [Shadcn UI](https://ui.shadcn.com/), Lucide Icons, Sonner.
- **Base de Datos & ORM:** PostgreSQL (Neon Tech) y [Prisma ORM v6](https://www.prisma.io/).
- **Almacenamiento:** Compatible con AWS S3 / Neon Object Storage (`@aws-sdk/client-s3`).
- **Caché:** [Redis](https://redis.io/) / Upstash.
- **Testing:** [Vitest](https://vitest.dev/).
- **Documentación API:** Swagger / OpenAPI (`/api/docs`).

---

## ⚙️ Instalación y Puesta en Marcha

### Prerrequisitos
- Node.js 20+ y `npm`.
- Instancia de PostgreSQL (Neon o local).

### Pasos
```bash
# 1. Clonar el repositorio
git clone https://github.com/Cesar-Sanchez-sof/Polleria.git
cd Polleria

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env

# 4. Generar cliente de Prisma y correr migraciones
npx prisma generate
npx prisma db push

# 5. Iniciar servidor de desarrollo
npm run dev
/**
 * Fuente estructurada del Manual de Usuario de Pollería ERP.
 * Cada sección declara los permisos RBAC (`requiredPermissions`) que habilitan su visualización,
 * de modo que cualquier usuario autenticado accede únicamente a los instructivos que le corresponden
 * (además de las secciones generales con `requiredPermissions: []`).
 */

export type ManualCategory =
  | "General"
  | "Ventas y Salón"
  | "Cocina y Carta"
  | "Caja y Comprobantes"
  | "Compras e Inventario"
  | "Contabilidad"
  | "Recursos Humanos"
  | "Tableros e IA"
  | "Seguridad y Ajustes";

export interface ManualStep {
  /** Título breve de la acción que debe ejecutar el usuario. */
  title: string;
  /** Explicación operativa paso a paso. */
  description: string;
  /** Ruta o control de UI donde ocurre la acción. */
  where?: string;
  /** Permiso específico requerido para esta acción (si aplica). */
  actionPermission?: string;
}

export interface ManualTroubleshooting {
  problem: string;
  solution: string;
}

export interface ManualSection {
  id: string;
  category: ManualCategory;
  title: string;
  summary: string;
  /** Ruta directa al módulo dentro del ERP (null si aplica a todo el sistema). */
  href: string | null;
  /** Permisos "ver" o operativos; vacío significa visible para cualquier usuario con sesión. */
  requiredPermissions: readonly string[];
  /** Roles típicos que operan este flujo. */
  roles: readonly string[];
  prerequisites: readonly string[];
  steps: readonly ManualStep[];
  tips: readonly string[];
  troubleshooting?: readonly ManualTroubleshooting[];
}

export interface RolePreviewPreset {
  id: string;
  label: string;
  description: string;
  permissions: readonly string[] | null;
}

/**
 * Perfiles de previsualización para que un administrador valide qué instructivos ve cada rol.
 */
export const ROLE_PREVIEW_PRESETS: readonly RolePreviewPreset[] = [
  {
    id: "current",
    label: "Mi vista actual",
    description: "Muestra exactamente los instructivos habilitados para tus permisos activos.",
    permissions: null,
  },
  {
    id: "MESERO",
    label: "Rol: Mesero",
    description: "Atención en salón, toma de pedidos, despacho de bebidas y autoservicio.",
    permissions: ["pedidos.ver", "pedidos.crear", "pedidos.editar", "bebidas.ver", "listos.ver", "mesas.ver", "mesas.editar", "platos.ver", "clientes.ver", "manual.ver"],
  },
  {
    id: "CAJERO",
    label: "Rol: Cajero",
    description: "Apertura/cierre de caja, cobro con efectivo/Yape/Mercado Pago y comprobantes.",
    permissions: ["ventas.ver", "ventas.crear", "facturas.ver", "caja.ver", "caja.crear", "caja.editar", "clientes.ver", "clientes.crear", "clientes.editar", "pedidos.ver", "manual.ver"],
  },
  {
    id: "COCINERO",
    label: "Rol: Cocinero",
    description: "Flujo KDS en cocina, preparación de platos, inventario y transformación de insumos.",
    permissions: ["cocina.ver", "cocina.editar", "pedidos.ver", "listos.ver", "platos.ver", "inventario.ver", "transformacion.ver", "transformacion.crear", "manual.ver"],
  },
  {
    id: "CONTADOR",
    label: "Rol: Contador",
    description: "Asientos, libros contables, estados financieros, PLE/SIRE y auditoría de compras/ventas.",
    permissions: [
      "asientos.ver", "asientos.crear", "asientos.editar", "pagar.ver", "cuentas.ver", "periodos.ver",
      "comprobacion.ver", "balance.ver", "dashboard.ver", "resultados.ver", "flujo.ver", "mayor.ver",
      "ple.ver", "resumen.ver", "guia.ver", "dashcompras.ver", "compras.ver", "proveedores.ver",
      "inventario.ver", "ventas.ver", "facturas.ver", "auditoria.ver", "manual.ver",
    ],
  },
  {
    id: "RRHH",
    label: "Rol: RRHH",
    description: "Empleados, contratos, horarios, asistencia, vacaciones, seguros, adelantos y planilla.",
    permissions: [
      "empleados.ver", "contratos.ver", "horarios.ver", "asistencia.ver",
      "vacaciones.ver", "seguros.ver", "anticipos.ver", "planilla.ver", "manual.ver",
    ],
  },
];

export const USER_MANUAL_SECTIONS: readonly ManualSection[] = [
  {
    id: "acceso-y-autoservicio",
    category: "General",
    title: "Acceso al Sistema, Asistencia y Autoservicio",
    summary: "Cómo iniciar sesión, consultar tu horario laboral, marcar asistencia al entrar/salir y solicitar vacaciones.",
    href: "/hr/me",
    requiredPermissions: [],
    roles: ["Todos los usuarios"],
    prerequisites: [
      "Contar con usuario y contraseña asignados por Administración.",
      "Tener un contrato y horario vigente si registras asistencia laboral.",
    ],
    steps: [
      {
        title: "Iniciar sesión",
        description: "Ingresa tu usuario y contraseña en la pantalla de acceso. Al autenticarte, el menú lateral mostrará únicamente los módulos habilitados para tu rol.",
        where: "/login",
      },
      {
        title: "Confirmar marcación de entrada",
        description: "Si tienes turno programado, el sistema registra o notifica tu asistencia automáticamente al iniciar sesión mediante un aviso en la esquina inferior derecha.",
        where: "Menú lateral / Notificación superior",
      },
      {
        title: "Consultar mi horario y solicitar permisos",
        description: "Haz clic en 'Mi horario y asistencia' en la parte superior del menú lateral para ver tus turnos semanales, historial de marcaciones, boletas y enviar solicitudes de descanso o vacaciones.",
        where: "/hr/me",
      },
      {
        title: "Cerrar sesión al terminar la jornada",
        description: "Presiona el icono de salida al pie del menú lateral. Si tienes una entrada abierta sin salida registrada, el sistema te preguntará si deseas marcar tu salida o solo cerrar sesión temporalmente.",
        where: "Pie del menú lateral",
      },
    ],
    tips: [
      "Si cambias de turno con un compañero o haces una pausa rápida, elige 'Solo cerrar sesión' para no cerrar tu jornada antes de tiempo.",
      "Puedes alternar entre modo claro y oscuro usando el botón de tema en el menú lateral.",
    ],
    troubleshooting: [
      {
        problem: "Aparece el mensaje 'Acceso denegado' al abrir una ruta.",
        solution: "Tu rol actual no tiene el permiso para esa pantalla. Verifica en este manual los módulos asignados a tu rol o solicita acceso a un administrador.",
      },
    ],
  },
  {
    id: "salon-mesas-pedidos",
    category: "Ventas y Salón",
    title: "Salón de Mesas, Comandas y Despacho",
    summary: "Atención en salón: ocupación de mesas, toma de pedidos con modificadores, seguimiento de cocina y despacho de bebidas.",
    href: "/sales?tab=tables",
    requiredPermissions: ["pedidos.ver", "bebidas.ver", "listos.ver"],
    roles: ["MESERO", "CAJERO", "ADMIN"],
    prerequisites: [
      "Salones y mesas configurados previamente en Configuración → Mesas.",
      "Carta de productos y precios activa.",
    ],
    steps: [
      {
        title: "Seleccionar ambiente y mesa",
        description: "Ingresa a Ventas → Salón de mesas. Identifica el estado por color (Disponible, Ocupada, Atendiendo) y haz clic en la mesa a atender o elige 'Para llevar'.",
        where: "/sales?tab=tables",
        actionPermission: "pedidos.ver",
      },
      {
        title: "Registrar ítems y notas de cocina",
        description: "Agrega platos o bebidas desde la carta, ajusta cantidades y añade observaciones (ej. 'sin ensalada', 'parte pecho', 'ajís aparte') antes de enviar la comanda.",
        where: "Panel de comanda en /sales?tab=tables",
        actionPermission: "pedidos.crear",
      },
      {
        title: "Despachar bebidas y recoger pedidos listos",
        description: "Revisa 'Despacho de Bebidas' para entregas de barra y la pestaña 'Pedidos Listos' para recoger los platos terminados por cocina.",
        where: "/sales?tab=drinks y /sales?tab=kitchen",
        actionPermission: "bebidas.ver",
      },
      {
        title: "Modificar o liberar mesa",
        description: "Si el cliente solicita platos adicionales, edita la comanda abierta agregando nuevos ítems sin duplicar los ya enviados a cocina.",
        where: "/sales?tab=tables",
        actionPermission: "pedidos.editar",
      },
    ],
    tips: [
      "Las comandas se enrutan automáticamente por estación: parrilla/cocina va al KDS y refrescos/bebidas al módulo de Despacho de Bebidas.",
    ],
  },
  {
    id: "cocina-kds-y-carta",
    category: "Cocina y Carta",
    title: "Flujo de Cocina (KDS) y Productos / Carta",
    summary: "Gestión en tiempo real de comandas entrantes en cocina y mantenimiento de platos, precios y recetas.",
    href: "/sales/kitchen/kds",
    requiredPermissions: ["cocina.ver", "platos.ver"],
    roles: ["COCINERO", "MESERO", "ADMIN"],
    prerequisites: [
      "Estaciones de cocina e insumos registrados.",
    ],
    steps: [
      {
        title: "Monitorear comandas en el KDS",
        description: "Abre Flujo de Cocina (KDS). Las órdenes aparecen automáticamente en tiempo real ordenadas por tiempo de espera con sus notas de preparación.",
        where: "/sales/kitchen/kds",
        actionPermission: "cocina.ver",
      },
      {
        title: "Avanzar estados de preparación",
        description: "Marca cada comanda o ítem como 'En preparación' al iniciar la cocción y como 'Listo para despachar' al emplatar para notificar al salón.",
        where: "/sales/kitchen/kds",
        actionPermission: "cocina.editar",
      },
      {
        title: "Administrar productos y carta",
        description: "En Productos y Carta puedes consultar precios, disponibilidad, categorías y vincular recetas con insumos de almacén para descontar stock automáticamente.",
        where: "/sales/kitchen/products",
        actionPermission: "platos.ver",
      },
    ],
    tips: [
      "Revisa las etiquetas de notas en cada tarjeta KDS antes de despachar para evitar devoluciones.",
    ],
  },
  {
    id: "caja-cobros-facturacion",
    category: "Caja y Comprobantes",
    title: "Caja, Cobros Multicanal y Comprobantes SUNAT",
    summary: "Apertura de turno, cobro de pedidos (efectivo, tarjeta, Mercado Pago, QR Yape), consulta DNI/RUC y cierre de caja.",
    href: "/sales?tab=cashier",
    requiredPermissions: ["caja.ver", "ventas.ver", "clientes.ver", "facturas.ver"],
    roles: ["CAJERO", "ADMIN"],
    prerequisites: [
      "Abrir una sesión de caja antes de procesar pagos en efectivo o comprobantes.",
      "Contar con series de boleta/factura configuradas.",
    ],
    steps: [
      {
        title: "Abrir sesión de caja",
        description: "Ingresa a Ventanilla, selecciona la caja registradora, declara el saldo inicial (sencillo) y abre el turno.",
        where: "/sales?tab=cashier",
        actionPermission: "caja.crear",
      },
      {
        title: "Cobrar pedidos pendientes y dividir cuentas",
        description: "Ve a 'Pedidos no cobrados', selecciona la mesa o comanda, elige Boleta, Factura o Ticket y procesa el pago total o dividido (efectivo, tarjeta, Mercado Pago o QR Yape).",
        where: "/sales?tab=payments",
        actionPermission: "ventas.crear",
      },
      {
        title: "Validar cliente por DNI o RUC",
        description: "Ingresa los 8 dígitos (DNI) u 11 dígitos (RUC) para autocompletar automáticamente la razón social o nombre desde RENIEC/SUNAT.",
        where: "/sales?tab=customers",
        actionPermission: "clientes.crear",
      },
      {
        title: "Consultar facturas y hacer arqueo de cierre",
        description: "En 'Facturas de Venta' descarga XML/PDF/CDR SUNAT. Al finalizar el turno, registra ingresos/egresos manuales y realiza el conteo por denominación para cerrar caja.",
        where: "/sales?tab=invoices y /sales?tab=cashier",
        actionPermission: "caja.editar",
      },
    ],
    tips: [
      "Nunca cierres el turno sin cuadrar los pagos digitales (Yape/Mercado Pago) contra las confirmaciones del módulo.",
    ],
    troubleshooting: [
      {
        problem: "No permite cobrar un pedido porque indica 'No hay sesión de caja abierta'.",
        solution: "Dirígete a Ventas → Ventanilla y realiza la apertura de caja con tu monto inicial.",
      },
    ],
  },
  {
    id: "compras-inventario-kardex",
    category: "Compras e Inventario",
    title: "Compras, Proveedores, Kardex y Transformación",
    summary: "Registro de compras con factura o sin comprobante, control de stock valorizado, mermas y transformación de pollos/insumos.",
    href: "/purchases/list",
    requiredPermissions: ["dashcompras.ver", "compras.ver", "inventario.ver", "transformacion.ver", "proveedores.ver"],
    roles: ["COCINERO", "CONTADOR", "ADMIN"],
    prerequisites: [
      "Proveedores registrados con RUC válido.",
      "Insumos creados en el catálogo de inventario.",
    ],
    steps: [
      {
        title: "Gestionar proveedores",
        description: "Registra y valida nuevos proveedores por RUC en Compras e Inventario → Proveedores.",
        where: "/purchases/suppliers",
        actionPermission: "proveedores.crear",
      },
      {
        title: "Registrar compras e ingreso de stock",
        description: "Crea una compra indicando proveedor, tipo de comprobante (Factura, Boleta, Liquidación o compra menor sin comprobante) e ítems. El inventario y costo promedio se actualizan al confirmar.",
        where: "/purchases/list",
        actionPermission: "compras.crear",
      },
      {
        title: "Revisar Kardex y mermas",
        description: "Consulta entradas, salidas por ventas y registra ajustes o mermas justificadas desde Kardex e Inventario.",
        where: "/purchases/inventory",
        actionPermission: "inventario.ver",
      },
      {
        title: "Transformar insumos (ej. pollo entero a cortes)",
        description: "Usa el módulo de Transformación para convertir materia prima en porciones marinadas o subproductos manteniendo la trazabilidad de costos.",
        where: "/purchases/transformation",
        actionPermission: "transformacion.crear",
      },
    ],
    tips: [
      "Usa el Dashboard de Compras (/purchases/dashboard) para detectar alertas de stock mínimo antes de los turnos pico.",
    ],
  },
  {
    id: "contabilidad-sunat",
    category: "Contabilidad",
    title: "Contabilidad, Estados Financieros, PLE y SIRE",
    summary: "Revisión de asientos automáticos y manuales, plan de cuentas PCGE, cierre de periodos y exportación tributaria SUNAT.",
    href: "/accounting/reports/dashboard",
    requiredPermissions: [
      "asientos.ver", "pagar.ver", "cuentas.ver", "periodos.ver",
      "comprobacion.ver", "balance.ver", "dashboard.ver", "resultados.ver",
      "flujo.ver", "mayor.ver", "ple.ver", "resumen.ver", "guia.ver",
    ],
    roles: ["CONTADOR", "ADMIN"],
    prerequisites: [
      "Periodo contable mensual abierto.",
      "Plan Contable General Empresarial (PCGE) cargado.",
    ],
    steps: [
      {
        title: "Revisar y registrar asientos contables",
        description: "Verifica los asientos generados automáticamente por ventas, compras y planilla, o registra asientos manuales cuadrados por partida doble.",
        where: "/accounting/entries",
        actionPermission: "asientos.ver",
      },
      {
        title: "Controlar cuentas por pagar y periodos",
        description: "Monitorea facturas de proveedores pendientes en Cuentas por Pagar y bloquea meses cerrados desde Periodos Contables.",
        where: "/accounting/payables y /accounting/periods",
        actionPermission: "periodos.ver",
      },
      {
        title: "Analizar reportes financieros",
        description: "Consulta Balance General, Estado de Resultados, Flujo de Efectivo, Balance de Comprobación, Libro Mayor y Resumen Ejecutivo en tiempo real.",
        where: "/accounting/reports/balance",
        actionPermission: "balance.ver",
      },
      {
        title: "Exportar Libros PLE y conciliar SIRE",
        description: "Genera los archivos TXT oficiales de SUNAT (14.1 Ventas, 8.1 Compras, 5.1 Diario, 6.1 Mayor) y valida comprobantes de compras en SIRE.",
        where: "/accounting/reports/ple y /accounting/reports/sire-compras",
        actionPermission: "ple.ver",
      },
    ],
    tips: [
      "Consulta 'Configuración → Guía Contable' si necesitas verificar las cuentas PCGE asociadas a cada operación automática.",
    ],
  },
  {
    id: "recursos-humanos-planilla",
    category: "Recursos Humanos",
    title: "Recursos Humanos, Turnos, Asistencia y Planilla",
    summary: "Gestión integral del ciclo de vida del colaborador: ficha, contratos, horarios, marcaciones, vacaciones y cálculo de planilla.",
    href: "/hr/employees",
    requiredPermissions: [
      "empleados.ver", "contratos.ver", "horarios.ver", "asistencia.ver",
      "vacaciones.ver", "seguros.ver", "anticipos.ver", "planilla.ver",
    ],
    roles: ["RRHH", "CONTADOR", "ADMIN"],
    prerequisites: [
      "Empleados registrados con DNI y datos bancarios/pensionarios (ONP/AFP).",
    ],
    steps: [
      {
        title: "Registrar empleados y contratos",
        description: "Crea el expediente del trabajador en Empleados y formaliza su vínculo en Contratos indicando sueldo base, régimen pensionario y asignación familiar.",
        where: "/hr/employees y /hr/contracts",
        actionPermission: "empleados.crear",
      },
      {
        title: "Programar horarios y supervisar asistencia",
        description: "Asigna plantillas de turnos semanales en Horarios Laborales y corrige o justifica tardanzas/faltas desde Asistencia.",
        where: "/hr/schedules y /hr/attendance",
        actionPermission: "horarios.ver",
      },
      {
        title: "Aprobar vacaciones, seguros y adelantos",
        description: "Gestiona solicitudes de descanso en Vacaciones y Permisos, pólizas (SCTR/Vida Ley) y adelantos de sueldo que se descontarán en nómina.",
        where: "/hr/leaves y /hr/benefits",
        actionPermission: "vacaciones.editar",
      },
      {
        title: "Calcular, aprobar y pagar la planilla",
        description: "Genera el periodo de planilla mensual, revisa descuentos de ley (ONP/AFP), EsSalud y beneficios sociales, aprueba y contabiliza el pago.",
        where: "/hr/payroll",
        actionPermission: "planilla.crear",
      },
    ],
    tips: [
      "Al aprobar y pagar una planilla, el sistema genera automáticamente el asiento contable correspondiente si la contabilidad está integrada.",
    ],
  },
  {
    id: "tableros-y-asistente-ia",
    category: "Tableros e IA",
    title: "Tableros BI y Asistente Financiero con IA",
    summary: "Creación y consulta de tableros de indicadores personalizables y uso del asistente conversacional con dictado por voz.",
    href: "/dashboards",
    requiredPermissions: ["tableros.ver"],
    roles: ["ADMIN", "Gerencia"],
    prerequisites: [
      "Permiso de tableros habilitado o interruptores de IA configurados en Desarrollador.",
    ],
    steps: [
      {
        title: "Explorar tableros y aplicar filtros cruzados",
        description: "Abre Ver Tableros, selecciona un tablero y aplica filtros de fecha o haz clic sobre cualquier gráfico para filtrar el resto de tarjetas.",
        where: "/dashboards",
        actionPermission: "tableros.ver",
      },
      {
        title: "Editar o compartir tableros",
        description: "Desde el editor de tablero puedes arrastrar métricas, cambiar visualizaciones y generar enlaces compartidos en solo lectura.",
        where: "/dashboards/config",
        actionPermission: "tableros.editar",
      },
      {
        title: "Consultar al Asistente IA",
        description: "Usa el botón flotante del asistente para preguntar sobre ventas, compras o resultados financieros, por texto o dictado de voz.",
        where: "Widget flotante inferior derecho",
      },
    ],
    tips: [
      "Las consultas del Asistente IA respetan estrictamente los permisos del usuario conectado.",
    ],
  },
  {
    id: "seguridad-y-configuracion",
    category: "Seguridad y Ajustes",
    title: "Seguridad, Auditoría y Configuración del Restaurante",
    summary: "Administración de usuarios, roles RBAC, bitácora de auditoría, datos fiscales de la pollería, impresoras y personalización.",
    href: "/security/users",
    requiredPermissions: [
      "usuarios.ver", "roles.ver", "auditoria.ver",
      "configuracion.ver", "datos.ver", "mesas.ver", "areas.ver", "desarrollador.ver", "personalizacion.ver",
    ],
    roles: ["ADMIN"],
    prerequisites: [
      "Rol Administrador o permisos delegados de Seguridad/Configuración.",
    ],
    steps: [
      {
        title: "Gestionar usuarios y roles granulares",
        description: "Crea cuentas de acceso ligadas a empleados y asigna permisos específicos por pantalla y acción (ver, crear, editar, eliminar).",
        where: "/security/users y /security/roles",
        actionPermission: "roles.ver",
      },
      {
        title: "Auditar acciones críticas",
        description: "Revisa en Auditoría quién realizó aperturas/cierres de caja, anulaciones, cambios de permisos o modificaciones contables con fecha y hora exacta.",
        where: "/security/audit",
        actionPermission: "auditoria.ver",
      },
      {
        title: "Configurar datos fiscales, salones e impresoras",
        description: "Actualiza RUC, dirección, QR de Yape, salones, mesas, impresoras comanderas y apariencia visual del sistema.",
        where: "/settings/business, /settings/areas, /settings/printers, /settings/personalization",
        actionPermission: "datos.editar",
      },
    ],
    tips: [
      "Al agregar nuevos permisos o roles, verifica los cambios con una cuenta de prueba antes de asignarlos en producción.",
    ],
  },
];

/**
 * Filtra los instructivos del manual según los permisos activos (o un preset de previsualización).
 * Si `superuser` es true y no se eligió un preset específico, devuelve todas las secciones.
 */
export function filterManualSections(
  sections: readonly ManualSection[],
  options: {
    superuser: boolean;
    canAny: (codes: string[]) => boolean;
    previewPermissions?: readonly string[] | null;
    category?: string;
    query?: string;
  },
): ManualSection[] {
  const { superuser, canAny, previewPermissions = null, category = "Todas", query = "" } = options;
  const normalizedQuery = query.trim().toLowerCase();

  return sections.filter((section) => {
    // 1. Filtro de visibilidad por permisos (regla principal)
    const hasAccess =
      previewPermissions !== null
        ? section.requiredPermissions.length === 0 ||
          section.requiredPermissions.some((code) => previewPermissions.includes(code))
        : superuser ||
          section.requiredPermissions.length === 0 ||
          canAny([...section.requiredPermissions]);

    if (!hasAccess) return false;

    // 2. Filtro por categoría
    if (category !== "Todas" && section.category !== category) return false;

    // 3. Filtro por texto libre
    if (!normalizedQuery) return true;
    const haystack = [
      section.title,
      section.summary,
      section.category,
      ...section.roles,
      ...section.steps.map((s) => `${s.title} ${s.description} ${s.where ?? ""}`),
      ...section.tips,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

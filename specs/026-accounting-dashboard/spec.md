# Feature Specification: Dashboard Contable (Resumen Financiero)

**Feature Branch**: `026-accounting-dashboard`

**Created**: 2026-10-12

**Status**: Draft

**Input**: User description: "mostrar Dashboard contable a partir de los datos mas importantes , con recharts"

---

## Purpose

Ofrecer a los usuarios de contabilidad una **pantalla única de resumen (dashboard)** que
consolide los datos contables más importantes del negocio — ingresos, gastos, resultado,
posición de caja y movimiento de cuentas — presentados como indicadores clave (KPI) y
gráficos, para que en pocos segundos se pueda entender la salud financiera sin navegar por
los reportes detallados (balance, libro mayor, libro diario, estado de flujos).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver los indicadores clave del período (Priority: P1)

Como usuario de contabilidad, quiero abrir una pantalla de dashboard y ver de inmediato los
KPI más importantes del período seleccionado (ingresos, gastos, utilidad neta, saldo de
caja/bancos, cuentas por cobrar y por pagar, cantidad de asientos registrados), cada uno con
su comparación respecto del período anterior, para tener una radiografía financiera sin
entrar a cada reporte.

**Why this priority**: es el valor central de la feature; sin los KPI la pantalla no aporta
nada y no hay nada más que mostrar. Los gráficos (US2) y los controles de período (US3)
dependen de que los datos del resumen estén definidos y calculados.

**Independent Test**: abrir el dashboard con un período que tenga datos → todos los KPI
solicitados aparecen con valor, moneda y comparación porcentual, y cada valor coincide
exactamente con el total del reporte oficial correspondiente para ese mismo período.

**Acceptance Scenarios**:

1. **Given** existe un período contable con asientos vigentes, **When** se abre el
   dashboard, **Then** se muestran los KPI del período: ingresos, gastos, utilidad neta,
   saldo de caja y bancos, cuentas por cobrar, cuentas por pagar y número de asientos.
2. **Given** el período actual y el anterior tienen datos, **When** se visualiza un KPI,
   **Then** se muestra la variación porcentual respecto del período anterior, con
   indicador visual de aumento o disminución.
3. **Given** los datos del dashboard provienen de los mismos asientos que el balance y el
   estado de resultados, **When** se comparan los totales del dashboard con los de esos
   reportes para el mismo período, **Then** los valores son idénticos (diferencia 0).
4. **Given** un período sin movimientos, **When** se abre el dashboard, **Then** los KPI
   monetarios muestran 0 y la pantalla indica que no hay movimientos en el período, sin
   errores ni valores nulos/vacíos.
5. **Given** la carga del dashboard falla, **When** se intenta abrir, **Then** se muestra
   un mensaje de error claro con opción de reintentar y la pantalla no queda en blanco.

---

### User Story 2 - Visualizar los gráficos financieros (Priority: P2)

Como usuario de contabilidad, quiero ver gráficos que muestren la tendencia y la
composición de los datos importantes — evolución de ingresos vs. gastos en los últimos
meses, evolución de la utilidad neta, distribución de los gastos por categoría de cuenta y
las cuentas con mayor movimiento — para detectar tendencias y concentraciones de gasto que
una tabla no revela.

**Why this priority**: los gráficos amplían el valor del dashboard pero suelen depender de
los mismos datos ya consolidados en los KPI (US1); un dashboard solo con KPI sigue siendo
útil.

**Independent Test**: con al menos 3 meses de datos, abrir el dashboard → los gráficos se
renderizan con datos correctos, leyendas, ejes etiquetados y permiten explorar valores al
interactuar con ellos.

**Acceptance Scenarios**:

1. **Given** existen movimientos en 12 meses, **When** se abre el dashboard, **Then** el
   gráfico de tendencia muestra ingresos y gastos mes a mes de los últimos 12 meses (o de
   todos los meses disponibles si hay menos).
2. **Given** existen gastos registrados en distintas categorías de cuentas, **When** se
   muestra el gráfico de composición, **Then** cada categoría aparece con su monto y su
   proporción del total de gastos del período, y las proporciones suman el 100 %.
3. **Given** datos en al menos dos meses, **When** se muestra el gráfico de utilidad,
   **Then** la línea refleja ingresos menos gastos de cada mes, coincidiendo con los KPI
   agregados.
4. **Given** un período seleccionado, **When** se muestra el gráfico de cuentas con mayor
   movimiento, **Then** se listan las principales cuentas por monto movido, con su código
   y nombre.
5. **Given** un período sin datos, **When** se muestran los gráficos, **Then** cada
   gráfico muestra un estado vacío comprensible en lugar de un gráfico en blanco o roto.
6. **Given** el usuario interactúa con un elemento del gráfico (punto, barca o sector),
   **When** lo señala, **Then** se muestra el valor exacto y el período/categoría
   representado.

---

### User Story 3 - Cambiar el período y comparar (Priority: P3)

Como usuario de contabilidad, quiero elegir el período (o rango de fechas) que deseo
analizar y que el dashboard se actualice, para revisar meses cerrados o el avance del mes
en curso.

**Why this priority**: mejora mucho la utilidad, pero el dashboard puede demostrarse con
el período por defecto (periodo contable actual o últimos 12 meses).

**Independent Test**: cambiar el período seleccionado → todos los KPI y gráficos se
recalculan y muestran los datos del nuevo período, sin recargar la página completa.

**Acceptance Scenarios**:

1. **Given** el dashboard muestra un período, **When** el usuario selecciona otro período
   válido, **Then** los KPI y los gráficos se actualizan con los datos de ese período.
2. **Given** se selecciona un período, **When** se muestra el resultado, **Then** también
   se indica claramente el rango de fechas que se está visualizando.
3. **Given** se selecciona un período sin datos, **When** se actualiza, **Then** el
   dashboard muestra estados vacíos y el rango seleccionado, sin errores.
4. **Given** el usuario hace dos cambios de período rápidamente, **When** se resuelven las
   cargas, **Then** el dashboard muestra los datos del último período solicitado (no de uno
   anterior).

---

### Edge Cases

- No existen períodos contables abiertos ni asientos: el dashboard debe mostrar un estado
  inicial comprensible (sin datos) y, de ser posible, invitar a registrar asientos.
- Solo hay datos de un mes: la comparación con el período anterior no existe; los KPI
  muestran el valor actual sin comparación, con una etiqueta que lo indica.
- Asientos parciales o en estado distinto de "vigente": solo se consideran los asientos
  válidos/vigentes según las mismas reglas que usan los reportes contables existentes.
- La utilidad es negativa (pérdida): el KPI y los gráficos deben representarlo
  correctamente (color/etiqueta de pérdida), sin mostrar montos "en negativo" confusos.
- Períodos con muchos movimientos: el dashboard debe seguir cargando de forma ágil; si la
  carga tarda, mostrar indicador de progreso.
- Fallo del servicio de datos o timeout: mensaje de error con reintento, nunca una
  pantalla en blanco.
- Un solo usuario con sesión expirada al abrir el dashboard: se respeta el mismo
  comportamiento de acceso que el resto de las pantallas del módulo contable.
- Cuentas con movimiento en ambas direcciones (debe/haber): la definición de "movimiento"
  debe ser consistente con la de los reportes existentes para evitar cifras distintas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST mostrar un dashboard con, al menos, los siguientes KPI del
  período seleccionado: ingresos, gastos, utilidad neta, saldo de caja y bancos, cuentas
  por cobrar, cuentas por pagar y cantidad de asientos registrados.
- **FR-002**: Cada KPI monetario MUST mostrar la variación porcentual respecto del
  período inmediato anterior, salvo que no exista un período anterior comparable, en cuyo
   caso se indica explícitamente que no hay comparación.
- **FR-003**: El sistema MUST mostrar un gráfico de tendencia de ingresos vs. gastos de
  los últimos 12 meses (o de todos los meses con datos si son menos).
- **FR-004**: El sistema MUST mostrar un gráfico de evolución de la utilidad neta mensual.
- **FR-005**: El sistema MUST mostrar un gráfico de distribución de gastos por categoría
  de cuenta contable del período, con montos y proporciones.
- **FR-006**: El sistema MUST mostrar un gráfico de las cuentas contables con mayor
  monto movido en el período, identificadas por código y nombre.
- **FR-007**: El sistema MUST permitir seleccionar el período (o rango de fechas) a
  visualizar y actualizar todos los KPI y gráficos al cambiarlo.
- **FR-008**: El sistema MUST identificar de forma visible el rango de fechas y período
  que se está mostrando.
- **FR-009**: Los valores del dashboard MUST calcularse con los mismos criterios y
  asientos vigentes que los reportes contables existentes (balance, estado de resultados),
  de modo que las cifras coincidan exactamente para el mismo período.
- **FR-010**: Los gráficos MUST ser interactivos: al señalar un elemento se debe ver el
  valor exacto, el período o categoría representada, y las series deben tener leyenda y
  ejes etiquetados.
- **FR-011**: El sistema MUST mostrar estados de carga, vacío y error diferenciados para
  el dashboard completo y para cada bloque, con opción de reintento ante errores.
- **FR-012**: El sistema MUST mostrar importes con el formato monetario y la moneda
  utilizados por el resto del módulo contable.
- **FR-013**: El dashboard MUST respetar el mismo control de acceso que las demás
  pantallas del módulo de contabilidad.
- **FR-014**: Ante dos cambios rápidos de período, el sistema MUST mostrar siempre los
  datos del último período solicitado.

*Sin marcadores de clarificación pendientes: los puntos no especificados por el usuario
(período por defecto, comparación con período anterior, conjuntos de gráficos) se
resolvieron con los valores por defecto documentados en la sección Assumptions.*

### Key Entities *(include if feature involves data)*

- **Período contable**: intervalo de fechas sobre el que se agregan los datos; define el
  contexto de todos los KPI y gráficos.
- **Asiento contable (movimientos)**: fuente única de los datos; aporta fecha, cuenta,
  debe/haber y estado de vigencia.
- **Cuenta contable**: agrupa saldos y movimientos; alimenta los KPI de saldo
  (caja/bancos, por cobrar, por pagar) y los gráficos por categoría y por cuenta con
  mayor movimiento.
- **Indicador (KPI)**: valor agregado del período con su comparación respecto del período
  anterior.
- **Serie de datos**: secuencia mes a mes (ingresos, gastos, utilidad) que alimenta los
  gráficos de tendencia.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El usuario puede identificar la situación financiera del período
  (¿ganó o perdió, cuánto ingresó y gastó, cuánta caja tiene) en menos de 30 segundos
  desde que abre el dashboard.
- **SC-002**: El 100 % de los valores mostrados en el dashboard coincide exactamente con
  los totales de los reportes contables oficiales para el mismo período (diferencia 0).
- **SC-003**: El dashboard presenta su contenido completo en menos de 3 segundos en condiciones
  normales de uso, sin que el usuario deba navegar a otras pantallas.
- **SC-004**: El 90 % de los usuarios de contabilidad completa sin ayuda la tarea
  "responder cuál fue la utilidad del mes y de qué categoría provino el mayor gasto" en
  menos de 1 minuto.
- **SC-005**: El usuario puede cambiar de período y ver los datos actualizados sin
  recargar la página, en menos de 3 segundos por cambio.
- **SC-006**: Cero pantallas en blanco ante errores: el 100 % de los fallos de carga
  muestra un mensaje entendible y una vía de reintento.

## Assumptions

- **Alcance**: el dashboard es una pantalla de solo lectura; no registra asientos ni
  modifica datos contables.
- **Período por defecto**: al abrir el dashboard se muestra el período contable vigente
  (o, si no lo hay, los últimos 12 meses); el usuario puede cambiarlo (US3).
- **Comparación**: la comparación por defecto es contra el período inmediato anterior de
  igual duración (mes contra mes, o rango contra rango previo de igual longitud).
- **Conjunto de datos "más importantes"**: ingresos, gastos, utilidad neta, caja/bancos,
  cuentas por cobrar, cuentas por pagar y número de asientos, más los cuatro gráficos de
  FR-003 a FR-006. Este conjunto es el interpretado del pedido "datos más importantes" y
  puede ajustarse en revisión sin cambiar la estructura del dashboard.
- **Fuente única de verdad**: se reutilizan los datos y criterios de cálculo de los
  reportes contables ya existentes; no se definen nuevas reglas contables en esta feature.
- **Gráficos**: el usuario solicitó expresamente visualizar los datos con **Recharts**;
  la librería ya está incluida en el proyecto. Se documenta aquí como restricción pedida
  por el solicitante y decisión técnica, no como requerimiento funcional: los
  requerimientos solo exigen gráficos interactivos equivalentes (FR-010).
- **Acceso**: se asume el mismo acceso y roles que el resto del módulo contabilidad; no
  se definen permisos nuevos.
- **Formato monetario**: se usa la moneda y el formato ya establecidos en el módulo
  (sin definir nueva moneda ni decimales).
- **Fuera de alcance v1**: exportación/impresión del dashboard, personalización de
  widgets por usuario, alertas/notificaciones, previsión financiera y comparación entre
  empresas o sucursales.

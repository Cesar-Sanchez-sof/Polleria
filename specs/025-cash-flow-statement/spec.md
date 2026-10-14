# Feature Specification: Estado de Flujos de Efectivo (NIC 7 / PCGE 2019)

**Feature Branch**: `025-cash-flow-statement`

**Created**: 2026-10-12

**Status**: Draft

**Input**: User description: "Implementar el servicio que genera el Estado de Flujos de Efectivo (Cash Flow Statement) siguiendo la estructura de clasificación de Odoo y la normativa técnica de la NIC 7 / Plan Contable General Empresarial 2019 (Perú) mediante el Método Indirecto, con soporte para validación contra la Cuenta 10 (Caja y bancos). Tres secciones: Actividades de Operación (resultado neto + ajustes no monetarios + cambios en capital de trabajo), Actividades de Inversión (compra/venta de activos) y Actividades de Financiamiento (aportes de capital, obligaciones financieras, dividendos). Conciliación del efectivo inicial y final con el saldo real de la Cuenta 10. Tolerancia a datos incompletos (cuentas sin movimientos = 0.00) y redondeo monetario estricto a 2 decimales. Con pruebas unitarias que incluyan un caso de conciliación exitosa."

> **Procedencia**: el origen del reporte es el libro diario y los saldos contables del ERP. Los códigos de cuenta citados corresponden al PCGE 2019 (ej. 101 Caja, 104 Bancos, 12 Cuentas por cobrar, 20/24/25 Existencias, 40/41/42 Cuentas por pagar, 33 Inmuebles, maquinaria y equipo, 45 Obligaciones financieras, 50 Capital, 68 Depreciaciones, 676/776 Diferencia de cambio, 89 Resultado del ejercicio).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generar el estado de flujos de efectivo de un período (Priority: P1)

Como contador de la pollería, quiero generar el Estado de Flujos de Efectivo de un período determinado (mes, trimestre o año) mediante el Método Indirecto, para presentar a la administración y respaldar la presentación financiera bajo NIIF/PCGE: cómo se generó y en qué se aplicó el efectivo durante el periodo.

**Why this priority**: Es el estado financiero que completa el set contable junto al Estado de Situación Financiera y el Estado de Resultados. Sin él no se puede evaluar la liquidez ni presentar estados completos. Es el corazón de esta funcionalidad: si este flujo no entrega un cálculo correcto, no hay valor en el resto.

**Independent Test**: A partir de un conjunto conocido de saldos iniciales, saldos finales y movimientos de un mes de prueba, generar el estado y verificar que las tres secciones muestren los importes esperados, que los subtotales cuadren aritméticamente y que el efectivo final sea consistente con los datos de entrada.

**Acceptance Scenarios**:

1. **Given** datos completos de saldos iniciales y finales por cuenta y movimientos del período que son consistentes entre sí, **When** se genera el estado para el período, **Then** el resultado presenta las tres secciones (Operación, Inversión, Financiamiento), el flujo neto de cada una, el incremento o disminución neta de efectivo, el efectivo al inicio, el efectivo al fin y el indicador de conciliación.
2. **Given** un resultado neto positivo del período, **When** se genera el estado, **Then** la sección de Operación parte del resultado neto, le suma la depreciación y amortización del período y ajusta por la diferencia de cambio no realizada (ganancia resta, pérdida suma).
3. **Given** un aumento de las cuentas por cobrar comerciales respecto del inicio del período, **When** se genera el estado, **Then** esa variación reduce el flujo neto de operación; y si las cobranzas bajan, lo aumenta (regla inversa para las cuentas por pagar: subir suma flujo, bajar resta).
4. **Given** adquisiciones de propiedad, planta y equipo parcialmente financiadas mediante obligaciones pendientes de pago a proveedores de activos, **When** se genera el estado, **Then** la sección de Inversión reporta como salida de efectivo solo la porción efectivamente pagada, sin duplicar el flujo financiero.
5. **Given** un período con préstamos nuevos y amortizaciones de capital de obligaciones financieras, **When** se genera el estado, **Then** la sección de Financiamiento refleja los préstamos recibidos como entrada y los pagos de capital como salida, netos en el subtotal de la sección.

---

### User Story 2 - Conciliar el efectivo calculado con la Cuenta 10 (Priority: P2)

Como contador, quiero que el sistema concilie automáticamente el efectivo y equivalentes calculados contra el saldo real de la Cuenta 10 (101 Caja + 104 Cuentas corrientes bancarias, excluyendo 107 Fondos restringidos) al cierre del período, para detectar capturas erróneas, asientos faltantes o diferencias de caja antes de emitir el reporte.

**Why this priority**: La regla de integridad entre el estado calculado y el saldo real de la Cuenta 10 es lo que convierte al reporte en una herramienta confiable de auditoría; sin ella, un reporte con datos mal cargados pasaría inadvertido.

**Independent Test**: Generar el estado con datos de entrada consistentes y verificar que quede marcado como conciliado; luego provocar artificialmente una diferencia (por ejemplo, quitar un asiento que afecte la Cuenta 10) y verificar que el estado se emita igualmente pero marcado como no conciliado, con la diferencia reflejada en el efectivo final calculado.

**Acceptance Scenarios**:

1. **Given** datos donde el efectivo inicial más el flujo neto del período coincide exactamente con el saldo real de la Cuenta 10 al cierre, **When** se genera el estado, **Then** el indicador de conciliación se activa (verdadero).
2. **Given** datos donde el efectivo calculado al cierre difiere en cualquier monto del saldo real de la Cuenta 10, **When** se genera el estado, **Then** el reporte se produce completo pero el indicador de conciliación queda desactivado (falso), permitiendo al contador investigar la diferencia.

---

### User Story 3 - Reporte robusto ante datos incompletos y precisión monetaria (Priority: P3)

Como usuario del reporte, quiero que la generación nunca falle por ausencia de datos en alguna cuenta (por ejemplo, un período sin préstamos en la cuenta 45 ni compras de activos en la cuenta 33) y que todos los importes se presenten redondeados a exactamente dos decimales, para poder emitir el estado en cualquier período del histórico aunque la operación haya sido mínima.

**Why this priority**: Un reporte financiero que falla o muestra decimales espurios no es utilizable en la práctica contable diaria; esta robustez es requisito de calidad transversal del producto.

**Independent Test**: Generar el estado para un período sin movimientos en varias cuentas clave y verificar que esas líneas muestran 0.00 sin error; generar con importes de alta precisión decimal y verificar que todos los subtotales resultan con dos decimales exactos.

**Acceptance Scenarios**:

1. **Given** un período sin registros en las cuentas de obligaciones financieras (45) ni de adquisiciones de activos (33), **When** se genera el estado, **Then** las líneas correspondientes muestran 0.00, los subtotales de sección se calculan correctamente y el estado se entrega sin errores.
2. **Given** importes de entrada con más de dos decimales, **When** se genera el estado, **Then** cada subtotal y total del reporte queda redondeado estrictamente a dos decimales, sin acumulación de residuos de redondeo que alteren la conciliación.

---

### Edge Cases

- **Pérdida neta del período**: el resultado neto entra con signo negativo y la sección de Operación puede resultar negativa; el reporte debe reflejarlo sin tratarlo como error.
- **Período sin movimientos contables**: todos los renglones en 0.00, el efectivo final igual al inicial, conciliación exitosa si el saldo real de la Cuenta 10 coincide.
- **Diferencia de cambio no realizada**: una ganancia no realizada reduce el ajuste de operación; una pérdida lo incrementa, conservando la convención (±).
- **Fondos restringidos (cuenta 107)**: nunca se incluyen en el efectivo y equivalentes inicial ni final, aunque existan saldos.
- **Diferencia de conciliación detectada**: no bloquea la emisión del reporte; lo emite con el indicador desactivado.
- **Saldos ausentes de una cuenta en los datos de entrada**: se tratan como saldo 0.00 y no como error.
- **Cuentas por pagar a proveedores de activos (465) pendientes**: se descuentan de la adquisición de activos para no reportar como salida de efectivo montos aún no pagados.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema debe generar el Estado de Flujos de Efectivo para una empresa y un período determinado (fecha de inicio y fin), mediante el Método Indirecto, clasificando todos los flujos en tres secciones: Actividades de Operación, Actividades de Inversión y Actividades de Financiamiento.
- **FR-002**: La sección de Operación debe calcular: el resultado neto del período; los ajustes por partidas que no afectan el efectivo (depreciación y amortización del período, y diferencia de cambio no realizada); y los cambios en el capital de trabajo de las cuentas por cobrar comerciales (12), existencias (20, 24, 25), cuentas por pagar comerciales (42), remuneraciones por pagar (41) y tributos por pagar (40).
- **FR-003**: El sistema debe aplicar la convención de signos de capital de trabajo: para cuentas de activo, un incremento respecto del inicio del período reduce el flujo y una disminución lo aumenta; para cuentas de pasivo, un incremento aumenta el flujo y una disminución lo reduce.
- **FR-004**: La sección de Inversión debe reportar la adquisición de propiedad, planta y equipo (33) descontando las obligaciones pendientes de pago por dichas adquisiciones (465), expresada como salida de efectivo; y los cobros por venta de activos inmovilizados o desinversiones financieras (33, 30) como entradas de efectivo.
- **FR-005**: La sección de Financiamiento debe reportar los aportes de capital en efectivo (50), la obtención y amortización de obligaciones financieras (45) netas, y los pagos de dividendos o utilidades a los socios (407, 46, 59).
- **FR-006**: El sistema debe conciliar el efectivo: el efectivo al inicio corresponde al saldo neto de la Cuenta 10 (101 + 104, excluyendo expresamente 107 Fondos restringidos); el incremento o disminución neta es la suma de los flujos netos de las tres secciones; el efectivo al fin es el inicial más el incremento neto; y el estado debe indicar de forma explícita si el efectivo calculado al fin coincide con el saldo real de la Cuenta 10 al cierre del período.
- **FR-007**: El sistema debe tolerar datos incompletos: cualquier cuenta sin saldos ni movimientos en el período debe computarse como 0.00 sin interrumpir la generación del reporte.
- **FR-008**: El sistema debe redondear estrictamente a dos decimales todos los importes y subtotales del reporte, sin que la acumulación de redondeos altere la conciliación con la Cuenta 10.
- **FR-009**: El resultado debe entregar, como mínimo: el período (inicio y fin), la moneda del reporte, el desglose completo de las tres secciones con sus subtotales, el flujo neto de efectivo del período, el efectivo al inicio, el efectivo al fin y el estado de conciliación.
- **FR-010**: El cálculo debe alimentarse de datos de saldos inicial y final por cuenta contable y de los movimientos del período (débitos y créditos por cuenta) correspondientes a los códigos del PCGE; los datos ausentes se interpretan como cero (ver FR-007).

### Key Entities

- **Saldo de cuenta contable**: importe de cierre de una cuenta del PCGE al inicio y al fin del período (ej. 101, 121, 20, 421); base de los cálculos de variación.
- **Movimiento del período**: débitos y créditos acumulados de una cuenta contable dentro del rango de fechas del reporte; base del método indirecto para partidas no monetarias y del resultado neto.
- **Efectivo y equivalentes de efectivo**: saldo de Caja (101) y Cuentas corrientes bancarias (104), con exclusión explícita de Fondos restringidos (107); conecta el inicio, el flujo neto y el cierre del estado.
- **Estado de Flujos de Efectivo**: reporte de período con tres secciones de actividades, subtotales netos, efectivo inicial y final e indicador de conciliación contra la Cuenta 10.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Cuando los datos de entrada son completos y consistentes, el 100% de los estados generados cierran con el efectivo final idéntico al saldo real de la Cuenta 10 (tasa de conciliación del 100%).
- **SC-002**: El estado de un período con hasta 10,000 movimientos contables se genera en menos de 3 segundos, sin bloquear el uso del sistema.
- **SC-003**: En una batería de al menos 10 escenarios de cálculo predefinidos (período completo, período vacío, pérdida neta, préstamo financiero, adquisición de activo con pago parcial, variaciones de capital de trabajo en ambos sentidos, entre otros), el 100% de los resultados coinciden con los valores esperados a dos decimales.
- **SC-004**: Generar el estado para un período sin movimientos en ninguna cuenta arroja un resultado completo en 0.00 con conciliación exitosa, con tasa de fallos del 0%.
- **SC-005**: Cualquier diferencia entre el efectivo calculado y el saldo real de la Cuenta 10 se hace visible al contador en el 100% de los casos mediante el indicador de conciliación, sin emitir el reporte como si fuera válido.

## Assumptions

- La moneda por defecto del reporte son los soles (PEN); el dato de entrada permite identificar la moneda cuando se requiera otra.
- El resultado neto del período se determina a partir de los datos contables provistos (cuenta 89 Resultado del ejercicio); en ausencia de datos se computa como 0.00.
- Los códigos de cuenta citados siguen el Plan Contable General Empresarial 2019 de Perú; la correspondencia de cuentas se resuelve por prefijo de código (ej. toda cuenta que inicia con 12 son cuentas por cobrar comerciales).
- La obtención de los saldos y movimientos desde la base de datos contable del ERP, así como la exposición del reporte en pantallas o servicios web, forman parte de fases posteriores; esta especificación acota el comportamiento de cálculo y verificación del reporte.
- El método a usar es exclusivamente el indirecto (no se contempla el método directo) y la presentación sigue la estructura de clasificación de tres secciones usada por Odoo.
- Los aportes de capital, obligaciones financieras y dividendos se identifican por los códigos PCGE indicados en FR-005; operaciones no monetarias asociadas (ej. activos adquiridos con financiamiento total) se excluyen del efectivo por diseño.
- La verificación del comportamiento se realizará mediante pruebas automatizadas que incluyan obligatoriamente un caso de conciliación exitosa contra la Cuenta 10.

## Out of Scope

- Pantallas, reportes visuales y exportaciones (PDF/Excel) del estado de flujos de efectivo.
- Integración con presentaciones SUNAT (estados financieros en formato XFA/XFCS).
- Método directo de presentación de flujos operativos.
- Estados consolidados multi-empresa; el estado se genera para una sola empresa por ejecución.
- Distracciones no monetarias y efectos de tipo de cambio requeridos como notas complementarias de la NIC 7 (se abordarán en una fase posterior si se requiere presentación completa).

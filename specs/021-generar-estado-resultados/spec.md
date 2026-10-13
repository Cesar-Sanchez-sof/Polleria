# Feature Specification: Estado de Resultados por Función (PCGE 2019)

**Feature Branch**: `021-generar-estado-resultados`

**Created**: 2026-10-06

**Status**: Draft

**Input**: User description: "Generar el Estado de Resultados por Función (Income Statement) siguiendo la jerarquía de Odoo y las reglas de imputación del PCGE 2019 / NIIF, calculando ingresos de operación, costo de ventas, margen bruto, gastos de operación, beneficio operativo, partidas financieras, impuesto a la renta y resultado del período."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generar el estado de resultados de un periodo (Priority: P1)

Como contador, quiero obtener el Estado de Resultados de un rango de fechas (por ejemplo un mes o
un trimestre) con las líneas estándar del reporte —ingresos de operación, costo de ventas, margen
bruto, gastos de operación, beneficio operativo, partidas financieras, impuesto a la renta y
resultado del período— para informar la rentabilidad de la empresa.

**Why this priority**: es el valor central de la feature; sin el cálculo completo de las nueve
líneas no hay reporte.

**Independent Test**: Con un periodo que contiene ventas (cuenta 70) y costo de ventas (cuenta 69)
registrados, al solicitar el estado de resultados se obtienen todas las líneas con importes y el
resultado del período es ingresos de operación menos costo de ventas menos gastos de operación más
las partidas financieras.

**Acceptance Scenarios**:

1. **Given** un periodo con ventas y costo de ventas registrados, **When** se genera el reporte,
   **Then** se devuelven las nueve líneas del reporte con el periodo y la moneda, y ningún valor
   es nulo, indefinido ni faltante.
2. **Given** un periodo con datos, **When** se compara el margen bruto, **Then** este es igual a
   ingresos de operación menos costo de las ventas.
3. **Given** un periodo con datos, **When** se compara el beneficio operativo, **Then** es igual a
   margen bruto menos gastos de operación.
4. **Given** un periodo con datos, **When** se compara el resultado antes de impuestos, **Then**
   es igual a beneficio operativo más ingresos financieros menos gastos financieros más diferencia
   de cambio neta más otros ingresos y gastos.
5. **Given** un periodo con datos, **When** se compara el resultado del período, **Then** es igual
   al resultado antes de impuestos menos el gasto en impuesto sobre la renta.

---

### User Story 2 - Respetar la naturaleza contable de cada cuenta (Priority: P1)

Como contador, quiero que cada línea del reporte aplique la naturaleza correcta de las cuentas del
PCGE (las cuentas de ingreso se saldan por haber menos debe; las de costo y gasto por debe menos
haber), para que los signos del reporte sean contablemente correctos.

**Why this priority**: un signo invertido invalida el reporte completo y su uso contable; tiene la
misma urgencia que el cálculo en sí.

**Independent Test**: Con una cuenta 70 que tiene más créditos que débitos, el ingreso de operación
resulta positivo; con una cuenta 95 con más débitos que créditos, el gasto de distribución resulta
positivo y reduce el beneficio operativo.

**Acceptance Scenarios**:

1. **Given** una cuenta de ingreso (elemento 7) con saldo acreedor, **When** se calcula su
   contribución, **Then** el valor es haberes menos débitos.
2. **Given** una cuenta de costo o gasto (elementos 6 y 9) con saldo deudor, **When** se calcula su
   contribución, **Then** el valor es débitos menos haberes.
3. **Given** una cuenta de ingreso con más débitos que haberes (por ejemplo devoluciones en
   ventas), **When** se calcula, **Then** su aporte es negativo y reduce la línea que lo agrupa.
4. **Given** un periodo con resultados negativos (pérdida), **When** se genera el reporte, **Then**
   las líneas reflejan el signo negativo correspondiente sin truncarse a cero.
5. **Given** movimientos en la Cuenta 75 (alquileres u otros ingresos no principales), **When** se
   clasifican, **Then** su importe aparece en "otros ingresos y gastos" y la línea "ingresos por
   subarrendamiento y otros" queda en `0.00`.

---

### User Story 3 - Generar el reporte aunque falten cuentas (Priority: P2)

Como usuario, quiero que el reporte se genere siempre, aunque en el periodo no existan movimientos
de algunas cuentas (por ejemplo sin gastos de administración, sin partidas financieras ni impuesto
a la renta), para poder consultar periodos nuevos o incompletos sin errores.

**Why this priority**: los periodos recién iniciados o las empresas pequeñas suelen tener sólo
compras y ventas; sin tolerancia a datos incompletos el reporte sería inutilizable.

**Independent Test**: Con un periodo que sólo contiene movimientos de compra y venta, el reporte se
genera correctamente y las líneas de gastos, partidas financieras e impuesto valen `0.00`.

**Acceptance Scenarios**:

1. **Given** un periodo sin movimientos en las cuentas 94, 95, 67, 77 ni 88, **When** se genera el
   reporte, **Then** gastos de administración, gastos de distribución, gastos financieros,
   ingresos financieros y gasto por impuesto son `0.00`.
2. **Given** un periodo sin movimientos en ninguna cuenta, **When** se genera el reporte, **Then**
   se devuelve el reporte completo con todas las líneas en `0.00` y sin errores.
3. **Given** que un campo no tiene datos calculados, **When** se serializa el resultado, **Then**
   el valor es `0.00` y nunca `null`, `undefined` ni un texto.

---

### User Story 4 - Verificar el reporte contra el Balance General (Priority: P3)

Como contador, quiero que el resultado del período del Estado de Resultados coincida con el
resultado del periodo reportado por el Balance General del mismo rango, para tener coherencia entre
ambos estados financieros.

**Why this priority**: es una comprobación de calidad; no bloquea el uso del reporte pero da
confianza en los números.

**Independent Test**: Generar ambos reportes para el mismo rango de fechas y comparar el resultado
del período: la diferencia debe ser menor a un céntimo.

**Acceptance Scenarios**:

1. **Given** el mismo rango de fechas, **When** se genera el Estado de Resultados y el resultado
   del periodo del Balance General, **Then** ambos valores coinciden (diferencia menor a 0.01).
2. **Given** existen cuentas de ingreso, gasto y costo con movimientos en el rango, **When** se
   suman sus saldos con su naturaleza, **Then** la suma reproduce el resultado del período.

---

### Edge Cases

- Periodo sin movimientos: todas las líneas valen `0.00` y el reporte se devuelve completo.
- Periodo con sólo compras y ventas: ingreso de operación y costo de ventas con valor; gastos,
  partidas financieras, impuesto y las líneas derivadas en `0.00`.
- Cuentas madre sin movimientos propios pero con subcuentas con movimiento: el valor se obtiene de
  las subcuentas (los códigos de cabecera de elemento no se suman dos veces).
- Cuenta con saldo contrario a su naturaleza (por ejemplo una cuenta de gasto con saldo
  acreedor): el valor se expresa con su signo real, sin forzar a cero.
- Diferencia de cambio: cuando sólo hay saldo en 776, el valor es positivo; cuando sólo hay saldo
  en 676, es negativo; si no existe ninguno, `0.00`.
- Cuentas 776/676 excluidas de ingresos y gastos financieros para no duplicar la partida de
  diferencia de cambio.
- Devoluciones (709) y descuentos concedidos (74): se excluyen de la base de la Cuenta 70 y se
  restan una sola vez sobre los ingresos ordinarios.
- Movimientos importados con importes nulos o ausentes: se tratan como `0.00`.
- Redondeos acumulados: cada línea final se redondea a dos decimales para que las sumas y restas
  entre líneas cierren sin diferencias visibles.
- Periodo invertido (fecha final anterior a la inicial): se rechaza con un error de validación y
  no se calcula ningún importe.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema debe generar el Estado de Resultados por Función para un rango de fechas
  (fecha de inicio y fecha de fin) a partir de los movimientos contables del periodo.
- **FR-002**: El reporte debe devolver, como mínimo, los siguientes campos: periodo (inicio y fin),
  moneda, ingresos de operación (total, ordinarios, por subarrendamiento y otros), costo de las
  ventas, margen bruto, gastos de operación (total, de distribución, de administración), beneficio
  operativo, otros ingresos y gastos, diferencia de cambio neta, ingresos financieros, gastos
  financieros, resultado antes de impuestos, gasto en impuesto sobre la renta y resultado del
  período.
- **FR-003**: Ingresos de operación = ingresos ordinarios + ingresos por subarrendamiento y otros.
- **FR-004**: Ingresos ordinarios = (saldo acreedor de las cuentas de la Cuenta 70: ventas 701,
  702, 704 y las demás subcuentas de ingresos ordinarios, **sin incluir la 709**) − saldo deudor
  de la 709 (devoluciones) − saldo deudor de la 74 (descuentos concedidos). La 709 y la 74 se
  excluyen de la base para que su efecto se descuente una sola vez.
- **FR-005**: Ingresos por subarrendamiento y otros = `0.00`. La Cuenta 75 (incluida la 754,
  alquileres e ingresos operativos no principales) se clasifica íntegramente en "otros ingresos y
  gastos" (FR-015); por lo tanto esta línea del reporte no recibe importes y los ingresos de
  operación coinciden con los ingresos ordinarios.
- **FR-006**: Costo de las ventas = saldo deudor de la Cuenta 69 (691 mercaderías, 692 productos
  terminados, 693 servicios), tomado de la salida de inventario y no de la Cuenta 60 de compras.
- **FR-007**: Margen bruto = ingresos de operación − costo de las ventas.
- **FR-008**: Gastos de operación = gastos de distribución + gastos de administración.
- **FR-009**: Gastos de distribución = saldo deudor de la Cuenta 95 (personal de salón, delivery,
  empaques, comisiones).
- **FR-010**: Gastos de administración = saldo deudor de la Cuenta 94 (gerencia, alquiler,
  servicios de soporte).
- **FR-011**: Beneficio operativo = margen bruto − gastos de operación.
- **FR-012**: Diferencia de cambio neta = saldo acreedor de la subcuenta 776 − saldo deudor de la
  subcuenta 676.
- **FR-013**: Ingresos financieros = saldo acreedor de la Cuenta 77, excluyendo la 776.
- **FR-014**: Gastos financieros = saldo deudor de la Cuenta 67, excluyendo la 676.
- **FR-015**: Otros ingresos y gastos = saldo neto de (Cuenta 75 completa + Cuenta 76) −
  (Cuenta 65 + Cuenta 66). Ninguna subcuenta de la 75 se imputa a los ingresos de operación.
- **FR-016**: Resultado antes de impuestos = beneficio operativo + ingresos financieros − gastos
  financieros + diferencia de cambio neta + otros ingresos y gastos.
- **FR-017**: Gasto en impuesto sobre la renta = saldo deudor de la Cuenta 88.
- **FR-018**: Resultado del período = resultado antes de impuestos − gasto en impuesto sobre la
  renta.
- **FR-019**: Para las cuentas de ingreso (elemento 7) el saldo se calcula como haberes − débitos;
  para las cuentas de costo y gasto (elementos 6 y 9) como débitos − haberes.
- **FR-020**: Toda línea sin movimientos en el periodo debe resolver a `0.00`, sin errores y sin
  valores nulos o indefinidos.
- **FR-021**: Todos los importes finales del reporte deben expresarse con dos decimales.
- **FR-022**: El reporte debe indicar el rango de fechas consultado y la moneda.
- **FR-023**: El reporte debe aceptar el identificador de empresa (o de inquilino) y el rango de
  fechas como entrada.
- **FR-024**: El reporte debe poder construirse tanto a partir de una lista de movimientos
  contables precargados (cuenta, débito, haber) como a partir de la consulta de los movimientos
  almacenados, sin que cambien los resultados.
- **FR-025**: Sólo deben considerarse los movimientos vigentes (asientos no anulados) del rango
  consultado.
- **FR-026**: El resultado debe respetar las identidades del reporte: ingresos de operación = total
  ordinarios + subarrendamiento y otros; gastos de operación = distribución + administración; y
  las restas de margen bruto, beneficio operativo, resultado antes de impuestos y resultado del
  período.
- **FR-027**: La Cuenta 60 (compras) no debe incidir en el costo de las ventas.

### Key Entities *(include if feature involves data)*

- **Movimiento contable (partida de diario)**: cuenta, fecha, débito, haber y vigencia del asiento
  al que pertenece. Es la materia prima del reporte.
- **Cuenta contable (PCGE)**: código normalizado (elemento, grupo y subcuenta) que determina la
  naturaleza y la línea del reporte donde se imputa el saldo.
- **Estado de Resultados por Función**: reporte de periodo con periodo, moneda y las líneas
  calculadas (ingresos, costos, gastos, partidas financieras, impuesto y resultado).
- **Periodo contable**: rango de fechas consultado y estado (abierto/cerrado) que delimita los
  movimientos incluidos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de las solicitudes, incluidos periodos sin movimientos o con sólo compras
  y ventas, producen un reporte completo sin errores y sin valores nulos o indefinidos.
- **SC-002**: En el 100 % de los reportes, todas las identidades de cálculo (margen bruto,
  beneficio operativo, resultado antes de impuestos y resultado del período) se cumplen con
  diferencias menores a 0.01 por redondeo.
- **SC-003**: El 100 % de los importes publicados tienen exactamente dos decimales.
- **SC-004**: El resultado del período coincide con el resultado del periodo del Balance General
  del mismo rango con una diferencia menor a 0.01 en el 100 % de los periodos comparados.
- **SC-005**: Un contador identifica en menos de un minuto la cuenta PCGE que origina cada línea
  del reporte, sin necesidad de consultar el código fuente.
- **SC-006**: El estado de resultados de un periodo de hasta 100.000 movimientos se entrega en
  menos de 3 segundos.
- **SC-007**: En un periodo de prueba con sólo ventas y costo de ventas, las líneas de gastos,
  partidas financieras, impuesto e ingresos por subarrendamiento valen exactamente `0.00` en el
  100 % de los casos.
- **SC-008**: En el 100 % de los reportes, los ingresos por subarrendamiento y otros valen `0.00`
  y los ingresos de operación coinciden con los ingresos ordinarios calculados.

## Assumptions

- El sistema actual opera para una sola empresa: el identificador de empresa se recibe en la
  entrada por compatibilidad con una eventual multiempresa, pero no filtra los movimientos.
- El reporte sólo considera asientos vigentes (no anulados), en línea con los demás reportes
  contables del sistema.
- La moneda por defecto es el sol peruano (PEN); el sistema no maneja tipos de cambio múltiples
  en este reporte.
- Los importes se presentan con signo: una pérdida se expresa con valor negativo y nunca se
  trunca a cero.
- Las sumas se toman desde las subcuentas; las cuentas de cabecera de elemento o grupo no se
  suman junto con sus hijas para evitar doble conteo.
- La obtención de los movimientos desde el almacenamiento de datos queda fuera de este alcance:
  el reporte recibe los movimientos (o sus saldos agregados) y calcula las líneas; la consulta es
  responsabilidad de quien lo invoca.
- La exposición del reporte mediante una dirección web o una pantalla está fuera del alcance de
  esta especificación; sólo se especifica el cálculo del reporte.
- No se versiona ni se almacena el reporte generado: se calcula al momento de ser solicitado.
- El alcance de las líneas de la Cuenta 75 quedó definido con el interesado: toda la 75 se
  imputa a "otros ingresos y gastos", por lo que la línea "ingresos por subarrendamiento y otros"
  se mantiene en la salida con valor `0.00` (los ingresos de operación equivalen a los ingresos
  ordinarios).

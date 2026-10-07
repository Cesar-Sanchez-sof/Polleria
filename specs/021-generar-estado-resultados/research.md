# Phase 0 — Research: Estado de Resultados por Función (PCGE 2019)

**Feature**: `021-generar-estado-resultados` | **Date**: 2026-10-06

No quedan `NEEDS CLARIFICATION` en el *Technical Context* del plan (lenguaje, dependencias,
almacenamiento, pruebas y plataforma se derivan del repositorio). Las decisiones abiertas eran de
**diseño y dominio**, y se resuelven aquí.

---

## D1 — Estructura: cálculo puro + orquestador

**Decision**: separar en dos módulos: `lib/accounting/income-statement.ts` (función pura, sin
Prisma, que recibe saldos por cuenta y devuelve `IncomeStatementResult`) y
`lib/services/income-statement.service.ts` (valida la entrada, obtiene los saldos y llama al
cálculo).

**Rationale**: es exactamente el patrón probado del Balance General
(`lib/accounting/balance-sheet.ts` es puro y `app/api/balance-sheet/route.ts` hace la consulta).
El cálculo puro permite probar las 27 reglas con datos literales y fixtures, sin base de datos, y
hace posible reutilizarlo más adelante desde una ruta HTTP o desde un script.

**Alternatives considered**:
- *Un sólo archivo con consulta y cálculo juntos*: más simple de escribir, pero obliga a mockear
  Prisma para probar cada fórmula; ya se probó el enfoque opuesto en `balance-sheet` y funcionó.
- *Cálculo dentro de una ruta HTTP*: imposible de reutilizar y fuerza el endpoint que la spec
  declara fuera de alcance.

---

## D2 — Ruta del servicio y riesgo de importación desde el cliente

**Decision**: crear `lib/services/income-statement.service.ts` (ruta pedida en la descripción)
como módulo **server-only**: importa `@/lib/prisma`, sólo puede consumirlo código de servidor.
El contrato de tipos (`IncomeStatementResult`, `IncomeStatementInput`) se re-exporta desde
`lib/accounting/income-statement.ts`, que es seguro para el cliente.

**Rationale**: se respeta el pedido literal sin romper el build; el módulo de tipos puro evita que
un componente de interfaz necesite importar el servicio (y arrastrar Prisma al bundle del
navegador).

**Alternatives considered**:
- *Poner todo en `lib/accounting/income-statement.ts` y no crear `lib/services/…`*: rompe el
  nombre de archivo pedido.
- *Poner el servicio en `lib/services/` como los servicios front-end (fetch)*: no aplica, porque
  no hay endpoint HTTP todavía (fuera de alcance en la spec).

---

## D3 — Fuente de datos real (no existe `journal_items` ni `account_move_lines`)

**Decision**: leer los movimientos de `journal_entry_detail` unida a `journal_entry`, agregando
por cuenta con `groupBy`, exigiendo `entry.status = true` y `entry.entryDate` dentro del rango
(ambos inclusive). Los saldos por cuenta resultantes se alimentan al cálculo puro.

**Rationale**: es la única tabla de movimientos del modelo (`prisma/schema.prisma` → modelos
`JournalEntry` y `JournalEntryDetail`) y es la misma fuente, filtros y agregación que usa
`app/api/balance-sheet/route.ts`, con lo que ambos estados financieros quedan coherentes
(requisito SC-004).

**Alternatives considered**:
- *Migrar/crear una tabla `journal_items`*: innecesaria y fuera de alcance (no hay migración en
  esta feature).
- *Leer por cada línea de detalle fila a fila*: 100.000 filas transferidas al servidor Node;
  inviable frente a SC-006. Se descarta en favor de un `groupBy` agregado.

---

## D4 — Clasificación de cuentas: por código (prefijo PCGE), no por `type`

**Decision**: decidir a qué línea pertenece cada saldo mediante el **código** de la cuenta
(prefijos `70`, `709`, `74`, `75`, `76`, `65`, `66`, `69`, `94`, `95`, `77`, `776`, `67`, `676`,
`88`), y la naturaleza por el primer dígito (elemento): `7` → acreedora (haber−debe); `6` y `9` →
deudora (debe−haber).

**Rationale**: las reglas de la spec están escritas en términos de códigos PCGE, no del campo
`type` de la base; además el campo `type` no distingue subcuentas de un mismo elemento (776 vs
77, 676 vs 67) que la spec sí separa.

**Alternatives considered**:
- *Usar `type` ("Ingreso"/"Gasto"/"Costo")*: insuficiente para excluir 776/676 y para ubicar 709
  dentro de la 70 (aunque sirve como contraste en las pruebas).
- *Mapeo mediante tabla de configuración en BD*: más flexible, pero añade una entidad y una
  migración para un reporte fijo por norma.

---

## D5 — Reglas de inclusión/exclusión de códigos (matriz efectiva)

**Decision**: aplicar la siguiente matriz, respetando las decisiones del interesado
(Q1 = opción A, Q2 = opción C):

| Línea del reporte | Incluye | Excluye |
|---|---|---|
| Ingresos ordinarios | `70x` (701, 702, 703, 704, …) | `709` y `74` (se restan aparte, una sola vez) |
| Subarrendamiento y otros | — (siempre `0.00`) | toda la 75 |
| Costo de ventas | `69x` (691, 692, 693) | `60` (compras), nunca se usa |
| Gastos de distribución | `95x` | — |
| Gastos de administración | `94x` | — |
| Ingresos financieros | `77x` | `776` |
| Gastos financieros | `67x` | `676` |
| Diferencia de cambio | `776` (acreedor) y `676` (deudor) | — |
| Otros ingresos y gastos | `75` completa + `76` | resta `65` + `66` |
| Impuesto a la renta | `88` | — |

**Rationale**: evita doble conteo (709 dentro de 70; 776 dentro de 77; 676 dentro de 67) y
evita que la 75 aparezca en dos líneas (la contradicción resuelta con Q2 = C).

**Alternatives considered**: una lectura literal de la fórmula descrita en la spec, que
descuenta 709 dos veces y duplica la 75 — descartada por el propio interesado.

---

## D6 — Cuentas cabecera vs. subcuentas (doble conteo)

**Decision**: incluir en el agregado toda cuenta cuyo código tenga longitud ≥ 2 (la misma regla
que `isDetailAccount()` en `balance-sheet.ts`) y excluir **sólo** las cabeceras de elemento de 1
dígito (`6`, `7`, `9`, …). Los prefijos se evalúan sobre el código completo de la cuenta.

**Rationale** (verificado en `prisma/seed-accounts.ts` durante la implementación): en este plan
contable **ninguna cuenta de 2 dígitos tiene hijos**: `parentId` de `701`, `704` y `691` apunta
directamente al elemento (`7`, `6`), así que `70`, `69`, `94`, `95` y `88` son cuentas hoja reales
con movimientos propios. Además, cada movimiento pertenece a una única cuenta: agrupar por prefijo
suma cada saldo exactamente una vez, por lo que no puede haber doble conteo.

**Alternatives considered**: excluir los códigos de 2 dígitos por ser "cabeceras de grupo" —
descartada tras verificar el catálogo (quedarían vacías la Cuenta 70 y las líneas 94/95/88);
confiar en `parentId` para poblar sólo hojas — depende de que el dato esté completo en BD y
complica el cálculo puro (que recibe códigos, no árbol).

**Hallazgo de datos (no es un defecto del cálculo)**: el catálogo sembrado no incluye las cuentas
`94`, `95`, `88`, `75`, `77x` ni `776`/`676`, porque hoy los gastos se registran en `62x`/`63x` y
los ingresos financieros en `77x` no existen (`673` sí, y sí alimenta *gastos financieros*). Mientras
esas cuentas no se creen en el plan contable, las líneas gastos de distribución/administración,
impuesto a la renta, otros ingresos y otros ingresos financieros resolverán `0.00` — comportamiento
esperado por FR-020 y no por la regla de clasificación D5.

---

## D7 — Redondeo y comparaciones

**Decision**: `round2(n) = Math.round(n * 100) / 100` aplicado a **cada línea final** (igual que
`balance-sheet.ts`), y tolerancia `0.005` para las comparaciones de las identidades del reporte.
`Number.EPSILON` se reserva para detectar errores de coma flotante en sumas acumuladas, no como
método de redondeo (redondear con `+ Number.EPSILON` no garantiza 2 decimales).

**Rationale**: SC-003 exige exactamente dos decimales en todos los importes publicados; el
redondeo intermedio evita que las identidades (SC-002) se desincronicen por acumulación de
decimales binarios.

**Alternatives considered**: redondear sólo al final — acumula errores visibles en la suma de
muchas cuentas; `toFixed()` — devuelve cadena y obliga a reconvertir en cada línea.

---

## D8 — Entrada multiempresa (`companyId` / `tenantId`)

**Decision**: la entrada acepta `companyId`/`tenantId` opcional y **no filtra** con él: el modelo
actual no tiene entidad de empresa ni columna de tenant en las tablas contables (verificado en
`prisma/schema.prisma`). Se documenta como parámetro reservado para una futura multiempresa.

**Rationale**: cumple FR-023 sin mentir sobre el alcance real, y evita una migración que la spec
no incluye.

**Alternatives considered**: eliminar el campo del contrato (rompe el formato de salida pedido);
agregar columna de tenant a las tablas contables (migración fuera de alcance).

---

## D9 — Periodo invertido y validación de entrada

**Decision**: validar fecha inicial ≤ fecha final y formato `AAAA-MM-DD`; si falla, devolver un
error de validación legible (patrón `ErrorUsuario`/respuesta `400` del repo) sin calcular
importes.

**Rationale**: comportamiento definido en *Edge Cases* de la spec; consistente con
`app/api/balance-sheet/route.ts`, que responde `400` con mensaje en español.

---

## D10 — Estrategia de pruebas

**Decision**: dos niveles, ambos con Vitest:
1. `lib/accounting/income-statement.test.ts` — fixtures literales (sin Prisma) que cubren las
   identidades, la naturaleza contable, la tolerancia a datos incompletos y la matriz D5.
2. Pruebas del servicio con `vi.mock("@/lib/prisma")` (mismo estilo que
   `app/api/journal-entries/route.test.ts`) para verificar filtros de fechas, `status = true`,
   redondeo de agregados y el caso "sin movimientos".

**Rationale**: cubre SC-001 a SC-004 y SC-007/SC-008 sin necesidad de levantar la base de datos;
el repo ya usa exactamente esta combinación.

**Alternatives considered**: pruebas de integración con BD real — requeriría infraestructura de
base de datos en CI y no está en el patrón actual del proyecto.

---

## D11 — Alcance: sin endpoint HTTP

**Decision**: no se crea `app/api/income-statement` en esta iteración; el reporte se valida
mediante pruebas automatizadas. El endpoint se deja como trabajo posterior explícito.

**Rationale**: la spec declara la exposición web fuera de alcance (Supuestos), por lo que crear
una ruta sería violar el alcance aprobado.

**Alternatives considered**: crear la ruta "por si acaso" — genera código sin validación de
alcance y documentación Swagger pendiente.

---

## Resolución de unknowns

| Unknown del Technical Context | Estado |
|---|---|
| Language / Dependencies / Storage / Testing / Platform | Resueltos del repositorio (ver Technical Context) |
| Fuente de movimientos | **D3** |
| Reglas de clasificación de cuentas | **D4**, **D5**, **D6** |
| Redondeo | **D7** |
| Multiempresa | **D8** |
| Validación de entrada | **D9** |
| Pruebas | **D10** |
| Alcance (endpoint) | **D11** |

**Ningún `NEEDS CLARIFICATION` queda pendiente.**

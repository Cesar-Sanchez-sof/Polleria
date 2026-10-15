# Research: Normativa peruana para generar archivos PLE (SUNAT)

**Feature**: `039-ple-sunat-generation` · **Fecha de investigación**: 2026-10-14

Este documento recoge la normativa que gobierna los archivos TXT del Programa de
Libros Electrónicos (PLE / SLE-PLE) y las decisiones de implementación que se
derivan. Cada dato indica su **fuente** y su **nivel de confianza**:

- **[OFICIAL]** leído directamente del anexo PDF publicado por SUNAT.
- **[SECUNDARIA]** leído en una fuente que reproduce el layout de SUNAT (TOTVS,
  Noticiero Contable, PerúContable). Coincide con el texto oficial, pero hay que
  validarlo con el validador PLE.
- **[POR VALIDAR]** dato que no pude confirmar en fuente oficial; se implementa
  como constante configurable y se valida con el Validador PLE antes de producción.

---

## 1. Marco legal

| Norma | Qué regula |
|---|---|
| RS 234-2006/SUNAT | Información mínima y formatos impresos de libros y registros (formatos 1.1, 1.2, 5.1, 5.2, 6.1, 8.1, 14.1…). |
| RS 286-2009/SUNAT | Crea el SLE-PLE y su **Anexo 2** (estructura de los TXT) y **Anexo 3** (tablas de códigos). |
| RS 196-2010, 329-2010 | Sustituyen/modifican el Anexo 2. El 329-2010 incluye el ejemplo de nombre de archivo. |
| RS 361-2015/SUNAT | **Anexo 1 = estructura 14.1/14.2 (Ventas)**, **Anexo 2 = estructura 8.1/8.2/8.3 (Compras)** — PLE v5.0. [OFICIAL] |
| RS 042-2021/SUNAT | Reemplaza el campo 9 de 14.1 (consolidación diaria de boletas, tipos 00/03/12/13/18/87/88). [OFICIAL] |
| RS 112-2021/SUNAT | Crea el **SIRE – módulo RVIE** y el Código de Anotación de Registro (CAR); modifica el campo 20 de los ítems 5.1 y 5.2 del Anexo 2. [OFICIAL] |
| RS 000040-2022/SUNAT y posteriores | SIRE – módulo RCE (compras) y cronograma de obligatoriedad. [SECUNDARIA] |
| RS 000240-2025 y 000257-2025 | Plazos máximos de atraso de Inventarios y Balances, Diario y Mayor. [SECUNDARIA] |

## 2. PLE vs SIRE (decisión de alcance)

- **SIRE sustituye al PLE únicamente para el Registro de Ventas e Ingresos (14.1) y el
  Registro de Compras (8.1/8.2)**. Los libros contables (Diario 5.1, Mayor 6.1, Plan
  de cuentas 5.3, Caja y Bancos 1.1/1.2, Inventarios, etc.) **siguen en el PLE**.
  [SECUNDARIA, consistente con RS 112-2021]
- Para un mismo periodo, PLE y SIRE son **excluyentes** para ventas/compras.
- Obligatoriedad escalonada (jul-2023 → ene-2025 Régimen General, RER y MYPE; PRICOS
  ene/oct-2026). Hay discrepancias entre blogs → confirmar en la resolución vigente.
- El Diario 5.1 **referencia** ventas/compras mediante el *dato estructurado* (campo
  20), por lo que el 14.1/8.1 sigue siendo útil como modelo interno aunque la
  presentación se haga por SIRE.

**Decisión**: construir un **modelo canónico** de registro de ventas y de compras
(`SalesRegisterRow`, `PurchaseRegisterRow`) del que se derivan (a) el TXT PLE 14.1/8.1
(esta feature) y (b) el archivo plano RVIE/RCE de SIRE (feature futura). Así el
trabajo de mapeo de datos del ERP se hace una sola vez.

## 3. Reglas generales del archivo TXT

| Regla | Valor | Confianza |
|---|---|---|
| Separador de campos | `|` (palote, ASCII 124) | OFICIAL |
| Cada registro termina con `|` tras el último campo, luego salto de línea | práctica del PLE; el anexo dice "no incluya ni la información ni los palotes" para campos de libre utilización, es decir, los palotes cuentan | SECUNDARIA / POR VALIDAR (CRLF) |
| Campos opcionales vacíos | se escriben vacíos entre palotes (`||`) | OFICIAL |
| Decimales | hasta 12 enteros y 2 decimales, **punto** decimal, **sin separador de miles** | OFICIAL |
| Tipo de cambio | 1 entero + 3 decimales (`#.###`) | OFICIAL |
| Fechas | `DD/MM/AAAA` | OFICIAL |
| Periodo (campo 1) | `AAAAMM00` en libros mensuales; `AAAA0000` en Inventarios (anual) | OFICIAL |
| Carácter `&` | **prohibido** en CUO y correlativo (se usa como separador del dato estructurado) | OFICIAL |
| Codificación | ANSI (Windows-1252) es la usada por el PLE; **UTF-8 sin BOM** es el riesgo si hay tildes/ñ | POR VALIDAR → configurable |
| Una fila vacía/sin movimiento | libro "sin información": nombre con indicador de contenido `0` y archivo con una única línea mínima según libro | POR VALIDAR |

### 3.1 Nombre del archivo (33 caracteres + `.TXT`)

```
LE RRRRRRRRRRR AAAA MM DD LLLLLL OO I C M G .TXT
```

| Pos. | Campo | Valores |
|---|---|---|
| 1–2 | `LE` | fijo |
| 3–13 | RUC | 11 dígitos |
| 14–17 | Año | `AAAA` |
| 18–19 | Mes | `MM` (en Inventarios y Balances: mes de cierre) |
| 20–21 | Día | `00` salvo Libro de Inventarios y Balances |
| 22–27 | Código de libro | ver §3.2 |
| 28–29 | Código de oportunidad de presentación | `00` (solo Inventarios y Balances usa otros) |
| 30 | Indicador de operaciones | `1` empresa operativa · `2` cierre del libro (no obligado) · `0` cierre de operaciones/baja RUC |
| 31 | Indicador de contenido | `1` con información · `0` sin información |
| 32 | Indicador de moneda | `1` soles · `2` dólares |
| 33 | Generado por | `1` PLE (programa/validador) · `2` Portal SUNAT |

Fuente: PerúContable (RS 286-2009 modificado por 361-2015), sunatin, TOTVS. [SECUNDARIA]
Ejemplo (Ventas, octubre 2026, RUC 20608976543):
`LE2060897654320261000140100001111.TXT` = `LE` + `20608976543` + `2026` + `10` + `00` + `140100` + `00` + `1111`.

### 3.2 Códigos de libro

| Formato | Libro | Código | Confianza |
|---|---|---|---|
| 14.1 | Registro de Ventas e Ingresos | `140100` | OFICIAL (RS 361-2015, TOTVS, PerúContable) |
| 14.2 | Ventas simplificado | `140200` | SECUNDARIA |
| 8.1 | Registro de Compras | `080100` | OFICIAL |
| 8.2 | Compras – no domiciliados | `080200` | OFICIAL (citado en dato estructurado 5.1) |
| 8.3 | Compras simplificado | `080300` | SECUNDARIA |
| 5.1 | Libro Diario | `050100` | SECUNDARIA (sunatin) |
| 5.2 | Libro Diario simplificado | `050200` | SECUNDARIA |
| 5.3 | Diario – detalle del plan contable utilizado | `050300` | SECUNDARIA |
| 6.1 | Libro Mayor | `060100` | SECUNDARIA (RS 329-2010) — *un blog indica 120000; es un error de ese blog, 12.1 = inventario* |
| 1.1 | Caja y Bancos – efectivo | `010100` | SECUNDARIA |
| 1.2 | Caja y Bancos – cuenta corriente | `010200` | SECUNDARIA |
| 3.1/3.17/3.20 | Estados financieros | `030100`/`031700`/`032000` | POR VALIDAR |
| 12.1 / 13.1 | Inventario permanente (unidades / valorizado) | `120100` / `130100` | SECUNDARIA |

Se centralizan en `lib/ple/constants.ts` para corregirlos en un solo lugar.

## 4. Estructura 14.1 – Registro de Ventas e Ingresos [OFICIAL, RS 361-2015 Anexo 1 + 042-2021]

35 campos obligatorios en estructura (el 35–68 son de libre utilización y **no se emiten**).

| # | Campo | Formato / regla clave |
|---|---|---|
| 1 | Periodo | `AAAAMM00`; llave |
| 2 | CUO | ≤40, sin `&`; llave. Es el código del asiento del Diario |
| 3 | Correlativo del asiento | 2–10, inicia con `A`/`M`/`C`; sin `&` (obligatorio si campo 34 = 8/9, pero el 5.1 lo usa en el dato estructurado ⇒ **siempre se emite**) |
| 4 | Fecha de emisión | `DD/MM/AAAA`; obligatoria salvo estado 2 |
| 5 | Fecha de vencimiento / pago | solo obligatoria con tipo 14 |
| 6 | Tipo de comprobante (Tabla 10) | 2 dígitos |
| 7 | Serie | ≤20 |
| 8 | Número (o número inicial de tickets) | ≤20 |
| 9 | Número final (consolidación) | solo tipos 00/03/12/13/18/87/88; boletas ≥ S/700 se detallan |
| 10 | Tipo doc. identidad del cliente | Tabla 2 (1 DNI, 6 RUC, 4 CE, 7 pasaporte, 0 sin RUC no domiciliado). Opcional si boleta < S/700 |
| 11 | Número doc. identidad | ≤15 |
| 12 | Razón social / apellidos y nombres | ≤100 |
| 13 | Valor facturado de exportación | 12,2 |
| 14 | **Base imponible gravada** | 12,2 (excluye ISC) |
| 15 | Descuento de la base imponible | negativos |
| 16 | **IGV / IPM** | negativos permitidos |
| 17 | Descuento del IGV/IPM | |
| 18 | Operación exonerada | |
| 19 | Operación inafecta | |
| 20 | ISC | |
| 21 | Base imponible arroz pilado (IVAP) | solo tipo 49 |
| 22 | IVAP | solo tipo 49 |
| 23 | Otros conceptos / cargos no parte de la base | |
| 24 | **Importe total** | |
| 25 | Moneda (Tabla 4) | `PEN`, `USD`… |
| 26 | Tipo de cambio | `#.###`; obligatorio si campo 25 tiene dato |
| 27–30 | Documento que se modifica (fecha, tipo, serie, número) | obligatorios con tipo 07/08/87/88 |
| 31 | Identificación de contrato (consorcios) | vacío |
| 32 | Error tipo 1 (T/C inconsistente) | vacío si no aplica |
| 33 | Cancelado con medio de pago | `1` si se canceló con medio de bancarización; si no, vacío |
| 34 | **Estado** | `0` anotación optativa · `1` operación del periodo (y NC/ND emitidas) · `2` documento inutilizado/anulado antes de entregarse · `8` omitido de periodo anterior · `9` rectifica periodo anterior |

Reglas de consistencia: si Periodo = periodo informado ⇒ campo 34 ∈ {0,1,2}; si es menor
⇒ campo 34 ≠ 1.

**Documento anulado (estado 2)**: se emite con tipo/serie/número y estado `2`; fecha
de emisión, cliente e importes quedan vacíos o en `0.00`.

## 5. Estructura 8.1 – Registro de Compras [OFICIAL, RS 361-2015 Anexo 2]

41 campos (42–82 libre utilización, no se emiten).

| # | Campo | # | Campo |
|---|---|---|---|
| 1 | Periodo `AAAAMM00` | 22 | Otros conceptos/tributos/cargos |
| 2 | CUO | 23 | **Importe total** (= suma campos 14 a 22) |
| 3 | Correlativo asiento (A/M/C…) | 24 | Moneda (Tabla 4) |
| 4 | Fecha de emisión (obligatoria) | 25 | Tipo de cambio |
| 5 | Fecha de vencimiento (oblig. si tipo 14) | 26–28 | Fecha, tipo y serie del doc. que se modifica |
| 6 | Tipo de comprobante (no permite 91, 97, 98) | 29 | Código dependencia aduanera (DUA/DSI) |
| 7 | Serie (o dependencia aduanera en DUA/DSI) | 30 | Número del doc. que se modifica |
| 8 | Año de emisión DUA/DSI | 31 | Fecha constancia de depósito de detracción |
| 9 | **Número** del comprobante | 32 | Número de constancia de detracción |
| 10 | Número final (consolidado) | 33 | Marca de comprobante sujeto a retención |
| 11 | Tipo doc. identidad del proveedor | 34 | Clasificación de bienes y servicios (Tabla 30, >1500 UIT) |
| 12 | RUC / documento del proveedor | 35 | Identificación de contrato (consorcios) |
| 13 | Razón social del proveedor | 36–39 | Errores tipo 1–4 (inconsistencias) |
| 14 | **Base imponible** adq. gravadas con crédito, destinadas a operaciones gravadas | 40 | Cancelado con medio de pago |
| 15 | IGV de la base del campo 14 | 41 | **Estado** |
| 16 | Base: gravadas/no gravadas mixtas | | |
| 17 | IGV del campo 16 | | |
| 18 | Base: adq. gravadas **sin** derecho a crédito | | |
| 19 | IGV del campo 18 | | |
| 20 | Valor de adquisiciones no gravadas | | |
| 21 | ISC deducible | | |

**Estado (campo 41)**: `0` no da derecho a crédito fiscal · `1` anotado en el periodo de
emisión/pago y da derecho a crédito · `6` emisión anterior al periodo, anotado dentro de
los 12 meses · `7` emisión anterior al periodo, fuera de los 12 meses · `9` rectificación
de periodo anterior. Reglas: periodo = informado ⇒ {0,1}; periodo menor ⇒ {6,7,9}.

Para este ERP: facturas (01) del proveedor con IGV ⇒ campos 14/15, estado `1`/`6`/`7`.
Boletas (03) y otros sin derecho a crédito ⇒ importe en campo 20, estado `0`.

## 6. Estructura 5.1 – Libro Diario [SECUNDARIA, coincide con Anexo 2 RS 286-2009 (mod. 112-2021)]

21 campos (22–44 libre utilización, no se emiten). **6.1 Libro Mayor tiene exactamente la misma estructura**; cambia el orden (por cuenta) y el código de libro.

| # | Campo | Formato |
|---|---|---|
| 1 | Periodo | `AAAAMM00` |
| 2 | **CUO** | ≤40; identifica el asiento |
| 3 | Correlativo del asiento | 2–10; `A` apertura, `M` movimientos/ajustes, `C` cierre. En la práctica es `M1…Mn`, una por línea del asiento |
| 4 | Código de cuenta contable | ≤24, numérico, debe existir en el 5.3 |
| 5 | Unidad de operación | opcional |
| 6 | Centro de costos | opcional |
| 7 | Moneda de origen | Tabla 4 (`PEN`) |
| 8 | Tipo doc. identidad del emisor | opcional |
| 9 | Número doc. identidad del emisor | opcional |
| 10 | Tipo de comprobante (Tabla 10) | obligatorio (`00` si no hay) |
| 11 | Serie | opcional |
| 12 | Número del comprobante | obligatorio |
| 13 | Fecha contable | `DD/MM/AAAA` |
| 14 | Fecha de vencimiento | opcional |
| 15 | Fecha de la operación/emisión | obligatoria |
| 16 | Glosa | obligatoria, ≤200 |
| 17 | Glosa referencial | opcional |
| 18 | **Debe** | ≥0, 12,2 |
| 19 | **Haber** | ≥0; excluyente con el 18 |
| 20 | **Dato estructurado** | `140100&AAAAMM00&CUO&M#` o `080100&…`/`080200&…`; obligatorio si el asiento es de compra/venta no consolidado (≤92 chars) |
| 21 | Estado | `1` periodo · `8` omitido · `9` ajuste de periodo anterior |

Regla de cuadre: la suma del Debe de las filas con estado `1` **debe igualar** la suma del Haber.

*RS 112-2021 modifica el campo 20* para incorporar el **CAR** cuando la venta proviene del
módulo RVIE (SIRE). Hasta que se integre SIRE, el CAR no existe, así que se emite el dato
estructurado clásico. [POR VALIDAR el formato exacto del Anexo B de la RS 112-2021]

## 7. Estructura 5.3 – Plan de cuentas utilizado [SECUNDARIA]

8 campos (9–16 libre utilización): 1 Periodo · 2 Código de cuenta (desde 3 dígitos hasta
el máximo nivel) · 3 Descripción (≤100) · 4 Código del plan (Tabla 17: `01` PCGE, `02`
PCG revisado, `99` otros) · 5 Descripción del plan (obligatoria si 99) · 6 Cuenta
corporativa · 7 Descripción corporativa · 8 Estado (`1` informada en el periodo · `8` omitida
· `9` corrige).

## 8. Estructura 1.1 – Caja y Bancos, movimientos del efectivo [SECUNDARIA]

19 campos (20–38 libre utilización): 1 Periodo · 2 CUO · 3 Correlativo · 4 Cuenta del
efectivo (101x) · 5 Unidad de operación · 6 Centro de costos · 7 Moneda · 8 Tipo de
comprobante · 9 Serie · 10 Número · 11 Fecha contable · 12 Fecha de vencimiento · 13 Fecha
de la operación · 14 Glosa · 15 Glosa referencial · 16 Debe · 17 Haber · 18 Dato
estructurado · 19 Estado.

El formato **1.2** (cuenta corriente, código de entidad financiera, medio de pago Tabla 1…)
queda **fuera de esta entrega**: no se pudo confirmar su layout en fuente oficial.

## 9. Tablas de códigos usadas (Anexo 3, RS 286-2009) 

- **Tabla 10 (tipo de comprobante)**: `00` Otros · `01` Factura · `03` Boleta de venta ·
  `07` Nota de crédito · `08` Nota de débito · `09` Guía de remisión remitente · `12` Ticket ·
  `14` Recibo de servicios públicos · `50`/`52` DUA/DSI · `91`/`97`/`98` no domiciliados.
- **Tabla 2 (documento de identidad)**: `0` doc. trib. no domiciliado sin RUC · `1` DNI ·
  `4` carné de extranjería · `6` RUC · `7` pasaporte · `A` cédula diplomática.
- **Tabla 4 (moneda)**: ISO 4217 (`PEN`, `USD`).
- **Tabla 17 (plan de cuentas)**: `01` PCGE.

## 10. Obligatoriedad y plazos (referencial)

- PLE obligatorio para sujetos con ingresos brutos anuales > 500 UIT (Régimen General y
  Régimen Especial con esa condición) y principales contribuyentes; hay plazos por
  último dígito de RUC. Los plazos máximos de atraso del Diario/Mayor/Inventarios están
  en las RS 000240-2025 y 000257-2025. **La app no calcula plazos**; solo genera archivos.
- El archivo generado **no se envía a SUNAT**: se importa al PLE, que lo valida y produce
  el *Resumen* (hash) que sí se presenta por SOL.

## 11. SIRE (siguiente fase) – lo ya investigado

- Módulo **RVIE**: SUNAT propone el registro desde el día 2 de cada mes con los CPE
  electrónicos; el contribuyente puede comparar y reemplazar mediante un **archivo plano**
  (Anexo 3 de la RS 112-2021: campos RUC, razón social, periodo `YYYYMM`, **CAR**, fecha
  emisión, fecha vcto, tipo CP, serie, número, … importes) y gestionar ajustes posteriores.
- Hay API REST de SUNAT (OAuth2 con *client_id/secret* generados en SOL) para descargar
  propuesta, reemplazar y aceptar; se documentará en una feature propia
  (`040-sire-integration`). El modelo canónico de §2 está diseñado para alimentarla.

## 12. Decisiones

| # | Decisión | Motivo |
|---|---|---|
| D1 | Librería pura `lib/ple/**` sin Prisma, con tests unitarios | Reglas fiscales verificables sin base de datos; mismo patrón que `lib/accounting/*` |
| D2 | Un *serializer* genérico guiado por la definición de campos (longitud, tipo, obligatoriedad) | La definición es la fuente de verdad (§4–§8) y se valida antes de escribir |
| D3 | Validación estricta previa: el generador devuelve **errores/advertencias por registro** y no entrega un TXT inválido | El PLE rechaza el archivo completo ante un solo error |
| D4 | Códigos de libro, codificación y terminador en `constants.ts` | Datos marcados *POR VALIDAR* |
| D5 | CUO = `JournalEntry.code`, saneado | Es la clave única del software contable (requisito del campo 2) |
| D6 | Moneda única `PEN`, tipo de cambio vacío | El ERP solo opera en soles |
| D7 | Importes con aritmética en céntimos enteros | Evita errores binarios al sumar y garantiza el cuadre Debe = Haber |
| D8 | No se tocan los flujos de venta/compra | La feature es de solo lectura sobre datos existentes |

## 13. Fuentes

- SUNAT, [Anexo 1 RS 361-2015 (14.1)](https://www.sunat.gob.pe/legislacion/superin/2015/anexo1-361-2015.pdf) y [Anexo 2 RS 361-2015 (8.1)](https://www.sunat.gob.pe/legislacion/superin/2015/anexo2-361-2015.pdf)
- SUNAT, [Anexo RS 042-2021](https://www.sunat.gob.pe/legislacion/superin/2021/anexo-042-2021.pdf), [RS 112-2021](https://www.sunat.gob.pe/legislacion/superin/2021/112-2021.pdf) y [Anexos RS 112-2021](https://www.sunat.gob.pe/legislacion/superin/2021/anexo-112-2021.pdf)
- SUNAT, [Anexo RS 315-2018](https://www.sunat.gob.pe/legislacion/superin/2018/anexoI-315-2018.pdf), [RS 196-2010](https://www.sunat.gob.pe/legislacion/superin/2010/196-10.pdf)
- TOTVS, layouts Libro Diario 5.1/5.3, Libro Mayor 6.1 y Caja y Bancos 1.1 (reproducen el Anexo 2)
- PerúContable, [Generación de archivos para libros electrónicos](https://www.perucontable.com/contabilidad/generacion-de-archivos-para-libros-electronicos/)
- Noticiero Contable, [Libro Diario 5.1–5.3](https://noticierocontable.com/ple-5-0-libro-diario-electronico/), [Libro Mayor](https://noticierocontable.com/libro-mayor-electronico/)

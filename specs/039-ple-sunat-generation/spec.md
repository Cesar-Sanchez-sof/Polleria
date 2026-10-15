# Feature Specification: Generación de archivos PLE (SUNAT)

**Feature Branch**: `039-ple-sunat-generation`
**Created**: 2026-10-14
**Status**: In progress

**Input**: "Implementar la generación de los PLE tal cual la normativa peruana, para
luego conectarlo al SIRE. El código va siempre en inglés."

> Base normativa y decisiones: ver [research.md](./research.md).

---

## Purpose

Permitir al contador exportar, desde la pantalla **Contabilidad → Libros contables
(SUNAT)**, los archivos TXT del Programa de Libros Electrónicos (PLE) de un mes
(`AAAA-MM`) con el nombre, la estructura y las validaciones que exige SUNAT, listos
para importarse al PLE / Validador y generar el Resumen.

## Alcance

**Incluido (esta entrega)**

| Formato | Libro | Código |
|---|---|---|
| 14.1 | Registro de Ventas e Ingresos | 140100 |
| 8.1 | Registro de Compras | 080100 |
| 5.1 | Libro Diario | 050100 |
| 5.3 | Diario – detalle del plan contable utilizado | 050300 |
| 6.1 | Libro Mayor | 060100 |
| 1.1 | Caja y Bancos – movimientos del efectivo | 010100 |

**Fuera de alcance** (features posteriores): 1.2, 4.1, 3.x (estados financieros),
12.1/13.1/3.7 (inventarios), 8.2 (no domiciliados), **integración con la API del SIRE**
(`040-sire-integration`), firma/envío a SUNAT, plazos por último dígito de RUC.

## User Scenarios & Testing

### US1 – Descargar un PLE de un mes (P1)
Como contador elijo año, mes y libro y pulso **PLE x.x**. Se descarga un `.TXT`
llamado `LE{RUC}{AAAA}{MM}00{código}00{O}{C}1 1…` con los registros del mes.

- **Given** ventas emitidas en octubre 2026, **When** descargo el 14.1, **Then** el archivo tiene una línea por comprobante, 34 campos separados por `|` y terminada en `|`.
- **Given** un mes sin movimientos, **When** descargo el libro, **Then** el nombre lleva indicador de contenido `0`.

### US2 – Ver errores antes de descargar (P1)
Si algún registro incumple una regla (p. ej. factura sin RUC de cliente, asiento
descuadrado), la pantalla lista los errores por comprobante/asiento y **no entrega el TXT**
(el PLE rechaza el archivo completo ante un error).

### US3 – Consistencia entre libros (P1)
El **dato estructurado** (campo 20) del Diario referencia a cada registro de ventas/
compras (`140100&AAAAMM00&CUO&M#`); el CUO y el correlativo del 14.1/8.1 coinciden
con la línea del Diario que originó la operación.

### US4 – Vista previa (P2)
Antes de descargar se muestra el número de registros, totales (base, IGV, total /
debe, haber) y advertencias.

## Requirements

- **FR-001** El sistema genera TXT por libro y mes con la estructura de `research.md` §4–§8.
- **FR-002** Nombre de archivo de 33 caracteres + `.TXT` según §3.1; RUC tomado de la configuración del restaurante.
- **FR-003** Separador `|`, terminador `|` + CRLF, decimales con punto y 2 decimales, fechas `DD/MM/AAAA`.
- **FR-004** Se sanean `|`, `&`, saltos de línea y espacios sobrantes; se trunca a la longitud máxima del campo con advertencia.
- **FR-005** Validación previa por libro (obligatoriedad, longitud, tablas, reglas de estado y cuadre Debe=Haber); errores bloquean la descarga.
- **FR-006** 14.1: boleta (`03`) y factura (`01`); anulado ⇒ estado `2`; boletas < S/700 identifican cliente opcionalmente; cuadre `total = base + IGV`.
- **FR-007** 8.1: factura (`01`) con crédito fiscal en campos 14/15 y estados `1/6/7`; boleta u otros sin derecho a crédito en campo 20 con estado `0`; total = suma de campos 14–22.
- **FR-008** 5.1/6.1: una fila por línea de asiento; no se incluyen asientos anulados; `M{n}` por línea; moneda `PEN`; dato estructurado en la línea de cuentas por cobrar/pagar de los asientos de venta/compra.
- **FR-009** 5.3: solo cuentas usadas en el periodo (más sus datos de plan `01` PCGE).
- **FR-010** 1.1: líneas de asientos que mueven cuentas de efectivo (`101*`).
- **FR-011** Permiso: `reportes.ver` para ver/descargar (sin nuevos permisos).
- **FR-012** Todo el código, nombres de variables, funciones, tipos y rutas API en inglés.
- **FR-013** El modelo canónico de ventas/compras es reutilizable por la futura integración SIRE.

## Edge cases

- Comprobantes con numeración sin serie/número válidos ⇒ error por registro.
- Asiento sin comprobante asociado ⇒ tipo `00`, serie `0000`, número = correlativo del CUO.
- Caracteres especiales (ñ, tildes) ⇒ codificación configurable (Windows-1252 por defecto).
- RUC no configurado o inválido (≠ 11 dígitos) ⇒ error global.
- Cuentas con código no numérico ⇒ advertencia en 5.3.

## Success Criteria

- Los archivos de ventas y compras de octubre 2026 se importan en el Validador PLE sin errores de estructura *(verificación manual con el validador de SUNAT; ver quickstart)*.
- `npm test` incluye pruebas del serializer, nombres de archivo y cada libro.

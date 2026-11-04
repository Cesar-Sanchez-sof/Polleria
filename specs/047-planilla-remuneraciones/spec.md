# Feature Specification: Planilla de remuneraciones

**Feature Branch**: `047-planilla-remuneraciones`
**Created**: 2026-11-05
**Status**: Implemented (pendiente de aplicar la migración y de validar los parámetros con el contador)

## Purpose

Calcular cada mes la boleta de los empleados a partir de su contrato (ver 046), registrar el asiento contable
de la planilla y su pago. Vive en **Recursos humanos → Planilla**.

## Alcance

**Incluido (primera entrega)**

- Boleta mensual por empleado: sueldo o subvención del contrato (prorrateado por días si el contrato empezó o
  terminó en el mes), asignación familiar, horas extra y bonos, descuento por faltas, aporte del trabajador a
  ONP/AFP, anticipos a descontar, neto a pagar y aporte del empleador.
- Estados: **borrador** (se recalcula y se edita) → **aprobada** (tiene asiento) → **pagada** (asiento de pago).
- Parámetros editables con vigencia por fecha (RMV, asignación familiar, ONP, AFP, EsSalud, SIS microempresa).
- Asientos contables y permisos `planilla.ver/crear/editar`.

**Fuera de alcance**: gratificaciones, CTS, vacaciones, renta de 5.ª categoría, AFP por administradora,
PLAME/T-Registro, anulación de una boleta aprobada, boleta en PDF, importar asistencia (aún no existe: horas
extra y faltas se escriben a mano).

## Reglas

- **FR-001** Entran los contratos de plazo fijo, indeterminado y **convenio de prácticas** que toquen el mes.
  El **contrato privado no** (es locación de servicios: se paga con recibo por honorarios).
- **FR-002** Sueldo del mes = suma, por contrato, de `sueldo x días cubiertos / días del mes`. Un contrato que
  cubre el mes completo paga el sueldo entero.
- **FR-003** Asignación familiar = `RMV x tasa` (10 %), solo con vínculo laboral y si el contrato la marca; se
  prorratea igual que el sueldo.
- **FR-004** Bruto = base + asignación familiar + horas extra + bonos − descuento por faltas.
- **FR-005** Pensión del trabajador sobre el bruto: ONP 13 %; AFP = aporte 10 % + prima + comisión (suma de los
  tres parámetros). El practicante no aporta a ONP ni AFP.
- **FR-006** Neto = bruto − pensión − anticipos. No puede ser negativo ni pasar de S/ 99,999.99.
- **FR-007** Aporte del empleador (no se descuenta al trabajador): EsSalud 9 % del bruto en régimen general,
  pequeña empresa y convenio de prácticas; en microempresa, un monto fijo mensual de SIS (prorrateado).
- **FR-008** Calcular crea o recalcula **solo borradores**; conserva los montos manuales, no toca boletas aprobadas
  o pagadas y quita los borradores de quien ya no tiene contrato en el mes.
- **FR-009** Si falta un parámetro vigente en el mes no se calcula y se pide cargarlo.
- **FR-010** Aprobar registra el asiento (un asiento por boleta, con fecha del último día del mes) y es todo o
  nada: si el mes contable está cerrado no se aprueba ninguna. Pagar exige boletas aprobadas y una fecha no
  anterior al mes.
- **FR-011** Toda acción (calcular, editar, aprobar, pagar, cambiar parámetros) queda en auditoría.

## Asiento contable

Al aprobar (libro "Operaciones varias"):

| Cuenta | Debe | Haber |
|---|---|---|
| 621 Gastos de personal | bruto | |
| 627 Seguridad y previsión social | aporte del empleador | |
| 4031 EsSalud por pagar | | aporte del empleador |
| 4032 ONP por pagar / 407 AFP por pagar | | pensión del trabajador |
| 141 Adelantos al personal | | anticipos descontados |
| 411 Remuneraciones por pagar | | neto |

Al pagar (libro "Caja y bancos"): debe 411, haber 101 (efectivo) o 104 (transferencia).
Las cuentas se crean al primer uso. El balance agrupa 14x como "Cuentas por cobrar al personal".

## Modelo

`payroll` se amplía (contrato de origen, asignación familiar, descuento por faltas, bruto, pensión, anticipos,
aporte del empleador, estado, aprobación) y se agrega `payroll_parameter` (código, valor, vigencia). Las tasas
se guardan como fracción (13 % = 0.13).

## API

- `GET /api/payroll?year=&month=` → `{ payrolls, missing_parameters }`.
- `POST /api/payroll` `{ year, month }` calcula. `PATCH /api/payroll` `{ action: "approve" | "pay", ids, method?, payment_date? }`.
- `PUT | DELETE /api/payroll/{id}` edita montos manuales o quita un borrador.
- `GET | POST /api/payroll/parameters`.

## Pendiente al desplegar

1. Aplicar la migración `20261105100000_add_payroll` (incluye valores sugeridos de parámetros).
2. Correr la sincronización de permisos para crear `planilla.*` y asignarlos al rol que corresponda.
3. **Validar con el contador** los parámetros sugeridos: RMV (S/ 1,130 o 1,230 según la fuente), prima y comisión AFP
   (varían por administradora) y SIS de microempresa (S/ 15).

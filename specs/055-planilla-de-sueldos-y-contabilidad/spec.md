# Feature Specification: Planilla de sueldos y su impacto contable

**Feature Branch**: `feature/rrhh-empleados-horarios`
**Created**: 2026-11-04
**Status**: Implemented
**Spec Number**: 055

---

## 1. Propósito y alcance

Calcular la planilla mensual a partir de contratos, asistencia, licencias, seguros y adelantos;
emitir la boleta de pago de cada trabajador; y **registrar automáticamente sus asientos** en
Contabilidad (devengo al cierre del mes y pago), de modo que los gastos de personal, los tributos y
aportes por pagar y las remuneraciones por pagar aparezcan en el libro mayor, la balanza, el estado
de resultados y el flujo de efectivo.

## 2. Historias de usuario

- **HU-055.1 Calcular**: RR. HH. calcula (o recalcula) la planilla de un mes en borrador.
- **HU-055.2 Ajustar**: agrega bonos u otros descuentos por boleta antes de aprobar.
- **HU-055.3 Aprobar y contabilizar**: al cierre del mes aprueba y se registra el asiento de devengo.
- **HU-055.4 Pagar**: registra el pago (transferencia, efectivo, Yape o Plin) con su asiento, y se
  descuentan las cuotas de adelantos.
- **HU-055.5 Reabrir**: si hubo un error y aún no se pagó, reabre la planilla (anula el devengo).
- **HU-055.6 Boleta**: el trabajador y RR. HH. ven e imprimen la boleta de pago.

## 3. Reglas de cálculo (por trabajador)

1. Entran los contratos laborales que cubren el mes (no la locación de servicios, que se paga con
   recibo por honorarios). Mes comercial de 30 días; si hay renovación se suman los días.
2. Días pagados = días del contrato − faltas injustificadas − licencias sin goce.
   Básico = sueldo / 30 × días pagados.
3. Asignación familiar = 10 % de la RMV (S/ 113), proporcional a los días del contrato.
4. Horas extra (desde la asistencia; desde 30 min por día): primeras 2 h al 125 %, siguientes al
   135 % del valor hora (sueldo / 30 / 8). Practicantes no generan horas extra.
5. Tardanzas: minutos × valor minuto (no justificadas).
6. Bruto = básico + asignación + horas extra + bonos − tardanzas.
7. Pensión: ONP 13 %; AFP = aporte 10 % + prima de seguro 1.37 % (tope de remuneración
   asegurable) + comisión de la AFP (Habitat 1.47 %, Integra 1.55 %, Prima 1.60 %, Profuturo 1.69 %).
8. Renta de 5.ª categoría: proyección anual (12 sueldos + 2 gratificaciones con 9 % en el régimen
   general) − 7 UIT, escala 8/14/17/20/30 %, retención = impuesto anual / 12 (método simplificado).
9. Adelantos: cuota del mes, hasta donde alcance el neto. Otros descuentos: hasta el neto.
10. EsSalud empleador 9 % (base mínima RMV proporcional). Practicantes: sin pensión ni EsSalud.
11. Neto = bruto − pensión − renta 5.ª − adelantos − otros descuentos (nunca negativo).

## 4. Flujo y asientos contables (PCGE)

| Estado | Acción | Asiento |
|---|---|---|
| Borrador | Calcular / ajustar | — |
| Aprobada | Aprobar (solo después del último día del mes) | **Devengo** (fecha = fin de mes, libro «Planillas») |
| Pagada | Registrar pago (fecha ≥ fin de mes) | **Pago** (libro «Caja y bancos») |
| Borrador | Reabrir (solo si no está pagada) | El devengo queda **anulado** (`status = false`), no se borra |

**Devengo**

| Cuenta | Debe | Haber |
|---|---|---|
| 6211 Sueldos y salarios | bruto | |
| 6271 Régimen de prestaciones de salud | EsSalud | |
| 6274 Seguro de vida ley y otros seguros | primas | |
| 4031 EsSalud por pagar | | EsSalud |
| 4032 ONP por pagar | | ONP retenida |
| 407 AFP por pagar | | AFP retenida |
| 4017 Renta de 5.ª categoría | | retención |
| 141 Adelantos de remuneraciones | | cuotas descontadas |
| 461 Cuentas por pagar diversas | | primas + otros descuentos |
| 411 Remuneraciones por pagar | | neto |

**Pago**: DEBE 411 / HABER 104 Bancos (transferencia), 101 Caja (efectivo) o 102 Billeteras (Yape/Plin).

Reglas contables: el asiento debe cuadrar (Debe = Haber) o se rechaza; no se registran asientos en
un periodo contable **cerrado**; una planilla pagada no se reabre (los ajustes van al mes siguiente).
Las cuentas se crean en la migración y en `prisma/seed-accounts.ts`.

## 5. Componentes

- BD: `payroll_period`, `payroll` (ampliada), `journal_entry.payroll_period_id`
  (migración `20261105120000_hr_payroll_attendance_marks`).
- Cálculo puro: `lib/services/hr/payroll-rules.ts`. Servicio: `lib/services/hr/payroll.service.ts`
  (`calculatePayrollPeriod`, `updatePayrollLine`, `approvePayrollPeriod`, `payPayrollPeriod`,
  `reopenPayrollPeriod`, `accrualLines`, `payslipsOf`).
- Contabilidad: `accounting-posting.service.ts` (`postJournalEntryLines`, `voidJournalEntries`,
  `PAYROLL_ACCOUNTS`).
- API: `GET/POST /api/payroll`, `GET/PATCH /api/payroll/{id}` (`approve|pay|reopen`),
  `PUT /api/payroll/lines/{id}`, `GET /api/me/payslips`.
- UI: `/hr/payroll` (planilla, boletas, impacto contable, historial), boleta en `app/hr/_components/Payslip.tsx`.
- Permisos: `planilla.ver/crear/editar` (crear = calcular; editar = aprobar y pagar). El rol
  CONTADOR solo tiene `planilla.ver` (segregación de funciones).
- Tests: `lib/services/hr/payroll-rules.test.ts` (cálculo y cuadre del asiento).

## 6. Criterios de aceptación

- [x] La boleta refleja faltas, licencia sin goce, tardanzas, horas extra, asignación familiar, ONP/AFP, 5.ª y adelantos.
- [x] Aprobar registra un asiento de devengo que cuadra y aparece en Contabilidad.
- [x] Pagar registra el asiento 411 / Caja-Bancos y descuenta las cuotas de adelantos.
- [x] Reabrir anula el devengo y permite recalcular; una planilla pagada no se reabre.

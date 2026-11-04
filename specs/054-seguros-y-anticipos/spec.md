# Feature Specification: Seguros y anticipos (adelantos de sueldo)

**Feature Branch**: `feature/rrhh-empleados-horarios`
**Created**: 2026-11-04
**Status**: Implemented
**Spec Number**: 054

---

## 1. Propósito y alcance

Registrar las coberturas del personal (EsSalud, EPS, SCTR, Vida Ley y seguros privados) y gestionar
los adelantos de sueldo con su flujo de aprobación, entrega (con **asiento contable**) y descuento
automático en la planilla.

## 2. Historias de usuario

- **HU-054.1 Seguros**: registro, edito y doy de baja pólizas por trabajador, con vigencia y costo.
- **HU-054.2 Solicitar adelanto**: el trabajador (o RR. HH.) pide un adelanto en 1 a 3 cuotas.
- **HU-054.3 Aprobar y entregar**: RR. HH. aprueba o rechaza y registra la entrega (efectivo,
  transferencia, Yape o Plin), que se contabiliza.
- **HU-054.4 Descontar**: las cuotas se descuentan solas al pagar la planilla.

## 3. Reglas de negocio

1. Un solo seguro activo por tipo y trabajador. Vida Ley, SCTR y EPS exigen número de póliza.
   Fin de cobertura ≥ inicio. Vigencia: Vigente, Por vencer (≤ 30 días), Vencida, Inactiva.
2. EsSalud se registra al contratar. Vida Ley es obligatorio desde el primer día (D. U. 044-2019):
   su ausencia genera una alerta. El costo mensual de los seguros (sin EsSalud) va como aporte del
   empleador en la planilla (cuenta 6274/461).
3. Adelanto: solo con contrato laboral vigente (no locación), monto ≤ 50 % del sueldo básico,
   1 a 3 cuotas, las cuotas no pasan del fin del contrato, y **uno abierto a la vez**.
4. Flujo: Pendiente → Aprobado → Entregado → Descontado (o Rechazado / Anulado antes de entregar).
   Rechazar exige motivo.
5. **Entrega** = asiento: DEBE 141 Adelantos de remuneraciones / HABER 101 Caja, 102 Billetera o
   104 Bancos (según el medio). El asiento queda enlazado al adelanto.
6. **Descuento**: al pagar la planilla se descuenta la cuota del mes (HABER 141 en el devengo); al
   completarse el monto pasa a «Descontado». Nunca deja el neto negativo: el saldo pasa al mes siguiente.
7. Nadie aprueba ni se entrega su propio adelanto (HTTP 403). Todo queda en la auditoría
   (módulo `Beneficios`).

## 4. Componentes

- BD: `employee_insurance`, `salary_advance` (+ `journal_entry_id`).
- Servicios: `lib/services/hr/benefits.service.ts`; asiento en
  `lib/services/accounting-posting.service.ts › postSalaryAdvanceJournalEntry`.
- API: `GET/POST /api/insurances`, `PUT/PATCH /api/insurances/{id}`, `GET/POST /api/advances`
  (`?limit_of=`), `PATCH /api/advances/{id}` (`approve|reject|pay|deduct|cancel`), `POST /api/me/advances`.
- UI: `/hr/benefits` (pestañas Seguros y Adelantos), ficha del empleado, `/hr/me`.
- Permisos: `seguros.ver/crear/editar`, `anticipos.ver/crear/editar`.
- Tests: `lib/services/hr/leaves-benefits.service.test.ts`, `payroll-rules.test.ts`.

## 5. Criterios de aceptación

- [x] Un adelanto mayor al 50 % del sueldo o un segundo adelanto abierto es rechazado.
- [x] Entregar un adelanto genera el asiento 141 / Caja-Bancos.
- [x] El pago de la planilla descuenta la cuota y actualiza el saldo y el estado.
- [x] Falta de Vida Ley aparece en las alertas de RR. HH.

# Feature Specification: Contratos laborales

**Feature Branch**: `046-contratos-laborales`
**Created**: 2026-11-03
**Status**: Implemented (pendiente de aplicar la migración)

## Purpose

Llevar los contratos del personal en **Recursos humanos → Contratos**: tipo, vigencia,
remuneración pactada y vencimientos. Es la base de datos para calcular después las
remuneraciones (planilla), los seguros y anticipos y las vacaciones, que dependen del
régimen y de las fechas del contrato.

## Alcance

**Incluido**

- Tres tipos: **plazo fijo** (tiempo determinado), **plazo indeterminado** y **contrato privado**
  (acuerdo civil, por ejemplo locación de servicios: sin vínculo laboral).
- Registrar, editar, **renovar** y **rescindir** contratos; historial por empleado.
- Estado calculado por fechas (no se guarda): *por iniciar*, *vigente*, *por vencer* (30 días o menos),
  *vencido* y *rescindido*.
- Tablero: vigentes, por vencer, vencidos sin renovar y empleados sin contrato vigente.
- Al dar de baja a un empleado se rescinden sus contratos abiertos.

**Fuera de alcance** (features siguientes): cálculo de planilla, gratificaciones, CTS, vacaciones,
asistencia, adjuntar el PDF del contrato, remuneración mínima vital.

## Modelo

`employment_contract` (`EmploymentContract`): empleado, tipo (`ContractKind`), régimen (`LaborRegime`:
general, micro, pequeña, ninguno), `start_date`, `end_date`, `monthly_salary`, `weekly_hours`, cargo,
sistema de pensiones (`PensionSystem`), asignación familiar, observaciones, `renews_contract_id`
(contrato que se renueva), `terminated_at` y `termination_reason`. No se borran contratos.

## Reglas

- **FR-001** Plazo fijo: fecha de fin obligatoria, posterior al inicio y de **máximo 5 años**.
- **FR-002** Plazo indeterminado: no admite fecha de fin. Privado: fecha de fin opcional.
- **FR-003** Con vínculo laboral se exige régimen (general, micro o pequeña) y sistema de pensiones (ONP o AFP).
  El contrato privado no tiene régimen, pensiones ni asignación familiar.
- **FR-004** Remuneración mayor a 0 y jornada de 1 a 48 horas semanales (48 si no se indica).
- **FR-005** Un empleado no puede tener dos contratos a la vez: los periodos no se cruzan (los extremos cuentan).
  Un contrato rescindido solo ocupa hasta su fecha de rescisión. Renovar es registrar el contrato
  que empieza el día siguiente al fin del anterior.
- **FR-006** No se puede registrar un contrato a un empleado dado de baja, ni renovar uno rescindido,
  ni editar uno rescindido, ni cambiar el empleado de un contrato.
- **FR-007** Rescindir exige fecha (dentro de la vigencia) y motivo.
- **FR-008** Permisos `contratos.ver`, `contratos.crear` (registrar y renovar) y `contratos.editar`
  (editar y rescindir). No hay `eliminar`: el contrato es un registro legal. Toda acción queda en auditoría.

## API

- `GET /api/contracts` → `{ contracts, employees }` (filtros `q`, `employee_id`, `status`, `kind`);
  `employees` son los empleados activos y si tienen contrato vigente.
- `POST /api/contracts` (con `renews_contract_id` para renovar).
- `GET | PUT | PATCH /api/contracts/{id}` (`PATCH` rescinde con `terminated_at` y `reason`).

## Pendiente al desplegar

1. Aplicar la migración `20261103180000_add_employment_contract`.
2. Correr el seed de roles para crear los permisos `contratos.*` y asignarlos al rol que corresponda.

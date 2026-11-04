# Feature Specification: Contratación y gestión de contratos

**Feature Branch**: `feature/rrhh-empleados-horarios`
**Created**: 2026-11-04
**Status**: Implemented
**Spec Number**: 050

---

## 1. Propósito y alcance

Formalizar la relación laboral: todo trabajador activo tiene un **contrato vigente** con su modalidad,
cargo, área, sueldo, régimen, sistema de pensiones y **horario pactado**. El empleado guarda solo sus
datos personales; las condiciones laborales viven en el contrato, que conserva el historial
(renovaciones, adendas y ceses).

## 2. Historias de usuario

- **HU-050.1 Contratar personal**: como responsable de RR. HH. registro en un solo paso los datos
  personales (con consulta a RENIEC), el contrato y el horario semanal del nuevo trabajador.
- **HU-050.2 Renovar contrato**: renuevo un contrato a plazo fijo sin perder la antigüedad.
- **HU-050.3 Adenda**: cambio cargo, sueldo, fechas u horario de un contrato vigente.
- **HU-050.4 Cese**: registro el término (renuncia, vencimiento, despido…) y el sistema da de baja
  al trabajador, desactiva su acceso y lo retira de los horarios posteriores.
- **HU-050.5 Alertas**: veo los contratos por vencer o vencidos, fin del periodo de prueba,
  contratos sin horario, trabajadores sin Vida Ley y activos sin contrato.

## 3. Reglas de negocio

1. Modalidades: plazo indeterminado, plazo fijo (sujeto a modalidad), tiempo parcial, prácticas y
   locación de servicios. Régimen: general, pequeña empresa o microempresa.
2. Plazo fijo, prácticas y locación **exigen** fecha de término; el indeterminado **no** la lleva.
   Un plazo fijo no supera 5 años (D. Leg. 728, art. 74).
3. Periodo de prueba de 3 meses por defecto (indeterminado y plazo fijo), máximo 12. Una
   renovación no reinicia el periodo de prueba.
4. Sueldo de jornada completa ≥ RMV (S/ 1 130). Prácticas: subvención ≥ RMV proporcional a la
   jornada (30 h = RMV).
5. Planilla (no locación ni prácticas): afiliación obligatoria a ONP o AFP; AFP exige nombre de la
   AFP y CUSPP de 12 caracteres.
6. Horario pactado (turnos base por día de la semana): máximo 48 h semanales, al menos un día de
   descanso, turnos del mismo día sin cruces; tiempo parcial < 4 h diarias en promedio; prácticas
   ≤ 6 h diarias y ≤ 30 h semanales. Días de más de 8 h generan advertencia.
7. Un trabajador no puede tener dos contratos vigentes que se crucen (HTTP 409).
8. Al contratar se registra automáticamente su afiliación a **EsSalud** (9 % del empleador).
9. La renovación cierra el contrato actual el día anterior al inicio del nuevo y lo enlaza
   (`renewed_from_id`). El tipo de contrato no se cambia por adenda.
10. El cese: fecha entre el inicio y el término del contrato; si no queda otro contrato vigente,
    el empleado pasa a inactivo, sus usuarios se desactivan y sale de los horarios posteriores.
    Nadie registra su propio cese. Solo un ADMIN modifica a otro administrador.
11. Un DNI de ex empleado no se vuelve a contratar como nuevo: se reingresa con un nuevo contrato
    desde su ficha (nueva fecha de ingreso).
12. Toda operación queda en la auditoría (módulos `Empleados` y `Contratos`).

## 4. Componentes

- BD: `employment_contract`, `contract_schedule_day`, `shift_template`; columnas laborales
  migradas desde `employee` (migración `20261104120000_hr_contracts_attendance_leaves`).
- Reglas: `lib/services/hr/labor-rules.ts` (`evaluateSchedule`, `trialEndFor`, …).
- Servicios: `lib/services/employees.service.ts` (`hireEmployee`), `lib/services/hr/contracts.service.ts`
  (`createContract`, `renewContract`, `updateContract`, `terminateContract`, `hrAlerts`).
- API: `POST /api/employees` (contratar), `GET/PUT /api/employees/{id}`, `GET/POST /api/contracts`,
  `GET/PUT/POST /api/contracts/{id}` (`action: renew | terminate`), `GET /api/contracts/alerts`,
  `GET/POST /api/shift-templates`, `PUT/PATCH /api/shift-templates/{id}`.
- UI: `/hr/employees` (asistente «Contratar personal», alertas), `/hr/employees/{id}` (ficha),
  `/hr/contracts`. Componentes en `app/hr/_components/ContractDialogs.tsx` y `ContractFields.tsx`.
- Permisos: `empleados.*` (crear = contratar), `contratos.ver/crear/editar`.
- Tests: `lib/services/hr/labor-rules.test.ts`, `lib/services/employees.service.test.ts`.

## 5. Criterios de aceptación

- [x] Contratar crea empleado + contrato + horario + EsSalud en una sola transacción.
- [x] Un horario de 7 días, de más de 48 h o un sueldo menor a la RMV es rechazado con el motivo.
- [x] La renovación conserva la antigüedad y el historial de contratos.
- [x] El cese desactiva usuarios y retira de horarios futuros.
- [x] El panel muestra las alertas de cumplimiento con enlace a la ficha.

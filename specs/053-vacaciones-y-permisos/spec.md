# Feature Specification: Gestionar, adelantar vacaciones y permisos de ausencia

**Feature Branch**: `feature/rrhh-empleados-horarios`
**Created**: 2026-11-04
**Status**: Implemented
**Spec Number**: 053

---

## 1. Propósito y alcance

Registrar y aprobar vacaciones (incluido su **adelanto**), descansos médicos, licencias y permisos,
con control del saldo vacacional y efecto directo en los horarios, la asistencia y la planilla.

## 2. Historias de usuario

- **HU-053.1 Solicitar**: como trabajador pido vacaciones o permisos desde «Mi horario»; como RR. HH.
  los registro para cualquier trabajador (o ya aprobados, p. ej. un descanso médico presentado).
- **HU-053.2 Adelantar vacaciones**: si aún no cumplo el año, pido días proporcionales como adelanto.
- **HU-053.3 Aprobar / rechazar / anular**: RR. HH. revisa las solicitudes pendientes.
- **HU-053.4 Saldo**: veo días ganados, adelanto posible y días usados.

## 3. Reglas de negocio

1. Tipos: Vacaciones, Descanso médico, Licencia por maternidad, por paternidad, por fallecimiento,
   Permiso personal (con goce) y Licencia sin goce. Los días son calendario.
2. Días por año completo: 30 (régimen general), 15 (MYPE y prácticas), 0 (tiempo parcial y
   locación).
3. Saldo: ganados = años completos × días anuales; disponibles = ganados − usados (pendientes +
   aprobados). Adelanto (D. Leg. 1405): hasta los días proporcionales del año en curso; el
   trabajador debe aceptarlo expresamente (`advance: true`).
4. No se cruzan dos solicitudes pendientes/aprobadas del mismo trabajador (HTTP 409); no pueden
   pasar del fin del contrato; el autoservicio solo registra desde hoy.
5. Permiso personal y licencia sin goce exigen motivo. Registrar ya aprobado un descanso médico o
   una licencia de maternidad, paternidad o fallecimiento exige documento de sustento (CITT,
   certificado, partida…).
6. Al aprobar se re-valida el saldo y el trabajador **sale de los horarios** de esas fechas; la
   asistencia muestra «Licencia» y no cuenta faltas. La licencia sin goce descuenta días en la planilla.
7. Rechazar exige motivo. Se anula una solicitud pendiente, o una aprobada que aún no empieza.
8. Nadie aprueba sus propias solicitudes. Todo queda en la auditoría (módulo `Vacaciones`).

## 4. Componentes

- BD: `leave_request`.
- Servicio: `lib/services/hr/leaves.service.ts`; reglas `vacationBalance`, `checkVacationRequest`.
- API: `GET/POST /api/leaves` (`?balance_of=`), `PATCH /api/leaves/{id}` (`approve|reject|cancel`),
  `POST/PATCH /api/me/leaves`.
- UI: `/hr/leaves`, pestaña de la ficha, `/hr/me`. Diálogo `RequestDialogs.tsx › LeaveDialog`.
- Permisos: `vacaciones.ver/crear/editar` (editar = aprobar).
- Tests: `lib/services/hr/leaves-benefits.service.test.ts`, `labor-rules.test.ts`.

## 5. Criterios de aceptación

- [x] Antes del año, pedir vacaciones sin aceptar el adelanto es rechazado con el saldo explicado.
- [x] Aprobar libera los turnos programados de esas fechas.
- [x] Un descanso médico aprobado sin CITT es rechazado.
- [x] La licencia sin goce reduce los días pagados en la planilla.

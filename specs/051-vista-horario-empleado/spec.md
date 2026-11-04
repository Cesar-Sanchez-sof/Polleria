# Feature Specification: Vista de su horario para cada empleado (autoservicio)

**Feature Branch**: `feature/rrhh-empleados-horarios`
**Created**: 2026-11-04
**Status**: Implemented
**Spec Number**: 051

---

## 1. Propósito y alcance

Cada trabajador con usuario del sistema consulta **su** información laboral sin depender de RR. HH.:
su semana de turnos, su asistencia, su contrato y horario pactado, sus vacaciones, adelantos,
seguros y boletas de pago. La pantalla «Mi horario y asistencia» aparece en el menú de todo usuario
con sesión, sin necesidad de permisos.

## 2. Historias de usuario

- **HU-051.1 Ver mi semana**: veo mis turnos de la semana (y navego a otras), con el estado de cada
  día (puntual, tardanza, falta, licencia, descanso) y mis marcaciones.
- **HU-051.2 Marcar desde mi horario**: marco mi entrada o salida si no lo hice al iniciar sesión.
- **HU-051.3 Mis solicitudes**: veo mi saldo de vacaciones, pido vacaciones/permisos y adelantos,
  y anulo mis solicitudes pendientes.
- **HU-051.4 Mis boletas**: veo e imprimo mis boletas de pago aprobadas.

## 3. Reglas de negocio

1. Solo se muestra la información del empleado vinculado al usuario con sesión (`requireSelf`):
   nadie consulta datos de otro trabajador por esta vía.
2. La entrada se puede marcar desde 1 hora antes del primer turno del día; sin turno hoy no se marca.
3. «Marcar salida» se habilita si hay una entrada sin salida de hoy o de ayer (turno nocturno).
4. Las solicitudes del autoservicio siempre quedan **Pendientes** y empiezan hoy o después.
5. Un trabajador no aprueba sus propias solicitudes ni adelantos (segregación de funciones).
6. Solo se muestran boletas de planillas **Aprobadas** o **Pagadas**.

## 4. Componentes

- API: `GET /api/me` (ficha, contrato, semana, saldo, solicitudes, adelantos, seguros),
  `GET/POST /api/me/attendance`, `POST/PATCH /api/me/leaves`, `POST /api/me/advances`,
  `GET /api/me/payslips`.
- UI: `/hr/me` (`app/hr/me/page.tsx`), enlace fijo en `components/personalized/Sidebar.tsx`.
- Servicio de apoyo: `lib/services/hr/route-helpers.ts` (`requireSelf`).

## 5. Criterios de aceptación

- [x] Un mozo sin permisos de RR. HH. ve su semana, contrato y saldo de vacaciones.
- [x] Puede pedir vacaciones (con adelanto si corresponde) y un adelanto de sueldo.
- [x] Ve e imprime sus boletas de pago.
- [x] Las API `/api/me/*` responden 401 sin sesión (test de regresión de seguridad).

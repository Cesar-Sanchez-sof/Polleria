# Feature Specification: Registrar asistencia

**Feature Branch**: `feature/rrhh-empleados-horarios`
**Created**: 2026-11-04
**Status**: Implemented
**Spec Number**: 052

---

## 1. Propósito y alcance

Controlar la asistencia diaria del personal comparando sus marcaciones con los horarios
programados. La **entrada se registra sola cuando el trabajador inicia sesión con sus credenciales**
dentro de la ventana de su turno, y la salida al cerrar sesión (si lo confirma). RR. HH. ve el
tablero del día, corrige y justifica, y consulta una **bitácora inmutable** de cada marcación con
su origen, IP y dispositivo.

## 2. Historias de usuario

- **HU-052.1 Marcado al iniciar sesión**: al entrar con mi usuario y contraseña se registra mi
  entrada y veo un aviso («Entrada registrada a las 17:52»).
- **HU-052.2 Salida al cerrar sesión**: al cerrar sesión con la entrada abierta se me pregunta si
  marco mi salida o solo cierro sesión (para cambios de usuario).
- **HU-052.3 Tablero de RR. HH.**: veo por día quién está programado, sus marcaciones con el origen
  (Login, Logout, Autoservicio, RR. HH., Corrección), tardanzas, faltas, horas trabajadas y extra.
- **HU-052.4 Bitácora de marcaciones**: veo cada marcación con hora, origen, usuario, IP y
  dispositivo.
- **HU-052.5 Corregir y justificar**: registro marcaciones olvidadas, corrijo horas y justifico
  tardanzas o faltas con su motivo.

## 3. Reglas de negocio

1. Marcado automático al iniciar sesión (`checkInOnLogin`): solo si el usuario está vinculado a un
   empleado activo con contrato vigente, sin licencia aprobada hoy, con turno hoy y dentro de la
   ventana **[inicio − 60 min, fin del turno)**. Si ya marcó, no se duplica. Si es temprano, se
   informa desde qué hora se registra. Nunca impide el inicio de sesión.
2. La salida de un turno nocturno (p. ej. Cierre 23:30–00:30) se asigna al día en que empezó.
3. Tolerancia de 10 minutos; más es **Tardanza**. Sin entrada al terminar el turno es **Falta**.
   Entrada sin salida 2 h después del fin es **Sin salida**. Otros estados: Programado, Sin marcar,
   En turno, Puntual, Justificada, Licencia, Descanso y Extra (marcó sin turno).
4. Horas extra = minutos trabajados por encima de lo programado.
5. RR. HH. marca con la hora actual solo hoy (o la salida nocturna de ayer); para días pasados debe
   indicar la hora con «Corregir». Ninguna marcación puede ser futura.
6. Toda justificación exige motivo. Cada marcación y corrección crea un registro en la bitácora
   (`attendance_mark`) que no se edita ni borra; la asistencia del día guarda el origen e IP de la
   entrada y de la salida.
7. Las marcaciones automáticas también quedan en la auditoría (módulo `Asistencia`).

## 4. Componentes

- BD: `attendance` (+ `check_out_source`, `check_in_ip`, `check_out_ip`), `attendance_mark`
  (migraciones `20261104120000_…` y `20261105120000_hr_payroll_attendance_marks`).
- Servicio: `lib/services/hr/attendance.service.ts` (`markAttendance`, `checkInOnLogin`,
  `openAttendanceOf`, `correctAttendance`, `dailyAttendance`, `employeeAttendance`, `listMarks`);
  reglas en `labor-rules.ts` (`evaluateDay`).
- Integración: `app/api/auth/login/route.ts` (marca la entrada), `app/api/auth/logout/route.ts`
  (`mark_exit`), aviso en `Sidebar.tsx` y en la pantalla de login.
- API: `GET/POST/PUT /api/attendance`, `GET /api/attendance/marks`, `GET/POST /api/me/attendance`.
- UI: `/hr/attendance` (tablero + «Bitácora de marcaciones»), `/hr/me`, ficha del empleado.
- Permisos: `asistencia.ver/crear/editar`.
- Tests: `lib/services/hr/attendance-login.test.ts`, `labor-rules.test.ts`.

## 5. Criterios de aceptación

- [x] Iniciar sesión dentro de la ventana del turno registra la entrada con origen «Inicio de sesión» e IP.
- [x] Un segundo inicio de sesión no duplica la entrada.
- [x] Cerrar sesión con la opción «Marcar salida» registra la salida con origen «Cierre de sesión».
- [x] RR. HH. ve el origen de cada marca en el tablero y la bitácora completa del día.
- [x] Las correcciones quedan en la bitácora con el usuario que las hizo y su motivo.

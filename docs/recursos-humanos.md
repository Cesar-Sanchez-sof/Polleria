# Recursos Humanos — documentación del módulo

Rama: `feature/rrhh-empleados-horarios` · Specs: `specs/050` a `specs/056` (reemplazan a `046-contratos-laborales` y `048-planilla-remuneraciones` de la v1).

## 1. Modelo del módulo

```
Empleado (datos personales)
  └─ Contrato (modalidad, cargo, área, sueldo, régimen, pensión, vigencia)
       └─ Horario pactado (turnos base por día de la semana)
            └─ Programación semanal (horarios del día + asignaciones)
                 └─ Asistencia (entrada/salida) ── Bitácora de marcaciones
  ├─ Vacaciones / licencias / permisos ── liberan horarios, afectan asistencia y planilla
  ├─ Seguros (EsSalud, Vida Ley, SCTR, EPS) ── aporte del empleador en la planilla
  ├─ Adelantos de sueldo ── asiento al entregar, descuento en la planilla
  └─ Planilla mensual (boletas) ── asiento de devengo + asiento de pago ─► Contabilidad
```

## 2. Historias de usuario: qué se hizo, dónde y qué reglas cumple

### HU — Gestionar contratos y contratar personal (spec 050)
- **Qué**: asistente «Contratar personal» (datos + RENIEC → contrato → horario → confirmación),
  renovación, adenda, cese con baja de accesos, alertas de cumplimiento.
- **Dónde**: `/hr/employees`, `/hr/employees/{id}`, `/hr/contracts` · `lib/services/hr/contracts.service.ts`,
  `lib/services/employees.service.ts` · `/api/employees`, `/api/contracts`.
- **Reglas**: modalidades del D. Leg. 728, plazo fijo ≤ 5 años, periodo de prueba de 3 meses,
  sueldo ≥ RMV, ONP/AFP obligatoria en planilla, jornada ≤ 48 h con descanso semanal, tiempo
  parcial < 4 h diarias, prácticas ≤ 6 h/30 h, sin contratos superpuestos, EsSalud al contratar.

### HU — Vista de su horario para cada empleado (spec 051)
- **Qué**: «Mi horario y asistencia» para cualquier usuario: semana, marcaciones, contrato, saldo
  de vacaciones, solicitudes, adelantos, seguros y boletas.
- **Dónde**: `/hr/me` · `/api/me`, `/api/me/attendance`, `/api/me/leaves`, `/api/me/advances`, `/api/me/payslips`.
- **Reglas**: solo los datos propios, solicitudes siempre pendientes, sin autoaprobación.

### HU — Registrar asistencia (spec 052)
- **Qué**: entrada automática al **iniciar sesión** dentro de la ventana del turno; salida al
  **cerrar sesión** (con confirmación); tablero diario con origen de cada marca; bitácora con IP y
  dispositivo; correcciones y justificaciones.
- **Dónde**: `app/api/auth/login`, `app/api/auth/logout`, `/hr/attendance` (pestaña «Bitácora de
  marcaciones») · `lib/services/hr/attendance.service.ts`.
- **Reglas**: ventana desde 1 h antes hasta el fin del turno, sin duplicados, tolerancia 10 min,
  turnos nocturnos al día de inicio, correcciones con motivo y registro inmutable.

### HU — Gestionar, adelantar vacaciones y permisos de ausencia (spec 053)
- **Qué**: solicitudes, adelanto de vacaciones, aprobación/rechazo/anulación, saldo.
- **Dónde**: `/hr/leaves`, ficha, `/hr/me` · `lib/services/hr/leaves.service.ts` · `/api/leaves`.
- **Reglas**: 30/15/0 días según régimen y modalidad, adelanto proporcional (D. Leg. 1405), sin
  cruces, sustento documentario, al aprobar libera turnos; la licencia sin goce descuenta en planilla.

### HU — Seguros y anticipos (spec 054)
- **Qué**: pólizas por trabajador y adelantos con flujo Pendiente → Aprobado → Entregado → Descontado.
- **Dónde**: `/hr/benefits` · `lib/services/hr/benefits.service.ts` · `/api/insurances`, `/api/advances`.
- **Reglas**: un seguro activo por tipo, Vida Ley obligatorio (alerta), adelanto ≤ 50 % del sueldo,
  1–3 cuotas, uno a la vez; **asiento 141 / Caja-Bancos** al entregar; descuento automático en la planilla.

### HU — Planilla de sueldos e impacto contable (spec 055)
- **Qué**: cálculo mensual, ajustes, aprobación con asiento de devengo, pago con asiento de pago,
  reapertura (anula el devengo), boletas imprimibles.
- **Dónde**: `/hr/payroll` · `lib/services/hr/payroll-rules.ts`, `payroll.service.ts`,
  `accounting-posting.service.ts` · `/api/payroll`.
- **Reglas**: mes comercial de 30 días, faltas y licencias sin goce, tardanzas, horas extra 25 %/35 %,
  asignación familiar 10 % RMV, ONP 13 % / AFP (aporte + prima + comisión), renta de 5.ª, EsSalud 9 %,
  adelantos; asientos cuadrados, nunca en un periodo cerrado.

### HU — Auditoría de las operaciones de compras (spec 056)
- **Qué**: cada orden, compra, comprobante, pago, compra sin comprobante (y su anulación) y cambio
  de proveedor queda en la auditoría, a nombre del usuario que lo hizo.
- **Dónde**: `lib/services/purchases/purchase-audit.ts` y las server actions de compras · `/security/audit`.

## 3. Roles y permisos

| Permiso | RRHH | CONTADOR | Otros roles |
|---|---|---|---|
| empleados, contratos, horarios, asistencia, vacaciones, seguros, anticipos | todo | — | — |
| planilla | ver, calcular, aprobar y pagar | ver | — |
| Mi horario y asistencia (`/hr/me`) | sí | sí | sí (todo usuario con sesión) |

## 4. Datos de ejemplo (`npm run db:seed:hr`)

| Usuario | Trabajador | Contrato | Para probar |
|---|---|---|---|
| `mvega` | Mariela Vega — Jefa de RR. HH. | Indeterminado, S/ 6 000, AFP Habitat, EPS | Rol RRHH, retención de 5.ª |
| `rquispe` | Rosa Quispe — Cajera | Indeterminado, AFP Integra, asig. familiar | Vacaciones gozadas, adelanto con cuota descontada |
| `lramirez` | Luis Ramírez — Mozo | Plazo fijo que **vence en 20 días** | Alerta de vencimiento, adelanto de vacaciones pendiente, adelanto pendiente, falta justificada |
| `ctorres` | Carmen Torres — Cocinera | Indeterminado, AFP Prima, SCTR | Descanso médico con CITT |
| `jhuaman` | Jorge Huamán — Parrillero | Plazo fijo **en periodo de prueba**, ingreso a mitad del mes anterior | Prorrateo, **sin Vida Ley** (alerta), adelanto aprobado por entregar |
| — | Diana Flores — Moza | Tiempo parcial (refuerzo vie–dom) | Licencia sin goce (días no pagados) |
| — | Kevin Salazar — Practicante | Convenio de prácticas | Sin pensión ni EsSalud, seguro por vencer, permiso rechazado |
| — | Pedro Castillo — Mozo | **Cesado** (renuncia el día 10 del mes anterior) | Historial, planilla de 10 días |
| — | Jhon Paredes — Repartidor | Locación de servicios | Excluido de la planilla |

Clave de todos: `Demo2026!`. Incluye asistencia del mes anterior hasta ayer (puntuales, tardanzas,
faltas, horas extra, marcas por login/logout/autoservicio/RR. HH.), la planilla del mes anterior
**aprobada y pagada** (con sus asientos) y la del mes actual en **borrador**.

> El script no calcula planillas si en la base hay contratos reales con sueldo, para no mezclar
> datos. Úsalo en una base local o de pruebas.

## 5. Comandos

```bash
npm install                      # dependencias y prisma generate
npx prisma migrate deploy        # aplica 20261104120000_… y 20261105120000_…
npm run db:seed                  # catálogo de cuentas (con las de planilla), roles y permisos (RRHH)
npm run db:seed:hr               # datos de ejemplo de RR. HH.  (--reset para recrear, --remove para quitar)
npm test                         # pruebas (incluye las de RR. HH.)
npm run dev                      # http://localhost:3000
```

En una base **nueva**, la tabla `restaurant_config` no tiene migración (problema anterior a esta
rama): ejecuta `npx prisma db push` después de `migrate deploy` y antes de `db:seed`.

## 6. Guía de pruebas manuales

1. **Asistencia al iniciar sesión**: crea en Horarios laborales un horario de hoy que cubra la hora
   actual y asígnalo a Rosa → inicia sesión como `rquispe` → aviso «Entrada registrada a las …».
   Vuelve a iniciar sesión: «ya está registrada». Cierra sesión → «Marcar salida y cerrar sesión».
2. **Lo que ve RR. HH.**: entra como `mvega` → Asistencia → tablero (etiquetas Login/Logout) y
   pestaña «Bitácora de marcaciones» (IP, dispositivo, usuario). Corrige una falta y justifícala.
3. **Contratos**: Contratos → Por vencer (Luis) → Renovar. Ficha de Jorge → alerta sin Vida Ley →
   Seguros → registrar Vida Ley. Contratar personal con un horario de 7 días → ver el rechazo.
4. **Vacaciones**: Vacaciones y permisos → aprobar el adelanto de Luis → su turno de esas fechas
   desaparece de Horarios laborales.
5. **Adelantos**: Seguros y adelantos → Jorge → «Registrar entrega» (Yape) → Contabilidad → Asientos:
   asiento 141 / 102.
6. **Planilla**: Planilla de sueldos → mes anterior (Pagada) → abrir boletas e «Impacto contable».
   Mes actual (Borrador) → ajustar un bono → Recalcular. Contabilidad → Libro mayor / Balance de
   comprobación: cuentas 6211, 6271, 4031, 4032, 407, 4017, 411, 141.
7. **Auditoría de compras**: registra una compra o edita un proveedor → Seguridad → Auditoría →
   módulo «Compras».

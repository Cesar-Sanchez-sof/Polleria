# Feature Specification: Diagrama de BD actualizado con tablas de RR. HH.

**Created**: 2026-11-11
**Status**: Implemented
**Spec Number**: 062

---

## 1. Propósito y alcance

El diagrama de la base de datos (`/docs/db-diagram`, componente `app/docs/db-diagram/db-diagram.tsx`) se
mantiene a mano y había quedado atrás tras construir el módulo de RR. HH. (specs 054 y 055 y la 060):
- Las 13 tablas de RR. HH. tenían campos faltantes (p. ej. `Payroll` mostraba nombres de columnas SQL
  como `absenceDiscount`/`advances` y un `status` que no existe; `EmploymentContract` no mostraba AFP,
  CUSPP ni asignación familiar; `Employee` no mostraba dirección, fecha de nacimiento ni segundo nombre).
- Faltaban 7 relaciones (quién creó/aprobó/pagó/revisó, y el vínculo asiento ↔ planilla).
- `EmploymentContract` estaba dibujado **dos veces** en el layout y `Payroll`/`PayrollPeriod` estaban separados.

## 2. Qué se hizo

| Cambio | Detalle |
|---|---|
| Entidades regeneradas desde `prisma/schema.prisma` | `Employee`, `Shift`, `EmployeeShift`, `ShiftTemplate`, `EmploymentContract`, `ContractScheduleDay`, `Attendance`, `AttendanceMark`, `LeaveRequest`, `EmployeeInsurance`, `SalaryAdvance`, `PayrollPeriod`, `Payroll` |
| También corregidas | `User` (+`lockedAt`), `AuditLog` (+`ipAddress`), `JournalEntry` (+`payrollPeriodId`) |
| Módulo | `Employee`, `Shift` y `EmployeeShift` pasaron de «Seguridad» a **RRHH** (color violeta) |
| Relaciones nuevas (8) | `EmploymentContract.createdById→User`, `Attendance.registeredById→User`, `LeaveRequest.reviewedById→User`, `SalaryAdvance.reviewedById→User`, `PayrollPeriod.approvedById→User`, `PayrollPeriod.paidById→User`, `JournalEntry.payrollPeriodId→PayrollPeriod`, `SalaryAdvance.journalEntryId→JournalEntry` |
| Layout | Zona de RR. HH. en 3 columnas contiguas: contratos/turnos → asistencia/licencias/seguros/adelantos → planilla. Se quitó el duplicado de `EmploymentContract` |
| Prueba de regresión | `test/architecture/db-diagram-hr.test.ts` |

## 3. Mapa de RR. HH. en el diagrama

```
Employee ─┬─ EmploymentContract ─┬─ ContractScheduleDay ── ShiftTemplate
          │                      └─ Payroll ── PayrollPeriod ── JournalEntry (asientos)
          ├─ EmployeeShift ── Shift
          ├─ Attendance ── AttendanceMark
          ├─ LeaveRequest   (vacaciones, descansos, licencias)
          ├─ EmployeeInsurance (Vida Ley, SCTR, EPS)
          └─ SalaryAdvance ── JournalEntry
```

## 4. Cómo mantenerlo al día
`test/architecture/db-diagram-hr.test.ts` compara, para las 13 tablas de RR. HH.:
1. Que los campos del diagrama sean **exactamente** los campos escalares del modelo Prisma.
2. Que cada llave foránea (`@relation(fields: [...])`) tenga su línea dibujada.
3. Que ninguna entidad se repita en el layout.

Si cambias `schema.prisma` y olvidas el diagrama, `npx vitest run test/architecture` falla indicando el modelo.

## 5. Verificación
`npx vitest run test/architecture` → 28 pruebas pasan · `npx tsc --noEmit` y ESLint sin errores.

## 6. Limitaciones
- No pude abrir `/docs/db-diagram` en un navegador: **revisa visualmente** que las tarjetas nuevas no se
  superpongan y mueve columnas en `MODULE_LAYOUT` si hace falta.
- Quedan sin dibujar modelos de otros dominios (SIRE, dashboards, branding, configuración) y campos menores
  de compras/contabilidad (`createdAt`, `notes`); la prueba cubre solo RR. HH. por alcance de esta historia.

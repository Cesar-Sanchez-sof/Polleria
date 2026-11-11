# Feature Specification: Logs de auditoría con la hora correcta

**Created**: 2026-11-11
**Status**: Implemented (código) · Pendiente de verificar en BD real y corregir filas antiguas
**Spec Number**: 063

---

## 1. Problema

Los registros de `audit_log` aparecían con una hora distinta a la real (5 horas antes).

## 2. Causa raíz

- `audit_log.created_at` es `timestamp(6)` **sin zona horaria** y se llenaba con el `DEFAULT now()` de la BD.
- Desde la migración `20261107140000_set_default_timezone_peru` y la opción `timezone=America/Lima` de la
  conexión (`lib/prisma.ts`), la sesión de Postgres trabaja en Lima, así que `now()` guardaba la
  **hora local de Lima** (p. ej. 10:30).
- Prisma interpreta toda columna `timestamp` sin zona como **UTC**: leía `10:30Z`, y el navegador (Lima)
  lo mostraba como **05:30**.
- Un segundo efecto: el filtro «Desde/Hasta» usaba el día en UTC, de modo que los eventos de 19:00–23:59 de
  Lima caían en el día siguiente.

## 3. Qué se hizo

| Cambio | Archivo |
|---|---|
| `logAudit` guarda `createdAt: new Date()` explícito (instante UTC) en lugar del default de la BD | `lib/services/security/audit.service.ts` |
| Filtros por día interpretados como día de Lima (`T00:00:00-05:00`) | `lib/services/security/audit.service.ts` |
| La pantalla muestra fecha y hora con `timeZone: "America/Lima"` fijo, sin depender de la zona del navegador | `app/security/audit/page.tsx` |
| Pruebas: instante exacto guardado (10:30 Lima = 15:30Z) y filtro que incluye las 23:30 de Lima | `test/services/audit.service.test.ts` |
| Script para corregir filas ya guardadas mal | `scripts/fix-audit-log-timestamps.sql` |

Sin migración de esquema: no cambia el tipo de columna ni el default.

## 4. Convención resultante
`timestamp` sin zona = **UTC siempre**. La conversión a Lima se hace al **mostrar** (`formatPeruDateTime`
en `lib/dates.ts` o `timeZone: "America/Lima"`) y al **filtrar por día** (`-05:00`).

## 5. Datos antiguos
Las filas creadas antes del fix **no se corrigen solas**: el script `scripts/fix-audit-log-timestamps.sql`
trae un diagnóstico y un `UPDATE` comentado (+5 horas) para el tramo afectado. **No se ejecutó**: requiere que
tú identifiques el primer registro afectado y confirmes sobre la BD real.

## 6. Verificación
`npx vitest run test/services/audit.service.test.ts test/hr` → 88 pruebas pasan · `tsc` y ESLint sin errores.

## 7. Riesgo conocido (fuera del alcance)
Otras columnas `timestamp` con `@default(now())` (p. ej. `AttendanceMark`, `CashSession`, `createdAt` de otras
tablas) pueden tener el mismo desfase. Revisa en la BD si ves horas corridas allí; la solución es la misma
(asignar `new Date()` desde el servicio).

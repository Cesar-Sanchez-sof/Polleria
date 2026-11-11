# Feature Specification: AFP y derechos laborales (CTS, gratificaciones, vacaciones y liquidación)

**Created**: 2026-11-11
**Status**: Implemented
**Spec Number**: 060

---

## 1. Propósito y alcance

La planilla (spec 055) ya descontaba ONP/AFP, pero **no calculaba los derechos laborales que la ley
obliga a pagar a un trabajador de una pollería**: gratificaciones de julio y diciembre, CTS de mayo y
noviembre, vacaciones y la liquidación de beneficios sociales cuando alguien deja de trabajar
(renuncia, fin de contrato o despido). Esta historia los agrega como reglas puras, servicio y API.

No requiere migración de base de datos: todo se calcula a partir de contratos, asistencia, licencias y
adelantos ya existentes.

## 2. Qué se hizo

| Pieza | Archivo |
|---|---|
| Reglas puras (sin BD) | `lib/services/hr/social-benefits-rules.ts` |
| Servicio de dominio | `lib/services/hr/social-benefits.service.ts` |
| Endpoint de gratificación/CTS por semestre | `app/api/payroll/social-benefits/route.ts` |
| Endpoint de liquidación | `app/api/contracts/[id]/settlement/route.ts` |
| Pruebas | `test/hr/social-benefits-rules.test.ts` (21 casos) |

### AFP (ya existente, ahora integrado a la liquidación)
- ONP 13 %. AFP = aporte 10 % + prima de seguro 1.37 % (tope S/ 12 234.11) + comisión por flujo
  (Habitat 1.47 %, Integra 1.55 %, Prima 1.60 %, Profuturo 1.69 %).
- El contrato exige AFP + CUSPP de 12 caracteres cuando el sistema es AFP.
- **Nuevo**: en la liquidación se aplica ONP/AFP sobre las **vacaciones** (remuneración afecta); la CTS,
  la gratificación y la indemnización **no** llevan aporte previsional.

## 3. Reglas de negocio

### Gratificación (Ley 27735 / Ley 30334)
- Semestres: ene–jun (se paga hasta el 15-jul) y jul–dic (hasta el 15-dic).
- Régimen general: 1 remuneración · Pequeña empresa: ½ · Microempresa, prácticas y locación: no corresponde.
- Proporcional a **meses calendario completos** (n/6). Ingresó el 15-mar → julio cuenta abr–jun = 3/6.
- Cada falta injustificada descuenta 1/180 de la gratificación completa.
- Se suma la **bonificación extraordinaria del 9 %** (equivalente al aporte a EsSalud).

### CTS (D. S. 001-97-TR / D. Leg. 1086)
- Semestres: nov–abr (depósito hasta el 15-may) y may–oct (hasta el 15-nov).
- Remuneración computable = sueldo + asignación familiar (S/ 113) + **1/6 de la última gratificación**.
- Monto = computable / 12 por mes + computable / 360 por día (base 30 días), menos días de faltas.
- Pequeña empresa: 50 %. Microempresa, tiempo parcial (< 4 h diarias), prácticas y locación: sin CTS.

### Vacaciones al cese (D. Leg. 713 / 1086)
- 30 días por año (general) o 15 (MYPE). Se pagan los **días ganados no gozados** y los **truncos**
  (proporcional del año en curso, por meses y días).
- Valor diario = computable / 30. Lo gozado en adelanto (D. Leg. 1405) se descuenta de lo trunco.
- Advierte posible **triple pago** si hay descansos vencidos sin gozar.

### Indemnización por despido arbitrario (solo si RR. HH. lo indica)
- General indeterminado: 1.5 sueldos por año (tope 12). Plazo fijo: 1.5 sueldos por mes que faltaba (tope 12).
- Pequeña empresa: 20 remuneraciones diarias por año (tope 120). Microempresa: 10 (tope 90).

### Liquidación
Total = CTS trunca + gratificación trunca + bonificación 9 % + vacaciones + (indemnización).
Descuentos = ONP/AFP sobre vacaciones + **saldo pendiente de adelantos de sueldo** + otros. El neto nunca
es negativo; si el saldo de adelantos supera la liquidación, se avisa que queda deuda del trabajador.
El servicio continuo se cuenta desde el **primer contrato de la cadena de renovaciones**.

## 4. API

### `GET /api/payroll/social-benefits?type=gratificacion|cts&year=2026&half=1|2`
Permiso `planilla.ver`. Devuelve el periodo (con fecha límite de pago), una línea por trabajador
(meses, días, faltas, monto, bonificación, total) y los totales para provisionar el pago.

### `GET /api/contracts/{id}/settlement?cutoff=YYYY-MM-DD&arbitrary_dismissal=true&other_deductions=0`
Permiso `planilla.ver`. Contrato cesado → liquidación definitiva (usa la fecha de cese).
Contrato vigente → **simulación** (`simulated: true`) a la fecha indicada o a hoy.

Ambos están documentados con `@openapi` y aparecen en Swagger.

## 5. Ejemplo (mozo, sueldo mínimo S/ 1 130, ingresó 01-mar-2025, cese 31-ago-2026, ONP)
- Gratificación jul–ago: 2/6 × 1 130 = S/ 376.67 + 9 % = S/ 33.90
- CTS may–ago: 4 meses sobre (1 130 + 1 130/6) = S/ 439.44
- Vacaciones: 30 días ya gozados; 15 días truncos
- ONP 13 % solo sobre el pago de vacaciones

## 6. Limitaciones conocidas (para decidir con contabilidad)
- No se persiste la liquidación ni se genera asiento contable: es cálculo/consulta. Se puede agregar
  luego una tabla `settlement` y su asiento (similar a la planilla).
- La última gratificación para la CTS se **estima** como la gratificación completa del régimen.
- Renta de 5.ª categoría no se aplica a la liquidación (casos de sueldos bajos no superan 7 UIT).
- Tasas (RMV, UIT, comisiones AFP) se actualizan en `labor-rules.ts` / `payroll-rules.ts`.

## 7. Verificación
`npx vitest run test/hr` → 80 pruebas pasan · `npx tsc --noEmit` sin errores · ESLint sin avisos.

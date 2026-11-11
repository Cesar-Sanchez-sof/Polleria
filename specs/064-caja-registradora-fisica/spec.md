# Feature Specification: Conexión de apertura y cierre de caja con la caja registradora física

**Created**: 2026-11-11
**Status**: Implemented (modo simulado verificado · modo real pendiente de probar con hardware)
**Spec Number**: 064

---

## 1. Propósito

Que abrir y cerrar caja en el sistema **abra la gaveta de efectivo e imprima el ticket** en la caja física de la
pollería, como hace una caja registradora real. Si no hay hardware (desarrollo, demo, evaluación), funciona en
**modo simulado** y muestra exactamente lo que se habría impreso.

## 2. Qué se hizo

| Pieza | Archivo |
|---|---|
| Driver de dispositivo (ESC/POS, simulado y red TCP) | `lib/services/integrations/cash-drawer.service.ts` |
| Apertura y cierre llaman al dispositivo; nueva «gaveta sin venta» | `lib/services/sales/cash-sessions.service.ts` |
| Endpoint de estado y apertura manual | `app/api/cash-sessions/drawer/route.ts` |
| Variables de entorno de ejemplo | `.env.example.front` |
| Pruebas | `test/services/cash-drawer.service.test.ts`, `test/services/cash-sessions-drawer.test.ts` |

### Flujo
1. **Abrir caja** (`POST /api/cash-sessions`): se crea la sesión y su asiento contable, y se envía a la caja
   física *pulso de gaveta + ticket «APERTURA DE CAJA»* (fondo inicial, cajero, fecha en hora de Lima).
2. **Cerrar caja** (`POST /api/cash-sessions/{id}/close`): se calcula esperado vs. contado, se registran los
   asientos y se envía *pulso + ticket «CIERRE DE CAJA»* con ventas en efectivo, ingresos, egresos,
   esperado, contado y **SOBRANTE/FALTANTE**.
3. **Gaveta sin venta** (`POST /api/cash-sessions/drawer` con `{ reason }`): para dar vuelto o cambiar billetes.
   Exige caja abierta y motivo, y **queda en auditoría** (módulo Caja) por ser un punto de control interno.
4. La respuesta de abrir/cerrar incluye `device: { ok, mode, message, ticket }`.
5. `GET /api/cash-sessions/drawer`: modo activo, destino y, en simulación, los últimos tickets.

### Modos
| Modo | Cuándo | Qué hace |
|---|---|---|
| `simulated` (defecto) | Sin IP configurada o `CASH_DRAWER_MODE=simulated` | Arma ticket y bytes, no toca hardware, guarda los últimos 50 eventos en memoria |
| `network` | La impresora de caja (Configuración → Impresoras) está activa y su «IP o puerto» es `192.168.x.x[:9100]`, o `CASH_DRAWER_MODE=network` | Envía ESC/POS por TCP 9100: `ESC @` + pulso `ESC p 0 25 250` + ticket + corte `GS V B 0` |
| `off` | `CASH_DRAWER_MODE=off` | Sin integración |

**Un fallo del dispositivo nunca bloquea la caja**: si la impresora no responde (3 s de espera) la operación se
registra igual y `device.message` indica abrir la gaveta con la llave.

## 3. Corrección de un error latente en el cierre de caja
Al conectar el cierre se detectó que `closeCashSession` escribía `finalCounted` y leía la relación `invoices`,
que **no existen** en el esquema (`countedAmount` y `salesInvoices`). Como el código usa `(prisma as any)`,
TypeScript no lo detectaba y las pruebas con mocks pasaban, pero **contra una BD real el cierre fallaba**. Ahora
guarda `expectedAmount`, `countedAmount` y `difference`, y se agregó una prueba que lo impide.

## 4. Hardware compatible
Cualquier impresora térmica ESC/POS (Epson TM-T20/T88, Xprinter, Bixolon, etc.) con la gaveta conectada por
cable RJ11/RJ12 a la impresora, y la impresora con red (Ethernet/Wi-Fi) en el puerto 9100.
Los tickets se imprimen sin tildes por la página de códigos de 1 byte de estas impresoras.

## 5. Verificación
- Pruebas: 857 pasan (suites de servicios, caracterización, API, arquitectura, auth y RR. HH.); `tsc` y ESLint limpios.
- La prueba de modo red levanta un servidor TCP local y comprueba los bytes exactos recibidos
  (`1B 40`, `1B 70 00 19 FA`, texto del ticket y `1D 56 42 00`).

## 6. Limitaciones
- No probado con una impresora/gaveta real (ver «lista de verificación»).
- La bitácora simulada vive en memoria del proceso: se pierde al reiniciar y no se comparte entre instancias.
- Conexiones USB/serial directas desde el navegador no están soportadas: el servidor debe alcanzar la
  impresora por red. Para USB local haría falta un agente de impresión en la PC de caja.
- No hay pantalla de caja en el frontend (solo API), así que el ticket simulado se ve en la respuesta JSON y en
  `GET /api/cash-sessions/drawer`.

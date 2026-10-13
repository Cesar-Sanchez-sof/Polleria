# Research: Consultar Cuenta Contable (detalle)

**Feature**: `024-consultar-cuenta-contable` | **Date**: 2026-10-12

La spec no contiene marcadores `[NEEDS CLARIFICATION]`: la investigación se centró en confirmar el
estado real de implementación, en las convenciones del repo (Next.js 16 / Prisma / Vitest) y en los
huecos detectados (documentación OpenAPI, ausencia de consumidor front-end). Toda decisión afecta a
la verificación del plan, no a decisiones de construcción nuevas.

---

## D1 — Superficie exacta de la feature (alcance)

- **Decision**: La feature es **únicamente** la consulta individual `GET /api/accounts/{id}`
  (`app/api/accounts/[id]/route.ts`, handler `GET`). El listado `GET /api/accounts` pertenece a la
  spec `003-listado-cuentas-contables` y la creación `POST` a la spec `004-crear-cuenta-contable`;
  el `PATCH` de la misma ruta queda fuera de alcance (edición).
- **Rationale**: `grep` sobre `specs/` confirma que ningún endpoint de cuentas tenía spec propia de
  consulta individual; el usuario pidió "consultar cuentas contables" y el listado ya está cubierto,
  de modo que el detalle era el único hueco sin especificar.
- **Alternatives considered**:
  - *Especificar el listado otra vez*: descartado — duplicaría la spec 003.
  - *Incluir `PATCH` (edición/cambio de estado)*: descartado — son operaciones distintas con
    validaciones propias (jerarquía, unicidad de código) ya descritas como contexto en la spec 004.

## D2 — Estado de implementación: ya construido y probado

- **Decision**: La funcionalidad **ya está implementada y cubierta por pruebas**; el plan es de
  **verificación** (ejecutar la suite existente + comprobaciones manuales) y no de desarrollo.
- **Rationale**: `GET` en `app/api/accounts/[id]/route.ts` (líneas 61–90) implementa exactamente
  FR-001…FR-010 de la spec; `app/api/accounts/[id]/route.test.ts` (`describe("GET /api/accounts/[id]")`)
  valida `200` con formato público, `404` inexistente y `400` con id no numérico sin tocar la BD.
- **Alternatives considered**:
  - *Reescribir el endpoint*: descartado — sin requisito que justifique el riesgo de romper el
    contrato público.
  - *Construir una nueva pantalla de detalle*: descartado — la spec delimita la feature a nivel de
    servicio (ver Assumptions de la spec); una UI sería otra feature.

## D3 — Formato de respuesta: objeto plano sin envoltorio

- **Decision**: El detalle responde el objeto `AccountApi` **directamente** (sin `{ data: ... }`),
  a diferencia del listado. Se documenta como regla consciente (BR-4) y **no** se "unifica" con el
  listado.
- **Rationale**: cambiar el envoltorio rompería cualquier consumidor futuro del detalle; la
  estabilidad del contrato prima (los campos en español ya son el contrato público desde la spec
  003).
- **Alternatives considered**: envolver en `{ data: [...] }` por consistencia con el listado —
  descartado por breaking change sin beneficio observable.

## D4 — Tolerancia del identificador (`parseInt`)

- **Decision**: Mantener la lectura tolerante actual: `Number.parseInt(idParam, 10)` acepta prefijos
  numéricos (`01` → 1, ` 7` → 7, `7abc` → 7); sólo responde `400` cuando no hay dígitos iniciales.
  Está elevado a regla de negocio BR-5 de la spec.
- **Rationale**: endurecer a un patrón estricto (`/^\d+$/`) cambiaría el comportamiento observable
  (hoy `GET /api/accounts/7abc` devuelve `200`) sin ningún requisito de negocio; el orden de
  validación ya está cubierto por el test del `400`.
- **Alternatives considered**: validación estricta del identificador — descartada; se registra como
  posible mejora futura si se desea (rompería BR-5).

## D5 — Identificador perdido en el cliente interno (hueco, no bloqueante)

- **Decision**: **No** se añade `getAccount(id)` a `lib/services/accounts.service.ts` en esta
  feature. Se documenta como *follow-up* opcional para una futura "pantalla de detalle de cuenta".
- **Rationale**: la spec delimita la feature al servicio de consulta; hoy ningún consumidor
  interno necesita el detalle (la página de cuentas construye su vista con el listado y la edición
  usa el objeto de la fila). Añadir código sin consumidor viola YAGNI.
- **Alternatives considered**: añadir el método "por si acaso" — descartado por código muerto;
  conectarlo a la UI de edición — descartado por salir del alcance de la spec.

## D6 — Documentación OpenAPI rota (único trabajo pendiente detectado)

- **Decision**: Corregir la documentación del **GET** del detalle: añadir el esquema `Account` en
  `app/api/openapi/swaggerConfig.ts` (campos del formato público, con ejemplo) y ajustar la
  anotación `@openapi` del `GET` para documentar `400`/`404`/`500` con el esquema `Error` ya
  existente. Es el **único cambio de código** del plan, y es documental.
- **Rationale**: la anotación actual referencia `#/components/schemas/Account`, que **no existe**
  en `swaggerDefinition.components.schemas` (sólo `Error`, `AccountingPeriod`, `NewAccountingPeriod`),
  por lo que Swagger UI muestra un `$ref` colgante; las respuestas de error del GET tampoco están
  documentadas. La corrección elimina la deuda detectada análogamente en la spec 003 (NFR-003).
- **Alternatives considered**:
  - *No tocar nada*: descartado — la documentación servida en `/swagger` miente sobre el recurso.
  - *Corregir también la anotación del `PATCH`*: descartado por alcance (su enum en inglés
    `"ACTIVO"` no coincide con los tipos PCGE en español reales); se anota como known issue
    perteneciente a la spec de edición.

## D7 — Estrategia de verificación (pruebas)

- **Decision**: La verificación se apoya en la suite Vitest colocada (`app/api/accounts/[id]/route.test.ts`)
  con mocks de Prisma, más comprobaciones manuales contra BD real (ver `quickstart.md`). Sin nuevas
  suites ni framework de pruebas.
- **Rationale**: es la convención del repo (pruebas colocadas, `vi.mock` de `@/lib/prisma`,
  ejecución con `npm test`); la spec ya afirma su comportamiento apoyado en esas pruebas.
- **Alternatives considered**: pruebas de integración contra Postgres real — descartadas por
  complejidad; el proyecto no tiene infraestructura de BD de pruebas.

## D8 — Convenciones de Next.js 16 al tocar la ruta

- **Decision**: Cualquier edición futura sobre `app/api/accounts/[id]/route.ts` debe leerse contra
  `node_modules/next/dist/docs/` (indicación de `AGENTS.md`): los route handlers de esta versión
  reciben `params` como `Promise` y se resuelve con `await` (ya implementado así). Esta feature no
  modifica la ruta, sólo la config OpenAPI, por lo que el riesgo es nulo.
- **Rationale**: la versión instalada (`next` 16.3.5) tiene cambios rupturados respecto de
  versiones anteriores; los agentes deben guiararse por la documentación empaquetada.
- **Alternatives considered**: basarse en conocimiento previo de Next.js — descartado por la
  advertencia explícita del repo.

## D9 — Caché y dinamismo

- **Decision**: Conservar `export const dynamic = "force-dynamic"` en la ruta; ninguna capa de
  caché (Redis/S3 presentes en el proyecto) se interpone en la consulta del detalle.
- **Rationale**: el detalle debe reflejar el estado actual de la cuenta (SC de la spec); el
  proyecto ya usa `force-dynamic` en las rutas del plan contable.
- **Alternatives considered**: cachear el detalle — descartado; el volumen no lo justifica y
  desincronizaría `activo`/`usos` tras cada alta/edición de asientos.

## D10 — Autenticación: la capa global de sesión está activa (descubrimiento en implementación)

- **Decision**: Documentar y respetar que **`proxy.ts` (middleware de Next.js 16) está activo** y
  exige cookie de sesión válida para casi todas las rutas (excepciones: `/login`, `/api/auth`,
  `/api/webhooks`); sin ella, `GET /api/accounts/{id}` responde `401 {"error":"No autenticado"}`
  antes de llegar al manejador. El manejador en sí **no** valida sesión ni rol (por eso las pruebas
  unitarias, que lo invocan directamente, pasan sin sesión). La validación manual se hace
  autenticándose previamente (`POST /api/auth/login`).
- **Rationale**: verificado en vivo el 2026-10-12 (petición anónima → `401`; con cookie → `200`).
  Las afirmaciones previas de "no hay middleware de autorización" (specs 003/004 y el borrador de
  esta spec) provenían de un estado antiguo del proyecto (`proxy.ts.desactivado`); el archivo está
  ahora en la raíz y en uso (el propio `next dev` lo compila).
- **Alternatives considered**:
  - *Afirmar que la ruta es anónima*: descartado — falso en el sistema real.
  - *Deshabilitar el proxy para la feature*: descartado — decisión de arquitectura ajena a esta
    spec y con implicaciones de seguridad.
- **Observación fuera de alcance**: `requireRole` de `app/api/accounting-periods/route.ts` espera
  una cookie `auth-token` (que la aplicación no emite) y un usuario con id fijo `3`, por lo que
  `POST`/`PATCH` de períodos responden `500 "Unauthorized: user not found"` en la práctica. Afecta
  al dominio de la spec `001`; para verificar `usos` (T010) se creó el período de octubre 2026
  como fixture directo de base de datos.

---

## Resumen de unknowns de Technical Context

| Unknown original | Estado |
|------------------|--------|
| Language/Version | Resuelto: TypeScript + Next.js 16.3.5 (D8) |
| Primary Dependencies | Resueltos: Prisma 6, swagger-jsdoc (D6, D8) |
| Storage | Resuelto: PostgreSQL vía Prisma (D7) |
| Testing | Resuelto: Vitest colocada (D7) |
| Project Type | Resuelto: web application única (D2) |
| Performance/Constraints | Resueltos: consulta única indexada, formato estable, sin caché (D3, D4, D9) |

**No quedan NEEDS CLARIFICATION sin resolver.**

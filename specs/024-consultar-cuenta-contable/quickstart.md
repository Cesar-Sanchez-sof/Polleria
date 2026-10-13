# Quickstart: Consultar Cuenta Contable (detalle)

**Feature**: `024-consultar-cuenta-contable` | **Date**: 2026-10-12

Guía de validación de la consulta individual de una cuenta contable. La feature está **implementada**
(este documento la verifica, no la construye); el único cambio pendiente del plan es la corrección
documental OpenAPI (research D6).

## Prerrequisitos

- Node.js y dependencias instaladas (`npm install`).
- Base de datos PostgreSQL accesible con `DATABASE_URL` configurado en `.env`.
- Plan contable sembrado: `npm run db:seed` (crea las cuentas raíz y subcuentas de referencia).
- Referencia de contratos: [`contracts/accounts-detail.openapi.yaml`](./contracts/accounts-detail.openapi.yaml)
  y [`data-model.md`](./data-model.md).

## 1. Verificación automática (pruebas colocadas)

```powershell
npm test
```

**Resultado esperado**: la suite de `app/api/accounts/[id]/route.test.ts` pasa, incluyendo el bloque
`describe("GET /api/accounts/[id]")`:

| Caso | Resultado esperado |
|------|--------------------|
| Cuenta existente | `200` con `{ id, codigo, nombre, tipo, idPadre, activo, usos }` exactos |
| Cuenta inexistente (`9999`) | `404` |
| Identificador no numérico (`cualquiera`) | `400` `{ error: "Identificador de cuenta inválido." }` y la base de datos **no** se consulta |
| Fallo de base de datos | `500` `{ error: "No se pudo obtener la cuenta contable." }` y `console.error` registrado |

> **Nota**: las pruebas unitarias invocan el **manejador** de la ruta directamente (sin pasar por
> el middleware de sesión), por lo que validan el comportamiento del handler con sesión efectiva.

## 2. Verificación manual contra la aplicación

> **Requisito de sesión**: el middleware de sesión de la aplicación (`proxy.ts`) está activo y
> exige cookie válida para casi todas las rutas. Primero inicia sesión y usa la cookie en el resto
> de peticiones (credenciales del seed de `npm run db:seed`; la contraseña por defecto del usuario
> `admin` está definida en `prisma/seed.ts`):

```powershell
npm run dev
# PowerShell 5.1+: -SessionVariable captura la cookie de sesión
Invoke-WebRequest -Uri http://localhost:3000/api/auth/login -Method POST `
  -Body '{"username":"admin","password":"Password123!"}' -ContentType 'application/json' `
  -UseBasicParsing -SessionVariable sess
# Comprobación previa: sin cookie se espera 401 "No autenticado" (capa global de sesión)
try { Invoke-WebRequest -Uri http://localhost:3000/api/accounts -UseBasicParsing } catch { $_.Exception.Response.StatusCode.value__ }
```

Paso 2a — obtener un identificador real desde el listado (spec 003):

```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/accounts -WebSession $sess
```

Elegir el `id` de alguna cuenta del arreglo `data` (p. ej. `8`).

Paso 2b — casos de la consulta del detalle (siempre con `-WebSession $sess`):

```powershell
# 200: detalle con los 7 campos (objeto plano, sin envoltorio "data")
Invoke-WebRequest -Uri http://localhost:3000/api/accounts/8 -WebSession $sess -UseBasicParsing

# 404: identificador numérico inexistente
Invoke-WebRequest -Uri http://localhost:3000/api/accounts/999999 -WebSession $sess -UseBasicParsing

# 400: identificador sin dígitos (además verifica que no toca la base de datos)
Invoke-WebRequest -Uri http://localhost:3000/api/accounts/abc -WebSession $sess -UseBasicParsing

# BR-5: prefijo numérico tolerante -> resuelve a la cuenta 8
Invoke-WebRequest -Uri http://localhost:3000/api/accounts/8abc -WebSession $sess -UseBasicParsing
```

**Comprobaciones esperadas**

| Escenario | Código | Cuerpo |
|-----------|--------|--------|
| Cuenta existente (activa o inactiva) | `200` | Objeto con `id`, `codigo`, `nombre`, `tipo`, `idPadre`, `activo`, `usos` |
| Subcuenta | `200` | `idPadre` = id de la cuenta padre; cuenta raíz → `idPadre: null` |
| Inexistente | `404` | `{ "error": "Cuenta contable no encontrada." }` |
| No numérico | `400` | `{ "error": "Identificador de cuenta inválido." }` |
| Cuenta sin movimientos | `200` | `usos: 0` |
| Sin cookie de sesión | `401` | `{ "error": "No autenticado" }` (capa global de sesión `proxy.ts`; no llega al manejador) |

Paso 2c — consistencia de `usos` (opcional, con acceso a la BD):

1. Anotar el `usos` de una cuenta.
2. Registrar un asiento manual que use esa cuenta (spec `002-registrar-asiento-manualmente`).
3. Volver a consultar el detalle → `usos` debe haber aumentado en 1 (la consulta nunca usa caché).

## 3. Verificación de la documentación OpenAPI (trabajo pendiente del plan)

> La ruta `/api/openapi` también pasa por el middleware de sesión: petición autenticada
> (`-WebSession $sess`) o `401`.

1. Abrir `http://localhost:3000/swagger` (o `http://localhost:3000/api/openapi` como JSON, con
   sesión).
2. **Antes de aplicar el cambio (D6)**: la operación `GET /api/accounts/{id}` referencia un
   esquema `Account` inexistente (dangling `$ref`); sus respuestas `400`/`404`/`500` aparecen con
   descripción pero **sin** esquema ni ejemplo.
3. **Después de aplicar el cambio**: el esquema `Account` se muestra con los 7 campos y sus
   ejemplos, y las respuestas `400`, `404` y `500` quedan vinculadas al esquema `Error` con sus
   mensajes exactos, coincidiendo con
   [`contracts/accounts-detail.openapi.yaml`](./contracts/accounts-detail.openapi.yaml).

## Criterios de aceptación cubiertos

- SC-001 a SC-007 de la spec: una sola consulta por identificador, `400` sin tocar la BD,
  `404` para inexistentes, `500` con log ante fallos, cuentas inactivas consultables, formato
  idéntico al del listado y `usos` consistente.

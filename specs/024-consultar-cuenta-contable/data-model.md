# Data Model: Consultar Cuenta Contable (detalle)

**Feature**: `024-consultar-cuenta-contable` | **Date**: 2026-10-12

La feature es de **solo lectura** y no modifica el modelo de datos: **no se requiere ninguna
migración**. Se documentan las entidades que participan en la consulta y su proyección al contrato
público.

---

## 1. Cuenta contable (persistencia)

Entidad maestra del plan contable. Fuente: `prisma/schema.prisma` → `model AccountingAccount`
(tabla `accounting_account`).

| Campo         | Tipo                     | Restricciones / Notas                                                 |
|---------------|--------------------------|-----------------------------------------------------------------------|
| `id`          | Int (autoincremental)    | Clave primaria; identificador usado en la ruta `{id}`                 |
| `parentId`    | Int?                     | Autorreferencia jerárquica; `null` = cuenta raíz                      |
| `code`        | String (`VarChar(10)`)   | **Único** en toda la tabla (`@unique`); admite `[A-Za-z0-9.-]{1,10}`  |
| `name`        | String (`VarChar(100)`)  | Nombre visible de la cuenta                                           |
| `type`        | String (`VarChar(20)`)   | Catálogo PCGE cerrado en la API: Activo, Pasivo, Patrimonio, Ingreso, Gasto, Costo |
| `active`      | Boolean (defecto `true`) | Estado; su cambio lo gestiona el `PATCH` (fuera de alcance)           |
| `createdAt`   | DateTime                 | Marca de alta (no se expone en la consulta)                           |
| `updatedAt`   | DateTime                 | Marca de última modificación (no se expone en la consulta)            |

**Relaciones**

- `parentAccount` / `childAccounts`: autorrelación `AccountHierarchy` (cuenta padre ↔ subcuentas),
  con `onDelete: Restrict` — una cuenta con subcuentas **no puede eliminarse** (por eso el sistema
  desactiva en lugar de borrar).
- `entryDetails`: líneas de asiento (`JournalEntryDetail[]`) que usan la cuenta; su **conteo** es lo
  que la consulta expone como `usos`.

**Invariantes relevantes para la consulta**

- Un `id` identifica a exactamente una cuenta (lo que hace posible el `404`).
- `usos` es derivado (contador de líneas de asiento), nunca se almacena.
- El estado `active` no filtra la consulta: una cuenta inactiva es consultable igual que una activa
  (BR-3 de la spec).

## 2. Proyección de la consulta (`ACCOUNT_SELECT`)

La consulta selecciona únicamente los campos necesarios, en una sola llamada
(`findUnique` + contador embebido), sin N+1:

| Campo seleccionado          | Uso en la respuesta            |
|-----------------------------|--------------------------------|
| `id`                        | `id`                           |
| `code`                      | `codigo`                       |
| `name`                      | `nombre`                       |
| `type`                      | `tipo`                         |
| `parentId`                  | `idPadre`                      |
| `active`                    | `activo`                       |
| `_count.entryDetails`       | `usos`                         |

Definido en `lib/chart-of-accounts.ts` (`ACCOUNT_SELECT`), compartido con el listado (spec 003).

## 3. Formato público (contrato)

Representación expuesta por `GET /api/accounts/{id}` (`toAccountApi` en `lib/chart-of-accounts.ts`).
Es **idéntica** a la de cada elemento del listado del plan contable; la única diferencia con el
listado es que el detalle **no** se envuelve en `{ data: [...] }` (BR-4).

| Campo     | Tipo            | Descripción                                              | Ejemplo     |
|-----------|-----------------|----------------------------------------------------------|-------------|
| `id`      | integer         | Identificador numérico de la cuenta                      | `7`         |
| `codigo`  | string (≤10)    | Código único de la cuenta                                 | `"104"`     |
| `nombre`  | string (≤100)   | Nombre de la cuenta                                       | `"Bancos"`  |
| `tipo`    | string (PCGE)   | Activo, Pasivo, Patrimonio, Ingreso, Gasto, Costo        | `"Activo"`  |
| `idPadre` | integer \| null | Cuenta padre; `null` en cuentas raíz                      | `null`      |
| `activo`  | boolean         | Estado de la cuenta                                        | `true`      |
| `usos`    | integer ≥ 0     | Líneas de asiento que usan la cuenta (derivado)           | `4`         |

## 4. Línea de asiento (fuente de `usos`)

`JournalEntryDetail` (`prisma/schema.prisma`) referencia a la cuenta mediante `accountId`. La
consulta del detalle **no** expande estas líneas: sólo cuenta cuántas hay. Consultar el detalle no
trae movimientos; el detalle de movimientos de una cuenta pertenece al libro mayor (spec
`013-consultar-libro-mayor`).

## 5. Máquina de estados

No aplica para esta feature (solo lectura). El único estado de negocio de la cuenta es el booleano
`active`:

```text
[inactiva] <--(PATCH: activo=false, fuera de alcance)--> [activa]
```

La consulta observa ambos estados sin transiciones propias (FR-005).

## 6. Reglas de validación de esta feature

La única validación de entrada es el **identificador de la ruta** (FR-003):

| Entrada del `{id}`          | Resultado                                          | Toca la BD |
|-----------------------------|----------------------------------------------------|------------|
| Prefijo numérico entero (`7`, `01`, ` 7`, `7abc`) | Se resuelve a ese número y se consulta | Sí         |
| Sin dígitos iniciales (`abc`, vacío, `NaN`)       | `400` "Identificador de cuenta inválido."          | No         |
| Número sin cuenta asociada (p. ej. `999999`)      | `404` "Cuenta contable no encontrada."             | Sí (y no encuentra) |
| Cualquier excepción inesperada                    | `500` "No se pudo obtener la cuenta contable." + log | Sí     |

## 7. Impacto en el esquema

- **Migraciones**: ninguna.
- **Modelos nuevos/modificados**: ninguno.
- **Cambios documentales**: añadir el esquema `Account` al contrato OpenAPI servido
  (`app/api/openapi/swaggerConfig.ts`) — ver `contracts/accounts-detail.openapi.yaml` y research D6.

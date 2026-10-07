# Módulo de Auditoría

Cubre las historias de usuario:

- **Registrar logs de cambios para auditoría** (0.5 pt)
- **Listar logs de auditoría** (0.5 pt)

## 1. Qué registra cada movimiento

| Campo (BD `audit_log`) | Contenido |
| --- | --- |
| `created_at` | Fecha y hora exacta del movimiento (servidor) |
| `user_id` / `username` | Usuario que lo hizo (el username se copia para conservarlo) |
| `action` | `CREATE`, `UPDATE`, `DELETE`, `STATUS_CHANGE`, `LOGIN`, `LOGIN_FAILED`, `LOGOUT` |
| `module` | Módulo: Seguridad, Usuarios, Contabilidad, Compras, Ventas, Caja |
| `entity` / `entity_id` | Entidad afectada (ej. "Cuenta contable" #12) |
| `description` | Frase legible: "Desactivó al usuario ana" |
| `details` (JSONB) | Detalle: `{ antes, despues }` u otros datos. Claves `password`, `token`, `secret`, `hash` se guardan como `[oculto]` |
| `ip_address` | IP del cliente (`x-forwarded-for` / `x-real-ip`) |

La tabla es solo de **inserción**: la aplicación no expone ni edita ni elimina.

## 2. Arquitectura

```
Ruta API (POST/PATCH...) ──► registrarAuditoria()  ──► tabla audit_log
                                  lib/services/audit.service.ts
GET /api/audit-logs ──► listarAuditoria() ──► pantalla /audit
```

- `lib/services/audit.service.ts`: `registrarAuditoria` (nunca lanza error; si falla solo escribe en el log del servidor para no romper la operación de negocio), `listarAuditoria`, `construirFiltro`, `sanearDetalles`.
- `lib/auth/actor-auditoria.ts`: obtiene el usuario de la sesión (`null` si no hay).
- `app/api/audit-logs/route.ts`: listado (solo rol `ADMIN`; 401 sin sesión, 403 otro rol).
- `app/audit/page.tsx`: pantalla con filtros y paginación; enlace en el menú lateral (SEGURIDAD → Auditoría).

### Eventos auditados hoy

| Módulo | Evento | Acción |
| --- | --- | --- |
| Usuarios | Crear / modificar usuario | `CREATE` / `UPDATE` |
| Usuarios | Activar / desactivar | `STATUS_CHANGE` |
| Seguridad | Login correcto / fallido / logout | `LOGIN` / `LOGIN_FAILED` / `LOGOUT` |
| Contabilidad | Crear cuenta / modificar cuenta | `CREATE` / `UPDATE` |
| Contabilidad | Registrar asiento | `CREATE` |
| Contabilidad | Crear período / cerrar o reabrir | `CREATE` / `STATUS_CHANGE` |

### Cómo auditar un módulo nuevo (compras, ventas, caja…)

```ts
await registrarAuditoria({
  actor: await actorActual(),
  action: "CREATE",
  module: "Compras",
  entity: "Compra",
  entityId: compra.id,
  description: `Registró la compra #${compra.id}`,
  details: { despues: compra },
  ipAddress: ipDeSolicitud(request),
});
```

Dentro de una transacción Prisma pasa el `tx` como segundo argumento para que el log se confirme o revierta junto con el cambio.

## 3. API: `GET /api/audit-logs`

Parámetros opcionales: `desde`, `hasta` (YYYY-MM-DD, `hasta` incluye todo el día), `usuario` (contiene), `accion`, `modulo`, `q` (descripción/entidad/id), `pagina` (1), `porPagina` (20, máx. 100).

Respuesta:

```json
{
  "datos": [{ "id": 1, "fecha": "2026-10-07T15:04:05.000Z", "usuario": "admin", "accion": "UPDATE",
              "modulo": "Usuarios", "entidad": "Usuario", "idEntidad": "4",
              "descripcion": "Modificó el usuario ana", "detalles": {}, "ip": "10.0.0.1" }],
  "total": 1, "pagina": 1, "porPagina": 20, "totalPaginas": 1,
  "modulos": ["Seguridad", "..."], "acciones": ["CREATE", "..."]
}
```

## 4. Base de datos

Migración: `prisma/migrations/20261007120000_add_audit_log/migration.sql` (enum `audit_action`, tabla `audit_log`, índices por fecha, usuario y módulo/entidad, FK a `app_user` con `ON DELETE SET NULL`).

## 5. Pruebas

`lib/services/audit.service.test.ts` (vitest): guardado completo, tolerancia a fallos, sanitización de secretos, filtros de fecha/usuario/acción, paginación.

Ejecutar: `npm test`.

## 6. Verificación manual (criterios de aceptación)

1. Inicia sesión como `admin`; crea un usuario → en `/audit` aparece una fila `Creación · Usuarios` con fecha, hora y tu usuario.
2. Desactiva ese usuario → fila `Cambio de estado`; pulsa **Ver cambios** y verás `antes/después`.
3. Filtra por fecha, usuario, acción y módulo; verifica la paginación.
4. Entra con un usuario no ADMIN → `/api/audit-logs` responde 403.
5. Login con clave errónea → fila `Login fallido`.
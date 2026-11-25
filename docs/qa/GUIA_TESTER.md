# Guía del tester — Seguridad y RR. HH.

Casos de prueba: `docs/qa/casos_de_prueba_polleria_v2.xlsx` (hoja **Matriz de Pruebas** + una hoja por área).
Marca cada caso como `PASE` u `OBSERVADO` en la matriz y anota lo que veas en «Comentarios».

## 1. Preparación (una vez)

```bash
npm install
npx prisma migrate deploy
npm run dev                          # el predev siembra solo si la base está vacía
node scripts/qa-prepare.mjs          # crea contador.prueba (lo piden 14 casos)
```

Abre http://localhost:3000/login.

## 2. Cuentas de prueba

| Usuario | Clave | Rol | Para qué |
|---|---|---|---|
| `admin` | `Password123!` | ADMIN | Todo el sistema |
| `mvega` | `Demo2026!` | RRHH | Contratar, horarios, planilla, contratos |
| `rquispe` | `Demo2026!` | CAJERO | Verificar que NO ve RR. HH. ni Seguridad |
| `lramirez` | `Demo2026!` | MESERO | Autoservicio de un trabajador |
| `ctorres` | `Demo2026!` | COCINERO | Autoservicio de un trabajador |
| `jhuaman` | `Demo2026!` | COCINERO | Segundo trabajador (probar que no ve datos de otro) |
| `contador.prueba` | `Prueba2026a` | CONTADOR | Casos de contabilidad y planilla |

Los 9 trabajadores demo tienen DNI `70000001…70000009`; solo 5 tienen usuario.

## 3. Flujo de contratación (el más importante)

1. Entra como **`mvega`** → menú **RR. HH. → Personal** → **Contratar personal**.
2. Completa los pasos: **Datos personales → Contrato → Horario → Acceso al sistema → Confirmar**.
   - Contrato: el cargo, área, modalidad y sueldo (mínimo S/ 1 130 en planilla general).
   - Horario: elige turnos por día. **Debe quedar al menos un día de descanso** y no pasar de 48 h semanales.
   - Acceso: elige el **rol** (el desplegable muestra los roles activos; **ADMIN no aparece asignable** para RR. HH.), usuario, correo y contraseña (8+ con letras y números).
3. Al confirmar sale la **tarjeta de credenciales** (usuario y clave). **Se muestra una sola vez**: anótala.
4. Verifica en la ficha del empleado: contrato vigente, horario pactado y «Con usuario».
5. Cierra sesión y entra con el usuario nuevo:
   - Solo debe ver los menús que su rol permite (un MESERO no ve RR. HH. ni Seguridad).
   - **RR. HH. → Mi horario** muestra su horario, asistencia y boletas.
   - Si hoy tiene turno y está dentro de la ventana (desde 1 h antes del inicio hasta el fin del turno), el login **marca la entrada** (origen «Inicio de sesión»). Fuera de esa ventana avisa «Tu turno empieza a las…» y no marca: es lo esperado. Para ver la marcación automática, contrata con un turno que cubra la hora actual.
6. Como `admin`, **Seguridad → Auditoría**: deben aparecer la contratación y la creación del usuario.

## 4. Vistas que debes recorrer

**RR. HH. (como `mvega`)**
- **Directorio** (`/hr/directory`): lista de todo el personal con búsqueda (nombre, DNI o cargo), filtro por área y estado (Activos/Cesados/Todos). Al elegir un empleado se ven sus datos, contrato y **turnos de la semana** (con navegación semana a semana y «Hoy»), más el horario pactado.
- Personal, Contratos, Horarios, Asistencia, Vacaciones y permisos, Seguros y adelantos, Planilla.

**Trabajador (como `lramirez` / `ctorres`)**
- **Mi horario** (`/hr/me`): horario, asistencia, boletas, solicitud de adelanto y de licencia.
- Debe recibir **403** al llamar `/api/employees`, `/api/payroll`, `/api/users`.

**Seguridad (como `admin`)**
- Usuarios, Roles (incluye la sección **Tableros** con Ver / Editar diseño), Auditoría.

## 5. Cómo se bloquea el acceso (para no confundir un resultado)

- **Páginas**: la restricción por rol la aplica el navegador (`RouteGuard`). Si escribes la URL de una pantalla sin permiso, ves «sin acceso» o te redirige; el HTML inicial sí se descarga.
- **Datos**: la restricción real está en la API. Sin permiso → **403**; sin sesión → **401**. Esto se prueba abriendo `/api/...` con la sesión de ese usuario.

## 6. Reglas con las que contrastar resultados

| Tema | Regla |
|---|---|
| Sueldo mínimo (RMV) | S/ 1 130 en planilla general |
| ONP | 13 % |
| AFP | 10 % aporte + 1,37 % seguro + comisión de la AFP |
| EsSalud | 9 % a cargo del empleador |
| Asignación familiar | 10 % de la RMV (S/ 113) |
| Horas extra | 25 % las 2 primeras, 35 % las siguientes |
| Tardanza | tolerancia de 10 min (9 min no es tardanza, 11 sí) |
| Jornada | máx. 48 h semanales; practicante 6 h/día y 30 h/sem |
| Adelanto | máx. 50 % del sueldo, hasta 3 cuotas, uno en curso a la vez |
| Contraseña | 8+ caracteres con letras y números |
| Usuario | 3 a 20 caracteres: minúsculas, números, `.` `-` `_` |

## 7. Limitaciones conocidas (no son defectos de la prueba)

- No hay límite de intentos de login fallidos ni recuperación de contraseña desde la pantalla de login.
- La marcación automática al iniciar sesión depende de la hora real: el trabajador debe tener turno hoy y estar en ventana.
- Un horario de 7 días sin descanso se rechaza a propósito.

## 8. Recorrido automático de apoyo

Antes de empezar (o después de un cambio) puedes comprobar la API en un minuto:

```bash
node scripts/qa-smoke-rrhh-seguridad.mjs   # 100 comprobaciones del camino feliz y errores esperados
npx tsx prisma/qa-cleanup.ts               # borra lo que dejó (DNI 999xxxxx, usuarios qa.*, roles «QA …»)
```

## 9. Reiniciar los datos de prueba

- Quitar solo los trabajadores demo de RR. HH.: `npx tsx prisma/seed-hr-demo.ts --remove`
- Volver a cargarlos: `npx tsx prisma/seed-hr-demo.ts --reset`
- Vaciar RR. HH. y Seguridad (conserva `admin`, auditoría y todo el negocio): primero `npm run db:backup` y luego `npx tsx prisma/reset-hr-security.ts --yes`. **Es destructivo e irreversible**; revisa a qué base apunta tu `DATABASE_URL` antes de correrlo.

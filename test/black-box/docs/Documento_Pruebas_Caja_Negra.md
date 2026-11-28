# Documento de Pruebas de Caja Negra

**Sistema:** Pollería ERP (Pollería Los Betos)
**Entorno probado:** https://polleriaerp.tech (versión desplegada, anterior al commit `436d81c` «feat: filtros»)
**Fecha de ejecución:** 26 y 27/11/2026
**Plan de origen:** `docs/qa/casos_de_prueba_polleria_v2.xlsx` (238 casos)
**Resultados detallados:** `docs/qa/casos_de_prueba_polleria_v2_resultados.xlsx` (celeste = PASE, naranja = OBSERVADO, sin color = no ejecutado)

## Tipo de prueba a realizar

Pruebas de **caja negra** de nivel funcional. Se envían entradas al sistema (por pantalla o por la API real, con una sesión autenticada) y se compara la respuesta con el resultado esperado del plan, sin evaluar el código interno. Es la técnica de las pruebas funcionales y, al recorrer varias capas a la vez (ruta, servicio, base de datos y asientos contables), también tiene carácter de integración.

## Descripción

Se anota lo que se probó (funcionalidad) y, en cada escenario, lo siguiente:

- Todo lo que está fuera de los módulos
- Interfaces
- Respuesta a las entradas
- Integridad de datos (totales, saldos, asientos)
- Evaluación de diferentes escenarios
- Respuestas de la aplicación
- Secuencia de mensajes

## Resumen de la ejecución

| Resultado | Casos |
|---|---|
| PASE | 196 |
| OBSERVADO | 34 |
| NO EJECUTADO | 8 |
| **Total del plan** | **238** |

### Casos OBSERVADOS

| Caso | Hallazgo |
|---|---|
| 1.5, 1.7, 8.4 | Un usuario no vinculado a un empleado (CAJERO `alta.qa1`) inició y cerró sesión y no quedó ninguna marca de asistencia: ni entrada al iniciar sesión ni salida al cerrarla. |
| 2.9 | El cambio de rol de un usuario funciona, pero la auditoría no guarda el rol anterior. |
| 3.14, 3.15, 22.4 | El formulario del rol no tiene sección de tableros y el despliegue no devuelve el acceso por rol a tableros; no se puede asignar ni comprobar su efecto en el usuario. |
| 5.2 | El rol elegido en la contratación no define los permisos del trabajador como indica el plan. |
| 5.15, 5.16, 5.17 | El directorio de personal responde 404 en el sitio desplegado. |
| 6.12 | La adenda de sueldo sobrescribe el contrato y no guarda historial de sueldo. |
| 7.11 | No existe la vista Lista de horarios. |
| 8.9 | La corrección de asistencia funciona y queda en la bitácora, pero el listado muestra la entrada con origen «Manual» y no «Corrección de RR. HH.». |
| 12.1, 12.2, 12.3, 12.4, 12.6 | La versión desplegada devuelve 400 «El rango no puede superar 62 días» al consultar gratificaciones, CTS y liquidaciones. El repositorio ya trae el arreglo (commit `d0cba77`), pero no está desplegado. |
| 14.6 | Mover un pedido de mesa no funciona: `PUT /api/orders/{id}` con `tableId` responde 200 y el pedido no se mueve. No existe esa función en el código. |
| 14.7 | No existe dividir la cuenta en dos comprobantes. |
| 17.6 | El listado de comprobantes no tiene filtro por cliente. |
| 18.5 | La venta no descuenta del inventario los insumos de la receta. |
| 19.2, 19.4 | Con un RUC de proveedor o una factura repetidos no se crea el segundo registro, pero la pantalla muestra «Minified React error #441» en vez del mensaje de duplicado. |
| 19.7 | La compra a crédito no muestra fecha de vencimiento en cuentas por pagar. |
| 20.7, 20.9 | El balance de comprobación arrastra un descuadre de S/ 200 en los saldos iniciales y, en el balance general, Activo y Pasivo + Patrimonio difieren en S/ 4.49. |
| 20.10 | El saldo final del estado de flujo de efectivo (-27,928.16) no coincide con las cuentas 101 + 104 (-27,824.01): diferencia de S/ 104.15. |
| 20.11 | El libro diario del PLE de octubre no cuadra: diferencia de S/ 20. |
| 21.2 | El sistema acepta áreas con nombre repetido («Terraza» y un segundo «Barra» se crearon con 201). |
| 21.3 | Los comprobantes ignoran el RUC y el nombre del negocio de la configuración. |
| 22.3 | El rol CONTADOR recibe «Acceso denegado» en `/dashboards` aunque el tablero «Ventas diarias QA» está publicado para su rol. |
| 22.5 | El enlace compartido de un tablero pide iniciar sesión, cuando debería abrirse sin ella. |

### Alcance no ejecutado

Ocho casos quedan sin ejecutar por ser irreversibles, depender de servicios externos o necesitar condiciones que no se pudieron reproducir: 3.11 (protección del rol ADMIN), 14.4 y 15.4 (requieren dos ventanas simultáneas o un cambio irreversible), 16.5 (Yape y Mercado Pago, requieren un pago real), 21.5 (personalización del sitio), 22.2 (arrastrar un campo al visual del editor de tableros), 22.6 y 22.8 (tableros avanzados y asistente de lenguaje natural). Las pruebas de carga, unitarias, de caja blanca y de agentes de IA no forman parte de este documento.

---

## Escenario 1: Inicio de sesión

**Datos de Entrada:**
Inicio de sesión de un usuario en el sistema (casos 1.1, 1.2, 1.3, 1.4 y 1.8).

**Entorno:**
Pantalla `/login` y endpoint `POST /api/auth/login`. El formulario recibe usuario y contraseña. Las páginas y APIs protegidas validan la sesión.

**Parámetros:**
- Campo Usuario
- Campo Contraseña

**Respuesta de otros módulos:**
Se llama al módulo de autenticación y al módulo de auditoría, que registra el inicio de sesión y el intento fallido.

**Condiciones iniciales:**
1. Usuario `admin` con su contraseña vigente
2. Usuario `admin` con contraseña incorrecta
3. Usuario inexistente (`noexiste99`)
4. Usuario desactivado con su contraseña correcta
5. Acceso a APIs y páginas protegidas sin sesión

**Datos de Salida:**

*Resultados entregados:*
- Para la entrada 1, el sistema inicia sesión, redirige al inicio y muestra el menú con la sección Seguridad. La auditoría registra «Inicio de sesión» (el listado no muestra la IP).
- Para las entradas 2 y 3, responde 401 con el mismo mensaje «Usuario o contraseña incorrectos», sin revelar si el usuario existe. La auditoría registra «Login fallido» sin guardar la contraseña.
- Para la entrada 4, responde 403 «Tu usuario está desactivado. Contacta al administrador».
- Para la entrada 5, las APIs responden 401 y las páginas redirigen al login.

*Estado final de las variables:* sesión creada solo en la entrada 1. Evidencia: códigos de respuesta, mensajes y registros de auditoría.

**Requisitos de configuración para hacer la prueba:**

*Método de prueba:* partición de equivalencia (credenciales válidas, inválidas, inexistentes, usuario inactivo, sin sesión).

*Módulos:* autenticación (`users.service`: `authenticate`), auditoría y manejo de sesión.

*Hardware y software:* Windows 11 Pro; navegador integrado de la aplicación Claude (Chromium); conexión a internet; servidor desplegado en polleriaerp.tech.

*Procedimientos o herramientas necesarios:* se llamó al endpoint de login con credenciales erróneas desde una sesión ya iniciada (para no cerrarla) y se revisó la auditoría en `/security/audit`.

**Dependencias o relación con otros casos de prueba:**
La entrada 4 depende de crear y desactivar un usuario de prueba (Escenario 2).

---

## Escenario 2: Alta y mantenimiento de usuarios

**Datos de Entrada:**
Registro, edición, desactivación y cambio de contraseña de usuarios (casos 2.1 a 2.8, 2.10 y 2.11).

**Entorno:**
Módulo Seguridad > Usuarios, endpoints `POST /api/users`, `PUT /api/users/{id}` y `PATCH /api/users/{id}`.

**Parámetros:**
- DNI
- Nombre y apellido paterno
- Usuario
- Correo
- Contraseña
- Rol

**Respuesta de otros módulos:**
Se llama al módulo de empleados (se crea el empleado asociado) y al de auditoría.

**Condiciones iniciales:**
1. DNI de 2 dígitos (`12`)
2. Usuario con espacio (`a b`)
3. Correo sin formato (`noesmail`)
4. Contraseña de 3 caracteres (`abc`)
5. Todos los datos válidos, rol MESERO
6. Usuario ya existente
7. Correo ya existente
8. DNI ya existente
9. Edición del nombre
10. Desactivar y reactivar
11. Inicio de sesión con el usuario desactivado
12. Cambio de contraseña válida y de contraseña débil

**Datos de Salida:**

*Resultados entregados:*
- Entrada 1: 400 «El documento debe tener 8 dígitos».
- Entrada 2: 400 «El usuario debe tener de 3 a 20 caracteres (letras, números, . _ -)».
- Entrada 3: 400 «El correo no es válido».
- Entrada 4: 400 «La contraseña debe tener al menos 8 caracteres, con letras y números».
- Entrada 5: 201, usuario creado.
- Entradas 6, 7 y 8: 409 «Ya existe un usuario con ese nombre de usuario», «…con ese correo» y «Ya existe un empleado con ese documento».
- Entrada 9: 200, nombre actualizado.
- Entradas 10 y 11: el estado cambia y el usuario desactivado recibe 403.
- Entrada 12: la contraseña válida se acepta (200) y la débil se rechaza (400).

*Estado final de las variables:* se creó el usuario de prueba `qa.prueba1` (queda inactivo).

**Requisitos de configuración para hacer la prueba:**

*Método de prueba:* partición de equivalencia sobre cada campo (formato inválido, válido y repetido).

*Módulos:* `users.service` (validaciones y duplicados), empleados, auditoría.

*Hardware y software:* igual que el Escenario 1.

*Procedimientos o herramientas necesarios:* llamadas a la API desde la sesión de administrador del navegador.

**Dependencias o relación con otros casos de prueba:**
Se requiere un rol existente (MESERO). Las entradas 10 y 11 dependen de haber creado el usuario en la entrada 5.

---

## Escenario 3: Roles y permisos

**Datos de Entrada:**
Creación, modificación, desactivación y eliminación de roles (casos 3.1 a 3.5, 3.8 a 3.10 y 3.12).

**Entorno:**
Módulo Seguridad > Roles, endpoints `POST /api/roles`, `PUT /api/roles/{id}` y `DELETE /api/roles/{id}`.

**Parámetros:**
- Nombre del rol
- Descripción
- Lista de permisos
- Estado activo

**Respuesta de otros módulos:**
Se llama al catálogo de permisos y al módulo de usuarios (conteo de usuarios asignados).

**Condiciones iniciales:**
1. Nombre válido con 2 permisos
2. Nombre inválido (`a!`)
3. Nombre repetido
4. Nombre `  qa   rol  min  ` con espacios
5. Permiso inexistente (`no.existe`)
6. Quitar un permiso a un rol existente
7. Desactivar un rol con un usuario asignado
8. Eliminar un rol con un usuario asignado
9. Eliminar un rol sin usuarios

**Datos de Salida:**

*Resultados entregados:*
- Entrada 1: 201.
- Entrada 2: 400 «El nombre del rol debe tener de 3 a 50 caracteres».
- Entrada 3: 409 «Ya existe un rol con ese nombre».
- Entrada 4: se guarda normalizado como `QA ROL MIN`.
- Entrada 5: 400 «Permiso desconocido».
- Entrada 6: 200, el rol queda con un permiso menos.
- Entradas 7 y 8: 409 «No se puede desactivar/eliminar: tiene 1 usuario(s) asignado(s)».
- Entrada 9: 200 y el rol desaparece de la lista.

*Estado final de las variables:* los roles de prueba se eliminaron al final.

**Requisitos de configuración para hacer la prueba:**

*Método de prueba:* partición de equivalencia y análisis de valores límite del nombre (3 a 50 caracteres).

*Módulos:* `roles.service`, catálogo de permisos, usuarios, auditoría.

*Hardware y software:* igual que el Escenario 1.

*Procedimientos o herramientas necesarios:* llamadas a la API con la sesión de administrador. Se usaron roles de prueba propios, sin tocar ADMIN.

**Dependencias o relación con otros casos de prueba:**
Las entradas 7 y 8 requieren asignar un usuario de prueba (Escenario 2). No se ejecutó la protección del rol de sistema ADMIN (3.11).

---

## Escenario 4: Registro de auditoría

**Datos de Entrada:**
Consulta y filtros del registro de auditoría (casos 4.1 a 4.6 y 4.8).

**Entorno:**
Seguridad > Auditoría, endpoint `GET /api/audit-logs` con filtros `user`, `module`, `action`, `from`, `to` y `q`.

**Parámetros:**
- Usuario
- Módulo
- Acción
- Rango de fechas
- Texto de búsqueda

**Respuesta de otros módulos:**
Reciben eventos todos los módulos que auditan (seguridad, usuarios, RR. HH., compras, caja).

**Condiciones iniciales:**
1. Revisar el registro de las creaciones hechas en los escenarios 2 y 3
2. Comparar la hora de un registro con la hora de Lima
3. Abrir el detalle de una modificación de rol
4. Filtrar por usuario `admin` y módulo Seguridad
5. Filtrar por la fecha de hoy y acción DELETE, y por un rango sin movimientos
6. Buscar el texto «QA ROL»
7. Revisar si algún registro contiene contraseñas

**Datos de Salida:**

*Resultados entregados:*
- Entrada 1: filas CREATE con usuario, módulo, entidad, IP y hora.
- Entrada 2: un registro de las 16:53 hora de Lima se guarda como 21:53 UTC y se muestra en hora local, sin desfase.
- Entrada 3: el detalle trae `before` y `after` con los permisos.
- Entrada 4: solo aparecen filas del usuario y módulo pedidos.
- Entrada 5: solo eliminaciones de hoy; el rango sin movimientos devuelve 0 filas.
- Entrada 6: lista los registros que mencionan el rol.
- Entrada 7: ninguna entrada contiene la contraseña ni su hash; solo `passwordChanged: "[oculto]"`.

*Estado final de las variables:* sin cambios en los datos.

**Requisitos de configuración para hacer la prueba:**

*Método de prueba:* partición de equivalencia sobre los filtros y verificación cruzada contra las acciones ejecutadas.

*Módulos:* `audit.service` y la tabla de auditoría.

*Hardware y software:* igual que el Escenario 1.

*Procedimientos o herramientas necesarios:* consultas a la API y revisión de `/security/audit`. No se vio en pantalla el mensaje de tabla vacía.

**Dependencias o relación con otros casos de prueba:**
Depende de las acciones ejecutadas en los Escenarios 1, 2 y 3.

---

## Escenario 5: Contratación y contratos laborales

**Datos de Entrada:**
Alta de empleado con contrato y registro de contratos (casos 5.6, 6.2, 6.3, 6.4, 6.8 y 6.14).

**Entorno:**
RR. HH. > Empleados y Contratos, endpoints `POST /api/employees`, `POST /api/contracts` y `POST /api/contracts/{id}` (acción `terminate`).

**Parámetros:**
- Tipo de contrato
- Régimen laboral
- Fecha de inicio y de término
- Sueldo base
- Sistema de pensiones (ONP o AFP), AFP y CUSPP
- Horario pactado

**Respuesta de otros módulos:**
Se llama al módulo de horarios (turnos base) y a las reglas laborales (RMV, jornada, pensiones).

**Condiciones iniciales:**
1. Contrato indeterminado con fecha de término
2. Contrato a plazo fijo sin fecha de término
3. Fecha de término anterior al inicio
4. Plazo fijo de más de 5 años
5. Sueldo de S/ 900 y de S/ 500 en jornada completa
6. Pensión «Ninguno» en planilla
7. Pensión AFP sin elegir AFP
8. CUSPP de 3 caracteres
9. Alta con un DNI ya registrado
10. Cese anterior al inicio, cese sin motivo y cese repetido

**Datos de Salida:**

*Resultados entregados:*
- Entrada 1: 400 «Un contrato a plazo indeterminado no lleva fecha de término».
- Entrada 2: 400 «debe tener fecha de término».
- Entrada 3: 400 «La fecha de término debe ser posterior a la de inicio».
- Entrada 4: 400 «no puede superar los 5 años».
- Entrada 5: 400 «El sueldo de jornada completa no puede ser menor a la remuneración mínima (S/ 1130)».
- Entrada 6: 400 «Todo trabajador en planilla debe estar afiliado a la ONP o a una AFP».
- Entrada 7: 400 «Selecciona la AFP del trabajador».
- Entrada 8: 400 «El CUSPP debe tener 12 caracteres alfanuméricos».
- Entrada 9: 409 «Ya existe un empleado con ese documento».
- Entrada 10: 400 «La fecha de cese no puede ser anterior al inicio», 400 «El motivo del cese es obligatorio» y 400 «El contrato ya no está vigente».

*Estado final de las variables:* por un DNI que no existía se creó el empleado de prueba `A B` (id 134) con su contrato 66, que se cesó a continuación. El empleado sigue en la lista.

**Requisitos de configuración para hacer la prueba:**

*Método de prueba:* partición de equivalencia y valores límite (RMV de S/ 1130, 5 años, 12 caracteres del CUSPP).

*Módulos:* `contracts.service`, `employees.service`, `labor-rules`.

*Hardware y software:* igual que el Escenario 1.

*Procedimientos o herramientas necesarios:* llamadas a la API con la sesión de administrador. Los textos de los casos 5.4 y 5.5 son mensajes de pantalla y no se verificaron.

**Dependencias o relación con otros casos de prueba:**
Requiere turnos base existentes (Escenario 6).

---

## Escenario 6: Horarios y asistencia

**Datos de Entrada:**
Creación y asignación de horarios y consulta y corrección de asistencia (casos 7.1 a 7.4, 7.8 a 7.10, 8.1, 8.7, 8.8, 8.10 y 8.11; observado 8.9).

**Entorno:**
RR. HH. > Horarios y Asistencia, endpoints `POST /api/schedules`, `PUT /api/schedules/{id}/employees`, `POST /api/schedules/generate`, `GET` y `PUT /api/attendance`.

**Parámetros:**
- Nombre, fecha, hora de inicio y de fin del horario
- Empleados asignados
- Lunes de la semana a programar
- Fecha, entrada, salida y justificación de una corrección

**Respuesta de otros módulos:**
Se llama a contratos (horario pactado) y a vacaciones y permisos (licencias aprobadas).

**Condiciones iniciales:**
1. Horario 18:00–23:00 con nombre válido
2. Nombre vacío
3. Hora de fin igual a la de inicio
4. Mismo nombre y misma fecha
5. Nombre de un turno base con otras horas
6. Horario nocturno 22:00–02:00
7. Asignar dos empleados libres
8. Programar la semana desde los contratos, dos veces
9. Editar la hora de fin y eliminar un horario
10. Asistencia de un día con turnos y sin marcaciones
11. Día con una licencia aprobada
12. Corregir una falta con entrada y salida, y justificar otra falta

**Datos de Salida:**

*Resultados entregados:*
- Entrada 1: 201, con 0 asignados.
- Entradas 2 a 5: 400, 400, 409 y 400 con mensajes específicos.
- Entrada 6: se acepta como nocturno de 4 h.
- Entrada 7: 200 con 2 asignados.
- Entrada 8: la primera vez crea 9 turnos y 46 asignaciones; la segunda crea 0, sin duplicar.
- Entrada 9: 200 en ambos.
- Entrada 10: los 7 trabajadores programados figuran como Falta.
- Entrada 11: figura como Licencia y no como Falta.
- Entrada 12: la corrección deja la fila Puntual (450 min) y la justificación baja las faltas de 6 a 5. **Observado:** en el listado la entrada figura con origen «Manual» y no «Corrección de RR. HH.»; la bitácora sí registra la corrección con usuario y motivo.

*Estado final de las variables:* los horarios de prueba se eliminaron. Quedan los turnos de la semana del 30/11 generados y las asistencias corregidas del 25/11.

**Requisitos de configuración para hacer la prueba:**

*Método de prueba:* partición de equivalencia y verificación de totales del día (7 programados = 1 puntual + 5 faltas + 1 justificada).

*Módulos:* `schedules.service`, `attendance.service`, `leaves.service`.

*Hardware y software:* igual que el Escenario 1.

*Procedimientos o herramientas necesarios:* llamadas a la API con la sesión de administrador.

**Dependencias o relación con otros casos de prueba:**
Depende de contratos vigentes con horario pactado (Escenario 5).

---

## Escenario 7: Vacaciones, permisos y autoservicio del trabajador

**Datos de Entrada:**
Solicitud, aprobación, rechazo y anulación de vacaciones y permisos, y vista «Mi horario» (casos 9.1 a 9.7, 13.1 a 13.5 y 13.7).

**Entorno:**
RR. HH. > Vacaciones y permisos y Mi horario y asistencia, endpoints `POST /api/leaves`, `PATCH /api/leaves/{id}`, `POST` y `PATCH /api/me/leaves`.

**Parámetros:**
- Tipo de solicitud
- Fechas de inicio y fin
- Motivo
- Documento de sustento
- Marca de adelanto de vacaciones
- Decisión y nota de rechazo

**Respuesta de otros módulos:**
Se llama a contratos (vigencia y saldo), horarios (liberar turnos) y asistencia.

**Condiciones iniciales:**
1. Fecha de fin anterior a la de inicio
2. Rango mayor al máximo (más de 366 días)
3. Permiso personal sin motivo
4. Descanso médico aprobado sin documento y con «CITT 123»
5. Vacaciones con adelanto, aprobadas, y aprobación repetida
6. Rechazo sin motivo y con motivo
7. Vacaciones que se cruzan con otra solicitud
8. Solicitud con inicio anterior a hoy (autoservicio)
9. Permiso de un día y vacaciones de 5 días desde un trabajador
10. Anular solicitudes pendientes y la de otra persona
11. Mi horario con un usuario sin contrato vigente

**Datos de Salida:**

*Resultados entregados:*
- Entradas 1 a 3: 400 con los mensajes «La fecha de fin no puede ser anterior…», «Una solicitud no puede superar 366 días» e «Indica el motivo del permiso».
- Entrada 4: 400 sin documento; con documento se registra aprobado.
- Entrada 5: se aprueba y la segunda aprobación da 400 «La solicitud ya fue revisada».
- Entrada 6: 400 «Indica el motivo del rechazo» y luego queda rechazada.
- Entrada 7: 409 «Se cruza con vacaciones del…».
- Entrada 8: 400 «Las solicitudes deben empezar hoy o después».
- Entrada 9: ambas quedan Pendientes y RR. HH. las ve en su lista.
- Entrada 10: las pendientes pasan a Anulada; la de otra persona da 404.
- Entrada 11: la pantalla muestra «No tienes un contrato vigente registrado».

*Estado final de las variables:* quedan solicitudes de prueba Anuladas del usuario `lramirez`, y descanso médico y vacaciones de prueba del empleado 32.

**Requisitos de configuración para hacer la prueba:**

*Método de prueba:* partición de equivalencia y valores límite de fechas. Se usaron las sesiones de `admin` y de `lramirez` (MESERO).

*Módulos:* `leaves.service`, `self-service.service`, contratos y horarios.

*Hardware y software:* igual que el Escenario 1.

*Procedimientos o herramientas necesarios:* pantalla Mi horario y llamadas a la API. El saldo de vacaciones y el contrato de `lramirez` (vence el 08/12/2026) limitaron algunas pruebas.

**Dependencias o relación con otros casos de prueba:**
Depende de contratos vigentes (Escenario 5) y de horarios (Escenario 6).

---

## Escenario 8: Seguros y adelantos de sueldo

**Datos de Entrada:**
Registro de seguros y gestión de adelantos (casos 10.1 a 10.4, 10.6 a 10.8, 10.11 y 13.6 parcial).

**Entorno:**
RR. HH. > Seguros y adelantos, endpoints `POST /api/insurances`, `POST /api/advances`, `PATCH /api/advances/{id}` y `POST /api/me/advances`.

**Parámetros:**
- Tipo de seguro, aseguradora, póliza, vigencia y costo mensual
- Monto, cuotas y motivo del adelanto
- Acción (aprobar, entregar, descontar, anular) y medio de pago

**Respuesta de otros módulos:**
Se llama a contabilidad (asiento del adelanto) y a contratos (sueldo básico).

**Condiciones iniciales:**
1. Seguro sin número de póliza
2. Seguro con fin anterior al inicio
3. Seguro Vida Ley válido y un segundo Vida Ley activo al mismo trabajador
4. Seguro que vence en 15 días
5. Adelanto superior al 50 % del sueldo y exactamente el 50 %
6. Adelanto en 4 cuotas y un segundo adelanto con uno en curso
7. Aprobar y entregar un adelanto con y sin medio de pago
8. Descuento mayor al saldo
9. Anular un adelanto entregado y uno pendiente

**Datos de Salida:**

*Resultados entregados:*
- Entradas 1 y 2: 400 con mensajes específicos.
- Entrada 3: el primero se crea y el segundo da 409 «ya tiene un Seguro Vida Ley activo».
- Entrada 4: queda con validez «Por vencer».
- Entrada 5: 400 «no puede superar S/ 500.00 (50 % del sueldo básico)» y el límite exacto se acepta.
- Entrada 6: 400 «Las cuotas deben ser entre 1 y 3» y 409 por adelanto en curso.
- Entrada 7: Aprobado → Pagado con asiento `MISC/2026/11/0451` por S/ 500; sin medio de pago da 400.
- Entrada 8: 400 «El descuento no puede superar el saldo pendiente».
- Entrada 9: la anulación del pendiente funciona; la del entregado da 400 «Solo se anula un adelanto que aún no se entregó».

*Estado final de las variables:* seguros `QA-001` y `QA-003`, adelanto 13 entregado y adelanto 14 anulado.

**Requisitos de configuración para hacer la prueba:**

*Método de prueba:* partición de equivalencia y valores límite (50 % del sueldo, 1 a 3 cuotas).

*Módulos:* `benefits.service`, contabilidad.

*Hardware y software:* igual que el Escenario 1.

*Procedimientos o herramientas necesarios:* llamadas a la API. No se verificó que el asiento cuadre en debe y haber.

**Dependencias o relación con otros casos de prueba:**
Depende de un contrato vigente (Escenario 5). El adelanto entregado se descuenta en el Escenario 9.

---

## Escenario 9: Planilla de sueldos

**Datos de Entrada:**
Cálculo, aprobación y pago de la planilla mensual (casos 11.1 a 11.6, 11.12, 11.13 y 11.14).

**Entorno:**
RR. HH. > Planilla de sueldos, endpoints `POST /api/payroll`, `GET /api/payroll` y `PATCH /api/payroll/{id}`.

**Parámetros:**
- Año y mes
- Acción (aprobar, pagar, reabrir)
- Medio y fecha de pago

**Respuesta de otros módulos:**
Se llama a contratos, asistencia, adelantos y contabilidad (asientos de devengo y de pago).

**Condiciones iniciales:**
1. Calcular setiembre 2026 (mes sin planilla)
2. Calcular un mes futuro (marzo 2027)
3. Revisar ONP, AFP, EsSalud y asignación familiar en las boletas
4. Aprobar la planilla del mes en curso
5. Aprobar setiembre y recalcularla
6. Pagar sin medio, con fecha anterior al cierre y con fecha futura
7. Pagar con datos válidos
8. Reabrir una planilla pagada

**Datos de Salida:**

*Resultados entregados:*
- Entrada 1: Borrador con 7 trabajadores; bruto 13,576.00, descuentos 2,495.35 y neto 11,080.65 coinciden con la suma de las boletas; aportes del empleador 1,369.54 = EsSalud 1,175.04 + seguros 194.50.
- Entrada 2: 400 «No se puede calcular la planilla de un mes que aún no empieza».
- Entrada 3: ONP = 13 %; AFP Integra sobre 1,613.00 da 208.40; EsSalud = 9 % a cargo del empleador; asignación familiar de S/ 113.00.
- Entrada 4: 400 «La planilla se aprueba al cierre del mes».
- Entrada 5: queda Aprobada con asiento `MISC/2026/09/0002` por S/ 14,945.54 y recalcular da 400.
- Entrada 6: 400 con los mensajes «Selecciona el medio de pago», «El pago no puede ser anterior al cierre del mes» y «La fecha de pago no puede ser futura».
- Entrada 7: queda Pagada con asiento `MISC/2026/11/0461` por S/ 11,080.65.
- Entrada 8: 400 «Una planilla pagada no se reabre».

*Estado final de las variables:* setiembre 2026 Pagada y noviembre 2026 en Borrador.

**Requisitos de configuración para hacer la prueba:**

*Método de prueba:* verificación de totales (suma de boletas contra indicadores) y comprobación de fórmulas con valores conocidos.

*Módulos:* `payroll.service`, `payroll-rules`, contabilidad.

*Hardware y software:* igual que el Escenario 1.

*Procedimientos o herramientas necesarios:* llamadas a la API. No se verificó que los asientos cuadren en debe y haber. **Observación fuera del plan:** al calcular un mes pasado se descuentan adelantos entregados después de ese mes (`payroll.service.ts` descuenta todos los adelantos «Pagado» con saldo sin mirar la fecha de entrega).

**Dependencias o relación con otros casos de prueba:**
Depende de contratos, asistencia (Escenario 6) y adelantos (Escenario 8).

---

## Escenario 10: Pedidos, mesas y cocina

**Datos de Entrada:**
Registro y seguimiento de pedidos en mesa y para llevar (casos 14.1, 14.2, 14.8, 14.9, 15.1, 15.2, 15.3 y 15.5; observado 14.6).

**Entorno:**
Ventas > Salón de mesas, cocina y despacho de bebidas, endpoints `POST /api/orders`, `PUT /api/orders/{id}`, `PATCH /api/orders/drinks` y `PATCH /api/products/{id}`.

**Parámetros:**
- Tipo de pedido (Mesa o Llevar)
- Mesa
- Productos y cantidades
- Estado del pedido

**Respuesta de otros módulos:**
Se llama a caja (debe haber una sesión abierta), inventario (precios y stock) y cocina y bebidas.

**Condiciones iniciales:**
1. Pedido en mesa 1 con 2 × 1/4 Pollo (S/ 21.90) y 1 Jarra de Chicha (S/ 12.00)
2. Agregar un producto a un pedido existente
3. Cantidad 0 y cantidad negativa
4. Pedido en una mesa ocupada
5. Pedido para llevar sin mesa
6. Estados Preparing y Ready, y despacho de una bebida
7. Pedir un producto pausado
8. Mover el pedido a otra mesa

**Datos de Salida:**

*Resultados entregados:*
- Entrada 1: total S/ 55.80, mesa ocupada, visible en Cocina y en Bebidas.
- Entrada 2: el total pasó a S/ 65.80, sin duplicar lo anterior.
- Entrada 3: 400 «La cantidad de cada producto debe ser al menos 1».
- Entrada 4: 400 «La Mesa 1 ya tiene un pedido activo en curso».
- Entrada 5: pedido «Llevar» registrado (201).
- Entrada 6: el pedido pasa de Recibido a Preparando y a Listo, y la bebida queda Delivered.
- Entrada 7: 400 «El producto … no existe, no está activo o no se vende».
- Entrada 8: **Observado.** `PUT /api/orders/{id}` con `tableId` responde 200 pero el pedido sigue en la mesa 1 y la mesa 3 queda libre. No existe en el código una función para mover pedidos.

*Estado final de las variables:* los pedidos de prueba se cancelaron.

**Requisitos de configuración para hacer la prueba:**

*Método de prueba:* partición de equivalencia (cantidades válidas, cero y negativas; mesa libre y ocupada).

*Módulos:* `orders.service`, `tables`, `products.service`.

*Hardware y software:* igual que el Escenario 1.

*Procedimientos o herramientas necesarios:* llamadas a la API. No se abrió la pantalla del KDS.

**Dependencias o relación con otros casos de prueba:**
Requiere una sesión de caja abierta. El cobro de estos pedidos se prueba en el Escenario 11.

---

## Escenario 11: Cobro en caja, comprobantes y clientes

**Datos de Entrada:**
Cobro de pedidos, emisión de boletas y facturas y registro de clientes (casos 16.2, 16.3, 16.4, 16.6, 16.8, 16.9, 16.11, 17.1 a 17.5).

**Entorno:**
Ventas > Ventanilla y Clientes, endpoints `POST /api/sales`, `POST /api/customers` y `POST /api/cash-sessions/movements`.

**Parámetros:**
- Pedido, medio de pago y monto recibido
- Tipo de comprobante y serie
- Cliente (documento, nombre, tipo de persona)
- Egreso de caja (monto y motivo)

**Respuesta de otros módulos:**
Se llama a contabilidad (asientos de venta y costo), inventario y almacenamiento de comprobantes.

**Condiciones iniciales:**
1. Monto recibido menor al total
2. Cobro en efectivo con S/ 100 de una cuenta de S/ 47.80
3. Cobro con Tarjeta
4. Pago dividido (S/ 20 efectivo + S/ 27.80 tarjeta) y con montos que no suman
5. Cobrar un pedido ya cobrado y uno cancelado
6. Abrir otra sesión de caja con una ya abierta
7. Egreso de S/ 20
8. Cliente con DNI, con RUC de 11 y de 10 dígitos, y con documento repetido
9. Factura con RUC e IGV, y serie inválida `X001`

**Datos de Salida:**

*Resultados entregados:*
- Entrada 1: 400 «El monto recibido (S/ 10.00) es menor al total a pagar (S/ 47.80)».
- Entrada 2: venta registrada (201), boleta `B001-00000084` y el efectivo de la sesión sube S/ 47.80.
- Entrada 3: el efectivo no cambia y sube «otros medios».
- Entrada 4: el pago dividido cierra la cuenta y los montos que no suman dan 400.
- Entrada 5: 400 «ya se encuentra cerrado y facturado» y 400 «No se puede facturar un pedido cancelado».
- Entrada 6: 400 «ya tiene una sesión abierta activa».
- Entrada 7: egreso registrado y el esperado baja de 152.30 a 132.30.
- Entrada 8: DNI y RUC de 11 dígitos se crean; el de 10 dígitos da 400; el repetido da 409.
- Entrada 9: factura `F001-00000004` con subtotal 47.29 + IGV 8.51 = 55.80 (18 %); la serie `X001` da 400.

*Estado final de las variables:* comprobantes, clientes y movimientos de prueba en la sesión de caja 86 (no se cerró).

**Requisitos de configuración para hacer la prueba:**

*Método de prueba:* partición de equivalencia y verificación de totales (subtotal + IGV = total, saldo de caja).

*Módulos:* `sales.service`, `customers.service`, `cash-sessions.service`, contabilidad.

*Hardware y software:* igual que el Escenario 1.

*Procedimientos o herramientas necesarios:* llamadas a la API. No se verificó el vuelto en pantalla ni el autocompletado por consulta de DNI.

**Dependencias o relación con otros casos de prueba:**
Depende de pedidos (Escenario 10) y de una sesión de caja abierta.

---

## Escenario 12: Inventario y proveedores

**Datos de Entrada:**
Alta de un insumo y de proveedores (casos 18.1, 19.1; observado 19.2).

**Entorno:**
Compras e Inventario > Kardex e Inventario y Proveedores. Se probó en pantalla.

**Parámetros:**
- Nombre del insumo, unidad de medida y stock mínimo
- Tipo y número de documento del proveedor, razón social

**Respuesta de otros módulos:**
Se llama a las acciones de servidor de inventario y de proveedores.

**Condiciones iniciales:**
1. Insumo sin nombre
2. Insumo «Aceite vegetal 1L QA», unidad LT, stock mínimo 5
3. Proveedor con documento `123`
4. Proveedor con RUC de 11 dígitos
5. Proveedor con el mismo RUC otra vez

**Datos de Salida:**

*Resultados entregados:*
- Entrada 1: el formulario no deja guardar y muestra «Completa este campo» (no es el texto del plan).
- Entrada 2: el insumo se crea con stock 0 y mínimo 5.
- Entrada 3: el formulario muestra «El RUC debe tener exactamente 11 dígitos».
- Entrada 4: «Proveedor registrado exitosamente».
- Entrada 5: **Observado.** No se crea el segundo proveedor, pero la pantalla muestra «Minified React error #441» en vez de «Ya existe un proveedor registrado con el documento». El servicio lanza un `Error` común y en producción Next.js oculta su mensaje.

*Estado final de las variables:* insumo «Aceite vegetal 1L QA» y proveedor «QA Proveedor SAC» (RUC 20555666771).

**Requisitos de configuración para hacer la prueba:**

*Método de prueba:* partición de equivalencia (campo vacío, documento inválido, válido y repetido).

*Módulos:* `lib/services/purchases/product.ts` y `supplier.ts`, y las pantallas de inventario y proveedores.

*Hardware y software:* igual que el Escenario 1. Se usó la pantalla porque estas operaciones son acciones de servidor y no endpoints.

*Procedimientos o herramientas necesarios:* navegador integrado, captura de pantalla y lectura del contenido de la página.

**Dependencias o relación con otros casos de prueba:**
Independiente. Las compras 19.3 a 19.8 no se ejecutaron.

---

## Escenario 13: Contabilidad y configuración

**Datos de Entrada:**
Asientos, cuentas, libros, flujo de efectivo, mesas, áreas y tableros (casos 20.1, 20.2, 20.4, 20.5, 20.6, 21.1, 22.1; observados 20.10 y 21.2).

**Entorno:**
Contabilidad > Asientos y Reportes, Configuración > Mesas y Áreas y Tableros. Endpoints `POST /api/journal-entries`, `POST /api/accounts`, `GET /api/daily-book`, `GET /api/general-ledger`, `GET /api/cash-flow-statement`, `POST /api/tables` y `POST /api/settings/areas`; los tableros se probaron en pantalla.

**Parámetros:**
- Fecha, diario y líneas del asiento (cuenta, debe, haber)
- Código, nombre y tipo de cuenta
- Rango de fechas de los libros
- Número y capacidad de la mesa; nombre del área; nombre del tablero

**Respuesta de otros módulos:**
Los asientos reciben datos de ventas, compras, caja y planilla.

**Condiciones iniciales:**
1. Asiento con debe S/ 100 y haber S/ 90
2. Asiento con debe 101 S/ 100 y haber 701 S/ 100
3. Cuenta con código `101` duplicado
4. Libro diario de noviembre y libro mayor de la cuenta 101
5. Estado de flujo de efectivo de noviembre contra las cuentas 101 y 104
6. Mesa 20 y mesa 20 repetida
7. Área «Barra» y áreas repetidas («Terraza»)
8. Tablero nuevo en la sección Ventas

**Datos de Salida:**

*Resultados entregados:*
- Entrada 1: 400 «El asiento no cuadra: el debe (100.00) no coincide con el haber (90.00)».
- Entrada 2: asiento `MISC/2026/11/0476` registrado.
- Entrada 3: 409 «Ya existe una cuenta contable con el código 101».
- Entrada 4: los 100 primeros asientos de noviembre (de 475) suman debe = haber = 18,181.03; en el mayor de la 101: -842.69 + 5,736.10 - 9,370.90 = -4,477.49. La cuenta Caja está en negativo.
- Entrada 5: **Observado.** El saldo final del flujo (-27,928.16) no coincide con 101 + 104 (-27,824.01); diferencia de S/ 104.15. El saldo inicial sí coincide.
- Entrada 6: mesa 20 creada y la repetida da 409.
- Entrada 7: **Observado.** El sistema acepta nombres repetidos (201); las 3 áreas duplicadas se eliminaron.
- Entrada 8: «Tablero creado exitosamente», con Publicado apagado por defecto (borrador).

*Estado final de las variables:* asiento de prueba, mesa 20 y tablero «Ventas diarias QA».

**Requisitos de configuración para hacer la prueba:**

*Método de prueba:* partición de equivalencia, verificación de partida doble (debe = haber) y conciliación entre reportes y libros.

*Módulos:* `journal-entries`, `chart-of-accounts`, `general-ledger`, `cash-flow-statement`, `tables`, `dining-areas`, tableros.

*Hardware y software:* igual que el Escenario 1.

*Procedimientos o herramientas necesarios:* llamadas a la API y pantalla de Tableros. No se revisaron las otras 4 páginas del libro diario ni los reportes 20.7 a 20.9.

**Dependencias o relación con otros casos de prueba:**
Los saldos dependen de las ventas, compras y planilla de los escenarios anteriores.

---

## Observaciones generales

- **Versión desplegada atrasada.** polleriaerp.tech corre una versión anterior al repositorio. Varios resultados OBSERVADOS (12.x) pueden resolverse al desplegar, y conviene repetir 8.9 y 12.x después.
- **Datos de prueba.** Las pruebas dejaron registros en la base desplegada (usuario `qa.prueba1`, empleado 134, seguros `QA-001` y `QA-003`, planillas de setiembre y noviembre 2026, comprobantes B001 y F001, proveedor y cliente de prueba, insumo «Aceite vegetal 1L QA», mesa 20 y tablero «Ventas diarias QA»). Conviene retirarlos si el entorno se usa para otra cosa.
- **Evidencia.** La evidencia de cada resultado son los códigos de respuesta, los mensajes del sistema y los registros de auditoría. No se adjuntan capturas de pantalla.

---

## Escenario 14: Acceso por rol y sesiones de varios usuarios

**Datos de Entrada:**
Comprobación de restricciones y menús con usuarios de otros roles (casos 1.5, 1.7, 2.12, 2.13, 3.15, 3.16, 8.4, 22.3, 22.5, 23.1, 23.2 y 23.3).

**Entorno:**
Sistema desplegado con sesiones de `alta.qa1` (CAJERO), `gestor.qa` (rol GESTOR USUARIOS creado para la prueba), `cont.qa` (CONTADOR), `coc.qa` (COCINERO) y `admin`.

**Parámetros:**
- Usuario y rol de la sesión
- Permisos del rol
- Datos a modificar (usuario `admin`, rol de otro usuario, enlace compartido)

**Respuesta de otros módulos:**
Se llama a autenticación, usuarios, roles, asistencia y tableros.

**Condiciones iniciales:**
1. CAJERO inicia y cierra sesión
2. Un usuario con permisos de Usuarios intenta modificar a `admin` y asignar el rol ADMIN
3. Se quitan permisos a un rol con un usuario conectado
4. Menús de CAJERO, COCINERO y CONTADOR
5. CONTADOR abre Tableros y se abre un enlace compartido sin sesión

**Datos de Salida:**

*Resultados entregados:*
- Entrada 1: no se registra entrada ni salida de asistencia (observado 1.5, 1.7 y 8.4).
- Entrada 2: 403 «Solo un administrador puede modificar a un administrador» y 403 «Solo un administrador puede asignar un rol de sistema»; no cambió ningún dato (pasan 2.12 y 2.13).
- Entrada 3: sin cerrar sesión, el usuario recibe «No tienes permiso para realizar esta acción» al guardar (pasa 3.16). El acceso a tableros por rol no se puede comprobar en el despliegue (observado 3.15).
- Entrada 4: cada rol ve solo los menús de sus permisos (pasan 23.1, 23.2 y 23.3).
- Entrada 5: el CONTADOR recibe «Acceso denegado» en Tableros (22.3) y el enlace compartido pide iniciar sesión (22.5); el enlace se desactivó al terminar.

*Estado final de las variables:* sin cambios en `admin` ni en roles del sistema; el rol de prueba recuperó sus permisos. Evidencia: códigos de respuesta, mensajes y pantallas.

**Requisitos de configuración para hacer la prueba:**

*Método de prueba:* partición de equivalencia por rol y valores límite de permisos.

*Módulos:* usuarios, roles, asistencia, tableros y menú lateral.

*Hardware y software:* Windows 11 Pro; navegador integrado de la aplicación Claude (Chromium) y Chrome para la sesión paralela; servidor desplegado en polleriaerp.tech.

*Procedimientos o herramientas necesarios:* inicio de sesión manual de cada usuario y llamadas a las APIs reales con la sesión activa.

**Dependencias o relación con otros casos de prueba:**
Depende de los Escenarios 2 y 3 (usuarios y roles).

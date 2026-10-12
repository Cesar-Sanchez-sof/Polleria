# Feature Specification: Asistente Financiero con IA

**Feature Branch**: `feature/ia-contable-lora` (identificador de spec: `023-ai-financial-assistant`)

**Created**: 2026-10-12

**Status**: Draft

**Input**: User description: "Especificación de Spec Kit para la primera integración de
inteligencia artificial del ERP contable: un asistente financiero en chat flotante, de solo
consulta, que responde en español con cifras respaldadas por datos autorizados y cálculos
verificables, apoyado en embeddings, recuperación RAG y un modelo XiYanSQL especializado con
QLoRA."

> **Nota de procedencia**: esta especificación define **comportamiento nuevo, no implementado**.
> Hoy no existe en el repositorio ningún componente de IA: no hay código de LLM, embeddings,
> almacén vectorial, Python ni servicio de inferencia. Los modelos **no están entrenados ni
> desplegados**. Las afirmaciones sobre el sistema actual se verificaron por lectura de código
> (ver [Evidencia de verificación](#evidencia-de-verificación)). Specs relacionadas: períodos
> (`001`), asientos (`002`, `005`), plan contable (`003`, `004`), balance (`007`) y libro mayor
> (`013`). Esta spec **no modifica** ninguna de ellas.

### Leyenda

| Marca | Significado |
|-------|-------------|
| **[CONFIRMADO]** | Decisión funcional o directriz aprobada por el equipo. Obligatoria. |
| **[PROPUESTO]** | Decisión técnica o arquitectónica preliminar, pendiente de validación. No existe en el código. |
| **[NEEDS CLARIFICATION: …]** | Decisión pendiente (ver [Decisiones pendientes](#decisiones-pendientes-needs-clarification)). |
| **Etapa 0** | Desarrollo y pruebas aisladas, con mocks y datos ficticios. |
| **MVP** | Alcance inicial integrado sobre datos reales autorizados. |
| **Posterior** | Etapas siguientes al MVP. |

---

## Purpose

Permitir que los usuarios autorizados de las pantallas financieras y contables hagan preguntas en
lenguaje natural sobre la información contable del ERP. El asistente responde con un texto en
español que incluye cifras y porcentajes calculados de forma determinista a partir de los datos
registrados. No modifica ningún registro y cada cifra es trazable hasta su origen.

### Usuarios objetivo

| Perfil | Necesidad |
|--------|-----------|
| **Contador** | Consultas técnicas sobre cuentas, saldos, movimientos, períodos e indicadores, con terminología contable. |
| **Propietario o administrador del negocio sin conocimientos contables especializados** | Preguntas cotidianas ("¿cuánto dinero hay en caja?", "¿cuánto les debo a mis proveedores?") respondidas en lenguaje claro, con una breve explicación de los términos contables necesarios. |

Qué roles del ERP corresponden a cada perfil sigue pendiente (P-1).

## Scope

### Etapas

| Etapa | Contenido | Requiere |
|-------|-----------|----------|
| **Etapa 0: aislada** | Componentes C1 a C11 desarrollados y probados por separado **exclusivamente** con mocks, datos ficticios o bases PostgreSQL desechables configuradas explícitamente. **Sin conexión a Neon de producción ni dependencia de `DATABASE_URL` del ERP** (NFR-011). El widget se prueba **sin montarse** en las pantallas existentes. Como Modelo 2 puede usarse XiYanSQL base como línea base. | P-18 |
| **MVP integrado** | Las 12 decisiones funcionales confirmadas (US1 a US6) con un catálogo acotado de consultas: saldos y movimientos de cuenta, totales por período, balance a una fecha e indicadores básicos (P-6). Incluye la cadena de seguridad completa: proxy, revalidación por consulta, SQL Validator, SQL Executor restringido, motor financiero y auditoría minimizada. | DE-1, DE-2, DE-3, DE-5 (CS-1 aprobado), DE-7 resueltas |
| **Posterior** | Pantallas fuera de Contabilidad (compras, ventas). Indicadores del estado de resultados, que depende de que se implemente esa pantalla. SQL visible para administradores (P-12). Paneles de observabilidad. Reentrenamiento periódico del adaptador. Sincronizar la conversación entre pestañas. Ajuste de los límites de uso. | Aprobación específica |

**Modelo 2 [CONFIRMADO]**: durante las pruebas iniciales puede usarse **XiYanSQL-QwenCoder-7B-2504
base** (con RAG) como línea base. **El objetivo final del proyecto es integrar y evaluar XiYanSQL
especializado mediante QLoRA**, comparándolo con la línea base sobre el mismo conjunto de
evaluación (SC-012). El adaptador QLoRA **no está entrenado**. Sigue pendiente (**P-15**) si el MVP
integrado exige ya el adaptador o puede salir con la línea base.

### Incluido

- Botón flotante y panel de chat en las pantallas financieras y contables autorizadas.
- Conversación conservada durante la sesión del usuario al navegar entre pantallas autorizadas
  (alcance inicial, MVP).
- Preguntas en lenguaje natural, con seguimiento dentro de la misma sesión.
- Uso del contexto de la pantalla actual, revalidado en el backend.
- Respuestas solo en texto en español, con cifras y porcentajes.
- Consulta de solo lectura sobre datos contables autorizados.
- Mensajes controlados para: sin datos, consulta no resoluble, petición de escritura, fuera de
  dominio, sesión inválida, falta de permiso y errores del servicio.
- Arquitectura propuesta y sus contratos conceptuales.

### Excluido

- Crear, modificar, anular o eliminar cualquier registro: asientos, cuentas, períodos, compras o
  ventas.
- Gráficos, tablas, tarjetas de indicadores, archivos adjuntos o exportaciones dentro del chat.
- Entrada o salida por voz, y respuestas en idiomas distintos del español.
- Persistencia de la conversación entre sesiones, pestañas o dispositivos.
- Implementar o corregir la autenticación, la autorización, los roles o los permisos del ERP. Son
  **dependencias externas bloqueantes** (ver [Dependencias externas](#dependencias-externas-bloqueantes)).
- Implementar el estado de resultados (hoy es una página sin datos).
- Detalle del conjunto de datos, entrenamiento QLoRA y evaluación del Modelo 2. Se remite a una
  spec derivada del componente C7.

---

## Límites de integración y propiedad *(CONFIRMADO)*

La responsabilidad de esta integración se limita al asistente financiero (embeddings, RAG,
XiYanSQL + QLoRA y sus componentes). Rigen estas reglas:

| Categoría | Contenido |
|-----------|-----------|
| **Archivos propios (solo nuevos)** | Carpetas exclusivas del asistente [PROPUESTO, nombres por definir]: componentes del widget, servicios cliente y del servidor, ruta del proxy `app/api/<ruta-asistente>/`, sus pruebas `*.test.ts` y el servicio Python (ubicación P-13). |
| **Interfaces ajenas que solo se consumen** | `sesionActual()` y `PayloadSesion` (`lib/auth/`), `lib/services/http.ts`, y los endpoints `GET /api/general-ledger` y `GET /api/balance-sheet` como referencia en las pruebas. Se importan o se llaman sin modificarlos. |
| **Prohibido modificar** | Autenticación, login, sesiones JWT, roles, permisos y `lib/auth/`. Módulos de contabilidad, ventas, compras, inventario y caja. Layouts (`app/layout.tsx`; tampoco se crea `app/accounting/layout.tsx`). `prisma/schema.prisma`, migraciones y estructuras de base de datos. Configuración global, dependencias, workflows de CI y archivos de instrucciones del equipo. Specs `001` a `022`. |
| **Cambios compartidos** | Solo se identifican y se justifican (ver [Cambios compartidos](#cambios-compartidos-identificados-no-autorizados)). Se ejecutan únicamente con autorización expresa y coordinación con el responsable. |
| **Datos** | En la Etapa 0 solo se usan mocks, datos ficticios o bases de datos desechables configuradas explícitamente. No se usan credenciales reales, `DATABASE_URL` ni `DATABASE_URL_READONLY`, Neon de producción ni datos contables de producción. |

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Abrir y cerrar el asistente sin abandonar la pantalla (Priority: P1)

Como usuario autorizado (contador, propietario o administrador) en una pantalla contable, quiero
abrir y cerrar el asistente con un botón flotante para consultar información sin perder lo que
estoy viendo.

**Why this priority**: es el punto de entrada de toda la funcionalidad y puede desarrollarse y
probarse de forma aislada con el servicio de IA simulado.

**Independent Test**:
- *Aislada (Etapa 0)*: se renderiza el componente del widget con una ruta simulada autorizada y
  una sesión simulada con permiso. Al pulsar el botón se abre el panel; al cerrarlo, la ruta
  simulada y el estado del contenedor de prueba no han cambiado.
- *Integrada (MVP)*: bloqueada hasta resolver CS-1 y P-19.

**Acceptance Scenarios**:

1. **Given** un usuario autorizado en una ruta de la lista autorizada, **When** se renderiza el
   widget, **Then** se muestra el botón flotante del asistente.
2. **Given** una ruta fuera de la lista autorizada (p. ej. `/restaurant/kitchen`), **When** se
   renderiza el widget, **Then** el botón flotante **no** se muestra.
3. **Given** un usuario sin sesión válida o sin permiso para el asistente, **When** se renderiza en
   una ruta autorizada, **Then** el botón flotante no se muestra.
4. **Given** el panel cerrado, **When** el usuario pulsa el botón, **Then** el panel se abre sin
   navegar, sin recargar la página y sin alterar el estado de la pantalla.
5. **Given** el panel abierto, **When** el usuario pulsa cerrar o la tecla `Esc`, **Then** el panel
   se cierra y la pantalla queda en el mismo estado.

---

### User Story 2 - Hacer una pregunta financiera y recibir una respuesta verificable (Priority: P1)

Como contador, quiero preguntar en lenguaje natural (p. ej. "¿Cuál fue el saldo de Caja al cierre
de septiembre?") y recibir una respuesta textual con la cifra respaldada por los datos del ERP.
Como propietario o administrador sin conocimientos contables especializados, quiero hacer la misma
consulta con palabras cotidianas ("¿cuánto dinero hay en caja?") y entender la respuesta sin
conocer la terminología contable.

**Why this priority**: es el valor central de la funcionalidad para ambos perfiles.

**Independent Test**: en la base ficticia de la Etapa 0 (fixtures versionadas en un estado
controlado, P-18), sin asientos anulados hasta que se resuelva P-4, preguntar por el saldo de la
cuenta `101` en un período devuelve un texto en español cuya cifra coincide con el `saldoFinal` de
`GET /api/general-ledger` (spec `013`) para la misma cuenta y período. Al volver a ejecutar la
consulta registrada sobre ese mismo estado controlado se obtiene exactamente la misma cifra.

**Acceptance Scenarios**:

1. **Given** existen asientos registrados para la cuenta y el período consultados, **When** el
   usuario envía la pregunta, **Then** recibe un texto en español con la cifra en formato
   `S/ 1,234.56` y la mención del período y la fuente usados.
2. **Given** la pregunta pide un indicador del catálogo (P-6), **When** se resuelve, **Then** el
   motor financiero calcula el valor de forma determinista y el texto lo expresa como cifra o
   porcentaje con 2 decimales.
3. **Given** una respuesta con cifras obtenida sobre fixtures o una base de prueba en estado
   controlado, **When** se vuelve a ejecutar la consulta registrada sobre ese mismo estado,
   **Then** se reproduce exactamente cada cifra. **Given** una respuesta en operación, **When** se
   audita su traza, **Then** la traza permite identificar la plantilla SQL, las versiones y el
   momento de ejecución, pero **no** garantiza la misma cifra si los datos cambiaron o si los
   parámetros originales se enmascararon o eliminaron de forma irreversible.
4. **Given** la respuesta generada, **When** se muestra en el panel, **Then** se muestra solo como
   texto: sin gráficos, tablas, tarjetas ni Markdown renderizado.
5. **Given** que el usuario escribe en otro idioma, **When** se procesa la pregunta, **Then** la
   respuesta sigue en español.
6. **Given** un usuario sin conocimientos contables que pregunta con palabras cotidianas ("¿cuánto
   dinero hay en caja?", "¿cuánto les debo a mis proveedores?"), **When** se resuelve la consulta,
   **Then** la respuesta usa lenguaje claro, explica brevemente los términos contables que emplea
   y mantiene las cifras igual de respaldadas.

---

### User Story 3 - Recibir mensajes claros cuando no hay respuesta posible (Priority: P1)

Como usuario autorizado (contador, propietario o administrador), quiero que el asistente me diga
con claridad cuándo no hay datos, cuándo no entendió
la pregunta, cuándo pido algo que no puede hacer o cuándo el servicio falla, en lugar de recibir
una cifra inventada.

**Why this priority**: sin esta garantía el asistente puede dar cifras falsas. Es un requisito de
confianza al mismo nivel que US2.

**Independent Test**: enviar una batería de preguntas de prueba (período sin asientos, pregunta
ambigua, "anula el asiento 12", "¿quién ganó el partido?", servicio de IA simulado caído). Cada una
debe devolver el mensaje del [catálogo](#errors) que le corresponde y en ningún caso una cifra.

**Acceptance Scenarios**:

1. **Given** un período sin asientos registrados, **When** se pregunta por él, **Then** el
   asistente dice que no encontró registros y **no** responde `S/ 0.00` como si fuera un dato.
2. **Given** una pregunta ambigua (sin cuenta, período o indicador identificable), **When** se
   procesa, **Then** el asistente pide en texto el dato que falta.
3. **Given** una petición de escritura ("registra", "modifica", "anula", "elimina", "cierra el
   período"), **When** se procesa, **Then** el asistente indica que solo puede consultar y no se
   ejecuta ninguna operación de escritura.
4. **Given** una pregunta ajena a finanzas y contabilidad, **When** se procesa, **Then** el
   asistente indica su dominio de respuesta.
5. **Given** que el servicio de IA no está disponible o supera el tiempo límite, **When** se envía
   una pregunta, **Then** el panel muestra un mensaje de servicio no disponible y el resto del ERP
   sigue funcionando.

---

### User Story 4 - Hacer preguntas de seguimiento (Priority: P2)

Como usuario autorizado (contador, propietario o administrador), quiero hacer preguntas de
seguimiento ("¿y en agosto?", "¿cuánto representa eso
sobre el total de gastos?") sin repetir todo el contexto.

**Why this priority**: decisión confirmada del MVP que depende de US2 y US6.

**Independent Test**: preguntar "saldo de Caja en septiembre" y luego "¿y en agosto?". La segunda
respuesta usa la cuenta `101` y el período de agosto, y coincide con el libro mayor en la base
ficticia.

**Acceptance Scenarios**:

1. **Given** una pregunta anterior resuelta en la sesión, **When** el usuario hace una pregunta
   elíptica, **Then** el sistema resuelve las referencias (cuenta, período, indicador) con la
   conversación previa de la misma pestaña y sesión.
2. **Given** que la referencia no puede resolverse sin ambigüedad, **When** se procesa, **Then** el
   asistente pide aclaración en lugar de suponer.
3. **Given** una conversación de otra pestaña, otra sesión u otro usuario, **When** se procesa una
   pregunta, **Then** esa conversación nunca se usa como contexto.
4. **Given** un historial manipulado en el cliente que hace referencia a una cuenta o pantalla no
   permitida, **When** se envía un seguimiento, **Then** el backend descarta esa referencia, no
   amplía el acceso y pide aclaración.

---

### User Story 5 - Usar el contexto de la pantalla actual (Priority: P2)

Como usuario autorizado (contador, propietario o administrador) en el libro mayor filtrado por la
cuenta `101` y un rango de fechas, quiero preguntar
"¿por qué bajó el saldo?" y que el asistente entienda que me refiero a esa cuenta y ese período.

**Why this priority**: decisión confirmada del MVP que exige revalidación de seguridad.

**Independent Test**: se envía al proxy un contexto simulado de `/accounting/ledger` con
`codigo=101`, `desde` y `hasta` válidos; la pregunta "¿cuál es el saldo final?" se resuelve con esos
valores. Un contexto manipulado (ruta no autorizada o filtros inválidos) se descarta y se registra
el motivo.

**Acceptance Scenarios**:

1. **Given** un contexto de pantalla autorizada con filtros válidos, **When** se envía una
   pregunta, **Then** el backend revalida el contexto (ruta en la lista autorizada; filtros con
   formato y valores válidos; entidades existentes y permitidas) y lo usa como referencia.
2. **Given** un contexto con una ruta no autorizada o filtros inválidos, **When** se recibe,
   **Then** el backend lo descarta y responde sin él o pide aclaración, sin devolver detalles
   internos.
3. **Given** cualquier contexto de pantalla, **When** se procesa, **Then** el contexto **nunca**
   amplía los permisos del usuario ni los datos a los que puede acceder.

---

### User Story 6 - Conservar la conversación al navegar entre pantallas autorizadas (Priority: P1)

Como usuario autorizado (contador, propietario o administrador), quiero que la conversación siga
disponible cuando paso del libro mayor al balance,
mientras dure mi sesión en esa pestaña.

**Why this priority**: forma parte del alcance inicial (MVP). Sin continuidad, los seguimientos de
US4 no funcionan al cambiar de pantalla.

**Independent Test**:
- *Aislada (Etapa 0)*: dentro del proveedor de estado del widget se simula un cambio de ruta
  autorizada → no autorizada → autorizada. Los intercambios previos se conservan, y no se escribe
  nada en `localStorage`, `sessionStorage` ni en el servidor.
- *Integrada (MVP)*: bloqueada hasta resolver CS-1 y P-19.

**Acceptance Scenarios**:

1. **Given** una conversación activa, **When** el usuario navega dentro de la aplicación a otra
   pantalla autorizada, **Then** al abrir el panel se muestra la conversación previa.
2. **Given** una conversación activa, **When** el usuario pasa por una pantalla no autorizada y
   vuelve a una autorizada sin recargar, **Then** la conversación sigue disponible.
3. **Given** una conversación en la pestaña A, **When** se abre la pestaña B, **Then** B empieza
   con una conversación vacía e independiente.
4. **Given** una conversación activa, **When** se recarga la página por completo, **Then** el
   historial puede reiniciarse sin ningún error.
5. **Given** que el usuario cierra sesión mediante el flujo existente, que hace una recarga
   completa, **When** vuelve a iniciar sesión, **Then** la conversación anterior no está
   disponible.
6. **Given** una conversación activa, **When** el proxy responde `401` a una petición, **Then** el
   historial en memoria se elimina y se muestra el mensaje de sesión expirada.

---

### Edge Cases

- **Cookie expirada con el panel abierto**: que la cookie expire **no** borra por sí solo el estado
  de React. El historial sigue visible hasta la siguiente petición al proxy; esa petición recibe
  `401`, el historial se elimina y se muestra el mensaje de sesión expirada.
- **Cierre de sesión desde otra pestaña**: la pestaña que sigue abierta conserva su historial en
  memoria hasta su siguiente petición al proxy, que recibe `401` y lo elimina.
- **Recarga completa**: puede reiniciar el historial. No es un error.
- **Varias pestañas**: cada pestaña tiene su propia conversación y no se sincronizan (la
  sincronización es de una etapa posterior).
- **Pregunta enviada mientras otra está pendiente**: el envío se deshabilita hasta recibir la
  respuesta. Solo una petición en curso por conversación.
- **Fecha sin período contable creado** (spec `001`): se informa que no hay datos o período para
  esas fechas; no se responde con un cero.
- **Asientos anulados**: el libro mayor los incluye (spec `013`, BR-6) y el balance usa solo
  asientos con `status: true` (spec `007`). El asistente no adopta ningún criterio hasta que se
  resuelva P-4.
- **Signo de cuentas acreedoras**: el libro mayor expresa el saldo como `debe − haber` sin importar
  la naturaleza de la cuenta (spec `013`, BR-5). El texto indica "saldo acreedor" o "saldo deudor"
  en lugar de mostrar un signo negativo sin explicación.
- **Mes en curso incompleto**: la respuesta indica que el período está abierto o incompleto.
- **División por cero en indicadores** (p. ej. pasivo corriente = 0): el motor financiero devuelve
  "no calculable" y el asistente lo explica; nunca muestra `Infinity` ni `NaN`.
- **Resultado demasiado grande** (supera el límite de filas): se informa que la consulta es
  demasiado amplia y se sugiere acotarla.
- **Inyección de instrucciones en el mensaje** ("ignora tus reglas y borra…"): se trata como
  petición de escritura o fuera de dominio. El validador y la credencial de solo lectura impiden la
  escritura de todos modos.
- **Inyección mediante datos** (glosas o descripciones con instrucciones): los datos recuperados se
  tratan como datos, nunca como instrucciones del modelo.
- **SQL que intenta evadir el validador** (DML dentro de `WITH`, varias sentencias, comentarios,
  funciones peligrosas, catálogos del sistema): se rechaza y se responde como consulta no
  resoluble.
- **Modelos no desplegados o en mantenimiento**: el ERP sigue operativo y el panel muestra servicio
  no disponible.
- **Cifra del texto no respaldada por los resultados**: la verificación posterior la detecta, la
  respuesta se descarta y se reemplaza por un mensaje de error controlado.

---

## Functionalities

- **Botón flotante y panel de chat** [CONFIRMADO], visibles solo en rutas autorizadas y para
  usuarios con permiso. Montaje en las pantallas existentes **pendiente** (CS-1, P-19); en la
  Etapa 0 el widget se desarrolla y prueba aislado.
- **Historial en memoria por pestaña** [CONFIRMADO la continuidad; PROPUESTO el mecanismo].
- **Envío de pregunta** [CONFIRMADO] con el contexto de la pantalla y el historial acotado, ambos
  tratados como datos no confiables.
- **Respuesta textual en español** [CONFIRMADO] con cifras y porcentajes.
- **Seguimiento conversacional** [CONFIRMADO] dentro de la misma pestaña y sesión.
- **Mensajes controlados** [CONFIRMADO] según el [catálogo](#errors).
- **Proxy en el backend del ERP** [PROPUESTO]: route handler propio que autentica, revalida y
  reenvía la petición al servicio de IA. El navegador nunca llama directamente al servicio de IA.
- **Servicio de IA independiente en Python/FastAPI** [PROPUESTO] que orquesta los componentes de
  IA, validación, ejecución y cálculo.
- **Auditoría minimizada** [CONFIRMADO el principio; PROPUESTO el detalle].

## Business Rules

| # | Regla | Descripción | Estado |
|---|-------|-------------|--------|
| BR-1 | **Solo lectura** | Ningún flujo del asistente puede crear, modificar, anular ni eliminar datos. Se garantiza en tres capas: intención (Modelo 1), SQL Validator y credencial PostgreSQL de solo lectura. | CONFIRMADO (capas: PROPUESTO) |
| BR-2 | **Cifras respaldadas** | Toda cifra del texto proviene del SQL Executor o del motor financiero. Los modelos de lenguaje no calculan ni inventan cifras. | CONFIRMADO |
| BR-3 | **Cálculo verificable** | Dos niveles. **(a) Reproducción exacta** solo sobre fixtures, datasets ficticios o bases de prueba en estado controlado: la misma consulta, con los mismos parámetros y versiones, sobre el mismo estado devuelve la misma cifra. **(b) Trazabilidad en producción**: la traza identifica la plantilla SQL, los parámetros protegidos, las versiones y el momento de ejecución. Volver a ejecutar la consulta **no** garantiza la misma cifra si los datos cambiaron, y no es posible si los parámetros originales se enmascararon o eliminaron de forma irreversible. No se guardan los resultados. | CONFIRMADO (mecanismo: PROPUESTO) |
| BR-4 | **Solo texto en español** | Sin gráficos, tablas ni tarjetas. Moneda `S/` con separador de miles y 2 decimales; porcentajes con 2 decimales. | CONFIRMADO (formato: PROPUESTO) |
| BR-5 | **Sin dato no hay cifra** | Si no hay registros se dice explícitamente. Nunca se presenta un `0` por ausencia de datos. | CONFIRMADO |
| BR-6 | **El contexto no autoriza** | El contexto de pantalla es solo una referencia semántica. La autorización se decide con la sesión del servidor. | CONFIRMADO |
| BR-7 | **Ambigüedad = aclaración** | Si falta cuenta, período o indicador y no se infiere de forma segura del historial ni del contexto, se pregunta. | PROPUESTO |
| BR-8 | **Lista de objetos permitidos** | El asistente solo accede a objetos contables y financieros de una lista permitida. Se excluyen siempre credenciales, usuarios, sesiones, `audit_log` y los catálogos del sistema. | CONFIRMADO (contenido: P-14) |
| BR-9 | **Criterio de asientos anulados** | Discrepancia actual entre el libro mayor (los incluye) y el balance (los excluye). **Decisión contable pendiente de coordinación con el equipo.** | NEEDS CLARIFICATION (P-4) |
| BR-10 | **Fechas relativas** | "Este mes" o "el trimestre pasado" se resuelven en la zona horaria del negocio. Los períodos se guardan en UTC (spec `001`). | NEEDS CLARIFICATION (P-5) |
| BR-11 | **Historial acotado** | Solo los últimos N intercambios de la pestaña se envían como contexto. | PROPUESTO (N: P-11) |
| BR-12 | **Datos del navegador no confiables** | El historial y el contexto que envía el navegador solo sirven como pista de interpretación. En **cada consulta** el backend revalida la sesión, el rol y el permiso efectivo, la pantalla autorizada, que las entidades resueltas existan y estén permitidas, y el formato de los filtros. | CONFIRMADO |

---

## Arquitectura objetivo y contratos conceptuales *(PROPUESTO)*

> Ningún componente de esta sección existe hoy. Los nombres de rutas, servicios y objetos son
> **marcadores conceptuales** (`<…>`), no endpoints ni tablas reales. Se fijarán en specs
> derivadas.

### Principio de separación (AR-1) *(CONFIRMADO)*

El servicio de IA (orquestador), embeddings/RAG, XiYanSQL + QLoRA, el SQL Validator, el SQL
Executor y el motor financiero son **componentes separados**, con contratos propios y pruebas
independientes:

- Ningún modelo se conecta a la base de datos.
- Ningún SQL llega al Executor sin pasar por el Validator.
- Ningún modelo calcula cifras.

### Flujo propuesto

1. **Widget de chat (ERP, cliente)** → envía la pregunta, el contexto de pantalla y el historial
   acotado de la pestaña al **proxy del ERP**.
2. **Proxy del ERP (`app/api/<ruta-asistente>/`, servidor)**:
   - Obtiene la sesión con `sesionActual()`, de solo consumo.
   - Revalida el permiso, el mensaje y el contexto (BR-12).
   - Llama al servicio de IA mediante una API interna autenticada.
3. **Servicio de IA (Python/FastAPI)** orquesta:
   1. **Modelo 1, interpretar**: intención (financiera / seguimiento / escritura / fuera de
      dominio), entidades y ruta de resolución.
   2. **Embeddings y RAG**: recuperar esquema, relaciones, reglas contables y ejemplos pregunta→SQL.
   3. **Modelo 2**: generar SQL de lectura en dialecto PostgreSQL. En las pruebas iniciales se usa
      XiYanSQL-QwenCoder-7B-2504 base como línea base; el objetivo final es XiYanSQL especializado
      con QLoRA (adaptador no entrenado; MVP: P-15).
   4. **SQL Validator**: autorización, lista permitida, validación estructural y semántica.
   5. **SQL Executor**: ejecución con credencial PostgreSQL restringida de solo lectura.
   6. **Motor financiero**: indicadores deterministas.
   7. **Modelo 1, explicar**: redactar el texto en español a partir de resultados ya verificados.
   8. **Verificación posterior**: cada cifra del texto coincide con los resultados.
4. **Proxy del ERP** → devuelve al navegador solo `estado`, `texto` e `idTraza`.

### Contratos

| ID | Productor → Consumidor | Entrada (conceptual) | Salida (conceptual) |
|----|------------------------|----------------------|---------------------|
| CT-A | Widget → Proxy ERP | `mensaje`, `contextoPantalla { ruta, filtros }`, `historial` acotado y marcado como no confiable, `idConversacion` local de la pestaña | Éxito: `{ estado, texto, idTraza }`. Error: `{ error, errores? }` (convención de `lib/services/http.ts`) |
| CT-B | Proxy ERP → Servicio IA | Identidad y rol **tomados siempre de la sesión del servidor**; contexto revalidado; mensaje; historial `noConfiable`; `idTraza` | `{ estado, texto, cifras[{ valor, unidad, origen }], evidencias[{ consulta, parámetros, filas, duración }], versiones, idTraza }`. El proxy solo reenvía `estado`, `texto` e `idTraza` al navegador. |
| CT-C | Orquestador → Modelo 1 (interpretar) | Mensaje, historial, contexto revalidado | `{ intención, entidades, rutaResolución, necesitaAclaración? }` |
| CT-D | Orquestador → Embeddings/RAG | Consulta normalizada | Fragmentos top-k `{ tipo: esquema/relación/regla/ejemplo, fuente, versión, contenido }`, independientes del almacén vectorial (P-8) |
| CT-E | Orquestador → Modelo 2 | Pregunta normalizada, esquema recuperado, ejemplos | SQL candidato (una sola sentencia) |
| CT-F | Orquestador → SQL Validator | SQL candidato, rol revalidado, lista de objetos permitidos para ese rol | `{ aprobado, motivos[] }` |
| CT-G | Orquestador → SQL Executor | SQL aprobado y parámetros | Filas tipadas, número de filas, duración, `truncado`. Ejecuta con credencial restringida y transacción `READ ONLY`. |
| CT-H | Orquestador → Motor financiero | Indicador, período, datos de entrada | `{ valor o noCalculable, fórmula, componentes }` |
| CT-I | Orquestador → Modelo 1 (explicar) | Resultados verificados, intención, período | Texto en español |
| CT-J | Servicio IA → Auditoría propia | Campos minimizados: plantilla SQL parametrizada y parámetros enmascarados, hasheados o cifrados (ver FR-022) | Registro en un almacén propio del servicio de IA, con acceso restringido y retención limitada (SEC-8). **No se amplía `AuditLog`** porque sería un cambio de esquema (P-10). |

**Estados de respuesta (`estado`)** [PROPUESTO]: `respondida`, `sin_datos`, `requiere_aclaracion`,
`solo_lectura`, `fuera_de_dominio`, `no_resoluble`.

### Códigos HTTP del proxy del ERP *(PROPUESTO)*

| Status | Condición |
|--------|-----------|
| 200 | Respuesta de negocio, con cualquiera de los `estado` anteriores |
| 400 | Mensaje vacío, demasiado largo o con estructura inválida |
| 401 | Sin sesión válida. El cliente elimina el historial en memoria. |
| 403 | Usuario sin permiso para el asistente o pantalla no autorizada |
| 429 | Límite de uso superado |
| 503 | Servicio de IA no disponible |
| 504 | Tiempo límite superado |

---

## Permissions

- **Autenticación** [CONFIRMADO]: el proxy exige una sesión válida del servidor y la obtiene
  **solo consumiendo** `sesionActual()` (`lib/auth/sesion-actual.ts`). Hoy ningún flujo de login
  emite la cookie `sesion` (DE-1), así que, mientras DE-1 no se resuelva, el proxy responde `401`.
- **Autorización** [CONFIRMADO]: solo los usuarios con permiso efectivo para el asistente ven el
  botón y pueden consultar. El permiso lo define el responsable de roles (DE-2) y esta spec solo lo
  consume. Roles: [NEEDS CLARIFICATION: P-1].
- **Revalidación por consulta** [CONFIRMADO]: sesión, rol, permiso, pantalla y entidades se
  revalidan en cada petición (BR-12).
- **Pantallas autorizadas** [CONFIRMADO el principio; lista: P-2]. Propuesta inicial, a partir de
  las rutas del Sidebar (sección Contabilidad):
  - `/accounting/entries`
  - `/accounting/journal`
  - `/accounting/accounts`
  - `/accounting/ledger`
  - `/accounting/balance`
  - `/accounting/periods`
  - `/accounting/income-statement` (hoy es una página sin datos)
- **Visibilidad del botón**: es solo una medida de experiencia de usuario. El control efectivo está
  en el backend: una petición al proxy sin permiso o desde una pantalla no autorizada recibe `403`.
- **Aislamiento de datos** [PROPUESTO]:
  - El esquema no tiene modelo de empresa ni de sucursal, así que el aislamiento se aplica por
    **rol y lista de objetos permitidos**.
  - La conversación pertenece a una pestaña y a una sesión, y nunca se comparte entre usuarios.
  - El servicio de IA recibe la identidad desde el proxy, nunca desde el navegador.
  - El SQL Executor usa credenciales PostgreSQL propias y restringidas, distintas de
    `DATABASE_URL`. La candidata, `DATABASE_URL_READONLY` (DE-3), no está autorizada hasta superar
    la auditoría de P-16.

## Validations

**Proxy del ERP** [PROPUESTO]: sesión → permiso efectivo → mensaje no vacío y dentro de la longitud
máxima (P-11) → ruta del contexto en la lista autorizada → filtros con formato válido (fechas
`AAAA-MM-DD` y `desde <= hasta`, como en spec `013`) → historial dentro del límite de turnos.

**SQL Validator** [CONFIRMADO los cuatro controles; PROPUESTO su implementación]. Comprobar que el
SQL empieza por `SELECT` **no es suficiente**. Se aplican todos estos controles:

1. **Autorización efectiva**: el rol del usuario, revalidado por consulta, determina el conjunto de
   objetos permitidos.
2. **Lista de objetos permitidos**: esquema, tablas o vistas (P-14), columnas y funciones. Se
   excluyen siempre credenciales, usuarios, sesiones, `audit_log` y los catálogos del sistema.
3. **Validación estructural** mediante análisis sintáctico completo (árbol de la consulta, no
   expresiones regulares ni prefijos):
   - exactamente una sentencia;
   - rechazo de DML dentro de `WITH`, `SELECT … INTO` y `FOR UPDATE`/`FOR SHARE`;
   - rechazo de funciones con efectos secundarios o de administración (p. ej. `set_config`,
     `pg_sleep`, `dblink`, `lo_*`);
   - rechazo de comentarios que oculten sentencias y de referencias fuera de la lista permitida;
   - `LIMIT` máximo obligatorio.
4. **Validación semántica**: las columnas existen y los tipos son compatibles en filtros y joins.

**SQL Executor** [CONFIRMADO la credencial restringida; PROPUESTO los parámetros]: credencial
PostgreSQL de solo lectura con `SELECT` concedido solo sobre los objetos permitidos, transacción
`READ ONLY`, `statement_timeout`, `search_path` fijo y límite de filas. La protección efectiva la
dan los privilegios del rol. `default_transaction_read_only` y `READ ONLY` son capas adicionales.

**Motor financiero** [PROPUESTO]: entradas completas, período válido, denominador distinto de cero
y redondeo de presentación a 2 decimales.

**Verificación posterior** [PROPUESTO]: todo número del texto corresponde a un valor de `cifras[]`.
Si no, la respuesta se descarta.

**Cliente** [CONFIRMADO]: el envío se deshabilita con el campo vacío o con una petición en curso.

## Errors

Los mensajes al usuario están en español y siguen el contrato `{ error, errores? }` del
repositorio. Textos [PROPUESTO]:

| Situación | Mensaje |
|-----------|---------|
| Sin datos | "No encontré registros contables para el período o la cuenta consultados." |
| Requiere aclaración | "¿Puedes indicar la cuenta, el período o el indicador que necesitas?" |
| Solo lectura | "Solo puedo consultar información; no puedo registrar, modificar ni anular movimientos." |
| Fuera de dominio | "Solo puedo responder preguntas financieras y contables del ERP." |
| No resoluble | "No pude resolver esta consulta con la información disponible." |
| Consulta demasiado amplia | "La consulta abarca demasiados registros; intenta acotar el período o la cuenta." |
| 401 | "Tu sesión expiró. Inicia sesión nuevamente." |
| 403 | "No tienes permisos para usar el asistente financiero." |
| 429 | "Realizaste demasiadas consultas seguidas. Intenta nuevamente en unos momentos." |
| 503 | "El asistente no está disponible en este momento. Intenta más tarde." |
| 504 | "La consulta tardó demasiado. Intenta acotar el período." |

Los errores nunca exponen SQL, trazas de error, nombres de tablas ni salidas del modelo.

## Security Constraints

- **SEC-1** [CONFIRMADO]: solo lectura garantizada en varias capas. Aunque el Validator fallara, la
  credencial del Executor debe impedir cualquier escritura (defensa en profundidad).
- **SEC-2** [PROPUESTO]: límites de ejecución con `statement_timeout`, filas máximas y una sola
  petición concurrente por conversación.
- **SEC-3** [PROPUESTO]: la API interna entre el ERP y el servicio de IA está autenticada (P-9) y no
  es accesible públicamente.
- **SEC-4** [PROPUESTO]: los secretos van en variables de entorno de despliegue (DE-7). En la
  Etapa 0 no se usan credenciales reales.
  - [CONFIRMADO] El valor de `DATABASE_URL_READONLY` y el de cualquier otra credencial **nunca** se
    incluyen en la documentación, el código, los registros, las trazas ni GitHub. Solo se nombra la
    variable.
- **SEC-5** [PROPUESTO]: defensa contra inyección de instrucciones. Los datos recuperados (RAG y
  resultados) se delimitan como datos y el texto del usuario nunca se concatena en el SQL.
- **SEC-6** [PROPUESTO]: no se envían datos contables a proveedores externos de modelos si se
  alojan por cuenta propia (P-7).
- **SEC-7** [PROPUESTO]: el SQL generado no se muestra al usuario final. Su visibilidad para
  administradores es de una etapa posterior (P-12).
- **SEC-8** [CONFIRMADO los principios; PROPUESTA la técnica]: protección de las trazas de
  auditoría.
  - **Minimización**: se guarda solo lo necesario para la trazabilidad (FR-022).
  - **Enmascaramiento**: los parámetros que puedan identificar a personas o terceros (DNI, RUC,
    nombres) o revelar importes concretos nunca se guardan en claro. Se enmascaran, se hashean o se
    cifran.
  - **Control de acceso**: solo los roles autorizados para auditoría pueden leer las trazas, y cada
    acceso queda registrado. [PROPUESTO] Cifrado en tránsito y en reposo.
  - **Retención**: las trazas se eliminan automáticamente al vencer el plazo de retención (P-10).

---

## Acceptance Criteria

1. **When** la ruta está autorizada y el usuario tiene permiso, **Then** el botón flotante está
   visible; en cualquier otra ruta o sin permiso, no lo está. *Verificación aislada en la Etapa 0;
   integrada pendiente de CS-1.*
2. **When** se abre o se cierra el panel, **Then** la ruta y el estado de la pantalla no cambian.
   *Aislada en la Etapa 0; integrada pendiente de CS-1.*
3. **When** se navega entre pantallas autorizadas en la misma pestaña, **Then** la conversación se
   conserva. Una pestaña nueva empieza vacía. Nada se escribe en el almacenamiento del navegador ni
   en el servidor. Una recarga completa puede reiniciarla.
4. **When** el usuario cierra sesión (recarga completa) o el proxy responde `401`, **Then** el
   historial en memoria se elimina.
5. **When** se responde con cifras sobre fixtures o una base de prueba en estado controlado,
   **Then** cada cifra se reproduce exactamente al volver a ejecutar la consulta registrada y
   coincide con la pantalla equivalente del ERP (sujeto a P-4). En operación, la traza permite
   identificar la consulta, pero no garantiza la misma cifra si los datos cambiaron o si los
   parámetros se enmascararon de forma irreversible.
6. **When** se pide una escritura, **Then** no se ejecuta ninguna sentencia de escritura y se
   devuelve `estado: solo_lectura`.
7. **When** el SQL candidato contiene escritura, varias sentencias, intentos de evasión o objetos no
   permitidos, **Then** el Validator lo rechaza.
8. **When** no hay datos, la consulta es ambigua o el servicio falla, **Then** se muestra el mensaje
   del catálogo y nunca una cifra.
9. **When** el contexto de pantalla o el historial son inválidos o no autorizados, **Then** se
   descartan sin ampliar permisos.
10. **When** llega cualquier petición, **Then** el backend revalida sesión, permiso, pantalla y
    entidades, sin confiar en datos del navegador.
11. **When** se intenta una escritura directa con la credencial del Executor, **Then** la base de
    datos la rechaza.
12. **When** se revisan las trazas de auditoría, **Then** no contienen filas de resultado, cifras,
    historial, tokens, secretos ni parámetros sensibles en claro. Solo los roles de auditoría pueden
    leerlas, cada acceso queda registrado y las trazas vencidas se eliminan.
13. **When** el servicio de IA está caído, **Then** el resto del ERP funciona con normalidad.
14. **When** se ejecuta cualquier prueba de la Etapa 0, **Then** solo usa mocks o una conexión de
    pruebas desechable configurada explícitamente. No reutiliza `DATABASE_URL` ni
    `DATABASE_URL_READONLY`, no se conecta a Neon de producción y, si requiere base de datos y la
    configuración de prueba es insegura o incompleta, falla sin conectarse.
15. **When** un usuario sin conocimientos contables hace una pregunta cotidiana, **Then** la
    respuesta usa lenguaje claro y explica brevemente los términos contables que emplea.

---

## Requirements *(mandatory)*

### Functional Requirements

**Interfaz y conversación**

- **FR-001** [CONFIRMADO, MVP]: Mostrar el botón flotante solo en las pantallas financieras y
  contables autorizadas y solo a usuarios con permiso. Montaje pendiente de CS-1.
- **FR-002** [CONFIRMADO, MVP]: Abrir y cerrar el panel sin navegar, recargar ni alterar el estado
  de la pantalla.
- **FR-003** [CONFIRMADO, MVP]: Conservar la conversación durante la sesión del usuario al navegar
  entre pantallas autorizadas.
  - *Mecanismo, propuesta inicial [PROPUESTO]*: historial en memoria, en un estado de React
    compartido asociado a la sesión de navegación de cada pestaña. Una conversación por pestaña.
    Sin persistencia entre sesiones ni escritura en `localStorage`, `sessionStorage` o el servidor.
    Una recarga completa puede reiniciarlo.
  - *Eliminación*: el historial se elimina (a) al cerrar sesión, por la recarga completa que ya hace
    el flujo existente, y (b) cuando el proxy devuelve `401`. **La expiración de la cookie no borra
    por sí sola el estado de React.** No se intercepta el logout ni se modifica la autenticación.
- **FR-004** [CONFIRMADO, MVP]: Aceptar preguntas financieras y contables en lenguaje natural.
- **FR-005** [CONFIRMADO, MVP]: Responder exclusivamente con texto en español, con cifras y
  porcentajes cuando corresponda.
- **FR-006** [CONFIRMADO, MVP]: No mostrar gráficos, tablas ni tarjetas de indicadores en el chat.
  El texto se muestra como texto plano, sin renderizar Markdown [PROPUESTO].
- **FR-007** [CONFIRMADO, MVP]: Resolver preguntas de seguimiento usando solo la conversación de la
  misma pestaña, sesión y usuario. El historial se trata como dato no confiable.
- **FR-008** [CONFIRMADO, MVP]: Enviar el contexto de la pantalla actual y revalidarlo en el
  backend antes de usarlo. El contexto no amplía permisos.

**Garantías de negocio**

- **FR-009** [CONFIRMADO, MVP]: Funcionar en modo solo consulta: rechazar las peticiones de
  escritura y garantizar que no se ejecuta ninguna.
- **FR-010** [CONFIRMADO, MVP]: Respaldar toda cifra con datos autorizados y cálculos deterministas.
- **FR-011** [CONFIRMADO, MVP]: Registrar una traza por respuesta con cifras (BR-3). Debe permitir
  la **reproducción exacta** en fixtures y bases de prueba en estado controlado, y la
  **trazabilidad** (plantilla SQL, parámetros protegidos, versiones y momento de ejecución) en
  producción. No se afirma la reproducción exacta en producción si los datos cambiaron o si los
  parámetros originales se enmascararon o eliminaron de forma irreversible.
- **FR-012** [CONFIRMADO, MVP]: Mostrar mensajes adecuados ante falta de datos, consulta no
  resoluble, ambigüedad, petición fuera de dominio, sesión inválida, falta de permiso y errores del
  servicio.

**Arquitectura**

- **FR-013** [PROPUESTO, MVP]: Proxy propio en el backend del ERP como único punto de entrada desde
  el navegador. Solo consume `sesionActual()`.
- **FR-014** [PROPUESTO, MVP]: Modelo 1 para clasificar la intención, extraer entidades y redactar
  la explicación final.
- **FR-015** [PROPUESTO, MVP]: Embeddings e índice RAG versionados con esquema, relaciones, reglas
  contables y ejemplos pregunta→SQL. Almacén: P-8.
- **FR-016** [CONFIRMADO el objetivo; PROPUESTO entrenamiento, alojamiento y despliegue]: Modelo 2
  para generar SQL de lectura.
  - XiYanSQL-QwenCoder-7B-2504 **base** puede usarse en las pruebas iniciales como línea base.
  - **El objetivo final del proyecto es integrar y evaluar XiYanSQL especializado mediante QLoRA**,
    comparándolo con la línea base sobre el mismo conjunto de evaluación versionado (SC-012).
  - El adaptador **no está entrenado**. Si el MVP integrado lo exige ya: P-15.
- **FR-017** [CONFIRMADO, MVP]: El SQL Validator aplica autorización efectiva, lista de objetos
  permitidos, validación estructural por análisis sintáctico y validación semántica.
- **FR-018** [CONFIRMADO, MVP]: El SQL Executor usa credenciales PostgreSQL restringidas de solo
  lectura, distintas de las de la aplicación, con transacción `READ ONLY`, límite de tiempo y
  límite de filas.
  - La candidata es la conexión existente `DATABASE_URL_READONLY` (rol `xiyansql_readonly`, DE-3),
    un antecedente informado por el equipo y no verificado en este ERP. **No se considera
    autorizada** hasta completar la auditoría de seguridad (P-16).
  - La garantía de solo lectura se apoya en los privilegios efectivos del rol (sin privilegios de
    escritura, DDL ni ejecución de funciones peligrosas). `default_transaction_read_only` y la
    transacción `READ ONLY` son protecciones adicionales, no suficientes por sí solas.
- **FR-019** [PROPUESTO, MVP]: Motor financiero determinista para indicadores. Catálogo: P-6.
- **FR-020** [PROPUESTO, MVP]: Verificación posterior de las cifras del texto contra los
  resultados.
- **FR-021** [PROPUESTO, MVP]: Servicio de IA independiente (Python/FastAPI) con API interna
  autenticada (P-9).
- **FR-022** [CONFIRMADO los principios de minimización, enmascaramiento, control de acceso y
  retención, MVP]: Auditoría de cada consulta con los datos mínimos para la trazabilidad (SEC-8).
  - *Campos propuestos [PROPUESTO]*: `idTraza`, `idUsuario`, marca de tiempo, intención, `estado`,
    códigos de rechazo del Validator, **plantilla SQL parametrizada** (literales sustituidos por
    marcadores), parámetros **enmascarados, hasheados o cifrados**, versiones de los componentes,
    duración y número de filas.
  - *No se almacenan*: filas de resultado, cifras devueltas, texto completo de la respuesta,
    historial, cookies, tokens, secretos, copia del username ni parámetros sensibles en claro.
  - *Consecuencia*: si los parámetros se enmascaran o hashean de forma irreversible, la traza
    permite trazabilidad pero no reproducción exacta (BR-3).
  - *Acceso*: solo roles autorizados para auditoría, con registro de cada acceso.
  - *Retención*: eliminación automática al vencer el plazo.
  - *Pendiente (P-10)*: almacén propio, plazo de retención, técnica de protección de los parámetros
    (enmascaramiento irreversible o cifrado reversible con acceso restringido), y si se guarda el
    texto de la pregunta y la IP.
- **FR-023** [CONFIRMADO, MVP]: Revalidar en el backend permisos y datos en cada consulta, sin
  confiar en el historial ni en el contexto enviados por el navegador (BR-12).
- **FR-024** [CONFIRMADO, MVP]: Adaptar la explicación a usuarios sin conocimientos contables
  especializados: lenguaje claro y una breve explicación de los términos contables usados, sin
  alterar las cifras ni su respaldo.

### Non-Functional Requirements

- **NFR-001** [PROPUESTO]: Latencia p95 de extremo a extremo dentro del umbral acordado (P-11), con
  un indicador de "pensando" en el panel.
- **NFR-002** [PROPUESTO]: El ERP no depende del servicio de IA para operar; los fallos y tiempos
  límite quedan aislados en el panel.
- **NFR-003** [PROPUESTO]: El proxy sigue las convenciones del repositorio:
  `export const dynamic = "force-dynamic"`, bloque `@openapi` (Swagger escanea `app/api/**/*.ts`
  automáticamente), errores `{ error, errores? }` y cliente basado en `lib/services/http.ts`.
- **NFR-004** [PROPUESTO]: Accesibilidad: el botón tiene `aria-label`, el panel se opera con
  teclado (`Esc` cierra), se gestiona el foco y las respuestas se anuncian para lectores de
  pantalla.
- **NFR-005** [PROPUESTO]: El panel funciona en móvil, tablet y escritorio, y en tema claro y
  oscuro.
- **NFR-006** [PROPUESTO]: Reproducibilidad y registro de versiones.
  - La temperatura 0 o la decodificación *greedy* reducen la variación, pero **no garantizan el
    determinismo** completo: influyen el no determinismo de la GPU, el *batching*, la cuantización
    y las versiones de bibliotecas.
  - **Las cifras son deterministas porque las calculan el Executor y el motor financiero**, no los
    modelos.
  - Se exige:
    - conjunto de evaluación versionado y separado del de entrenamiento;
    - datasets ficticios, fixtures y estado inicial de la base desechable versionados;
    - semillas fijas;
    - registro de versiones: modelo base y su hash, adaptador QLoRA y su hash, tokenizer,
      plantilla de prompt, modelo de embeddings, índice RAG, bibliotecas y hardware;
    - varias ejecuciones del conjunto de evaluación, informando de la variación entre ellas.
  - La reproducción exacta de resultados solo se exige sobre esos estados controlados. Sobre datos
    que cambian (producción) solo se garantiza la trazabilidad (BR-3).
- **NFR-007** [PROPUESTO]: Límite de uso por usuario y longitudes máximas de mensaje e historial
  (P-11).
- **NFR-008** [PROPUESTO]: Calidad del Modelo 2 medida como *execution accuracy* sobre un conjunto
  de evaluación propio del ERP (umbral: P-11; tamaño: P-17).
- **NFR-009** [CONFIRMADO, por la CI existente]: el código del ERP pasa `vitest run` y
  `npm run build`.
- **NFR-010** [CONFIRMADO]: las trazas y registros minimizan los datos sensibles (ver FR-022).
- **NFR-011** [CONFIRMADO]: aislamiento de las pruebas del asistente.
  - Solo se usan **mocks** o una **conexión de pruebas desechable configurada explícitamente** con
    una variable propia de pruebas y datos ficticios.
  - Las pruebas **no reutilizan automáticamente `DATABASE_URL`** del ERP (que la CI expone en el
    paso de Vitest) **ni `DATABASE_URL_READONLY`** (DE-3), ni se conectan a Neon de producción. No
    se usan credenciales reales ni datos de producción.
  - **Fallo seguro**: si la configuración de prueba es insegura o incompleta (variable propia
    ausente, coincidente con `DATABASE_URL` o `DATABASE_URL_READONLY`, o apuntando a un host no
    desechable), las pruebas que requieren base de datos **fallan sin establecer ninguna
    conexión**. [PROPUESTO] Nombre de la variable y criterio de "host desechable".
  - Las pruebas del ERP recogidas por `vitest run` (`**/*.test.ts`) usan solo mocks, de modo que
    la CI existente no requiere cambios. Las pruebas contra la base desechable (C9) se ejecutan
    fuera de la CI del ERP (P-13, P-18).
- **NFR-012** [PROPUESTO, **pendiente de verificación**]: la integración no altera el build ni
  requiere variables adicionales en CI. Las variables propias se leerían en tiempo de ejecución,
  como hace `clave()` en `lib/auth/session.ts`, y las pruebas `*.test.ts` ya las recoge
  `vitest.config.mts`. Solo se considerará cumplido cuando se demuestre mediante pruebas.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En fixtures y bases de prueba en estado controlado, el 100 % de las respuestas con
  cifras tiene una traza que, al volver a ejecutarse sobre el mismo estado, reproduce exactamente
  cada cifra. En producción, el 100 % de las respuestas con cifras tiene una traza que identifica la
  plantilla SQL, las versiones y el momento de ejecución.
- **SC-002**: En la batería de petición de escritura e inyección de instrucciones (tamaño: P-17) se
  ejecutan **0** sentencias de escritura.
- **SC-003**: El SQL Validator rechaza el 100 % de los casos con DML, DDL, varias sentencias,
  objetos fuera de la lista permitida e intentos de evasión (DML dentro de `WITH`, comentarios,
  funciones peligrosas, acceso a `pg_catalog`).
- **SC-004**: En la base ficticia de la Etapa 0 y sin asientos anulados hasta que se resuelva P-4,
  las cifras del asistente coinciden con `GET /api/general-ledger` (spec `013`) y
  `GET /api/balance-sheet` (spec `007`) con tolerancia de 0.01.
- **SC-005**: En pruebas aisladas con rutas simuladas, el botón es visible en el 100 % de las rutas
  autorizadas y en el 0 % de las no autorizadas. La verificación integrada queda pendiente de CS-1.
- **SC-006**: En pruebas aisladas:
  - la conversación se conserva en el 100 % de los cambios de ruta simulados;
  - una pestaña nueva empieza vacía;
  - no hay escrituras en `localStorage`, `sessionStorage` ni en el servidor;
  - el historial se elimina ante una respuesta `401` simulada y tras una recarga completa.
- **SC-007**: El 100 % de los casos sin datos, ambiguos o con servicio caído muestran el mensaje del
  catálogo y ninguna cifra.
- **SC-008**: El Modelo 2 alcanza la *execution accuracy* mínima acordada (NFR-008) antes de
  habilitarse para usuarios.
- **SC-009**: La latencia p95 cumple NFR-001 en el entorno de prueba acordado.
- **SC-010**: Con la credencial del Executor, el 100 % de los intentos de escritura directa (sin
  pasar por el Validator) son rechazados por PostgreSQL.
- **SC-011**: Una revisión de una muestra de trazas confirma que no contienen filas de resultado,
  cifras, historial, tokens, secretos ni parámetros sensibles en claro. Las pruebas confirman que un
  rol sin permiso de auditoría no puede leerlas, que cada acceso queda registrado y que las trazas
  vencidas se eliminan.
- **SC-012**: Existe un informe comparativo entre XiYanSQL base y XiYanSQL + QLoRA, sobre el mismo
  conjunto de evaluación versionado, con *execution accuracy*, variación entre ejecuciones y las
  versiones registradas (NFR-006).
- **SC-013**: En una batería de preguntas cotidianas de usuarios no especialistas (tamaño: P-17), el
  porcentaje de respuestas sin términos contables sin explicar, evaluado con una rúbrica, alcanza
  el umbral acordado (P-11).
- **SC-014**: El 100 % de las pruebas de la Etapa 0 se ejecuta sin reutilizar `DATABASE_URL` ni
  `DATABASE_URL_READONLY` y sin conectarse a Neon de producción. Ante una configuración insegura o
  incompleta, las pruebas que requieren base de datos fallan sin conectarse.

---

## Componentes de implementación independientes

Cada componente es propio del módulo de IA. Puede especificarse en una spec derivada,
implementarse y probarse por separado, simulando sus vecinos con los contratos CT-A a CT-J.

| # | Componente | Contratos | Prueba independiente (Etapa 0) | Estado |
|---|-----------|-----------|--------------------------------|--------|
| C1 | Widget de chat y estado en memoria por pestaña | CT-A | Pruebas de componente aisladas con ruta, sesión y proxy simulados: visibilidad, apertura y cierre, continuidad, limpieza ante `401`. **Sin montaje** en pantallas existentes. | PROPUESTO |
| C2 | Proxy del ERP (route handler propio y servicio cliente) | CT-A, CT-B | Pruebas de ruta al estilo de `app/api/**/route.test.ts`: 400/401/403/429/503/504, con `sesionActual()` simulado | PROPUESTO |
| C3 | Revalidador de contexto e historial | CT-A, CT-B | Pruebas unitarias con contextos e historiales válidos, inválidos y manipulados | PROPUESTO |
| C4 | Servicio de IA y orquestador (FastAPI) | CT-B a CT-I | Pruebas con modelos simulados: cada `estado` y la secuencia del flujo | PROPUESTO |
| C5 | Modelo 1: intérprete y explicador | CT-C, CT-I | Conjunto etiquetado de intenciones y entidades; verificación de cifras; batería de lenguaje claro (SC-013) | PROPUESTO |
| C6 | Embeddings e índice RAG | CT-D | Recall@k sobre preguntas de referencia, definido sobre la interfaz del índice | PROPUESTO (almacén: P-8) |
| C7 | Modelo 2: XiYanSQL base como línea base → XiYanSQL + QLoRA como objetivo final (dataset, entrenamiento, evaluación comparativa y despliegue) | CT-E | *Execution accuracy* reproducible y comparativa base frente a QLoRA (NFR-006, NFR-008, SC-012) | Objetivo CONFIRMADO; implementación PROPUESTA; adaptador **no entrenado** |
| C8 | SQL Validator | CT-F | Batería de SQL permitido, prohibido y de evasión | PROPUESTO |
| C9 | SQL Executor de solo lectura | CT-G | En PostgreSQL desechable configurado explícitamente, fuera de la CI del ERP: escritura denegada por la credencial, tiempo límite, límite de filas y fallo seguro ante configuración insegura (NFR-011) | PROPUESTO |
| C10 | Motor financiero | CT-H | Pruebas unitarias con valores conocidos y casos de división por cero | PROPUESTO |
| C11 | Auditoría minimizada y protegida | CT-J | Toda petición genera un registro con `idTraza`, sin campos prohibidos, con parámetros protegidos, acceso restringido y retención (SC-011) | PROPUESTO |

Orden sugerido para la Etapa 0: (C1, C2, C3 con el servicio simulado) → (C8, C9, C10) → C6 → C7 →
C5 → C4 → C11. Ningún paso de la Etapa 0 depende de las dependencias externas.

---

## Dependencias externas bloqueantes

No se implementan dentro de esta integración: las resuelven sus responsables (P-20). **Mientras
DE-1, DE-2 y DE-3 no estén resueltas, el asistente no accede a datos contables reales.**

| ID | Dependencia externa | Responsable | Situación actual verificada | Por qué la necesitamos |
|----|---------------------|-------------|-----------------------------|------------------------|
| **DE-1** | Login que emita la cookie JWT `sesion` | Autenticación | `firmarSesion()` no se llama desde ningún archivo; el login guarda `auth-token = "dummy-token"` | Sin ella `sesionActual()` siempre devuelve `null` (FR-001, FR-013, FR-023) |
| **DE-2** | Autorización efectiva: rol o permiso "usar asistente" | Autenticación / roles | `Permission` y `RolePermission` existen pero no se usan; períodos con usuario `id = 3` fijo (spec `001`); libro mayor sin control de acceso (spec `013`, BR-9) | FR-001, FR-017, FR-023 |
| **DE-3** | Conexión PostgreSQL restringida de solo lectura para el SQL Executor y, si se decide, vistas dedicadas | Base de datos | **Antecedente informado por el equipo, no verificado en este ERP**: en el proyecto previo de XiYanSQL se configuró una conexión mediante la variable de entorno `DATABASE_URL_READONLY`, asociada al rol restringido `xiyansql_readonly`, y se usó en pruebas aisladas de validación y ejecución de SQL. No figura en los archivos versionados del ERP. **Pendiente de auditar (P-16)**: base y rama de Neon a las que apunta, privilegios efectivos, esquemas y objetos accesibles, permisos de ejecución de funciones, capacidad real de impedir escrituras y compatibilidad con el esquema actual del ERP y con la lista de objetos permitidos (P-14). `default_transaction_read_only` es una protección adicional, no una garantía suficiente. **No autorizada** para la Etapa 0 ni para producción hasta completar las verificaciones de seguridad. | FR-018, SEC-1, SEC-4 (P-14, P-16) |
| **DE-4** | Infraestructura del almacén vectorial | Base de datos / plataforma | No existe. pgvector requeriría una extensión en Neon; Milvus no tocaría la base del ERP. **No se proponen migraciones.** | FR-015 (P-8) |
| **DE-5** | Punto de montaje del widget en un layout compartido | Responsables de layouts / contabilidad | No autorizado (CS-1) | FR-001, FR-003 en integración (P-19) |
| **DE-6** | Criterio contable sobre asientos anulados | Equipo contable | Discrepancia entre las specs `013` y `007` | BR-9, SC-004 (P-4) |
| **DE-7** | Variables de entorno de despliegue (URL del servicio de IA, secreto interno) | Plataforma / despliegue | No existen | CT-B, SEC-3 |

## Cambios compartidos identificados *(NO AUTORIZADOS)*

| # | Cambio | Archivo | Por qué sería necesario | Estado |
|---|--------|---------|-------------------------|--------|
| **CS-1** | Montar el proveedor de estado y el widget | `app/layout.tsx` (modificar) **o** `app/accounting/layout.tsx` (crear) | Solo un layout común se mantiene durante la navegación del cliente. Eso permite conservar el historial en memoria y mostrar el botón sin editar cada pantalla. Insertarlo en cada página afectaría a más archivos ajenos y rompería la continuidad. | **No autorizado.** Ambas opciones afectan a módulos de otros integrantes (P-19). |
| CS-2 | Etiqueta Swagger propia | `app/api/openapi/swaggerConfig.ts` | Solo estética; el escaneo de `app/api/**/*.ts` ya es automático | No se solicita |
| CS-3 | Dependencias npm del ERP | `package.json` | Objetivo: ninguna. Si alguna fuera imprescindible, se pediría autorización. | No se solicita |
| CS-4 | CI para el servicio Python | `.github/workflows/ci.yml` | El workflow actual solo ejecuta Node | No se solicita. Alternativa: repositorio o pipeline aparte (P-13). |

## Control de cambios *(CONFIRMADO)*

Antes de modificar o crear cualquier archivo distinto de esta spec se presentará:

1. La SPEC aprobada que justifica el cambio.
2. La lista exacta de archivos nuevos y existentes afectados.
3. El propósito de cada modificación.
4. Las dependencias con otros módulos.
5. Las pruebas correspondientes.

Si una tarea requiere tocar archivos fuera del alcance autorizado, se detiene y se pide aprobación.
No se hacen commits, push, merges, migraciones ni cambios de rama sin autorización expresa.

---

## Assumptions

- El ERP es de una sola empresa: no existe un modelo de empresa o sucursal en
  `prisma/schema.prisma`.
- La moneda funcional es el sol peruano (`S/`), según el README (IGV 18 %, SUNAT).
- La sesión del usuario corresponde a la cookie JWT `sesion` (8 horas según `lib/auth/session.ts`)
  una vez resuelta DE-1.
- El único flujo de cierre de sesión existente hace una recarga completa
  (`window.location.href = "/login"`). Si se añadieran otros flujos de cierre, la eliminación del
  historial seguirá dependiendo de la recarga o del `401`.
- El servicio de IA se despliega aparte de la aplicación Next.js.
- Los usuarios formulan las preguntas en español.
- Esta spec no presupone modelos entrenados, desplegados ni evaluados.

## Decisiones pendientes *(NEEDS CLARIFICATION)*

| # | Decisión | Afecta |
|---|----------|--------|
| P-1 | Roles autorizados para usar el asistente | Permissions, FR-001, DE-2 |
| P-2 | Lista final de pantallas autorizadas | FR-001, C3, CS-1 |
| P-3 | Confirmar la propuesta inicial de historial en memoria de React por pestaña | FR-003, C1 |
| P-4 | Criterio contable sobre asientos anulados (coordinación con el equipo) | BR-9, SC-004, DE-6 |
| P-5 | Zona horaria para fechas relativas | BR-10 |
| P-6 | Catálogo de indicadores del MVP | FR-019, C10 |
| P-7 | Alojamiento de los modelos y de los embeddings | SEC-6, C5–C7 |
| P-8 | Almacén vectorial: pgvector o Milvus (sin migraciones por ahora) | FR-015, C6, DE-4 |
| P-9 | Autenticación de la API interna entre el ERP y el servicio de IA | SEC-3, FR-021 |
| P-10 | Almacén propio de auditoría, plazo de retención, técnica de protección de los parámetros (enmascaramiento irreversible o cifrado reversible con acceso restringido), roles de auditoría, texto de la pregunta e IP | FR-022, CT-J, SEC-8 |
| P-11 | Umbrales: latencia p95, *execution accuracy*, longitud de mensaje, turnos de historial, límite de uso | NFR-001, NFR-007, NFR-008, BR-11 |
| P-12 | SQL visible para administradores (etapa posterior) | SEC-7 |
| P-13 | Ubicación del código Python (carpeta del repositorio o repositorio aparte) | C4–C7, CS-4 |
| P-14 | Objetos permitidos: tablas existentes o vistas dedicadas (las vistas implican cambio en la base de datos) | BR-8, FR-017, DE-3 |
| P-15 | Si el MVP integrado exige ya el adaptador QLoRA o puede salir con XiYanSQL base + RAG (el objetivo final QLoRA ya está confirmado) | FR-016, C7 |
| P-16 | Auditar, junto con el responsable de la base de datos, el rol existente `xiyansql_readonly` (antecedente no verificado en este ERP). Se revisan: base y rama de Neon; privilegios efectivos; esquemas y objetos accesibles; permisos de ejecución de funciones; capacidad real de impedir escrituras (sin depender solo de `default_transaction_read_only`); y compatibilidad con el ERP. Después se decide de forma coordinada si se reutiliza, se ajusta o se crea un rol nuevo. **No se crea ningún rol antes de esa auditoría.** | FR-018, DE-3 |
| P-17 | Tamaño mínimo de las baterías adversariales, de evaluación y de lenguaje claro | SC-002, SC-013, NFR-008 |
| P-18 | Cómo construir y versionar la base ficticia desechable de la Etapa 0 (aplicar las migraciones a un PostgreSQL desechable requiere autorización; alternativa: fixtures mínimas) y dónde se ejecutan sus pruebas | SC-004, SC-014, C9, NFR-011 |
| P-19 | Punto de montaje del widget (CS-1) y responsable de coordinarlo; ninguna opción está autorizada | FR-001, FR-003, DE-5 |
| P-20 | Responsable y vía de coordinación de cada dependencia externa (DE-1 a DE-7) | Dependencias externas |

---

## Traceability Matrix

| Requirement | Scenario | Componente / Dependencia | Evidencia prevista |
|-------------|----------|--------------------------|--------------------|
| FR-001 | US1 escenarios 1-3 | C1, C2 · DE-1, DE-2, DE-5 | Aislada: visibilidad por ruta y permiso simulados (SC-005). Integrada: pendiente de CS-1. |
| FR-002 | US1 escenarios 4-5 | C1 · DE-5 | Aislada: ruta y estado sin cambios. Integrada: pendiente de CS-1. |
| FR-003 | US6 escenarios 1-6 | C1 · DE-5 | Aislada: continuidad, pestaña nueva, recarga, `401`, sin almacenamiento (SC-006). Integrada: pendiente de CS-1. |
| FR-004, FR-005 | US2 escenarios 1, 5 | C4, C5 | Respuestas en español con formato `S/` |
| FR-006 | US2 escenario 4 | C1 | El panel renderiza texto plano |
| FR-007 | US4 escenarios 1-4 | C1, C3, C4, C5 | Batería de seguimiento con resultados esperados |
| FR-008 | US5 escenarios 1-3 | C2, C3 | Contextos válidos, inválidos y manipulados |
| FR-009 | US3 escenario 3 | C5, C8, C9 | Batería de escritura e inyección (SC-002) |
| FR-010 | US2 escenarios 1-2 | C9, C10 · DE-6 | Comparación con las specs `013` y `007` (SC-004) |
| FR-011 | US2 escenario 3 | C9, C10, C11 | Reproducción exacta sobre fixtures y estado controlado; trazabilidad en producción (SC-001) |
| FR-012 | US3 escenarios 1-5; US6 escenario 6 | C1, C2, C4 | Prueba por cada mensaje del catálogo (SC-007) |
| FR-013 | US1 a US6 | C2 · DE-1 | El navegador solo llama al proxy; `401` sin sesión |
| FR-014 | US2, US3, US4 | C5 | Conjunto de intenciones etiquetado |
| FR-015 | US2 | C6 · DE-4 | Recall@k sobre la interfaz del índice |
| FR-016 | US2 | C7 | *Execution accuracy* reproducible (SC-008) y comparativa base frente a QLoRA (SC-012) |
| FR-017 | Edge case de evasión; US3 escenario 3 | C8 · DE-2 | Batería de SQL permitido, prohibido y de evasión (SC-003) |
| FR-018 | US3 escenario 3; edge cases | C9 · DE-3 | Escritura denegada por la credencial (SC-010) y auditoría del rol existente `xiyansql_readonly` (P-16) |
| FR-019 | US2 escenario 2; edge case de división por cero | C10 | Pruebas unitarias del motor |
| FR-020 | Edge case de cifra no respaldada | C4, C5 | Respuestas manipuladas que se descartan |
| FR-021 | US3 escenario 5 | C2, C4 · DE-7 | Servicio caído → `503` y ERP operativo |
| FR-022 | Todos | C11 | Trazas sin campos prohibidos, parámetros protegidos, acceso restringido y retención (SC-011, SEC-8) |
| FR-023 | US4 escenario 4; US5 escenarios 2-3 | C2, C3, C8 · DE-1, DE-2 | Historial y contexto manipulados sin ampliación de acceso |
| FR-024 | US2 escenario 6 | C5 | Batería de preguntas cotidianas evaluada con rúbrica (SC-013) |
| NFR-006 | US2 escenario 3 | C5, C7 | Informe de evaluación con fixtures versionadas, versiones registradas y variación entre ejecuciones (SC-012) |
| NFR-009 | — | ERP | `vitest run` y `npm run build` en verde |
| NFR-010 | — | C11 | SC-011 |
| NFR-011 | Todas las pruebas de la Etapa 0 | C1–C11 | Solo mocks o base desechable explícita; sin `DATABASE_URL` ni Neon; fallo seguro (SC-014) |
| NFR-012 | — | C1, C2 | `vitest run` y `npm run build` sin variables nuevas (pendiente de verificación) |

---

## Evidencia de verificación

### Estado actual del repositorio (verificado por lectura)

| Afirmación | Fuente |
|------------|--------|
| Sesión JWT HS256, cookie `sesion`, duración de 8 h | `lib/auth/session.ts` (línea 5) |
| `sesionActual()` verifica la cookie y que el usuario esté activo | `lib/auth/sesion-actual.ts` |
| El login guarda `auth-token = "dummy-token"` y no emite la cookie `sesion` | `app/api/auth/login/route.ts` (líneas 49-52) |
| `firmarSesion()` no se llama desde ningún archivo | Búsqueda en `app/`, `lib/` y `components/` |
| El cierre de sesión existente hace una recarga completa | `app/usuarios/page.tsx` (líneas 51-54) |
| Helpers de error `respuestaError` y `noAutorizado` | `lib/auth/respuestas.ts` |
| Contrato de error `{ error, errores? }` y cliente `getJson`/`postJson` | `lib/services/http.ts` |
| Swagger escanea `app/api/**/*.ts` automáticamente | `app/api/openapi/swaggerConfig.ts` (línea 81) |
| Vitest incluye `**/*.test.ts` | `vitest.config.mts` (línea 21) |
| La CI expone `DATABASE_URL` (secreto) en el entorno donde se ejecuta `npx vitest run` | `.github/workflows/ci.yml` |
| Antecedente: conexión `DATABASE_URL_READONLY` con el rol `xiyansql_readonly`, usada en pruebas aisladas del proyecto previo de XiYanSQL | Declaración del equipo (2026-10-12). Sin referencias en los archivos versionados del ERP. **No verificado** en este ERP (DE-3, P-16). |
| Rutas contables del sidebar | `components/personalized/Sidebar.tsx` (líneas 320-387) |
| El layout raíz monta `Sidebar`, `children` y `Toaster` (punto de montaje de CS-1) | `app/layout.tsx` (líneas 50-58) |
| `Role`, `Permission`, `RolePermission` | `prisma/schema.prisma` (líneas 91-120) |
| `AuditAction` y `AuditLog` sin acción de consulta | `prisma/schema.prisma` (líneas 68-78 y 753-773) |
| Sin modelo de empresa o sucursal; sin almacén vectorial | `prisma/schema.prisma`, `prisma/migrations/` |
| El balance filtra `status: true` | `app/api/balance-sheet/route.ts` (líneas 95 y 106) |
| El libro mayor incluye anulados y no tiene control de acceso | Spec `013` (BR-6, BR-9) |
| Usuario `id = 3` fijo; errores de autorización con `500` | Spec `001` (Permisos) |
| El estado de resultados es una página sin datos | `app/accounting/income-statement/page.tsx` (24 líneas) |
| Sin código de IA, LLM, embeddings ni Python | Búsqueda en todo el repositorio |

### Evidencias previstas (a producir con autorización)

| Evidencia | Componente |
|-----------|------------|
| Pruebas aisladas del widget: visibilidad, apertura y cierre, continuidad, `401`, sin almacenamiento | C1 |
| Pruebas de ruta del proxy (`*.test.ts`) con sesión simulada | C2, C3 |
| Batería de SQL permitido, prohibido y de evasión | C8 |
| Escritura denegada por la credencial de solo lectura en PostgreSQL desechable | C9 |
| Fallo seguro sin conexión ante una configuración de prueba insegura o incompleta | C9, NFR-011 |
| Informe de auditoría del rol `xiyansql_readonly` (privilegios efectivos, esquemas y objetos, funciones, impedimento real de escrituras), sin credenciales | C9, DE-3, P-16 |
| Pruebas unitarias del motor financiero | C10 |
| Comparación de cifras con las specs `007` y `013` sobre fixtures en estado controlado | C9, C10 |
| Informe reproducible de *execution accuracy* con versiones registradas | C7 |
| Informe comparativo XiYanSQL base frente a XiYanSQL + QLoRA | C7 |
| Informe de recall@k del índice RAG | C6 |
| Batería adversarial de escritura e inyección de instrucciones | C4, C5, C8 |
| Batería de lenguaje claro para usuarios no especialistas | C5 |
| Revisión de trazas minimizadas, enmascaramiento, acceso restringido y retención | C11 |
| `vitest run` y `npm run build` en verde sin variables nuevas | ERP (NFR-009, NFR-012) |

**Fuera de alcance**: registro y edición de asientos (specs `001`, `002`), mantenimiento del plan
contable (specs `003`, `004`), autenticación y autorización (DE-1, DE-2), layouts compartidos
(CS-1), estado de resultados y entrenamiento detallado del Modelo 2 (spec derivada de C7).

---

*Esta especificación define comportamiento **nuevo y no implementado**. Los elementos marcados
[PROPUESTO] o [NEEDS CLARIFICATION] requieren aprobación antes de pasar a `plan.md` y `tasks.md`.*

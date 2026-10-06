# 📄 Spec Kit – Manual Journal‑Entry (Asiento Manual)

**File:** [app/api/journal-entries/route.ts](file:///d:/backs/Polleria/app/api/journal-entries/route.ts)

---

### 1️⃣  Propósito
Permitir a los usuarios registrar **asientos contables manuales** (journal entries) mediante una petición **POST**. El endpoint valida la carga útil, determina el período contable correspondiente y persiste el asiento junto con sus líneas de detalle.

---

### 2️⃣  Funcionalidades expuestas
| Acción | HTTP | Ruta | Descripción |
|-------|------|------|-------------|
| **Listar** | `GET` | `/api/journal-entries` | Filtrado, paginación y ordenación de asientos (no parte del alcance de este spec). |
| **Crear (asiento manual)** | `POST` | `/api/journal-entries` | Validación exhaustiva y creación de un nuevo asiento. *(ver bloque **POST** líneas 222‑401)* |

---

### 3️⃣  Reglas de negocio
| Regla | Implementación | Comentario |
|------|----------------|------------|
| **Fecha contable obligatoria** | `DATE_REGEX` (línea 13) y validación en `dateStr` (línea 235‑237) | Debe coincidir `YYYY‑MM‑DD`. |
| **Concepto (glosa) obligatorio** | `description` (líneas 239‑242) | Máximo 200 caracteres. |
| **Diario** | `book` (líneas 243‑244) | Valor por defecto *“Operaciones varias”*; máximo 60 caracteres. |
| **Responsable** | `responsible` (líneas 246‑248) | Máximo 100 caracteres (opcional). |
| **Observación** | `observation` (líneas 251‑254) | Máximo 200 caracteres (opcional). |
| **Estado** | `status` (línea 256) | Boolean, `true` = Registrado, `false` = Anulado (por defecto Registrado). |
| **Número mínimo de líneas** | `rawLines.length < 2` (línea 259) | Al menos 2 líneas (debe y haber). |
| **Número máximo de líneas** | `rawLines.length > 100` (línea 261) | Límite de 100 líneas. |
| **Validación de cada línea** | Bloque **forEach** (líneas 266‑312) | • `idCuenta` debe ser entero positivo. <br>• `descripcion` ≤ 200 caracteres. <br>• `debe` / `haber` deben ser números válidos y ≥ 0. <br>• No se permiten simultáneamente valores positivos en ambos campos. <br>• Se requiere que *debe* o *haber* tenga valor > 0. |
| **Cuadre del asiento** | `Math.abs(totalDebit‑totalCredit) ≥ 0.005` (líneas 316‑320) | Si la diferencia supera 0.005, se rechaza. |
| **Cuentas existentes** | Consulta a `accountingAccount` (líneas 326‑336) y error si falta alguna (líneas 332‑336). |
| **Determinación del período contable** | Búsqueda con `accountingDate` (líneas 340‑345). |
| **Prohibición en períodos cerrados** | `period.status === "CLOSED"` (línea 350) → error 400. |
| **Generación de código de asiento** | `generateJournalEntryCode` (línea 359) – intento de regenerar hasta 3 veces (líneas 354‑380). |
| **Persistencia del asiento y sus líneas** | `prisma.journalEntry.create` (líneas 357‑376). |
| **Respuesta** | 201 con datos del asiento (líneas 389‑401) o 400/500 con mensaje de error. |

---

### 4️⃣  Creación mediante **mes / año**
*El cliente no envía explícitamente mes/año; envía `fecha` (YYYY‑MM‑DD).*  
El backend:
1. **Parsea** la cadena con `parseUtcDate` (línea 340).  
2. **Busca** el `accountingPeriod` cuyo rango (`startDate` ≤ fecha ≤ `endDate`) coincida (líneas 341‑345).  
3. **Rechaza** si no existe o está cerrado (líneas 347‑351).

> **Nota:** El periodo contable está definido en `app/api/accounting‑periods/route.ts` (POST) y contiene los atributos `status` (`OPEN` / `CLOSED`) y rango de fechas.

---

### 5️⃣  Estados del asiento
| Estado | Valor interno | Significado |
|--------|---------------|-------------|
| **Registrado** | `status: true` | Asiento activo y visible. |
| **Anulado** | `status: false` | Asiento marcado como anulado (no se permite crear en periodos cerrados). |

*El código de estado se devuelve como `"Registrado"` o `"Anulado"` en la respuesta (línea 397).*

---

### 6️⃣  Cierre de períodos
- **Cierre de período** → cambio de `status` a `"CLOSED"` en la tabla `accountingPeriod` (ver `app/api/accounting‑periods/route.ts` → PATCH).  
- **Restricción**: cualquier intento de crear un asiento (`POST /journal‑entries`) en un período cuyo `status` sea `"CLOSED"` devuelve error 400 (línea 350).

---

### 7️⃣  Relación con **asientos contables**
- Cada asiento (`JournalEntry`) tiene una **FK** `periodId` que referencia al `accountingPeriod` encontrado (línea 366).  
- Las líneas del asiento (`JournalEntryDetail`) referencian a `accountingAccount` mediante `accountId` (validado en líneas 326‑331).

---

### 8️⃣  Permisos
- **No hay control de rol explícito** en este endpoint (a diferencia del POST de `accounting‑periods` que usa `requireRole`).  
- En la práctica, la autorización se delega a la capa de middleware (no visible en el código).

---

### 9️⃣  Validaciones (resumen)
| Campo | Regla | Línea(s) |
|-------|-------|----------|
| `fecha` | Formato ISO `YYYY‑MM‑DD` | 235‑237 |
| `glosa` | No vacío, ≤ 200 car | 239‑242 |
| `diario` | ≤ 60 car, default | 243‑244 |
| `responsable` | ≤ 100 car | 246‑248 |
| `observacion` | ≤ 200 car | 251‑254 |
| `estado` | Boolean, default `true` | 256 |
| `lineas` | 2 – 100 elementos | 259‑263 |
| Cada línea – `idCuenta` | entero > 0 | 276‑279 |
| Cada línea – `descripcion` | ≤ 200 car | 282‑285 |
| Cada línea – `debe/haber` | número finito, ≥ 0, exclusividad, al menos uno > 0 | 287‑304 |
| Suma `debe` ≈ `suma` `haber` | diferencia ≤ 0.005 | 316‑320 |
| Cuentas existen | Consulta `accountingAccount` | 326‑336 |
| Periodo encontrado y abierto | Búsqueda por `fecha` + estado | 340‑351 |

---

### 🔚  Criterios de aceptación (para pruebas automatizadas)
1. **Petición válida** → 201 con cuerpo que incluye `id`, `numero`, `fecha`, `diario`, `concepto`, `responsable`, `estado`, `total` (líneas 389‑401).  
2. **Fecha fuera de cualquier período** → 400 con mensaje *“No accounting period found for the given date.”* (línea 348).  
3. **Periodo cerrado** → 400 con mensaje *“Cannot register entries in a closed accounting period.”* (línea 351).  
4. **Validaciones de la carga útil** → 400 con el mensaje correspondiente (líneas 235‑320, 326‑336).  
5. **Código de asiento duplicado** → reintento hasta 3 veces; si persiste, 500 con *“No se pudo asignar un número de asiento, intente nuevamente.”* (líneas 382‑386).  
6. **Líneas con cuentas inexistentes** → 400 con *“Una o más cuentas contables del asiento no existen en el plan contable.”* (líneas 332‑336).  
7. **Desbalance entre debe y haber** → 400 con *“El asiento no cuadra…*” (líneas 316‑320).  

---

### 📚 Referencias de código (para navegación rápida)
| Tema | Rango de líneas | Enlace |
|------|----------------|--------|
| Validación de cuerpo y campos básicos | 224‑259 | [route.ts#L224‑L259](file:///d:/backs/Polleria/app/api/journal-entries/route.ts#L224-L259) |
| Validación y normalización de líneas | 266‑312 | [route.ts#L266‑L312](file:///d:/backs/Polleria/app/api/journal-entries/route.ts#L266-L312) |
| Sumas y balance del asiento | 314‑321 | [route.ts#L314‑L321](file:///d:/backs/Polleria/app/api/journal-entries/route.ts#L314-L321) |
| Verificación de cuentas existentes | 326‑336 | [route.ts#L326‑L336](file:///d:/backs/Polleria/app/api/journal-entries/route.ts#L326-L336) |
| Búsqueda del período contable y control de cierre | 340‑351 | [route.ts#L340‑L351](file:///d:/backs/Polleria/app/api/journal-entries/route.ts#L340-L351) |
| Creación del asiento (incl. reintentos) | 354‑376 | [route.ts#L354‑L376](file:///d:/backs/Polleria/app/api/journal-entries/route.ts#L354-L376) |
| Respuesta exitosa | 389‑401 | [route.ts#L389‑L401](file:///d:/backs/Polleria/app/api/journal-entries/route.ts#L389-L401) |
| Manejo de errores inesperados | 402‑407 | [route.ts#L402‑L407](file:///d:/backs/Polleria/app/api/journal-entries/route.ts#L402-L407) |

---

**Fin de la especificación.**
Esta documentación refleja **exactamente** el comportamiento actual del código y sirve como base para pruebas, documentación de UI y futuros cambios.

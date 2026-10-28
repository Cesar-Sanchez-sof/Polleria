# Feature Specification: Datos del Restaurante y Yape Persistentes en PostgreSQL y S3

**Feature Branch**: `feature/datos-restaurante-yape-db`  
**Created**: 2026-10-27  
**Status**: Implemented & Approved  
**Spec Number**: 043  

---

## 1. Propósito y Resumen

Migrar de forma persistente y no destructiva los datos de la empresa (`RestaurantInfo`), incluyendo la información y el código QR de Yape, desde el archivo volátil `data/restaurant-config.json` hacia la base de datos PostgreSQL mediante Prisma (`RestaurantConfig`).

Adicionalmente, se elimina el almacenamiento de imágenes en formato Base64 directamente en base de datos; cualquier código QR de Yape subido es procesado mediante `s3-storage.service.ts` para almacenarse como un archivo optimizado en un bucket S3 (o fallback estructurado local en `/storage/comprobantes/restaurant/`), registrando en la base de datos únicamente la URL pública final.

Se garantiza la retrocompatibilidad completa de las interfaces síncronas y asíncronas de `restaurant-config.service.ts`, asegurando el funcionamiento sin rupturas en todos los módulos consumidores (`settings/restaurant`, `ple.service.ts`, `payments/mercadopago/yape` y la vista de cobros para mozos/caja).

---

## 2. Escenario y Criterios de Aceptación

### Historia de Usuario
> **Como administrador**, quiero que los datos del restaurante y el QR de Yape se guarden de forma persistente en la base de datos y S3, para que sigan disponibles tras nuevos despliegues en Vercel y cumplan con la auditoría del sistema.

### Criterios de Aceptación

1. **Criterio 1: Persistencia tras despliegues en Vercel**
   - Dado un administrador en `/settings/business`, cuando guarda los datos en el entorno desplegado (Vercel), entonces se guardan sin error en PostgreSQL y siguen ahí tras un nuevo despliegue.
2. **Criterio 2: Sincronización con Libros Electrónicos PLE**
   - Dado que cambia el RUC del restaurante en la configuración, cuando se genera un archivo PLE de SUNAT (ej. Registro de Ventas 14.1 o Compras 8.1), entonces el nombre oficial del archivo SUNAT generado (`LE{RUC}{YYYY}{MM}...`) utiliza el nuevo RUC.
3. **Criterio 3: Almacenamiento del QR de Yape en S3 y visualización por el mozo**
   - Dado que se sube una imagen de código QR de Yape (en base64 o archivo), se guarda como archivo en S3 reutilizando `s3-storage.service.ts` y no como base64 en la base de datos.
   - Cuando un mozo o cajero abre el modal de cobro con Yape (`waiterPaymentOrder` o `counterPayment`), visualiza dicho código QR persistido.
4. **Criterio 4: Migración de datos idempotente**
   - Existe una migración de datos idempotente desde el JSON actual (`data/restaurant-config.json`) hacia la tabla `restaurant_config` de PostgreSQL.
   - Si la tabla ya contiene datos, la migración respeta los datos existentes sin duplicar ni provocar pérdida de información.
5. **Criterio 5: Auditoría de cambios**
   - Cada cambio de configuración del restaurante genera un registro de auditoría en la tabla `auditLog` con acción `UPDATE`, módulo `Configuracion` y entidad `RestaurantConfig`, registrando los campos modificados, el usuario y la IP.
6. **Criterio 6: Cobertura de pruebas**
   - Existen pruebas unitarias y de integración del servicio con simulación de Prisma, cubriendo cada uno de los criterios anteriores.

---

## 3. Diseño Técnico y Arquitectura

### 3.1. Modelo Prisma (`prisma/schema.prisma`)
Se incorpora el modelo `RestaurantConfig` mapeado a la tabla `restaurant_config`:

```prisma
model RestaurantConfig {
  id              String   @id @default("default") @db.VarChar(50)
  name            String   @db.VarChar(200)
  commercialName  String?  @map("commercial_name") @db.VarChar(200)
  ruc             String   @db.VarChar(11)
  address         String   @db.VarChar(255)
  phone           String   @db.VarChar(50)
  email           String   @db.VarChar(150)
  city            String   @default("Lima") @db.VarChar(100)
  ticketFooter    String   @map("ticket_footer") @db.VarChar(255)
  invoiceFooter   String   @map("invoice_footer") @db.VarChar(255)
  yapePhone       String?  @map("yape_phone") @db.VarChar(50)
  yapeName        String?  @map("yape_name") @db.VarChar(150)
  yapeQrImageUrl  String?  @map("yape_qr_image_url") @db.VarChar(500)
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@map("restaurant_config")
}
```

### 3.2. Subida de QR a S3 (`lib/services/s3-storage.service.ts`)
- Se implementó la función `uploadYapeQrToS3({ imageBase64, mimeType, filename })`:
  - Detecta si la imagen provista es un payload Base64 (ej. `data:image/png;base64,...`).
  - Convierte el contenido a `Buffer`.
  - Lo almacena en el bucket S3 (o fallback local `/storage/comprobantes/restaurant/...`).
  - Retorna `{ s3Key, publicUrl }`, asegurando que en PostgreSQL sólo se almacene la URL pública (ej. `https://s3.neon.tech/comprobantes/restaurant/...`).

### 3.3. Servicio de Configuración (`lib/services/restaurant-config.service.ts`)
- **Compatibilidad Híbrida Sync/Async**: Emplea `makeThenable(targetObject, promise)` de modo que `getRestaurantInfo()` y `updateRestaurantInfo()` puedan consumirse tanto con `await` como síncronamente sin romper código legado existente.
- **Persistencia en Prisma**:
  - `getRestaurantInfo()`: Lee `prisma.restaurantConfig.findUnique({ where: { id: "default" } })`. Si no existe, inicializa automáticamente los valores desde el JSON y los inserta en la base de datos de manera segura.
  - `updateRestaurantInfo(partialInfo, meta)`: Si se recibe un nuevo QR en base64, lo sube a S3, ejecuta `prisma.restaurantConfig.upsert`, actualiza la caché en memoria y genera un registro en `auditLog`.
- **Migración Idempotente**:
  - `migrateRestaurantConfigFromJson()`: Verifica si ya existe configuración en la base de datos; si no existe, la migra desde el archivo local sin sobrescribir información preexistente.

### 3.4. Script de Migración Independiente (`scripts/migrate-restaurant-config.ts`)
- Script ejecutable mediante `npx tsx scripts/migrate-restaurant-config.ts`.
- Aplica la migración sin tocar ninguna otra tabla ni alterar datos existentes.

---

## 4. Verificación y Resultados de Pruebas

- **Pruebas de la Historia**: `test/restaurant-config-persistence.test.ts` (6 tests pasados).
- **Pruebas de Configuración de Módulos**: `test/module-settings.test.ts` (12 tests pasados).
- **Pruebas de PLE SUNAT**: `lib/ple/ple.test.ts` (28 tests pasados).
- **Suite Completa de Pruebas**: 50 suites de prueba pasadas, 721 tests exitosos.
- **Chequeo de Tipos**: `npx tsc --noEmit` completado con 0 errores.

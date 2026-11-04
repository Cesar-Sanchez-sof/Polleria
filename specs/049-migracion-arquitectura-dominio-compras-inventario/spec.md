# Feature Specification: Migrar a Arquitectura por Dominio (4/6) - Compras e Inventario

**Feature Branch**: `refactor/arquitectura-dominio-compras-inventario`  
**Created**: 2026-11-04  
**Status**: Implemented  
**Spec Number**: 049  

---

## 1. Propósito y Resumen

Consolidar la cuarta etapa de la migración hacia una **Arquitectura por Dominio** en el ERP Pollería, enfocada en el dominio de **Compras e Inventario**:
1. **Catálogo de Productos y Recetas (`products`, `products/[id]`)**: Gestión unificada de platos para la carta y materias primas, cálculo de stock disponible, precios de venta, costos y formulación de recetas asociadas a insumos.
2. **Consulta de Identidad (`document-lookup`)**: Estandarización del servicio de consulta de DNI y RUC contra la API de `json.pe` con fallback seguro, eliminando la duplicación existente en `lib/services/purchases/document-lookup.ts`.
3. **Inventario, Stock y Transformaciones (`inventory.service.ts`)**: Consolidación de movimientos de almacén (Kardex), registro de mermas, ajustes manuales y transformación de materias primas (ej. pollo entero a piezas marinadas) con transacciones atómicas de Prisma.
4. **Compras y Proveedores (`purchases.service.ts`)**: Integración limpia de órdenes de compra, compras con comprobante (Factura/Boleta) y compras menores sin comprobante, delegando el impacto de stock directamente a la capa de inventario.

### Principio Fundamental
Aplicar de forma estricta la convención unidireccional de capas:
$$\text{Route Handler / Server Action (HTTP)} \longrightarrow \text{Domain Service (Reglas de Negocio)} \longrightarrow \text{Prisma ORM (Persistencia)}$$

---

## 2. Escenario y Criterios de Aceptación

### Historia de Usuario
> **Como encargado de compras**, quiero que proveedores, compras, stock y transformaciones tengan una sola capa de lógica, para evitar duplicar reglas de inventario.

### Criterios de Aceptación

1. **Criterio 1: Consolidación de Handlers HTTP a `createApiHandler`**
   - Los route handlers en:
     - `app/api/products/route.ts` (GET, POST)
     - `app/api/products/[id]/route.ts` (GET, PUT, PATCH, DELETE)
     - `app/api/document-lookup/route.ts` (GET, POST)
     quedan desacoplados de Prisma mediante el helper común `createApiHandler` de `@/lib/http/route-handler`.

2. **Criterio 2: Servicio Unificado de Productos (`lib/services/products.service.ts`)**
   - Expone métodos para:
     - `listProducts(filter)`: Búsqueda por texto, categoría, estado (`active`), vendible (`sellable`) y carga opcional de recetas.
     - `getProductById(id)`: Obtención de producto con detalle de receta e insumos.
     - `createProduct(data)`: Validación de reglas (precio obligatorio si es vendible, nombre único, unidad de medida).
     - `updateProduct(id, data)`: Edición de campos generales y recetas.
     - `setProductActive(id, active)`: Activación o pausa en carta.
     - `deleteProduct(id)`: Baja lógica sin pérdida de integridad referencial.

3. **Criterio 3: Servicio Unificado de Documentos (`lib/services/document-lookup.service.ts`)**
   - Eliminar duplicación entre `document-lookup.service.ts` y `purchases/document-lookup.ts`.
   - Soporte para validación previa de formato peruano (DNI de 8 dígitos, RUC de 11 dígitos con dígitos iniciales 10, 15, 17, 20).
   - Manejo de timeout y modo fallback resiliente.

4. **Criterio 4: Servicio de Inventario y Movimientos (`lib/services/inventory.service.ts`)**
   - Manejo centralizado de transacciones atómicas:
     - `recordMovement(tx, movementData)`: Registro en `InventoryMovement` y actualización de `currentStock`.
     - `executeTransformation(data)`: Descuento del insumo origen y aumento de los productos destino en una única transacción `$transaction`.
     - `adjustStock(productId, newStock, reason)`: Ajuste auditado de stock.

5. **Criterio 5: Verificación Automatizada y Regresión Cero**
   - Pruebas unitarias completas en el directorio `test/` (`test/services/products.service.test.ts`, `test/services/inventory.service.test.ts`, `test/api/products-handlers.test.ts`, `test/api/document-lookup-handler.test.ts`).
   - El 100% de la suite de pruebas del proyecto pasa en verde.
   - ESLint con 0 errores y 0 warnings (regla `no-restricted-imports` sobre `@/lib/prisma` en `app/`).
   - Compilación en producción `npm run build` con código de salida 0.

---

## 3. Diagrama de Arquitectura

```mermaid
flowchart TD
    subgraph Clients ["Clientes y UI"]
        UI_Products["Gestión de Carta / Productos"]
        UI_Purchases["Compras y Proveedores"]
        UI_Transform["Transformación de Insumos"]
        UI_DocSearch["Buscador DNI / RUC"]
    end

    subgraph Presentation ["Capa de Rutas HTTP (app/api)"]
        H_Products["app/api/products (route.ts & [id]/route.ts)"]
        H_DocLookup["app/api/document-lookup/route.ts"]
        Actions_Purchases["Server Actions (lib/services/purchases/*)"]
    end

    subgraph DomainServices ["Capa de Servicios de Dominio (lib/services)"]
        S_Products["products.service.ts"]
        S_Inventory["inventory.service.ts"]
        S_DocLookup["document-lookup.service.ts"]
        S_Purchases["purchases/ (supplier, purchase-order, invoices)"]
    end

    subgraph DataAccess ["Capa de Persistencia (lib/prisma)"]
        P_Prisma["PrismaClient (PostgreSQL)"]
    end

    UI_Products --> H_Products
    UI_DocSearch --> H_DocLookup
    UI_Purchases --> Actions_Purchases
    UI_Transform --> Actions_Purchases

    H_Products --> S_Products
    H_DocLookup --> S_DocLookup
    Actions_Purchases --> S_Products
    Actions_Purchases --> S_Inventory
    Actions_Purchases --> S_Purchases

    S_Products --> P_Prisma
    S_Inventory --> P_Prisma
    S_DocLookup --> P_Prisma
    S_Purchases --> P_Prisma
```

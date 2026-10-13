# Feature Specification: Despacho de Bebidas por Mozo y Exclusión de Cocina (KDS)

**Feature Branch**: `feature/config-mesas-cobro-mozo-e2e`  
**Created**: 2026-10-13  
**Status**: Approved  
**Spec Number**: 032  

---

## 1. Purpose & Overview

Optimizar el flujo de trabajo entre la cocina y el equipo de mozos/atención:
1. **Exclusión de Bebidas en Cocina (KDS)**: Las bebidas (gaseosas, aguas, chichas, cervezas, etc.) no deben saturar la pantalla ni interrumpir la labor del personal de cocina, ya que no requieren preparación culinaria en la línea de fuego.
2. **Apartado de Despacho de Bebidas en Ventas**: Nuevo panel exclusivo para mozos donde se listan las bebidas solicitadas por mesa o para llevar, con control visual de estado (*Pendiente de Entrega* vs *Entregado*) y acción directa para que el mozo marque la entrega en un clic.

---

## 2. User Scenarios & Requirements

### User Story 1 - Separación Operativa Cocina vs Barra/Mozo (Priority: P1)
Como cocinero en la pantalla KDS:
- Solo debo visualizar los platos de cocina (pollo a la brasa, papas fritas, mostritos, tequeños, etc.).
- Las bebidas son filtradas automáticamente de las comandas de cocina para evitar confusiones y pedidos fantasmas en la barra.
- Si una orden solo contiene bebidas, no satura la cola de cocineros.

### User Story 2 - Monitoreo de Bebidas por Mesa para el Mozo (Priority: P1)
Como mozo o personal de salón:
- Accedo al apartado **"Despacho de Bebidas"** en el módulo de Ventas (`/sales?tab=drinks`).
- Visualizo qué bebida corresponde a qué mesa (ej. *2x Inca Kola 1.5L - Mesa 3* o *1x Jarra de Chicha - Mesa 1*).
- Veo las observaciones específicas (ej. *"bien helada"*, *"sin hielo"*, *"con 4 vasos"*).

### User Story 3 - Cambio de Estado a "Entregado" (Priority: P1)
Como mozo:
- Al servir la bebida al cliente en su mesa, marco el botón **"Entregado"**.
- El estado del ítem cambia inmediatamente a `Delivered` / `Entregado`.
- Se permite entrega individual por ítem o masiva por mesa/comanda (*"Entregar todas las bebidas"*).
- En caso de error accidental, el mozo puede revertir el estado a *Pendiente*.

### User Story 4 - Métricas de Servicio en Tiempo Real (Priority: P2)
Como supervisor o mozo:
- Veo contadores rápidos de:
  - Bebidas pendientes por servir.
  - Mesas esperando bebidas.
  - Bebidas entregadas en el turno actual.

---

## 3. Technical Design

### A. Clasificación de Ítems (`lib/utils/dish-category.ts`)
- Función utilitaria `isBeverage(name: string, description?: string | null): boolean` con coincidencia de bebidas (gaseosas, aguas minerales, chicha, maracuyá, cervezas, infusiones, etc.).

### B. Cocina KDS (`components/restaurant/KitchenBoard.tsx`)
- Filtra ítems de comanda aplicando `!isBeverage(item.name)` en la vista de preparación de cocina.
- Muestra badge discreto informativo si la orden cuenta con bebidas a cargo de mozo.

### C. Backend API (`app/api/orders/drinks/route.ts`)
- `GET /api/orders/drinks`: Retorna todas las bebidas de pedidos activos con detalle de mesa, código, orden, cantidad y estado de entrega.
- `PATCH /api/orders/drinks`: Actualiza `dishStatus` en `OrderItem` (`Pending` / `Delivered`) individual o grupalmente.

### D. Frontend UX/UI (`app/sales/page.tsx` & `components/personalized/Sidebar.tsx`)
- Pestaña `drinks` en `/sales?tab=drinks` con filtros (*Por Entregar*, *Entregadas*, *Todas*), búsqueda por mesa y tarjetas interactivas de despacho.
- Acceso directo en el menú lateral bajo **VENTAS**.

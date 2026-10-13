# Feature Specification: Selección Automática de Temperatura de Bebidas (Helada / Sin Helar)

**Feature Branch**: `feature/config-mesas-cobro-mozo-e2e`  
**Created**: 2026-10-13  
**Status**: Approved  
**Spec Number**: 033  

---

## 1. Purpose & Overview

Garantizar que al anexar cualquier bebida a una comanda en el salón o mostrador, el sistema solicite automáticamente al mozo la preferencia de temperatura del cliente (**"Helada"** o **"Sin Helar"** / al tiempo), previniendo errores de servicio, devoluciones de botellas o retrasos en la atención.

---

## 2. User Scenarios & Requirements

### User Story 1 - Pregunta Automática al Anexar Bebida (Priority: P1)
Como mozo, cuando estoy tomando un pedido y selecciono una bebida de la carta (ej. *Inca Kola*, *Coca Cola*, *Agua*, *Cerveza*, *Chicha*, etc.):
- El sistema detecta en automático que el producto es una bebida mediante `isBeverage()`.
- Se abre de inmediato un diálogo modal centrado y de alta agilidad:
  - Pregunta: *"¿Cómo desea la bebida?"*
  - Opción A: ❄️ **Helada** (Bien fría / Refrigerada).
  - Opción B: 🥤 **Sin Helar** (Al tiempo / Sin refrigerar).
- Con un solo clic en la opción deseada, la bebida se añade a la comanda con su nota correspondiente (`"Helada"` o `"Sin helar"`).

### User Story 2 - Soporte para Temperaturas Mixtas en la Misma Mesa (Priority: P1)
Como mozo, si en la misma comanda el cliente pide dos botellas de la misma bebida pero con diferente temperatura (ej. *1 Inca Kola helada* y *1 Inca Kola al tiempo*):
- El sistema agrupa los ítems considerando la combinación de plato + temperatura.
- Permite registrar ambas preferencias claramente en la comanda.

### User Story 3 - Visualización y Edición en Comanda y Despacho (Priority: P1)
Como mozo y personal de barra:
- En la comanda del pedido se visualiza el distintivo de temperatura (`❄️ Helada` o `🥤 Sin helar`).
- El mozo puede alternar la temperatura en la comanda con un solo clic si el cliente cambia de opinión.
- En el panel de **Despacho de Bebidas** (`/sales?tab=drinks`), el mozo que va al refrigerador ve claramente la indicación para no equivocarse de botella.

---

## 3. Technical Design

### A. Detección y Diálogo de Temperatura
- En [`app/sales/page.tsx`](file:///d:/Cesar%20Sanchez/Documents/GitHub/Polleria/Polleria/app/sales/page.tsx):
  - Estado `drinkTempModalOpen: boolean`.
  - Estado `pendingDrinkDish: MenuDish | null`.
  - Al invocar `addOrderItem(plato)`: si `isBeverage(plato.name, plato.description)` es verdadero, se activa `pendingDrinkDish` y se abre el modal de temperatura.
  - El mozo pulsa "Helada" o "Sin Helar" y se añade el ítem con `notes: "Helada"` o `notes: "Sin helar"`.

### B. Visualización en Despacho de Bebidas
- En [`components/restaurant/DrinksDispatchBoard.tsx`](file:///d:/Cesar%20Sanchez/Documents/GitHub/Polleria/Polleria/components/restaurant/DrinksDispatchBoard.tsx):
  - Badge temático resaltado para `❄️ Helada` (azul) y `🥤 Sin helar` (ámbar).

# Feature Specification: Pruebas End-to-End (E2E) del Flujo de Ventas, Mesas y Asientos Contables

**Feature Branch**: `feature/config-mesas-cobro-mozo-e2e`  
**Created**: 2026-10-13  
**Status**: Approved  
**Spec Number**: 028  

---

## 1. Purpose & Overview

Definir la arquitectura, alcance y ejecución de las **Pruebas End-to-End (E2E)** para validar integralmente el flujo de vida del negocio:
1. Configuración y disponibilidad de mesas en salón.
2. Toma de pedido con unión / anexión de mesas (Mesa 2 + Mesa 3).
3. Verificación de 0 disponibilidad para mesas en uso.
4. Cobro mozo emitiendo Boleta (pago con Yape) y Factura (pago con Tarjeta).
5. Verificación de los asientos contables generados en el Libro Diario (cuentas 101, 102, 104, 121, 401, 701, 691, 201).
6. Liberación total y restauración de la disponibilidad en el salón.

---

## 2. Concepto: ¿Qué es una Prueba End-to-End (E2E)?

Una prueba **End-to-End (E2E)** (de extremo a extremo) es una prueba automatizada que simula el recorrido completo que realiza un usuario en el sistema, desde el punto de partida hasta el resultado final esperado.

A diferencia de las pruebas unitarias (que verifican funciones aisladas en memoria con mocks), una prueba E2E:
- Prueba la interacción coordinada entre la interfaz de usuario, las APIs REST, las transacciones ACID de base de datos y la generación de comprobantes y asientos contables.
- Garantiza que ninguna regla de negocio se rompa cuando los módulos interactúan entre sí.

---

## 3. Escenarios del Test Suite E2E

### Escenario 1 - Apertura y Disponibilidad Inicial de Mesas
Verifica que las mesas registradas se carguen con sus capacidades y estados correctos.

### Escenario 2 - Unión de Mesas (Mesa 2 + Mesa 3)
Crea una comanda anexando la Mesa 3 a la Mesa 2. Comprueba que ambas mesas pasen a `occupied: true` y que `available` decremente en 2 (0 disponibilidad en ambas).

### Escenario 3 - Emisión de Boleta con Yape (Cobro Mozo)
Procesa el cobro por el mozo seleccionando Boleta y método Yape. Comprueba:
- Origen del comprobante reflejado con una sola mesa (`Mesa 2`).
- Asiento de cobro cargado a la **Cuenta 102 (Billeteras Digitales)**.
- Pedido cerrado y mesas liberadas (disponibilidad restaurada).

### Escenario 4 - Emisión de Factura con Tarjeta (Cobro Mozo)
Procesa un cobro con Factura electrónica y método Tarjeta POS. Comprueba:
- Validación de RUC y Razón Social.
- Asiento de cobro cargado a la **Cuenta 104 (Bancos / POS)**.
- Asiento de provisión con referencia a la Factura F001.

---

## 4. Comandos de Ejecución

Para ejecutar las pruebas E2E en la terminal del desarrollador:
```bash
npm test -- test/e2e-flujo-completo.test.ts
```

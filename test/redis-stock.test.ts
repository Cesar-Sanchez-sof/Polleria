import { describe, it, expect, beforeEach } from "vitest";
import {
  setDishStock,
  getDishStock,
  reserveDishStock,
  releaseDishStock,
  reserveOrderStock,
  resetStockFallback
} from "@/lib/services/redis-stock.service";

describe("Servicio de Control Atómico de Stock y Caché (Redis Cloud)", () => {
  beforeEach(() => {
    // Reiniciar memoria para cada prueba
    resetStockFallback();
  });

  it("permite fijar y consultar el stock inicial de un plato", async () => {
    const dishId = 101;
    await setDishStock(dishId, 15);

    const stock = await getDishStock(dishId);
    expect(stock).toBe(15);
  });

  it("descuenta atómicamente el stock al solicitar una reserva válida", async () => {
    const dishId = 102;
    await setDishStock(dishId, 10);

    const result = await reserveDishStock(dishId, 3);
    expect(result.success).toBe(true);
    expect(result.remainingStock).toBe(7);

    const remaining = await getDishStock(dishId);
    expect(remaining).toBe(7);
  });

  it("rechaza la reserva si el mozo pide más unidades de las disponibles", async () => {
    const dishId = 103;
    await setDishStock(dishId, 2);

    const result = await reserveDishStock(dishId, 5);
    expect(result.success).toBe(false);
    expect(result.remainingStock).toBe(2);
    expect(result.message).toContain("Stock insuficiente");

    // El stock original debe permanecer intacto
    const stockActual = await getDishStock(dishId);
    expect(stockActual).toBe(2);
  });

  it("evita la sobreventa cuando solo queda 1 plato y dos mozos intentan reservarlo (condición de carrera)", async () => {
    const dishId = 104; // "1/4 Pollo a la Brasa"
    await setDishStock(dishId, 1); // Solo queda 1 unidad en cocina

    // Dos mozos presionan 'Confirmar Pedido' al mismo instante
    const [orderWaiter1, orderWaiter2] = await Promise.all([
      reserveDishStock(dishId, 1),
      reserveDishStock(dishId, 1)
    ]);

    // Exactamente uno de los dos debe ganar la porción
    const successes = [orderWaiter1.success, orderWaiter2.success].filter(Boolean);
    const failures = [orderWaiter1.success, orderWaiter2.success].filter((e) => !e);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);

    // El stock final no puede ser menor a 0 (cero inventario descuadrado)
    const stockFinal = await getDishStock(dishId);
    expect(stockFinal).toBe(0);
  });

  it("libera y devuelve el stock al cancelar un plato o pedido", async () => {
    const dishId = 105;
    await setDishStock(dishId, 5);

    // Reservar 2
    await reserveDishStock(dishId, 2);
    expect(await getDishStock(dishId)).toBe(3);

    // Cliente cancela el pedido: se devuelven las 2 unidades
    const newStock = await releaseDishStock(dishId, 2);
    expect(newStock).toBe(5);
    expect(await getDishStock(dishId)).toBe(5);
  });

  it("realiza rollback automático en una comanda si un plato del pedido no tiene stock", async () => {
    const chickenId = 201;
    const friesId = 202;
    const chichaId = 203;

    await setDishStock(chickenId, 5); // 5 pollos
    await setDishStock(friesId, 0); // 0 papas (agotado)
    await setDishStock(chichaId, 10); // 10 jarras de chicha

    // El mozo envía un pedido de 2 pollos y 1 papas
    const resultKitchenOrder = await reserveOrderStock([
      { dishId: chickenId, quantity: 2, name: "1/4 Pollo" },
      { dishId: friesId, quantity: 1, name: "Porción de Papas" }
    ]);

    // Debe fallar porque papas está agotado
    expect(resultKitchenOrder.success).toBe(false);
    expect(resultKitchenOrder.soldOutDish).toContain("Porción de Papas");

    // ROLLBACK: El stock de pollos NO debe haberse descontado, debe seguir en 5
    const stockChicken = await getDishStock(chickenId);
    expect(stockChicken).toBe(5);
  });

  it("confirma exitosamente toda la comanda cuando todos los ítems tienen stock disponible", async () => {
    const chickenId = 301;
    const chichaId = 302;

    await setDishStock(chickenId, 10);
    await setDishStock(chichaId, 8);

    const result = await reserveOrderStock([
      { dishId: chickenId, quantity: 2, name: "Mostrito Brasa" },
      { dishId: chichaId, quantity: 1, name: "Jarra de Chicha" }
    ]);

    expect(result.success).toBe(true);
    expect(await getDishStock(chickenId)).toBe(8);
    expect(await getDishStock(chichaId)).toBe(7);
  });
});

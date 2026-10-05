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
    const platoId = 101;
    await setDishStock(platoId, 15);

    const stock = await getDishStock(platoId);
    expect(stock).toBe(15);
  });

  it("descuenta atómicamente el stock al solicitar una reserva válida", async () => {
    const platoId = 102;
    await setDishStock(platoId, 10);

    const resultado = await reserveDishStock(platoId, 3);
    expect(resultado.success).toBe(true);
    expect(resultado.remainingStock).toBe(7);

    const remaining = await getDishStock(platoId);
    expect(remaining).toBe(7);
  });

  it("rechaza la reserva si el mozo pide más unidades de las disponibles", async () => {
    const platoId = 103;
    await setDishStock(platoId, 2);

    const resultado = await reserveDishStock(platoId, 5);
    expect(resultado.success).toBe(false);
    expect(resultado.remainingStock).toBe(2);
    expect(resultado.message).toContain("Stock insuficiente");

    // El stock original debe permanecer intacto
    const stockActual = await getDishStock(platoId);
    expect(stockActual).toBe(2);
  });

  it("evita la sobreventa cuando solo queda 1 plato y dos mozos intentan reservarlo (condición de carrera)", async () => {
    const platoId = 104; // "1/4 Pollo a la Brasa"
    await setDishStock(platoId, 1); // Solo queda 1 unidad en cocina

    // Dos mozos presionan 'Confirmar Pedido' al mismo instante
    const [pedidoMozo1, pedidoMozo2] = await Promise.all([
      reserveDishStock(platoId, 1),
      reserveDishStock(platoId, 1)
    ]);

    // Exactamente uno de los dos debe ganar la porción
    const exitos = [pedidoMozo1.success, pedidoMozo2.success].filter(Boolean);
    const fallos = [pedidoMozo1.success, pedidoMozo2.success].filter((e) => !e);

    expect(exitos.length).toBe(1);
    expect(fallos.length).toBe(1);

    // El stock final no puede ser menor a 0 (cero inventario descuadrado)
    const stockFinal = await getDishStock(platoId);
    expect(stockFinal).toBe(0);
  });

  it("libera y devuelve el stock al cancelar un plato o pedido", async () => {
    const platoId = 105;
    await setDishStock(platoId, 5);

    // Reservar 2
    await reserveDishStock(platoId, 2);
    expect(await getDishStock(platoId)).toBe(3);

    // Cliente cancela el pedido: se devuelven las 2 unidades
    const nuevoStock = await releaseDishStock(platoId, 2);
    expect(nuevoStock).toBe(5);
    expect(await getDishStock(platoId)).toBe(5);
  });

  it("realiza rollback automático en una comanda si un plato del pedido no tiene stock", async () => {
    const polloId = 201;
    const papasId = 202;
    const chichaId = 203;

    await setDishStock(polloId, 5); // 5 pollos
    await setDishStock(papasId, 0); // 0 papas (agotado)
    await setDishStock(chichaId, 10); // 10 jarras de chicha

    // El mozo envía un pedido de 2 pollos y 1 papas
    const resultadoComanda = await reserveOrderStock([
      { idPlato: polloId, cantidad: 2, nombre: "1/4 Pollo" },
      { idPlato: papasId, cantidad: 1, nombre: "Porción de Papas" }
    ]);

    // Debe fallar porque papas está agotado
    expect(resultadoComanda.success).toBe(false);
    expect(resultadoComanda.soldOutDish).toContain("Porción de Papas");

    // ROLLBACK: El stock de pollos NO debe haberse descontado, debe seguir en 5
    const stockPollo = await getDishStock(polloId);
    expect(stockPollo).toBe(5);
  });

  it("confirma exitosamente toda la comanda cuando todos los ítems tienen stock disponible", async () => {
    const polloId = 301;
    const chichaId = 302;

    await setDishStock(polloId, 10);
    await setDishStock(chichaId, 8);

    const resultado = await reserveOrderStock([
      { idPlato: polloId, cantidad: 2, nombre: "Mostrito Brasa" },
      { idPlato: chichaId, cantidad: 1, nombre: "Jarra de Chicha" }
    ]);

    expect(resultado.success).toBe(true);
    expect(await getDishStock(polloId)).toBe(8);
    expect(await getDishStock(chichaId)).toBe(7);
  });
});

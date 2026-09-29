import { describe, it, expect, beforeEach } from "vitest";
import {
  fijarStockPlato,
  consultarStockPlato,
  reservarStockPlato,
  liberarStockPlato,
  reservarStockComanda,
  reiniciarStockFallback
} from "@/lib/services/redis-stock.service";

describe("Servicio de Control Atómico de Stock y Caché (Redis Cloud)", () => {
  beforeEach(() => {
    // Reiniciar memoria para cada prueba
    reiniciarStockFallback();
  });

  it("permite fijar y consultar el stock inicial de un plato", async () => {
    const platoId = 101;
    await fijarStockPlato(platoId, 15);

    const stock = await consultarStockPlato(platoId);
    expect(stock).toBe(15);
  });

  it("descuenta atómicamente el stock al solicitar una reserva válida", async () => {
    const platoId = 102;
    await fijarStockPlato(platoId, 10);

    const resultado = await reservarStockPlato(platoId, 3);
    expect(resultado.exito).toBe(true);
    expect(resultado.stockRestante).toBe(7);

    const stockRestante = await consultarStockPlato(platoId);
    expect(stockRestante).toBe(7);
  });

  it("rechaza la reserva si el mozo pide más unidades de las disponibles", async () => {
    const platoId = 103;
    await fijarStockPlato(platoId, 2);

    const resultado = await reservarStockPlato(platoId, 5);
    expect(resultado.exito).toBe(false);
    expect(resultado.stockRestante).toBe(2);
    expect(resultado.mensaje).toContain("Stock insuficiente");

    // El stock original debe permanecer intacto
    const stockActual = await consultarStockPlato(platoId);
    expect(stockActual).toBe(2);
  });

  it("evita la sobreventa cuando solo queda 1 plato y dos mozos intentan reservarlo (condición de carrera)", async () => {
    const platoId = 104; // "1/4 Pollo a la Brasa"
    await fijarStockPlato(platoId, 1); // Solo queda 1 unidad en cocina

    // Dos mozos presionan 'Confirmar Pedido' al mismo instante
    const [pedidoMozo1, pedidoMozo2] = await Promise.all([
      reservarStockPlato(platoId, 1),
      reservarStockPlato(platoId, 1)
    ]);

    // Exactamente uno de los dos debe ganar la porción
    const exitos = [pedidoMozo1.exito, pedidoMozo2.exito].filter(Boolean);
    const fallos = [pedidoMozo1.exito, pedidoMozo2.exito].filter((e) => !e);

    expect(exitos.length).toBe(1);
    expect(fallos.length).toBe(1);

    // El stock final no puede ser menor a 0 (cero inventario descuadrado)
    const stockFinal = await consultarStockPlato(platoId);
    expect(stockFinal).toBe(0);
  });

  it("libera y devuelve el stock al cancelar un plato o pedido", async () => {
    const platoId = 105;
    await fijarStockPlato(platoId, 5);

    // Reservar 2
    await reservarStockPlato(platoId, 2);
    expect(await consultarStockPlato(platoId)).toBe(3);

    // Cliente cancela el pedido: se devuelven las 2 unidades
    const nuevoStock = await liberarStockPlato(platoId, 2);
    expect(nuevoStock).toBe(5);
    expect(await consultarStockPlato(platoId)).toBe(5);
  });

  it("realiza rollback automático en una comanda si un plato del pedido no tiene stock", async () => {
    const polloId = 201;
    const papasId = 202;
    const chichaId = 203;

    await fijarStockPlato(polloId, 5); // 5 pollos
    await fijarStockPlato(papasId, 0); // 0 papas (agotado)
    await fijarStockPlato(chichaId, 10); // 10 jarras de chicha

    // El mozo envía un pedido de 2 pollos y 1 papas
    const resultadoComanda = await reservarStockComanda([
      { idPlato: polloId, cantidad: 2, nombre: "1/4 Pollo" },
      { idPlato: papasId, cantidad: 1, nombre: "Porción de Papas" }
    ]);

    // Debe fallar porque papas está agotado
    expect(resultadoComanda.exito).toBe(false);
    expect(resultadoComanda.platoAgotado).toContain("Porción de Papas");

    // ROLLBACK: El stock de pollos NO debe haberse descontado, debe seguir en 5
    const stockPollo = await consultarStockPlato(polloId);
    expect(stockPollo).toBe(5);
  });

  it("confirma exitosamente toda la comanda cuando todos los ítems tienen stock disponible", async () => {
    const polloId = 301;
    const chichaId = 302;

    await fijarStockPlato(polloId, 10);
    await fijarStockPlato(chichaId, 8);

    const resultado = await reservarStockComanda([
      { idPlato: polloId, cantidad: 2, nombre: "Mostrito Brasa" },
      { idPlato: chichaId, cantidad: 1, nombre: "Jarra de Chicha" }
    ]);

    expect(resultado.exito).toBe(true);
    expect(await consultarStockPlato(polloId)).toBe(8);
    expect(await consultarStockPlato(chichaId)).toBe(7);
  });
});

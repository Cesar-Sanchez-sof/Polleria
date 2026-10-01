import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getDishStock,
  setDishStock,
  releaseDishStock,
  reserveDishStock
} from "@/lib/services/redis-stock.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/stock
 * Permite consultar el stock en tiempo real desde Redis Cloud.
 * Si se pasa ?id_plato=X retorna el stock de ese plato.
 * Si no se pasa parámetro, retorna el stock de todos los platos activos.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const idPlatoParam = searchParams.get("id_plato");

    if (idPlatoParam) {
      const idPlato = Number.parseInt(idPlatoParam, 10);
      if (Number.isNaN(idPlato)) {
        return Response.json({ error: "ID de plato inválido." }, { status: 400 });
      }

      const stock = await getDishStock(idPlato);
      return Response.json({ idPlato, stock, disponible: stock > 0 });
    }

    // Listar todos los platos activos y su stock actual en Redis
    const platos = await prisma.plato.findMany({
      where: { estado: true },
      select: { id_plato: true, nombre: true, precio: true }
    });

    const stockPlatos = await Promise.all(
      platos.map(async (p) => {
        const stock = await getDishStock(p.id_plato);
        return {
          idPlato: p.id_plato,
          nombre: p.nombre,
          precio: Number(p.precio),
          stock,
          disponible: stock > 0
        };
      })
    );

    return Response.json({ data: stockPlatos, total: stockPlatos.length });
  } catch (error) {
    console.error("[api/stock] Error al consultar stock:", error);
    return Response.json(
      { error: "No se pudo consultar el stock en Redis." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/stock
 * Permite a Cocina o Administrador fijar el stock inicial del día en Redis Cloud.
 * Body: { id_plato: number, stock: number }
 */
export async function POST(request: NextRequest) {
  try {
    const cuerpo = await request.json().catch(() => null);
    if (!cuerpo || typeof cuerpo !== "object") {
      return Response.json({ error: "Petición no válida." }, { status: 400 });
    }

    const idPlato = Number(cuerpo.id_plato);
    const stock = Number(cuerpo.stock);

    if (Number.isNaN(idPlato) || Number.isNaN(stock) || stock < 0) {
      return Response.json(
        { error: "id_plato y stock numérico (>= 0) son obligatorios." },
        { status: 400 }
      );
    }

    const plato = await prisma.plato.findUnique({
      where: { id_plato: idPlato }
    });

    if (!plato) {
      return Response.json({ error: "El plato especificado no existe." }, { status: 404 });
    }

    const nuevoStock = await setDishStock(idPlato, stock);

    return Response.json({
      mensaje: `Stock actualizado con éxito en Redis Cloud para '${plato.nombre}'.`,
      idPlato,
      plato: plato.nombre,
      stock: nuevoStock
    });
  } catch (error) {
    console.error("[api/stock] Error al fijar stock:", error);
    return Response.json(
      { error: "No se pudo actualizar el stock en Redis." },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/stock
 * Permite incrementar o decrementar stock rápidamente (ej: reposición en cocina).
 * Body: { id_plato: number, cantidad: number, operacion: "agregar" | "reducir" }
 */
export async function PATCH(request: NextRequest) {
  try {
    const cuerpo = await request.json().catch(() => null);
    if (!cuerpo || typeof cuerpo !== "object") {
      return Response.json({ error: "Petición no válida." }, { status: 400 });
    }

    const idPlato = Number(cuerpo.id_plato);
    const cantidad = Number(cuerpo.cantidad);
    const operacion = cuerpo.operacion; // "agregar" o "reducir"

    if (Number.isNaN(idPlato) || Number.isNaN(cantidad) || cantidad <= 0) {
      return Response.json(
        { error: "id_plato y cantidad positiva son requeridos." },
        { status: 400 }
      );
    }

    if (operacion === "agregar") {
      const nuevoStock = await releaseDishStock(idPlato, cantidad);
      return Response.json({
        mensaje: `Se agregaron ${cantidad} unidades al stock en Redis.`,
        idPlato,
        stock: nuevoStock
      });
    } else if (operacion === "reducir") {
      const resultado = await reserveDishStock(idPlato, cantidad);
      if (!resultado.success) {
        return Response.json(
          { error: resultado.message || "Stock insuficiente para reducir." },
          { status: 400 }
        );
      }
      return Response.json({
        mensaje: `Se descontaron ${cantidad} unidades en Redis.`,
        idPlato,
        stock: resultado.remainingStock
      });
    }

    return Response.json(
      { error: "operacion debe ser 'agregar' o 'reducir'." },
      { status: 400 }
    );
  } catch (error) {
    console.error("[api/stock] Error al ajustar stock:", error);
    return Response.json(
      { error: "No se pudo ajustar el stock en Redis." },
      { status: 500 }
    );
  }
}

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
 * @openapi
 * /api/stock:
 *   get:
 *     tags:
 *       - Stock
 *     summary: Obtener stock de platos
 *   post:
 *     tags:
 *       - Stock
 *     summary: Establecer stock inicial de un plato
 *   patch:
 *     tags:
 *       - Stock
 *     summary: Ajustar stock de un plato (incrementar o reducir)
 */

/**
 * GET /api/stock
 * Permite consultar el stock en tiempo real desde Redis Cloud.
 * Si se pasa ?dishId=X retorna el stock de ese plato.
 * Si no se pasa parámetro, retorna el stock de todos los platos activos.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dishIdParam = searchParams.get("dishId") ?? searchParams.get("id_plato");

    if (dishIdParam) {
      const dishId = Number.parseInt(dishIdParam, 10);
      if (Number.isNaN(dishId)) {
        return Response.json({ error: "ID de plato inválido." }, { status: 400 });
      }

      const stock = await getDishStock(dishId);
      return Response.json({ dishId, stock, available: stock > 0 });
    }

    // Listar todos los platos activos y su stock actual en Redis
    const dishes = await prisma.dish.findMany({
      where: { active: true },
      select: { id: true, name: true, price: true }
    });

    const stockDishes = await Promise.all(
      dishes.map(async (p) => {
        const stock = await getDishStock(p.id);
        return {
          dishId: p.id,
          name: p.name,
          price: Number(p.price),
          stock,
          available: stock > 0
        };
      })
    );

    return Response.json({ data: stockDishes, total: stockDishes.length });
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
 * Body: { dishId: number, stock: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: "Petición no válida." }, { status: 400 });
    }

    const dishId = Number(body.dishId ?? body.id_plato);
    const stock = Number(body.stock);

    if (Number.isNaN(dishId) || Number.isNaN(stock) || stock < 0) {
      return Response.json(
        { error: "dishId y stock numérico (>= 0) son obligatorios." },
        { status: 400 }
      );
    }

    const dish = await prisma.dish.findUnique({
      where: { id: dishId }
    });

    if (!dish) {
      return Response.json({ error: "El plato especificado no existe." }, { status: 404 });
    }

    const newStock = await setDishStock(dishId, stock);

    return Response.json({
      message: `Stock actualizado con éxito en Redis Cloud para '${dish.name}'.`,
      dishId,
      dish: dish.name,
      stock: newStock
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
 * Body: { dishId: number, quantity: number, operation: "add" | "reduce" }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: "Petición no válida." }, { status: 400 });
    }

    const dishId = Number(body.dishId ?? body.id_plato);
    const quantity = Number(body.quantity ?? body.cantidad);
    const operation = body.operation ?? body.operacion; // "add"/"agregar" o "reduce"/"reducir"

    if (Number.isNaN(dishId) || Number.isNaN(quantity) || quantity <= 0) {
      return Response.json(
        { error: "dishId y quantity positiva son requeridos." },
        { status: 400 }
      );
    }

    if (operation === "add" || operation === "agregar") {
      const newStock = await releaseDishStock(dishId, quantity);
      return Response.json({
        message: `Se agregaron ${quantity} unidades al stock en Redis.`,
        dishId,
        stock: newStock
      });
    } else if (operation === "reduce" || operation === "reducir") {
      const result = await reserveDishStock(dishId, quantity);
      if (!result.success) {
        return Response.json(
          { error: result.message || "Stock insuficiente para reducir." },
          { status: 400 }
        );
      }
      return Response.json({
        message: `Se descontaron ${quantity} unidades en Redis.`,
        dishId,
        stock: result.remainingStock
      });
    }

    return Response.json(
      { error: "operation debe ser 'add' o 'reduce'." },
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

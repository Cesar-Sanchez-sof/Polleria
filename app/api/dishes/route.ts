import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDishStock } from "@/lib/services/redis-stock.service";

export const dynamic = "force-dynamic";

// Helper para categorizar platos según su nombre en la carta
function determineCategory(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("pollo") || n.includes("mostrito")) return "pollos";
  if (n.includes("papas") || n.includes("tequeño") || n.includes("chaufa") || n.includes("ensalada") || n.includes("porción")) return "adicionales";
  if (n.includes("inka") || n.includes("chicha") || n.includes("gaseosa") || n.includes("bebida") || n.includes("agua")) return "bebidas";
  return "otros";
}

/**
 * @openapi
 * /api/dishes:
 *   get:
 *     tags:
 *       - Sales
 *     summary: Lista platos
 *     description: Obtiene la carta de platos, con opción de filtrado por texto y categoría.
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Texto de búsqueda para nombre del plato.
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Categoría del plato (ej. pollos, adicionales, bebidas, otros).
 *     responses:
 *       200:
 *         description: Lista de platos.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Dish'
 *                 total:
 *                   type: integer
 *       500:
 *         description: Error interno del servidor.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const q = (searchParams.get("q") ?? "").trim().toLowerCase();
    const category = searchParams.get("category") ?? searchParams.get("categoria") ?? "";

    const dishesDb = await prisma.dish.findMany({
      where: {
        active: true,
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {})
      },
      orderBy: { id: "asc" }
    });

    const filteredDishes = dishesDb
      .map((p) => {
        const cat = determineCategory(p.name);
        return {
          id: p.id,
          name: p.name,
          description: p.description ?? "",
          price: Number(p.price),
          category: cat,
          active: p.active,
        };
      })
      .filter((p) => !category || category === "todos" || p.category === category);

    // Obtener stock en tiempo real desde Redis Cloud para cada plato
    const dishesWithStock = await Promise.all(
      filteredDishes.map(async (p) => {
        const stock = await getDishStock(p.id);
        return {
          ...p,
          stock,
          available: stock > 0
        };
      })
    );

    return Response.json({ data: dishesWithStock, total: dishesWithStock.length });
  } catch (error) {
    console.error("[api/dishes] Error al listar platos:", error);
    return Response.json(
      { error: "No se pudo obtener la carta de productos." },
      { status: 500 }
    );
  }
}

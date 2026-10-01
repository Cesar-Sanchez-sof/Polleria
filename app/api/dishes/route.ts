import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDishStock } from "@/lib/services/redis-stock.service";

export const dynamic = "force-dynamic";

// Helper para categorizar platos según su nombre en la carta
function determineCategory(nombre: string): string {
  const n = nombre.toLowerCase();
  if (n.includes("pollo") || n.includes("mostrito")) return "pollos";
  if (n.includes("papas") || n.includes("tequeño") || n.includes("chaufa") || n.includes("ensalada") || n.includes("porción")) return "adicionales";
  if (n.includes("inka") || n.includes("chicha") || n.includes("gaseosa") || n.includes("bebida") || n.includes("agua")) return "bebidas";
  return "otros";
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const q = (searchParams.get("q") ?? "").trim().toLowerCase();
    const categoria = searchParams.get("categoria") ?? "";

    const dishesDb = await prisma.plato.findMany({
      where: {
        estado: true,
        ...(q ? { nombre: { contains: q, mode: "insensitive" } } : {})
      },
      orderBy: { id_plato: "asc" }
    });

    const filteredDishes = dishesDb
      .map((p) => {
        const cat = determineCategory(p.nombre);
        return {
          id: p.id_plato,
          nombre: p.nombre,
          descripcion: p.descripcion ?? "",
          precio: Number(p.precio),
          categoria: cat,
          estado: p.estado,
        };
      })
      .filter((p) => !categoria || categoria === "todos" || p.categoria === categoria);

    // Obtener stock en tiempo real desde Redis Cloud para cada plato
    const dishesWithStock = await Promise.all(
      filteredDishes.map(async (p) => {
        const stock = await getDishStock(p.id);
        return {
          ...p,
          stock,
          disponible: stock > 0
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

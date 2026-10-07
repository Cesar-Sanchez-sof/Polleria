import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDishStock, setDishStock } from "@/lib/services/redis-stock.service";

export const dynamic = "force-dynamic";

// Helper para categorizar platos según su nombre o metadatos
export function determineCategory(name: string, description?: string | null): string {
  const text = `${name} ${description || ""}`.toLowerCase();
  if (text.includes("pollo") || text.includes("mostrito") || text.includes("brasa")) return "pollos";
  if (text.includes("papa") || text.includes("tequeño") || text.includes("chaufa") || text.includes("ensalada") || text.includes("porción") || text.includes("guarnic")) return "adicionales";
  if (text.includes("inka") || text.includes("chicha") || text.includes("gaseosa") || text.includes("bebida") || text.includes("agua") || text.includes("cerveza")) return "bebidas";
  return "otros";
}

/**
 * @openapi
 * /api/dishes:
 *   get:
 *     tags:
 *       - Dishes
 *     summary: Lista platos de la carta con sus recetas opcionales
 *   post:
 *     tags:
 *       - Dishes
 *     summary: Registrar nuevo plato con vinculación de ingredientes y recetas
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const q = (searchParams.get("q") ?? "").trim().toLowerCase();
    const category = searchParams.get("category") ?? searchParams.get("categoria") ?? "";
    const includeInactive = searchParams.get("includeInactive") === "true";
    const includeRecipes = searchParams.get("includeRecipes") === "true";

    const dishesDb = await prisma.dish.findMany({
      where: {
        ...(includeInactive ? {} : { active: true }),
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      },
      include: includeRecipes
        ? {
            recipes: {
              include: {
                supply: {
                  select: {
                    id: true,
                    name: true,
                    unitOfMeasure: true,
                    currentStock: true,
                    lastCost: true,
                    averageCost: true,
                  },
                },
              },
            },
          }
        : undefined,
      orderBy: { id: "asc" },
    });

    const mappedDishes = dishesDb
      .map((p) => {
        const cat = determineCategory(p.name, p.description);
        const recipes = (p as any).recipes
          ? (p as any).recipes.map((r: any) => ({
              id: r.id,
              supplyId: r.supplyId,
              quantityRequired: Number(r.quantityRequired),
              supplyName: r.supply?.name || "",
              unitOfMeasure: r.supply?.unitOfMeasure || "und",
              costPerUnit: Number(r.supply?.averageCost || r.supply?.lastCost || 0),
              estimatedCost: Number(r.quantityRequired) * Number(r.supply?.averageCost || r.supply?.lastCost || 0),
            }))
          : [];

        const totalEstimatedCost = recipes.reduce((sum: number, r: any) => sum + r.estimatedCost, 0);

        return {
          id: p.id,
          name: p.name,
          description: p.description ?? "",
          price: Number(p.price),
          category: cat,
          active: p.active,
          recipes,
          recipeCost: Math.round(totalEstimatedCost * 100) / 100,
        };
      })
      .filter((p) => !category || category === "todos" || p.category === category);

    // Obtener stock en tiempo real desde Redis para cada plato
    const dishesWithStock = await Promise.all(
      mappedDishes.map(async (p) => {
        const stock = await getDishStock(p.id).catch(() => 999);
        return {
          ...p,
          stock,
          available: p.active && stock > 0,
        };
      })
    );

    return NextResponse.json({
      data: dishesWithStock,
      total: dishesWithStock.length,
    });
  } catch (error) {
    console.error("[api/dishes] Error al listar platos:", error);
    return NextResponse.json(
      { error: "No se pudo obtener la carta de productos." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = (body.name || body.nombre || "").trim();
    const description = (body.description || body.descripcion || "").trim();
    const price = Number(body.price ?? body.precio);
    const initialStock = body.stock !== undefined ? Number(body.stock) : 50;
    const ingredients = Array.isArray(body.ingredients ?? body.receta ?? body.recipes)
      ? (body.ingredients ?? body.receta ?? body.recipes)
      : [];

    if (!name) {
      return NextResponse.json({ error: "El nombre del plato es obligatorio." }, { status: 400 });
    }

    if (Number.isNaN(price) || price <= 0) {
      return NextResponse.json({ error: "El precio de venta debe ser un monto mayor a 0." }, { status: 400 });
    }

    // Transacción: Registrar plato e ingredientes de receta
    const newDish = await prisma.$transaction(async (tx) => {
      const dish = await tx.dish.create({
        data: {
          name,
          description: description || null,
          price,
          active: true,
        },
      });

      // Si se vincularon ingredientes/insumos
      if (ingredients.length > 0) {
        for (const item of ingredients) {
          const supplyId = Number(item.supplyId ?? item.id_insumo);
          const quantityRequired = Number(item.quantityRequired ?? item.cantidad);

          if (supplyId && quantityRequired > 0) {
            await tx.dishRecipe.create({
              data: {
                dishId: dish.id,
                supplyId,
                quantityRequired,
              },
            });
          }
        }
      }

      return dish;
    });

    // Inicializar stock en Redis
    if (!Number.isNaN(initialStock) && initialStock >= 0) {
      await setDishStock(newDish.id, initialStock).catch(() => null);
    }

    // Obtener plato completo con receta
    const createdWithRecipes = await prisma.dish.findUnique({
      where: { id: newDish.id },
      include: {
        recipes: {
          include: {
            supply: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        message: `Plato "${newDish.name}" registrado exitosamente con sus recetas.`,
        data: createdWithRecipes,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[api/dishes] Error al registrar plato:", error);
    return NextResponse.json(
      { error: error.message || "Error al registrar el plato y sus recetas." },
      { status: 500 }
    );
  }
}

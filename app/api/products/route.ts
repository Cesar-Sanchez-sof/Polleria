import { NextRequest, NextResponse } from "next/server";
import { ProductType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authorize } from "@/lib/auth/permissions";
import { determineCategory } from "@/lib/utils/product-category";
import { mapRecipe, type RecipeRow } from "@/lib/services/product-recipe";

export const dynamic = "force-dynamic";

/** Permisos que pueden listar productos: inventario, compras, transformación, carta y toma de pedidos. */
const LIST_PERMISSIONS = [
  "inventario.ver",
  "compras.ver",
  "transformacion.ver",
  "platos.ver",
  "pedidos.ver",
  "pedidos.crear",
  "ventas.crear",
];

/**
 * @openapi
 * /api/products:
 *   get:
 *     tags:
 *       - Products
 *     summary: Lista productos (materias primas y productos terminados) con su stock
 *     description: >
 *       Filtros: `sellable=true` (solo lo que se vende en la carta), `includeInactive=true`,
 *       `includeRecipes=true` (receta referencial), `category`, `q`.
 *   post:
 *     tags:
 *       - Products
 *     summary: Registrar un producto de la carta con su receta referencial
 */
export async function GET(request: NextRequest) {
  const auth = await authorize(LIST_PERMISSIONS);
  if (!auth.ok) return auth.response;
  try {
    const params = request.nextUrl.searchParams;
    const q = (params.get("q") ?? "").trim();
    const category = params.get("category") ?? params.get("categoria") ?? "";
    const includeInactive = params.get("includeInactive") === "true";
    const includeRecipes = params.get("includeRecipes") === "true";
    const sellable = params.get("sellable");

    const productsDb = await prisma.product.findMany({
      where: {
        ...(includeInactive ? {} : { active: true }),
        ...(sellable === "true" ? { sellable: true } : sellable === "false" ? { sellable: false } : {}),
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      },
      include: includeRecipes ? { recipe: { include: { ingredient: true } } } : undefined,
      orderBy: sellable === "true" ? { id: "asc" } : { name: "asc" },
    });

    const data = productsDb
      .map((p) => {
        const stock = Number(p.currentStock);
        const withRecipe = includeRecipes
          ? mapRecipe((p as unknown as { recipe: RecipeRow[] }).recipe)
          : { recipe: [], recipeCost: 0 };
        return {
          id: p.id,
          name: p.name,
          description: p.description ?? "",
          type: p.type,
          unitOfMeasure: p.unitOfMeasure,
          sellable: p.sellable,
          price: p.price === null ? null : Number(p.price),
          category: determineCategory(p.name, p.description),
          active: p.active,
          stock,
          currentStock: stock,
          minimumStock: Number(p.minimumStock),
          lastCost: Number(p.lastCost),
          averageCost: Number(p.averageCost),
          available: p.active && p.sellable && stock > 0,
          ...withRecipe,
        };
      })
      .filter((p) => !category || category === "todos" || p.category === category);

    return NextResponse.json({ data, total: data.length });
  } catch (error) {
    console.error("[api/products] Error al listar productos:", error);
    return NextResponse.json({ error: "No se pudo obtener la lista de productos." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await authorize("platos.crear");
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim();
    const price = Number(body.price);
    const unitOfMeasure = String(body.unitOfMeasure ?? "UND").trim() || "UND";
    const type = body.type === ProductType.RawMaterial ? ProductType.RawMaterial : ProductType.FinishedProduct;
    const ingredients: unknown[] = Array.isArray(body.recipe ?? body.ingredients) ? (body.recipe ?? body.ingredients) : [];

    if (!name) {
      return NextResponse.json({ error: "El nombre del producto es obligatorio." }, { status: 400 });
    }
    if (Number.isNaN(price) || price <= 0) {
      return NextResponse.json({ error: "El precio de venta debe ser un monto mayor a 0." }, { status: 400 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name,
          description: description || null,
          type,
          unitOfMeasure,
          price,
          sellable: true,
          active: true,
        },
      });

      for (const raw of ingredients) {
        const item = raw as { ingredientId?: unknown; quantityRequired?: unknown; quantity?: unknown };
        const ingredientId = Number(item.ingredientId);
        const quantityRequired = Number(item.quantityRequired ?? item.quantity);
        if (ingredientId && ingredientId !== product.id && quantityRequired > 0) {
          await tx.productRecipe.create({ data: { productId: product.id, ingredientId, quantityRequired } });
        }
      }
      return product;
    });

    return NextResponse.json(
      { message: `Producto "${created.name}" registrado correctamente.`, data: created },
      { status: 201 }
    );
  } catch (error) {
    console.error("[api/products] Error al registrar producto:", error);
    return NextResponse.json({ error: "Error al registrar el producto y su receta." }, { status: 500 });
  }
}

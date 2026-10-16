import { NextRequest, NextResponse } from "next/server";
import { ProductType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authorize } from "@/lib/auth/permissions";
import { mapRecipe } from "@/lib/services/product-recipe";

export const dynamic = "force-dynamic";

const VIEW_PERMISSIONS = ["platos.ver", "inventario.ver", "pedidos.crear", "ventas.crear"];

async function readId(params: Promise<{ id: string }>): Promise<number | null> {
  const id = Number.parseInt((await params).id, 10);
  return Number.isNaN(id) ? null : id;
}

/**
 * @openapi
 * /api/products/{id}:
 *   get:
 *     tags:
 *       - Products
 *     summary: Obtener un producto con su receta referencial
 *   put:
 *     tags:
 *       - Products
 *     summary: Actualizar un producto de la carta y su receta referencial (el stock no se edita aquí)
 *   patch:
 *     tags:
 *       - Products
 *     summary: Activar o pausar un producto
 *   delete:
 *     tags:
 *       - Products
 *     summary: Ocultar un producto de la carta (baja lógica)
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize(VIEW_PERMISSIONS);
  if (!auth.ok) return auth.response;
  try {
    const id = await readId(params);
    if (id === null) return NextResponse.json({ error: "ID de producto inválido." }, { status: 400 });

    const product = await prisma.product.findUnique({
      where: { id },
      include: { recipe: { include: { ingredient: true } } },
    });
    if (!product) return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });

    return NextResponse.json({
      data: {
        ...product,
        price: product.price === null ? null : Number(product.price),
        stock: Number(product.currentStock),
        currentStock: Number(product.currentStock),
        minimumStock: Number(product.minimumStock),
        ...mapRecipe(product.recipe),
      },
    });
  } catch (error) {
    console.error("[api/products/[id]] Error al obtener producto:", error);
    return NextResponse.json({ error: "Error al obtener el producto." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("platos.editar");
  if (!auth.ok) return auth.response;
  try {
    const id = await readId(params);
    if (id === null) return NextResponse.json({ error: "ID de producto inválido." }, { status: 400 });

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const name = body.name !== undefined ? String(body.name).trim() : undefined;
    const description = body.description !== undefined ? String(body.description).trim() : undefined;
    const price = body.price !== undefined ? Number(body.price) : undefined;
    const active = body.active !== undefined ? Boolean(body.active) : undefined;
    const unitOfMeasure = body.unitOfMeasure !== undefined ? String(body.unitOfMeasure).trim() : undefined;
    const type =
      body.type === ProductType.RawMaterial || body.type === ProductType.FinishedProduct ? body.type : undefined;
    const recipe: unknown[] | undefined = Array.isArray(body.recipe ?? body.ingredients)
      ? (body.recipe ?? body.ingredients)
      : undefined;

    if (name !== undefined && !name) {
      return NextResponse.json({ error: "El nombre no puede estar vacío." }, { status: 400 });
    }
    if (price !== undefined && (Number.isNaN(price) || price <= 0)) {
      return NextResponse.json({ error: "El precio debe ser un número mayor a 0." }, { status: 400 });
    }
    if (unitOfMeasure !== undefined && !unitOfMeasure) {
      return NextResponse.json({ error: "La unidad de medida no puede estar vacía." }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(description !== undefined ? { description: description || null } : {}),
          ...(price !== undefined ? { price } : {}),
          ...(active !== undefined ? { active } : {}),
          ...(unitOfMeasure !== undefined ? { unitOfMeasure } : {}),
          ...(type !== undefined ? { type } : {}),
        },
      });

      if (recipe !== undefined) {
        await tx.productRecipe.deleteMany({ where: { productId: id } });
        for (const raw of recipe) {
          const item = raw as { ingredientId?: unknown; quantityRequired?: unknown; quantity?: unknown };
          const ingredientId = Number(item.ingredientId);
          const quantityRequired = Number(item.quantityRequired ?? item.quantity);
          if (ingredientId && ingredientId !== id && quantityRequired > 0) {
            await tx.productRecipe.create({ data: { productId: id, ingredientId, quantityRequired } });
          }
        }
      }
    });

    const updated = await prisma.product.findUnique({
      where: { id },
      include: { recipe: { include: { ingredient: true } } },
    });
    return NextResponse.json({ message: "Producto y receta actualizados con éxito.", data: updated });
  } catch (error) {
    console.error("[api/products/[id]] Error al actualizar producto:", error);
    return NextResponse.json({ error: "Error al actualizar el producto." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("platos.editar");
  if (!auth.ok) return auth.response;
  try {
    const id = await readId(params);
    if (id === null) return NextResponse.json({ error: "ID de producto inválido." }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    if (body.active === undefined && body.status === undefined) {
      return NextResponse.json({ error: "Debe enviar el nuevo estado (active: true/false)." }, { status: 400 });
    }
    const active = Boolean(body.active ?? body.status);

    const updated = await prisma.product.update({ where: { id }, data: { active } });
    return NextResponse.json({
      message: `Producto "${updated.name}" ${active ? "activado" : "desactivado (pausado)"} correctamente.`,
      data: updated,
    });
  } catch (error) {
    console.error("[api/products/[id]] Error al cambiar estado del producto:", error);
    return NextResponse.json({ error: "Error al cambiar el estado del producto." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("platos.eliminar");
  if (!auth.ok) return auth.response;
  try {
    const id = await readId(params);
    if (id === null) return NextResponse.json({ error: "ID de producto inválido." }, { status: 400 });

    // Baja lógica: el producto sigue en el Kardex y en los pedidos ya vendidos.
    const deactivated = await prisma.product.update({ where: { id }, data: { active: false } });
    return NextResponse.json({
      message: `Producto "${deactivated.name}" desactivado de la carta exitosamente.`,
      data: deactivated,
    });
  } catch (error) {
    console.error("[api/products/[id]] Error al desactivar producto:", error);
    return NextResponse.json({ error: "Error al desactivar el producto." }, { status: 500 });
  }
}

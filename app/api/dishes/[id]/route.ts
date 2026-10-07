import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDishStock, setDishStock } from "@/lib/services/redis-stock.service";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/dishes/{id}:
 *   get:
 *     tags:
 *       - Dishes
 *     summary: Obtener plato por ID con detalle de ingredientes
 *   put:
 *     tags:
 *       - Dishes
 *     summary: Actualizar plato y su receta vinculada
 *   patch:
 *     tags:
 *       - Dishes
 *     summary: Cambiar estado activo/inactivo (Pausar o habilitar plato)
 *   delete:
 *     tags:
 *       - Dishes
 *     summary: Desactivar plato (Soft delete)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const dishId = Number.parseInt(idParam, 10);
    if (Number.isNaN(dishId)) {
      return NextResponse.json({ error: "ID de plato inválido." }, { status: 400 });
    }

    const dish = await prisma.dish.findUnique({
      where: { id: dishId },
      include: {
        recipes: {
          include: {
            supply: true,
          },
        },
      },
    });

    if (!dish) {
      return NextResponse.json({ error: "Plato no encontrado." }, { status: 404 });
    }

    const stock = await getDishStock(dish.id).catch(() => 0);

    return NextResponse.json({
      data: {
        ...dish,
        stock,
        price: Number(dish.price),
        recipes: dish.recipes.map((r) => ({
          id: r.id,
          supplyId: r.supplyId,
          quantityRequired: Number(r.quantityRequired),
          supplyName: r.supply.name,
          unitOfMeasure: r.supply.unitOfMeasure,
          averageCost: Number(r.supply.averageCost),
        })),
      },
    });
  } catch (error: any) {
    console.error("[api/dishes/[id]] Error al obtener plato:", error);
    return NextResponse.json({ error: "Error al obtener plato." }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const dishId = Number.parseInt(idParam, 10);
    if (Number.isNaN(dishId)) {
      return NextResponse.json({ error: "ID de plato inválido." }, { status: 400 });
    }

    const existingDish = await prisma.dish.findUnique({ where: { id: dishId } });
    if (!existingDish) {
      return NextResponse.json({ error: "Plato no encontrado." }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const name = body.name !== undefined ? String(body.name).trim() : undefined;
    const description = body.description !== undefined ? String(body.description).trim() : undefined;
    const price = body.price !== undefined ? Number(body.price) : undefined;
    const stock = body.stock !== undefined ? Number(body.stock) : undefined;
    const active = body.active !== undefined ? Boolean(body.active) : undefined;
    const ingredients = Array.isArray(body.ingredients ?? body.recipes)
      ? (body.ingredients ?? body.recipes)
      : undefined;

    if (name !== undefined && !name) {
      return NextResponse.json({ error: "El nombre no puede estar vacío." }, { status: 400 });
    }
    if (price !== undefined && (Number.isNaN(price) || price <= 0)) {
      return NextResponse.json({ error: "El precio debe ser un número mayor a 0." }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.dish.update({
        where: { id: dishId },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(description !== undefined ? { description: description || null } : {}),
          ...(price !== undefined ? { price } : {}),
          ...(active !== undefined ? { active } : {}),
        },
      });

      // Sincronizar ingredientes si se enviaron
      if (ingredients !== undefined) {
        // Eliminar recetas anteriores
        await tx.dishRecipe.deleteMany({ where: { dishId } });

        // Crear nuevas recetas
        for (const item of ingredients) {
          const supplyId = Number(item.supplyId ?? item.id_insumo);
          const quantityRequired = Number(item.quantityRequired ?? item.cantidad);
          if (supplyId && quantityRequired > 0) {
            await tx.dishRecipe.create({
              data: {
                dishId,
                supplyId,
                quantityRequired,
              },
            });
          }
        }
      }
    });

    if (stock !== undefined && !Number.isNaN(stock)) {
      await setDishStock(dishId, stock).catch(() => null);
    }

    const updated = await prisma.dish.findUnique({
      where: { id: dishId },
      include: {
        recipes: {
          include: { supply: true },
        },
      },
    });

    return NextResponse.json({
      message: "Plato y recetas actualizados con éxito.",
      data: updated,
    });
  } catch (error: any) {
    console.error("[api/dishes/[id]] Error al actualizar plato:", error);
    return NextResponse.json(
      { error: error.message || "Error al actualizar plato." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const dishId = Number.parseInt(idParam, 10);
    if (Number.isNaN(dishId)) {
      return NextResponse.json({ error: "ID de plato inválido." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    if (body.active === undefined && body.estado === undefined) {
      return NextResponse.json({ error: "Debe enviar el nuevo estado (active: true/false)." }, { status: 400 });
    }

    const newActiveState = Boolean(body.active ?? body.estado);

    const updated = await prisma.dish.update({
      where: { id: dishId },
      data: { active: newActiveState },
    });

    return NextResponse.json({
      message: `Plato "${updated.name}" ${newActiveState ? "activado" : "desactivado (pausado)"} correctamente.`,
      data: updated,
    });
  } catch (error: any) {
    console.error("[api/dishes/[id]] Error al cambiar estado del plato:", error);
    return NextResponse.json(
      { error: error.message || "Error al cambiar estado del plato." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const dishId = Number.parseInt(idParam, 10);
    if (Number.isNaN(dishId)) {
      return NextResponse.json({ error: "ID de plato inválido." }, { status: 400 });
    }

    // Soft delete: cambiar solo estado a active = false
    const deactivated = await prisma.dish.update({
      where: { id: dishId },
      data: { active: false },
    });

    return NextResponse.json({
      message: `Plato "${deactivated.name}" desactivado de la carta exitosamente.`,
      data: deactivated,
    });
  } catch (error: any) {
    console.error("[api/dishes/[id]] Error al desactivar plato:", error);
    return NextResponse.json(
      { error: error.message || "Error al desactivar el plato." },
      { status: 500 }
    );
  }
}

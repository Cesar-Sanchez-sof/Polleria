import { ProductType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/http/errors";
import { determineCategory } from "@/lib/utils/product-category";
import { mapRecipe, type RecipeRow } from "@/lib/services/product-recipe";

export interface ListProductsFilter {
  q?: string;
  category?: string;
  includeInactive?: boolean;
  includeRecipes?: boolean;
  sellable?: string | null;
}

export interface ProductRecipeItemInput {
  ingredientId?: number;
  quantityRequired?: number;
  quantity?: number;
}

export interface CreateProductInput {
  name: string;
  description?: string | null;
  price?: number | null;
  unitOfMeasure?: string;
  type?: ProductType;
  sellable?: boolean;
  active?: boolean;
  recipe?: ProductRecipeItemInput[];
  ingredients?: ProductRecipeItemInput[];
}

export interface UpdateProductInput {
  name?: string;
  description?: string | null;
  price?: number | null;
  unitOfMeasure?: string;
  type?: ProductType;
  active?: boolean;
  recipe?: ProductRecipeItemInput[];
  ingredients?: ProductRecipeItemInput[];
}

/**
 * Lista productos (materias primas y productos terminados de la carta) con cálculo de stock y categoría.
 */
export async function listProductsService(filter: ListProductsFilter = {}) {
  const q = (filter.q ?? "").trim();
  const category = filter.category ?? "";
  const includeInactive = Boolean(filter.includeInactive);
  const includeRecipes = Boolean(filter.includeRecipes);
  const sellable = filter.sellable;

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

  return { data, total: data.length };
}

/**
 * Obtiene un producto por su identificador único junto a su receta mapeada.
 */
export async function getProductByIdService(id: number) {
  if (!id || Number.isNaN(id) || id <= 0) {
    throw new ValidationError("ID de producto inválido.");
  }

  const product = await prisma.product.findUnique({
    where: { id },
    include: { recipe: { include: { ingredient: true } } },
  });

  if (!product) {
    throw new NotFoundError("Producto no encontrado.");
  }

  return {
    ...product,
    price: product.price === null ? null : Number(product.price),
    stock: Number(product.currentStock),
    currentStock: Number(product.currentStock),
    minimumStock: Number(product.minimumStock),
    ...mapRecipe(product.recipe),
  };
}

/**
 * Registra un nuevo producto (de carta o insumo) junto a su formulación de receta.
 */
export async function createProductService(input: CreateProductInput) {
  const name = String(input.name ?? "").trim();
  const description = String(input.description ?? "").trim();
  const price = input.price !== undefined && input.price !== null ? Number(input.price) : null;
  const unitOfMeasure = String(input.unitOfMeasure ?? "UND").trim() || "UND";
  const type = input.type === ProductType.RawMaterial ? ProductType.RawMaterial : ProductType.FinishedProduct;
  const sellable = input.sellable !== undefined ? Boolean(input.sellable) : true;
  const active = input.active !== undefined ? Boolean(input.active) : true;
  const rawIngredients = input.recipe ?? input.ingredients ?? [];
  const ingredients = Array.isArray(rawIngredients) ? rawIngredients : [];

  if (!name) {
    throw new ValidationError("El nombre del producto es obligatorio.");
  }

  if (sellable && (price === null || Number.isNaN(price) || price <= 0)) {
    throw new ValidationError("El precio de venta debe ser un monto mayor a 0.");
  }

  const created = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        name,
        description: description || null,
        type,
        unitOfMeasure,
        price,
        sellable,
        active,
      },
    });

    for (const raw of ingredients) {
      const ingredientId = Number(raw.ingredientId);
      const quantityRequired = Number(raw.quantityRequired ?? raw.quantity);
      if (ingredientId && ingredientId !== product.id && quantityRequired > 0) {
        await tx.productRecipe.create({
          data: { productId: product.id, ingredientId, quantityRequired },
        });
      }
    }

    return product;
  });

  return created;
}

/**
 * Actualiza los datos generales de un producto y su receta.
 */
export async function updateProductService(id: number, input: UpdateProductInput) {
  if (!id || Number.isNaN(id) || id <= 0) {
    throw new ValidationError("ID de producto inválido.");
  }

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Producto no encontrado.");
  }

  const name = input.name !== undefined ? String(input.name).trim() : undefined;
  const description = input.description !== undefined ? String(input.description).trim() : undefined;
  const price = input.price !== undefined && input.price !== null ? Number(input.price) : undefined;
  const active = input.active !== undefined ? Boolean(input.active) : undefined;
  const unitOfMeasure = input.unitOfMeasure !== undefined ? String(input.unitOfMeasure).trim() : undefined;
  const type =
    input.type === ProductType.RawMaterial || input.type === ProductType.FinishedProduct
      ? input.type
      : undefined;

  const rawRecipe = input.recipe ?? input.ingredients;
  const recipe = Array.isArray(rawRecipe) ? rawRecipe : undefined;

  if (name !== undefined && !name) {
    throw new ValidationError("El nombre no puede estar vacío.");
  }
  if (price !== undefined && (Number.isNaN(price) || price <= 0)) {
    throw new ValidationError("El precio debe ser un número mayor a 0.");
  }
  if (unitOfMeasure !== undefined && !unitOfMeasure) {
    throw new ValidationError("La unidad de medida no puede estar vacía.");
  }

  // El tipo decide la cuenta contable del inventario (241 / 201 / 211): con movimientos ya no se puede cambiar.
  if (type !== undefined && type !== existing.type) {
    const movements = await prisma.inventoryMovement.count({ where: { productId: id } });
    if (movements > 0) {
      throw new ConflictError("No se puede cambiar el tipo de un producto que ya tiene movimientos de inventario.");
    }
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
      for (const item of recipe) {
        const ingredientId = Number(item.ingredientId);
        const quantityRequired = Number(item.quantityRequired ?? item.quantity);
        if (ingredientId && ingredientId !== id && quantityRequired > 0) {
          await tx.productRecipe.create({
            data: { productId: id, ingredientId, quantityRequired },
          });
        }
      }
    }
  });

  const updated = await prisma.product.findUnique({
    where: { id },
    include: { recipe: { include: { ingredient: true } } },
  });

  return updated;
}

/**
 * Activa o pausa un producto de la carta.
 */
export async function setProductActiveService(id: number, active: boolean) {
  if (!id || Number.isNaN(id) || id <= 0) {
    throw new ValidationError("ID de producto inválido.");
  }

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Producto no encontrado.");
  }

  return await prisma.product.update({
    where: { id },
    data: { active },
  });
}

/**
 * Desactiva un producto de la carta (baja lógica conservando trazabilidad en Kardex y ventas).
 */
export async function deleteProductService(id: number) {
  if (!id || Number.isNaN(id) || id <= 0) {
    throw new ValidationError("ID de producto inválido.");
  }

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Producto no encontrado.");
  }

  return await prisma.product.update({
    where: { id },
    data: { active: false },
  });
}

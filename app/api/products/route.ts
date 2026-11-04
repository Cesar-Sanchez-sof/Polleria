import { createApiHandler } from "@/lib/http/route-handler";
import {
  listProductsService,
  createProductService,
  type CreateProductInput,
} from "@/lib/services/products.service";

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
 *       `includeRecipes=true` (receta del producto), `category`, `q`.
 *   post:
 *     tags:
 *       - Products
 *     summary: Registrar un producto de la carta con su receta
 */
export const GET = createApiHandler({
  permission: LIST_PERMISSIONS,
  handler: async ({ searchParams }) => {
    const q = (searchParams.get("q") ?? "").trim();
    const category = searchParams.get("category") ?? searchParams.get("categoria") ?? "";
    const includeInactive = searchParams.get("includeInactive") === "true";
    const includeRecipes = searchParams.get("includeRecipes") === "true";
    const sellable = searchParams.get("sellable");

    return await listProductsService({
      q,
      category,
      includeInactive,
      includeRecipes,
      sellable,
    });
  },
});

export const POST = createApiHandler<CreateProductInput>({
  permission: "platos.crear",
  successStatus: 201,
  handler: async ({ body }) => {
    const created = await createProductService(body);
    return {
      message: `Producto "${created.name}" registrado correctamente.`,
      data: created,
    };
  },
});

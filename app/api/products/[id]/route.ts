import { createApiHandler, ValidationError } from "@/lib/http/route-handler";
import {
  getProductByIdService,
  updateProductService,
  setProductActiveService,
  deleteProductService,
  type UpdateProductInput,
} from "@/lib/services/products.service";

export const dynamic = "force-dynamic";

const VIEW_PERMISSIONS = ["platos.ver", "inventario.ver", "pedidos.crear", "ventas.crear"];

function parseId(params: Record<string, string | string[]>): number {
  const raw = params.id;
  const str = Array.isArray(raw) ? raw[0] : raw;
  const id = Number.parseInt(str ?? "", 10);
  if (Number.isNaN(id) || id <= 0) {
    throw new ValidationError("ID de producto inválido.");
  }
  return id;
}

/**
 * @openapi
 * /api/products/{id}:
 *   get:
 *     tags:
 *       - Products
 *     summary: Obtener un producto con su receta
 *   put:
 *     tags:
 *       - Products
 *     summary: Actualizar un producto de la carta y su receta (el stock no se edita aquí)
 *   patch:
 *     tags:
 *       - Products
 *     summary: Activar o pausar un producto
 *   delete:
 *     tags:
 *       - Products
 *     summary: Ocultar un producto de la carta (baja lógica)
 */
export const GET = createApiHandler({
  permission: VIEW_PERMISSIONS,
  handler: async ({ params }) => {
    const id = parseId(params);
    const data = await getProductByIdService(id);
    return { data };
  },
});

export const PUT = createApiHandler<UpdateProductInput>({
  permission: "platos.editar",
  handler: async ({ params, body }) => {
    const id = parseId(params);
    const updated = await updateProductService(id, body);
    return {
      message: "Producto y receta actualizados con éxito.",
      data: updated,
    };
  },
});

export const PATCH = createApiHandler<{ active?: boolean; status?: boolean }>({
  permission: "platos.editar",
  handler: async ({ params, body }) => {
    const id = parseId(params);
    const bodyObj = body ?? {};
    if (bodyObj.active === undefined && bodyObj.status === undefined) {
      throw new ValidationError("Debe enviar el nuevo estado (active: true/false).");
    }
    const active = Boolean(bodyObj.active ?? bodyObj.status);
    const updated = await setProductActiveService(id, active);
    return {
      message: `Producto "${updated.name}" ${active ? "activado" : "desactivado (pausado)"} correctamente.`,
      data: updated,
    };
  },
});

export const DELETE = createApiHandler({
  permission: "platos.eliminar",
  handler: async ({ params }) => {
    const id = parseId(params);
    const deactivated = await deleteProductService(id);
    return {
      message: `Producto "${deactivated.name}" desactivado de la carta exitosamente.`,
      data: deactivated,
    };
  },
});

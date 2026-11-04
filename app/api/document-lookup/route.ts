import { createApiHandler, ValidationError } from "@/lib/http/route-handler";
import { lookupIdentityDocument } from "@/lib/services/document-lookup.service";
import { validateCustomerDocument } from "@/lib/utils/sales-helpers";

export const dynamic = "force-dynamic";

const LOOKUP_GET_PERMISSIONS = [
  "clientes.crear",
  "ventas.crear",
  "proveedores.crear",
  "compras.crear",
  "empleados.crear",
  "empleados.editar",
];

const LOOKUP_POST_PERMISSIONS = [
  "clientes.crear",
  "ventas.crear",
  "proveedores.crear",
  "compras.crear",
];

function validateDocumentNumber(type: "dni" | "ruc", number: string) {
  if (!number) {
    throw new ValidationError("Debe ingresar el número de documento.");
  }
  const personType = type === "ruc" ? "Juridico" : "Natural";
  const validation = validateCustomerDocument(personType, number);
  if (!validation.isValid) {
    throw new ValidationError(validation.error ?? "Documento inválido.");
  }
}

/**
 * @openapi
 * /api/document-lookup:
 *   get:
 *     tags:
 *       - DocumentLookup
 *     summary: Consultar documento de identidad (GET)
 *   post:
 *     tags:
 *       - DocumentLookup
 *     summary: Consultar documento de identidad (POST)
 */
export const GET = createApiHandler({
  permission: LOOKUP_GET_PERMISSIONS,
  handler: async ({ searchParams }) => {
    const type = ((searchParams.get("tipo") || "dni").toLowerCase()) as "dni" | "ruc";
    const number = (searchParams.get("numero") || "").trim();

    validateDocumentNumber(type, number);
    const result = await lookupIdentityDocument(type, number);

    return {
      success: true,
      data: result,
    };
  },
});

export const POST = createApiHandler<{ type?: string; number?: string }>({
  permission: LOOKUP_POST_PERMISSIONS,
  successStatus: 200,
  handler: async ({ body }) => {
    const type = ((body?.type || "dni").toLowerCase()) as "dni" | "ruc";
    const number = (body?.number || "").trim();

    validateDocumentNumber(type, number);
    const result = await lookupIdentityDocument(type, number);

    return {
      success: true,
      data: result,
    };
  },
});

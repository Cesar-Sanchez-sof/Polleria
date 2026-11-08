import { NextResponse } from "next/server";
import {
  getRestaurantInfo,
  updateRestaurantInfo,
  type RestaurantInfo,
} from "@/lib/services/settings/restaurant-config.service";
import { getVoucherPresignedUrl } from "@/lib/services/integrations/s3-storage.service";
import { requestIp } from "@/lib/services/security/audit.service";
import { createApiHandler, ValidationError } from "@/lib/http/route-handler";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/settings/restaurant:
 *   get:
 *     tags:
 *       - Settings
 *     summary: Obtener datos de identidad comercial y fiscal del restaurante
 *   put:
 *     tags:
 *       - Settings
 *     summary: Actualizar datos comerciales, fiscales y QR del restaurante
 */

export const GET = createApiHandler({
  permission: ["configuracion.ver", "ventas.ver", "pedidos.ver"],
  handler: async () => {
    const restaurant = await getRestaurantInfo();
    let viewableQrUrl = restaurant.yapeQrImageUrl;
    if (
      restaurant.yapeQrImageUrl &&
      (restaurant.yapeQrImageUrl.startsWith("http") ||
        restaurant.yapeQrImageUrl.startsWith("restaurant/"))
    ) {
      try {
        const presigned = await getVoucherPresignedUrl(restaurant.yapeQrImageUrl, 86400);
        if (presigned) {
          viewableQrUrl = presigned;
        }
      } catch {
        // Fallback al URL original
      }
    }

    return {
      data: {
        ...restaurant,
        yapeQrImageUrl: viewableQrUrl || restaurant.yapeQrImageUrl,
        rawYapeQrImageUrl: restaurant.yapeQrImageUrl,
      },
    };
  },
});

export const PUT = createApiHandler<Partial<RestaurantInfo>>({
  permission: "configuracion.editar",
  handler: async ({ req, session, body }) => {
    if (!body || typeof body !== "object") {
      throw new ValidationError("Datos de entrada inválidos.");
    }

    if (body.ruc && !/^\d{11}$/.test(body.ruc.trim())) {
      throw new ValidationError("El RUC debe ser un número válido de 11 dígitos.");
    }

    const actor = session ? { userId: session.userId, username: session.username } : null;
    const ip = requestIp(req);
    const updated = await updateRestaurantInfo(body, { actor, ipAddress: ip });

    return NextResponse.json({
      message: "Datos del restaurante actualizados correctamente.",
      data: updated,
    });
  },
});

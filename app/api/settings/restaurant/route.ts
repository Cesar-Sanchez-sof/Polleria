import { NextRequest, NextResponse } from "next/server";
import {
  getRestaurantInfo,
  updateRestaurantInfo,
  type RestaurantInfo,
} from "@/lib/services/restaurant-config.service";
import { getVoucherPresignedUrl } from "@/lib/services/s3-storage.service";
import { authorize } from "@/lib/auth/permissions";
import { requestIp } from "@/lib/services/audit.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await authorize(["configuracion.ver", "ventas.ver", "pedidos.ver"]);
  if (!auth.ok) return auth.response;
  try {
    const restaurant = await getRestaurantInfo();
    let viewableQrUrl = restaurant.yapeQrImageUrl;
    if (restaurant.yapeQrImageUrl && (restaurant.yapeQrImageUrl.startsWith("http") || restaurant.yapeQrImageUrl.startsWith("restaurant/"))) {
      try {
        const presigned = await getVoucherPresignedUrl(restaurant.yapeQrImageUrl, 86400);
        if (presigned) {
          viewableQrUrl = presigned;
        }
      } catch {
        // Fallback al URL original
      }
    }
    return NextResponse.json({
      data: {
        ...restaurant,
        yapeQrImageUrl: viewableQrUrl || restaurant.yapeQrImageUrl,
        rawYapeQrImageUrl: restaurant.yapeQrImageUrl,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "No se pudo obtener los datos del restaurante." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await authorize("configuracion.editar");
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json().catch(() => null)) as Partial<RestaurantInfo> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Datos de entrada inválidos." }, { status: 400 });
    }

    if (body.ruc && (!/^\d{11}$/.test(body.ruc.trim()))) {
      return NextResponse.json(
        { error: "El RUC debe ser un número válido de 11 dígitos." },
        { status: 400 }
      );
    }

    const actor = auth.session ? { userId: auth.session.userId, username: auth.session.username } : null;
    const ip = requestIp(request);
    const updated = await updateRestaurantInfo(body, { actor, ipAddress: ip });

    return NextResponse.json({
      message: "Datos del restaurante actualizados correctamente.",
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Error al actualizar los datos de la empresa." },
      { status: 500 }
    );
  }
}

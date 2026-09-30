import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const tiposDb = await prisma.tipo_pago.findMany({
      where: { estado: true },
      orderBy: { id_tipo_pago: "asc" }
    });

    const data = tiposDb.map((tp) => ({
      id: tp.id_tipo_pago,
      nombre: tp.nombre,
      estado: tp.estado,
      // Metadata preparada para futura integración con Mercado Pago
      configPasarela: {
        soportaTapToPay: tp.nombre.toLowerCase().includes("pos") || tp.nombre.toLowerCase().includes("tarjeta"),
        soportaQr: tp.nombre.toLowerCase().includes("yape"),
        proveedorPreparado: "mercado_pago"
      }
    }));

    return Response.json({ data });
  } catch (error) {
    console.error("[api/tipos-pago] Error al listar tipos de pago:", error);
    return Response.json(
      { error: "No se pudieron obtener los métodos de pago." },
      { status: 500 }
    );
  }
}

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fechaAISO } from "@/lib/fechas";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = Number.parseInt(idParam, 10);

    if (Number.isNaN(id)) {
      return Response.json({ error: "Identificador de asiento inválido." }, { status: 400 });
    }

    const asiento = await prisma.asiento_contable.findUnique({
      where: { id_asiento_contable: id },
      include: {
        detalles_asiento: {
          orderBy: { id_detalle_asiento_contable: "asc" },
          include: { cuenta_contable: true },
        },
      },
    });

    if (!asiento) {
      return Response.json({ error: "Asiento contable no encontrado." }, { status: 404 });
    }

    const lineas = asiento.detalles_asiento.map((linea) => ({
      id: linea.id_detalle_asiento_contable,
      cuentaCodigo: linea.cuenta_contable.codigo,
      cuentaNombre: linea.cuenta_contable.nombre,
      cuentaTipo: linea.cuenta_contable.tipo,
      descripcion: linea.descripcion ?? "",
      debe: Number(linea.debito),
      haber: Number(linea.credito),
    }));

    const totalDebe = lineas.reduce((suma, l) => suma + l.debe, 0);
    const totalHaber = lineas.reduce((suma, l) => suma + l.haber, 0);

    return Response.json({
      id: asiento.id_asiento_contable,
      numero: asiento.codigo,
      fecha: fechaAISO(asiento.fecha_contable),
      diario: asiento.diario,
      concepto: asiento.glosa,
      estado: asiento.estado ? "Registrado" : "Anulado",
      responsable: asiento.responsable ?? "",
      observacion: asiento.observacion ?? "",
      fechaCreacion: asiento.fecha_creacion.toISOString(),
      fechaActualizacion: asiento.fecha_actualizacion.toISOString(),
      total: totalDebe,
      cuadrado: Math.abs(totalDebe - totalHaber) < 0.005,
      totales: { debe: totalDebe, haber: totalHaber },
      lineas,
    });
  } catch (error) {
    console.error("[api/asientos/[id]] error al obtener el asiento:", error);
    return Response.json(
      { error: "No se pudo obtener el detalle del asiento contable." },
      { status: 500 }
    );
  }
}

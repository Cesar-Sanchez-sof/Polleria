import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fechaAISO, fechaUTC } from "@/lib/fechas";

export const dynamic = "force-dynamic";

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Entero de la query con tope; inválido = valor por defecto. */
function entero(valor: string | null, defecto: number, min: number, max: number): number {
  if (!valor) return defecto;
  const n = Number.parseInt(valor, 10);
  if (Number.isNaN(n)) return defecto;
  return Math.min(Math.max(n, min), max);
}

/**
 * Libro diario: asientos contables ordenados cronológicamente (del más reciente
 * al más antiguo) con todas sus líneas (cuenta contable, descripción e importes
 * en Debe/Haber) y los totales de cada asiento.
 *
 * Query string:
 * - `desde` / `hasta`: rango de fechas contables (AAAA-MM-DD, ambos inclusive).
 * - `page` / `pageSize`: paginación (máx. 100 por página).
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const desde = (searchParams.get("desde") ?? "").trim();
    const hasta = (searchParams.get("hasta") ?? "").trim();

    if (desde && !FECHA_RE.test(desde)) {
      return Response.json(
        { error: "La fecha inicial debe tener el formato AAAA-MM-DD." },
        { status: 400 }
      );
    }
    if (hasta && !FECHA_RE.test(hasta)) {
      return Response.json(
        { error: "La fecha final debe tener el formato AAAA-MM-DD." },
        { status: 400 }
      );
    }
    if (desde && hasta && desde > hasta) {
      return Response.json(
        { error: "La fecha inicial no puede ser posterior a la fecha final." },
        { status: 400 }
      );
    }

    const page = entero(searchParams.get("page"), 1, 1, Number.MAX_SAFE_INTEGER);
    const pageSize = entero(searchParams.get("pageSize"), 10, 1, 100);

    // Sólo los asientos cuya fecha cae dentro del rango (inclusive).
    const filtro: Prisma.Asiento_contableWhereInput = {};
    if (desde || hasta) {
      const rango: Prisma.DateTimeFilter<"Asiento_contable"> = {};
      if (desde) rango.gte = fechaUTC(desde);
      if (hasta) rango.lte = fechaUTC(hasta);
      filtro.fecha_contable = rango;
    }

    // C01: orden cronológico, del más reciente al más antiguo.
    const total = await prisma.asiento_contable.count({ where: filtro });
    const totalPaginas = Math.max(1, Math.ceil(total / pageSize));
    const pagina = Math.min(page, totalPaginas);
    const offset = (pagina - 1) * pageSize;

    const asientos = await prisma.asiento_contable.findMany({
      where: filtro,
      orderBy: [{ fecha_contable: "desc" }, { id_asiento_contable: "desc" }],
      skip: offset,
      take: pageSize,
      select: {
        id_asiento_contable: true,
        codigo: true,
        fecha_contable: true,
        diario: true,
        glosa: true,
        responsable: true,
        estado: true,
        detalles_asiento: {
          orderBy: { id_detalle_asiento_contable: "asc" },
          select: {
            id_detalle_asiento_contable: true,
            descripcion: true,
            debito: true,
            credito: true,
            cuenta_contable: {
              select: { codigo: true, nombre: true, tipo: true },
            },
          },
        },
      },
    });

    const data = asientos.map((asiento) => {
      // C03/C04: cada línea con su cuenta (código y nombre) e importes.
      const lineas = asiento.detalles_asiento.map((linea) => ({
        id: linea.id_detalle_asiento_contable,
        cuentaCodigo: linea.cuenta_contable.codigo,
        cuentaNombre: linea.cuenta_contable.nombre,
        cuentaTipo: linea.cuenta_contable.tipo,
        descripcion: linea.descripcion ?? "",
        debe: Number(linea.debito),
        haber: Number(linea.credito),
      }));

      // C05: totales del asiento. C06: indicador de cuadre debe = haber.
      const totalDebe = lineas.reduce((suma, linea) => suma + linea.debe, 0);
      const totalHaber = lineas.reduce((suma, linea) => suma + linea.haber, 0);

      return {
        id: asiento.id_asiento_contable,
        numero: asiento.codigo,
        fecha: fechaAISO(asiento.fecha_contable),
        diario: asiento.diario,
        concepto: asiento.glosa,
        responsable: asiento.responsable,
        estado: asiento.estado ? "Registrado" : "Anulado",
        totales: { debe: totalDebe, haber: totalHaber },
        cuadrado: Math.abs(totalDebe - totalHaber) < 0.005,
        lineas,
      };
    });

    return Response.json({
      data,
      meta: {
        total,
        page: pagina,
        pageSize,
        totalPaginas,
        desde,
        hasta,
      },
    });
  } catch (error) {
    console.error("[api/diario] error al obtener el libro diario:", error);
    return Response.json(
      { error: "No se pudo obtener el libro diario." },
      { status: 500 }
    );
  }
}

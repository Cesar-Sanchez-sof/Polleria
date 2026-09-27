import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fechaAISO, fechaUTC } from "@/lib/fechas";

// El listado depende de la petición (filtros, orden y paginación en query string).
export const dynamic = "force-dynamic";

export type OrdenAsiento = "fecha" | "numero" | "concepto" | "diario" | "estado" | "total";
export type DireccionOrden = "asc" | "desc";

const ORDENES: OrdenAsiento[] = ["fecha", "numero", "concepto", "diario", "estado", "total"];

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

function entero(valor: string | null, defecto: number, min: number, max: number): number {
  if (!valor) return defecto;
  const n = Number.parseInt(valor, 10);
  if (Number.isNaN(n)) return defecto;
  return Math.min(Math.max(n, min), max);
}

/**
 * Construye el filtro que comparten el conteo y el listado.
 * Todas las condiciones se combinan con AND: sólo se devuelven los asientos
 * que cumplen todos los filtros seleccionados.
 */
function construirFiltro(searchParams: URLSearchParams): Prisma.Asiento_contableWhereInput {
  const filtro: Prisma.Asiento_contableWhereInput = {};

  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const diario = searchParams.get("diario");
  const estado = searchParams.get("estado");
  const q = (searchParams.get("q") ?? "").trim();

  const rango: Prisma.DateTimeFilter<"Asiento_contable"> = {};
  if (desde && FECHA_RE.test(desde)) rango.gte = fechaUTC(desde);
  if (hasta && FECHA_RE.test(hasta)) rango.lte = fechaUTC(hasta);
  if (Object.keys(rango).length > 0) filtro.fecha_contable = rango;

  if (diario) filtro.diario = diario;
  if (estado === "registrado") filtro.estado = true;
  if (estado === "anulado") filtro.estado = false;

  if (q) {
    // Búsqueda por número/referencia, concepto (glosa) o cuenta contable.
    filtro.OR = [
      { codigo: { contains: q, mode: "insensitive" } },
      { glosa: { contains: q, mode: "insensitive" } },
      {
        detalles_asiento: {
          some: {
            cuenta_contable: {
              OR: [
                { codigo: { contains: q, mode: "insensitive" } },
                { nombre: { contains: q, mode: "insensitive" } },
              ],
            },
          },
        },
      },
    ];
  }

  return filtro;
}

/** Columna de `Asiento_contable` asociada a cada criterio de orden. */
function ordenarPor(
  campo: OrdenAsiento,
  dir: DireccionOrden
): Prisma.Asiento_contableOrderByWithRelationInput {
  switch (campo) {
    case "numero":
      return { codigo: dir };
    case "concepto":
      return { glosa: dir };
    case "diario":
      return { diario: dir };
    case "estado":
      return { estado: dir };
    case "total":
      // No es una columna: se ordena con la agregación del detalle.
      return {};
    case "fecha":
    default:
      return { fecha_contable: dir };
  }
}

/** Suma del debe de cada asiento indicado (clave: id del asiento). */
async function totalesPorAsiento(ids: number[]): Promise<Map<number, number>> {
  const sumas = await prisma.detalle_asiento_contable.groupBy({
    by: ["id_asiento_contable"],
    where: { id_asiento_contable: { in: ids } },
    _sum: { debito: true },
  });

  return new Map(sumas.map((s) => [s.id_asiento_contable, Number(s._sum.debito ?? 0)]));
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const page = entero(searchParams.get("page"), 1, 1, Number.MAX_SAFE_INTEGER);
    const pageSize = entero(searchParams.get("pageSize"), 10, 1, 100);
    const ordenParam = (searchParams.get("orden") ?? "fecha") as OrdenAsiento;
    const orden: OrdenAsiento = ORDENES.includes(ordenParam) ? ordenParam : "fecha";
    const dir: DireccionOrden = searchParams.get("dir") === "asc" ? "asc" : "desc";

    const filtro = construirFiltro(searchParams);

    // Los conteos por estado se agregan al filtro con AND: así
    // `registrados + anulados` siempre coincide con `total`.
    const [total, registrados, anulados] = await Promise.all([
      prisma.asiento_contable.count({ where: filtro }),
      prisma.asiento_contable.count({ where: { AND: [filtro, { estado: true }] } }),
      prisma.asiento_contable.count({ where: { AND: [filtro, { estado: false }] } }),
    ]);

    const totalPaginas = Math.max(1, Math.ceil(total / pageSize));
    const pagina = Math.min(page, totalPaginas);
    const offset = (pagina - 1) * pageSize;

    // El total del asiento es la suma de sus líneas, así que para ordenar por
    // esa columna derivada primero se agrupan los importes con Prisma y se
    // ordena el resultado; después se pide sólo la página solicitada.
    let idsPagina: number[] | null = null;
    if (orden === "total") {
      const filas = await prisma.asiento_contable.findMany({
        where: filtro,
        select: { id_asiento_contable: true },
      });
      const totales = await totalesPorAsiento(filas.map((f) => f.id_asiento_contable));
      const ordenadas = filas
        .map((f) => ({ id: f.id_asiento_contable, total: totales.get(f.id_asiento_contable) ?? 0 }))
        .sort(
          (a, b) =>
            (dir === "asc" ? a.total - b.total : b.total - a.total) || b.id - a.id
        );
      idsPagina = ordenadas.slice(offset, offset + pageSize).map((f) => f.id);
    }

    const filtroPagina: Prisma.Asiento_contableWhereInput = idsPagina
      ? { AND: [filtro, { id_asiento_contable: { in: idsPagina } }] }
      : filtro;

    const registros = await prisma.asiento_contable.findMany({
      where: filtroPagina,
      orderBy: idsPagina ? undefined : [ordenarPor(orden, dir), { id_asiento_contable: "desc" }],
      skip: idsPagina ? undefined : offset,
      take: idsPagina ? undefined : pageSize,
      select: {
        id_asiento_contable: true,
        codigo: true,
        fecha_contable: true,
        diario: true,
        glosa: true,
        responsable: true,
        estado: true,
        detalles_asiento: { select: { debito: true } },
      },
    });

    const data = registros.map((r) => ({
      id: r.id_asiento_contable,
      numero: r.codigo,
      fecha: fechaAISO(r.fecha_contable),
      diario: r.diario,
      concepto: r.glosa,
      responsable: r.responsable,
      estado: r.estado ? "Registrado" : "Anulado",
      total: r.detalles_asiento.reduce((suma, linea) => suma + Number(linea.debito), 0),
    }));

    // Al ordenar por total el orden de la página viene dado por `idsPagina`.
    if (idsPagina) {
      const posicion = new Map(idsPagina.map((id, i) => [id, i]));
      data.sort((a, b) => (posicion.get(a.id) ?? 0) - (posicion.get(b.id) ?? 0));
    }

    return Response.json({
      data,
      meta: {
        total,
        registrados,
        anulados,
        // Página efectiva: si los filtros reducen el resultado, se recorta al último rango
        page: pagina,
        pageSize,
        totalPaginas,
        orden,
        dir,
      },
    });
  } catch (error) {
    console.error("[api/asientos] error al listar asientos:", error);
    return Response.json(
      { error: "No se pudo obtener el listado de asientos contables." },
      { status: 500 }
    );
  }
}

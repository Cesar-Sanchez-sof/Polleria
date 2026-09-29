import type { NextRequest } from "next/server";
import { Prisma, type Asiento_contable } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fechaAISO, fechaUTC } from "@/lib/fechas";
import { generarCodigoAsiento } from "@/lib/codigo-asiento";

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

// ---------------------------------------------------------------------------
// Registro manual de un asiento contable
// ---------------------------------------------------------------------------

/** Línea ya validada, lista para persistirse. */
interface LineaNueva {
  idCuenta: number;
  descripcion: string | null;
  debe: number;
  haber: number;
}

/** Redondea a 2 decimales (precisión monetaria) sin sorpresas de coma flotante. */
function redondear2(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/** Texto recortado del body; cualquier valor que no sea texto se trata como vacío. */
function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/** Importe numérico: acepta número o su representación en texto (vacío = 0). */
function importe(valor: unknown): number | null {
  if (valor === undefined || valor === null || valor === "") return 0;
  const numero = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

/** `true` cuando el fallo corresponde al índice único de `asiento_contable.codigo`. */
function codigoDuplicado(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Registra un asiento contable manual con sus líneas.
 *
 * El número (`codigo`) siempre lo genera el servidor con
 * `generarCodigoAsiento`; si dos peticiones concurrentes eligen el mismo, el
 * índice único rechaza la segunda y se reintenta (hasta 3 veces).
 */
export async function POST(request: NextRequest) {
  try {
    const cuerpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo)) {
      return Response.json(
        { error: "El cuerpo de la petición no es un JSON válido." },
        { status: 400 }
      );
    }

    const errores: string[] = [];

    const fecha = texto(cuerpo.fecha);
    if (!FECHA_RE.test(fecha)) {
      errores.push("La fecha contable es obligatoria y debe tener el formato AAAA-MM-DD.");
    }

    const glosa = texto(cuerpo.glosa);
    if (!glosa) errores.push("El concepto (glosa) del asiento es obligatorio.");
    else if (glosa.length > 200) errores.push("El concepto no puede superar los 200 caracteres.");

    const diario = texto(cuerpo.diario) || "Operaciones varias";
    if (diario.length > 60) errores.push("El diario no puede superar los 60 caracteres.");

    const responsable = texto(cuerpo.responsable);
    if (responsable.length > 100) {
      errores.push("El responsable no puede superar los 100 caracteres.");
    }

    const observacion = texto(cuerpo.observacion);
    if (observacion.length > 200) {
      errores.push("La observación no puede superar los 200 caracteres.");
    }

    const estado = typeof cuerpo.estado === "boolean" ? cuerpo.estado : true;

    const entradas = Array.isArray(cuerpo.lineas) ? cuerpo.lineas : [];
    if (entradas.length < 2) {
      errores.push("El asiento debe registrar al menos dos líneas (debe y haber).");
    } else if (entradas.length > 100) {
      errores.push("El asiento no puede superar las 100 líneas.");
    }

    const lineas: LineaNueva[] = [];
    entradas.forEach((entrada, indice) => {
      const etiqueta = `Línea ${indice + 1}:`;

      if (!entrada || typeof entrada !== "object") {
        errores.push(`${etiqueta} el formato de la línea no es válido.`);
        return;
      }

      const linea = entrada as Record<string, unknown>;

      const idCuenta = Number(linea.idCuenta);
      if (!Number.isInteger(idCuenta) || idCuenta <= 0) {
        errores.push(`${etiqueta} falta la cuenta contable.`);
        return;
      }

      const descripcion = texto(linea.descripcion);
      if (descripcion.length > 200) {
        errores.push(`${etiqueta} la descripción no puede superar los 200 caracteres.`);
      }

      const debe = importe(linea.debe);
      const haber = importe(linea.haber);
      if (debe === null || haber === null) {
        errores.push(`${etiqueta} los importes deben ser números válidos.`);
        return;
      }
      if (debe < 0 || haber < 0) {
        errores.push(`${etiqueta} los importes no pueden ser negativos.`);
        return;
      }
      if (debe > 0 && haber > 0) {
        errores.push(`${etiqueta} no puede tener importe en debe y en haber al mismo tiempo.`);
        return;
      }
      if (debe === 0 && haber === 0) {
        errores.push(`${etiqueta} debe tener un importe en debe o en haber.`);
        return;
      }

      lineas.push({
        idCuenta,
        descripcion: descripcion || null,
        debe: redondear2(debe),
        haber: redondear2(haber),
      });
    });

    const totalDebe = redondear2(lineas.reduce((suma, linea) => suma + linea.debe, 0));
    const totalHaber = redondear2(lineas.reduce((suma, linea) => suma + linea.haber, 0));
    if (lineas.length >= 2 && Math.abs(totalDebe - totalHaber) >= 0.005) {
      errores.push(
        `El asiento no cuadra: el debe (${totalDebe.toFixed(2)}) no coincide con el haber (${totalHaber.toFixed(2)}).`
      );
    }

    if (errores.length > 0) {
      return Response.json({ error: errores[0], errores }, { status: 400 });
    }

    // Todas las líneas deben apuntar a cuentas existentes del plan contable.
    const idsCuentas = [...new Set(lineas.map((linea) => linea.idCuenta))];
    const cuentas = await prisma.cuenta_contable.findMany({
      where: { id_cuenta_contable: { in: idsCuentas } },
      select: { id_cuenta_contable: true },
    });
    const existentes = new Set(cuentas.map((cuenta) => cuenta.id_cuenta_contable));
    if (idsCuentas.some((id) => !existentes.has(id))) {
      return Response.json(
        { error: "Una o más cuentas contables del asiento no existen en el plan contable." },
        { status: 400 }
      );
    }

    const fechaContable = fechaUTC(fecha);

    let asiento: Asiento_contable | null = null;
    for (let intento = 0; intento < 3 && !asiento; intento++) {
      try {
        asiento = await prisma.asiento_contable.create({
          data: {
            codigo: await generarCodigoAsiento(fechaContable),
            fecha_contable: fechaContable,
            glosa,
            diario,
            responsable: responsable || null,
            observacion: observacion || null,
            estado,
            detalles_asiento: {
              create: lineas.map((linea) => ({
                id_cuenta_contable: linea.idCuenta,
                descripcion: linea.descripcion,
                debito: linea.debe,
                credito: linea.haber,
              })),
            },
          },
        });
      } catch (error) {
        if (!codigoDuplicado(error)) throw error;
      }
    }

    if (!asiento) {
      return Response.json(
        { error: "No se pudo asignar un número de asiento, intente nuevamente." },
        { status: 500 }
      );
    }

    return Response.json(
      {
        id: asiento.id_asiento_contable,
        numero: asiento.codigo,
        fecha,
        diario: asiento.diario,
        concepto: asiento.glosa,
        responsable: asiento.responsable,
        estado: asiento.estado ? "Registrado" : "Anulado",
        total: totalDebe,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[api/asientos] error al registrar el asiento:", error);
    return Response.json(
      { error: "No se pudo registrar el asiento contable." },
      { status: 500 }
    );
  }
}

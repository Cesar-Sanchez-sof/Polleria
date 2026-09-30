import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fechaAISO, fechaUTC } from "@/lib/fechas";

export const dynamic = "force-dynamic";

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Referencia de la operación que originó el asiento, si quedó registrada. */
function referenciaDe(asiento: {
  comprobante_venta: { tipo_comprobante: string; serie: string; numero: number } | null;
  comprobante_compra: { tipo_comprobante: string; serie: string; numero: number } | null;
  planilla: { mes: number; anio: number } | null;
}): string | null {
  const venta = asiento.comprobante_venta;
  if (venta) return `${venta.tipo_comprobante} ${venta.serie}-${venta.numero}`;
  const compra = asiento.comprobante_compra;
  if (compra) return `${compra.tipo_comprobante} ${compra.serie}-${compra.numero}`;
  const planilla = asiento.planilla;
  if (planilla) return `Planilla ${planilla.mes}/${planilla.anio}`;
  return null;
}

/** Redondea a 2 decimales (los importes se almacenan como Decimal). */
function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Libro mayor de una cuenta contable: sus movimientos ordenados
 * cronológicamente (del más antiguo al más reciente), con los importes en
 * Debe/Haber, el saldo corriente después de cada movimiento y los totales del
 * periodo consultado.
 *
 * Query string:
 * - `codigo`: código de la cuenta contable (obligatorio).
 * - `desde` / `hasta`: periodo (AAAA-MM-DD, ambos inclusive).
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const codigo = (searchParams.get("codigo") ?? "").trim();
    const desde = (searchParams.get("desde") ?? "").trim();
    const hasta = (searchParams.get("hasta") ?? "").trim();

    if (!codigo) {
      return Response.json(
        { error: "Debe indicar la cuenta contable a consultar." },
        { status: 400 }
      );
    }
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

    // C01/C02: la cuenta consultada.
    const cuenta = await prisma.cuenta_contable.findUnique({ where: { codigo } });
    if (!cuenta) {
      return Response.json({ error: "Cuenta contable no encontrada." }, { status: 404 });
    }

    // Rango de fechas contables (ambos inclusive) y saldo anterior al periodo.
    const rango: Prisma.DateTimeFilter<"Asiento_contable"> = {};
    if (desde) rango.gte = fechaUTC(desde);
    if (hasta) rango.lte = fechaUTC(hasta);

    let saldoAnterior = 0;
    if (desde) {
      // Movimientos de la cuenta anteriores a la fecha inicial: sin ellos el
      // saldo corriente del periodo no reflejaría la realidad de la cuenta.
      const anterior = await prisma.detalle_asiento_contable.aggregate({
        _sum: { debito: true, credito: true },
        where: {
          id_cuenta_contable: cuenta.id_cuenta_contable,
          asiento_contable: { fecha_contable: { lt: fechaUTC(desde) } },
        },
      });
      saldoAnterior =
        Number(anterior._sum.debito ?? 0) - Number(anterior._sum.credito ?? 0);
    }

    const where: Prisma.Detalle_asiento_contableWhereInput = {
      id_cuenta_contable: cuenta.id_cuenta_contable,
    };
    if (desde || hasta) where.asiento_contable = { fecha_contable: rango };

    // C03: movimientos ordenados cronológicamente por fecha de operación
    // (con el asiento y el detalle como criterios de desempate).
    const detalles = await prisma.detalle_asiento_contable.findMany({
      where,
      orderBy: [
        { asiento_contable: { fecha_contable: "asc" } },
        { asiento_contable: { id_asiento_contable: "asc" } },
        { id_detalle_asiento_contable: "asc" },
      ],
      select: {
        id_detalle_asiento_contable: true,
        descripcion: true,
        debito: true,
        credito: true,
        asiento_contable: {
          select: {
            id_asiento_contable: true,
            codigo: true,
            fecha_contable: true,
            glosa: true,
            diario: true,
            estado: true,
            comprobante_venta: {
              select: { tipo_comprobante: true, serie: true, numero: true },
            },
            comprobante_compra: {
              select: { tipo_comprobante: true, serie: true, numero: true },
            },
            planilla: { select: { mes: true, anio: true } },
          },
        },
      },
    });

    // C04-C08: cada movimiento con su fecha, asiento, glosa, importe y saldo
    // corriente de la cuenta después de aplicarlo.
    let saldo = saldoAnterior;
    const movimientos = detalles.map((detalle) => {
      const debe = Number(detalle.debito);
      const haber = Number(detalle.credito);
      saldo = redondear(saldo + debe - haber);
      const asiento = detalle.asiento_contable;

      return {
        id: detalle.id_detalle_asiento_contable,
        idAsiento: asiento.id_asiento_contable,
        numero: asiento.codigo,
        fecha: fechaAISO(asiento.fecha_contable),
        glosa: asiento.glosa,
        descripcion: detalle.descripcion ?? "",
        modulo: asiento.diario,
        referencia: referenciaDe(asiento),
        estado: asiento.estado ? "Registrado" : "Anulado",
        debe,
        haber,
        saldo,
        tipoSaldo: saldo > 0.004 ? "deudor" : saldo < -0.004 ? "acreedor" : null,
      };
    });

    // C11: totales de los movimientos consultados.
    const totalDebe = redondear(movimientos.reduce((suma, m) => suma + m.debe, 0));
    const totalHaber = redondear(movimientos.reduce((suma, m) => suma + m.haber, 0));
    const saldoFinal = redondear(saldoAnterior + totalDebe - totalHaber);

    return Response.json({
      cuenta: {
        codigo: cuenta.codigo,
        nombre: cuenta.nombre,
        tipo: cuenta.tipo,
      },
      saldoAnterior: redondear(saldoAnterior),
      saldoFinal,
      totales: { debe: totalDebe, haber: totalHaber, movimientos: movimientos.length },
      movimientos,
    });
  } catch (error) {
    console.error("[api/mayor] error al obtener el libro mayor:", error);
    return Response.json(
      { error: "No se pudo obtener el libro mayor." },
      { status: 500 }
    );
  }
}

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const mesasDb = await prisma.mesa.findMany({
      orderBy: { numero: "asc" },
      include: {
        pedidos_mesa: {
          where: {
            pedido: {
              estado: { notIn: ["Cerrado", "Cancelado"] }
            }
          },
          include: {
            pedido: {
              include: {
                detalles_pedido: {
                  include: { plato: true },
                  orderBy: { id_detalle_pedido: "asc" }
                }
              }
            }
          }
        }
      }
    });

    const mesas = mesasDb.map((m) => {
      // Si tiene pedido activo (no cerrado ni cancelado), la mesa está ocupada
      const pedidoMesaActivo = m.pedidos_mesa[0] ?? null;
      const pedido = pedidoMesaActivo?.pedido ?? null;

      let pedidoActivo = null;
      if (pedido) {
        const items = pedido.detalles_pedido.map((d) => ({
          idDetalle: d.id_detalle_pedido,
          idPlato: d.id_plato,
          nombre: d.plato.nombre,
          cantidad: d.cantidad,
          precioUnitario: Number(d.precio_unitario),
          subTotal: Number(d.sub_total),
          estadoPlato: d.estado_plato,
          observaciones: d.observaciones ?? ""
        }));

        const totalCalculado = items.reduce((acc, it) => acc + it.subTotal, 0);

        pedidoActivo = {
          id: pedido.id_pedido,
          idPedidoMesa: pedidoMesaActivo.id_pedido_mesa,
          codigo: pedido.codigo,
          tipoPedido: pedido.tipo_pedido,
          fecha: pedido.fecha_pedido.toISOString(),
          estado: pedido.estado, // "Recibido" | "Preparando" | "Servido"
          observacionMesa: pedidoMesaActivo.observacion ?? "",
          items,
          total: totalCalculado,
          // La edición se permite siempre y cuando el pedido NO esté servido ni cerrado
          editable: pedido.estado !== "Servido" && pedido.estado !== "Cerrado"
        };
      }

      return {
        id: m.id_mesa,
        numero: m.numero,
        aforo: m.aforo,
        ocupada: Boolean(pedidoActivo),
        pedidoActivo
      };
    });

    const ocupadas = mesas.filter((m) => m.ocupada).length;
    const disponibles = mesas.length - ocupadas;

    return Response.json({
      data: mesas,
      resumen: {
        total: mesas.length,
        disponibles,
        ocupadas
      }
    });
  } catch (error) {
    console.error("[api/mesas] Error al listar mesas:", error);
    return Response.json(
      { error: "No se pudo obtener la información de las mesas." },
      { status: 500 }
    );
  }
}

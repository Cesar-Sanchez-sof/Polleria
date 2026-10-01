import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const tablesDb = await prisma.mesa.findMany({
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

    const tables = tablesDb.map((m) => {
      // Si tiene pedido activo (no cerrado ni cancelado), la mesa está ocupada
      const activeTableOrder = m.pedidos_mesa[0] ?? null;
      const order = activeTableOrder?.pedido ?? null;

      let activeOrder = null;
      if (order) {
        const items = order.detalles_pedido.map((d) => ({
          idDetalle: d.id_detalle_pedido,
          idPlato: d.id_plato,
          nombre: d.plato.nombre,
          cantidad: d.cantidad,
          precioUnitario: Number(d.precio_unitario),
          subTotal: Number(d.sub_total),
          estadoPlato: d.estado_plato,
          observaciones: d.observaciones ?? ""
        }));

        const calculatedTotal = items.reduce((acc, it) => acc + it.subTotal, 0);

        activeOrder = {
          id: order.id_pedido,
          idPedidoMesa: activeTableOrder.id_pedido_mesa,
          codigo: order.codigo,
          tipoPedido: order.tipo_pedido,
          fecha: order.fecha_pedido.toISOString(),
          estado: order.estado, // "Recibido" | "Preparando" | "Servido"
          observacionMesa: activeTableOrder.observacion ?? "",
          items,
          total: calculatedTotal,
          // La edición se permite siempre y cuando el pedido NO esté servido ni cerrado
          editable: order.estado !== "Servido" && order.estado !== "Cerrado"
        };
      }

      return {
        id: m.id_mesa,
        numero: m.numero,
        aforo: m.aforo,
        ocupada: Boolean(activeOrder),
        pedidoActivo: activeOrder
      };
    });

    const occupied = tables.filter((m) => m.ocupada).length;
    const available = tables.length - occupied;

    return Response.json({
      data: tables,
      resumen: {
        total: tables.length,
        disponibles: available,
        ocupadas: occupied
      }
    });
  } catch (error) {
    console.error("[api/tables] Error al listar mesas:", error);
    return Response.json(
      { error: "No se pudo obtener la información de las mesas." },
      { status: 500 }
    );
  }
}

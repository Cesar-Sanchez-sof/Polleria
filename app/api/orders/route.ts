import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { reserveOrderStock, releaseDishStock } from "@/lib/services/redis-stock.service";

export const dynamic = "force-dynamic";

interface OrderItemInput {
  id_plato: number;
  cantidad: number;
  observaciones?: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tipo = searchParams.get("tipo"); // "Llevar" | "Mesa"
    const estado = searchParams.get("estado"); // "activos" o específico

    const whereFilter: any = {};
    if (tipo) {
      whereFilter.tipo_pedido = tipo;
    }
    if (estado === "activos") {
      whereFilter.estado = { notIn: ["Cerrado", "Cancelado"] };
    } else if (estado) {
      whereFilter.estado = estado;
    }

    const ordersDb = await prisma.pedido.findMany({
      where: whereFilter,
      orderBy: { id_pedido: "desc" },
      include: {
        pedidos_mesa: {
          include: { mesa: true }
        },
        detalles_pedido: {
          include: { plato: true },
          orderBy: { id_detalle_pedido: "asc" }
        }
      }
    });

    const orders = ordersDb.map((p) => {
      const pm = p.pedidos_mesa[0] ?? null;
      const items = p.detalles_pedido.map((d) => ({
        idDetalle: d.id_detalle_pedido,
        idPlato: d.id_plato,
        nombre: d.plato.nombre,
        cantidad: d.cantidad,
        precioUnitario: Number(d.precio_unitario),
        subTotal: Number(d.sub_total),
        estadoPlato: d.estado_plato,
        observaciones: d.observaciones ?? ""
      }));
      const total = items.reduce((acc, it) => acc + it.subTotal, 0);

      return {
        id: p.id_pedido,
        codigo: p.codigo,
        tipoPedido: p.tipo_pedido,
        fecha: p.fecha_pedido.toISOString(),
        estado: p.estado,
        mesa: pm ? { id: pm.mesa.id_mesa, numero: pm.mesa.numero } : null,
        observacion: pm?.observacion ?? "",
        items,
        total,
        editable: p.estado !== "Servido" && p.estado !== "Cerrado"
      };
    });

    return Response.json({ data: orders });
  } catch (error) {
    console.error("[api/orders] Error al listar pedidos:", error);
    return Response.json(
      { error: "No se pudieron obtener los pedidos." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: "Petición no válida." }, { status: 400 });
    }

    const tipoPedido = body.tipo_pedido === "Llevar" ? "Llevar" : "Mesa";
    const idMesa = body.id_mesa ? Number(body.id_mesa) : null;
    const additionalTables = Array.isArray(body.mesas_adicionales)
      ? (body.mesas_adicionales.map(Number).filter((n: number) => !Number.isNaN(n) && n !== idMesa) as number[])
      : [];
    const tableNote = typeof body.observacion === "string" ? body.observacion.trim() : null;
    const items = Array.isArray(body.items) ? (body.items as OrderItemInput[]) : [];

    if (tipoPedido === "Mesa" && (!idMesa || Number.isNaN(idMesa))) {
      return Response.json({ error: "Debe seleccionar una mesa válida para el pedido en mesa." }, { status: 400 });
    }

    if (items.length === 0) {
      return Response.json({ error: "El pedido debe contener al menos un producto." }, { status: 400 });
    }

    // Si es en mesa, verificar que la mesa principal existe y que no tiene un pedido activo ya registrado
    if (tipoPedido === "Mesa" && idMesa) {
      const mesa = await prisma.mesa.findUnique({
        where: { id_mesa: idMesa },
        include: {
          pedidos_mesa: {
            where: {
              pedido: {
                estado: { notIn: ["Cerrado", "Cancelado"] }
              }
            }
          }
        }
      });

      if (!mesa) {
        return Response.json({ error: "La mesa especificada no existe." }, { status: 404 });
      }

      if (mesa.pedidos_mesa.length > 0) {
        return Response.json(
          { error: `La Mesa ${mesa.numero} ya tiene un pedido activo en curso.` },
          { status: 400 }
        );
      }

      // Validar mesas adicionales unidas
      if (additionalTables.length > 0) {
        const additionalTablesDb = await prisma.mesa.findMany({
          where: { id_mesa: { in: additionalTables } },
          include: {
            pedidos_mesa: {
              where: {
                pedido: {
                  estado: { notIn: ["Cerrado", "Cancelado"] }
                }
              }
            }
          }
        });

        for (const m of additionalTablesDb) {
          if (m.pedidos_mesa.length > 0 || !m.estado) {
            return Response.json(
              { error: `La mesa adicional Mesa ${m.numero} ya está ocupada o tiene un pedido activo.` },
              { status: 400 }
            );
          }
        }
      }
    }

    // Validar productos y obtener precios oficiales de la base de datos
    const dishIds = items.map((it) => Number(it.id_plato));
    const dishesDb = await prisma.plato.findMany({
      where: { id_plato: { in: dishIds }, estado: true }
    });

    const dishesMap = new Map(dishesDb.map((pl) => [pl.id_plato, pl]));

    for (const item of items) {
      if (!dishesMap.has(Number(item.id_plato))) {
        return Response.json(
          { error: `El producto con ID ${item.id_plato} no existe o no está activo.` },
          { status: 400 }
        );
      }
      if (!item.cantidad || item.cantidad < 1) {
        return Response.json(
          { error: "La cantidad de cada producto debe ser al menos 1." },
          { status: 400 }
        );
      }
    }

    // 4. Verificación y reserva atómica de stock en Redis Cloud (evita sobreventa concurrente entre mozos)
    const reservationItems = items.map((it) => ({
      idPlato: Number(it.id_plato),
      cantidad: Math.floor(it.cantidad),
      nombre: dishesMap.get(Number(it.id_plato))?.nombre,
    }));

    const reservationResult = await reserveOrderStock(reservationItems);
    if (!reservationResult.success) {
      return Response.json(
        { error: reservationResult.error || "Stock insuficiente para atender el pedido." },
        { status: 400 }
      );
    }

    // Generar código único para el pedido (PED-XXXXXX)
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const codeTimestamp = Date.now().toString().slice(-4);
    const codigo = `PED-${codeTimestamp}${randomSuffix}`;

    // Ejecución transaccional para garantizar integridad
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Crear el Pedido
        const newOrder = await tx.pedido.create({
          data: {
            codigo,
            tipo_pedido: tipoPedido,
            estado: "Recibido",
            fecha_pedido: new Date()
          }
        });

        // 2. Asociar a mesa únicamente si es tipo Mesa
        if (tipoPedido === "Mesa" && idMesa) {
          let finalNote = tableNote;
          if (additionalTables.length > 0) {
            const linkedTables = await tx.mesa.findMany({
              where: { id_mesa: { in: additionalTables } },
              select: { numero: true }
            });
            const nums = linkedTables.map((m) => m.numero).sort((a, b) => a - b).join(", ");
            const tag = `[Mesas unidas: ${nums}]`;
            finalNote = tableNote ? `${tableNote} ${tag}` : tag;
          }

          await tx.pedido_mesa.create({
            data: {
              id_mesa: idMesa,
              id_pedido: newOrder.id_pedido,
              observacion: finalNote
            }
          });

          // Marcar la mesa principal como ocupada
          await tx.mesa.update({
            where: { id_mesa: idMesa },
            data: { estado: false }
          });

          // Marcar mesas adicionales como ocupadas
          if (additionalTables.length > 0) {
            await tx.mesa.updateMany({
              where: { id_mesa: { in: additionalTables } },
              data: { estado: false }
            });
          }
        }

        // 3. Crear detalles del pedido con observaciones por producto
        for (const item of items) {
          const plato = dishesMap.get(Number(item.id_plato))!;
          const precioUnitario = Number(plato.precio);
          const subTotal = Math.round(precioUnitario * item.cantidad * 100) / 100;

          await tx.detalle_pedido.create({
            data: {
              id_pedido: newOrder.id_pedido,
              id_plato: plato.id_plato,
              cantidad: Math.floor(item.cantidad),
              precio_unitario: precioUnitario,
              sub_total: subTotal,
              estado_plato: "Pendiente",
              observaciones: item.observaciones ? item.observaciones.trim().slice(0, 100) : null
            }
          });
        }

        return newOrder;
      });

      // Consultar el pedido completo creado con sus relaciones
      const fullOrder = await prisma.pedido.findUnique({
        where: { id_pedido: result.id_pedido },
        include: {
          pedidos_mesa: { include: { mesa: true } },
          detalles_pedido: { include: { plato: true } }
        }
      });

      return Response.json(
        {
          mensaje: "Pedido registrado con éxito.",
          pedido: fullOrder
        },
        { status: 201 }
      );
    } catch (dbError) {
      // ROLLBACK EN REDIS: Si la base de datos falla, liberamos el stock previamente reservado
      for (const item of reservationItems) {
        await releaseDishStock(item.idPlato, item.cantidad).catch(() => {});
      }
      throw dbError;
    }
  } catch (error) {
    console.error("[api/orders] Error al crear pedido:", error);
    return Response.json(
      { error: "No se pudo registrar el pedido. Intente nuevamente." },
      { status: 500 }
    );
  }
}

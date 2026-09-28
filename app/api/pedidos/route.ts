import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface ItemPedidoInput {
  id_plato: number;
  cantidad: number;
  observaciones?: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tipo = searchParams.get("tipo"); // "Llevar" | "Mesa"
    const estado = searchParams.get("estado"); // "activos" o específico

    const whereFiltro: any = {};
    if (tipo) {
      whereFiltro.tipo_pedido = tipo;
    }
    if (estado === "activos") {
      whereFiltro.estado = { notIn: ["Cerrado", "Cancelado"] };
    } else if (estado) {
      whereFiltro.estado = estado;
    }

    const pedidosDb = await prisma.pedido.findMany({
      where: whereFiltro,
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

    const pedidos = pedidosDb.map((p) => {
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

    return Response.json({ data: pedidos });
  } catch (error) {
    console.error("[api/pedidos] Error al listar pedidos:", error);
    return Response.json(
      { error: "No se pudieron obtener los pedidos." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cuerpo = await request.json().catch(() => null);
    if (!cuerpo || typeof cuerpo !== "object") {
      return Response.json({ error: "Petición no válida." }, { status: 400 });
    }

    const tipoPedido = cuerpo.tipo_pedido === "Llevar" ? "Llevar" : "Mesa";
    const idMesa = cuerpo.id_mesa ? Number(cuerpo.id_mesa) : null;
    const observacionMesa = typeof cuerpo.observacion === "string" ? cuerpo.observacion.trim() : null;
    const items = Array.isArray(cuerpo.items) ? (cuerpo.items as ItemPedidoInput[]) : [];

    if (tipoPedido === "Mesa" && (!idMesa || Number.isNaN(idMesa))) {
      return Response.json({ error: "Debe seleccionar una mesa válida para el pedido en mesa." }, { status: 400 });
    }

    if (items.length === 0) {
      return Response.json({ error: "El pedido debe contener al menos un producto." }, { status: 400 });
    }

    // Si es en mesa, verificar que la mesa existe y que no tiene un pedido activo ya registrado
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
    }

    // Validar productos y obtener precios oficiales de la base de datos
    const idsPlatos = items.map((it) => Number(it.id_plato));
    const platosDb = await prisma.plato.findMany({
      where: { id_plato: { in: idsPlatos }, estado: true }
    });

    const mapaPlatos = new Map(platosDb.map((pl) => [pl.id_plato, pl]));

    for (const item of items) {
      if (!mapaPlatos.has(Number(item.id_plato))) {
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

    // Generar código único para el pedido (PED-XXXXXX)
    const sufijoAleatorio = Math.floor(1000 + Math.random() * 9000);
    const timestampCodigo = Date.now().toString().slice(-4);
    const codigo = `PED-${timestampCodigo}${sufijoAleatorio}`;

    // Ejecución transaccional para garantizar integridad
    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Crear el Pedido
      const nuevoPedido = await tx.pedido.create({
        data: {
          codigo,
          tipo_pedido: tipoPedido,
          estado: "Recibido",
          fecha_pedido: new Date()
        }
      });

      // 2. Asociar a mesa únicamente si es tipo Mesa
      if (tipoPedido === "Mesa" && idMesa) {
        await tx.pedido_mesa.create({
          data: {
            id_mesa: idMesa,
            id_pedido: nuevoPedido.id_pedido,
            observacion: observacionMesa
          }
        });

        // Marcar la mesa como ocupada
        await tx.mesa.update({
          where: { id_mesa: idMesa },
          data: { estado: false }
        });
      }

      // 3. Crear detalles del pedido con observaciones por producto
      for (const item of items) {
        const plato = mapaPlatos.get(Number(item.id_plato))!;
        const precioUnitario = Number(plato.precio);
        const subTotal = Math.round(precioUnitario * item.cantidad * 100) / 100;

        await tx.detalle_pedido.create({
          data: {
            id_pedido: nuevoPedido.id_pedido,
            id_plato: plato.id_plato,
            cantidad: Math.floor(item.cantidad),
            precio_unitario: precioUnitario,
            sub_total: subTotal,
            estado_plato: "Pendiente",
            observaciones: item.observaciones ? item.observaciones.trim().slice(0, 100) : null
          }
        });
      }

      return nuevoPedido;
    });

    // Consultar el pedido completo creado con sus relaciones
    const pedidoCompleto = await prisma.pedido.findUnique({
      where: { id_pedido: resultado.id_pedido },
      include: {
        pedidos_mesa: { include: { mesa: true } },
        detalles_pedido: { include: { plato: true } }
      }
    });

    return Response.json(
      {
        mensaje: "Pedido registrado con éxito.",
        pedido: pedidoCompleto
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[api/pedidos] Error al crear pedido:", error);
    return Response.json(
      { error: "No se pudo registrar el pedido. Intente nuevamente." },
      { status: 500 }
    );
  }
}

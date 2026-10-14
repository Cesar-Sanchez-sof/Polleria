import { NextRequest } from "next/server";
import { realtimeHub, broadcastRealtimeEvent, RealtimeEventType } from "@/lib/realtime/event-emitter";

export const dynamic = "force-dynamic";

/**
 * @openapi
 * /api/realtime:
 *   get:
 *     tags:
 *       - Realtime
 *     summary: Suscribirse al canal de eventos en tiempo real (Server-Sent Events)
 *     description: Mantiene una conexión HTTP persistente unidireccional para recibir eventos de comandas, cocina, bebidas y cobros al instante.
 *     responses:
 *       200:
 *         description: Flujo de eventos continuo (text/event-stream).
 *   post:
 *     tags:
 *       - Realtime
 *     summary: Emitir un evento al bus en tiempo real
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - payload
 *             properties:
 *               type:
 *                 type: string
 *                 example: ORDER_CREATED
 *               payload:
 *                 type: object
 *     responses:
 *       200:
 *         description: Evento difundido exitosamente.
 */

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  let cleanup: (() => void) | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // 1. Registrar cliente en el hub
      cleanup = realtimeHub.addSSEClient(controller);

      // 2. Enviar evento de conexión inicial
      const initialPayload = {
        message: "Conectado al canal en tiempo real de Pollería ERP",
        connectedAt: new Date().toISOString(),
        recentEvents: realtimeHub.getRecentEvents(5),
      };
      const initialMessage = `event: CONNECTED\ndata: ${JSON.stringify(initialPayload)}\n\n`;
      controller.enqueue(encoder.encode(initialMessage));

      // 3. Heartbeat periódico para mantener la conexión viva a través de proxies y navegadores
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
        } catch {
          if (heartbeatTimer) clearInterval(heartbeatTimer);
        }
      }, 20000);
    },
    cancel() {
      if (cleanup) cleanup();
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    },
  });

  // Manejo de desconexión del cliente
  request.signal.addEventListener("abort", () => {
    if (cleanup) cleanup();
    if (heartbeatTimer) clearInterval(heartbeatTimer);
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Deshabilita buffering en Nginx
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || !body.type) {
      return Response.json(
        { error: "Debe especificar un tipo de evento válido ('type')." },
        { status: 400 }
      );
    }

    const event = broadcastRealtimeEvent(
      body.type as RealtimeEventType,
      body.payload || {}
    );

    return Response.json(
      {
        success: true,
        message: "Evento emitido a todos los clientes conectados.",
        event,
        activeClients: realtimeHub.getActiveClientCount(),
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[api/realtime] Error al emitir evento:", error);
    return Response.json(
      { error: "No se pudo emitir el evento en tiempo real." },
      { status: 500 }
    );
  }
}

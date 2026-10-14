/**
 * Bus de Eventos en Tiempo Real (Real-time Pub/Sub & Server-Sent Events).
 * 
 * Permite la sincronización instantánea entre:
 * 1. Salón / Mozos (creación de comandas, unión de mesas).
 * 2. Cocina / KDS (comandas recibidas, platos listos).
 * 3. Bar / Bebidas (despacho de bebidas).
 * 4. Caja / Cobros (pagos aprobados por Mercado Pago o en efectivo, liberación de mesas).
 */

export type RealtimeEventType =
  | "ORDER_CREATED"
  | "ORDER_STATUS_CHANGED"
  | "DRINK_DISPATCHED"
  | "TABLE_UPDATED"
  | "PAYMENT_RECEIVED"
  | "MERCADO_PAGO_APPROVED"
  | "PING";

export interface RealtimeEvent<T = any> {
  id?: string;
  type: RealtimeEventType;
  payload: T;
  timestamp: string;
}

type EventListener = (event: RealtimeEvent) => void;

class RealtimeHub {
  private static instance: RealtimeHub;
  private listeners: Set<EventListener> = new Set();
  private sseControllers: Set<ReadableStreamDefaultController<Uint8Array>> = new Set();
  private recentEvents: RealtimeEvent[] = [];
  private readonly MAX_HISTORY = 30;

  private constructor() {
    // Singleton
  }

  public static getInstance(): RealtimeHub {
    if (!RealtimeHub.instance) {
      RealtimeHub.instance = new RealtimeHub();
    }
    return RealtimeHub.instance;
  }

  /**
   * Suscribe un listener interno de Node.js.
   */
  public subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Registra un cliente de Server-Sent Events (SSE) conectado vía HTTP.
   */
  public addSSEClient(controller: ReadableStreamDefaultController<Uint8Array>): () => void {
    this.sseControllers.add(controller);
    return () => {
      this.sseControllers.delete(controller);
    };
  }

  /**
   * Retorna el número de clientes SSE actualmente conectados.
   */
  public getActiveClientCount(): number {
    return this.sseControllers.size;
  }

  /**
   * Retorna los últimos eventos emitidos para sincronización al reconectar.
   */
  public getRecentEvents(limit = 10): RealtimeEvent[] {
    return this.recentEvents.slice(-limit);
  }

  /**
   * Emite un evento a todos los clientes SSE y listeners registrados.
   */
  public broadcast<T = any>(
    type: RealtimeEventType,
    payload: T,
    id?: string
  ): RealtimeEvent<T> {
    const event: RealtimeEvent<T> = {
      id: id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      payload,
      timestamp: new Date().toISOString(),
    };

    // Guardar en historial circular
    this.recentEvents.push(event);
    if (this.recentEvents.length > this.MAX_HISTORY) {
      this.recentEvents.shift();
    }

    // Notificar listeners en memoria
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("[RealtimeHub] Error en listener interno:", err);
      }
    }

    // Enviar a todos los clientes SSE conectados
    if (this.sseControllers.size > 0) {
      const encoder = new TextEncoder();
      const sseData = `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
      const encoded = encoder.encode(sseData);

      const deadControllers: ReadableStreamDefaultController<Uint8Array>[] = [];

      for (const controller of this.sseControllers) {
        try {
          controller.enqueue(encoded);
        } catch {
          // Cliente desconectado
          deadControllers.push(controller);
        }
      }

      for (const dead of deadControllers) {
        this.sseControllers.delete(dead);
      }
    }

    return event;
  }

  /**
   * Limpia clientes (útil para pruebas unitarias).
   */
  public reset(): void {
    this.listeners.clear();
    this.sseControllers.clear();
    this.recentEvents = [];
  }
}

// Instancia global compartida
const globalHub = RealtimeHub.getInstance();

export const realtimeHub = globalHub;

/**
 * Función utilitaria para emitir eventos en tiempo real desde cualquier endpoint o servicio.
 */
export function broadcastRealtimeEvent<T = any>(
  type: RealtimeEventType,
  payload: T,
  id?: string
): RealtimeEvent<T> {
  return globalHub.broadcast(type, payload, id);
}

/**
 * Función utilitaria para suscribirse a eventos en tiempo real.
 */
export function subscribeToRealtimeEvents(listener: EventListener): () => void {
  return globalHub.subscribe(listener);
}

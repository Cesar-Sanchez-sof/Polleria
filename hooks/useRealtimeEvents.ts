"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { RealtimeEvent, RealtimeEventType } from "@/lib/realtime/event-emitter";

export interface UseRealtimeEventsOptions {
  enabled?: boolean;
  onEvent?: (event: RealtimeEvent) => void;
  onOrderCreated?: (payload: any) => void;
  onOrderStatusChanged?: (payload: any) => void;
  onDrinkDispatched?: (payload: any) => void;
  onTableUpdated?: (payload: any) => void;
  onPaymentReceived?: (payload: any) => void;
  onMercadoPagoApproved?: (payload: any) => void;
}

export function useRealtimeEvents(options: UseRealtimeEventsOptions = {}) {
  const {
    enabled = true,
    onEvent,
    onOrderCreated,
    onOrderStatusChanged,
    onDrinkDispatched,
    onTableUpdated,
    onPaymentReceived,
    onMercadoPagoApproved,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Guardar callbacks en refs para evitar reconexiones innecesarias al cambiar referencias de funciones
  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  const connect = useCallback(() => {
    if (!enabled || typeof window === "undefined") return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      const es = new EventSource("/api/realtime");
      eventSourceRef.current = es;

      es.onopen = () => {
        setIsConnected(true);
      };

      const handleIncomingEvent = (type: RealtimeEventType, dataStr: string) => {
        try {
          const parsed = JSON.parse(dataStr) as RealtimeEvent;
          setLastEvent(parsed);

          // Disparar callback general
          callbacksRef.current.onEvent?.(parsed);

          // Disparar callbacks específicos
          switch (type) {
            case "ORDER_CREATED":
              callbacksRef.current.onOrderCreated?.(parsed.payload);
              break;
            case "ORDER_STATUS_CHANGED":
              callbacksRef.current.onOrderStatusChanged?.(parsed.payload);
              break;
            case "DRINK_DISPATCHED":
              callbacksRef.current.onDrinkDispatched?.(parsed.payload);
              break;
            case "TABLE_UPDATED":
              callbacksRef.current.onTableUpdated?.(parsed.payload);
              break;
            case "PAYMENT_RECEIVED":
              callbacksRef.current.onPaymentReceived?.(parsed.payload);
              break;
            case "MERCADO_PAGO_APPROVED":
              callbacksRef.current.onMercadoPagoApproved?.(parsed.payload);
              break;
          }
        } catch (err) {
          console.warn("[useRealtimeEvents] Error al procesar evento:", err);
        }
      };

      // Registrar listeners para cada tipo de evento
      const eventTypes: RealtimeEventType[] = [
        "ORDER_CREATED",
        "ORDER_STATUS_CHANGED",
        "DRINK_DISPATCHED",
        "TABLE_UPDATED",
        "PAYMENT_RECEIVED",
        "MERCADO_PAGO_APPROVED",
      ];

      for (const evtType of eventTypes) {
        es.addEventListener(evtType, (e: MessageEvent) => {
          handleIncomingEvent(evtType, e.data);
        });
      }

      es.addEventListener("CONNECTED", () => {
        setIsConnected(true);
      });

      es.onerror = () => {
        setIsConnected(false);
        es.close();
        eventSourceRef.current = null;

        // Reintentar conexión en 4 segundos
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = setTimeout(() => {
          connect();
        }, 4000);
      };
    } catch (err) {
      console.warn("[useRealtimeEvents] Error al inicializar EventSource:", err);
      setIsConnected(false);
    }
  }, [enabled]);

  useEffect(() => {
    connect();

    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
    };
  }, [connect]);

  return {
    isConnected,
    lastEvent,
    reconnect: connect,
  };
}

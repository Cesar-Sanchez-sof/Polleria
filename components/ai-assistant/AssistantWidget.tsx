"use client";

/**
 * Asistente financiero flotante (SPEC-023). Se monta una sola vez en el layout raíz para conservar
 * la conversación mientras se navega por el ERP. No bloquea la interfaz: es un panel fijo, no modal.
 *
 * Solo habla con `/api/assistant` (proxy del servidor); nunca recibe claves, tokens ni roles.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  AlertCircle,
  ChevronDown,
  CircleHelp,
  Info,
  MessageCircle,
  Minus,
  SendHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { MAX_MESSAGE_CHARS } from "@/lib/ai-assistant/contract";
import type { ReplyDetail } from "@/lib/ai-assistant/presentation";
import {
  conversationReducer,
  historyForRequest,
  initialConversation,
  userKeyFrom,
  type ChatMessage,
} from "@/components/ai-assistant/conversation-state";

const SLOW_QUERY_MS = 20_000;
const CONNECTION_ERROR = "No pude comunicarme con el asistente. Revisa tu conexión e inténtalo de nuevo.";

type Status = { habilitado: boolean; datosFicticios?: boolean; usuario?: number; sugerencias?: string[] };

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now() + Math.random());
}

function CalculationDetail({ detalle }: { detalle: ReplyDetail }) {
  return (
    <Collapsible className="mt-2">
      <CollapsibleTrigger className="group/detail flex items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
        Ver detalles del cálculo
        <ChevronDown className="size-3.5 transition-transform group-data-[panel-open]/detail:rotate-180" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md border bg-background/60 p-2.5 text-xs">
          <dt className="text-muted-foreground">Cuenta</dt>
          <dd className="font-medium">{detalle.cuenta}</dd>
          <dt className="text-muted-foreground">Período</dt>
          <dd className="font-medium">{detalle.periodo}</dd>
          {detalle.filas.map((fila) => (
            <div key={fila.etiqueta} className="contents">
              <dt className="text-muted-foreground">{fila.etiqueta}</dt>
              <dd className="font-medium tabular-nums">{fila.valor}</dd>
            </div>
          ))}
        </dl>
        {detalle.nota && <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{detalle.nota}</p>}
      </CollapsibleContent>
    </Collapsible>
  );
}

function AssistantBubble({ message }: { message: Extract<ChatMessage, { rol: "asistente" }> }) {
  const tone =
    message.estado === "error"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : message.estado === "respondida"
        ? "bg-muted"
        : "border-amber-500/30 bg-amber-500/10";
  const Icon = message.estado === "error" ? AlertCircle : message.estado === "requiere_aclaracion" ? CircleHelp : message.estado === "respondida" ? null : Info;
  return (
    <div className="flex justify-start">
      <div className={cn("max-w-[88%] rounded-2xl rounded-bl-sm border border-transparent px-3 py-2 text-sm leading-relaxed", tone)}>
        <p className="flex gap-1.5">
          {Icon && <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />}
          <span>{message.texto}</span>
        </p>
        {message.detalle && <CalculationDetail detalle={message.detalle} />}
      </div>
    </div>
  );
}

export default function AssistantWidget() {
  const pathname = usePathname();
  const [status, setStatus] = useState<Status | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [slow, setSlow] = useState(false);
  const [state, dispatch] = useReducer(conversationReducer, initialConversation);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLogin = pathname === "/login" || pathname?.startsWith("/login/");

  // Al llegar a /login (cierre de sesión) se borra todo: estado ajustado durante el render.
  const [wasOnLogin, setWasOnLogin] = useState(onLogin);
  if (onLogin !== wasOnLogin) {
    setWasOnLogin(onLogin);
    if (onLogin) {
      setStatus(null);
      setOpen(false);
      dispatch({ type: "reset", userKey: null });
    }
  }

  // Estado del asistente y usuario actual: se revisa al navegar. Si cambia el usuario o la sesión
  // deja de ser válida, el historial se borra.
  useEffect(() => {
    if (onLogin) return;
    const controller = new AbortController();
    fetch("/api/assistant", { cache: "no-store", signal: controller.signal })
      .then((r) => r.json().catch(() => null))
      .then((data: Status | null) => {
        const key = userKeyFrom(data);
        setStatus(data && data.habilitado ? data : null);
        if (key !== state.userKey) dispatch({ type: "reset", userKey: key });
        if (!key) setOpen(false);
      })
      .catch(() => undefined);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al navegar o cambiar de pantalla
  }, [pathname, onLogin]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [state.messages.length, state.pending, open]);

  useEffect(() => () => {
    if (slowTimer.current) clearTimeout(slowTimer.current);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const ask = useCallback(
    async (question: string) => {
      const texto = question.trim().slice(0, MAX_MESSAGE_CHARS);
      if (!texto || state.pending) return;
      const historial = historyForRequest({ ...state, messages: [...state.messages, { id: "", rol: "usuario", texto }] });
      dispatch({ type: "send", id: newId(), texto });
      setDraft("");
      setSlow(false);
      slowTimer.current = setTimeout(() => setSlow(true), SLOW_QUERY_MS);
      try {
        const response = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ mensaje: texto, historial, ruta: pathname }),
        });
        const data = await response.json().catch(() => null);
        if (response.ok && data && typeof data.texto === "string" && typeof data.estado === "string") {
          dispatch({ type: "reply", id: newId(), estado: data.estado, texto: data.texto, detalle: data.detalle ?? null });
        } else {
          dispatch({ type: "error", id: newId(), texto: typeof data?.error === "string" ? data.error : CONNECTION_ERROR });
          if (response.status === 401) setStatus(null);
        }
      } catch {
        dispatch({ type: "error", id: newId(), texto: CONNECTION_ERROR });
      } finally {
        if (slowTimer.current) clearTimeout(slowTimer.current);
        slowTimer.current = null;
        setSlow(false);
      }
    },
    [state, pathname],
  );

  if (onLogin || !status?.habilitado) return null;
  const suggestions = status.sugerencias ?? [];

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-end p-3 sm:p-5">
      {open && (
        <section
          role="dialog"
          aria-modal="false"
          aria-label="Asistente financiero"
          className="pointer-events-auto absolute bottom-20 right-3 flex h-[min(620px,calc(100dvh-7rem))] w-[min(400px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-2xl sm:right-5 animate-in fade-in slide-in-from-bottom-2"
        >
          <header className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-semibold leading-tight">Asistente financiero</h2>
              <p className="truncate text-[11px] text-muted-foreground">Consultas de saldos de cuentas</p>
            </div>
            {status.datosFicticios ? (
              <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400">
                Datos ficticios
              </Badge>
            ) : (
              <Badge variant="outline" className="border-sky-500/50 text-sky-700 dark:text-sky-400" title="Prueba local controlada con datos reales del ERP">
                Datos reales (prueba)
              </Badge>
            )}
            <Button variant="ghost" size="icon-sm" aria-label="Minimizar asistente" title="Minimizar" onClick={() => setOpen(false)}>
              <Minus />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Cerrar asistente y borrar la conversación"
              title="Cerrar y borrar la conversación"
              onClick={() => {
                setOpen(false);
                dispatch({ type: "reset", userKey: state.userKey });
              }}
            >
              <X />
            </Button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3" aria-live="polite">
            {state.messages.length === 0 && (
              <div className="space-y-3 py-2">
                <div className="rounded-lg bg-muted/60 p-3 text-sm leading-relaxed">
                  Hola. Puedo decirte cómo se movieron tus cuentas en un mes. Escribe tu pregunta o elige una de estas:
                </div>
                <div className="flex flex-col gap-2">
                  {suggestions.map((suggestion) => (
                    <Button
                      key={suggestion}
                      variant="outline"
                      size="sm"
                      className="h-auto justify-start whitespace-normal py-2 text-left"
                      onClick={() => ask(suggestion)}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {state.messages.map((message) =>
              message.rol === "usuario" ? (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                    {message.texto}
                  </div>
                </div>
              ) : (
                <AssistantBubble key={message.id} message={message} />
              ),
            )}
            {state.pending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                <Spinner className="size-4" />
                <span>{slow ? "Esto está tardando un poco más de lo habitual. Sigo consultando…" : "Consultando…"}</span>
              </div>
            )}
          </div>

          <form
            className="flex items-end gap-2 border-t bg-background px-3 py-2.5"
            onSubmit={(event) => {
              event.preventDefault();
              void ask(draft);
            }}
          >
            <Textarea
              ref={inputRef}
              value={draft}
              maxLength={MAX_MESSAGE_CHARS}
              rows={1}
              placeholder="Escribe tu pregunta…"
              aria-label="Pregunta para el asistente"
              className="max-h-28 min-h-9 resize-none text-sm"
              disabled={state.pending}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void ask(draft);
                }
              }}
            />
            <Button type="submit" size="icon" aria-label="Enviar pregunta" disabled={state.pending || !draft.trim()}>
              <SendHorizontal />
            </Button>
          </form>
        </section>
      )}

      <Button
        type="button"
        size="icon-lg"
        aria-label={open ? "Minimizar asistente financiero" : "Abrir asistente financiero"}
        aria-expanded={open}
        title="Asistente financiero"
        className="pointer-events-auto relative size-14 rounded-full shadow-lg"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <ChevronDown className="size-6" /> : <MessageCircle className="size-6" />}
        {!open && state.messages.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-background bg-amber-500" aria-hidden />
        )}
      </Button>
    </div>
  );
}

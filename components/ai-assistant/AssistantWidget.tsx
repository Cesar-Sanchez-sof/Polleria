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
  Check,
  ChevronDown,
  CircleHelp,
  Info,
  MessageCircle,
  Maximize2,
  Minimize2,
  Minus,
  SendHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuShortcut, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { MAX_MESSAGE_CHARS } from "@/lib/ai-assistant/contract";
import { ASSISTANT_MODELS, DEFAULT_MODEL, isModelId, MODEL_INFO, type AssistantModelId, type ModelInfo } from "@/lib/ai-assistant/models";
import type { AgentTable } from "@/lib/ai-assistant/contract";
import type { ReplyDetail } from "@/lib/ai-assistant/presentation";
import {
  conversationReducer,
  historyForRequest,
  initialConversation,
  userKeyFrom,
  type ChatMessage,
} from "@/components/ai-assistant/conversation-state";

const SLOW_QUERY_MS = 20_000;
const NO_MODELS_MESSAGE = "No hay modelos disponibles por el momento.";
const CONNECTION_ERROR ="No pude comunicarme con el asistente. Revisa tu conexión e inténtalo de nuevo.";

type Status = {
  enabled: boolean;
  fakeData?: boolean;
  usuario?: number;
  suggestions?: string[];
  modelos?: ModelInfo[];
  /** Los tres modelos del selector, con su disponibilidad en este servidor. */
  catalogo?: (ModelInfo & { disponible: boolean })[];
  modeloPredeterminado?: string;
};

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
          {detalle.filas.map((row) => (
            <div key={row.etiqueta} className="contents">
              <dt className="text-muted-foreground">{row.etiqueta}</dt>
              <dd className="font-medium tabular-nums">{row.valor}</dd>
            </div>
          ))}
        </dl>
        {detalle.nota && <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{detalle.nota}</p>}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ResultTable({ tabla }: { tabla: AgentTable }) {
  return (
    <div className="mt-2 max-h-64 overflow-auto rounded-md border bg-background/60">
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 bg-muted">
          <tr>
            {tabla.columnas.map((columna) => (
              <th key={columna} scope="col" className="whitespace-nowrap px-2 py-1.5 text-left font-semibold">
                {columna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tabla.filas.map((fila, index) => (
            <tr key={index} className="border-t">
              {fila.map((celda, i) => (
                <td key={i} className="whitespace-nowrap px-2 py-1 tabular-nums">
                  {celda ?? <span className="text-muted-foreground">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExecutedQuery({ sql }: { sql: string }) {
  return (
    <Collapsible className="mt-2">
      <CollapsibleTrigger className="group/sql flex items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
        Ver consulta ejecutada (solo lectura)
        <ChevronDown className="size-3.5 transition-transform group-data-[panel-open]/sql:rotate-180" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-background/60 p-2 text-[11px] leading-snug">{sql}</pre>
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
        {message.tabla && <ResultTable tabla={message.tabla} />}
        {message.sql && <ExecutedQuery sql={message.sql} />}
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
  const [expanded, setExpanded] = useState(false);
  const [model, setModel] = useState<AssistantModelId>(DEFAULT_MODEL);
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
      setExpanded(false);
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
        setStatus(data && data.enabled ? data : null);
        // El modelo elegido debe seguir disponible; si no, se usa el predeterminado del servidor.
        setModel((selected) => {
          const ids = (data?.modelos ?? []).map((m) => m.id);
          if (ids.includes(selected)) return selected;
          const fallback = data?.modeloPredeterminado;
          return isModelId(fallback) ? fallback : DEFAULT_MODEL;
        });
        if (key !== state.userKey) dispatch({ type: "reset", userKey: key });
        if (!key) {
          setOpen(false);
          setExpanded(false);
        }
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
  }, [open, expanded]);

  // Esc sale de la vista ampliada (no cierra el asistente).
  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const ask = useCallback(
    async (question: string) => {
      const texto = question.trim().slice(0, MAX_MESSAGE_CHARS);
      if (!texto || state.pending || !status?.modelos?.length) return;
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
          body: JSON.stringify({ mensaje: texto, historial, ruta: pathname, modelo: model }),
        });
        const data = await response.json().catch(() => null);
        if (response.ok && data && typeof data.texto === "string" && typeof data.estado === "string") {
          dispatch({
            type: "reply",
            id: newId(),
            estado: data.estado,
            texto: data.texto,
            detalle: data.detalle ?? null,
            tabla: data.tabla ?? null,
            sql: typeof data.sql === "string" ? data.sql : null,
          });
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
    [state, pathname, model, status],
  );

  if (onLogin || !status?.enabled) return null;
  const suggestions = model === "modelo-r" ? (status.suggestions ?? []) : [];
  const models = status.modelos ?? [];
  const noModels = models.length === 0;
  const current = MODEL_INFO[model];
  const isAgent = model === "gemini-erp" || model === "groq-erp"; // agentes de solo lectura sobre el ERP
  const agentName = current.nombre.replace(" + ERP", "");

  return (
    <div className={cn("pointer-events-none fixed inset-0 z-50 flex items-end justify-end", expanded ? "p-0" : "p-3 sm:p-5")}>
      {open && (
        <section
          role="dialog"
          aria-modal="false"
          aria-label="Asistente financiero"
          className={cn(
            "pointer-events-auto absolute flex flex-col overflow-hidden bg-card text-card-foreground animate-in fade-in",
            expanded
              ? "inset-0"
              : "bottom-20 right-3 h-[min(620px,calc(100dvh-7rem))] w-[min(400px,calc(100vw-1.5rem))] rounded-xl border shadow-2xl slide-in-from-bottom-2 sm:right-5",
          )}
        >
          <header className={cn("flex items-center gap-2 border-b bg-muted/40 py-2.5", expanded ? "px-4 sm:px-6" : "px-3")}>
            <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-semibold leading-tight">Asistente financiero</h2>
              <p className="truncate text-[11px] text-muted-foreground">Consultas de saldos de cuentas</p>
              {noModels ? null : isAgent ? (
                <Badge variant="outline" className="mt-1 border-sky-500/50 text-sky-700 dark:text-sky-400" title={`${agentName} solo ve la estructura de las tablas; la base se consulta con un rol de solo lectura`}>
                  Datos del ERP · solo lectura
                </Badge>
              ) : model !== "modelo-r" ? (
                <Badge variant="outline" className="mt-1 border-violet-500/50 text-violet-700 dark:text-violet-400" title={`${current.nombre} no consulta datos del ERP`}>
                  Sin datos del ERP
                </Badge>
              ) : status.fakeData ? (
                <Badge variant="outline" className="mt-1 border-amber-500/50 text-amber-700 dark:text-amber-400">
                  Datos ficticios
                </Badge>
              ) : (
                <Badge variant="outline" className="mt-1 border-sky-500/50 text-sky-700 dark:text-sky-400" title="Prueba local controlada con datos reales del ERP">
                  Datos reales (prueba)
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={expanded ? "Salir de pantalla completa" : "Ver en grande"}
              title={expanded ? "Salir de pantalla completa (Esc)" : "Ver en grande"}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? <Minimize2 /> : <Maximize2 />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Minimizar asistente"
              title="Minimizar"
              onClick={() => {
                setOpen(false);
                setExpanded(false);
              }}
            >
              <Minus />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Cerrar asistente y borrar la conversación"
              title="Cerrar y borrar la conversación"
              onClick={() => {
                setOpen(false);
                setExpanded(false);
                dispatch({ type: "reset", userKey: state.userKey });
              }}
            >
              <X />
            </Button>
          </header>

          <div ref={scrollRef} className={cn("flex-1 overflow-y-auto py-3", expanded ? "px-4 sm:px-6" : "px-3")} aria-live="polite">
           <div className={cn("space-y-3", expanded && "mx-auto w-full max-w-3xl")}>
            {state.messages.length === 0 && (
              <div className="space-y-3 py-2">
                <div className="rounded-lg bg-muted/60 p-3 text-sm leading-relaxed">
                  {noModels
                    ? NO_MODELS_MESSAGE
                    : isAgent
                    ? `Hola. Soy ${agentName}. Puedo consultar los datos contables del ERP en modo solo lectura (nunca modifico nada) y te muestro el resultado en una tabla. Escribe tu pregunta, por ejemplo: «ventas por cuenta de septiembre».`
                    : model !== "modelo-r"
                    ? `Hola. Soy ${current.nombre}. Puedo ayudarte con dudas generales de contabilidad y gestión; no veo los datos del ERP. Escribe tu pregunta.`
                    : "Hola. Puedo decirte cómo se movieron tus cuentas en un mes. Escribe tu pregunta o elige una de estas:"}
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
          </div>

          <form
            className={cn("border-t bg-background py-2.5", expanded ? "px-4 sm:px-6" : "px-3")}
            onSubmit={(event) => {
              event.preventDefault();
              void ask(draft);
            }}
          >
           <div className={cn("space-y-2", expanded && "mx-auto w-full max-w-3xl")}>
            {!noModels && (
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={state.pending}
                  aria-label="Cambiar modelo de IA"
                  className="flex h-7 items-center gap-1.5 rounded-md bg-muted px-2 text-xs font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                >
                  {current.nombre}
                  <span className="text-muted-foreground">{current.version}</span>
                  <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  align="start"
                  className="w-[min(20rem,calc(100vw-2rem))]"
                  onKeyDown={(event) => {
                    const picked = ASSISTANT_MODELS[Number(event.key) - 1];
                    if (picked && models.some((m) => m.id === picked)) {
                      setModel(picked);
                      event.preventDefault();
                    }
                  }}
                >
                  {ASSISTANT_MODELS.map((id, index) => {
                    const info = status.catalogo?.find((m) => m.id === id) ?? MODEL_INFO[id];
                    const available = models.some((m) => m.id === id);
                    return (
                      <DropdownMenuItem key={id} disabled={!available} onClick={() => setModel(id)} className="items-start">
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
                            {info.nombre} <span className="text-muted-foreground">{info.version}</span>
                          </span>
                          <span className="text-[11px] leading-snug text-muted-foreground">{info.descripcion}</span>
                        </span>
                        {!available ? (
                          <span className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            <Info className="size-3" aria-hidden /> No configurado
                          </span>
                        ) : id === model ? (
                          <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-label="Modelo actual" />
                        ) : (
                          <DropdownMenuShortcut>{index + 1}</DropdownMenuShortcut>
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="hidden min-w-0 truncate text-[11px] text-muted-foreground sm:inline">{current.descripcion}</span>
            </div>
            )}
            <div className="flex items-end gap-2">
            <Textarea
              ref={inputRef}
              value={draft}
              maxLength={MAX_MESSAGE_CHARS}
              rows={1}
              placeholder="Escribe tu pregunta…"
              aria-label="Pregunta para el asistente"
              className={cn("min-h-9 resize-none text-sm", expanded ? "max-h-48" : "max-h-28")}
              disabled={state.pending || noModels}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void ask(draft);
                }
              }}
            />
            <Button type="submit" size="icon" aria-label="Enviar pregunta" disabled={state.pending || noModels || !draft.trim()}>
              <SendHorizontal />
            </Button>
            </div>
           </div>
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

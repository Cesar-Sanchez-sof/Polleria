"use client";

/**
 * Botón de dictado del asistente: graba con el micrófono del navegador, envía el audio a
 * `/api/assistant/transcribe` y entrega el TEXTO para que el usuario lo revise en la caja de pregunta.
 * Nunca envía la pregunta por sí solo (Whisper puede equivocarse con cifras y nombres).
 *
 * El audio solo viaja al servidor del ERP (no a Groq directamente) y no se conserva en el navegador.
 * Si el navegador no puede grabar, el botón no aparece.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/** Corte automático de la grabación (el servidor admite hasta ~3 MB de audio). */
export const MAX_RECORDING_MS = 60_000;
const FALLBACK_ERROR = "No pude transcribir el audio. Escribe tu pregunta.";
const MIC_ERROR = "No pude usar el micrófono. Revisa el permiso del navegador.";
const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

const noSubscribe = () => () => {};
const canRecord = () =>
  typeof MediaRecorder !== "undefined" && typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

type Phase = "idle" | "recording" | "transcribing";

export function VoiceButton({
  disabled,
  onText,
  onError,
}: {
  disabled?: boolean;
  onText: (text: string) => void;
  onError: (message: string | null) => void;
}) {
  const supported = useSyncExternalStore(noSubscribe, canRecord, () => false);
  const [phase, setPhase] = useState<Phase>("idle");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);

  const release = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);

  // Al cerrar el panel o navegar: se corta la grabación y se cancela la transcripción pendiente.
  useEffect(
    () => () => {
      request.current?.abort();
      if (recorder.current && recorder.current.state !== "inactive") {
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      release();
    },
    [release],
  );

  const transcribe = useCallback(
    async (audio: Blob) => {
      const controller = new AbortController();
      request.current = controller;
      setPhase("transcribing");
      try {
        const form = new FormData();
        form.set("audio", audio, "grabacion");
        const response = await fetch("/api/assistant/transcribe", { method: "POST", body: form, signal: controller.signal });
        const data: { texto?: unknown; error?: unknown } | null = await response.json().catch(() => null);
        if (response.ok && typeof data?.texto === "string" && data.texto) onText(data.texto);
        else onError(typeof data?.error === "string" ? data.error : FALLBACK_ERROR);
      } catch (exc) {
        if (!(exc instanceof DOMException && exc.name === "AbortError")) onError(FALLBACK_ERROR);
      } finally {
        if (request.current === controller) request.current = null;
        setPhase("idle");
      }
    },
    [onText, onError],
  );

  const start = useCallback(async () => {
    onError(null);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const mimeType = MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
      const rec = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      rec.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      rec.onstop = () => {
        const type = rec.mimeType || mimeType || "audio/webm";
        const audio = new Blob(chunks.current, { type });
        chunks.current = [];
        release();
        if (audio.size > 0) void transcribe(audio);
        else setPhase("idle");
      };
      recorder.current = rec;
      rec.start();
      setPhase("recording");
      timer.current = setTimeout(() => rec.state === "recording" && rec.stop(), MAX_RECORDING_MS);
    } catch {
      release();
      setPhase("idle");
      onError(MIC_ERROR);
    }
  }, [onError, release, transcribe]);

  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  if (!supported) return null;
  const recording = phase === "recording";
  const busy = phase === "transcribing";
  return (
    <Button
      type="button"
      size="icon"
      variant={recording ? "destructive" : "outline"}
      aria-label={recording ? "Detener dictado" : busy ? "Transcribiendo" : "Dictar pregunta"}
      aria-pressed={recording}
      title={recording ? "Detener y transcribir" : "Dictar pregunta"}
      disabled={disabled || busy}
      onClick={() => (recording ? stop() : void start())}
    >
      {busy ? <Spinner /> : recording ? <Square className="fill-current" /> : <Mic />}
    </Button>
  );
}

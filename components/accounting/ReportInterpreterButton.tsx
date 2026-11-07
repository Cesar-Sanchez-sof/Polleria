"use client";

import { useState } from "react";
import {
  Sparkles,
  Loader2,
  TrendingUp,
  AlertCircle,
  Lightbulb,
  CheckCircle2,
  X,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  ReportInterpretationRequest,
  ReportInterpretationResult,
} from "@/lib/services/accounting-interpreter.service";

interface ReportInterpreterButtonProps {
  reportType: ReportInterpretationRequest["reportType"];
  reportTitle: string;
  periodOrCutOff?: string;
  getData: () => unknown;
  disabled?: boolean;
  className?: string;
}

export function ReportInterpreterButton({
  reportType,
  reportTitle,
  periodOrCutOff,
  getData,
  disabled = false,
  className,
}: ReportInterpreterButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReportInterpretationResult | null>(null);

  const handleInterpret = async () => {
    const data = getData();
    if (!data) return;

    setOpen(true);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/accounting/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportType,
          reportTitle,
          periodOrCutOff,
          data,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Error ${res.status} al consultar el intérprete.`);
      }

      const interpretation: ReportInterpretationResult = await res.json();
      setResult(interpretation);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo interpretar el reporte.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || loading}
        onClick={handleInterpret}
        className={`gap-1.5 border-purple-200 bg-purple-50/50 text-purple-700 hover:bg-purple-100 hover:text-purple-800 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-300 dark:hover:bg-purple-900/50 cursor-pointer ${className ?? ""}`}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-600 dark:text-purple-400" />
        ) : (
          <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
        )}
        <span>Interpretar con IA</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-4xl md:max-w-5xl lg:max-w-6xl w-[94vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg">
                  Interpretación Contable · {reportTitle}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {periodOrCutOff ? `Periodo / Corte: ${periodOrCutOff}` : "Análisis financiero automático"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {loading && (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600 dark:text-purple-400" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Analizando cifras, cuentas y ratios financieros...
              </p>
              <p className="text-xs text-slate-400">
                El agente contable está generando el diagnóstico ejecutivo.
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <span>No se pudo completar la interpretación</span>
              </div>
              <p className="text-xs">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 text-xs"
                onClick={handleInterpret}
              >
                Reintentar
              </Button>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-4 py-2 text-sm text-slate-700 dark:text-slate-200">
              {/* Resumen ejecutivo */}
              <div className="rounded-xl bg-purple-50/70 p-4 border border-purple-100 dark:bg-purple-950/20 dark:border-purple-900/40">
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300 flex items-center gap-1.5 mb-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Resumen Ejecutivo
                </h4>
                <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                  {result.summary}
                </p>
              </div>

              {/* Ratios e Indicadores */}
              {result.ratios && result.ratios.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Indicadores y Ratios Clave
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {result.ratios.map((ratio, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
                      >
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                          {ratio.label}
                        </span>
                        <span className="text-lg font-bold text-slate-900 dark:text-white my-0.5 block">
                          {ratio.value}
                        </span>
                        <span className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight block">
                          {ratio.interpretation}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Diagnóstico */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                  Diagnóstico Financiero
                </h4>
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 text-xs sm:text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                  {result.diagnosis}
                </div>
              </div>

              {/* Puntos Clave */}
              {result.keyPoints && result.keyPoints.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                    Puntos de Atención y Hallazgos
                  </h4>
                  <ul className="space-y-1.5 text-xs sm:text-sm">
                    {result.keyPoints.map((point, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 bg-amber-50/40 dark:bg-amber-950/20 p-2.5 rounded-lg border border-amber-200/50 dark:border-amber-900/30"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recomendaciones */}
              {result.recommendations && result.recommendations.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                    <Lightbulb className="h-3.5 w-3.5 text-emerald-600" />
                    Recomendaciones Estratégicas
                  </h4>
                  <ul className="space-y-1.5 text-xs sm:text-sm">
                    {result.recommendations.map((rec, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 bg-emerald-50/40 dark:bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-200/50 dark:border-emerald-900/30"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatDate,
  formatCurrency,
  type JournalEntryDetail,
} from "@/lib/services/asientos.service";

interface JournalEntryDetailProps {
  open: boolean;
  detail: JournalEntryDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
}

export function JournalEntryDetail({
  open,
  detail,
  loading,
  error,
  onClose,
  onRetry,
}: Readonly<JournalEntryDetailProps>) {
  return (
    <Sheet open={open} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        style={{ width: "min(100vw, 54rem)", maxWidth: "54rem" }}
        className="border-l border-slate-200 bg-white"
      >
        <SheetHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-10">
            <div>
              <SheetTitle className="text-lg font-bold text-slate-900">
                {detail?.numero ?? "Detalle del asiento"}
              </SheetTitle>
              <SheetDescription className="text-xs text-slate-500 mt-1">
                {detail
                  ? `${formatDate(detail.fecha)} · ${detail.diario}`
                  : "Cargando la información del asiento..."}
              </SheetDescription>
            </div>
            {detail && (
              <Badge
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border-none shadow-none ${detail.estado === "Registrado" ? "bg-emerald-100/80 text-emerald-700" : "bg-rose-100/80 text-rose-700"}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${detail.estado === "Registrado" ? "bg-emerald-600" : "bg-rose-600"}`}
                />
                {detail.estado}
              </Badge>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {loading && (
            <div className="flex flex-col gap-3 pt-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <AlertCircle className="w-8 h-8 text-red-600" />
              <p className="text-sm font-semibold text-slate-700">{error}</p>
              <Button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reintentar
              </Button>
            </div>
          )}

          {!loading && !error && detail && (
            <>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Número / Referencia
                  </dt>
                  <dd className="text-sm font-bold text-slate-900 mt-1">{detail.numero}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Fecha contable
                  </dt>
                  <dd className="text-sm font-bold text-slate-900 mt-1 tabular-nums">
                    {formatDate(detail.fecha)}
                  </dd>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Diario contable
                  </dt>
                  <dd className="text-sm font-bold text-slate-900 mt-1">{detail.diario}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Responsable
                  </dt>
                  <dd className="text-sm font-bold text-slate-900 mt-1">
                    {detail.responsable || "—"}
                  </dd>
                </div>
              </dl>

              <div className="rounded-lg border border-slate-200 bg-white p-3 mb-4">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Concepto
                </dt>
                <dd className="text-sm text-slate-800 mt-1">{detail.concepto}</dd>
                {detail.observacion && (
                  <>
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-3">
                      Observación
                    </dt>
                    <dd className="text-xs text-slate-500 mt-1">{detail.observacion}</dd>
                  </>
                )}
              </div>

              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Líneas del asiento ({detail.lineas.length})
                </h3>
                <span
                  className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${detail.cuadrado ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                >
                  {detail.cuadrado ? "Asiento cuadrado" : "Descuadre detectado"}
                </span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <Table className="w-full text-left border-collapse min-w-160">
                  <TableHeader>
                    <TableRow className="bg-slate-50/75 hover:bg-slate-50/75 text-slate-900">
                      <TableHead className="py-2.5 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px]">Cuenta contable</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px]">Descripción</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px] text-right">Debe</TableHead>
                      <TableHead className="py-2.5 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px] text-right">Haber</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-slate-100 text-sm text-slate-900">
                    {detail.lineas.map((line) => (
                      <TableRow key={line.id} className="hover:bg-slate-50/60 border-b border-slate-100">
                        <TableCell className="py-2.5 px-3 align-top">
                          <span className="font-bold text-red-700 tabular-nums">{line.cuentaCodigo}</span>
                          <span className="block text-xs text-slate-600">{line.cuentaNombre}</span>
                        </TableCell>
                        <TableCell className="py-2.5 px-3 text-slate-700 text-xs align-top">{line.descripcion || "—"}</TableCell>
                        <TableCell className="py-2.5 px-3 text-right tabular-nums font-semibold text-slate-900 align-top">
                          {line.debe > 0 ? formatCurrency(line.debe) : ""}
                        </TableCell>
                        <TableCell className="py-2.5 px-3 text-right tabular-nums font-semibold text-slate-900 align-top">
                          {line.haber > 0 ? formatCurrency(line.haber) : ""}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

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
  formatearFecha,
  formatearMoneda,
  type AsientoDetalle,
} from "@/lib/services/asientos.service";

interface Props {
  abierto: boolean;
  detalle: AsientoDetalle | null;
  cargando: boolean;
  error: string | null;
  onCerrar: () => void;
  onReintentar: () => void;
}

/** Panel lateral con el detalle del asiento seleccionado y sus líneas. */
export function DetalleAsientos({
  abierto,
  detalle,
  cargando,
  error,
  onCerrar,
  onReintentar,
}: Readonly<Props>) {
  return (
    <Sheet
      open={abierto}
      onOpenChange={(open) => {
        if (!open) onCerrar();
      }}
    >
      <SheetContent
        side="right"
        style={{ width: "min(100vw, 54rem)", maxWidth: "54rem" }}
        className="border-l border-slate-200 bg-white"
      >
        <SheetHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-10">
            <div>
              <SheetTitle className="text-lg font-bold text-slate-900">
                {detalle?.numero ?? "Detalle del asiento"}
              </SheetTitle>
              <SheetDescription className="text-xs text-slate-500 mt-1">
                {detalle
                  ? `${formatearFecha(detalle.fecha)} · ${detalle.diario}`
                  : "Cargando la información del asiento..."}
              </SheetDescription>
            </div>
            {detalle && (
              <Badge
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border-none shadow-none ${detalle.estado === "Registrado" ? "bg-emerald-100/80 text-emerald-700" : "bg-rose-100/80 text-rose-700"}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${detalle.estado === "Registrado" ? "bg-emerald-600" : "bg-rose-600"}`}
                ></span>
                {detalle.estado}
              </Badge>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {cargando && (
            <div className="flex flex-col gap-3 pt-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          )}

          {error && !cargando && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <AlertCircle className="w-8 h-8 text-red-600" />
              <p className="text-sm font-semibold text-slate-700">{error}</p>
              <Button
                type="button"
                onClick={() => onReintentar()}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reintentar
              </Button>
            </div>
          )}

          {!cargando && !error && detalle && (
            <>
              {/* Datos generales */}
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Número / Referencia
                  </dt>
                  <dd className="text-sm font-bold text-slate-900 mt-1">{detalle.numero}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Fecha contable
                  </dt>
                  <dd className="text-sm font-bold text-slate-900 mt-1 tabular-nums">
                    {formatearFecha(detalle.fecha)}
                  </dd>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Diario contable
                  </dt>
                  <dd className="text-sm font-bold text-slate-900 mt-1">{detalle.diario}</dd>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Responsable
                  </dt>
                  <dd className="text-sm font-bold text-slate-900 mt-1">
                    {detalle.responsable || "—"}
                  </dd>
                </div>
              </dl>

              <div className="rounded-lg border border-slate-200 bg-white p-3 mb-4">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Concepto
                </dt>
                <dd className="text-sm text-slate-800 mt-1">{detalle.concepto}</dd>
                {detalle.observacion && (
                  <>
                    <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-3">
                      Observación
                    </dt>
                    <dd className="text-xs text-slate-500 mt-1">{detalle.observacion}</dd>
                  </>
                )}
              </div>

              {/* Líneas del asiento */}
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Líneas del asiento ({detalle.lineas.length})
                </h3>
                <span
                  className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${detalle.cuadrado ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                >
                  {detalle.cuadrado ? "Asiento cuadrado" : "Descuadre detectado"}
                </span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <Table className="w-full text-left border-collapse min-w-160">
                  <TableHeader>
                    <TableRow className="bg-slate-50/75 hover:bg-slate-50/75 text-slate-900">
                      <TableHead className="py-2.5 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px]">
                        Cuenta contable
                      </TableHead>
                      <TableHead className="py-2.5 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px]">
                        Descripción
                      </TableHead>
                      <TableHead className="py-2.5 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px] text-right">
                        Debe
                      </TableHead>
                      <TableHead className="py-2.5 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px] text-right">
                        Haber
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-slate-100 text-sm">
                    {detalle.lineas.map((linea) => (
                      <TableRow
                        key={linea.id}
                        className="hover:bg-slate-50/60 border-b border-slate-100"
                      >
                        <TableCell className="py-2.5 px-3 align-top">
                          <span className="font-bold text-red-700 tabular-nums">
                            {linea.cuentaCodigo}
                          </span>
                          <span className="block text-xs text-slate-600">
                            {linea.cuentaNombre}
                          </span>
                        </TableCell>
                        <TableCell className="py-2.5 px-3 text-slate-700 text-xs align-top">
                          {linea.descripcion || "—"}
                        </TableCell>
                        <TableCell className="py-2.5 px-3 text-right tabular-nums font-semibold text-slate-900 align-top">
                          {linea.debe > 0 ? formatearMoneda(linea.debe) : ""}
                        </TableCell>
                        <TableCell className="py-2.5 px-3 text-right tabular-nums font-semibold text-slate-900 align-top">
                          {linea.haber > 0 ? formatearMoneda(linea.haber) : ""}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-slate-50 hover:bg-slate-50 border-t-2 border-slate-200">
                      <TableCell
                        className="py-2.5 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px]"
                        colSpan={2}
                      >
                        Totales
                      </TableCell>
                      <TableCell className="py-2.5 px-3 text-right tabular-nums font-bold text-slate-900">
                        {formatearMoneda(detalle.totales.debe)}
                      </TableCell>
                      <TableCell className="py-2.5 px-3 text-right tabular-nums font-bold text-slate-900">
                        {formatearMoneda(detalle.totales.haber)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-4 rounded-lg bg-slate-900 text-white px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Total del asiento
                </span>
                <span className="text-lg font-bold tabular-nums">
                  {formatearMoneda(detalle.total)}
                </span>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

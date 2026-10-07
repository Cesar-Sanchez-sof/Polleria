"use client";

import { Fragment, type ReactNode } from "react";
import { AlertCircle, ExternalLink, Inbox, RefreshCw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  type DailyBookEntry,
} from "@/lib/services/daily-book.service";

interface Props {
  rows: DailyBookEntry[];
  loading: boolean;
  error: string | null;
  hasFilters: boolean;
  invalidRange: boolean;
  onOpenDetail: (id: number) => void;
  onRetry: () => void;
  onClearFilters: () => void;
}

/** Encabezado de columna del libro diario (sin orden: el orden siempre es cronológico). */
function Th({ children, align = "left" }: Readonly<{ children: ReactNode; align?: "left" | "right" }>) {
  return (
    <TableHead
      className={`py-3 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px] ${align === "right" ? "text-right" : ""}`}
    >
      {children}
    </TableHead>
  );
}

/**
 * Tabla del libro diario: cada asiento se muestra como un bloque con su
 * encabezado (fecha, número y concepto + totales) y sus líneas (cuenta
 * contable, descripción e importe en Debe o Haber).
 */
export function DailyJournalTable({
  rows,
  loading,
  error,
  hasFilters,
  invalidRange,
  onOpenDetail,
  onRetry,
  onClearFilters,
}: Readonly<Props>) {
  const skeleton = loading && rows.length === 0 && !error;
  const empty = !error && !loading && rows.length === 0 && !invalidRange;

  return (
    <div
      className={`w-full overflow-x-auto rounded-lg transition-opacity ${loading && rows.length > 0 ? "opacity-60" : ""}`}
    >
      <Table className="w-full text-left border-collapse min-w-175">
        <TableHeader>
          <TableRow className="text-slate-900 text-xs font-semibold bg-slate-50/75 hover:bg-slate-50/75 dark:bg-slate-800/75">
            <Th>Fecha</Th>
            <Th>Número</Th>
            <Th>Concepto (glosa)</Th>
            <Th>Cuenta contable</Th>
            <Th>Descripción</Th>
            <Th align="right">Debe</Th>
            <Th align="right">Haber</Th>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-slate-100 text-sm text-slate-900">
          {/* Cargando por primera vez */}
          {skeleton &&
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`} className="hover:bg-transparent">
                <TableCell className="py-3 px-3">
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell className="py-3 px-3">
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell className="py-3 px-3">
                  <Skeleton className="h-4 w-40" />
                </TableCell>
                <TableCell className="py-3 px-3">
                  <Skeleton className="h-4 w-44" />
                </TableCell>
                <TableCell className="py-3 px-3">
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell className="py-3 px-3">
                  <Skeleton className="h-4 w-20 ml-auto" />
                </TableCell>
                <TableCell className="py-3 px-3">
                  <Skeleton className="h-4 w-20 ml-auto" />
                </TableCell>
              </TableRow>
            ))}

          {/* Error de carga o de validación del periodo */}
          {error && !loading && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={7} className="py-10 text-center">
                <div className="flex flex-col items-center gap-3 text-slate-600">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                  <p className="text-sm font-semibold">{error}</p>
                  {!invalidRange && (
                    <Button
                      type="button"
                      onClick={onRetry}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Reintentar
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          )}

          {/* C11: sin asientos para el periodo seleccionado */}
          {empty && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={7} className="py-10 text-center">
                <div className="flex flex-col items-center gap-3 text-slate-500">
                  <Inbox className="w-8 h-8 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-700">
                    No se encontraron asientos para el periodo seleccionado
                  </p>
                  <p className="text-xs">
                    Ajusta las fechas inicial y final para ampliar el rango consultado.
                  </p>
                  {hasFilters && (
                    <Button
                      type="button"
                      onClick={onClearFilters}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      Limpiar filtros
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          )}

          {/* Asientos del periodo, cronológicamente */}
          {!error &&
            rows.map((entry) => (
              <Fragment key={entry.id}>
                {/* Encabezado del asiento: fecha, número, concepto y totales (C02, C05) */}
                <TableRow
                  onClick={() => onOpenDetail(entry.id)}
                  className="bg-slate-50/60 hover:bg-slate-100/70 transition-colors group cursor-pointer"
                  title="Ver detalle del asiento"
                >
                  <TableCell
                    rowSpan={entry.lineas.length + 1}
                    className="py-3 px-3 align-top tabular-nums font-medium text-slate-800 border-r border-slate-100"
                  >
                    {formatDate(entry.fecha)}
                  </TableCell>
                  <TableCell
                    rowSpan={entry.lineas.length + 1}
                    className="py-3 px-3 align-top font-semibold text-red-700 border-r border-slate-100"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {entry.numero}
                      <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-slate-400 transition-opacity" />
                    </span>
                  </TableCell>
                  <TableCell
                    rowSpan={entry.lineas.length + 1}
                    className="py-3 px-3 align-top text-slate-700 text-xs max-w-64 border-r border-slate-100"
                  >
                    <span className="line-clamp-2">{entry.concepto}</span>
                    <span className="block text-[10px] text-slate-400 mt-1">
                      {entry.diario}
                    </span>
                  </TableCell>
                  <TableCell colSpan={2} className="py-3 px-3 text-right">
                    <span className="inline-flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">
                        {entry.lineas.length} cuenta
                        {entry.lineas.length === 1 ? "" : "s"}
                      </span>
                      <Badge
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border-none shadow-none ${entry.estado === "Registrado" ? "bg-emerald-100/80 text-emerald-700" : "bg-rose-100/80 text-rose-700"}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${entry.estado === "Registrado" ? "bg-emerald-600" : "bg-rose-600"}`}
                        ></span>
                        {entry.estado}
                      </Badge>
                      <Badge
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border-none shadow-none ${entry.cuadrado ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                      >
                        {entry.cuadrado ? "Cuadrado" : "Descuadre"}
                      </Badge>
                    </span>
                  </TableCell>
                  <TableCell className="py-3 px-3 text-right tabular-nums font-bold text-slate-900">
                    {formatCurrency(entry.totales.debe)}
                  </TableCell>
                  <TableCell className="py-3 px-3 text-right tabular-nums font-bold text-slate-900">
                    {formatCurrency(entry.totales.haber)}
                  </TableCell>
                </TableRow>

                {/* Líneas del asiento: cuenta, descripción e importe (C03, C04) */}
                {entry.lineas.map((line) => (
                  <TableRow
                    key={line.id}
                    onClick={() => onOpenDetail(entry.id)}
                    className="hover:bg-(--color-background) transition-colors cursor-pointer"
                    title="Ver detalle del asiento"
                  >
                    <TableCell className="py-2.5 px-3 align-top">
                      <span className="font-bold text-red-700 tabular-nums">
                        {line.cuentaCodigo}
                      </span>
                      <span className="block text-xs text-slate-600">
                        {line.cuentaNombre}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5 px-3 text-slate-700 text-xs align-top">
                      {line.descripcion || "—"}
                    </TableCell>
                    <TableCell className="py-2.5 px-3 text-right tabular-nums font-semibold text-slate-900 align-top">
                      {line.debe > 0 ? formatCurrency(line.debe) : ""}
                    </TableCell>
                    <TableCell className="py-2.5 px-3 text-right tabular-nums font-semibold text-slate-900 align-top">
                      {line.haber > 0 ? formatCurrency(line.haber) : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}

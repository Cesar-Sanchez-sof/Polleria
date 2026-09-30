"use client";

import type { ReactNode } from "react";
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
  formatearFecha,
  formatearMoneda,
  type LibroMayor,
} from "@/lib/services/mayor.service";

interface Props {
  libro: LibroMayor | null;
  cargando: boolean;
  error: string | null;
  /** Mensaje cuando no hay cuenta seleccionada; `null` = no aplica. */
  sinCuenta: string | null;
  hayFiltros: boolean;
  rangoInvalido: boolean;
  onAbrirDetalle: (idAsiento: number) => void;
  onReintentar: () => void;
  onLimpiarFiltros: () => void;
}

/** Encabezado de columna (el orden siempre es cronológico: más antiguo primero). */
function Th({
  children,
  align = "left",
}: Readonly<{ children: ReactNode; align?: "left" | "right" }>) {
  return (
    <TableHead
      className={`py-3 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px] ${align === "right" ? "text-right" : ""}`}
    >
      {children}
    </TableHead>
  );
}

/** Celda de importe: deja vacía la columna que no corresponde al movimiento. */
function Importe({ valor }: Readonly<{ valor: number }>) {
  return (
    <TableCell className="py-2.5 px-3 text-right tabular-nums font-semibold text-slate-900 align-top">
      {valor > 0 ? formatearMoneda(valor) : ""}
    </TableCell>
  );
}

/** Celda de saldo: importe con su color y la indicación deudor/acreedor (C08). */
function Saldo({ valor, tipo }: Readonly<{ valor: number; tipo: "deudor" | "acreedor" | null }>) {
  return (
    <TableCell className="py-2.5 px-3 text-right align-top">
      <span
        className={`block tabular-nums font-bold ${valor < 0 ? "text-rose-600" : "text-slate-900"}`}
      >
        {formatearMoneda(valor)}
      </span>
      <span className="block text-[10px] uppercase tracking-wide text-slate-400">
        {tipo ?? ""}
      </span>
    </TableCell>
  );
}

/**
 * Tabla del libro mayor: la cuenta consultada (C02) y sus movimientos
 * cronológicos con fecha, asiento, glosa, módulo/referencia, importe en Debe o
 * Haber (C07), saldo corriente (C08) y totales del periodo (C11).
 */
export function TablaMayor({
  libro,
  cargando,
  error,
  sinCuenta,
  hayFiltros,
  rangoInvalido,
  onAbrirDetalle,
  onReintentar,
  onLimpiarFiltros,
}: Readonly<Props>) {
  const movimientos = libro?.movimientos ?? [];
  const esqueleto = cargando && !libro && !error;
  const sinRegistros =
    !error && !cargando && !sinCuenta && libro !== null && movimientos.length === 0;
  const estadoSinCuenta = !error && !cargando && sinCuenta !== null;
  const haySaldoAnterior = libro !== null && Math.abs(libro.saldoAnterior) >= 0.005;

  return (
    <div
      className={`w-full overflow-x-auto rounded-lg transition-opacity ${cargando && libro ? "opacity-60" : ""}`}
    >
      {/* C02: cuenta contable consultada */}
      {libro && (
        <div className="flex flex-wrap items-center gap-3 bg-slate-50/70 rounded-lg px-3 py-2.5 mb-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Cuenta contable
          </span>
          <span className="text-sm font-bold text-red-700 tabular-nums">
            {libro.cuenta.codigo}
          </span>
          <span className="text-sm font-semibold text-slate-900">
            {libro.cuenta.nombre}
          </span>
          <Badge className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border-none shadow-none bg-slate-100 text-slate-600">
            {libro.cuenta.tipo}
          </Badge>
          <span className="ml-auto text-xs text-slate-500">
            <span className="tabular-nums font-semibold text-slate-900">
              {libro.totales.movimientos}
            </span>{" "}
            movimiento{libro.totales.movimientos === 1 ? "" : "s"} · Saldo final:{" "}
            <span
              className={`tabular-nums font-semibold ${libro.saldoFinal < 0 ? "text-rose-600" : "text-slate-900"}`}
            >
              {formatearMoneda(libro.saldoFinal)}
            </span>
          </span>
        </div>
      )}

      <Table className="w-full text-left border-collapse min-w-175">
        <TableHeader>
          <TableRow className="text-slate-900 text-xs font-semibold bg-slate-50/75 hover:bg-slate-50/75">
            <Th>Fecha</Th>
            <Th>Asiento</Th>
            <Th>Glosa</Th>
            <Th>Módulo / referencia</Th>
            <Th align="right">Debe</Th>
            <Th align="right">Haber</Th>
            <Th align="right">Saldo</Th>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-slate-100 text-sm text-slate-900">
          {/* Cargando por primera vez */}
          {esqueleto &&
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`} className="hover:bg-transparent">
                <TableCell className="py-3 px-3">
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell className="py-3 px-3">
                  <Skeleton className="h-4 w-32" />
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
                <TableCell className="py-3 px-3">
                  <Skeleton className="h-4 w-24 ml-auto" />
                </TableCell>
              </TableRow>
            ))}

          {/* Error de carga o de validación del periodo */}
          {error && !cargando && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={7} className="py-10 text-center">
                <div className="flex flex-col items-center gap-3 text-slate-600">
                  <AlertCircle className="w-8 h-8 text-rose-600" />
                  <p className="text-sm font-semibold">{error}</p>
                  {!rangoInvalido && (
                    <Button
                      type="button"
                      onClick={onReintentar}
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

          {/* Sin cuenta contable seleccionada / plan contable no disponible */}
          {estadoSinCuenta && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={7} className="py-10 text-center">
                <div className="flex flex-col items-center gap-3 text-slate-500">
                  <Inbox className="w-8 h-8 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-700">{sinCuenta}</p>
                </div>
              </TableCell>
            </TableRow>
          )}

          {/* C14: sin movimientos para la cuenta y periodo seleccionado */}
          {sinRegistros && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={7} className="py-10 text-center">
                <div className="flex flex-col items-center gap-3 text-slate-500">
                  <Inbox className="w-8 h-8 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-700">
                    No existen movimientos para la cuenta y periodo seleccionado
                  </p>
                  <p className="text-xs">
                    Ajusta las fechas inicial y final para ampliar el rango consultado.
                  </p>
                  {hayFiltros && (
                    <Button
                      type="button"
                      onClick={onLimpiarFiltros}
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

          {/* Saldo de la cuenta antes del periodo consultado */}
          {haySaldoAnterior && (
            <TableRow className="bg-slate-50/70 hover:bg-slate-50/70">
              <TableCell
                colSpan={4}
                className="py-2.5 px-3 text-xs font-semibold text-slate-500 italic"
              >
                Saldo anterior al periodo
              </TableCell>
              <TableCell className="py-2.5 px-3" />
              <TableCell className="py-2.5 px-3" />
              <Saldo
                valor={libro!.saldoAnterior}
                tipo={libro!.saldoAnterior > 0 ? "deudor" : "acreedor"}
              />
            </TableRow>
          )}

          {/* Movimientos cronológicos de la cuenta (C03-C08, C12) */}
          {!error &&
            !sinCuenta &&
            movimientos.map((mov) => (
              <TableRow
                key={mov.id}
                onClick={() => onAbrirDetalle(mov.idAsiento)}
                className="hover:bg-(--color-background) transition-colors cursor-pointer group"
                title="Ver detalle del asiento contable"
              >
                <TableCell className="py-2.5 px-3 align-top tabular-nums font-medium text-slate-800">
                  {formatearFecha(mov.fecha)}
                </TableCell>
                <TableCell className="py-2.5 px-3 align-top">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-red-700">
                    {mov.numero}
                    <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-slate-400 transition-opacity" />
                  </span>
                  {mov.estado === "Anulado" && (
                    <span className="mt-1 inline-block rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                      Anulado
                    </span>
                  )}
                </TableCell>
                <TableCell className="py-2.5 px-3 text-slate-700 text-xs align-top max-w-72">
                  <span className="line-clamp-2">{mov.descripcion || mov.glosa}</span>
                  {mov.descripcion && mov.glosa && mov.descripcion !== mov.glosa && (
                    <span className="block text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                      {mov.glosa}
                    </span>
                  )}
                </TableCell>
                <TableCell className="py-2.5 px-3 text-xs align-top">
                  <span className="text-slate-700">{mov.modulo}</span>
                  {mov.referencia && (
                    <span className="block text-[10px] text-slate-400 mt-0.5">
                      {mov.referencia}
                    </span>
                  )}
                </TableCell>
                <Importe valor={mov.debe} />
                <Importe valor={mov.haber} />
                <Saldo valor={mov.saldo} tipo={mov.tipoSaldo} />
              </TableRow>
            ))}

          {/* C11: totales de los movimientos consultados */}
          {libro && movimientos.length > 0 && !error && (
            <TableRow className="bg-slate-50/70 hover:bg-slate-50/70 font-bold">
              <TableCell
                colSpan={4}
                className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-600"
              >
                Total de los movimientos consultados (
                <span className="tabular-nums">{libro.totales.movimientos}</span>)
              </TableCell>
              <TableCell className="py-3 px-3 text-right tabular-nums text-slate-900">
                {formatearMoneda(libro.totales.debe)}
              </TableCell>
              <TableCell className="py-3 px-3 text-right tabular-nums text-slate-900">
                {formatearMoneda(libro.totales.haber)}
              </TableCell>
              <TableCell className="py-3 px-3 text-right align-top">
                <span
                  className={`block tabular-nums font-bold ${libro.saldoFinal < 0 ? "text-rose-600" : "text-slate-900"}`}
                >
                  {formatearMoneda(libro.saldoFinal)}
                </span>
                <span className="block text-[10px] uppercase tracking-wide text-slate-400">
                  {libro.saldoFinal > 0.004
                    ? "Deudor"
                    : libro.saldoFinal < -0.004
                      ? "Acreedor"
                      : ""}
                </span>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

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
  formatDate,
  formatCurrency,
  type GeneralLedger,
  type BalanceType,
} from "@/lib/services/general-ledger.service";

interface Props {
  ledger: GeneralLedger | null;
  loading: boolean;
  error: string | null;
  /** Message shown when no account is selected; `null` means not applicable. */
  noAccountMessage: string | null;
  hasFilters: boolean;
  invalidRange: boolean;
  onOpenDetail: (entryId: number) => void;
  onRetry: () => void;
  onClearFilters: () => void;
}

/** Column header component (chronological order: oldest first). */
function Th({
  children,
  align = "left",
}: Readonly<{ children: ReactNode; align?: "left" | "right" }>) {
  return (
    <TableHead
      className={`py-3 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px] ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {children}
    </TableHead>
  );
}

/** Amount cell – leaves blank the column that does not correspond to the movement. */
function Amount({ value }: Readonly<{ value: number }>) {
  return (
    <TableCell className="py-2.5 px-3 text-right tabular-nums font-semibold text-slate-900 align-top">
      {value > 0 ? formatCurrency(value) : ""}
    </TableCell>
  );
}

/** Balance cell – amount with colour and debtor/creditor indication. */
function Balance({ value, type }: Readonly<{ value: number; type: BalanceType }>) {
  return (
    <TableCell className="py-2.5 px-3 text-right align-top">
      <span
        className={`block tabular-nums font-bold ${value < 0 ? "text-rose-600" : "text-slate-900"}`}
      >
        {formatCurrency(value)}
      </span>
      <span className="block text-[10px] uppercase tracking-wide text-slate-400">
        {type === "deudor" ? "Debtor" : type === "acreedor" ? "Creditor" : ""}
      </span>
      <span className="block text-[10px] uppercase tracking-wide text-slate-400">
        {type ?? ""}
      </span>
    </TableCell>
  );
}

/**
 * Ledger table: the consulted account (C02) and its chronological movements with date, entry, description, module/reference, debit or credit (C07), running balance (C08) and period totals (C11).
 */
export function LedgerTable({
  ledger,
  loading,
  error,
  noAccountMessage,
  hasFilters,
  invalidRange,
  onOpenDetail,
  onRetry,
  onClearFilters,
}: Readonly<Props>) {
  const movements = ledger?.movimientos ?? [];

  const skeleton = loading && !ledger && !error;
  const noRecords =
    !error && !loading && !noAccountMessage && ledger !== null && movements.length === 0;
  const noAccountState = !error && !loading && noAccountMessage !== null;
  const hasPreviousBalance = ledger !== null && Math.abs(ledger.saldoAnterior) >= 0.005;

  return (
    <div className={`w-full overflow-x-auto rounded-lg transition-opacity ${loading && ledger ? "opacity-60" : ""}`}>
      {/* C02: consulted account */}
      {ledger && (
        <div className="flex flex-wrap items-center gap-3 bg-slate-50/70 rounded-lg px-3 py-2.5 mb-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Account</span>
          <span className="text-sm font-bold text-red-700 tabular-nums">{ledger.cuenta.codigo}</span>
          <span className="text-sm font-semibold text-slate-900">{ledger.cuenta.nombre}</span>
          <Badge className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border-none shadow-none bg-slate-100 text-slate-600">
            {ledger.cuenta.tipo}
          </Badge>
          <span className="ml-auto text-xs text-slate-500">
            <span className="tabular-nums font-semibold text-slate-900">{ledger.totales.movimientos}</span>{" "}
            movement{ledger.totales.movimientos === 1 ? "" : "s"} · Final balance:{" "}
            <span className={`block tabular-nums font-semibold ${ledger.saldoFinal < 0 ? "text-rose-600" : "text-slate-900"}`}>
              {formatCurrency(ledger.saldoFinal)}
            </span>
          </span>
        </div>
      )}

      <Table className="w-full text-left border-collapse min-w-175">
        <TableHeader>
          <TableRow className="text-slate-900 text-xs font-semibold bg-slate-50/75 hover:bg-slate-50/75">
            <Th>Date</Th>
            <Th>Entry</Th>
            <Th>Description</Th>
            <Th>Module / Reference</Th>
            <Th align="right">Debit</Th>
            <Th align="right">Credit</Th>
            <Th align="right">Balance</Th>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-slate-100 text-sm text-slate-900">
          {/* Initial loading skeleton */}
          {skeleton &&
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={`skeleton-${i}`} className="hover:bg-transparent">
                <TableCell className="py-3 px-3"><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell className="py-3 px-3"><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell className="py-3 px-3"><Skeleton className="h-4 w-44" /></TableCell>
                <TableCell className="py-3 px-3"><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell className="py-3 px-3"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                <TableCell className="py-3 px-3"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                <TableCell className="py-3 px-3"><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
              </TableRow>
            ))}


          {/* Loading or validation error */}
          {error && !loading && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={7} className="py-10 text-center">
                <div className="flex flex-col items-center gap-3 text-slate-600">
                  <AlertCircle className="w-8 h-8 text-rose-600" />
                  <p className="text-sm font-semibold">{error}</p>
                  {!invalidRange && (
                    <Button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold cursor-pointer">
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retry
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          )}

          {/* No account selected / accounting plan unavailable */}
          {noAccountState && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={7} className="py-10 text-center">
                <div className="flex flex-col items-center gap-3 text-slate-500">
                  <Inbox className="w-8 h-8 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-700">{noAccountMessage}</p>
                </div>
              </TableCell>
            </TableRow>
          )}

          {/* No movements for the selected account and period */}
          {noRecords && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={7} className="py-10 text-center">
                <div className="flex flex-col items-center gap-3 text-slate-500">
                  <Inbox className="w-8 h-8 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-700">No movements exist for the selected account and period</p>
                  <p className="text-xs">Adjust the start and end dates to widen the queried range.</p>
                  {hasFilters && (
                    <Button type="button" onClick={onClearFilters} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                      Clear filters
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          )}

          {/* Previous balance before the queried period */}
          {hasPreviousBalance && (
            <TableRow className="bg-slate-50/70 hover:bg-slate-50/70">
              <TableCell colSpan={4} className="py-2.5 px-3 text-xs font-semibold text-slate-500 italic">Balance before period</TableCell>
              <TableCell className="py-2.5 px-3" />
              <TableCell className="py-2.5 px-3" />
              <Balance value={ledger!.saldoAnterior} type={ledger!.saldoAnterior > 0 ? "deudor" : "acreedor"} />
            </TableRow>
          )}

          {/* Chronological movements */}
          {!error && !noAccountMessage && movements.map((mov) => (
            <TableRow key={mov.id} onClick={() => onOpenDetail(mov.idAsiento)} className="hover:bg-(--color-background) transition-colors cursor-pointer group" title="View entry detail">
              <TableCell className="py-2.5 px-3 align-top tabular-nums font-medium text-slate-800">{formatDate(mov.fecha)}</TableCell>
              <TableCell className="py-2.5 px-3 align-top">
                <span className="inline-flex items-center gap-1.5 font-semibold text-red-700">
                  {mov.numero}
                  <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-slate-400 transition-opacity" />
                </span>
                {mov.estado === "Anulado" && (
                  <span className="mt-1 inline-block rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">Cancelled</span>
                )}
              </TableCell>
              <TableCell className="py-2.5 px-3 text-slate-700 text-xs align-top max-w-72">
                <span className="line-clamp-2">{mov.descripcion || mov.glosa}</span>
                {mov.descripcion && mov.glosa && mov.descripcion !== mov.glosa && (
                  <span className="block text-[10px] text-slate-400 mt-0.5 line-clamp-1">{mov.glosa}</span>
                )}
              </TableCell>
              <TableCell className="py-2.5 px-3 text-xs align-top">
                <span className="text-slate-700">{mov.modulo}</span>
                {mov.referencia && (
                  <span className="block text-[10px] text-slate-400 mt-0.5">{mov.referencia}</span>
                )}
              </TableCell>
              <Amount value={mov.debe} />
              <Amount value={mov.haber} />
              <Balance value={mov.saldo} type={mov.tipoSaldo} />
            </TableRow>
          ))}

          {/* Totals */}
          {ledger && movements.length > 0 && !error && (
            <TableRow className="bg-slate-50/70 hover:bg-slate-50/70 font-bold">
              <TableCell colSpan={4} className="py-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-600">
                Total of consulted movements (<span className="tabular-nums">{ledger.totales.movimientos}</span>)
              </TableCell>
              <TableCell className="py-3 px-3 text-right tabular-nums text-slate-900">{formatCurrency(ledger.totales.debe)}</TableCell>
              <TableCell className="py-3 px-3 text-right tabular-nums text-slate-900">{formatCurrency(ledger.totales.haber)}</TableCell>
              <TableCell className="py-3 px-3 text-right align-top">
                <span className={`block tabular-nums font-bold ${ledger.saldoFinal < 0 ? "text-rose-600" : "text-slate-900"}`}>
                  {formatCurrency(ledger.saldoFinal)}
                </span>
                <span className="block text-[10px] uppercase tracking-wide text-slate-400">
                  {ledger.saldoFinal > 0.004 ? "Debtor" : ledger.saldoFinal < -0.004 ? "Creditor" : ""}
                </span>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

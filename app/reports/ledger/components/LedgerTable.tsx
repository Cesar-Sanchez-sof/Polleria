"use client";

import { Inbox, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { PrimaryCell } from "@/components/shared/PrimaryCell";
import { Tag } from "@/components/shared/TagCell";
import {
  formatDate,
  formatCurrency,
  type GeneralLedger,
  type GeneralLedgerMovement,
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

/** Amount with colour and debtor/creditor indication. */
function BalanceValue({ value, type }: Readonly<{ value: number; type: BalanceType }>) {
  return (
    <>
      <span className={`block font-bold tabular-nums ${value < 0 ? "text-rose-600" : "text-slate-900"}`}>
        {formatCurrency(value)}
      </span>
      <span className="block text-[10px] uppercase tracking-wide text-slate-400">
        {type === "deudor" ? "Deudor" : type === "acreedor" ? "Acreedor" : ""}
      </span>
    </>
  );
}

/**
 * Ledger table built on the shared DataTable: the consulted account (C02) and its chronological
 * movements with date, entry, description, module/reference, debit or credit (C07), running
 * balance (C08), the balance before the period and the period totals (C11).
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
  const movements = noAccountMessage ? [] : (ledger?.movements ?? []);
  const hasPreviousBalance = ledger !== null && Math.abs(ledger.previousBalance) >= 0.005;

  const columns: DataTableColumn<GeneralLedgerMovement>[] = [
    {
      key: "date",
      header: "Fecha",
      cellClassName: "align-top tabular-nums font-medium text-slate-800",
      cell: (movement) => formatDate(movement.date),
    },
    {
      key: "entry",
      header: "Asiento",
      cellClassName: "align-top",
      cell: (movement) => (
        <div>
          <PrimaryCell
            title={movement.number}
            onClick={() => onOpenDetail(movement.entryId)}
            showLinkIcon
          />
          {movement.status === "Anulado" && (
            <Tag tone="rose" size="sm" className="mt-1">
              Anulado
            </Tag>
          )}
        </div>
      ),
    },
    {
      key: "description",
      header: "Descripción",
      width: "max-w-72",
      cellClassName: "align-top text-xs text-slate-700",
      cell: (movement) => (
        <>
          {ledger && movement.accountCode !== ledger.account.code && (
            <span className="mb-0.5 block text-[10px] font-semibold text-red-700">
              {movement.accountCode} · {movement.accountName}
            </span>
          )}
          <span className="line-clamp-2">{movement.description || movement.entryDescription}</span>
          {movement.description && movement.entryDescription && movement.description !== movement.entryDescription && (
            <span className="mt-0.5 line-clamp-1 block text-[10px] text-slate-400">{movement.entryDescription}</span>
          )}
        </>
      ),
    },
    {
      key: "module",
      header: "Módulo / Referencia",
      cellClassName: "align-top text-xs",
      cell: (movement) => (
        <>
          <span className="text-slate-700">{movement.module}</span>
          {movement.reference && <span className="mt-0.5 block text-[10px] text-slate-400">{movement.reference}</span>}
        </>
      ),
    },
    {
      key: "debit",
      header: "Debe",
      align: "right",
      cellClassName: "align-top font-semibold tabular-nums text-slate-900",
      cell: (movement) => (movement.debit > 0 ? formatCurrency(movement.debit) : ""),
    },
    {
      key: "credit",
      header: "Haber",
      align: "right",
      cellClassName: "align-top font-semibold tabular-nums text-slate-900",
      cell: (movement) => (movement.credit > 0 ? formatCurrency(movement.credit) : ""),
    },
    {
      key: "balance",
      header: "Saldo",
      align: "right",
      cellClassName: "align-top",
      cell: (movement) => <BalanceValue value={movement.balance} type={movement.balanceType} />,
    },
  ];

  const previousBalanceRow = hasPreviousBalance ? (
    <TableRow className="bg-slate-50/70 hover:bg-slate-50/70">
      <TableCell colSpan={4} className="px-3 py-2.5 text-xs font-semibold italic text-slate-500">
        Saldo anterior al periodo
      </TableCell>
      <TableCell className="px-3 py-2.5" />
      <TableCell className="px-3 py-2.5" />
      <TableCell className="px-3 py-2.5 text-right align-top">
        <BalanceValue
          value={ledger!.previousBalance}
          type={ledger!.previousBalance > 0 ? "deudor" : "acreedor"}
        />
      </TableCell>
    </TableRow>
  ) : undefined;

  const totalsRow = ledger ? (
    <TableRow className="bg-slate-50/70 font-bold hover:bg-slate-50/70">
      <TableCell colSpan={4} className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">
        Total de movimientos consultados (<span className="tabular-nums">{ledger.totals.movements}</span>)
      </TableCell>
      <TableCell className="px-3 py-3 text-right tabular-nums text-slate-900">{formatCurrency(ledger.totals.debit)}</TableCell>
      <TableCell className="px-3 py-3 text-right tabular-nums text-slate-900">{formatCurrency(ledger.totals.credit)}</TableCell>
      <TableCell className="px-3 py-3 text-right align-top">
        <BalanceValue
          value={ledger.finalBalance}
          type={ledger.finalBalance > 0.004 ? "deudor" : ledger.finalBalance < -0.004 ? "acreedor" : null}
        />
      </TableCell>
    </TableRow>
  ) : undefined;

  const emptyState = noAccountMessage
    ? { icon: <Inbox className="h-8 w-8" />, title: noAccountMessage }
    : {
        icon: <Inbox className="h-8 w-8" />,
        title: "No hay movimientos para la cuenta y el periodo seleccionados",
        description: "Ajusta las fechas inicial y final para ampliar el rango consultado.",
        action: hasFilters ? (
          <Button
            type="button"
            onClick={onClearFilters}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <X className="h-3.5 w-3.5" />
            Limpiar filtros
          </Button>
        ) : undefined,
      };

  return (
    <div>
      {/* C02: consulted account */}
      {ledger && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50/70 px-3 py-2.5 dark:bg-slate-800/70">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cuenta</span>
          <span className="text-sm font-bold tabular-nums text-red-700">{ledger.account.code}</span>
          <span className="text-sm font-semibold text-slate-900">{ledger.account.name}</span>
          <Badge className="inline-flex items-center rounded-full border-none bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 shadow-none">
            {ledger.account.type}
          </Badge>
          <span className="ml-auto text-xs text-slate-500">
            <span className="font-semibold tabular-nums text-slate-900">{ledger.totals.movements}</span>{" "}
            movimiento{ledger.totals.movements === 1 ? "" : "s"} · Saldo final:{" "}
            <span className={`block font-semibold tabular-nums ${ledger.finalBalance < 0 ? "text-rose-600" : "text-slate-900"}`}>
              {formatCurrency(ledger.finalBalance)}
            </span>
          </span>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={movements}
        rowKey={(movement) => movement.id}
        density="compact"
        enableCard={false}
        loading={loading}
        loadingMode="auto"
        skeletonRows={6}
        error={error}
        onRetry={invalidRange ? undefined : onRetry}
        onRowClick={(movement) => onOpenDetail(movement.entryId)}
        rowTitle="Ver detalle del asiento"
        prependRows={previousBalanceRow}
        appendRows={totalsRow}
        emptyState={emptyState}
      />
    </div>
  );
}

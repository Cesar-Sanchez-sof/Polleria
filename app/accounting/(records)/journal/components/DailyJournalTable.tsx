"use client";

import { useMemo } from "react";
import { ExternalLink, Inbox, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Tag } from "@/components/shared/TagCell";
import {
  formatDate,
  formatCurrency,
  formatDateTimePeru,
  formatTimePeru,
  type DailyBookEntry,
  type DailyBookLine,
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

/** Una línea del asiento junto al asiento al que pertenece (el DataTable agrupa por asiento). */
interface JournalLineRow {
  entry: DailyBookEntry;
  line: DailyBookLine;
}

/**
 * Libro diario: cada asiento es un grupo con su encabezado (fecha, número, concepto,
 * estado y totales) y sus líneas (cuenta contable, descripción e importe en Debe o Haber).
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
  const lineRows = useMemo<JournalLineRow[]>(
    () => rows.flatMap((entry) => entry.lines.map((line) => ({ entry, line }))),
    [rows],
  );

  const columns: DataTableColumn<JournalLineRow>[] = [
    {
      key: "account",
      header: "Cuenta contable",
      width: "min-w-[240px]",
      cell: ({ line }) => (
        <div>
          <span className="font-bold tabular-nums text-red-700">{line.accountCode}</span>
          <span className="block text-xs text-slate-600">{line.accountName}</span>
        </div>
      ),
    },
    {
      key: "description",
      header: "Descripción",
      width: "min-w-[200px]",
      cellClassName: "text-xs text-slate-700",
      cell: ({ line }) => line.description || "—",
    },
    {
      key: "debit",
      header: "Debe",
      align: "right",
      width: "w-36",
      cellClassName: "tabular-nums font-semibold text-slate-900",
      cell: ({ line }) => (line.debit > 0 ? formatCurrency(line.debit) : ""),
    },
    {
      key: "credit",
      header: "Haber",
      align: "right",
      width: "w-36",
      cellClassName: "tabular-nums font-semibold text-slate-900",
      cell: ({ line }) => (line.credit > 0 ? formatCurrency(line.credit) : ""),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={lineRows}
      rowKey={({ line }) => line.id}
      enableCard={false}
      enableSorting={false}
      density="compact"
      loading={loading}
      loadingMode="auto"
      skeletonRows={5}
      error={error}
      onRetry={invalidRange ? undefined : onRetry}
      onRowClick={({ entry }) => onOpenDetail(entry.id)}
      rowTitle="Ver detalle del asiento"
      groupBy={({ entry }) => entry.id}
      renderGroupHeader={(_, group) => {
        const entry = group[0].entry;
        return (
          <button
            type="button"
            onClick={() => onOpenDetail(entry.id)}
            title="Ver detalle del asiento"
            className="group/entry flex w-full cursor-pointer flex-wrap items-center gap-x-4 gap-y-1.5 text-left"
          >
            <div className="flex flex-col">
              <span className="tabular-nums text-sm font-medium text-slate-800">{formatDate(entry.date)}</span>
              {entry.createdAt && (
                <span
                  className="text-[10px] text-slate-400 tabular-nums font-normal"
                  title={`Creado: ${formatDateTimePeru(entry.createdAt)}`}
                >
                  {formatTimePeru(entry.createdAt)}
                </span>
              )}
            </div>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-700">
              {entry.number}
              <ExternalLink className="h-3.5 w-3.5 text-slate-400 opacity-0 transition-opacity group-hover/entry:opacity-100" />
            </span>
            <span className="min-w-0 flex-1 basis-64 text-xs text-slate-700">
              <span className="line-clamp-2">{entry.concept}</span>
              <span className="block text-[10px] text-slate-400">{entry.daily}</span>
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-slate-400">
                {entry.lines.length} cuenta{entry.lines.length === 1 ? "" : "s"}
              </span>
              <StatusBadge tone={entry.status === "Registrado" ? "success" : "danger"} size="sm">
                {entry.status}
              </StatusBadge>
              <Tag tone={entry.balanced ? "emerald" : "amber"} size="sm">
                {entry.balanced ? "Cuadrado" : "Descuadre"}
              </Tag>
            </span>
            <span className="ml-auto flex items-center gap-4 text-sm font-bold tabular-nums text-slate-900">
              <span>
                <span className="mr-1 text-[10px] font-semibold uppercase text-slate-400">Debe</span>
                {formatCurrency(entry.totals.debit)}
              </span>
              <span>
                <span className="mr-1 text-[10px] font-semibold uppercase text-slate-400">Haber</span>
                {formatCurrency(entry.totals.credit)}
              </span>
            </span>
          </button>
        );
      }}
      emptyState={
        invalidRange
          ? undefined
          : {
              icon: <Inbox className="h-7 w-7" />,
              title: "No se encontraron asientos para el periodo seleccionado",
              description: "Ajusta las fechas inicial y final para ampliar el rango consultado.",
              action: hasFilters ? (
                <Button type="button" size="sm" variant="outline" onClick={onClearFilters} className="gap-1.5 text-xs">
                  <X className="h-3.5 w-3.5" />
                  Limpiar filtros
                </Button>
              ) : undefined,
            }
      }
    />
  );
}

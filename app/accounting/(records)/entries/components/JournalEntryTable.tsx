"use client";

import { Inbox, MoreVertical, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn, type DataTableRowKey } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  formatDate,
  formatCurrency,
  formatDateTimePeru,
  formatTimePeru,
  type JournalEntrySummary,
  type JournalEntrySort,
  type SortDirection,
} from "@/lib/services/journal-entries.service";

interface Props {
  rows: JournalEntrySummary[];
  loading: boolean;
  error: string | null;
  hasFilters: boolean;
  order: { field: JournalEntrySort; dir: SortDirection };
  pageSize: number;
  selectedIds: number[];
  onSort: (field: JournalEntrySort) => void;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: number, checked: boolean) => void;
  onOpenDetail: (id: number) => void;
  onRetry: () => void;
  onClearFilters: () => void;
}

/**
 * Journal entry list built on the shared DataTable: server-side sorting and pagination stay in the
 * page, the table only draws the sort indicators, the selection and the loading/error/empty states.
 */
export function JournalEntryTable({
  rows,
  loading,
  error,
  hasFilters,
  order,
  pageSize,
  selectedIds,
  onSort,
  onSelectAll,
  onSelectRow,
  onOpenDetail,
  onRetry,
  onClearFilters,
}: Readonly<Props>) {
  const columns: DataTableColumn<JournalEntrySummary>[] = [
    {
      key: "fecha",
      header: "Fecha contable",
      sortable: true,
      cellClassName: "tabular-nums font-medium text-slate-800",
      cell: (row) => (
        <div>
          <span>{formatDate(row.date)}</span>
          {row.createdAt && (
            <span
              className="block text-[11px] font-normal text-slate-400"
              title={`Creado: ${formatDateTimePeru(row.createdAt)}`}
            >
              {formatTimePeru(row.createdAt)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "numero",
      header: "Número",
      sortable: true,
      primary: {
        title: (row) => row.number,
        onClick: (row) => void onOpenDetail(row.id),
        showLinkIcon: true,
      },
    },
    {
      key: "concept",
      header: "Concepto (glosa)",
      cellClassName: "max-w-72 text-xs text-slate-700",
      cell: (row) => <span className="line-clamp-2">{row.concept}</span>,
    },
    {
      key: "diario",
      header: "Diario",
      sortable: true,
      cellClassName: "font-medium text-slate-600",
      cell: (row) => row.daily,
    },
    {
      key: "responsible",
      header: "Responsable",
      cellClassName: "text-xs text-slate-500",
      cell: (row) => row.responsible ?? "—",
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      sortable: true,
      cellClassName: "tabular-nums font-bold text-slate-900",
      cell: (row) => formatCurrency(row.total),
    },
    {
      key: "estado",
      header: "Estado",
      align: "center",
      sortable: true,
      cell: (row) => (
        <StatusBadge tone={row.status === "Registrado" ? "success" : "danger"} size="sm">
          {row.status}
        </StatusBadge>
      ),
    },
    {
      key: "options",
      header: "",
      align: "center",
      width: "w-12",
      headerIcon: <SlidersHorizontal />,
      cell: (row) => (
        <div onClick={(event) => event.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 cursor-pointer rounded p-1 text-slate-400 opacity-0 transition-opacity hover:text-slate-700 group-hover:opacity-100"
            type="button"
            title="Opciones"
            onClick={() => void onOpenDetail(row.id)}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const handleSelection = (keys: DataTableRowKey[]) => {
    const added = keys.filter((key) => !selectedIds.includes(key as number));
    const removed = selectedIds.filter((id) => !keys.includes(id));
    if (added.length > 1) onSelectAll(true);
    else if (removed.length > 1) onSelectAll(false);
    else if (added.length === 1) onSelectRow(added[0] as number, true);
    else if (removed.length === 1) onSelectRow(removed[0], false);
  };

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      density="compact"
      enableCard={false}
      selectable
      selectedKeys={selectedIds}
      onSelectionChange={handleSelection}
      sort={{ key: order.field, direction: order.dir }}
      manualSort
      onSortChange={(_, key) => onSort(key as JournalEntrySort)}
      loading={loading}
      loadingMode="auto"
      skeletonRows={Math.min(pageSize, 8)}
      error={error}
      onRetry={onRetry}
      onRowClick={(row) => void onOpenDetail(row.id)}
      rowTitle="Ver detalle del asiento"
      emptyState={{
        icon: <Inbox className="h-8 w-8" />,
        title: "No se encontraron asientos con los filtros seleccionados",
        description: "Ajusta el rango de fechas, el diario, el estado o la búsqueda.",
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
      }}
    />
  );
}

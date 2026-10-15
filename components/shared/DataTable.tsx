"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, Inbox, Info, RefreshCw } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PrimaryCell, type PrimaryCellTone } from "@/components/shared/PrimaryCell";
import { TablePagination } from "@/components/purchases/shared/TablePagination";
import { cn } from "@/lib/utils";

export type DataTableAlign = "left" | "center" | "right";
export type DataTableDensity = "compact" | "comfortable" | "spacious";
export type DataTableSortDirection = "asc" | "desc";
export type DataTableRowKey = string | number;
export type DataTableLoadingMode = "skeleton" | "dim" | "auto";

export interface DataTableSort {
  key: string;
  direction: DataTableSortDirection;
}

/** Declarative main cell: icon, title (optionally clickable) and subtitle. */
export interface DataTablePrimaryCell<T> {
  title: (row: T) => ReactNode;
  subtitle?: (row: T) => ReactNode;
  icon?: ReactNode | ((row: T) => ReactNode);
  iconTone?: PrimaryCellTone;
  /** Makes the title clickable. */
  onClick?: (row: T) => void;
  /** Makes the title a link. */
  href?: (row: T) => string;
  newTab?: boolean;
  showLinkIcon?: boolean;
  titleMono?: boolean;
  subtitleMono?: boolean;
  enableIcon?: boolean;
  enableSubtitle?: boolean;
}

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  /** Free renderer of the cell. Ignored when `primary` is set. */
  cell?: (row: T, index: number) => ReactNode;
  /** Declarative main cell (icon + title + subtitle) instead of a custom `cell`. */
  primary?: DataTablePrimaryCell<T>;
  align?: DataTableAlign;
  /** Tailwind width / min-width classes, e.g. "w-28" or "min-w-[220px]". */
  width?: string;
  /** Classes added to every body cell of the column (e.g. "font-mono text-xs"). */
  cellClassName?: string;
  /** Tooltip shown by the info icon next to the header (e.g. the allowed units). */
  info?: ReactNode;
  /** Where the tooltip opens. Default: "bottom" (never clipped by the table). */
  infoPlacement?: "top" | "bottom";
  /** Icon after the header text (e.g. a pencil for editable columns). */
  headerIcon?: ReactNode;
  /** Makes the header sortable. */
  sortable?: boolean;
  /** Value used to sort the column. Defaults to `row[key]`. */
  sortValue?: (row: T) => string | number | null | undefined;
}

export interface DataTableEmptyState {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export interface DataTablePagination {
  pageSizeOptions?: number[];
  defaultPageSize?: number;
  /** Plural noun used by the footer: "comprobantes", "insumos"... */
  itemLabel?: string;
}

export interface DataTableProps<T> {
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => DataTableRowKey;
  /** Row height: compact (py-2), comfortable (py-3.5, default) or spacious (py-5). */
  density?: DataTableDensity;
  /** Alternating row background. Default: false. */
  striped?: boolean;
  /** Highlights the hovered row. Default: true. */
  hoverable?: boolean;
  /** Keeps the header visible while scrolling (needs `maxHeight`). Default: false. */
  stickyHeader?: boolean;
  /** Tailwind max-height class of the scroll area, e.g. "max-h-96". */
  maxHeight?: string;
  /** Wraps the table in a rounded bordered card. Default: true. */
  enableCard?: boolean;
  /** Enables the footer. Pass `true` for defaults (15 rows) or an options object. */
  pagination?: boolean | DataTablePagination;
  /** Allows sorting by the columns marked `sortable`. Default: true. */
  enableSorting?: boolean;
  /** Initial sort (uncontrolled). */
  defaultSort?: DataTableSort | null;
  /** Controlled sort. When set, the header shows it and `onSortChange` must update it. */
  sort?: DataTableSort | null;
  /** The rows already come sorted (server or parent): the table only draws the indicators. Default: false. */
  manualSort?: boolean;
  /** Called every time a sortable header is clicked (null = no sort) with the clicked column key. */
  onSortChange?: (sort: DataTableSort | null, key: string) => void;
  /** Adds a checkbox column with select-all (current page). Default: false. */
  selectable?: boolean;
  /** Controlled selection. Omit to let the table keep it. */
  selectedKeys?: readonly DataTableRowKey[];
  onSelectionChange?: (keys: DataTableRowKey[]) => void;
  /** Marks the table as loading (see `loadingMode`). */
  loading?: boolean;
  /** "skeleton" replaces the rows, "dim" fades them, "auto" = skeleton without rows and dim with rows. Default: "skeleton". */
  loadingMode?: DataTableLoadingMode;
  /** Number of skeleton rows. Default: 5. */
  skeletonRows?: number;
  /** Load error: replaces the rows with the message and a retry button. */
  error?: string | null;
  onRetry?: () => void;
  /** Content drawn inside the card under the table (e.g. a server pagination). */
  footer?: ReactNode;
  /** Changing this value sends the pagination back to page 1 (filters, search...). */
  pageResetKey?: unknown;
  /** Extra classes of a row (e.g. to fade annulled records). */
  rowClassName?: (row: T) => string | undefined;
  /** Native tooltip of every row. */
  rowTitle?: string;
  /** Extra <TableRow>s drawn before the data rows (e.g. "balance before the period"). Hidden while loading or on error. */
  prependRows?: ReactNode;
  /** Extra <TableRow>s drawn after the data rows (e.g. totals). Only drawn when there are rows. */
  appendRows?: ReactNode;
  /** Group key of a row. A header row is drawn before the first row of every group (rows must arrive grouped). */
  groupBy?: (row: T) => string | number;
  /** Content of a group header row; receives the group key and all the rows of that group. */
  renderGroupHeader?: (key: string | number, rows: readonly T[]) => ReactNode;
  /** Shown when `rows` is empty. */
  emptyState?: DataTableEmptyState;
  onRowClick?: (row: T) => void;
  className?: string;
}

const DENSITY: Record<DataTableDensity, string> = {
  compact: "py-2 px-3",
  comfortable: "py-3.5 px-4",
  spacious: "py-5 px-5",
};

const ALIGN: Record<DataTableAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

const JUSTIFY: Record<DataTableAlign, string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};

function compareValues(a: unknown, b: unknown): number {
  const aEmpty = a === null || a === undefined || a === "";
  const bEmpty = b === null || b === undefined || b === "";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "es", { numeric: true, sensitivity: "base" });
}

function HeaderInfo({ content, placement }: Readonly<{ content: ReactNode; placement: "top" | "bottom" }>) {
  return (
    <span className="group/info relative inline-flex normal-case tracking-normal">
      <button
        type="button"
        aria-label="Más información"
        onClick={(event) => event.stopPropagation()}
        className="inline-flex cursor-help rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none invisible absolute left-1/2 z-30 w-max max-w-xs -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-3 text-left text-xs font-normal leading-relaxed text-slate-100 opacity-0 shadow-lg transition-opacity group-hover/info:visible group-hover/info:opacity-100 group-focus-within/info:visible group-focus-within/info:opacity-100",
          placement === "top" ? "bottom-full mb-2" : "top-full mt-2"
        )}
      >
        {content}
      </span>
    </span>
  );
}

/**
 * Data table with the look of the purchases list: uppercase header (with optional info tooltip,
 * icon and sorting), divided rows, declarative main cells, row selection, striping, sticky header,
 * pagination footer, loading skeleton and empty state.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  density = "comfortable",
  striped = false,
  hoverable = true,
  stickyHeader = false,
  maxHeight,
  enableCard = true,
  pagination = false,
  enableSorting = true,
  defaultSort = null,
  sort: controlledSort,
  manualSort = false,
  onSortChange,
  selectable = false,
  selectedKeys,
  onSelectionChange,
  loading = false,
  loadingMode = "skeleton",
  skeletonRows = 5,
  error = null,
  onRetry,
  footer,
  pageResetKey,
  rowClassName,
  rowTitle,
  prependRows,
  appendRows,
  groupBy,
  renderGroupHeader,
  emptyState,
  onRowClick,
  className,
}: Readonly<DataTableProps<T>>) {
  const isPaginated = Boolean(pagination);
  const paginationOptions: DataTablePagination | null = pagination ? (pagination === true ? {} : pagination) : null;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(paginationOptions?.defaultPageSize ?? 15);
  const [internalSort, setInternalSort] = useState<DataTableSort | null>(defaultSort);
  const sort = controlledSort !== undefined ? controlledSort : internalSort;

  // Back to the first page when the parent signals a new filter (state adjusted while rendering).
  const [syncedResetKey, setSyncedResetKey] = useState(pageResetKey);
  if (!Object.is(syncedResetKey, pageResetKey)) {
    setSyncedResetKey(pageResetKey);
    setPage(1);
  }
  const [internalSelection, setInternalSelection] = useState<DataTableRowKey[]>([]);

  const selection = selectedKeys ?? internalSelection;
  const selectionSet = useMemo(() => new Set<DataTableRowKey>(selection), [selection]);

  const sortedRows = useMemo(() => {
    if (!enableSorting || !sort || manualSort) return rows;
    const column = columns.find((item) => item.key === sort.key);
    if (!column) return rows;
    const read = column.sortValue ?? ((row: T) => (row as Record<string, unknown>)[column.key] as string | number);
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => factor * compareValues(read(a), read(b)));
  }, [rows, columns, sort, enableSorting, manualSort]);

  const visibleRows = useMemo(() => {
    if (!isPaginated) return sortedRows;
    const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
    const start = (Math.min(page, totalPages) - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, page, pageSize, isPaginated]);

  const cellPadding = DENSITY[density];
  const showSkeleton = loading && (loadingMode === "skeleton" || (loadingMode === "auto" && rows.length === 0));
  const dimmed = loading && !showSkeleton;
  const showError = Boolean(error) && !loading;
  const showEmpty = !loading && !showError && rows.length === 0;
  const columnCount = columns.length + (selectable ? 1 : 0);

  const updateSelection = (keys: DataTableRowKey[]) => {
    if (selectedKeys === undefined) setInternalSelection(keys);
    onSelectionChange?.(keys);
  };

  const pageKeys = visibleRows.map((row) => rowKey(row));
  const selectedOnPage = pageKeys.filter((key) => selectionSet.has(key)).length;
  const allSelected = pageKeys.length > 0 && selectedOnPage === pageKeys.length;

  const toggleAll = (checked: boolean) => {
    const rest = selection.filter((key) => !pageKeys.includes(key));
    updateSelection(checked ? [...rest, ...pageKeys] : rest);
  };

  const toggleRow = (key: DataTableRowKey, checked: boolean) => {
    updateSelection(checked ? [...selection, key] : selection.filter((item) => item !== key));
  };

  const cycleSort = (key: string) => {
    let next: DataTableSort | null;
    if (!sort || sort.key !== key) next = { key, direction: "asc" };
    else if (sort.direction === "asc") next = { key, direction: "desc" };
    else next = null;
    if (controlledSort === undefined) setInternalSort(next);
    setPage(1);
    onSortChange?.(next, key);
  };

  const renderCell = (column: DataTableColumn<T>, row: T, index: number): ReactNode => {
    const primary = column.primary;
    if (!primary) return column.cell?.(row, index);
    const icon = typeof primary.icon === "function" ? primary.icon(row) : primary.icon;
    return (
      <PrimaryCell
        title={primary.title(row)}
        subtitle={primary.subtitle?.(row)}
        icon={icon}
        iconTone={primary.iconTone}
        onClick={primary.onClick ? () => primary.onClick?.(row) : undefined}
        href={primary.href?.(row)}
        newTab={primary.newTab}
        showLinkIcon={primary.showLinkIcon}
        titleMono={primary.titleMono}
        subtitleMono={primary.subtitleMono}
        enableIcon={primary.enableIcon}
        enableSubtitle={primary.enableSubtitle}
      />
    );
  };

  return (
    <div
      className={cn(
        enableCard && "overflow-hidden rounded-2xl border border-slate-200/80 bg-card shadow-xs dark:border-slate-800",
        className
      )}
    >
      {/* The base Table wraps <table> in its own overflow-x-auto box, which would capture the sticky
          header; it is made visible so this div is the only scroll container. */}
      <div className={cn("overflow-auto transition-opacity [&_[data-slot=table-container]]:overflow-visible", maxHeight, dimmed && "opacity-60")}>
        <Table>
          <TableHeader
            className={cn(
              stickyHeader &&
                "sticky top-0 z-10 bg-card shadow-[0_1px_0_0_rgb(226_232_240)] dark:shadow-[0_1px_0_0_rgb(30_41_59)]"
            )}
          >
            <TableRow className="border-b border-slate-200/80 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/50">
              {selectable ? (
                <TableHead className={cn("w-10", cellPadding)}>
                  <Checkbox
                    aria-label="Seleccionar todo"
                    checked={allSelected}
                    indeterminate={selectedOnPage > 0 && !allSelected}
                    onCheckedChange={(checked) => toggleAll(Boolean(checked))}
                  />
                </TableHead>
              ) : null}
              {columns.map((column) => {
                const align = column.align ?? "left";
                const canSort = enableSorting && column.sortable;
                const active = Boolean(canSort) && sort?.key === column.key;
                const SortIcon = active ? (sort?.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                const label = (
                  <>
                    <span>{column.header}</span>
                    {canSort ? (
                      <SortIcon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-red-700" : "text-muted-foreground/70")} />
                    ) : null}
                  </>
                );

                return (
                  <TableHead
                    key={column.key}
                    aria-sort={active ? (sort?.direction === "asc" ? "ascending" : "descending") : undefined}
                    className={cn(
                      "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                      cellPadding,
                      ALIGN[align],
                      column.width,
                      active && "text-red-700"
                    )}
                  >
                    <span className={cn("inline-flex w-full items-center gap-1.5", JUSTIFY[align])}>
                      {canSort ? (
                        <button
                          type="button"
                          onClick={() => cycleSort(column.key)}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded uppercase tracking-wider hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                          {label}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">{label}</span>
                      )}
                      {column.headerIcon ? (
                        <span className="inline-flex text-muted-foreground [&_svg]:size-3.5">{column.headerIcon}</span>
                      ) : null}
                      {column.info ? <HeaderInfo content={column.info} placement={column.infoPlacement ?? "bottom"} /> : null}
                    </span>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {showSkeleton
              ? Array.from({ length: skeletonRows }, (_, rowIndex) => (
                  <TableRow key={`skeleton-${rowIndex}`}>
                    {Array.from({ length: columnCount }, (_, cellIndex) => (
                      <TableCell key={cellIndex} className={cellPadding}>
                        <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200/80 dark:bg-slate-800" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : null}

            {!showSkeleton && !showError ? prependRows : null}

            {showError ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-3 text-slate-600">
                    <AlertCircle className="h-8 w-8 text-red-600" />
                    <p className="text-sm font-semibold">{error}</p>
                    {onRetry ? (
                      <button
                        type="button"
                        onClick={onRetry}
                        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-red-700 px-3 text-xs font-semibold text-white hover:bg-red-800"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Reintentar
                      </button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ) : null}

            {showEmpty ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="py-16">
                  <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-3 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-muted-foreground dark:bg-slate-800">
                      {emptyState?.icon ?? <Inbox className="h-7 w-7" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{emptyState?.title ?? "Sin registros"}</p>
                      {emptyState?.description ? (
                        <p className="mt-1 text-xs text-muted-foreground">{emptyState.description}</p>
                      ) : null}
                    </div>
                    {emptyState?.action}
                  </div>
                </TableCell>
              </TableRow>
            ) : null}

            {!showSkeleton && !showError
              ? visibleRows.map((row, index) => {
                  const key = rowKey(row);
                  const selected = selectionSet.has(key);
                  const groupKey = groupBy ? groupBy(row) : null;
                  const startsGroup =
                    groupBy !== undefined && (index === 0 || groupBy(visibleRows[index - 1]) !== groupKey);
                  return (
                    <Fragment key={key}>
                      {startsGroup && groupKey !== null ? (
                        <TableRow className="bg-muted/60 hover:bg-muted/60">
                          <TableCell colSpan={columnCount} className="px-4 py-2">
                            {renderGroupHeader
                              ? renderGroupHeader(groupKey, sortedRows.filter((item) => groupBy?.(item) === groupKey))
                              : String(groupKey)}
                          </TableCell>
                        </TableRow>
                      ) : null}
                    <TableRow
                      data-state={selected ? "selected" : undefined}
                      title={rowTitle}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={cn(
                        "group transition-colors",
                        hoverable && "hover:bg-slate-50/60 dark:hover:bg-slate-900/40",
                        striped && "even:bg-slate-50/40 dark:even:bg-slate-900/30",
                        selected && "bg-red-50/40 dark:bg-red-950/20",
                        onRowClick && "cursor-pointer",
                        rowClassName?.(row)
                      )}
                    >
                      {selectable ? (
                        <TableCell className={cn("w-10", cellPadding)} onClick={(event) => event.stopPropagation()}>
                          <Checkbox
                            aria-label="Seleccionar fila"
                            checked={selected}
                            onCheckedChange={(checked) => toggleRow(key, Boolean(checked))}
                          />
                        </TableCell>
                      ) : null}
                      {columns.map((column) => (
                        <TableCell
                          key={column.key}
                          className={cn(cellPadding, ALIGN[column.align ?? "left"], column.cellClassName)}
                        >
                          {renderCell(column, row, index)}
                        </TableCell>
                      ))}
                    </TableRow>
                    </Fragment>
                  );
                })
              : null}

            {!showSkeleton && !showError && rows.length > 0 ? appendRows : null}
          </TableBody>
        </Table>
      </div>

      {footer}

      {paginationOptions && rows.length > 0 ? (
        <TablePagination
          currentPage={page}
          pageSize={pageSize}
          totalItems={rows.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={paginationOptions.pageSizeOptions}
          itemLabel={paginationOptions.itemLabel}
        />
      ) : null}
    </div>
  );
}

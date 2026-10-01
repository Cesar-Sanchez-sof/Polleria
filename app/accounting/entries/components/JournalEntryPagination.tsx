"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

interface Props {
  page: number;
  totalPages: number;
  pageSize: number;
  loading: boolean;
  fromShown: number;
  toShown: number;
  total: number;
  selectedCount: number;
  onPage: (page: number) => void;
  onPageSize: (pageSize: number) => void;
}

/** Bottom pagination: visible range, rows per page, and page jumps. */
export function JournalEntryPagination({
  page,
  totalPages,
  pageSize,
  loading,
  fromShown,
  toShown,
  total,
  selectedCount,
  onPage,
  onPageSize,
}: Readonly<Props>) {
  const visiblePages = useMemo(() => {
    const current = Math.min(page, totalPages);
    const start = Math.max(1, Math.min(current - 2, totalPages - 4));
    const end = Math.min(totalPages, start + 4);
    const list: (number | "…")[] = [];
    if (start > 1) list.push(1);
    if (start > 2) list.push("…");
    for (let n = start; n <= end; n++) list.push(n);
    if (end < totalPages - 1) list.push("…");
    if (end < totalPages) list.push(totalPages);
    return list;
  }, [page, totalPages]);

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-3">
      <div className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-lg">
        <span className="tabular-nums font-semibold text-slate-900">
          {fromShown}-{toShown} / {total}
        </span>
        <div className="flex items-center ml-1">
          <Button
            variant="ghost"
            size="icon"
            className="p-0.5 text-slate-600 hover:text-slate-900 rounded h-6 w-6 disabled:text-slate-300"
            disabled={loading || page <= 1}
            title="Página anterior"
            type="button"
            onClick={() => onPage(Math.max(1, page - 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="p-0.5 text-slate-600 hover:text-slate-900 rounded h-6 w-6 disabled:text-slate-300"
            disabled={loading || page >= totalPages}
            title="Página siguiente"
            type="button"
            onClick={() => onPage(Math.min(totalPages, page + 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <label id="page-size-label" className="text-slate-500">
            Por página
          </label>
          <Select
            value={pageSize}
            onValueChange={(val) => {
              if (typeof val === "number") onPageSize(val);
            }}
          >
            <SelectTrigger
              size="sm"
              className="rounded-lg bg-white text-xs"
              aria-labelledby="page-size-label"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          type="button"
          disabled={loading || page <= 1}
          onClick={() => onPage(Math.max(1, page - 1))}
          className="h-7 w-7 rounded-md text-slate-600 hover:text-slate-900 disabled:text-slate-300"
          title="Página anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        {visiblePages.map((n, i) =>
          n === "…" ? (
            <span key={`ellipsis-${i}`} className="px-1 text-slate-400 text-xs">
              …
            </span>
          ) : (
            <Button
              key={n}
              variant="ghost"
              type="button"
              onClick={() => onPage(n)}
              disabled={loading}
              className={`h-7 min-w-7 px-2 rounded-md text-xs tabular-nums cursor-pointer ${
                n === page
                  ? "bg-slate-900 text-white font-bold hover:bg-slate-900 hover:text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {n}
            </Button>
          )
        )}

        <Button
          variant="ghost"
          size="icon"
          type="button"
          disabled={loading || page >= totalPages}
          onClick={() => onPage(Math.min(totalPages, page + 1))}
          className="h-7 w-7 rounded-md text-slate-600 hover:text-slate-900 disabled:text-slate-300"
          title="Página siguiente"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}


"use client";

import { useState } from "react";
import {
  BarChart3,
  Clock,
  Download,
  Filter,
  Kanban,
  List,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  /** Current text in search input. */
  q: string;
  onSearch: (value: string) => void;
  onClearSearch: () => void;
  /** Opens dialog to register a manual journal entry. */
  onNew: () => void;
  /** Triggers Excel export. */
  onExport?: () => void;
  exporting?: boolean;
  /** Range of visible rows (e.g. 1-10 of 36). */
  fromShown: number;
  toShown: number;
  total: number;
  loading: boolean;
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}

/** Top toolbar: search, page range and view selector. */
export function JournalEntryToolbar({
  q,
  onSearch,
  onClearSearch,
  onNew,
  onExport,
  exporting = false,
  fromShown,
  toShown,
  total,
  loading,
  page,
  totalPages,
  onPage,
}: Readonly<Props>) {
  const [view, setView] = useState<string>("list");

  const views = [
    { value: "list", title: "Vista Lista", Icon: List },
    { value: "kanban", title: "Vista Kanban", Icon: Kanban },
    { value: "schedule", title: "Vista Historial / Reloj", Icon: Clock },
    { value: "chart", title: "Vista Gráficos", Icon: BarChart3 },
  ];

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      {/* Search Bar & Actions */}
      <div className="flex flex-wrap items-center gap-2 lg:justify-end lg:ml-auto">
        {/* Search Composite Pill */}
        <div className="relative flex items-center bg-slate-100 rounded-full px-3 py-1.5 min-w-60 md:min-w-70">
          <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          <Input
            className="bg-transparent dark:bg-transparent border-none outline-none text-xs placeholder:text-slate-400 w-full focus-visible:ring-0 shadow-none h-6 py-0 px-0"
            placeholder="Número, concepto o cuenta..."
            type="text"
            value={q}
            onChange={(e) => onSearch(e.target.value)}
          />
          {q !== "" ? (
            <button
              className="text-slate-400 hover:text-slate-700 px-1 cursor-pointer shrink-0"
              type="button"
              title="Limpiar búsqueda"
              onClick={onClearSearch}
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <span className="px-1 shrink-0 text-slate-300" aria-hidden="true">
              <Filter className="w-4 h-4" />
            </span>
          )}
        </div>

        <Button
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-sm font-semibold shadow-xs transition-all cursor-pointer h-9"
          type="button"
          onClick={onNew}
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo</span>
        </Button>

        <Button
          variant="outline"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors border-none shadow-none cursor-pointer h-8"
          type="button"
          onClick={onExport}
          disabled={exporting}
        >
          {exporting ? (
            <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span>{exporting ? "Exportando..." : "Exportar XLSX"}</span>
        </Button>
      </div>
    </div>
  );
}

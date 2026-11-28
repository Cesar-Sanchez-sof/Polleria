"use client";

import { useState } from "react";
import {
  BarChart3,
  Clock,
  Download,
  Kanban,
  List,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdvancedFilterToggle } from "@/components/shared/AdvancedFilterToggle";

interface Props {
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
  filtersOpen: boolean;
  onToggleFilters: () => void;
}

/** Top toolbar: search, page range and view selector. */
export function JournalEntryToolbar({
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
  filtersOpen,
  onToggleFilters,
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
        <AdvancedFilterToggle
          open={filtersOpen}
          onToggle={onToggleFilters}
        />
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

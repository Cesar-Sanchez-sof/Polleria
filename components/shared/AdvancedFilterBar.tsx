"use client";

import type { ReactNode } from "react";
import { Filter, FunnelX, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AdvancedFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  showSearch?: boolean;
  maxSearchLength?: number;
  activeFilterCount: number;
  hasActiveFilters: boolean;
  onClear: () => void;
  resultCount?: number;
  itemLabel?: string;
  actions?: ReactNode;
  children?: ReactNode;
}

export function normalizeFilterText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function AdvancedFilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  showSearch = true,
  maxSearchLength,
  activeFilterCount,
  hasActiveFilters,
  onClear,
  resultCount,
  itemLabel,
  actions,
  children,
}: Readonly<AdvancedFilterBarProps>) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-card p-3 shadow-xs dark:border-slate-800 sm:p-4">
      <div className="flex flex-wrap items-end gap-3">
        {showSearch && (
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              maxLength={maxSearchLength}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-10 rounded-xl pl-9 text-xs"
            />
          </div>
        )}

        {children}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {typeof resultCount === "number" && itemLabel && (
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              <span className="font-semibold tabular-nums text-foreground">{resultCount}</span>{" "}
              {itemLabel}
            </span>
          )}
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
              <Filter className="h-3 w-3" />
              {activeFilterCount} filtro{activeFilterCount === 1 ? "" : "s"}
            </span>
          )}
          {hasActiveFilters && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClear}
              className="h-9 gap-1.5 rounded-lg text-xs"
            >
              <FunnelX className="h-3.5 w-3.5" />
              Limpiar
            </Button>
          )}
          {actions}
        </div>
      </div>
    </div>
  );
}

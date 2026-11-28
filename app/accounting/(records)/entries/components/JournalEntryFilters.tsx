"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdvancedFilterBar } from "@/components/shared/AdvancedFilterBar";
import {
  type JournalEntriesOptions,
} from "@/lib/services/accounting/journal-entries.service";

interface Props {
  from: string;
  to: string;
  journal: string;
  statusFilter: string;
  search: string;
  options: JournalEntriesOptions | null;
  hasFilters: boolean;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  onJournal: (value: string) => void;
  onStatus: (value: string) => void;
  onSearch: (value: string) => void;
  onClear: () => void;
}

/** Combined advanced filter bar for journal entries. */
export function JournalEntryFilters({
  from,
  to,
  journal,
  statusFilter,
  search,
  options,
  hasFilters,
  onFrom,
  onTo,
  onJournal,
  onStatus,
  onSearch,
  onClear,
}: Readonly<Props>) {
  const statuses = options?.statuses ?? [
    { value: "registrado", label: "Registrado", total: 0 },
    { value: "anulado", label: "Anulado", total: 0 },
  ];

  const statusOptions = [
    { value: "todos", label: "Todos" },
    ...statuses.map((st) => ({ value: st.value, label: `${st.label} (${st.total})` })),
  ];

  const journalOptions = [
    { value: "todos", label: `Todos los diarios (${options?.daily.reduce((sum, item) => sum + item.total, 0) ?? 0})` },
    ...(options?.daily.map((item) => ({
      value: item.name,
      label: `${item.name} (${item.total})`,
    })) ?? []),
  ];
  const activeFilterCount =
    Number(Boolean(from)) +
    Number(Boolean(to)) +
    Number(journal !== "todos") +
    Number(statusFilter !== "todos");

  return (
    <AdvancedFilterBar
      search={search}
      onSearchChange={onSearch}
      searchPlaceholder="Número, concepto, cuenta o responsable..."
      maxSearchLength={200}
      activeFilterCount={activeFilterCount}
      hasActiveFilters={hasFilters}
      onClear={onClear}
    >
      <label className="flex min-w-[145px] flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Desde
        <Input
          id="filter-from"
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => onFrom(e.target.value)}
          className="h-9 w-full rounded-lg bg-background text-xs font-normal normal-case tracking-normal"
        />
      </label>
      <label className="flex min-w-[145px] flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Hasta
        <Input
          id="filter-to"
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => onTo(e.target.value)}
          className="h-9 w-full rounded-lg bg-background text-xs font-normal normal-case tracking-normal"
        />
      </label>
      <label className="flex min-w-[180px] flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Diario
        <Select
          value={journal}
          items={journalOptions}
          onValueChange={(val) => onJournal(val ?? "todos")}
        >
          <SelectTrigger className="h-9 w-full rounded-lg bg-background text-xs font-normal normal-case tracking-normal">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {journalOptions.map((op) => (
              <SelectItem key={op.value} value={op.value}>
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <label className="flex min-w-[140px] flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Estado
        <Select
          id="statusFilter"
          value={statusFilter}
          items={statusOptions}
          onValueChange={(val) => onStatus(val ?? "todos")}
        >
          <SelectTrigger className="h-9 w-full rounded-lg bg-background text-xs font-normal normal-case tracking-normal">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((op) => (
              <SelectItem key={op.value} value={op.value}>
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
    </AdvancedFilterBar>
  );
}

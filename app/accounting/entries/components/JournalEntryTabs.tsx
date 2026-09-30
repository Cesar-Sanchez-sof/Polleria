"use client";

import { Button } from "@/components/ui/button";
import type { JournalBookOption } from "@/lib/services/asientos.service";

interface Props {
  journals: JournalBookOption[];
  /** Total journal entries of the current list (with applied filters). */
  total: number;
  /** Selected journal ("todos" = unfiltered). */
  journal: string;
  onSelect: (journal: string) => void;
}

/** Accounting journal tabs: quick filter with entry counts. */
export function JournalEntryTabs({ journals, total, journal, onSelect }: Readonly<Props>) {
  const tabs = [
    { value: "todos", label: "Todos los diarios", total },
    ...journals.map((d) => ({ value: d.nombre, label: d.nombre, total: d.total })),
  ];

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = journal === tab.value;
        return (
          <Button
            key={tab.value}
            variant="ghost"
            onClick={() => onSelect(tab.value)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer h-auto shrink-0 ${
              isActive
                ? "font-bold bg-slate-900 text-white shadow-xs hover:bg-slate-900 hover:text-white"
                : "font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
            type="button"
          >
            {tab.label} ({tab.total})
          </Button>
        );
      })}
    </div>
  );
}

// Backwards compatibility alias
export const TabsDiarioAsientos = JournalEntryTabs;


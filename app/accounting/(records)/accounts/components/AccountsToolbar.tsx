"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdvancedFilterToggle } from "@/components/shared/AdvancedFilterToggle";

interface AccountsToolbarProps {
  filtersOpen: boolean;
  onToggleFilters: () => void;
  onNew: () => void;
}

export function AccountsToolbar({
  filtersOpen,
  onToggleFilters,
  onNew,
}: Readonly<AccountsToolbarProps>) {
  return (
    <div className="flex items-center gap-2">
      <AdvancedFilterToggle open={filtersOpen} onToggle={onToggleFilters} />
      <Button
        className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-all hover:bg-red-800"
        type="button"
        onClick={onNew}
      >
        <Plus className="h-4 w-4" />
        <span>Nueva cuenta</span>
      </Button>
    </div>
  );
}

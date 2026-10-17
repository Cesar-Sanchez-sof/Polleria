"use client";

import { useMemo, type ReactNode } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

export interface TypeaheadItem<T extends string = string> {
  value: T;
  /** Main text; it is what the input shows once the item is selected. */
  label: string;
  /** Secondary text shown at the right of the option (e.g. the account type). */
  description?: string;
  /** Left decoration of the option, e.g. the code in red. */
  prefix?: ReactNode;
  /** Extra text taken into account by the search. */
  keywords?: string;
  disabled?: boolean;
}

export interface TypeaheadProps<T extends string = string> {
  items: readonly TypeaheadItem<T>[];
  /** Selected value ("" = nothing selected). */
  value: T | "";
  onValueChange: (value: T | "") => void;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  /** Shows the clear button when there is a selection. Default: true. */
  clearable?: boolean;
  /** Text of the list when nothing matches. Default: "Sin resultados". */
  emptyText?: string;
  className?: string;
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Select with search: the user opens the list like a normal select or types to filter it
 * (accent-insensitive, by label, value, description or keywords). The list floats in a portal,
 * so it always shows above dialogs and scrollable containers. Arrows, Enter and Escape work as expected.
 */
export function Typeahead<T extends string = string>({
  items,
  value,
  onValueChange,
  placeholder = "Seleccione…",
  ariaLabel,
  disabled = false,
  clearable = true,
  emptyText = "Sin resultados",
  className,
}: Readonly<TypeaheadProps<T>>) {
  const selected = useMemo(() => items.find((item) => item.value === value) ?? null, [items, value]);

  return (
    <Combobox<TypeaheadItem<T>>
      items={items as TypeaheadItem<T>[]}
      value={selected}
      onValueChange={(item) => onValueChange(item?.value ?? "")}
      itemToStringLabel={(item) => item.label}
      isItemEqualToValue={(a, b) => a.value === b.value}
      filter={(item, query) =>
        normalize(`${item.value} ${item.label} ${item.description ?? ""} ${item.keywords ?? ""}`).includes(
          normalize(query.trim())
        )
      }
      disabled={disabled}
    >
      <ComboboxInput
        placeholder={placeholder}
        aria-label={ariaLabel}
        showClear={clearable && selected !== null}
        className={cn(
          "h-9 w-64 rounded-lg border-slate-200 bg-white text-xs shadow-none dark:border-slate-700 dark:bg-slate-900",
          className
        )}
      />
      <ComboboxContent className="min-w-64">
        <ComboboxEmpty className="text-xs">{emptyText}</ComboboxEmpty>
        <ComboboxList>
          {(item: TypeaheadItem<T>) => (
            <ComboboxItem key={item.value} value={item} disabled={item.disabled} className="text-xs">
              {item.prefix ? <span className="shrink-0">{item.prefix}</span> : null}
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.description ? (
                <span className="shrink-0 text-[11px] text-muted-foreground">{item.description}</span>
              ) : null}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

"use client";

import React from "react";
import { Plus, X, Type } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { CatalogField } from "@/lib/hooks/use-visual-data";

export function WellSection({
  title,
  required,
  currentValue,
  availableFields,
  onSelectField,
  onRemoveField,
  children,
}: {
  title: string;
  required?: boolean;
  currentValue?: string;
  availableFields: CatalogField[];
  onSelectField: (fieldId: string) => void;
  onRemoveField: () => void;
  children?: React.ReactNode;
}) {
  const currentField = availableFields.find((f) => f.id === currentValue);

  return (
    <div className="space-y-1.5 p-2.5 rounded-lg border border-border/80 bg-muted/15">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <span>{title}</span>
          {required && <span className="text-destructive">*</span>}
        </Label>
        {!currentValue && (
          <AddFieldPopover fields={availableFields} onSelectField={onSelectField} />
        )}
      </div>

      {currentValue ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-1.5 p-1.5 bg-background border border-border/90 rounded-md text-xs shadow-2xs">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <Type className="size-3 text-blue-500 shrink-0" />
              <span className="truncate font-medium text-[11px]" title={currentField?.label || currentValue}>
                {currentField?.label || currentValue}
              </span>
            </div>
            <button
              type="button"
              onClick={onRemoveField}
              className="size-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
            >
              <X className="size-3" />
            </button>
          </div>
          {children}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground/80 italic mt-1">
          {required ? "Campo requerido. Haz clic en '+' para asignar." : "Opcional. Haz clic en '+' para agregar."}
        </p>
      )}
    </div>
  );
}

export function AddFieldPopover({
  fields,
  onSelectField,
}: {
  fields: CatalogField[];
  onSelectField: (id: string) => void;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="size-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer">
        <Plus className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1.5 max-h-64 overflow-y-auto">
        <div className="text-[11px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">
          Seleccionar Campo
        </div>
        {fields.length === 0 ? (
          <div className="text-xs text-muted-foreground p-2 text-center">
            No hay campos disponibles
          </div>
        ) : (
          <div className="space-y-0.5">
            {fields.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  onSelectField(f.id);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md text-left hover:bg-accent hover:text-accent-foreground cursor-pointer"
              >
                <Type className="size-3 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{f.label}</span>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

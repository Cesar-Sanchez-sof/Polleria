"use client";

import React, { useState } from "react";
import { Plus, X, Type, AlertCircle, CheckCircle2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import {
  validateFieldForWell,
  type VisualWellDefinition,
} from "@/lib/dashboards/visual-registry";
import { getDraggedField } from "@/lib/dashboards/drag-state";
import type { CatalogField } from "@/lib/hooks/use-visual-data";

export function WellSection({
  title,
  required,
  wellDef,
  currentValue,
  availableFields,
  onSelectField,
  onRemoveField,
  children,
}: {
  title: string;
  required?: boolean;
  wellDef?: VisualWellDefinition;
  currentValue?: string;
  availableFields: CatalogField[];
  onSelectField: (fieldId: string) => void;
  onRemoveField: () => void;
  children?: React.ReactNode;
}) {
  const currentField = availableFields.find((f) => f.id === currentValue);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragFeedback, setDragFeedback] = useState<{ valid: boolean; message?: string } | null>(null);

  const currentCount = currentValue ? 1 : 0;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const dragged = getDraggedField();
    if (dragged && wellDef) {
      const validation = validateFieldForWell(wellDef, dragged, currentCount);
      setDragFeedback({
        valid: validation.valid,
        message: validation.valid ? `Soltar para asignar a ${title}` : validation.error,
      });
      e.dataTransfer.dropEffect = validation.valid ? "copy" : "none";
    } else {
      setDragFeedback({ valid: true, message: `Soltar para asignar a ${title}` });
      e.dataTransfer.dropEffect = "copy";
    }

    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setDragFeedback(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDragFeedback(null);

    let droppedField = getDraggedField();
    if (!droppedField) {
      const rawJson = e.dataTransfer.getData("application/json");
      if (rawJson) {
        try {
          droppedField = JSON.parse(rawJson);
        } catch {
          // ignore
        }
      }
    }

    if (!droppedField) {
      const plainId = e.dataTransfer.getData("text/plain");
      if (plainId) {
        droppedField = availableFields.find((f) => f.id === plainId) || null;
      }
    }

    if (!droppedField) return;

    // Validación estricta con las reglas del registro (wells.accepts y max)
    if (wellDef) {
      const validation = validateFieldForWell(wellDef, droppedField, currentCount);
      if (!validation.valid) {
        toast.error(validation.error || "No se puede soltar el campo en este pozo.");
        return;
      }
    }

    onSelectField(droppedField.id);
    toast.success(`Campo "${droppedField.label || droppedField.id}" asignado a ${title}`);
  };

  const borderClass = isDragOver
    ? dragFeedback?.valid
      ? "ring-2 ring-primary border-primary bg-primary/10 shadow-xs"
      : "ring-2 ring-destructive/80 border-destructive bg-destructive/10 shadow-xs"
    : "border-border/80 bg-muted/15";

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`space-y-1.5 p-2.5 rounded-lg border transition-colors ${borderClass}`}
    >
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <span>{title}</span>
          {required && <span className="text-destructive">*</span>}
        </Label>
        {!currentValue && (
          <AddFieldPopover fields={availableFields} onSelectField={onSelectField} />
        )}
      </div>

      {isDragOver && dragFeedback && (
        <div
          className={`text-[10px] flex items-center gap-1 font-medium py-1 px-2 rounded-md ${
            dragFeedback.valid
              ? "text-primary bg-primary/15"
              : "text-destructive bg-destructive/15"
          }`}
        >
          {dragFeedback.valid ? (
            <CheckCircle2 className="size-3 shrink-0" />
          ) : (
            <AlertCircle className="size-3 shrink-0" />
          )}
          <span className="truncate">{dragFeedback.message}</span>
        </div>
      )}

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
          {required
            ? "Campo requerido. Arrastra un campo aquí o haz clic en '+'."
            : "Opcional. Arrastra un campo aquí o haz clic en '+'."}
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

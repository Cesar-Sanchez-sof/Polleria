"use client";

import React, { useState, useMemo } from "react";
import {
  Users,
  Shield,
  Search,
  X,
  Plus,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export interface PermissionItem {
  id: number;
  name: string;
  subtitle?: string | null;
}

export interface PermissionSelection {
  id: number;
  canView: boolean;
  canEdit: boolean;
}

export interface PermissionSelectorProps {
  label: string;
  buttonText: string;
  description?: string;
  type: "role" | "user";
  availableItems: PermissionItem[];
  selections: PermissionSelection[];
  onChange: (selections: PermissionSelection[]) => void;
}

export function PermissionSelector({
  label,
  buttonText,
  description,
  type,
  availableItems,
  selections,
  onChange,
}: PermissionSelectorProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Copia temporal mientras el diálogo está abierto
  const [tempSelections, setTempSelections] = useState<Map<number, { canView: boolean; canEdit: boolean }>>(
    new Map()
  );

  const openDialog = () => {
    const map = new Map<number, { canView: boolean; canEdit: boolean }>();
    for (const s of selections) {
      map.set(s.id, { canView: s.canView, canEdit: s.canEdit });
    }
    setTempSelections(map);
    setSearch("");
    setDialogOpen(true);
  };

  const handleSave = () => {
    const next: PermissionSelection[] = [];
    for (const [id, access] of tempSelections.entries()) {
      if (access.canView || access.canEdit) {
        next.push({ id, canView: access.canView, canEdit: access.canEdit });
      }
    }
    onChange(next);
    setDialogOpen(false);
  };

  const handleRemoveTag = (id: number) => {
    onChange(selections.filter((s) => s.id !== id));
  };

  const handleToggleCheck = (
    id: number,
    field: "canView" | "canEdit",
    checked: boolean
  ) => {
    setTempSelections((prev) => {
      const next = new Map(prev);
      const current = next.get(id) ?? { canView: false, canEdit: false };
      const updated = { ...current, [field]: checked };

      // Si marca Editar, automáticamente necesita Ver
      if (field === "canEdit" && checked) {
        updated.canView = true;
      }
      // Si desmarca Ver, desmarca Editar
      if (field === "canView" && !checked) {
        updated.canEdit = false;
      }

      if (!updated.canView && !updated.canEdit) {
        next.delete(id);
      } else {
        next.set(id, updated);
      }
      return next;
    });
  };

  const filteredItems = useMemo(() => {
    if (!search.trim()) return availableItems;
    const q = search.toLowerCase();
    return availableItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q))
    );
  }, [availableItems, search]);

  const itemMap = useMemo(() => {
    const map = new Map<number, PermissionItem>();
    for (const item of availableItems) {
      map.set(item.id, item);
    }
    return map;
  }, [availableItems]);

  const Icon = type === "role" ? Shield : Users;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Icon className="size-3.5 text-primary" />
          <span>{label}</span>
        </label>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={openDialog}
          className="h-7 text-xs gap-1 cursor-pointer"
        >
          <Plus className="size-3" />
          <span>{buttonText}</span>
        </Button>
      </div>

      {description && (
        <p className="text-[11px] text-muted-foreground">{description}</p>
      )}

      {/* Etiquetas (Tags) de Selección Activa */}
      <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-lg border border-border/80 bg-background/50">
        {selections.length === 0 ? (
          <span className="text-xs text-muted-foreground italic self-center">
            Ninguno asignado (por defecto todos los no restringidos)
          </span>
        ) : (
          selections.map((sel) => {
            const item = itemMap.get(sel.id);
            const name = item ? item.name : `ID #${sel.id}`;
            const permissionsLabel = [
              sel.canView ? "Ver" : null,
              sel.canEdit ? "Editar" : null,
            ]
              .filter(Boolean)
              .join(", ");

            return (
              <span
                key={sel.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-background text-foreground border border-border shadow-2xs"
              >
                <span>
                  {name}{" "}
                  <span className="text-muted-foreground font-normal">
                    ({permissionsLabel})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(sel.id)}
                  className="rounded-full hover:bg-muted p-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </span>
            );
          })
        )}
      </div>

      {/* Diálogo de Asignación */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Icon className="size-4.5 text-primary" />
              {label}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Selecciona los {type === "role" ? "roles" : "usuarios"} y asigna los
              permisos correspondientes (Ver y/o Editar).
            </DialogDescription>
          </DialogHeader>

          {/* Buscador dentro del modal */}
          <div className="relative my-1">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Buscar ${type === "role" ? "rol..." : "usuario o correo..."}`}
              className="h-8 pl-8 text-xs"
            />
          </div>

          {/* Lista de Items con Checkboxes */}
          <div className="max-h-72 overflow-y-auto divide-y divide-border/60 border rounded-lg">
            {filteredItems.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground italic">
                No se encontraron resultados
              </p>
            ) : (
              filteredItems.map((item) => {
                const current = tempSelections.get(item.id) ?? {
                  canView: false,
                  canEdit: false,
                };
                return (
                  <div
                    key={item.id}
                    className="p-2.5 flex items-center justify-between hover:bg-muted/30 transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-medium text-foreground truncate">
                        {item.name}
                      </p>
                      {item.subtitle && (
                        <p className="text-[11px] text-muted-foreground truncate">
                          {item.subtitle}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={current.canView}
                          onChange={(e) =>
                            handleToggleCheck(item.id, "canView", e.target.checked)
                          }
                          className="rounded border-border size-3.5 text-primary focus:ring-primary cursor-pointer"
                        />
                        <span>Ver</span>
                      </label>

                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={current.canEdit}
                          onChange={(e) =>
                            handleToggleCheck(item.id, "canEdit", e.target.checked)
                          }
                          className="rounded border-border size-3.5 text-primary focus:ring-primary cursor-pointer"
                        />
                        <span>Editar</span>
                      </label>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              className="gap-1.5"
            >
              <Check className="size-3.5" />
              <span>Guardar Selección</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

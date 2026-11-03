"use client";

import React, { useState, useMemo, useTransition } from "react";
import {
  GripVertical,
  MoreVertical,
  Plus,
  Edit2,
  Trash2,
  Check,
  Folder,
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
import { ConfigTableLayout } from "./ConfigTableLayout";
import {
  createSectionAction,
  updateSectionAction,
  reorderSectionsAction,
  deleteSectionsAction,
} from "@/app/dashboards/config/actions";
import type { DashboardSection } from "@prisma/client";
import { toast } from "sonner";

interface SectionsTableProps {
  initialSections: DashboardSection[];
}

export function SectionsTable({ initialSections }: SectionsTableProps) {
  const [sections, setSections] = useState<DashboardSection[]>(initialSections);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Estados de Modales
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<DashboardSection | null>(null);
  const [editSectionName, setEditSectionName] = useState("");

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  // Filtrado
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase();
    return sections.filter((s) => s.name.toLowerCase().includes(q));
  }, [sections, searchQuery]);

  // Paginado
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // Selección Múltiple
  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(paginated.map((s) => s.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Drag and Drop Nativo
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const updated = [...sections];
    const [moved] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, moved);

    // Reasignar campo order
    const withOrders = updated.map((sec, idx) => ({
      ...sec,
      order: idx + 1,
    }));

    setSections(withOrders);
    setDraggedIndex(null);

    startTransition(async () => {
      const payload = withOrders.map((s) => ({ id: s.id, order: s.order }));
      const res = await reorderSectionsAction(payload);
      if (res.success) {
        toast.success("Orden de secciones actualizado");
      } else {
        toast.error("Error al guardar el nuevo orden");
      }
    });
  };

  // Crear Sección
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionName.trim()) return;

    startTransition(async () => {
      const nextOrder = sections.length + 1;
      const res = await createSectionAction(newSectionName.trim(), nextOrder);
      if (res.success && res.data) {
        setSections((prev) => [...prev, res.data]);
        toast.success("Sección creada exitosamente");
        setNewSectionName("");
        setCreateDialogOpen(false);
      } else {
        toast.error(res.error || "Error al crear la sección");
      }
    });
  };

  // Editar Sección
  const openEditModal = (section: DashboardSection) => {
    setEditingSection(section);
    setEditSectionName(section.name);
    setEditDialogOpen(true);
    setActiveMenuId(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSection || !editSectionName.trim()) return;

    startTransition(async () => {
      const res = await updateSectionAction(editingSection.id, editSectionName.trim());
      if (res.success && res.data) {
        setSections((prev) =>
          prev.map((s) => (s.id === editingSection.id ? res.data : s))
        );
        toast.success("Sección actualizada");
        setEditDialogOpen(false);
        setEditingSection(null);
      } else {
        toast.error(res.error || "Error al actualizar la sección");
      }
    });
  };

  // Eliminar
  const handleDeleteSelected = async (ids: string[]) => {
    if (!confirm(`¿Eliminar ${ids.length} sección(es)?`)) return;

    startTransition(async () => {
      const res = await deleteSectionsAction(ids);
      if (res.success) {
        setSections((prev) => prev.filter((s) => !ids.includes(s.id)));
        setSelectedIds(new Set());
        toast.success("Secciones eliminadas correctamente");
      } else {
        toast.error(res.error || "Error al eliminar");
      }
    });
  };

  const handleGlobalAction = (action: "edit" | "duplicate" | "delete") => {
    if (action === "edit" && selectedIds.size === 1) {
      const id = Array.from(selectedIds)[0];
      const sec = sections.find((s) => s.id === id);
      if (sec) openEditModal(sec);
    } else if (action === "duplicate") {
      const ids = Array.from(selectedIds);
      startTransition(async () => {
        let count = 0;
        for (const id of ids) {
          const sec = sections.find((s) => s.id === id);
          if (sec) {
            const nextOrder = sections.length + count + 1;
            const res = await createSectionAction(`${sec.name} (Copia)`, nextOrder);
            if (res.success && res.data) {
              setSections((prev) => [...prev, res.data]);
              count++;
            }
          }
        }
        setSelectedIds(new Set());
        toast.success(`${count} sección(es) duplicada(s) exitosamente`);
      });
    } else if (action === "delete") {
      handleDeleteSelected(Array.from(selectedIds));
    }
  };

  const allOnPageSelected =
    paginated.length > 0 && paginated.every((s) => selectedIds.has(s.id));

  return (
    <>
      <ConfigTableLayout
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Buscar sección por nombre..."
        selectedCount={selectedIds.size}
        onClearSelection={() => setSelectedIds(new Set())}
        onAction={handleGlobalAction}
        totalItems={filtered.length}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        primaryAction={
          <Button
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            className="h-8 gap-1.5 text-xs font-semibold cursor-pointer shadow-xs"
          >
            <Plus className="size-3.5" />
            <span>Nueva Sección</span>
          </Button>
        }
      >
        <table className="w-full text-xs text-left border-collapse select-none">
          <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider border-b sticky top-0 z-10 backdrop-blur-xs">
            <tr>
              <th className="w-10 px-3 py-3 text-center">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={(e) => handleToggleSelectAll(e.target.checked)}
                  className="rounded border-border size-3.5 text-primary focus:ring-primary cursor-pointer"
                />
              </th>
              <th className="w-12 px-2 py-3 text-center">Orden</th>
              <th className="px-4 py-3 font-semibold">Nombre de la Sección</th>
              <th className="w-20 px-3 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-10 text-muted-foreground">
                  <Folder className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p>No se encontraron secciones</p>
                </td>
              </tr>
            ) : (
              paginated.map((sec, idx) => {
                const isSelected = selectedIds.has(sec.id);
                return (
                  <tr
                    key={sec.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, idx)}
                    className={`group transition-colors ${
                      isSelected
                        ? "bg-primary/5 hover:bg-primary/10"
                        : "hover:bg-muted/40"
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(sec.id)}
                        className="rounded border-border size-3.5 text-primary focus:ring-primary cursor-pointer"
                      />
                    </td>

                    {/* Icono de Agarre para Drag & Drop (Número primero, luego icono de agarre) */}
                    <td className="px-2 py-2.5 text-center text-muted-foreground group-hover:text-foreground cursor-grab active:cursor-grabbing">
                      <div className="flex items-center justify-center gap-1">
                        <span className="font-mono text-[10px] opacity-70">
                          {sec.order}
                        </span>
                        <GripVertical className="size-4 opacity-50 group-hover:opacity-100" />
                      </div>
                    </td>

                    {/* Nombre */}
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <Folder className="size-3.5 text-primary shrink-0" />
                        <span>{sec.name}</span>
                      </div>
                    </td>

                    {/* Botón de 3 puntos */}
                    <td className="px-3 py-2.5 text-right relative">
                      <div className="inline-block relative">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() =>
                            setActiveMenuId(activeMenuId === sec.id ? null : sec.id)
                          }
                          className="size-7 rounded-md cursor-pointer hover:bg-muted"
                        >
                          <MoreVertical className="size-3.5" />
                        </Button>

                        {activeMenuId === sec.id && (
                          <div className="absolute right-0 top-full mt-1 z-30 w-32 rounded-md border border-border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95">
                            <button
                              type="button"
                              onClick={() => openEditModal(sec)}
                              className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent text-left cursor-pointer"
                            >
                              <Edit2 className="size-3 text-muted-foreground" />
                              <span>Renombrar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSelected([sec.id])}
                              className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 text-left cursor-pointer"
                            >
                              <Trash2 className="size-3" />
                              <span>Eliminar</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </ConfigTableLayout>

      {/* Modal: Crear Sección */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Folder className="size-4.5 text-primary" />
                Nueva Sección
              </DialogTitle>
              <DialogDescription className="text-xs">
                Crea una categoría para organizar tus tableros en el panel lateral.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-3">
              <label className="text-xs font-semibold text-foreground">
                Nombre de la sección
              </label>
              <Input
                required
                autoFocus
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="Ej. Finanzas, Salón, Cocina..."
                className="h-9 text-xs"
              />
            </div>

            <DialogFooter className="gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                Guardar Sección
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Sección */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleUpdate}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit2 className="size-4 text-primary" />
                Renombrar Sección
              </DialogTitle>
            </DialogHeader>

            <div className="py-4 space-y-3">
              <label className="text-xs font-semibold text-foreground">
                Nombre de la sección
              </label>
              <Input
                required
                autoFocus
                value={editSectionName}
                onChange={(e) => setEditSectionName(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <DialogFooter className="gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                Actualizar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

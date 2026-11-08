"use client";

import React, { useState, useMemo, useTransition } from "react";
import {
  Link2,
  Copy,
  Check,
  Plus,
  Trash2,
  Edit2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  createShareLinkAction,
  toggleShareLinkActiveAction,
  deleteShareLinksAction,
} from "@/app/dashboards/config/actions";
import type { DashboardShareWithDetails } from "@/lib/services/settings/dashboard.service";
import { toast } from "sonner";

interface ShareLinksTableProps {
  initialLinks: DashboardShareWithDetails[];
  availableDashboards: Array<{ id: string; name: string }>;
}

export function ShareLinksTable({
  initialLinks,
  availableDashboards,
}: ShareLinksTableProps) {
  const [links, setLinks] = useState<DashboardShareWithDetails[]>(initialLinks);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Modal Nuevo Enlace
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newLinkName, setNewLinkName] = useState("");
  const [newDashboardId, setNewDashboardId] = useState(
    availableDashboards[0]?.id || ""
  );

  // Modal Editar Enlace
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<DashboardShareWithDetails | null>(null);
  const [editLinkName, setEditLinkName] = useState("");

  // Filtrado
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return links;
    const q = searchQuery.toLowerCase();
    return links.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.dashboard.name.toLowerCase().includes(q) ||
        (l.dashboard.section && l.dashboard.section.name.toLowerCase().includes(q))
    );
  }, [links, searchQuery]);

  // Paginado
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // Selección Múltiple
  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(paginated.map((l) => l.id)));
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

  // Copiar URL
  const handleCopy = (uuid: string) => {
    const relativeUrl = `/share/${uuid}`;
    const fullUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}${relativeUrl}`
        : relativeUrl;

    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopiedId(uuid);
      toast.success("Enlace copiado al portapapeles");
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // Toggle Activo
  const handleToggleActive = (id: string, currentVal: boolean) => {
    const nextVal = !currentVal;

    // Actualización optimista
    setLinks((prev) =>
      prev.map((l) => (l.id === id ? { ...l, isActive: nextVal } : l))
    );

    startTransition(async () => {
      const res = await toggleShareLinkActiveAction(id, nextVal);
      if (res.success) {
        toast.success(
          nextVal ? "Enlace activado" : "Enlace desactivado correctamente"
        );
      } else {
        // Revertir
        setLinks((prev) =>
          prev.map((l) => (l.id === id ? { ...l, isActive: currentVal } : l))
        );
        toast.error("Error al actualizar estado del enlace");
      }
    });
  };

  // Crear Enlace
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkName.trim() || !newDashboardId) {
      toast.error("Por favor completa los campos");
      return;
    }

    startTransition(async () => {
      const res = await createShareLinkAction(newDashboardId, newLinkName.trim(), 1);
      if (res.success && res.data) {
        const matchingDash = availableDashboards.find(
          (d) => d.id === newDashboardId
        );
        const newItem: DashboardShareWithDetails = {
          ...res.data,
          dashboard: {
            name: matchingDash?.name || "Tablero",
            section: null,
          } as any,
          createdBy: {
            id: 1,
            username: "admin",
            email: "admin@erp.com",
          },
        };
        setLinks((prev) => [newItem, ...prev]);
        toast.success("Enlace compartido creado exitosamente");
        setCreateDialogOpen(false);
        setNewLinkName("");
      } else {
        toast.error(res.error || "Error al crear enlace");
      }
    });
  };

  // Abrir Modal de Edición
  const openEditModal = (link: DashboardShareWithDetails) => {
    setEditingLink(link);
    setEditLinkName(link.name);
    setEditDialogOpen(true);
  };

  // Guardar Edición de Nombre
  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLink || !editLinkName.trim()) return;

    setLinks((prev) =>
      prev.map((l) =>
        l.id === editingLink.id ? { ...l, name: editLinkName.trim() } : l
      )
    );
    toast.success("Nombre del enlace actualizado");
    setEditDialogOpen(false);
    setEditingLink(null);
  };

  // Duplicar enlaces seleccionados
  const handleDuplicateSelected = (ids: string[]) => {
    startTransition(async () => {
      let count = 0;
      for (const id of ids) {
        const original = links.find((l) => l.id === id);
        if (original) {
          const res = await createShareLinkAction(
            original.dashboardId,
            `${original.name} (Copia)`,
            1
          );
          if (res.success && res.data) {
            const newItem: DashboardShareWithDetails = {
              ...res.data,
              dashboard: original.dashboard,
              createdBy: original.createdBy,
            };
            setLinks((prev) => [newItem, ...prev]);
            count++;
          }
        }
      }
      setSelectedIds(new Set());
      toast.success(`${count} enlace(s) duplicado(s) exitosamente`);
    });
  };

  // Eliminar
  const handleDeleteSelected = async (ids: string[]) => {
    if (!confirm(`¿Eliminar ${ids.length} enlace(s) compartido(s)?`)) return;

    startTransition(async () => {
      const res = await deleteShareLinksAction(ids);
      if (res.success) {
        setLinks((prev) => prev.filter((l) => !ids.includes(l.id)));
        setSelectedIds(new Set());
        toast.success("Enlaces eliminados");
      } else {
        toast.error(res.error || "Error al eliminar");
      }
    });
  };

  const handleGlobalAction = (action: "edit" | "duplicate" | "delete") => {
    if (action === "edit" && selectedIds.size === 1) {
      const id = Array.from(selectedIds)[0];
      const link = links.find((l) => l.id === id);
      if (link) openEditModal(link);
    } else if (action === "duplicate") {
      handleDuplicateSelected(Array.from(selectedIds));
    } else if (action === "delete") {
      handleDeleteSelected(Array.from(selectedIds));
    }
  };

  const allOnPageSelected =
    paginated.length > 0 && paginated.every((l) => selectedIds.has(l.id));

  return (
    <>
      <ConfigTableLayout
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Buscar enlace por nombre, tablero o sección..."
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
            <span>Crear Enlace</span>
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
              <th className="px-4 py-3 font-semibold">Nombre del Enlace</th>
              <th className="px-3 py-3 font-semibold">Tablero</th>
              <th className="px-3 py-3 font-semibold">Sección</th>
              <th className="px-3 py-3 font-semibold">Creado por</th>
              <th className="px-3 py-3 font-semibold">Creado el</th>
              <th className="px-3 py-3 font-semibold">URL Relativa</th>
              <th className="w-20 px-3 py-3 text-center">Activo</th>
              <th className="w-16 px-3 py-3 text-center">Copiar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-10 text-muted-foreground">
                  <Link2 className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p>No se encontraron enlaces compartidos</p>
                </td>
              </tr>
            ) : (
              paginated.map((l) => {
                const isSelected = selectedIds.has(l.id);
                const isCopied = copiedId === l.id;

                return (
                  <tr
                    key={l.id}
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
                        onChange={() => handleToggleSelect(l.id)}
                        className="rounded border-border size-3.5 text-primary focus:ring-primary cursor-pointer"
                      />
                    </td>

                    {/* Nombre */}
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <Link2 className="size-3.5 text-primary shrink-0" />
                        <span className="truncate">{l.name}</span>
                      </div>
                    </td>

                    {/* Tablero */}
                    <td className="px-3 py-2.5 text-foreground font-medium">
                      {l.dashboard?.name || "—"}
                    </td>

                    {/* Sección */}
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {l.dashboard?.section ? (
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {l.dashboard.section.name}
                        </Badge>
                      ) : (
                        <span className="italic text-[11px] text-muted-foreground/60">
                          Sin sección
                        </span>
                      )}
                    </td>

                    {/* Creado por */}
                    <td className="px-3 py-2.5 text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <User className="size-3 text-muted-foreground" />
                        <span>{l.createdBy?.username || "Admin"}</span>
                      </div>
                    </td>

                    {/* Creado el */}
                    <td className="px-3 py-2.5 text-muted-foreground tabular-nums">
                      {new Date(l.createdAt).toLocaleDateString("es-PE", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>

                    {/* URL Relativa (/share/[uuid]) */}
                    <td className="px-3 py-2.5">
                      <code className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        /share/{l.id.slice(0, 8)}...
                      </code>
                    </td>

                    {/* Activo (Toggle Switch) */}
                    <td className="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(l.id, l.isActive)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                          l.isActive ? "bg-primary" : "bg-muted-foreground/30"
                        }`}
                        title={l.isActive ? "Enlace activo" : "Enlace desactivado"}
                      >
                        <span
                          className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                            l.isActive ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </td>

                    {/* Icono Copiar */}
                    <td className="px-3 py-2.5 text-center">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleCopy(l.id)}
                        className="size-7 rounded-md cursor-pointer hover:bg-muted"
                        title="Copiar URL al portapapeles"
                      >
                        {isCopied ? (
                          <Check className="size-3.5 text-green-600" />
                        ) : (
                          <Copy className="size-3.5 text-muted-foreground group-hover:text-foreground" />
                        )}
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </ConfigTableLayout>

      {/* Modal: Crear Enlace Compartido */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Link2 className="size-5 text-primary" />
                Crear Enlace Compartido
              </DialogTitle>
              <DialogDescription className="text-xs">
                Genera un identificador único (UUID) para compartir el acceso
                directo a un tablero.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Etiqueta del enlace *
                </label>
                <Input
                  required
                  autoFocus
                  value={newLinkName}
                  onChange={(e) => setNewLinkName(e.target.value)}
                  placeholder="Ej. Compartido con Dirección General"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Tablero a compartir *
                </label>
                <select
                  required
                  value={newDashboardId}
                  onChange={(e) => setNewDashboardId(e.target.value)}
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {availableDashboards.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
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
                Generar Enlace
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Enlace */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleUpdate}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit2 className="size-4.5 text-primary" />
                Editar Enlace Compartido
              </DialogTitle>
            </DialogHeader>

            <div className="py-4 space-y-3">
              <label className="text-xs font-semibold text-foreground">
                Etiqueta del enlace
              </label>
              <Input
                required
                autoFocus
                value={editLinkName}
                onChange={(e) => setEditLinkName(e.target.value)}
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

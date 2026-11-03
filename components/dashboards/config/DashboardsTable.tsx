"use client";

import React, { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Eye,
  Sliders,
  Plus,
  Shield,
  Users,
  Copy,
  Trash2,
  ExternalLink,
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
  PermissionSelector,
  type PermissionSelection,
  type PermissionItem,
} from "./PermissionSelector";
import {
  createDashboardAction,
  updateDashboardAction,
  toggleDashboardPublishedAction,
  deleteDashboardsAction,
  duplicateDashboardAction,
} from "@/app/dashboards/config/actions";
import type { DashboardSection } from "@prisma/client";
import type { DashboardWithDetails } from "@/lib/services/dashboard.service";
import { toast } from "sonner";

interface DashboardsTableProps {
  initialDashboards: DashboardWithDetails[];
  sections: DashboardSection[];
  availableRoles: PermissionItem[];
  availableUsers: PermissionItem[];
}

export function DashboardsTable({
  initialDashboards,
  sections,
  availableRoles,
  availableUsers,
}: DashboardsTableProps) {
  const [dashboards, setDashboards] = useState<DashboardWithDetails[]>(initialDashboards);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPending, startTransition] = useTransition();

  // Estados del Formulario (Creación / Edición)
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formSectionId, setFormSectionId] = useState("");
  const [formIsPublished, setFormIsPublished] = useState(false);
  const [formRoleAccess, setFormRoleAccess] = useState<PermissionSelection[]>([]);
  const [formUserAccess, setFormUserAccess] = useState<PermissionSelection[]>([]);

  // Filtrado
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return dashboards;
    const q = searchQuery.toLowerCase();
    return dashboards.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.section && d.section.name.toLowerCase().includes(q))
    );
  }, [dashboards, searchQuery]);

  // Paginado
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // Selección Múltiple
  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(paginated.map((d) => d.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Abrir Modal de Creación
  const openCreateModal = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormName("");
    setFormSectionId(sections[0]?.id || "");
    setFormIsPublished(false);
    setFormRoleAccess([]);
    setFormUserAccess([]);
    setModalOpen(true);
  };

  // Abrir Modal de Edición (Clic en Fila)
  const openEditModal = (dashboard: DashboardWithDetails) => {
    setIsEditing(true);
    setEditingId(dashboard.id);
    setFormName(dashboard.name);
    setFormSectionId(dashboard.sectionId || sections[0]?.id || "");
    setFormIsPublished(dashboard.isPublished);

    // Mapear roleAccess
    setFormRoleAccess(
      dashboard.roleAccess.map((ra) => ({
        id: ra.roleId,
        canView: ra.canView,
        canEdit: ra.canEdit,
      }))
    );

    // Mapear userAccess
    setFormUserAccess(
      dashboard.userAccess.map((ua) => ({
        id: ua.userId,
        canView: ua.canView,
        canEdit: ua.canEdit,
      }))
    );

    setModalOpen(true);
  };

  // Guardar (Crear o Editar)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSectionId) {
      toast.error("Por favor completa los campos obligatorios");
      return;
    }

    startTransition(async () => {
      if (isEditing && editingId) {
        const res = await updateDashboardAction(editingId, {
          name: formName.trim(),
          sectionId: formSectionId,
          isPublished: formIsPublished,
          roleAccess: formRoleAccess.map((r) => ({
            roleId: r.id,
            canView: r.canView,
            canEdit: r.canEdit,
          })),
          userAccess: formUserAccess.map((u) => ({
            userId: u.id,
            canView: u.canView,
            canEdit: u.canEdit,
          })),
        });

        if (res.success && res.data) {
          setDashboards((prev) =>
            prev.map((d) => (d.id === editingId ? res.data : d))
          );
          toast.success("Tablero actualizado exitosamente");
          setModalOpen(false);
        } else {
          toast.error(res.error || "Error al actualizar");
        }
      } else {
        const res = await createDashboardAction({
          name: formName.trim(),
          sectionId: formSectionId,
          isPublished: formIsPublished,
          createdById: 1, // Usuario actual
          roleAccess: formRoleAccess.map((r) => ({
            roleId: r.id,
            canView: r.canView,
            canEdit: r.canEdit,
          })),
          userAccess: formUserAccess.map((u) => ({
            userId: u.id,
            canView: u.canView,
            canEdit: u.canEdit,
          })),
        });

        if (res.success && res.data) {
          setDashboards((prev) => [res.data, ...prev]);
          toast.success("Tablero creado exitosamente");
          setModalOpen(false);
        } else {
          toast.error(res.error || "Error al crear");
        }
      }
    });
  };

  // Toggle Switch Publicado
  const handleTogglePublished = (
    id: string,
    currentVal: boolean,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    const nextVal = !currentVal;

    // Optimista
    setDashboards((prev) =>
      prev.map((d) => (d.id === id ? { ...d, isPublished: nextVal } : d))
    );

    startTransition(async () => {
      const res = await toggleDashboardPublishedAction(id, nextVal);
      if (res.success) {
        toast.success(
          nextVal ? "Tablero publicado" : "Tablero marcado como borrador"
        );
      } else {
        // Revertir
        setDashboards((prev) =>
          prev.map((d) => (d.id === id ? { ...d, isPublished: currentVal } : d))
        );
        toast.error("Error al actualizar estado");
      }
    });
  };

  // Acciones Globales (Barra Superior)
  const handleGlobalAction = (action: "edit" | "duplicate" | "delete") => {
    if (action === "edit" && selectedIds.size === 1) {
      const id = Array.from(selectedIds)[0];
      const d = dashboards.find((item) => item.id === id);
      if (d) openEditModal(d);
    } else if (action === "duplicate") {
      const ids = Array.from(selectedIds);
      startTransition(async () => {
        let count = 0;
        for (const id of ids) {
          const res = await duplicateDashboardAction(id, 1);
          if (res.success && res.data) {
            setDashboards((prev) => [res.data, ...prev]);
            count++;
          }
        }
        setSelectedIds(new Set());
        if (count > 0) {
          toast.success(`${count} tablero(s) duplicado(s) exitosamente`);
        } else {
          toast.error("Error al duplicar tablero(s)");
        }
      });
    } else if (action === "delete") {
      const ids = Array.from(selectedIds);
      if (!confirm(`¿Eliminar ${ids.length} tablero(s)?`)) return;
      startTransition(async () => {
        const res = await deleteDashboardsAction(ids);
        if (res.success) {
          setDashboards((prev) => prev.filter((d) => !ids.includes(d.id)));
          setSelectedIds(new Set());
          toast.success("Tableros eliminados");
        } else {
          toast.error(res.error || "Error al eliminar");
        }
      });
    }
  };

  const allOnPageSelected =
    paginated.length > 0 && paginated.every((d) => selectedIds.has(d.id));

  return (
    <>
      <ConfigTableLayout
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Buscar tablero por nombre o sección..."
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
            onClick={openCreateModal}
            className="h-8 gap-1.5 text-xs font-semibold cursor-pointer shadow-xs"
          >
            <Plus className="size-3.5" />
            <span>Nuevo Tablero</span>
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
              <th className="px-4 py-3 font-semibold">Nombre del Tablero</th>
              <th className="px-3 py-3 font-semibold">Sección</th>
              <th className="px-3 py-3 font-semibold">Permisos de Acceso</th>
              <th className="w-24 px-3 py-3 text-center">Publicado</th>
              <th className="w-48 px-3 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-muted-foreground">
                  <LayoutDashboard className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p>No se encontraron tableros</p>
                </td>
              </tr>
            ) : (
              paginated.map((d) => {
                const isSelected = selectedIds.has(d.id);
                const roleCount = d.roleAccess?.length ?? 0;
                const userCount = d.userAccess?.length ?? 0;

                return (
                  <tr
                    key={d.id}
                    onClick={() => openEditModal(d)}
                    className={`group transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-primary/5 hover:bg-primary/10"
                        : "hover:bg-muted/40"
                    }`}
                  >
                    {/* Checkbox */}
                    <td
                      className="px-3 py-2.5 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(d.id)}
                        className="rounded border-border size-3.5 text-primary focus:ring-primary cursor-pointer"
                      />
                    </td>

                    {/* Nombre */}
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <LayoutDashboard className="size-3.5 text-primary shrink-0" />
                        <span className="truncate">{d.name}</span>
                      </div>
                    </td>

                    {/* Sección */}
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {d.section ? (
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {d.section.name}
                        </Badge>
                      ) : (
                        <span className="italic text-[11px] text-muted-foreground/60">
                          Sin sección
                        </span>
                      )}
                    </td>

                    {/* Permisos (Badges Roles / Usuarios y Lectura/Edición) */}
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-1">
                        {roleCount === 0 && userCount === 0 ? (
                          <span className="text-[11px] text-muted-foreground italic">
                            Acceso general
                          </span>
                        ) : (
                          <>
                            {d.roleAccess?.slice(0, 2).map((ra) => (
                              <Badge
                                key={ra.id}
                                variant="outline"
                                className="text-[10px] gap-1 px-1.5 h-4.5 font-normal bg-background/80 text-foreground border-border/80"
                              >
                                <Shield className="size-2.5 text-primary" />
                                <span>{ra.role.name}</span>
                                <span className="text-muted-foreground font-normal">
                                  ({ra.canEdit ? "Edit" : "Ver"})
                                </span>
                              </Badge>
                            ))}
                            {userCount > 0 && (
                              <Badge
                                variant="outline"
                                className="text-[10px] gap-1 px-1.5 h-4.5 font-normal"
                              >
                                <Users className="size-2.5 text-primary" />
                                <span>{userCount} {userCount === 1 ? "usuario" : "usuarios"}</span>
                              </Badge>
                            )}
                            {roleCount > 2 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{roleCount - 2}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </td>

                    {/* Publicado (Toggle Switch) */}
                    <td
                      className="px-3 py-2.5 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={(e) => handleTogglePublished(d.id, d.isPublished, e)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                          d.isPublished ? "bg-primary" : "bg-muted-foreground/30"
                        }`}
                        title={d.isPublished ? "Publicado (clic para despublicar)" : "Borrador (clic para publicar)"}
                      >
                        <span
                          className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                            d.isPublished ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </td>

                    {/* Botones "Ver" y "Editar diseño" */}
                    <td
                      className="px-3 py-2.5 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/dashboards?id=${d.id}`}>
                          <Button
                            variant="ghost"
                            size="xs"
                            className="h-7 px-2 text-[11px] gap-1 hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="Abrir tablero"
                          >
                            <Eye className="size-3" />
                            <span>Ver</span>
                          </Button>
                        </Link>

                        <Link href={`/dashboards?id=${d.id}&edit=true`}>
                          <Button
                            variant="outline"
                            size="xs"
                            className="h-7 px-2 text-[11px] gap-1 font-medium bg-background hover:bg-muted text-foreground border-border/80"
                            title="Editar diseño de widgets"
                          >
                            <Sliders className="size-3 text-muted-foreground" />
                            <span>Editar diseño</span>
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </ConfigTableLayout>

      {/* ==================================================================== */}
      {/* Modal: Nuevo / Editar Tablero (5 Campos) */}
      {/* ==================================================================== */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <LayoutDashboard className="size-5 text-primary" />
                {isEditing ? "Editar Tablero" : "Nuevo Tablero"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Configura los parámetros principales y la asignación de permisos
                para este tablero.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {/* 1. Nombre del tablero */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Nombre del tablero *
                </label>
                <Input
                  required
                  autoFocus
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej. KPIs de Ventas Diarias, Auditoría Contable..."
                  className="h-9 text-xs"
                />
              </div>

              {/* 2. Sección del tablero (Selector) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Sección del tablero *
                </label>
                <select
                  required
                  value={formSectionId}
                  onChange={(e) => setFormSectionId(e.target.value)}
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Grupos de acceso (Roles) con PermissionSelector */}
              <PermissionSelector
                label="Grupos de acceso (Roles)"
                buttonText="Asignar Roles"
                description="Define qué roles tienen acceso a ver o editar este tablero."
                type="role"
                availableItems={availableRoles}
                selections={formRoleAccess}
                onChange={setFormRoleAccess}
              />

              {/* 4. Usuarios autorizados con PermissionSelector */}
              <PermissionSelector
                label="Usuarios autorizados"
                buttonText="Asignar Usuarios"
                description="Otorga acceso directo a usuarios específicos con permisos de Ver o Editar."
                type="user"
                availableItems={availableUsers}
                selections={formUserAccess}
                onChange={setFormUserAccess}
              />

              {/* 5. Toggle "Publicado" */}
              <div className="pt-2 border-t border-border/80 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Publicado
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Si está desactivado, el tablero quedará guardado como borrador.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormIsPublished(!formIsPublished)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    formIsPublished ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      formIsPublished ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {isEditing ? "Guardar Cambios" : "Crear Tablero"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

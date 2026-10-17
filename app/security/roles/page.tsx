"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { usePermissions } from "@/components/personalized/PermissionsProvider";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { RowActions } from "@/components/shared/RowActions";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Tag } from "@/components/shared/TagCell";
import { RoleForm, type RoleRow } from "./RoleForm";

export default function RolesPage() {
  const { can } = usePermissions();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RoleRow | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/roles?detalle=1", { cache: "no-store" });
      if (!res.ok) {
        throw new Error((await res.json().catch(() => ({}))).error ?? "No se pudo cargar la lista de roles");
      }
      setRoles(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la lista de roles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos remotos
    load();
  }, [load]);

  function abrir(r: RoleRow | null) {
    setEditing(r);
    setFormOpen(true);
  }

  async function removeRole(r: RoleRow) {
    if (!window.confirm(`¿Eliminar el rol ${r.name}? Esta acción no se puede deshacer.`)) return;
    const res = await fetch(`/api/roles/${r.role_id}`, { method: "DELETE" });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "No se pudo eliminar el rol");
    else setError(null);
    await load();
  }

  const columns: DataTableColumn<RoleRow>[] = [
    {
      key: "name",
      header: "Rol",
      sortable: true,
      sortValue: (r) => r.name,
      cell: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{r.name}</span>
          {r.is_system && (
            <Tag tone="neutral" size="sm">
              Sistema
            </Tag>
          )}
        </div>
      ),
    },
    { key: "description", header: "Descripción", cell: (r) => r.description ?? "—" },
    {
      key: "users",
      header: "Usuarios",
      align: "center",
      sortable: true,
      sortValue: (r) => r.total_users,
      cell: (r) => r.total_users,
    },
    {
      key: "permissions",
      header: "Permisos",
      align: "center",
      sortable: true,
      sortValue: (r) => r.permissions.length,
      cell: (r) => r.permissions.length,
    },
    {
      key: "status",
      header: "Estado",
      cell: (r) => (
        <StatusBadge tone={r.active ? "success" : "neutral"} size="sm">
          {r.active ? "Activo" : "Inactivo"}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      align: "right",
      cell: (r) => (
        <RowActions
          actions={[
            { key: "view", label: "Ver", icon: <Eye />, tone: "blue", hidden: !can("roles.editar") || !r.is_system, onClick: () => abrir(r) },
            { key: "edit", label: "Editar", icon: <Pencil />, tone: "amber", hidden: !can("roles.editar") || r.is_system, onClick: () => abrir(r) },
            { key: "delete", label: "Eliminar", icon: <Trash2 />, tone: "rose", hidden: !can("roles.eliminar") || r.is_system, onClick: () => removeRole(r) },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <ModuleHeader
        title="Roles y permisos"
        subtitle="Define qué ventanas y acciones tiene cada rol del sistema."
        icon={ShieldCheck}
      >
        <div className="flex gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href="/security/users" />}>
            Usuarios
          </Button>
          {can("roles.crear") && <Button onClick={() => abrir(null)}>Nuevo rol</Button>}
        </div>
      </ModuleHeader>
      <main className="relative flex-1 w-full min-w-0 p-3 sm:p-4 md:p-6 flex flex-col gap-4">

      {error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {error}
        </p>
      )}

      <DataTable
        columns={columns}
        rows={roles}
        rowKey={(r) => r.role_id}
        loading={loading}
        loadingMode="auto"
        emptyState={{ title: "No hay roles registrados." }}
      />

      <RoleForm
        open={formOpen}
        role={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          load();
        }}
      />
      </main>
    </>
  );
}
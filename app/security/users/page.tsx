"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { RowActions } from "@/components/shared/RowActions";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Tag } from "@/components/shared/TagCell";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Users } from "lucide-react";
import { UserForm, type Role, type UserRow } from "./UserForm";
import { usePermissions } from "@/components/personalized/PermissionsProvider";

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [yo, setYo] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const { can } = usePermissions();

  const load = useCallback(async () => {
    try {
      const [u, r, me] = await Promise.all([fetch("/api/users"), fetch("/api/roles"), fetch("/api/auth/me")]);
      if (!u.ok || !r.ok) throw new Error();
      setUsers(await u.json());
      setRoles(await r.json());
      if (me.ok) setYo((await me.json()).userId);
      setError(null);
    } catch {
      setError("No se pudo cargar la lista de usuarios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos remotos
    load();
  }, [load]);

  async function changeStatus(u: UserRow, active: boolean) {
    const res = await fetch(`/api/users/${u.user_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "No se pudo cambiar el estado");
    else setError(null);
    await load();
  }

  async function closeSession() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  function abrir(u: UserRow | null) {
    setEditing(u);
    setFormOpen(true);
  }

  const columns: DataTableColumn<UserRow>[] = [
    {
      key: "name",
      header: "Nombre",
      sortable: true,
      sortValue: (u) => `${u.employee.first_name} ${u.employee.paternal_last_name}`,
      primary: {
        title: (u) => `${u.employee.first_name} ${u.employee.paternal_last_name}`,
        subtitle: (u) => `@${u.username}`,
        icon: <Users />,
      },
    },
    {
      key: "dni",
      header: "Documento",
      cell: (u) => (
        <div className="flex items-center gap-2">
          <Tag tone="amber" size="sm">
            DNI
          </Tag>
          <span className="font-mono text-sm font-semibold">{u.employee.dni}</span>
        </div>
      ),
    },
    { key: "username", header: "Usuario", sortable: true, sortValue: (u) => u.username, cell: (u) => u.username },
    { key: "email", header: "Correo", cell: (u) => u.email ?? "—" },
    {
      key: "role",
      header: "Rol",
      sortable: true,
      sortValue: (u) => u.role.name,
      cell: (u) => (
        <Tag tone="indigo" variant="soft">
          {u.role.name}
        </Tag>
      ),
    },
    {
      key: "status",
      header: "Estado",
      cell: (u) => (
        <div className="flex items-center gap-2">
          <Switch
            checked={u.active}
            disabled={u.user_id === yo || !can("usuarios.editar")}
            onCheckedChange={(v) => changeStatus(u, v)}
            aria-label={`${u.active ? "Desactivar" : "Activar"} a ${u.username}`}
          />
          <StatusBadge tone={u.active ? "success" : "neutral"} size="sm">
            {u.active ? "Activo" : "Inactivo"}
          </StatusBadge>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      align: "right",
      cell: (u) => (
        <RowActions
          mode="label"
          variant="outline"
          size="sm"
          actions={[{ key: "edit", label: "Editar", hidden: !can("usuarios.editar"), onClick: () => abrir(u) }]}
        />
      ),
    },
  ];

  return (
    <>
<ModuleHeader
  title="Usuarios"
  subtitle="Registro, edición y activación de usuarios del sistema."
  icon={Users}
>
    <div className="flex gap-2">
    <Button variant="outline" nativeButton={false} render={<Link href="/" />}>Volver al inicio</Button>
    {can("roles.ver") && (
      <Button variant="outline" nativeButton={false} render={<Link href="/security/roles" />}>Roles y permisos</Button>
    )}
    <Button variant="outline" onClick={closeSession}>Cerrar sesión</Button>
    {can("usuarios.crear") && <Button onClick={() => abrir(null)}>Nuevo usuario</Button>}
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
        rows={users}
        rowKey={(u) => u.user_id}
        loading={loading}
        loadingMode="auto"
        emptyState={{ title: "No hay usuarios registrados." }}
      />

      <UserForm
        open={formOpen}
        user={editing}
        roles={roles}
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
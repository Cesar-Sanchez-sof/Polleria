"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
<ModuleHeader
  title="Usuarios"
  subtitle="Registro, edición y activación de usuarios del sistema."
  icon={Users}
>
    <div className="flex gap-2">
    <Button variant="outline" render={<Link href="/" />}>Volver al inicio</Button>
    {can("roles.ver") && (
      <Button variant="outline" render={<Link href="/roles" />}>Roles y permisos</Button>
    )}
    <Button variant="outline" onClick={closeSession}>Cerrar sesión</Button>
    {can("usuarios.crear") && <Button onClick={() => abrir(null)}>Nuevo usuario</Button>}
  </div>
</ModuleHeader>

      {error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {error}
        </p>
      )}

      <Table>
        <TableHeader >
          <TableRow className="dark:bg-slate-800/75">
            <TableHead>Nombre</TableHead>
            <TableHead>Documento</TableHead>
            <TableHead>Usuario</TableHead>
            <TableHead>Correo</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                Cargando...
              </TableCell>
            </TableRow>
          )}
          {!loading && users.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                No hay usuarios registrados.
              </TableCell>
            </TableRow>
          )}
          {users.map((u) => (
            <TableRow key={u.user_id}>
              <TableCell>
                {u.employee.first_name} {u.employee.paternal_last_name}
              </TableCell>
              <TableCell>{u.employee.dni}</TableCell>
              <TableCell>{u.username}</TableCell>
              <TableCell>{u.email ?? "—"}</TableCell>
              <TableCell>{u.role.name}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={u.active}
                    disabled={u.user_id === yo || !can("usuarios.editar")}
                    onCheckedChange={(v) => changeStatus(u, v)}
                    aria-label={`${u.active ? "Desactivar" : "Activar"} a ${u.username}`}
                  />
                  <Badge variant={u.active ? "default" : "secondary"}>{u.active ? "Activo" : "Inactivo"}</Badge>
                </div>
              </TableCell>
              <TableCell className="text-right">
                                {can("usuarios.editar") && (
                  <Button size="sm" variant="outline" onClick={() => abrir(u)}>
                    Editar
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

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
  );
}
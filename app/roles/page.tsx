"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { usePermissions } from "@/components/personalized/PermissionsProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <ModuleHeader
        title="Roles y permisos"
        subtitle="Define qué ventanas y acciones tiene cada rol del sistema."
        icon={ShieldCheck}
      >
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/users" />}>
            Usuarios
          </Button>
          {can("roles.crear") && <Button onClick={() => abrir(null)}>Nuevo rol</Button>}
        </div>
      </ModuleHeader>

      {error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {error}
        </p>
      )}

      <Table>
        <TableHeader>
          <TableRow className="dark:bg-slate-800/75">
            <TableHead>Rol</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className="text-center">Usuarios</TableHead>
            <TableHead className="text-center">Permisos</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Cargando...
              </TableCell>
            </TableRow>
          )}
          {!loading && roles.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No hay roles registrados.
              </TableCell>
            </TableRow>
          )}
          {roles.map((r) => (
            <TableRow key={r.role_id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.name}</span>
                  {r.is_system && <Badge variant="secondary">Sistema</Badge>}
                </div>
              </TableCell>
              <TableCell>{r.description ?? "—"}</TableCell>
              <TableCell className="text-center">{r.total_users}</TableCell>
              <TableCell className="text-center">{r.permissions.length}</TableCell>
              <TableCell>
                <Badge variant={r.active ? "default" : "secondary"}>{r.active ? "Activo" : "Inactivo"}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {can("roles.editar") && (
                    <Button size="sm" variant="outline" onClick={() => abrir(r)}>
                      {r.is_system ? "Ver" : "Editar"}
                    </Button>
                  )}
                  {can("roles.eliminar") && !r.is_system && (
                    <Button size="sm" variant="outline" onClick={() => removeRole(r)}>
                      Eliminar
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

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
  );
}
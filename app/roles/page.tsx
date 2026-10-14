"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { usePermisos } from "@/components/personalized/PermisosProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormularioRol, type RolFila } from "./FormularioRol";

export default function RolesPage() {
  const { puede } = usePermisos();
  const [roles, setRoles] = useState<RolFila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState<RolFila | null>(null);

  const cargar = useCallback(async () => {
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
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos remotos
    cargar();
  }, [cargar]);

  function abrir(r: RolFila | null) {
    setEditando(r);
    setFormAbierto(true);
  }

  async function eliminar(r: RolFila) {
    if (!window.confirm(`¿Eliminar el rol ${r.nombre}? Esta acción no se puede deshacer.`)) return;
    const res = await fetch(`/api/roles/${r.id_rol}`, { method: "DELETE" });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "No se pudo eliminar el rol");
    else setError(null);
    await cargar();
  }

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <ModuleHeader
        title="Roles y permisos"
        subtitle="Define qué ventanas y acciones tiene cada rol del sistema."
        icon={ShieldCheck}
      >
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/usuarios" />}>
            Usuarios
          </Button>
          {puede("roles.crear") && <Button onClick={() => abrir(null)}>Nuevo rol</Button>}
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
          {cargando && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Cargando...
              </TableCell>
            </TableRow>
          )}
          {!cargando && roles.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No hay roles registrados.
              </TableCell>
            </TableRow>
          )}
          {roles.map((r) => (
            <TableRow key={r.id_rol}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.nombre}</span>
                  {r.es_sistema && <Badge variant="secondary">Sistema</Badge>}
                </div>
              </TableCell>
              <TableCell>{r.descripcion ?? "—"}</TableCell>
              <TableCell className="text-center">{r.total_usuarios}</TableCell>
              <TableCell className="text-center">{r.permisos.length}</TableCell>
              <TableCell>
                <Badge variant={r.activo ? "default" : "secondary"}>{r.activo ? "Activo" : "Inactivo"}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {puede("roles.editar") && (
                    <Button size="sm" variant="outline" onClick={() => abrir(r)}>
                      {r.es_sistema ? "Ver" : "Editar"}
                    </Button>
                  )}
                  {puede("roles.eliminar") && !r.es_sistema && (
                    <Button size="sm" variant="outline" onClick={() => eliminar(r)}>
                      Eliminar
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <FormularioRol
        abierto={formAbierto}
        rol={editando}
        onCerrar={() => setFormAbierto(false)}
        onGuardado={() => {
          setFormAbierto(false);
          cargar();
        }}
      />
    </main>
  );
}
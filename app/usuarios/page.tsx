"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormularioUsuario, type Rol, type UsuarioFila } from "./FormularioUsuario";

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<UsuarioFila[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [yo, setYo] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState<UsuarioFila | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [u, r, me] = await Promise.all([fetch("/api/usuarios"), fetch("/api/roles"), fetch("/api/auth/me")]);
      if (!u.ok || !r.ok) throw new Error();
      setUsuarios(await u.json());
      setRoles(await r.json());
      if (me.ok) setYo((await me.json()).idUsuario);
      setError(null);
    } catch {
      setError("No se pudo cargar la lista de usuarios");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos remotos
    cargar();
  }, [cargar]);

  async function cambiarEstado(u: UsuarioFila, estado: boolean) {
    const res = await fetch(`/api/usuarios/${u.id_usuario}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "No se pudo cambiar el estado");
    else setError(null);
    await cargar();
  }

  async function cerrarSesion() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  function abrir(u: UsuarioFila | null) {
    setEditando(u);
    setFormAbierto(true);
  }

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Usuarios</h1>
          <p className="text-sm text-muted-foreground">Registro, edición y activación de usuarios del sistema.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/" />}>
            Volver al inicio
          </Button>
          <Button variant="outline" onClick={cerrarSesion}>
            Cerrar sesión
          </Button>
          <Button onClick={() => abrir(null)}>Nuevo usuario</Button>
        </div>
      </header>

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
          {cargando && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                Cargando...
              </TableCell>
            </TableRow>
          )}
          {!cargando && usuarios.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                No hay usuarios registrados.
              </TableCell>
            </TableRow>
          )}
          {usuarios.map((u) => (
            <TableRow key={u.id_usuario}>
              <TableCell>
                {u.empleado.primer_nombre} {u.empleado.apellido_paterno}
              </TableCell>
              <TableCell>{u.empleado.dni}</TableCell>
              <TableCell>{u.username}</TableCell>
              <TableCell>{u.correo ?? "—"}</TableCell>
              <TableCell>{u.rol.nombre}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={u.estado}
                    disabled={u.id_usuario === yo}
                    onCheckedChange={(v) => cambiarEstado(u, v)}
                    aria-label={`${u.estado ? "Desactivar" : "Activar"} a ${u.username}`}
                  />
                  <Badge variant={u.estado ? "default" : "secondary"}>{u.estado ? "Activo" : "Inactivo"}</Badge>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline" onClick={() => abrir(u)}>
                  Editar
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <FormularioUsuario
        abierto={formAbierto}
        usuario={editando}
        roles={roles}
        onCerrar={() => setFormAbierto(false)}
        onGuardado={() => {
          setFormAbierto(false);
          cargar();
        }}
      />
    </main>
  );
}
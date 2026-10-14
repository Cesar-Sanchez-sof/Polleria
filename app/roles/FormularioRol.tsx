"use client";

import { FormEvent, Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MODULOS_PERMISOS, type Accion, type ModuloPermisos } from "@/lib/auth/catalogo-permisos";

export interface RolFila {
  id_rol: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  es_sistema: boolean;
  total_usuarios: number;
  permisos: string[];
}

interface Props {
  abierto: boolean;
  rol: RolFila | null; // null = alta
  onCerrar: () => void;
  onGuardado: () => void;
}

const ACCIONES: Accion[] = ["ver", "crear", "editar", "eliminar"];
const COLUMNA: Record<Accion, string> = { ver: "Ver", crear: "Crear", editar: "Editar", eliminar: "Eliminar" };
const GRUPOS = [...new Set(MODULOS_PERMISOS.map((m) => m.grupo))];

export function FormularioRol({ abierto, rol, onCerrar, onGuardado }: Props) {
  const editando = rol !== null;
  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editando ? "Modificar rol" : "Registrar rol"}</DialogTitle>
          <DialogDescription>
            Define a qué ventanas entra el rol (Ver) y qué acciones puede hacer en ellas.
          </DialogDescription>
        </DialogHeader>
        {/* `key` reinicia el formulario al cambiar entre alta y distintos roles */}
        <Contenido key={rol?.id_rol ?? "nuevo"} rol={rol} onCerrar={onCerrar} onGuardado={onGuardado} />
      </DialogContent>
    </Dialog>
  );
}

function Contenido({ rol, onCerrar, onGuardado }: Omit<Props, "abierto">) {
  const editando = rol !== null;
  const esSistema = rol?.es_sistema ?? false;
  const [nombre, setNombre] = useState(rol?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(rol?.descripcion ?? "");
  const [activo, setActivo] = useState(rol?.activo ?? true);
  const [permisos, setPermisos] = useState<Set<string>>(new Set(rol?.permisos ?? []));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function marcar(modulo: string, accion: Accion, marcado: boolean) {
    setPermisos((prev) => {
      const sig = new Set(prev);
      if (marcado) {
        sig.add(`${modulo}.${accion}`);
        if (accion !== "ver") sig.add(`${modulo}.ver`); // para hacer algo hay que poder ver la ventana
      } else {
        sig.delete(`${modulo}.${accion}`);
        if (accion === "ver") ACCIONES.forEach((a) => sig.delete(`${modulo}.${a}`));
      }
      return sig;
    });
  }

  function marcarFila(m: ModuloPermisos, marcado: boolean) {
    setPermisos((prev) => {
      const sig = new Set(prev);
      m.acciones.forEach((a) => (marcado ? sig.add(`${m.codigo}.${a}`) : sig.delete(`${m.codigo}.${a}`)));
      return sig;
    });
  }

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      const res = await fetch(editando ? `/api/roles/${rol.id_rol}` : "/api/roles", {
        method: editando ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, descripcion, activo, permisos: [...permisos] }),
      });
      if (!res.ok) {
        const cuerpo = await res.json().catch(() => ({}));
        setError(cuerpo.error ?? "No se pudo guardar");
        return;
      }
      onGuardado();
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      {esSistema && (
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          Rol de sistema: tiene todos los permisos y solo se puede cambiar su descripción.
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="nombre">Nombre del rol</Label>
          <Input
            id="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            minLength={3}
            maxLength={50}
            disabled={esSistema}
            placeholder="Ej. SUPERVISOR"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="descripcion">Descripción</Label>
          <Input
            id="descripcion"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            maxLength={150}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="activo" checked={activo} onCheckedChange={setActivo} disabled={esSistema} />
          <Label htmlFor="activo">Rol activo</Label>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Permisos</h3>
          <span className="text-xs text-muted-foreground">{permisos.size} seleccionados</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ventana / módulo</TableHead>
              {ACCIONES.map((a) => (
                <TableHead key={a} className="text-center">
                  {COLUMNA[a]}
                </TableHead>
              ))}
              <TableHead className="text-center">Todo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {GRUPOS.map((grupo) => (
              <Fragment key={grupo}>
                <TableRow>
                  <TableCell colSpan={6} className="bg-muted/50 text-xs font-semibold uppercase tracking-wide">
                    {grupo}
                  </TableCell>
                </TableRow>
                {MODULOS_PERMISOS.filter((m) => m.grupo === grupo).map((m) => {
                  const todos = m.acciones.every((a) => permisos.has(`${m.codigo}.${a}`));
                  return (
                    <TableRow key={m.codigo}>
                      <TableCell>{m.nombre}</TableCell>
                      {ACCIONES.map((a) => (
                        <TableCell key={a} className="text-center">
                          {m.acciones.includes(a) ? (
                            <Checkbox
                              checked={permisos.has(`${m.codigo}.${a}`)}
                              onCheckedChange={(v) => marcar(m.codigo, a, v === true)}
                              disabled={esSistema}
                              aria-label={`${COLUMNA[a]} en ${m.nombre}`}
                            />
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-center">
                        <Checkbox
                          checked={todos}
                          onCheckedChange={(v) => marcarFila(m, v === true)}
                          disabled={esSistema}
                          aria-label={`Todos los permisos de ${m.nombre}`}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCerrar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
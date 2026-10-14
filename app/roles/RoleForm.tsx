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
import { PERMISSION_MODULES, type Action, type PermissionModule } from "@/lib/auth/permissions-catalog";

export interface RoleRow {
  role_id: number;
  name: string;
  description: string | null;
  active: boolean;
  is_system: boolean;
  total_users: number;
  permissions: string[];
}

interface Props {
  open: boolean;
  role: RoleRow | null; // null = alta
  onClose: () => void;
  onSaved: () => void;
}

const ACTIONS: Action[] = ["ver", "crear", "editar", "eliminar"];
const COLUMN: Record<Action, string> = { ver: "Ver", crear: "Crear", editar: "Editar", eliminar: "Eliminar" };
const GROUPS = [...new Set(PERMISSION_MODULES.map((m) => m.group))];

export function RoleForm({ open, role, onClose, onSaved }: Props) {
  const editing = role !== null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Modificar rol" : "Registrar rol"}</DialogTitle>
          <DialogDescription>
            Define a qué ventanas entra el rol (Ver) y qué acciones puede hacer en ellas.
          </DialogDescription>
        </DialogHeader>
        {/* `key` reinicia el formulario al cambiar entre alta y distintos roles */}
        <Content key={role?.role_id ?? "nuevo"} role={role} onClose={onClose} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  );
}

function Content({ role, onClose, onSaved }: Omit<Props, "open">) {
  const editing = role !== null;
  const isSystem = role?.is_system ?? false;
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [active, setActive] = useState(role?.active ?? true);
  const [permissions, setPermissions] = useState<Set<string>>(new Set(role?.permissions ?? []));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function mark(module: string, action: Action, marked: boolean) {
    setPermissions((prev) => {
      const sig = new Set(prev);
      if (marked) {
        sig.add(`${module}.${action}`);
        if (action !== "ver") sig.add(`${module}.ver`); // para hacer algo hay que poder ver la ventana
      } else {
        sig.delete(`${module}.${action}`);
        if (action === "ver") ACTIONS.forEach((a) => sig.delete(`${module}.${a}`));
      }
      return sig;
    });
  }

  function markRow(m: PermissionModule, marked: boolean) {
    setPermissions((prev) => {
      const sig = new Set(prev);
      m.actions.forEach((a) => (marked ? sig.add(`${m.code}.${a}`) : sig.delete(`${m.code}.${a}`)));
      return sig;
    });
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/roles/${role.role_id}` : "/api/roles", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, active, permissions: [...permissions] }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "No se pudo guardar");
        return;
      }
      onSaved();
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {isSystem && (
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          Rol de sistema: tiene todos los permisos y solo se puede cambiar su descripción.
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="nombre">Nombre del rol</Label>
          <Input
            id="nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={3}
            maxLength={50}
            disabled={isSystem}
            placeholder="Ej. SUPERVISOR"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="descripcion">Descripción</Label>
          <Input
            id="descripcion"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={150}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="activo" checked={active} onCheckedChange={setActive} disabled={isSystem} />
          <Label htmlFor="activo">Rol activo</Label>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Permisos</h3>
          <span className="text-xs text-muted-foreground">{permissions.size} seleccionados</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ventana / módulo</TableHead>
              {ACTIONS.map((a) => (
                <TableHead key={a} className="text-center">
                  {COLUMN[a]}
                </TableHead>
              ))}
              <TableHead className="text-center">Todo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {GROUPS.map((group) => (
              <Fragment key={group}>
                <TableRow>
                  <TableCell colSpan={6} className="bg-muted/50 text-xs font-semibold uppercase tracking-wide">
                    {group}
                  </TableCell>
                </TableRow>
                {PERMISSION_MODULES.filter((m) => m.group === group).map((m) => {
                  const all = m.actions.every((a) => permissions.has(`${m.code}.${a}`));
                  return (
                    <TableRow key={m.code}>
                      <TableCell>{m.name}</TableCell>
                      {ACTIONS.map((a) => (
                        <TableCell key={a} className="text-center">
                          {m.actions.includes(a) ? (
                            <Checkbox
                              checked={permissions.has(`${m.code}.${a}`)}
                              onCheckedChange={(v) => mark(m.code, a, v === true)}
                              disabled={isSystem}
                              aria-label={`${COLUMN[a]} en ${m.name}`}
                            />
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-center">
                        <Checkbox
                          checked={all}
                          onCheckedChange={(v) => markRow(m, v === true)}
                          disabled={isSystem}
                          aria-label={`Todos los permisos de ${m.name}`}
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
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
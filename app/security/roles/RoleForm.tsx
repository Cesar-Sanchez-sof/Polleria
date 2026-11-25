"use client";

import { FormEvent, Fragment, useEffect, useState } from "react";
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
  dashboards?: DashboardAccess[];
}

interface DashboardAccess {
  dashboard_id: string;
  can_view: boolean;
  can_edit: boolean;
}

interface DashboardOption {
  dashboard_id: string;
  name: string;
  section: string;
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
  const [dashOptions, setDashOptions] = useState<DashboardOption[]>([]);
  const [dashError, setDashError] = useState<string | null>(null);
  const [dashAccess, setDashAccess] = useState<Map<string, DashboardAccess>>(
    new Map((role?.dashboards ?? []).map((d) => [d.dashboard_id, d])),
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/roles/dashboards", { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error((body as { error?: string } | null)?.error ?? "No se pudieron cargar los tableros");
        if (!cancelled) setDashOptions(Array.isArray(body) ? body : []);
      })
      .catch((e: unknown) => {
        if (!cancelled) setDashError(e instanceof Error ? e.message : "No se pudieron cargar los tableros");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function markDash(id: string, kind: "view" | "edit", marked: boolean) {
    setDashAccess((prev) => {
      const next = new Map(prev);
      const cur = next.get(id) ?? { dashboard_id: id, can_view: false, can_edit: false };
      let { can_view, can_edit } = cur;
      if (kind === "view") {
        can_view = marked;
        if (!marked) can_edit = false;
      } else {
        can_edit = marked;
        if (marked) can_view = true; // editar implica ver
      }
      if (can_view || can_edit) next.set(id, { dashboard_id: id, can_view, can_edit });
      else next.delete(id);
      return next;
    });
  }

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
        body: JSON.stringify({
          name,
          description,
          active,
          permissions: [...permissions],
          // Si no se pudieron cargar los tableros no se envía, para no borrar el acceso existente.
          ...(dashError ? {} : { dashboards: [...dashAccess.values()] }),
        }),
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
                      <TableCell className={m.subgroup ? "pl-10" : undefined}>{m.name}</TableCell>
                      {ACTIONS.map((a) => (
                        <TableCell key={a} className="text-center align-middle [&>*]:mx-auto">
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
                      <TableCell className="text-center align-middle [&>*]:mx-auto">
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

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Tableros (dashboards)</h3>
          <span className="text-xs text-muted-foreground">
            {isSystem ? "Acceso total" : `${dashAccess.size} con acceso`}
          </span>
        </div>
        {isSystem ? (
          <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">El rol de sistema ve y edita todos los tableros.</p>
        ) : dashError ? (
          <p className="text-sm text-destructive">{dashError}. El acceso a tableros no se modificará al guardar.</p>
        ) : dashOptions.length === 0 ? (
          <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Aún no hay tableros creados.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tablero</TableHead>
                <TableHead className="text-center">Ver</TableHead>
                <TableHead className="text-center">Editar diseño</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...new Set(dashOptions.map((d) => d.section))].map((section) => (
                <Fragment key={section}>
                  <TableRow>
                    <TableCell colSpan={3} className="bg-muted/50 text-xs font-semibold uppercase tracking-wide">
                      {section}
                    </TableCell>
                  </TableRow>
                  {dashOptions
                    .filter((d) => d.section === section)
                    .map((d) => {
                      const a = dashAccess.get(d.dashboard_id);
                      return (
                        <TableRow key={d.dashboard_id}>
                          <TableCell>{d.name}</TableCell>
                          <TableCell className="text-center align-middle [&>*]:mx-auto">
                            <Checkbox
                              checked={a?.can_view ?? false}
                              onCheckedChange={(v) => markDash(d.dashboard_id, "view", v === true)}
                              aria-label={`Ver el tablero ${d.name}`}
                            />
                          </TableCell>
                          <TableCell className="text-center align-middle [&>*]:mx-auto">
                            <Checkbox
                              checked={a?.can_edit ?? false}
                              onCheckedChange={(v) => markDash(d.dashboard_id, "edit", v === true)}
                              aria-label={`Editar el tablero ${d.name}`}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}
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
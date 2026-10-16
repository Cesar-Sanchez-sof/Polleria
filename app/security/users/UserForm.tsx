"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export interface Role {
  role_id: number;
  name: string;
}

export interface UserRow {
  user_id: number;
  username: string;
  email: string | null;
  active: boolean;
  last_access: string | null;
  role: Role;
  employee: {
    employee_id: number;
    dni: string;
    first_name: string;
    middle_name: string | null;
    paternal_last_name: string;
    maternal_last_name: string | null;
  };
}

interface Props {
  open: boolean;
  user: UserRow | null; // null = alta
  roles: Role[];
  onClose: () => void;
  onSaved: () => void;
}

/** Un solo formulario para empleado + usuario, tanto para el alta como para la edición. */
export function UserForm({ open, user, roles, onClose, onSaved }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editing = user !== null;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await fetch(editing ? `/api/users/${user.user_id}` : "/api/users", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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

  const e = user?.employee;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Modificar usuario" : "Registrar usuario"}</DialogTitle>
          <DialogDescription>Datos del empleado y credenciales de acceso.</DialogDescription>
        </DialogHeader>
        {/* `key` reinicia los campos al cambiar entre alta y distintos usuarios */}
        <form key={user?.user_id ?? "nuevo"} onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="first_name" label="Nombre" value={e?.first_name} required />
          <Field id="middle_name" label="Segundo nombre" value={e?.middle_name} />
          <Field id="paternal_last_name" label="Apellido paterno" value={e?.paternal_last_name} required />
          <Field id="maternal_last_name" label="Apellido materno" value={e?.maternal_last_name} />
          <Field id="dni" label="Documento (DNI)" value={e?.dni} required pattern="\d{8}" maxLength={8} inputMode="numeric" />
          <Field id="email" label="Correo" type="email" value={user?.email} required maxLength={80} />
          <Field id="username" label="Nombre de usuario" value={user?.username} required minLength={3} maxLength={20} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="role_id">Rol</Label>
            <NativeSelect id="role_id" name="role_id" defaultValue={user?.role.role_id ?? ""} required className="w-full">
              <NativeSelectOption value="" disabled>
                Selecciona un rol
              </NativeSelectOption>
              {roles.map((r) => (
                <NativeSelectOption key={r.role_id} value={r.role_id}>
                  {r.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="sm:col-span-2">
            <Field
              id="password"
              label={editing ? "Nueva contraseña (opcional)" : "Contraseña"}
              type="password"
              required={!editing}
              minLength={8}
              autoComplete="new-password"
              help="Mínimo 8 caracteres, con letras y números."
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive sm:col-span-2">
              {error}
            </p>
          )}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  value,
  type = "text",
  required,
  pattern,
  help,
  ...rest
}: {
  id: string;
  label: string;
  value?: string | null;
  type?: string;
  required?: boolean;
  pattern?: string;
  help?: string;
} & Omit<React.ComponentProps<typeof Input>, "id" | "name" | "type" | "required" | "pattern" | "value" | "defaultValue">) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} type={type} defaultValue={value ?? ""} required={required} pattern={pattern} {...rest} />
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}
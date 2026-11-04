"use client";

import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, RefreshCw } from "lucide-react";
import { AppButton } from "@/components/shared/AppButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { api } from "../_lib/hr-client";

export interface AccessFormState {
  enabled: boolean;
  username: string;
  email: string;
  role_id: string;
  password: string;
}

/** Contraseña temporal legible que cumple la política (8+ caracteres, letras y números). */
export function generatePassword(): string {
  const letters = "abcdefghjkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const digits = "23456789";
  const pick = (set: string, n: number) => Array.from({ length: n }, () => set[Math.floor(Math.random() * set.length)]).join("");
  return `${pick(upper, 1)}${pick(letters, 4)}${pick(digits, 4)}`;
}

/** Sugerencia de usuario: inicial del nombre + apellido paterno (sin tildes ni espacios). */
export function suggestUsername(first: string, paternal: string): string {
  const clean = (t: string) =>
    t
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  return `${clean(first).slice(0, 1)}${clean(paternal)}`.slice(0, 20);
}

/** Rol sugerido según el área del contrato (se puede cambiar). */
const ROLE_BY_AREA: Record<string, string> = { caja: "CAJERO", salón: "MESERO", salon: "MESERO", bar: "MESERO", cocina: "COCINERO" };

export function emptyAccess(): AccessFormState {
  return { enabled: true, username: "", email: "", role_id: "", password: generatePassword() };
}

export function toAccessPayload(a: AccessFormState) {
  return a.enabled ? { username: a.username, email: a.email, role_id: Number(a.role_id), password: a.password } : null;
}

export function validateAccess(a: AccessFormState): string | null {
  if (!a.enabled) return null;
  if (!/^[a-z0-9._-]{3,20}$/.test(a.username)) return "El usuario debe tener de 3 a 20 caracteres: minúsculas, números, punto o guion";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)) return "Indica un correo válido para el usuario";
  if (!a.role_id) return "Selecciona el rol del usuario";
  if (a.password.length < 8 || !/[A-Za-z]/.test(a.password) || !/\d/.test(a.password)) {
    return "La contraseña debe tener al menos 8 caracteres, con letras y números";
  }
  return null;
}

/**
 * Datos de acceso al sistema. `optional` muestra la casilla para no crearlo (p. ej. un
 * repartidor que no usa el sistema); `area` sugiere el rol.
 */
export function AccessFields({
  value,
  onChange,
  optional = true,
  area,
}: {
  value: AccessFormState;
  onChange: (p: Partial<AccessFormState>) => void;
  optional?: boolean;
  area?: string;
}) {
  const [roles, setRoles] = useState<Array<{ role_id: number; name: string }>>([]);
  useEffect(() => {
    api<Array<{ role_id: number; name: string }>>("/api/roles")
      .then(setRoles)
      .catch(() => setRoles([]));
  }, []);

  // Sugiere el rol por el área mientras no se haya elegido uno.
  useEffect(() => {
    if (value.role_id || roles.length === 0 || !area) return;
    const wanted = ROLE_BY_AREA[area.trim().toLowerCase()];
    const role = roles.find((r) => r.name === wanted);
    if (role) onChange({ role_id: String(role.role_id) });
  }, [roles, area, value.role_id, onChange]);

  return (
    <div className="flex flex-col gap-4">
      {optional && (
        <label className="flex items-start gap-2 rounded-xl border p-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={value.enabled} onChange={(e) => onChange({ enabled: e.target.checked })} />
          <span>
            <b>Crear su usuario del sistema.</b> Con él inicia sesión, marca su asistencia al entrar y consulta «Mi horario y asistencia».
            Desmárcalo si no usará el sistema (p. ej. un repartidor externo); podrás dárselo después desde su ficha.
          </span>
        </label>
      )}
      {value.enabled && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="acc-username">
              Usuario <span className="text-red-500">*</span>
            </Label>
            <Input
              id="acc-username"
              maxLength={20}
              value={value.username}
              onChange={(e) => onChange({ username: e.target.value.toLowerCase().replace(/\s/g, "") })}
              className="font-mono"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="acc-email">
              Correo <span className="text-red-500">*</span>
            </Label>
            <Input id="acc-email" type="email" maxLength={80} value={value.email} onChange={(e) => onChange({ email: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="acc-role">
              Rol <span className="text-red-500">*</span>
            </Label>
            <NativeSelect id="acc-role" className="w-full" value={value.role_id} onChange={(e) => onChange({ role_id: e.target.value })}>
              <NativeSelectOption value="">Selecciona un rol</NativeSelectOption>
              {roles.map((r) => (
                <NativeSelectOption key={r.role_id} value={r.role_id}>
                  {r.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <p className="text-[11px] text-muted-foreground">Define qué pantallas y acciones puede usar (Seguridad → Roles y permisos).</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="acc-password">
              Contraseña temporal <span className="text-red-500">*</span>
            </Label>
            <div className="flex gap-2">
              <Input id="acc-password" value={value.password} onChange={(e) => onChange({ password: e.target.value })} className="font-mono" />
              <AppButton variant="secondary" icon={<RefreshCw />} ariaLabel="Generar otra" onClick={() => onChange({ password: generatePassword() })} />
            </div>
            <p className="text-[11px] text-muted-foreground">Entrégasela al trabajador; podrá cambiarla luego.</p>
          </div>
        </div>
      )}
    </div>
  );
}

/** Credenciales recién creadas, para entregarlas al trabajador (se muestran una sola vez). */
export function CredentialsCard({ username, password, role }: { username: string; password: string; role: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(`Usuario: ${username}\nContraseña: ${password}`);
      setCopied(true);
    } catch {
      /* sin portapapeles */
    }
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-900/60 dark:bg-emerald-950/40">
      <p className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-200">
        <KeyRound className="h-4 w-4" /> Acceso al sistema creado ({role})
      </p>
      <p>
        Usuario: <b className="font-mono">{username}</b>
      </p>
      <p>
        Contraseña temporal: <b className="font-mono">{password}</b>
      </p>
      <p className="text-xs text-muted-foreground">Cópialas y entrégaselas ahora: la contraseña no se vuelve a mostrar.</p>
      <div>
        <AppButton size="sm" variant="secondary" icon={copied ? <Check /> : <Copy />} onClick={copy}>
          {copied ? "Copiado" : "Copiar credenciales"}
        </AppButton>
      </div>
    </div>
  );
}

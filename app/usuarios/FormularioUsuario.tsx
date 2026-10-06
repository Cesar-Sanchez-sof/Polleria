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

export interface Rol {
  id_rol: number;
  nombre: string;
}

export interface UsuarioFila {
  id_usuario: number;
  username: string;
  correo: string | null;
  estado: boolean;
  ultimo_acceso: string | null;
  rol: Rol;
  empleado: {
    id_empleado: number;
    dni: string;
    primer_nombre: string;
    segundo_nombre: string | null;
    apellido_paterno: string;
    apellido_materno: string | null;
  };
}

interface Props {
  abierto: boolean;
  usuario: UsuarioFila | null; // null = alta
  roles: Rol[];
  onCerrar: () => void;
  onGuardado: () => void;
}

/** Un solo formulario para empleado + usuario, tanto para el alta como para la edición. */
export function FormularioUsuario({ abierto, usuario, roles, onCerrar, onGuardado }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const editando = usuario !== null;

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    const datos = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await fetch(editando ? `/api/usuarios/${usuario.id_usuario}` : "/api/usuarios", {
        method: editando ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
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

  const e = usuario?.empleado;
  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editando ? "Modificar usuario" : "Registrar usuario"}</DialogTitle>
          <DialogDescription>Datos del empleado y credenciales de acceso.</DialogDescription>
        </DialogHeader>
        {/* `key` reinicia los campos al cambiar entre alta y distintos usuarios */}
        <form key={usuario?.id_usuario ?? "nuevo"} onSubmit={enviar} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo id="primer_nombre" etiqueta="Nombre" valor={e?.primer_nombre} requerido />
          <Campo id="segundo_nombre" etiqueta="Segundo nombre" valor={e?.segundo_nombre} />
          <Campo id="apellido_paterno" etiqueta="Apellido paterno" valor={e?.apellido_paterno} requerido />
          <Campo id="apellido_materno" etiqueta="Apellido materno" valor={e?.apellido_materno} />
          <Campo id="dni" etiqueta="Documento (DNI)" valor={e?.dni} requerido patron="\d{8}" maxLength={8} inputMode="numeric" />
          <Campo id="correo" etiqueta="Correo" tipo="email" valor={usuario?.correo} requerido maxLength={80} />
          <Campo id="username" etiqueta="Nombre de usuario" valor={usuario?.username} requerido minLength={3} maxLength={20} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="id_rol">Rol</Label>
            <NativeSelect id="id_rol" name="id_rol" defaultValue={usuario?.rol.id_rol ?? ""} required className="w-full">
              <NativeSelectOption value="" disabled>
                Selecciona un rol
              </NativeSelectOption>
              {roles.map((r) => (
                <NativeSelectOption key={r.id_rol} value={r.id_rol}>
                  {r.nombre}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="sm:col-span-2">
            <Campo
              id="password"
              etiqueta={editando ? "Nueva contraseña (opcional)" : "Contraseña"}
              tipo="password"
              requerido={!editando}
              minLength={8}
              autoComplete="new-password"
              ayuda="Mínimo 8 caracteres, con letras y números."
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive sm:col-span-2">
              {error}
            </p>
          )}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Campo({
  id,
  etiqueta,
  valor,
  tipo = "text",
  requerido,
  patron,
  ayuda,
  ...resto
}: {
  id: string;
  etiqueta: string;
  valor?: string | null;
  tipo?: string;
  requerido?: boolean;
  patron?: string;
  ayuda?: string;
} & Omit<React.ComponentProps<typeof Input>, "id" | "name" | "type" | "required" | "pattern" | "defaultValue">) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{etiqueta}</Label>
      <Input id={id} name={id} type={tipo} defaultValue={valor ?? ""} required={requerido} pattern={patron} {...resto} />
      {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
    </div>
  );
}
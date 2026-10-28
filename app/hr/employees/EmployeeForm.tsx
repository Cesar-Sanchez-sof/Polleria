"use client";

import { FormEvent, useRef, useState } from "react";
import { Search } from "lucide-react";
import { AppButton } from "@/components/shared/AppButton";
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

export const CONTRACT_TYPES = ["Planilla", "Part-time", "Por horas", "Locación de servicios", "Prácticas"];

export interface EmployeeRow {
  employee_id: number;
  dni: string;
  first_name: string;
  middle_name: string | null;
  paternal_last_name: string;
  maternal_last_name: string | null;
  full_name: string;
  phone: string | null;
  address: string | null;
  birth_date: string | null;
  hire_date: string;
  position: string | null;
  area: string | null;
  contract_type: string | null;
  base_salary: number;
  active: boolean;
  has_user: boolean;
    /** Horarios asignados de hoy en adelante; `next_shift` es el más próximo. */
  upcoming_shifts: number;
  next_shift: { shift_id: number; name: string; date: string; start_time: string; end_time: string } | null;
}

interface Props {
  open: boolean;
  employee: EmployeeRow | null; // null = alta
  onClose: () => void;
  onSaved: (employee: EmployeeRow, created: boolean) => void;
}

const today = () => new Date().toISOString().slice(0, 10);

/** Un solo formulario para registrar y para editar la información de un empleado. */
export function EmployeeForm({ open, employee, onClose, onSaved }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [looking, setLooking] = useState(false);
  const editing = employee !== null;

  /** Autocompleta nombres y apellidos desde RENIEC (misma API que clientes y proveedores). */
  async function lookup() {
    const form = formRef.current;
    if (!form) return;
    const dni = (form.elements.namedItem("dni") as HTMLInputElement).value.trim();
    if (!/^\d{8}$/.test(dni)) {
      setError("Ingresa un DNI de 8 dígitos para consultarlo");
      return;
    }
    setError(null);
    setLooking(true);
    try {
      const res = await fetch(`/api/document-lookup?tipo=dni&numero=${dni}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "No se pudo consultar el DNI");
      const d = json.data;
      const set = (name: string, value?: string) => {
        if (value) (form.elements.namedItem(name) as HTMLInputElement).value = value;
      };
      set("first_name", d.names);
      set("paternal_last_name", d.paternalLastName);
      set("maternal_last_name", d.maternalLastName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo consultar el DNI");
    } finally {
      setLooking(false);
    }
  }

  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setError(null);
    setSaving(true);
    const data = Object.fromEntries(new FormData(ev.currentTarget));
    try {
      const res = await fetch(editing ? `/api/employees/${employee.employee_id}` : "/api/employees", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "No se pudo guardar");
        return;
      }
      onSaved(body as EmployeeRow, !editing);
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setSaving(false);
    }
  }

  const e = employee;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Empleado" : "Nuevo Empleado"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Modifica los datos personales y laborales del empleado."
              : "Registra los datos personales y laborales del nuevo empleado."}
          </DialogDescription>
        </DialogHeader>
        {/* `key` reinicia los campos al cambiar entre alta y distintos empleados */}
        <form
          ref={formRef}
          key={e?.employee_id ?? "nuevo"}
          onSubmit={submit}
          className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2"
        >
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="dni">
              Documento (DNI) <span className="text-red-500">*</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="dni"
                name="dni"
                defaultValue={e?.dni ?? ""}
                required
                pattern="\d{8}"
                maxLength={8}
                inputMode="numeric"
                className="font-mono"
              />
              <AppButton variant="secondary" icon={<Search />} loading={looking} onClick={lookup} className="shrink-0 whitespace-nowrap">
                Consultar RENIEC
              </AppButton>
            </div>
          </div>
          <Field id="first_name" label="Nombre" value={e?.first_name} required maxLength={50} />
          <Field id="middle_name" label="Segundo nombre" value={e?.middle_name} maxLength={50} />
          <Field id="paternal_last_name" label="Apellido paterno" value={e?.paternal_last_name} required maxLength={50} />
          <Field id="maternal_last_name" label="Apellido materno" value={e?.maternal_last_name} maxLength={50} />
          <Field id="phone" label="Teléfono" value={e?.phone} pattern="9\d{8}" maxLength={9} inputMode="numeric" />
          <Field id="birth_date" label="Fecha de nacimiento" type="date" value={e?.birth_date} max={today()} />
          <div className="sm:col-span-2">
            <Field id="address" label="Dirección" value={e?.address} maxLength={200} />
          </div>
          <Field id="position" label="Cargo" value={e?.position} maxLength={30} placeholder="Mesero, cocinero, cajero…" />
          <Field id="area" label="Área" value={e?.area} maxLength={30} placeholder="Salón, cocina, caja…" />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contract_type">Tipo de contrato</Label>
            <NativeSelect id="contract_type" name="contract_type" defaultValue={e?.contract_type ?? ""} className="w-full">
              <NativeSelectOption value="">Sin especificar</NativeSelectOption>
              {CONTRACT_TYPES.map((c) => (
                <NativeSelectOption key={c} value={c}>
                  {c}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <Field id="base_salary" label="Sueldo base (S/)" type="number" value={e ? String(e.base_salary) : "0"} min={0} step="0.01" />
          <Field id="hire_date" label="Fecha de ingreso" type="date" value={e?.hire_date ?? today()} />
          <p className="self-end text-xs text-muted-foreground">
            El horario se asigna desde Recursos humanos → Horarios laborales.
          </p>
          {error && (
            <p role="alert" className="text-sm font-medium text-rose-600 sm:col-span-2">
              {error}
            </p>
          )}
          <DialogFooter className="pt-2 sm:col-span-2">
            <AppButton variant="secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </AppButton>
            <AppButton type="submit" loading={saving}>
              {editing ? "Guardar Cambios" : "Registrar Empleado"}
            </AppButton>
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
  ...rest
}: {
  id: string;
  label: string;
  value?: string | null;
} & Omit<React.ComponentProps<typeof Input>, "id" | "name" | "value" | "defaultValue">) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <Input id={id} name={id} type={type} defaultValue={value ?? ""} required={required} {...rest} />
    </div>
  );
}
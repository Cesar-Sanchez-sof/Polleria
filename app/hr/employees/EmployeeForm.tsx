"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { AppButton } from "@/components/shared/AppButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EmployeeDto } from "@/lib/services/hr/employees.service";
import { api } from "../_lib/hr-client";

export type EmployeeRow = EmployeeDto;

export interface PersonalData {
  dni: string;
  first_name: string;
  middle_name: string;
  paternal_last_name: string;
  maternal_last_name: string;
  phone: string;
  email: string;
  address: string;
  birth_date: string;
  emergency_contact: string;
  emergency_phone: string;
}

export function emptyPersonal(): PersonalData {
  return {
    dni: "",
    first_name: "",
    middle_name: "",
    paternal_last_name: "",
    maternal_last_name: "",
    phone: "",
    email: "",
    address: "",
    birth_date: "",
    emergency_contact: "",
    emergency_phone: "",
  };
}

export function personalFromEmployee(e: EmployeeDto): PersonalData {
  return {
    dni: e.dni,
    first_name: e.first_name,
    middle_name: e.middle_name ?? "",
    paternal_last_name: e.paternal_last_name,
    maternal_last_name: e.maternal_last_name ?? "",
    phone: e.phone ?? "",
    email: e.email ?? "",
    address: e.address ?? "",
    birth_date: e.birth_date ?? "",
    emergency_contact: e.emergency_contact ?? "",
    emergency_phone: e.emergency_phone ?? "",
  };
}

/** Campos de datos personales (con consulta a RENIEC), usados al contratar y al editar. */
export function PersonalFields({ value, onChange }: { value: PersonalData; onChange: (p: Partial<PersonalData>) => void }) {
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  async function lookup() {
    if (!/^\d{8}$/.test(value.dni)) {
      setLookupError("Ingresa un DNI de 8 dígitos para consultarlo");
      return;
    }
    setLookupError(null);
    setLooking(true);
    try {
      const json = await api<{ success: boolean; error?: string; data: { names?: string; paternalLastName?: string; maternalLastName?: string } }>(
        `/api/document-lookup?tipo=dni&numero=${value.dni}`,
      );
      if (!json.success) throw new Error(json.error || "No se pudo consultar el DNI");
      const [first, ...rest] = (json.data.names ?? "").split(" ");
      onChange({
        first_name: first || value.first_name,
        middle_name: rest.join(" ") || value.middle_name,
        paternal_last_name: json.data.paternalLastName || value.paternal_last_name,
        maternal_last_name: json.data.maternalLastName || value.maternal_last_name,
      });
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : "No se pudo consultar el DNI");
    } finally {
      setLooking(false);
    }
  }

  const field = (key: keyof PersonalData, label: string, props: React.ComponentProps<typeof Input> = {}, required = false) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`p-${key}`}>
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <Input id={`p-${key}`} value={value[key]} onChange={(e) => onChange({ [key]: e.target.value })} {...props} />
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="p-dni">
          Documento (DNI) <span className="text-red-500">*</span>
        </Label>
        <div className="flex gap-2">
          <Input
            id="p-dni"
            value={value.dni}
            onChange={(e) => onChange({ dni: e.target.value.replace(/\D/g, "").slice(0, 8) })}
            inputMode="numeric"
            maxLength={8}
            className="font-mono"
          />
          <AppButton variant="secondary" icon={<Search />} loading={looking} onClick={lookup} className="shrink-0 whitespace-nowrap">
            Consultar RENIEC
          </AppButton>
        </div>
        {lookupError && <p className="text-xs text-rose-600">{lookupError}</p>}
      </div>
      {field("first_name", "Nombre", { maxLength: 50 }, true)}
      {field("middle_name", "Segundo nombre", { maxLength: 50 })}
      {field("paternal_last_name", "Apellido paterno", { maxLength: 50 }, true)}
      {field("maternal_last_name", "Apellido materno", { maxLength: 50 })}
      {field("birth_date", "Fecha de nacimiento", { type: "date" })}
      {field("phone", "Teléfono", { inputMode: "numeric", maxLength: 9, placeholder: "9XXXXXXXX" })}
      {field("email", "Correo", { type: "email", maxLength: 80 })}
      {field("address", "Dirección", { maxLength: 200 })}
      {field("emergency_contact", "Contacto de emergencia", { maxLength: 100, placeholder: "Nombre y parentesco" })}
      {field("emergency_phone", "Teléfono de emergencia", { inputMode: "numeric", maxLength: 9 })}
    </div>
  );
}

interface Props {
  open: boolean;
  employee: EmployeeDto | null;
  onClose: () => void;
  onSaved: (employee: EmployeeDto) => void;
}

/** Edición de los datos personales. Cargo, sueldo y horario se cambian con una adenda del contrato. */
export function EmployeeForm({ open, employee, onClose, onSaved }: Props) {
  const [data, setData] = useState<PersonalData>(() => (employee ? personalFromEmployee(employee) : emptyPersonal()));
  const [loadedFor, setLoadedFor] = useState<number | null>(employee?.employee_id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Recarga los campos al abrir el formulario para otro empleado.
  if (employee && employee.employee_id !== loadedFor) {
    setLoadedFor(employee.employee_id);
    setData(personalFromEmployee(employee));
    setError(null);
  }

  async function submit() {
    if (!employee) return;
    setSaving(true);
    setError(null);
    try {
      onSaved(await api<EmployeeDto>(`/api/employees/${employee.employee_id}`, { method: "PUT", body: data }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar datos personales</DialogTitle>
          <DialogDescription>Cargo, sueldo y horario se modifican con una adenda desde el contrato del trabajador.</DialogDescription>
        </DialogHeader>
        <PersonalFields value={data} onChange={(p) => setData((d) => ({ ...d, ...p }))} />
        {error && (
          <p role="alert" className="text-sm font-medium text-rose-600">
            {error}
          </p>
        )}
        <DialogFooter>
          <AppButton variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </AppButton>
          <AppButton loading={saving} onClick={submit}>
            Guardar cambios
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

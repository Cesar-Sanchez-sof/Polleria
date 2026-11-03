"use client";

import { FormEvent, useState } from "react";
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
import {
  CONTRACT_KINDS,
  CONTRACT_KIND_HINT,
  CONTRACT_KIND_LABEL,
  LABOR_REGIMES,
  LABOR_REGIME_LABEL,
  limaToday,
  MAX_WEEKLY_HOURS,
  PENSION_SYSTEMS,
  PENSION_SYSTEM_LABEL,
  suggestedRenewalStart,
  type ContractKind,
  type ContractStatus,
  type LaborRegime,
  type PensionSystem,
} from "@/lib/hr/contracts";

export interface ContractRow {
  contract_id: number;
  employee_id: number;
  employee_name: string;
  employee_dni: string;
  kind: ContractKind;
  regime: LaborRegime;
  start_date: string;
  end_date: string | null;
  monthly_salary: number;
  weekly_hours: number;
  position: string | null;
  pension_system: PensionSystem;
  family_allowance: boolean;
  notes: string | null;
  renews_contract_id: number | null;
  terminated_at: string | null;
  termination_reason: string | null;
  status: ContractStatus;
  days_to_end: number | null;
}

export interface EmployeeOption {
  employee_id: number;
  full_name: string;
  dni: string;
  position: string | null;
  has_current_contract: boolean;
}

export type ContractFormMode =
  | { type: "create" }
  | { type: "edit"; contract: ContractRow }
  | { type: "renew"; contract: ContractRow };

interface Props {
  open: boolean;
  mode: ContractFormMode;
  employees: EmployeeOption[];
  onClose: () => void;
  onSaved: (contract: ContractRow, mode: ContractFormMode["type"]) => void;
}

/** Un solo formulario para registrar, editar y renovar un contrato. */
export function ContractForm({ open, mode, employees, onClose, onSaved }: Props) {
  const source = mode.type === "create" ? null : mode.contract;
  const renewing = mode.type === "renew";
  const editing = mode.type === "edit";

  const [kind, setKind] = useState<ContractKind>(source?.kind ?? "Indefinite");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isPrivate = kind === "Private";
  const startDefault = renewing ? suggestedRenewalStart(source!.end_date) : (source?.start_date ?? limaToday());
  const endDefault = renewing ? "" : (source?.end_date ?? "");

  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setError(null);
    setSaving(true);
    const form = new FormData(ev.currentTarget);
    const data: Record<string, unknown> = Object.fromEntries(form);
    data.kind = kind;
    data.family_allowance = form.get("family_allowance") === "on";
    if (source) data.employee_id = source.employee_id;
    if (renewing) data.renews_contract_id = source!.contract_id;
    try {
      const res = await fetch(editing ? `/api/contracts/${source!.contract_id}` : "/api/contracts", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "No se pudo guardar");
        return;
      }
      onSaved(body as ContractRow, mode.type);
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setSaving(false);
    }
  }

  const title = renewing ? "Renovar contrato" : editing ? "Editar contrato" : "Nuevo contrato";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {renewing
              ? `Se crea un contrato nuevo para ${source!.employee_name}; el anterior queda en el historial.`
              : editing
                ? "Corrige los datos del contrato. Si cambió algo con efecto legal, mejor rescíndelo y registra otro."
                : "Registra el contrato de un empleado. Un empleado no puede tener dos contratos a la vez."}
          </DialogDescription>
        </DialogHeader>
        {/* `key` reinicia los campos al cambiar de contrato o de modo */}
        <form
          key={`${mode.type}-${source?.contract_id ?? "nuevo"}`}
          onSubmit={submit}
          className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2"
        >
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="employee_id">
              Empleado <span className="text-red-500">*</span>
            </Label>
            {source ? (
              <Input id="employee_id" value={`${source.employee_name} · DNI ${source.employee_dni}`} disabled readOnly />
            ) : (
              <NativeSelect id="employee_id" name="employee_id" required defaultValue="" className="w-full">
                <NativeSelectOption value="" disabled>
                  Elige un empleado
                </NativeSelectOption>
                {employees.map((e) => (
                  <NativeSelectOption key={e.employee_id} value={e.employee_id}>
                    {e.full_name} · {e.dni}
                    {e.has_current_contract ? " (ya tiene contrato)" : ""}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="kind">
              Tipo de contrato <span className="text-red-500">*</span>
            </Label>
            <NativeSelect
              id="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as ContractKind)}
              className="w-full"
            >
              {CONTRACT_KINDS.map((k) => (
                <NativeSelectOption key={k} value={k}>
                  {CONTRACT_KIND_LABEL[k]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <p className="text-xs text-muted-foreground">{CONTRACT_KIND_HINT[kind]}</p>
          </div>

          <Field id="start_date" label="Fecha de inicio" type="date" value={startDefault} required />
          {kind !== "Indefinite" && (
            <Field
              id="end_date"
              label="Fecha de fin"
              type="date"
              value={endDefault}
              required={kind === "FixedTerm"}
              min={startDefault}
            />
          )}

          {!isPrivate && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="regime">
                  Régimen laboral <span className="text-red-500">*</span>
                </Label>
                <NativeSelect
                  id="regime"
                  name="regime"
                  required
                  defaultValue={source && source.regime !== "None" ? source.regime : "Micro"}
                  className="w-full"
                >
                  {LABOR_REGIMES.map((r) => (
                    <NativeSelectOption key={r} value={r}>
                      {LABOR_REGIME_LABEL[r]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pension_system">
                  Sistema de pensiones <span className="text-red-500">*</span>
                </Label>
                <NativeSelect
                  id="pension_system"
                  name="pension_system"
                  required
                  defaultValue={source && source.pension_system !== "None" ? source.pension_system : "ONP"}
                  className="w-full"
                >
                  {PENSION_SYSTEMS.map((p) => (
                    <NativeSelectOption key={p} value={p}>
                      {PENSION_SYSTEM_LABEL[p]}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            </>
          )}

          <Field
            id="monthly_salary"
            label={isPrivate ? "Honorario mensual (S/)" : "Remuneración mensual (S/)"}
            type="number"
            value={source ? String(source.monthly_salary) : ""}
            required
            min={0.01}
            step="0.01"
          />
          <Field
            id="weekly_hours"
            label="Jornada semanal (horas)"
            type="number"
            value={String(source?.weekly_hours ?? MAX_WEEKLY_HOURS)}
            min={1}
            max={MAX_WEEKLY_HOURS}
            step={1}
          />
          <Field id="position" label="Cargo" value={source?.position} maxLength={30} placeholder="Mesero, cocinero, cajero…" />
          {!isPrivate && (
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input
                type="checkbox"
                name="family_allowance"
                defaultChecked={source?.family_allowance ?? false}
                className="h-4 w-4 rounded border-input"
              />
              Recibe asignación familiar
            </label>
          )}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="notes">Observaciones</Label>
            <textarea
              id="notes"
              name="notes"
              defaultValue={source?.notes ?? ""}
              maxLength={300}
              rows={2}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

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
              {renewing ? "Renovar contrato" : editing ? "Guardar cambios" : "Registrar contrato"}
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

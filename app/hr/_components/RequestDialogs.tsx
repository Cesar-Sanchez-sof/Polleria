"use client";

import { useEffect, useState } from "react";
import { HandCoins, ShieldPlus, Umbrella } from "lucide-react";
import { AppButton } from "@/components/shared/AppButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EmployeeDto } from "@/lib/services/employees.service";
import type { InsuranceDto } from "@/lib/services/hr/benefits.service";
import {
  INSURANCE_TYPE_LABEL,
  LEAVE_TYPE_LABEL,
  MAX_ADVANCE_INSTALLMENTS,
  checkVacationRequest,
  daysInclusive,
  essaludContribution,
  installmentAmount,
  type InsuranceTypeCode,
  type LeaveTypeCode,
  type VacationBalance,
} from "@/lib/services/hr/labor-rules";
import { api, money } from "../_lib/hr-client";

const todayIso = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);

function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-sm font-medium text-rose-600">
      {error}
    </p>
  );
}

/** Selector de empleados activos (se omite en autoservicio). */
export function EmployeePicker({ value, onChange, id = "employee" }: { value: number | null; onChange: (id: number | null) => void; id?: string }) {
  const [employees, setEmployees] = useState<EmployeeDto[]>([]);
  useEffect(() => {
    api<EmployeeDto[]>("/api/employees?active=true")
      .then(setEmployees)
      .catch(() => setEmployees([]));
  }, []);
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        Trabajador <span className="text-red-500">*</span>
      </Label>
      <NativeSelect id={id} className="w-full" value={value ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
        <NativeSelectOption value="">Selecciona un trabajador</NativeSelectOption>
        {employees.map((e) => (
          <NativeSelectOption key={e.employee_id} value={e.employee_id}>
            {e.full_name} {e.position ? `· ${e.position}` : ""}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vacaciones y permisos
// ---------------------------------------------------------------------------

interface LeaveDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  /** Autoservicio: el trabajador pide para sí mismo (sin selector, siempre queda pendiente). */
  self?: { balance: VacationBalance };
  /** RR. HH. puede registrar la solicitud ya aprobada. */
  canApprove?: boolean;
  defaultEmployeeId?: number | null;
}

export function LeaveDialog({ open, onClose, onSaved, self, canApprove = false, defaultEmployeeId = null }: LeaveDialogProps) {
  const [employeeId, setEmployeeId] = useState<number | null>(defaultEmployeeId);
  const [type, setType] = useState<LeaveTypeCode>("Vacaciones");
  const [start, setStart] = useState(todayIso());
  const [end, setEnd] = useState(todayIso());
  const [reason, setReason] = useState("");
  const [documentRef, setDocumentRef] = useState("");
  const [advance, setAdvance] = useState(false);
  const [approve, setApprove] = useState(false);
  const [balance, setBalance] = useState<VacationBalance | null>(self?.balance ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (self || !open || !employeeId) return;
    api<VacationBalance>(`/api/leaves?balance_of=${employeeId}`)
      .then(setBalance)
      .catch(() => setBalance(null));
  }, [employeeId, open, self]);

  const days = start && end && end >= start ? daysInclusive(start, end) : 0;
  const currentBalance = self?.balance ?? (employeeId ? balance : null);
  const check = type === "Vacaciones" && currentBalance && days > 0 ? checkVacationRequest(currentBalance, days, true) : null;
  const needsAdvance = check?.ok === true && check.isAdvance;

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const body = { employee_id: employeeId, type, start_date: start, end_date: end, reason, document_ref: documentRef, advance, approve };
      const res = await api<{ status: string; type_label: string; shifts_released?: number }>(self ? "/api/me/leaves" : "/api/leaves", {
        method: "POST",
        body,
      });
      onSaved(
        res.status === "Aprobada"
          ? `${res.type_label} registrada y aprobada${res.shifts_released ? ` (se liberaron ${res.shifts_released} horario(s))` : ""}`
          : `${res.type_label} enviada: queda pendiente de aprobación`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar la solicitud");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Umbrella className="h-5 w-5 text-primary" /> {self ? "Solicitar vacaciones o permiso" : "Registrar vacaciones, licencia o permiso"}
          </DialogTitle>
          <DialogDescription>Las vacaciones se cuentan en días calendario. Al aprobarse, el trabajador sale de los horarios de esas fechas.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {!self && (
            <div className="sm:col-span-2">
              <EmployeePicker value={employeeId} onChange={setEmployeeId} />
            </div>
          )}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="l-type">Tipo</Label>
            <NativeSelect id="l-type" className="w-full" value={type} onChange={(e) => setType(e.target.value as LeaveTypeCode)}>
              {(Object.keys(LEAVE_TYPE_LABEL) as LeaveTypeCode[]).map((t) => (
                <NativeSelectOption key={t} value={t}>
                  {LEAVE_TYPE_LABEL[t]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="l-start">Desde</Label>
            <Input id="l-start" type="date" value={start} min={self ? todayIso() : undefined} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="l-end">Hasta</Label>
            <Input id="l-end" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
          </div>

          {type === "Vacaciones" && currentBalance && (
            <div className="rounded-xl border bg-muted/30 p-3 text-xs sm:col-span-2">
              <p className="mb-1 font-semibold">Saldo de vacaciones</p>
              <p>
                Ganados disponibles: <b>{currentBalance.available_days} día(s)</b> · Adelanto posible:{" "}
                <b>{currentBalance.max_with_advance - currentBalance.available_days} día(s)</b> · Solicitas: <b>{days} día(s)</b>
              </p>
              {check && !check.ok && <p className="mt-1 text-rose-600">{check.error}</p>}
              {needsAdvance && (
                <label className="mt-2 flex items-start gap-2 text-amber-800 dark:text-amber-300">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={advance} onChange={(e) => setAdvance(e.target.checked)} />
                  Solicito el adelanto de {days - currentBalance.available_days} día(s) de vacaciones aún no ganados (D. Leg. 1405). Se descontarán de
                  mi próximo récord vacacional.
                </label>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="l-reason">Motivo {(type === "PermisoPersonal" || type === "LicenciaSinGoce") && <span className="text-red-500">*</span>}</Label>
            <Input id="l-reason" maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {type !== "Vacaciones" && type !== "PermisoPersonal" && (
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="l-doc">Documento de sustento</Label>
              <Input id="l-doc" maxLength={60} value={documentRef} onChange={(e) => setDocumentRef(e.target.value)} placeholder="N.° de CITT, certificado médico, partida…" />
            </div>
          )}
          {!self && canApprove && (
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={approve} onChange={(e) => setApprove(e.target.checked)} />
              Registrar como aprobada (p. ej. descanso médico ya presentado)
            </label>
          )}
        </div>
        <ErrorText error={error} />
        <DialogFooter>
          <AppButton variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </AppButton>
          <AppButton loading={saving} onClick={submit} disabled={(!self && !employeeId) || days === 0}>
            {self ? "Enviar solicitud" : "Registrar"}
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Adelantos de sueldo
// ---------------------------------------------------------------------------

interface AdvanceLimit {
  eligible: boolean;
  max_amount: number;
  has_open: boolean;
}

export function AdvanceDialog({
  open,
  onClose,
  onSaved,
  self,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  self?: { limit: AdvanceLimit };
}) {
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [limit, setLimit] = useState<AdvanceLimit | null>(self?.limit ?? null);
  const [amount, setAmount] = useState("");
  const [installments, setInstallments] = useState(1);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (self || !open || !employeeId) return;
    api<AdvanceLimit>(`/api/advances?limit_of=${employeeId}`)
      .then(setLimit)
      .catch(() => setLimit(null));
  }, [employeeId, open, self]);

  const current = self?.limit ?? (employeeId ? limit : null);
  const value = Number(amount) || 0;

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await api(self ? "/api/me/advances" : "/api/advances", {
        method: "POST",
        body: { employee_id: employeeId, amount, installments, reason },
      });
      onSaved("Adelanto registrado: queda pendiente de aprobación");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar el adelanto");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandCoins className="h-5 w-5 text-primary" /> {self ? "Solicitar adelanto de sueldo" : "Registrar adelanto de sueldo"}
          </DialogTitle>
          <DialogDescription>Hasta el 50 % del sueldo básico, en 1 a {MAX_ADVANCE_INSTALLMENTS} cuotas descontadas en planilla. Uno a la vez.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {!self && <EmployeePicker value={employeeId} onChange={setEmployeeId} />}
          {current && (
            <p className={`rounded-lg p-2.5 text-xs ${current.eligible ? "bg-muted/40" : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"}`}>
              {current.eligible
                ? `Tope disponible: ${money.format(current.max_amount)}`
                : current.has_open
                  ? "Tiene un adelanto en curso: debe terminar de descontarse antes de pedir otro."
                  : "No aplica: requiere contrato laboral vigente."}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="a-amount">Monto (S/)</Label>
              <Input id="a-amount" type="number" min={1} step="0.01" max={current?.max_amount} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="a-inst">Cuotas</Label>
              <NativeSelect id="a-inst" className="w-full" value={installments} onChange={(e) => setInstallments(Number(e.target.value))}>
                {Array.from({ length: MAX_ADVANCE_INSTALLMENTS }, (_, i) => i + 1).map((n) => (
                  <NativeSelectOption key={n} value={n}>
                    {n} {n === 1 ? "cuota" : "cuotas"}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>
          {value > 0 && <p className="text-xs text-muted-foreground">Descuento mensual: {money.format(installmentAmount(value, installments))}</p>}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="a-reason">
              Motivo <span className="text-red-500">*</span>
            </Label>
            <Input id="a-reason" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <ErrorText error={error} />
        <DialogFooter>
          <AppButton variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </AppButton>
          <AppButton loading={saving} onClick={submit} disabled={(!self && !employeeId) || !current?.eligible}>
            {self ? "Enviar solicitud" : "Registrar"}
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Seguros
// ---------------------------------------------------------------------------

const PROVIDERS: Record<InsuranceTypeCode, string> = {
  EsSalud: "EsSalud",
  EPS: "",
  SCTR: "",
  VidaLey: "",
  SeguroPrivado: "",
};

export function InsuranceDialog({
  open,
  insurance,
  defaultEmployeeId = null,
  onClose,
  onSaved,
}: {
  open: boolean;
  insurance: InsuranceDto | null;
  defaultEmployeeId?: number | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [loadedFor, setLoadedFor] = useState<number | "new" | null>(null);
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [type, setType] = useState<InsuranceTypeCode>("VidaLey");
  const [provider, setProvider] = useState("");
  const [policy, setPolicy] = useState("");
  const [start, setStart] = useState(todayIso());
  const [end, setEnd] = useState("");
  const [cost, setCost] = useState("");
  const [dependents, setDependents] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const target = open ? (insurance?.insurance_id ?? "new") : null;
  if (target !== loadedFor) {
    setLoadedFor(target);
    setError(null);
    setEmployeeId(insurance?.employee_id ?? defaultEmployeeId);
    setType(insurance?.type ?? "VidaLey");
    setProvider(insurance?.provider ?? "");
    setPolicy(insurance?.policy_number ?? "");
    setStart(insurance?.start_date ?? todayIso());
    setEnd(insurance?.end_date ?? "");
    setCost(insurance ? String(insurance.monthly_cost) : "");
    setDependents(insurance?.covers_dependents ?? false);
    setNotes(insurance?.notes ?? "");
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const body = {
        employee_id: employeeId,
        type,
        provider,
        policy_number: policy,
        start_date: start,
        end_date: end || null,
        monthly_cost: cost,
        covers_dependents: dependents,
        notes,
      };
      await api(insurance ? `/api/insurances/${insurance.insurance_id}` : "/api/insurances", { method: insurance ? "PUT" : "POST", body });
      onSaved(insurance ? "Seguro actualizado" : "Seguro registrado");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el seguro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldPlus className="h-5 w-5 text-primary" /> {insurance ? "Editar seguro" : "Registrar seguro"}
          </DialogTitle>
          <DialogDescription>
            El Seguro Vida Ley es obligatorio desde el primer día de trabajo. EsSalud se registra automáticamente al contratar.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            {insurance ? <p className="text-sm font-semibold">{insurance.employee_name}</p> : <EmployeePicker value={employeeId} onChange={setEmployeeId} />}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="i-type">Tipo de seguro</Label>
            <NativeSelect
              id="i-type"
              className="w-full"
              value={type}
              onChange={(e) => {
                const t = e.target.value as InsuranceTypeCode;
                setType(t);
                if (!provider) setProvider(PROVIDERS[t]);
              }}
            >
              {(Object.keys(INSURANCE_TYPE_LABEL) as InsuranceTypeCode[]).map((t) => (
                <NativeSelectOption key={t} value={t}>
                  {INSURANCE_TYPE_LABEL[t]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="i-provider">Aseguradora</Label>
            <Input id="i-provider" maxLength={80} value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Rímac, Pacífico, La Positiva…" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="i-policy">N.° de póliza {type !== "EsSalud" && type !== "SeguroPrivado" && <span className="text-red-500">*</span>}</Label>
            <Input id="i-policy" maxLength={40} value={policy} onChange={(e) => setPolicy(e.target.value)} className="font-mono" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="i-cost">Costo mensual (S/)</Label>
            <Input id="i-cost" type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
            {type === "EsSalud" && <p className="text-[11px] text-muted-foreground">9 % del sueldo (mínimo {money.format(essaludContribution(0))})</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="i-start">Inicio de cobertura</Label>
            <Input id="i-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="i-end">Fin de cobertura</Label>
            <Input id="i-end" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={dependents} onChange={(e) => setDependents(e.target.checked)} />
            Cubre a derechohabientes (cónyuge e hijos)
          </label>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="i-notes">Observaciones</Label>
            <Input id="i-notes" maxLength={200} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <ErrorText error={error} />
        <DialogFooter>
          <AppButton variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </AppButton>
          <AppButton loading={saving} onClick={submit} disabled={!insurance && !employeeId}>
            Guardar
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

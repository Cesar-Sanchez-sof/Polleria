"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, FileSignature, KeyRound, UserPlus, UserX } from "lucide-react";
import { usePermissions } from "@/components/personalized/PermissionsProvider";
import { AccessFields, CredentialsCard, emptyAccess, suggestUsername, toAccessPayload, validateAccess, type AccessFormState } from "./AccessFields";
import { AppButton } from "@/components/shared/AppButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ContractDto } from "@/lib/services/hr/contracts.service";
import type { EmployeeDto } from "@/lib/services/hr/employees.service";
import { CONTRACT_TYPE_LABEL, LABOR_REGIME_LABEL, addDaysIso } from "@/lib/services/hr/labor-rules";
import { api, fmtDate, money } from "../_lib/hr-client";
import { PersonalFields, emptyPersonal, type PersonalData } from "../employees/EmployeeForm";
import {
  ContractTermsFields,
  ScheduleFields,
  contractFromDto,
  emptyContract,
  toContractPayload,
  useScheduleSummary,
  type ContractFormState,
} from "./ContractFields";
import { useShiftTemplates } from "./useShiftTemplates";

const todayIso = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);

function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-sm font-medium text-rose-600">
      {error}
    </p>
  );
}

function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
              i < current ? "bg-emerald-600 text-white" : i === current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {i < current ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <span className={i === current ? "font-semibold" : "text-muted-foreground"}>{s}</span>
          {i < steps.length - 1 && <span className="h-px w-4 bg-border sm:w-8" />}
        </li>
      ))}
    </ol>
  );
}

type StepName = "Datos personales" | "Contrato" | "Horario" | "Acceso al sistema" | "Confirmar";

/**
 * Contratar personal: datos personales → condiciones del contrato → horario pactado → acceso al
 * sistema (opcional) → resumen. Todo se guarda en una sola operación: no hay personal activo sin
 * contrato ni horario, y su usuario queda vinculado a su registro de empleado.
 */
export function HireWizard({ open, onClose, onHired }: { open: boolean; onClose: () => void; onHired: (e: EmployeeDto) => void }) {
  const { can } = usePermissions();
  const canGrant = can("usuarios.crear");
  const steps: StepName[] = ["Datos personales", "Contrato", "Horario", ...(canGrant ? (["Acceso al sistema"] as const) : []), "Confirmar"];
  const [step, setStep] = useState(0);
  const [personal, setPersonal] = useState<PersonalData>(emptyPersonal);
  const [contract, setContract] = useState<ContractFormState>(() => emptyContract(todayIso()));
  const [access, setAccess] = useState<AccessFormState>(emptyAccess);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ employee: EmployeeDto; user: { username: string; role: string } | null; password: string } | null>(null);
  const { templates } = useShiftTemplates(open);
  const { summary, error: scheduleError } = useScheduleSummary(contract, templates);
  const current = steps[step];

  function reset() {
    setStep(0);
    setPersonal(emptyPersonal());
    setContract(emptyContract(todayIso()));
    setAccess(emptyAccess());
    setError(null);
    setDone(null);
  }

  function validate(): string | null {
    if (current === "Datos personales") {
      if (!/^\d{8}$/.test(personal.dni)) return "El DNI debe tener 8 dígitos";
      if (!personal.first_name.trim() || !personal.paternal_last_name.trim()) return "Completa el nombre y el apellido paterno";
    }
    if (current === "Contrato") {
      if (!contract.position.trim() || !contract.area.trim()) return "Indica el cargo y el área";
      if (!contract.start_date) return "Indica la fecha de inicio";
      if (contract.contract_type !== "Indeterminado" && !contract.end_date) return "Indica la fecha de término del contrato";
      if (contract.pension_system === "AFP" && !contract.afp_name) return "Selecciona la AFP";
    }
    if (current === "Horario" && scheduleError) return scheduleError;
    if (current === "Acceso al sistema") return validateAccess(access);
    return null;
  }

  function next() {
    const v = validate();
    setError(v);
    if (v) return;
    // Al llegar al acceso se sugieren usuario y correo con los datos personales.
    if (steps[step + 1] === "Acceso al sistema") {
      setAccess((a) => ({
        ...a,
        enabled: a.username ? a.enabled : contract.contract_type !== "LocacionServicios",
        username: a.username || suggestUsername(personal.first_name, personal.paternal_last_name),
        email: a.email || personal.email,
      }));
    }
    setStep((s) => s + 1);
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await api<{ employee: EmployeeDto; user: { username: string; role: string } | null }>("/api/employees", {
        method: "POST",
        body: { personal, contract: toContractPayload(contract), access: canGrant ? toAccessPayload(access) : null },
      });
      if (res.user) {
        // Se muestran las credenciales una sola vez para entregarlas al trabajador.
        setDone({ employee: res.employee, user: res.user, password: access.password });
      } else {
        reset();
        onHired(res.employee);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar la contratación");
    } finally {
      setSaving(false);
    }
  }

  function finish() {
    const e = done?.employee;
    reset();
    if (e) onHired(e);
  }

  const patch = (p: Partial<ContractFormState>) => setContract((c) => ({ ...c, ...p }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && (done ? finish() : onClose())}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" /> Contratar personal
          </DialogTitle>
          <DialogDescription>Registra al trabajador con su contrato, el horario que cumplirá y su acceso al sistema.</DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col gap-4 py-2">
            <p className="text-sm">
              <b>{done.employee.full_name}</b> quedó contratado y su horario de las próximas 2 semanas ya está programado.
            </p>
            {done.user && <CredentialsCard username={done.user.username} password={done.password} role={done.user.role} />}
            <DialogFooter>
              <AppButton onClick={finish}>Listo</AppButton>
            </DialogFooter>
          </div>
        ) : (
          <>
            <Steps steps={steps} current={step} />

            <div className="py-2">
              {current === "Datos personales" && <PersonalFields value={personal} onChange={(p) => setPersonal((d) => ({ ...d, ...p }))} />}
              {current === "Contrato" && <ContractTermsFields value={contract} onChange={patch} />}
              {current === "Horario" && <ScheduleFields value={contract} onChange={patch} templates={templates} />}
              {current === "Acceso al sistema" && (
                <AccessFields value={access} onChange={(p) => setAccess((a) => ({ ...a, ...p }))} area={contract.area} />
              )}
              {current === "Confirmar" && (
                <div className="grid gap-4 text-sm sm:grid-cols-2">
                  <Summary title="Trabajador">
                    <Row k="Nombre" v={[personal.first_name, personal.middle_name, personal.paternal_last_name, personal.maternal_last_name].filter(Boolean).join(" ")} />
                    <Row k="DNI" v={personal.dni} mono />
                    <Row k="Teléfono" v={personal.phone || "—"} />
                  </Summary>
                  <Summary title="Contrato">
                    <Row k="Modalidad" v={CONTRACT_TYPE_LABEL[contract.contract_type]} />
                    <Row k="Régimen" v={LABOR_REGIME_LABEL[contract.labor_regime]} />
                    <Row k="Cargo" v={`${contract.position} · ${contract.area}`} />
                    <Row k="Vigencia" v={`${fmtDate(contract.start_date)} → ${contract.end_date ? fmtDate(contract.end_date) : "indeterminado"}`} />
                    <Row k="Sueldo" v={money.format(Number(contract.base_salary) || 0)} />
                    <Row k="Pensión" v={contract.pension_system === "AFP" ? `AFP ${contract.afp_name}` : contract.pension_system} />
                  </Summary>
                  <Summary title="Jornada">
                    <Row k="Horas semanales" v={summary ? `${summary.weekly_hours} h` : "—"} />
                    <Row k="Días de trabajo" v={summary ? `${summary.working_days} (descansa ${7 - summary.working_days})` : "—"} />
                  </Summary>
                  <Summary title="Acceso al sistema">
                    {canGrant && access.enabled ? (
                      <>
                        <Row k="Usuario" v={access.username} mono />
                        <Row k="Correo" v={access.email} />
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {canGrant ? "Sin usuario: podrás dárselo luego desde su ficha." : "No tienes permiso para crear usuarios: pídeselo a un administrador."}
                      </p>
                    )}
                  </Summary>
                  <Summary title="Al confirmar">
                    <p className="text-xs text-muted-foreground">
                      Se registra el contrato vigente, su horario pactado, la afiliación a EsSalud
                      {canGrant && access.enabled ? " y su usuario del sistema" : ""}, y sus turnos de las próximas 2 semanas quedan programados en
                      Horarios laborales. Luego registra su Seguro Vida Ley.
                    </p>
                  </Summary>
                </div>
              )}
            </div>

            <ErrorText error={error} />
            <DialogFooter className="gap-2">
              {step > 0 ? (
                <AppButton variant="secondary" icon={<ArrowLeft />} onClick={() => setStep((s) => s - 1)} disabled={saving}>
                  Atrás
                </AppButton>
              ) : (
                <AppButton variant="secondary" onClick={onClose}>
                  Cancelar
                </AppButton>
              )}
              {step < steps.length - 1 ? (
                <AppButton icon={<ArrowRight />} iconPosition="end" onClick={next}>
                  Continuar
                </AppButton>
              ) : (
                <AppButton icon={<FileSignature />} loading={saving} onClick={submit}>
                  Confirmar contratación
                </AppButton>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Dar acceso al sistema a un empleado ya registrado que no tiene usuario. */
export function GrantAccessDialog({
  employee,
  onClose,
  onDone,
}: {
  employee: EmployeeDto | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [access, setAccess] = useState<AccessFormState>(emptyAccess);
  const [loadedFor, setLoadedFor] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ username: string; role: string } | null>(null);

  if (employee && employee.employee_id !== loadedFor) {
    setLoadedFor(employee.employee_id);
    setCreated(null);
    setError(null);
    setAccess({ ...emptyAccess(), username: suggestUsername(employee.first_name, employee.paternal_last_name), email: employee.email ?? "" });
  }
  if (!employee) return null;

  async function submit() {
    if (!employee) return;
    const v = validateAccess(access);
    setError(v);
    if (v) return;
    setSaving(true);
    try {
      setCreated(await api<{ username: string; role: string }>(`/api/employees/${employee.employee_id}/access`, { method: "POST", body: toAccessPayload(access) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el usuario");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && (created ? onDone() : onClose())}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" /> Dar acceso al sistema
          </DialogTitle>
          <DialogDescription>
            {employee.full_name} podrá iniciar sesión, marcar su asistencia al entrar y consultar «Mi horario y asistencia».
          </DialogDescription>
        </DialogHeader>
        {created ? (
          <CredentialsCard username={created.username} password={access.password} role={created.role} />
        ) : (
          <AccessFields value={access} onChange={(p) => setAccess((a) => ({ ...a, ...p }))} optional={false} area={employee.area ?? undefined} />
        )}
        <ErrorText error={error} />
        <DialogFooter>
          {created ? (
            <AppButton onClick={onDone}>Listo</AppButton>
          ) : (
            <>
              <AppButton variant="secondary" onClick={onClose} disabled={saving}>
                Cancelar
              </AppButton>
              <AppButton icon={<KeyRound />} loading={saving} onClick={submit}>
                Crear usuario
              </AppButton>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Summary({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <p className="flex justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className={`text-right font-medium ${mono ? "font-mono" : ""}`}>{v}</span>
    </p>
  );
}

/** `employee: null` = se elige en el diálogo entre el personal sin contrato vigente. */
export type ContractDialogMode =
  | { kind: "new"; employee: { employee_id: number; full_name: string } | null }
  | { kind: "renew"; contract: ContractDto }
  | { kind: "edit"; contract: ContractDto };

/** Personal activo o cesado que hoy no tiene contrato vigente (candidatos a un contrato nuevo). */
function WithoutContractPicker({ value, onChange }: { value: number | null; onChange: (e: { employee_id: number; full_name: string } | null) => void }) {
  const [rows, setRows] = useState<EmployeeDto[] | null>(null);
  useEffect(() => {
    api<EmployeeDto[]>("/api/employees")
      .then((list) => setRows(list.filter((e) => !e.contract)))
      .catch(() => setRows([]));
  }, []);
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="nc-employee">
        Trabajador <span className="text-red-500">*</span>
      </Label>
      <NativeSelect
        id="nc-employee"
        className="w-full"
        value={value ?? ""}
        onChange={(e) => {
          const found = rows?.find((r) => r.employee_id === Number(e.target.value));
          onChange(found ? { employee_id: found.employee_id, full_name: found.full_name } : null);
        }}
      >
        <NativeSelectOption value="">{rows === null ? "Cargando…" : rows.length ? "Selecciona a quién contratar" : "Todo el personal ya tiene contrato vigente"}</NativeSelectOption>
        {(rows ?? []).map((e) => (
          <NativeSelectOption key={e.employee_id} value={e.employee_id}>
            {e.full_name} · DNI {e.dni} {e.active ? "" : "(cesado: reingreso)"}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <p className="text-[11px] text-muted-foreground">
        Para alguien que aún no está registrado usa Empleados → «Contratar personal».
      </p>
    </div>
  );
}

/** Nuevo contrato (reingreso), renovación o adenda, con su horario pactado. */
export function ContractDialog({ mode, onClose, onSaved }: { mode: ContractDialogMode | null; onClose: () => void; onSaved: (c: ContractDto) => void }) {
  const [state, setState] = useState<ContractFormState | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [tab, setTab] = useState<"terms" | "schedule">("terms");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [picked, setPicked] = useState<{ employee_id: number; full_name: string } | null>(null);
  const { templates } = useShiftTemplates(mode !== null);

  const modeKey = mode ? (mode.kind === "new" ? `new-${mode.employee?.employee_id ?? "pick"}` : `${mode.kind}-${mode.contract.contract_id}`) : null;
  if (modeKey !== key) {
    setKey(modeKey);
    setTab("terms");
    setError(null);
    setPicked(null);
    if (!mode) setState(null);
    else if (mode.kind === "new") setState(emptyContract(todayIso()));
    else if (mode.kind === "edit") setState(contractFromDto(mode.contract));
    else {
      const start = mode.contract.end_date ? addDaysIso(mode.contract.end_date, 1) : todayIso();
      setState({ ...contractFromDto(mode.contract), start_date: start, end_date: "", trial_end_date: "" });
    }
  }
  const { error: scheduleError } = useScheduleSummary(state ?? emptyContract(todayIso()), templates);

  if (!mode || !state) return null;
  const target = mode.kind === "new" ? (mode.employee ?? picked) : null;
  const name = mode.kind === "new" ? (target?.full_name ?? "el trabajador") : mode.contract.employee_name;
  const title = mode.kind === "new" ? "Nuevo contrato" : mode.kind === "renew" ? "Renovar contrato" : "Adenda al contrato";
  const description =
    mode.kind === "new"
      ? `Registra el contrato de ${name}: modalidad, cargo, vigencia, sueldo, pensión y horario pactado.`
      : mode.kind === "renew"
        ? `El contrato actual de ${name} terminará el día anterior al inicio de la renovación; se conserva su antigüedad.`
        : `Modifica las condiciones pactadas con ${name}. Queda registrado en la auditoría.`;

  async function submit() {
    if (!mode || !state) return;
    if (mode.kind === "new" && !(mode.employee ?? picked)) {
      setError("Selecciona al trabajador");
      return;
    }
    if (scheduleError) {
      setTab("schedule");
      setError(scheduleError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = toContractPayload(state);
      const saved =
        mode.kind === "new"
          ? await api<ContractDto>("/api/contracts", { method: "POST", body: { employee_id: (mode.employee ?? picked)!.employee_id, ...payload } })
          : mode.kind === "renew"
            ? await api<ContractDto>(`/api/contracts/${mode.contract.contract_id}`, { method: "POST", body: { action: "renew", ...payload } })
            : await api<ContractDto>(`/api/contracts/${mode.contract.contract_id}`, { method: "PUT", body: payload });
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el contrato");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" /> {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {mode.kind === "new" && !mode.employee && <WithoutContractPicker value={picked?.employee_id ?? null} onChange={setPicked} />}
        <div className="flex gap-1 rounded-lg bg-muted p-1 text-xs font-semibold">
          {(["terms", "schedule"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-md px-3 py-1.5 ${tab === t ? "bg-background shadow-xs" : "text-muted-foreground"}`}
            >
              {t === "terms" ? "Condiciones" : "Horario pactado"}
            </button>
          ))}
        </div>
        {tab === "terms" ? (
          <ContractTermsFields value={state} onChange={(p) => setState((s) => (s ? { ...s, ...p } : s))} lockType={mode.kind === "edit"} />
        ) : (
          <ScheduleFields value={state} onChange={(p) => setState((s) => (s ? { ...s, ...p } : s))} templates={templates} />
        )}
        <ErrorText error={error} />
        <DialogFooter>
          <AppButton variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </AppButton>
          <AppButton loading={saving} onClick={submit}>
            {mode.kind === "renew" ? "Renovar" : mode.kind === "edit" ? "Guardar adenda" : "Registrar contrato"}
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const TERMINATION_REASONS = [
  "Renuncia voluntaria",
  "Vencimiento del plazo del contrato",
  "Mutuo disenso",
  "No superó el periodo de prueba",
  "Despido por falta grave",
  "Despido por causa relacionada con la capacidad",
  "Fallecimiento",
  "Jubilación",
];

/** Cese: finaliza el contrato, da de baja al empleado, desactiva su acceso y lo retira de horarios futuros. */
export function TerminateDialog({ contract, onClose, onDone }: { contract: ContractDto | null; onClose: () => void; onDone: (msg: string) => void }) {
  const [date, setDate] = useState(todayIso());
  const [reason, setReason] = useState(TERMINATION_REASONS[0]);
  const [detail, setDetail] = useState("");
  const [kind, setKind] = useState<"Finalizado" | "Rescindido">("Finalizado");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!contract) return null;

  async function submit() {
    if (!contract) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api<{ users_deactivated: number; shifts_removed: number }>(`/api/contracts/${contract.contract_id}`, {
        method: "POST",
        body: { action: "terminate", termination_date: date, reason: detail.trim() ? `${reason}: ${detail.trim()}` : reason, kind },
      });
      const extras = [
        res.users_deactivated > 0 ? "se desactivó su acceso al sistema" : "",
        res.shifts_removed > 0 ? `se le retiró de ${res.shifts_removed} horario(s) posteriores` : "",
      ].filter(Boolean);
      onDone(`Cese de ${contract.employee_name} registrado${extras.length ? `: ${extras.join(" y ")}` : ""}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar el cese");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5 text-rose-600" /> Registrar cese
          </DialogTitle>
          <DialogDescription>
            {contract.employee_name} dejará de figurar como personal activo desde el día siguiente al cese. Se desactiva su acceso al sistema y se
            le retira de los horarios posteriores. El historial se conserva.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-date">Último día de labores</Label>
            <Input id="t-date" type="date" value={date} min={contract.start_date} max={contract.end_date ?? undefined} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-kind">Tipo de cese</Label>
            <NativeSelect id="t-kind" className="w-full" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <NativeSelectOption value="Finalizado">Término / renuncia</NativeSelectOption>
              <NativeSelectOption value="Rescindido">Despido / resolución</NativeSelectOption>
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="t-reason">Motivo</Label>
            <NativeSelect id="t-reason" className="w-full" value={reason} onChange={(e) => setReason(e.target.value)}>
              {TERMINATION_REASONS.map((r) => (
                <NativeSelectOption key={r} value={r}>
                  {r}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="t-detail">Detalle (opcional)</Label>
            <Input id="t-detail" maxLength={120} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Carta de renuncia del 01/11, etc." />
          </div>
        </div>
        <ErrorText error={error} />
        <DialogFooter>
          <AppButton variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </AppButton>
          <AppButton variant="danger" icon={<UserX />} loading={saving} onClick={submit}>
            Registrar cese
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarCheck2,
  CalendarClock,
  Edit2,
  FilePlus2,
  KeyRound,
  FileSignature,
  HandCoins,
  RefreshCw,
  ShieldPlus,
  Umbrella,
  UserRound,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { AppButton } from "@/components/shared/AppButton";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/components/personalized/PermissionsProvider";
import type { EmployeeDto } from "@/lib/services/employees.service";
import type { ContractDto } from "@/lib/services/hr/contracts.service";
import type { AttendanceRowDto, AttendanceTotals } from "@/lib/services/hr/attendance.service";
import type { LeaveDto } from "@/lib/services/hr/leaves.service";
import type { AdvanceDto, InsuranceDto } from "@/lib/services/hr/benefits.service";
import { PENSION_SYSTEM_LABEL, addDaysIso, type VacationBalance } from "@/lib/services/hr/labor-rules";
import { EmployeeForm } from "../EmployeeForm";
import { ContractDialog, GrantAccessDialog, TerminateDialog, type ContractDialogMode } from "../../_components/ContractDialogs";
import { ScheduleView } from "../../_components/ContractFields";
import { AdvanceBadge, AttendanceBadge, ContractPhaseBadge, RequestBadge } from "../../_components/HrBadges";
import { InsuranceDialog, LeaveDialog } from "../../_components/RequestDialogs";
import { api, fmtDate, fmtMinutes, money } from "../../_lib/hr-client";

type Tab = "summary" | "contracts" | "attendance" | "leaves" | "benefits";

const todayIso = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);

export default function EmployeeProfilePage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { can } = usePermissions();
  const [tab, setTab] = useState<Tab>("summary");
  const [employee, setEmployee] = useState<EmployeeDto | null>(null);
  const [contracts, setContracts] = useState<ContractDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [contractMode, setContractMode] = useState<ContractDialogMode | null>(null);
  const [terminating, setTerminating] = useState<ContractDto | null>(null);
  const [granting, setGranting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [e, c] = await Promise.all([api<EmployeeDto>(`/api/employees/${id}`), api<ContractDto[]>(`/api/contracts?employee_id=${id}`)]);
      setEmployee(e);
      setContracts(c);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la ficha");
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos remotos
    load();
  }, [load]);

  const current = contracts.find((c) => c.status === "Vigente" && c.start_date <= todayIso()) ?? contracts.find((c) => c.status === "Vigente") ?? null;

  if (error) {
    return (
      <main className="p-6">
        <p className="text-sm font-medium text-rose-600">{error}</p>
        <Link href="/hr/employees" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Volver a empleados
        </Link>
      </main>
    );
  }
  if (!employee) return <main className="p-6 text-sm text-muted-foreground">Cargando ficha…</main>;

  return (
    <>
      <ModuleHeader title={employee.full_name} subtitle={`DNI ${employee.dni} · ${employee.position ?? "Sin contrato vigente"}`} icon={UserRound}>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <AppButton size="sm" variant="ghost" icon={<ArrowLeft />} href="/hr/employees">
            Empleados
          </AppButton>
          {can("empleados.editar") && (
            <AppButton size="sm" variant="secondary" icon={<Edit2 />} onClick={() => setEditing(true)}>
              Datos personales
            </AppButton>
          )}
          {employee.active && !employee.has_user && can("usuarios.crear") && (
            <AppButton size="sm" variant="secondary" icon={<KeyRound />} onClick={() => setGranting(true)}>
              Dar acceso al sistema
            </AppButton>
          )}
          {current && can("contratos.editar") && (
            <AppButton size="sm" variant="secondary" icon={<FileSignature />} onClick={() => setContractMode({ kind: "edit", contract: current })}>
              Adenda
            </AppButton>
          )}
          {current && can("contratos.crear") && !current.renewed_by_id && current.contract_type !== "Indeterminado" && (
            <AppButton size="sm" variant="soft" icon={<RefreshCw />} onClick={() => setContractMode({ kind: "renew", contract: current })}>
              Renovar
            </AppButton>
          )}
          {current && can("contratos.editar") && (
            <AppButton size="sm" variant="danger" icon={<UserX />} onClick={() => setTerminating(current)}>
              Cese
            </AppButton>
          )}
          {!current && can("contratos.crear") && (
            <AppButton
              size="sm"
              icon={<FilePlus2 />}
              onClick={() => setContractMode({ kind: "new", employee: { employee_id: employee.employee_id, full_name: employee.full_name } })}
            >
              {employee.active ? "Registrar contrato" : "Reingresar (nuevo contrato)"}
            </AppButton>
          )}
        </div>
      </ModuleHeader>

      <main className="flex min-w-0 flex-1 flex-col gap-5 p-4 sm:p-6">
        <SegmentedTabs<Tab>
          ariaLabel="Secciones de la ficha"
          value={tab}
          onValueChange={setTab}
          className="max-w-full overflow-x-auto"
          items={[
            { value: "summary", label: "Resumen" },
            { value: "contracts", label: "Contratos", count: contracts.length },
            ...(can("asistencia.ver") ? [{ value: "attendance" as const, label: "Asistencia" }] : []),
            ...(can("vacaciones.ver") ? [{ value: "leaves" as const, label: "Vacaciones y permisos" }] : []),
            ...(can("seguros.ver") || can("anticipos.ver") ? [{ value: "benefits" as const, label: "Seguros y adelantos" }] : []),
          ]}
        />

        {tab === "summary" && <SummaryTab employee={employee} contract={current} />}
        {tab === "contracts" && (
          <ContractsTab
            contracts={contracts}
            canEdit={can("contratos.editar")}
            canCreate={can("contratos.crear")}
            onRenew={(c) => setContractMode({ kind: "renew", contract: c })}
            onEdit={(c) => setContractMode({ kind: "edit", contract: c })}
            onTerminate={setTerminating}
          />
        )}
        {tab === "attendance" && <AttendanceTab employeeId={id} />}
        {tab === "leaves" && <LeavesTab employeeId={id} canCreate={can("vacaciones.crear")} canApprove={can("vacaciones.editar")} />}
        {tab === "benefits" && <BenefitsTab employeeId={id} canInsurance={can("seguros.ver")} canAdvance={can("anticipos.ver")} canCreateInsurance={can("seguros.crear")} />}
      </main>

      <EmployeeForm
        open={editing}
        employee={employee}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          toast.success("Datos personales actualizados");
          load();
        }}
      />
      <ContractDialog
        mode={contractMode}
        onClose={() => setContractMode(null)}
        onSaved={(c) => {
          toast.success(contractMode?.kind === "renew" ? `Contrato renovado desde el ${fmtDate(c.start_date)}` : "Contrato guardado");
          setContractMode(null);
          load();
        }}
      />
      <GrantAccessDialog
        employee={granting ? employee : null}
        onClose={() => setGranting(false)}
        onDone={() => {
          setGranting(false);
          toast.success(`${employee.full_name} ya puede iniciar sesión y marcar su asistencia`);
          load();
        }}
      />
      <TerminateDialog
        contract={terminating}
        onClose={() => setTerminating(null)}
        onDone={(msg) => {
          setTerminating(null);
          toast.success(msg);
          load();
        }}
      />
    </>
  );
}

function Card({ title, icon, children, action }: { title: string; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-bold [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-primary">
          {icon} {title}
        </p>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-dashed py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className={`text-right font-medium ${mono ? "font-mono" : ""}`}>{v ?? "—"}</span>
    </div>
  );
}

function SummaryTab({ employee: e, contract: c }: { employee: EmployeeDto; contract: ContractDto | null }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Datos personales" icon={<UserRound />}>
        <div>
          <Field k="DNI" v={e.dni} mono />
          <Field k="Fecha de nacimiento" v={fmtDate(e.birth_date)} />
          <Field k="Teléfono" v={e.phone} />
          <Field k="Correo" v={e.email} />
          <Field k="Dirección" v={e.address} />
          <Field k="Contacto de emergencia" v={e.emergency_contact ? `${e.emergency_contact}${e.emergency_phone ? ` · ${e.emergency_phone}` : ""}` : null} />
          <Field k="Fecha de ingreso" v={fmtDate(e.hire_date)} />
          <Field k="Acceso al sistema" v={e.has_user ? "Sí" : "No"} />
        </div>
      </Card>
      <Card title="Contrato vigente" icon={<FileSignature />} action={c ? <ContractPhaseBadge phase={c.phase} /> : undefined}>
        {c ? (
          <div>
            <Field k="Modalidad" v={c.contract_type_label} />
            <Field k="Régimen" v={c.labor_regime_label} />
            <Field k="Cargo / área" v={`${c.position} · ${c.area}`} />
            <Field k="Vigencia" v={`${fmtDate(c.start_date)} → ${c.end_date ? fmtDate(c.end_date) : "indeterminado"}`} />
            {c.trial_end_date && <Field k="Periodo de prueba" v={`hasta ${fmtDate(c.trial_end_date)}${c.in_trial ? " (en curso)" : ""}`} />}
            <Field k="Sueldo básico" v={money.format(c.base_salary)} mono />
            <Field k="Asignación familiar" v={c.family_allowance ? "Sí" : "No"} />
            <Field k="Pensión" v={c.pension_system === "AFP" ? `AFP ${c.afp_name}${c.cuspp ? ` · ${c.cuspp}` : ""}` : PENSION_SYSTEM_LABEL[c.pension_system]} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{e.active ? "No tiene contrato vigente: regístralo para formalizar la relación laboral." : "Trabajador cesado."}</p>
        )}
      </Card>
      {c && (
        <div className="lg:col-span-2">
          <Card
            title={`Horario pactado · ${c.weekly_hours} h semanales`}
            icon={<CalendarClock />}
            action={
              e.next_shift ? (
                <span className="text-xs text-muted-foreground">
                  Próximo turno: <b>{e.next_shift.name}</b> {fmtDate(e.next_shift.date)} {e.next_shift.start_time}
                </span>
              ) : undefined
            }
          >
            <ScheduleView schedule={c.schedule} />
          </Card>
        </div>
      )}
    </div>
  );
}

function ContractsTab({
  contracts,
  canEdit,
  canCreate,
  onRenew,
  onEdit,
  onTerminate,
}: {
  contracts: ContractDto[];
  canEdit: boolean;
  canCreate: boolean;
  onRenew: (c: ContractDto) => void;
  onEdit: (c: ContractDto) => void;
  onTerminate: (c: ContractDto) => void;
}) {
  const columns: DataTableColumn<ContractDto>[] = [
    { key: "type", header: "Modalidad", cell: (c) => <span className="text-xs font-semibold">{c.contract_type_label}</span> },
    { key: "position", header: "Cargo", cell: (c) => <span className="text-xs">{`${c.position} · ${c.area}`}</span> },
    {
      key: "dates",
      header: "Vigencia",
      cell: (c) => (
        <span className="text-xs">
          {fmtDate(c.start_date)} → {c.end_date ? fmtDate(c.end_date) : "indeterminado"}
        </span>
      ),
    },
    { key: "salary", header: "Sueldo", align: "right", cell: (c) => <span className="font-mono text-xs">{money.format(c.base_salary)}</span> },
    { key: "hours", header: "Jornada", align: "right", cell: (c) => <span className="text-xs">{c.weekly_hours} h/sem</span> },
    {
      key: "status",
      header: "Estado",
      cell: (c) => (
        <div className="flex flex-col gap-1">
          <ContractPhaseBadge phase={c.phase} />
          {c.termination_reason && <span className="text-[11px] text-muted-foreground">{c.termination_reason}</span>}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (c) =>
        c.status === "Vigente" ? (
          <div className="flex justify-end gap-1">
            {canEdit && (
              <AppButton size="sm" variant="ghost" onClick={() => onEdit(c)}>
                Adenda
              </AppButton>
            )}
            {canCreate && !c.renewed_by_id && c.contract_type !== "Indeterminado" && (
              <AppButton size="sm" variant="ghost" onClick={() => onRenew(c)}>
                Renovar
              </AppButton>
            )}
            {canEdit && (
              <AppButton size="sm" variant="ghost" onClick={() => onTerminate(c)}>
                Cese
              </AppButton>
            )}
          </div>
        ) : null,
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={contracts}
      rowKey={(c) => c.contract_id}
      emptyState={{ icon: <FileSignature className="h-7 w-7" />, title: "Sin contratos registrados" }}
    />
  );
}

function AttendanceTab({ employeeId }: { employeeId: number }) {
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const [data, setData] = useState<{ days: AttendanceRowDto[]; totals: AttendanceTotals } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const [y, m] = month.split("-").map(Number);
    const from = `${month}-01`;
    const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const to = addDaysIso(nextMonth, -1);
    api<{ days: AttendanceRowDto[]; totals: AttendanceTotals }>(`/api/attendance?employee_id=${employeeId}&from=${from}&to=${to}`)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [employeeId, month]);

  const columns: DataTableColumn<AttendanceRowDto>[] = [
    { key: "date", header: "Fecha", cell: (r) => <span className="font-mono text-xs">{fmtDate(r.date)}</span> },
    {
      key: "shifts",
      header: "Turnos",
      cell: (r) => <span className="text-xs">{r.shifts.length ? r.shifts.map((s) => `${s.name} ${s.start_time}–${s.end_time}`).join(", ") : "—"}</span>,
    },
    {
      key: "marks",
      header: "Entrada / salida",
      cell: (r) => (
        <span className="font-mono text-xs">
          {r.check_in ?? "--:--"} / {r.check_out ?? "--:--"}
          {r.check_out_next_day ? " (+1)" : ""}
        </span>
      ),
    },
    { key: "late", header: "Tardanza", align: "right", cell: (r) => <span className="text-xs">{r.late_minutes > 10 ? `${r.late_minutes} min` : "—"}</span> },
    { key: "worked", header: "Trabajado", align: "right", cell: (r) => <span className="text-xs">{r.worked_minutes ? fmtMinutes(r.worked_minutes) : "—"}</span> },
    {
      key: "status",
      header: "Estado",
      cell: (r) => (
        <div className="flex flex-col gap-0.5">
          <AttendanceBadge status={r.status} />
          {r.leave && <span className="text-[11px] text-muted-foreground">{r.leave.label}</span>}
          {r.justification && <span className="text-[11px] text-muted-foreground">{r.justification}</span>}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-9 w-44" aria-label="Mes" />
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard layout="label-first" tone="emerald" label="Puntuales" value={data.totals.on_time} colorValue />
          <StatCard layout="label-first" tone="amber" label="Tardanzas" value={data.totals.late} footerLeft={`${data.totals.late_minutes} min`} colorValue />
          <StatCard layout="label-first" tone="rose" label="Faltas" value={data.totals.absences} colorValue />
          <StatCard layout="label-first" tone="blue" label="Licencias / justificadas" value={data.totals.on_leave + data.totals.justified} colorValue />
          <StatCard layout="label-first" tone="neutral" label="Horas trabajadas" value={fmtMinutes(data.totals.worked_minutes)} />
        </div>
      )}
      <DataTable
        columns={columns}
        rows={(data?.days ?? []).filter((d) => d.status !== "Descanso")}
        rowKey={(r) => r.date}
        loading={!data && !error}
        emptyState={{ icon: <CalendarCheck2 className="h-7 w-7" />, title: "Sin turnos ni marcaciones en el mes" }}
      />
    </div>
  );
}

function LeavesTab({ employeeId, canCreate, canApprove }: { employeeId: number; canCreate: boolean; canApprove: boolean }) {
  const [leaves, setLeaves] = useState<LeaveDto[]>([]);
  const [balance, setBalance] = useState<VacationBalance | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    api<LeaveDto[]>(`/api/leaves?employee_id=${employeeId}`).then(setLeaves).catch(() => setLeaves([]));
    api<VacationBalance>(`/api/leaves?balance_of=${employeeId}`).then(setBalance).catch(() => setBalance(null));
  }, [employeeId]);
  useEffect(() => {
    load();
  }, [load]);

  const columns: DataTableColumn<LeaveDto>[] = [
    {
      key: "type",
      header: "Tipo",
      cell: (l) => (
        <div className="flex flex-col">
          <span className="text-xs font-semibold">{l.type_label}</span>
          {l.is_advance && <span className="text-[11px] text-amber-600">Adelanto de vacaciones</span>}
        </div>
      ),
    },
    { key: "dates", header: "Fechas", cell: (l) => <span className="text-xs">{`${fmtDate(l.start_date)} → ${fmtDate(l.end_date)}`}</span> },
    { key: "days", header: "Días", align: "right", cell: (l) => <span className="font-mono text-xs">{l.days}</span> },
    { key: "reason", header: "Motivo / sustento", cell: (l) => <span className="text-xs text-muted-foreground">{[l.reason, l.document_ref].filter(Boolean).join(" · ") || "—"}</span> },
    { key: "status", header: "Estado", cell: (l) => <RequestBadge status={l.status} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      {balance && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard layout="label-first" tone="emerald" icon={<Umbrella />} label="Días disponibles" value={balance.available_days} colorValue />
          <StatCard layout="label-first" tone="amber" label="Adelanto posible" value={balance.max_with_advance - balance.available_days} colorValue />
          <StatCard layout="label-first" tone="neutral" label="Tomados / solicitados" value={balance.used_days} />
          <StatCard layout="label-first" tone="blue" label="Por año completo" value={`${balance.annual_days} días`} footerLeft={`${balance.months_of_service} meses de servicio`} />
        </div>
      )}
      {canCreate && (
        <div>
          <AppButton size="sm" icon={<Umbrella />} onClick={() => setOpen(true)}>
            Registrar vacaciones o permiso
          </AppButton>
        </div>
      )}
      <DataTable columns={columns} rows={leaves} rowKey={(l) => l.leave_id} emptyState={{ icon: <Umbrella className="h-7 w-7" />, title: "Sin solicitudes registradas" }} />
      {open && (
        <LeaveDialog
          open
          defaultEmployeeId={employeeId}
          canApprove={canApprove}
          onClose={() => setOpen(false)}
          onSaved={(msg) => {
            setOpen(false);
            toast.success(msg);
            load();
          }}
        />
      )}
    </div>
  );
}

function BenefitsTab({
  employeeId,
  canInsurance,
  canAdvance,
  canCreateInsurance,
}: {
  employeeId: number;
  canInsurance: boolean;
  canAdvance: boolean;
  canCreateInsurance: boolean;
}) {
  const [insurances, setInsurances] = useState<InsuranceDto[]>([]);
  const [advances, setAdvances] = useState<AdvanceDto[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    if (canInsurance) api<InsuranceDto[]>(`/api/insurances?employee_id=${employeeId}`).then(setInsurances).catch(() => setInsurances([]));
    if (canAdvance) api<AdvanceDto[]>(`/api/advances?employee_id=${employeeId}`).then(setAdvances).catch(() => setAdvances([]));
  }, [employeeId, canInsurance, canAdvance]);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {canInsurance && (
        <Card
          title="Seguros"
          icon={<ShieldPlus />}
          action={
            canCreateInsurance ? (
              <AppButton size="sm" variant="soft" onClick={() => setOpen(true)}>
                Registrar
              </AppButton>
            ) : undefined
          }
        >
          {insurances.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin seguros registrados.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {insurances.map((i) => (
                <li key={i.insurance_id} className="flex items-center justify-between gap-2 rounded-xl border p-2.5 text-xs">
                  <div>
                    <p className="font-semibold">{i.type_label}</p>
                    <p className="text-muted-foreground">
                      {i.provider}
                      {i.policy_number ? ` · Póliza ${i.policy_number}` : ""} · {money.format(i.monthly_cost)}/mes
                    </p>
                  </div>
                  <StatusBadge tone={i.validity === "Vigente" ? "success" : i.validity === "Por vencer" ? "warning" : i.validity === "Vencida" ? "danger" : "neutral"}>
                    {i.validity}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      {canAdvance && (
        <Card title="Adelantos de sueldo" icon={<HandCoins />}>
          {advances.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin adelantos.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {advances.map((a) => (
                <li key={a.advance_id} className="flex items-center justify-between gap-2 rounded-xl border p-2.5 text-xs">
                  <div>
                    <p className="font-semibold">
                      {money.format(a.amount)} en {a.installments} cuota(s)
                    </p>
                    <p className="text-muted-foreground">
                      {fmtDate(a.request_date)} · {a.reason} · Saldo {money.format(a.balance)}
                    </p>
                  </div>
                  <AdvanceBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      <InsuranceDialog
        open={open}
        insurance={null}
        defaultEmployeeId={employeeId}
        onClose={() => setOpen(false)}
        onSaved={(msg) => {
          setOpen(false);
          toast.success(msg);
          load();
        }}
      />
    </div>
  );
}

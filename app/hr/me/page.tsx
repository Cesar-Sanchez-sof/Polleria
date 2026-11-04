"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, HandCoins, LogIn, LogOut, ShieldPlus, Umbrella, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AppButton } from "@/components/shared/AppButton";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { StatCard } from "@/components/shared/StatCard";
import type { EmployeeDto } from "@/lib/services/employees.service";
import type { ContractDto } from "@/lib/services/hr/contracts.service";
import type { AttendanceRowDto, AttendanceTotals } from "@/lib/services/hr/attendance.service";
import type { LeaveDto } from "@/lib/services/hr/leaves.service";
import type { AdvanceDto, InsuranceDto } from "@/lib/services/hr/benefits.service";
import { WEEKDAY_LABEL, addDaysIso, type VacationBalance } from "@/lib/services/hr/labor-rules";
import { ScheduleView } from "../_components/ContractFields";
import { AdvanceBadge, AttendanceBadge, ContractPhaseBadge, RequestBadge } from "../_components/HrBadges";
import { AdvanceDialog, LeaveDialog } from "../_components/RequestDialogs";
import { api, fmtDate, fmtMinutes, money } from "../_lib/hr-client";
import { PayslipDialog } from "../_components/Payslip";
import type { PayrollLineDto } from "@/lib/services/hr/payroll.service";

type MyPayslip = PayrollLineDto & { period_label: string; status: string };
import { formatWeekRange } from "../schedules/dates";

interface MeData {
  today: string;
  pending_check_out: boolean;
  employee: EmployeeDto;
  contract: ContractDto | null;
  week: { from: string; to: string; days: AttendanceRowDto[]; totals: AttendanceTotals };
  vacation_balance: VacationBalance;
  leaves: LeaveDto[];
  advances: AdvanceDto[];
  advance_limit: { eligible: boolean; max_amount: number; has_open: boolean };
  insurances: InsuranceDto[];
}

export default function MySchedulePage() {
  const [data, setData] = useState<MeData | null>(null);
  const [monday, setMonday] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [clock, setClock] = useState("");
  const [payslips, setPayslips] = useState<MyPayslip[]>([]);
  const [payslip, setPayslip] = useState<MyPayslip | null>(null);

  useEffect(() => {
    api<MyPayslip[]>("/api/me/payslips")
      .then(setPayslips)
      .catch(() => setPayslips([]));
  }, []);

  const load = useCallback(async () => {
    try {
      const d = await api<MeData>(`/api/me${monday ? `?from=${monday}` : ""}`);
      setData(d);
      if (!monday) setMonday(d.week.from);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar tu información");
    }
  }, [monday]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos remotos
    load();
  }, [load]);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("es-PE", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit" }));
    tick();
    const t = setInterval(tick, 15_000);
    return () => clearInterval(t);
  }, []);

  async function mark(action: "check_in" | "check_out") {
    setBusy(true);
    try {
      const r = await api<{ time: string }>("/api/me/attendance", { method: "POST", body: { action } });
      toast.success(`${action === "check_in" ? "Entrada" : "Salida"} registrada a las ${r.time}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo registrar");
    } finally {
      setBusy(false);
    }
  }

  async function cancelLeave(l: LeaveDto) {
    try {
      await api("/api/me/leaves", { method: "PATCH", body: { leave_id: l.leave_id } });
      toast.success("Solicitud anulada");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo anular");
    }
  }

  if (error) {
    return (
      <>
        <ModuleHeader title="Mi horario y asistencia" subtitle="Autoservicio del trabajador" icon={CalendarClock} />
        <main className="p-6">
          <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">{error}</p>
        </main>
      </>
    );
  }
  if (!data) return <main className="p-6 text-sm text-muted-foreground">Cargando tu horario…</main>;

  const todayRow = data.week.days.find((d) => d.date === data.today);
  const { employee: e, contract: c, vacation_balance: vb } = data;

  return (
    <>
      <ModuleHeader title="Mi horario y asistencia" subtitle={`${e.full_name}${c ? ` · ${c.position}` : ""}`} icon={CalendarClock} />
      <main className="flex min-w-0 flex-1 flex-col gap-5 p-4 sm:p-6">
        {/* Hoy */}
        <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Hoy · {fmtDate(data.today)}</p>
            <p className="font-mono text-3xl font-bold">{clock}</p>
            {todayRow && todayRow.shifts.length > 0 ? (
              <p className="text-sm">
                Turno: <b>{todayRow.shifts.map((s) => s.name).join(" + ")}</b> de {todayRow.expected_start} a {todayRow.expected_end}
              </p>
            ) : todayRow?.leave ? (
              <p className="text-sm text-blue-600">{todayRow.leave.label}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Hoy no tienes turno programado.</p>
            )}
            {todayRow && (
              <div className="flex items-center gap-2 text-xs">
                <AttendanceBadge status={todayRow.status} />
                {todayRow.check_in && <span className="font-mono">Entrada {todayRow.check_in}</span>}
                {todayRow.check_out && <span className="font-mono">· Salida {todayRow.check_out}</span>}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <AppButton size="lg" icon={<LogIn />} loading={busy} disabled={!todayRow?.shifts.length || Boolean(todayRow?.check_in)} onClick={() => mark("check_in")}>
              Marcar entrada
            </AppButton>
            <AppButton
              size="lg"
              variant="secondary"
              icon={<LogOut />}
              loading={busy}
              disabled={!data.pending_check_out}
              onClick={() => mark("check_out")}
            >
              Marcar salida
            </AppButton>
          </div>
        </section>

        {/* Semana */}
        <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-bold">
              <CalendarClock className="h-4 w-4 text-primary" /> Mi semana · {monday ? formatWeekRange(monday) : ""}
            </p>
            <div className="flex gap-1">
              <AppButton size="sm" variant="secondary" icon={<ChevronLeft />} ariaLabel="Semana anterior" onClick={() => monday && setMonday(addDaysIso(monday, -7))} />
              <AppButton size="sm" variant="secondary" icon={<ChevronRight />} ariaLabel="Semana siguiente" onClick={() => monday && setMonday(addDaysIso(monday, 7))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {data.week.days.map((d, i) => (
              <div
                key={d.date}
                className={`flex min-h-28 flex-col gap-1.5 rounded-xl border p-2.5 ${d.date === data.today ? "border-primary ring-1 ring-primary/30" : ""} ${d.shifts.length ? "" : "bg-muted/40"}`}
              >
                <p className="text-[11px] font-bold uppercase text-muted-foreground">
                  {WEEKDAY_LABEL[i].slice(0, 3)} {d.date.slice(8)}
                </p>
                {d.leave ? (
                  <p className="text-xs font-semibold text-blue-600">{d.leave.label}</p>
                ) : d.shifts.length ? (
                  d.shifts.map((s) => (
                    <div key={s.shift_id} className="rounded-md bg-primary/5 px-1.5 py-1">
                      <p className="text-xs font-semibold">{s.name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {s.start_time}–{s.end_time}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">Descanso</p>
                )}
                {d.status !== "Descanso" && d.status !== "Programado" && (
                  <div className="mt-auto flex flex-col gap-0.5">
                    <AttendanceBadge status={d.status} />
                    {d.check_in && (
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {d.check_in}–{d.check_out ?? "··:··"}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard layout="label-first" tone="emerald" label="Puntuales" value={data.week.totals.on_time} colorValue />
            <StatCard layout="label-first" tone="amber" label="Tardanzas" value={data.week.totals.late} colorValue />
            <StatCard layout="label-first" tone="rose" label="Faltas" value={data.week.totals.absences} colorValue />
            <StatCard layout="label-first" tone="neutral" label="Horas trabajadas" value={fmtMinutes(data.week.totals.worked_minutes)} />
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Contrato */}
          <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-bold">
                <UserRound className="h-4 w-4 text-primary" /> Mi contrato
              </p>
              {c && <ContractPhaseBadge phase={c.phase} />}
            </div>
            {c ? (
              <>
                <p className="text-sm">
                  {c.contract_type_label} · {c.position} ({c.area}) · desde {fmtDate(c.start_date)}
                  {c.end_date ? ` hasta ${fmtDate(c.end_date)}` : ""} · {c.weekly_hours} h semanales
                </p>
                <ScheduleView schedule={c.schedule} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No tienes un contrato vigente registrado.</p>
            )}
          </section>

          {/* Vacaciones */}
          <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-bold">
                <Umbrella className="h-4 w-4 text-primary" /> Vacaciones y permisos
              </p>
              {c && (
                <AppButton size="sm" variant="soft" onClick={() => setLeaveOpen(true)}>
                  Solicitar
                </AppButton>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-emerald-50 p-2 dark:bg-emerald-950/40">
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{vb.available_days}</p>
                <p className="text-[11px] text-muted-foreground">días disponibles</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-2 dark:bg-amber-950/40">
                <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{vb.max_with_advance - vb.available_days}</p>
                <p className="text-[11px] text-muted-foreground">de adelanto posible</p>
              </div>
              <div className="rounded-xl bg-muted p-2">
                <p className="text-xl font-bold">{vb.used_days}</p>
                <p className="text-[11px] text-muted-foreground">tomados / pedidos</p>
              </div>
            </div>
            <ul className="flex flex-col gap-1.5">
              {data.leaves.slice(0, 5).map((l) => (
                <li key={l.leave_id} className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs">
                  <span>
                    <b>{l.type_label}</b> {fmtDate(l.start_date)} → {fmtDate(l.end_date)} ({l.days} d)
                  </span>
                  <span className="flex items-center gap-2">
                    <RequestBadge status={l.status} />
                    {l.status === "Pendiente" && (
                      <button type="button" className="text-rose-600 hover:underline" onClick={() => cancelLeave(l)}>
                        Anular
                      </button>
                    )}
                  </span>
                </li>
              ))}
              {data.leaves.length === 0 && <li className="text-xs text-muted-foreground">Aún no tienes solicitudes.</li>}
            </ul>
          </section>

          {/* Adelantos */}
          <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-bold">
                <HandCoins className="h-4 w-4 text-primary" /> Adelantos de sueldo
              </p>
              {data.advance_limit.eligible && (
                <AppButton size="sm" variant="soft" onClick={() => setAdvanceOpen(true)}>
                  Solicitar (hasta {money.format(data.advance_limit.max_amount)})
                </AppButton>
              )}
            </div>
            <ul className="flex flex-col gap-1.5">
              {data.advances.slice(0, 5).map((a) => (
                <li key={a.advance_id} className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs">
                  <span>
                    <b>{money.format(a.amount)}</b> en {a.installments} cuota(s) · {fmtDate(a.request_date)}
                    {a.status === "Pagado" ? ` · saldo ${money.format(a.balance)}` : ""}
                  </span>
                  <AdvanceBadge status={a.status} />
                </li>
              ))}
              {data.advances.length === 0 && <li className="text-xs text-muted-foreground">Sin adelantos.</li>}
            </ul>
          </section>

          {/* Boletas */}
          <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 lg:col-span-2">
            <p className="flex items-center gap-2 text-sm font-bold">
              <HandCoins className="h-4 w-4 text-primary" /> Mis boletas de pago
            </p>
            <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {payslips.map((b) => (
                <li key={b.payroll_id}>
                  <button
                    type="button"
                    onClick={() => setPayslip(b)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs hover:bg-muted"
                  >
                    <span>
                      <b>{b.period_label}</b> · {b.status === "Pagada" ? `pagada ${fmtDate(b.payment_date)}` : "por pagar"}
                    </span>
                    <span className="font-mono font-semibold">{money.format(b.net_pay)}</span>
                  </button>
                </li>
              ))}
              {payslips.length === 0 && <li className="text-xs text-muted-foreground">Aún no tienes boletas aprobadas.</li>}
            </ul>
          </section>

          {/* Seguros */}
          <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-bold">
              <ShieldPlus className="h-4 w-4 text-primary" /> Mis seguros
            </p>
            <ul className="flex flex-col gap-1.5">
              {data.insurances.map((i) => (
                <li key={i.insurance_id} className="rounded-lg border px-2.5 py-1.5 text-xs">
                  <b>{i.type_label}</b> · {i.provider}
                  {i.policy_number ? ` · Póliza ${i.policy_number}` : ""}
                  {i.covers_dependents ? " · incluye derechohabientes" : ""}
                </li>
              ))}
              {data.insurances.length === 0 && <li className="text-xs text-muted-foreground">Sin seguros registrados.</li>}
            </ul>
          </section>
        </div>
      </main>

      <PayslipDialog line={payslip} periodLabel={payslip?.period_label ?? ""} onClose={() => setPayslip(null)} />
      {leaveOpen && (
        <LeaveDialog
          open
          self={{ balance: vb }}
          onClose={() => setLeaveOpen(false)}
          onSaved={(msg) => {
            setLeaveOpen(false);
            toast.success(msg);
            load();
          }}
        />
      )}
      {advanceOpen && (
        <AdvanceDialog
          open
          self={{ limit: data.advance_limit }}
          onClose={() => setAdvanceOpen(false)}
          onSaved={(msg) => {
            setAdvanceOpen(false);
            toast.success(msg);
            load();
          }}
        />
      )}
    </>
  );
}

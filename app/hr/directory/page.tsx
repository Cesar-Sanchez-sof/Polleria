"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Briefcase, CalendarClock, ChevronLeft, ChevronRight, ExternalLink, KeyRound, Mail, MapPin, Phone, Search, UserRound, Users, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { AppButton } from "@/components/shared/AppButton";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Tag } from "@/components/shared/TagCell";
import { usePermissions } from "@/components/personalized/PermissionsProvider";
import type { EmployeeDto } from "@/lib/services/hr/employees.service";
import type { ScheduleDto } from "@/lib/services/hr/schedules.service";
import { WEEKDAY_LABEL, addDaysIso, weekdayOf } from "@/lib/services/hr/labor-rules";
import { ContractPhaseBadge } from "../_components/HrBadges";
import { ScheduleView } from "../_components/ContractFields";
import { api, fmtDate, money } from "../_lib/hr-client";

type StatusFilter = "active" | "inactive" | "all";

/** Fecha de hoy en Lima como YYYY-MM-DD. */
function todayLima(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** Lunes de la semana de una fecha. */
function mondayOf(iso: string): string {
  return addDaysIso(iso, -weekdayOf(iso));
}

export default function StaffDirectoryPage() {
  const { can } = usePermissions();
  const canSeeSchedules = can("horarios.ver");

  const [employees, setEmployees] = useState<EmployeeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [today] = useState(todayLima);
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayLima()));
  const [weekShifts, setWeekShifts] = useState<ScheduleDto[]>([]);
  const [shiftsError, setShiftsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<EmployeeDto[]>("/api/employees")
      .then((list) => {
        if (cancelled) return;
        setEmployees(list);
        setError(null);
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "No se pudo cargar el personal"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const loadWeek = useCallback(async () => {
    if (!canSeeSchedules) return;
    try {
      setWeekShifts(await api<ScheduleDto[]>(`/api/schedules?from=${weekStart}&to=${addDaysIso(weekStart, 6)}`));
      setShiftsError(null);
    } catch (e) {
      setWeekShifts([]);
      setShiftsError(e instanceof Error ? e.message : "No se pudieron cargar los turnos");
    }
  }, [canSeeSchedules, weekStart]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos remotos al cambiar de semana
    loadWeek();
  }, [loadWeek]);

  const areas = useMemo(() => [...new Set(employees.map((e) => e.area).filter((a): a is string => Boolean(a)))].sort(), [employees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      const matches = !q || e.dni.includes(q) || e.full_name.toLowerCase().includes(q) || (e.position ?? "").toLowerCase().includes(q);
      const st = status === "all" || (status === "active" ? e.active : !e.active);
      return matches && st && (!area || e.area === area);
    });
  }, [employees, search, status, area]);

  const counts = useMemo(() => {
    const active = employees.filter((e) => e.active).length;
    return { active, inactive: employees.length - active, all: employees.length };
  }, [employees]);

  const selected = useMemo(() => employees.find((e) => e.employee_id === selectedId) ?? null, [employees, selectedId]);

  // Turnos de la semana del trabajador elegido, por día.
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDaysIso(weekStart, i);
      const shifts = selected ? weekShifts.filter((s) => s.date === date && s.employees.some((emp) => emp.employee_id === selected.employee_id)) : [];
      return { date, label: WEEKDAY_LABEL[i], shifts };
    });
  }, [weekStart, weekShifts, selected]);
  const weekHours = weekDays.reduce((sum, d) => sum + d.shifts.reduce((h, s) => h + s.hours, 0), 0);

  return (
    <>
      <ModuleHeader title="Directorio de personal" subtitle="Todos los empleados, sus datos y sus horarios en una sola vista" icon={Users}>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="relative w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por nombre, DNI o cargo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar empleados"
              className="h-9 rounded-xl pl-9 pr-8 text-xs"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} aria-label="Limpiar búsqueda" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <NativeSelect value={area} onChange={(e) => setArea(e.target.value)} aria-label="Filtrar por área" className="h-9 w-40 rounded-xl text-xs">
            <NativeSelectOption value="">Todas las áreas</NativeSelectOption>
            {areas.map((a) => (
              <NativeSelectOption key={a} value={a}>
                {a}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <SegmentedTabs<StatusFilter>
            ariaLabel="Filtrar por estado"
            value={status}
            onValueChange={setStatus}
            className="max-w-full overflow-x-auto"
            items={[
              { value: "active", label: "Activos", count: counts.active, tone: "success" },
              { value: "inactive", label: "Cesados", count: counts.inactive, tone: "danger" },
              { value: "all", label: "Todos", count: counts.all, tone: "brand" },
            ]}
          />
        </div>
      </ModuleHeader>

      <main className="grid min-w-0 flex-1 gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* ───────── Lista de empleados ───────── */}
        <section aria-label="Lista de empleados" className="min-w-0 rounded-2xl border bg-card">
          {error && (
            <p role="alert" className="flex items-center gap-2 p-4 text-sm font-medium text-rose-600">
              <AlertCircle className="h-4 w-4" /> {error}
            </p>
          )}
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">Cargando personal…</p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No se encontraron empleados con esos filtros.</p>
          ) : (
            <ul className="divide-y">
              {filtered.map((e) => {
                const active = e.employee_id === selectedId;
                return (
                  <li key={e.employee_id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(e.employee_id)}
                      aria-pressed={active}
                      className={`flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${active ? "bg-primary/5 ring-1 ring-inset ring-primary/30" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{e.full_name}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">DNI {e.dni}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {e.has_user && <KeyRound className="h-3.5 w-3.5 text-blue-600" aria-label="Tiene usuario del sistema" />}
                          <StatusBadge tone={e.active ? "success" : "neutral"}>{e.active ? "Activo" : "Cesado"}</StatusBadge>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {e.contract ? (
                          <>
                            <span className="font-medium text-foreground">{e.contract.position}</span>
                            <Tag tone="indigo" variant="soft" size="sm">
                              {e.contract.area}
                            </Tag>
                            <span>{e.contract.contract_type_label}</span>
                            <span className="font-mono">{money.format(e.contract.base_salary)}</span>
                          </>
                        ) : (
                          <span>Sin contrato</span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {e.next_shift ? `Próximo turno: ${e.next_shift.name} · ${fmtDate(e.next_shift.date)} ${e.next_shift.start_time}–${e.next_shift.end_time}` : "Sin turnos programados"}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ───────── Detalle del empleado elegido ───────── */}
        <section aria-label="Detalle del empleado" className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          {!selected ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
              <UserRound className="h-8 w-8" />
              <p className="text-sm font-medium">Selecciona un empleado de la lista</p>
              <p className="text-xs">Verás sus datos, su contrato y sus horarios.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold">{selected.full_name}</h2>
                    <p className="text-xs text-muted-foreground">
                      DNI <span className="font-mono">{selected.dni}</span> · Ingreso {fmtDate(selected.hire_date)}
                    </p>
                  </div>
                  <Link href={`/hr/employees/${selected.employee_id}`}>
                    <AppButton size="sm" variant="secondary" icon={<ExternalLink />}>
                      Ver ficha completa
                    </AppButton>
                  </Link>
                </div>
                <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                  <Field icon={<Phone />} label="Teléfono" value={selected.phone} />
                  <Field icon={<Mail />} label="Correo" value={selected.email} />
                  <Field icon={<MapPin />} label="Dirección" value={selected.address} />
                  <Field icon={<UserRound />} label="Nacimiento" value={selected.birth_date ? fmtDate(selected.birth_date) : null} />
                  <Field icon={<Phone />} label="Contacto de emergencia" value={selected.emergency_contact ? `${selected.emergency_contact}${selected.emergency_phone ? ` · ${selected.emergency_phone}` : ""}` : null} />
                  <Field icon={<KeyRound />} label="Acceso al sistema" value={selected.has_user ? "Con usuario" : "Sin usuario"} />
                </dl>
              </div>

              <div className="rounded-2xl border bg-card p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Briefcase className="h-4 w-4 text-primary" /> Contrato
                </p>
                {selected.contract ? (
                  <div className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                    <Field label="Cargo" value={selected.contract.position} />
                    <Field label="Área" value={selected.contract.area} />
                    <Field label="Modalidad" value={selected.contract.contract_type_label} />
                    <Field label="Sueldo base" value={money.format(selected.contract.base_salary)} />
                    <Field label="Vigencia" value={selected.contract.end_date ? `${fmtDate(selected.contract.start_date)} → ${fmtDate(selected.contract.end_date)}` : `Desde ${fmtDate(selected.contract.start_date)}`} />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Estado</span>
                      <ContractPhaseBadge phase={selected.contract.phase} />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{selected.active ? "No tiene contrato vigente." : "Trabajador cesado."}</p>
                )}
              </div>

              {canSeeSchedules ? (
                <div className="rounded-2xl border bg-card p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <CalendarClock className="h-4 w-4 text-primary" /> Turnos de la semana
                    </p>
                    <div className="flex items-center gap-1">
                      <AppButton size="sm" variant="secondary" icon={<ChevronLeft />} ariaLabel="Semana anterior" onClick={() => setWeekStart((w) => addDaysIso(w, -7))} />
                      <span className="min-w-36 text-center text-xs font-medium">
                        {fmtDate(weekStart)} – {fmtDate(addDaysIso(weekStart, 6))}
                      </span>
                      <AppButton size="sm" variant="secondary" icon={<ChevronRight />} ariaLabel="Semana siguiente" onClick={() => setWeekStart((w) => addDaysIso(w, 7))} />
                      <AppButton size="sm" variant="secondary" onClick={() => setWeekStart(mondayOf(today))}>
                        Hoy
                      </AppButton>
                    </div>
                  </div>
                  {shiftsError && (
                    <p role="alert" className="mb-2 text-xs font-medium text-rose-600">
                      {shiftsError}
                    </p>
                  )}
                  <div className="grid grid-cols-7 gap-1.5" data-testid="week-grid">
                    {weekDays.map((d) => (
                      <div
                        key={d.date}
                        className={`flex min-h-24 flex-col gap-1 rounded-lg border p-1.5 text-center ${d.shifts.length ? "border-primary/30 bg-primary/5" : "bg-muted/40"} ${d.date === today ? "ring-2 ring-primary/50" : ""}`}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          {d.label.slice(0, 3)} {d.date.slice(8)}
                        </p>
                        {d.shifts.length === 0 ? (
                          <p className="m-auto text-[10px] text-muted-foreground">Descanso</p>
                        ) : (
                          d.shifts.map((s) => (
                            <div key={s.shift_id} className="rounded bg-background px-1 py-0.5 shadow-xs">
                              <p className="truncate text-[10px] font-semibold">{s.name}</p>
                              <p className="font-mono text-[9px] text-muted-foreground">
                                {s.start_time}–{s.end_time}
                                {s.overnight ? " (+1)" : ""}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Horas programadas en la semana: <b>{weekHours.toFixed(1)} h</b>
                    {selected.contract?.weekly_hours ? ` · Pactadas: ${selected.contract.weekly_hours} h` : ""}
                  </p>
                  {selected.contract && (
                    <details className="mt-3 text-sm">
                      <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Ver horario pactado en el contrato</summary>
                      <div className="mt-2">
                        <ContractScheduleLoader employeeId={selected.employee_id} />
                      </div>
                    </details>
                  )}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed p-4 text-xs text-muted-foreground">Tu rol no tiene permiso para ver los horarios.</p>
              )}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function Field({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string | null | undefined }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      {icon && <span className="mt-0.5 text-muted-foreground [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
      <div className="min-w-0">
        <dt className="text-[11px] text-muted-foreground">{label}</dt>
        <dd className="truncate text-sm font-medium">{value || "—"}</dd>
      </div>
    </div>
  );
}

/** Horario pactado del contrato vigente (se pide solo al abrir el detalle). */
function ContractScheduleLoader({ employeeId }: { employeeId: number }) {
  const [schedule, setSchedule] = useState<Parameters<typeof ScheduleView>[0]["schedule"] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api<{ contracts: Array<{ status: string; schedule: Parameters<typeof ScheduleView>[0]["schedule"] }> } | Array<{ status: string; schedule: Parameters<typeof ScheduleView>[0]["schedule"] }>>(`/api/contracts?employee_id=${employeeId}`)
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res) ? res : res.contracts;
        setSchedule((list.find((c) => c.status === "Vigente") ?? list[0])?.schedule ?? []);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [employeeId]);
  if (failed) return <p className="text-xs text-muted-foreground">No se pudo cargar el horario pactado.</p>;
  if (!schedule) return <p className="text-xs text-muted-foreground">Cargando…</p>;
  return <ScheduleView schedule={schedule} />;
}

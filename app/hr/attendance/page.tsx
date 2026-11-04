"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck2, ChevronLeft, ChevronRight, Clock, Edit2, LogIn, LogOut, ShieldAlert, Timer, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { AppButton } from "@/components/shared/AppButton";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { StatCard } from "@/components/shared/StatCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePermissions } from "@/components/personalized/PermissionsProvider";
import type { AttendanceRowDto, AttendanceTotals } from "@/lib/services/hr/attendance.service";
import { LATE_TOLERANCE_MINUTES, addDaysIso } from "@/lib/services/hr/labor-rules";
import { AttendanceBadge } from "../_components/HrBadges";
import { MARK_SOURCE, api, fmtMinutes } from "../_lib/hr-client";
import { Tag } from "@/components/shared/TagCell";
import type { AttendanceMarkDto } from "@/lib/services/hr/attendance.service";
import { formatLongCap, todayLima } from "../schedules/dates";

type View = "all" | "issues" | "present" | "log";

function SourceTag({ source, ip }: { source: string | null; ip?: string | null }) {
  if (!source) return null;
  const s = MARK_SOURCE[source] ?? { label: source, short: source, tone: "neutral" as const };
  return (
    <span title={`${s.label}${ip ? ` · IP ${ip}` : ""}`}>
      <Tag tone={s.tone} size="sm">
        {s.short}
      </Tag>
    </span>
  );
}

interface Daily {
  date: string;
  rows: AttendanceRowDto[];
  totals: AttendanceTotals;
}

export default function AttendancePage() {
  const [today, setToday] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [data, setData] = useState<Daily | null>(null);
  const [view, setView] = useState<View>("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState<AttendanceRowDto | null>(null);
  const { can } = usePermissions();

  useEffect(() => {
    const t = todayLima();
    /* eslint-disable react-hooks/set-state-in-effect -- fecha local del navegador, solo disponible en el cliente */
    setToday(t);
    setDate(t);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const load = useCallback(async () => {
    if (!date) return;
    try {
      setData(await api<Daily>(`/api/attendance?date=${date}`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cargar la asistencia");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos remotos
    load();
  }, [load]);

  // El tablero de hoy se refresca solo cada minuto (tardanzas y faltas cambian con la hora).
  useEffect(() => {
    if (date !== today) return;
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [date, today, load]);

  async function mark(row: AttendanceRowDto, action: "check_in" | "check_out") {
    setBusy(`${row.employee_id}-${action}`);
    try {
      const res = await api<{ time: string }>("/api/attendance", { method: "POST", body: { employee_id: row.employee_id, action, date: row.date } });
      toast.success(`${action === "check_in" ? "Entrada" : "Salida"} de ${row.full_name} a las ${res.time}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo registrar");
    } finally {
      setBusy(null);
    }
  }

  const rows = useMemo(() => {
    const all = (data?.rows ?? []).filter((r) => r.status !== "Descanso" || r.attendance_id);
    if (view === "issues") return all.filter((r) => ["Tardanza", "Falta", "Sin marcar", "Sin salida"].includes(r.status));
    if (view === "present") return all.filter((r) => ["Puntual", "Tardanza", "En turno", "Extra", "Sin salida"].includes(r.status));
    return all;
  }, [data, view]);

  const t = data?.totals;
  const isPast = date && today ? date < today : false;
  const canMarkIn = date === today;
  // La salida de un turno nocturno de ayer se marca con la hora actual.
  const canMarkOut = date === today || (date != null && today != null && date === addDaysIso(today, -1));

  const columns: DataTableColumn<AttendanceRowDto>[] = [
    {
      key: "employee",
      header: "Trabajador",
      width: "min-w-[200px]",
      sortable: true,
      sortValue: (r) => r.full_name,
      primary: { title: (r) => r.full_name, subtitle: (r) => r.position ?? "—", icon: <UserCheck />, iconTone: "amber", href: (r) => `/hr/employees/${r.employee_id}` },
    },
    {
      key: "shifts",
      header: "Programado",
      cell: (r) =>
        r.leave ? (
          <span className="text-xs text-blue-600">{r.leave.label}</span>
        ) : r.shifts.length ? (
          <div className="text-xs">
            <p className="font-mono font-semibold">
              {r.expected_start}–{r.expected_end}
            </p>
            <p className="text-muted-foreground">{r.shifts.map((s) => s.name).join(" + ")}</p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Descanso</span>
        ),
    },
    {
      key: "in",
      header: "Entrada",
      align: "center",
      cell: (r) =>
        r.check_in ? (
          <div className="text-xs">
            <p className="font-mono font-semibold">{r.check_in}</p>
            {r.late_minutes > LATE_TOLERANCE_MINUTES && <p className="text-amber-600">+{r.late_minutes} min</p>}
            <SourceTag source={r.source} ip={r.check_in_ip} />
          </div>
        ) : canMarkIn && can("asistencia.crear") && r.shifts.length > 0 && !r.leave ? (
          <AppButton size="sm" variant="soft" icon={<LogIn />} loading={busy === `${r.employee_id}-check_in`} onClick={() => mark(r, "check_in")}>
            Entrada
          </AppButton>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "out",
      header: "Salida",
      align: "center",
      cell: (r) =>
        r.check_out ? (
          <div className="text-xs">
            <p className="font-mono font-semibold">
              {r.check_out}
              {r.check_out_next_day ? " (+1)" : ""}
            </p>
            <SourceTag source={r.check_out_source} ip={r.check_out_ip} />
          </div>
        ) : r.check_in && canMarkOut && can("asistencia.crear") ? (
          <AppButton size="sm" variant="soft" icon={<LogOut />} loading={busy === `${r.employee_id}-check_out`} onClick={() => mark(r, "check_out")}>
            Salida
          </AppButton>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "worked",
      header: "Trabajado",
      align: "right",
      cell: (r) => (
        <div className="text-right text-xs">
          <p>{r.worked_minutes ? fmtMinutes(r.worked_minutes) : "—"}</p>
          {r.extra_minutes > 0 && <p className="text-blue-600">+{fmtMinutes(r.extra_minutes)} extra</p>}
        </div>
      ),
    },
    {
      key: "status",
      header: "Estado",
      sortable: true,
      sortValue: (r) => r.status,
      cell: (r) => (
        <div className="flex flex-col gap-0.5">
          <AttendanceBadge status={r.status} />
          {r.justification && <span className="max-w-40 truncate text-[11px] text-muted-foreground">{r.justification}</span>}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (r) =>
        can("asistencia.editar") && !r.leave ? (
          <AppButton size="sm" variant="ghost" icon={<Edit2 />} onClick={() => setCorrecting(r)}>
            Corregir
          </AppButton>
        ) : null,
    },
  ];

  return (
    <>
      <ModuleHeader title="Asistencia" subtitle="Control diario de entradas, salidas, tardanzas y faltas" icon={CalendarCheck2}>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <AppButton size="sm" variant="secondary" icon={<ChevronLeft />} ariaLabel="Día anterior" onClick={() => date && setDate(addDaysIso(date, -1))} />
          <Input type="date" value={date ?? ""} max={today ?? undefined} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-9 w-40 text-xs" />
          <AppButton
            size="sm"
            variant="secondary"
            icon={<ChevronRight />}
            ariaLabel="Día siguiente"
            disabled={!date || !today || date >= today}
            onClick={() => date && setDate(addDaysIso(date, 1))}
          />
          {date !== today && (
            <AppButton size="sm" variant="ghost" onClick={() => setDate(today)}>
              Hoy
            </AppButton>
          )}
          <SegmentedTabs<View>
            ariaLabel="Filtrar"
            value={view}
            onValueChange={setView}
            items={[
              { value: "all", label: "Todos" },
              { value: "issues", label: "Incidencias", tone: "danger", count: (t?.late ?? 0) + (t?.absences ?? 0) },
              { value: "present", label: "Presentes", tone: "success", count: t?.present ?? 0 },
              { value: "log", label: "Bitácora de marcaciones" },
            ]}
          />
        </div>
      </ModuleHeader>
      <main className="flex min-w-0 flex-1 flex-col gap-5 p-4 sm:p-6">
        {date && <p className="text-sm font-semibold text-muted-foreground">{formatLongCap(date)}</p>}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          <StatCard layout="label-first" tone="neutral" icon={<Clock />} label="Programados" value={t?.scheduled_days ?? 0} />
          <StatCard layout="label-first" tone="emerald" icon={<UserCheck />} label="Puntuales" value={t?.on_time ?? 0} colorValue />
          <StatCard layout="label-first" tone="amber" icon={<Timer />} label="Tardanzas" value={t?.late ?? 0} footerLeft={t ? `${t.late_minutes} min acumulados` : undefined} colorValue />
          <StatCard layout="label-first" tone="rose" icon={<ShieldAlert />} label="Faltas" value={t?.absences ?? 0} colorValue />
          <StatCard layout="label-first" tone="blue" icon={<CalendarCheck2 />} label="Licencias / justificadas" value={(t?.on_leave ?? 0) + (t?.justified ?? 0)} colorValue />
        </div>
        <p className="text-xs text-muted-foreground">
          Tolerancia de {LATE_TOLERANCE_MINUTES} minutos. La entrada se registra sola cuando el trabajador inicia sesión con sus credenciales
          dentro de la ventana de su turno (desde 1 h antes); la salida, al cerrar sesión o desde «Mi horario y asistencia».
          {isPast && " Para registrar marcaciones de días pasados usa «Corregir»."}
        </p>
        {view === "log" && date ? (
          <MarksLog date={date} />
        ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.employee_id}
          loading={loading}
          loadingMode="auto"
          emptyState={{ icon: <CalendarCheck2 className="h-7 w-7" />, title: "Nadie programado este día", description: "Programa la semana desde Horarios laborales." }}
        />
        )}
      </main>
      {correcting && (
        <CorrectionDialog
          row={correcting}
          onClose={() => setCorrecting(null)}
          onSaved={() => {
            setCorrecting(null);
            toast.success("Asistencia actualizada");
            load();
          }}
        />
      )}
    </>
  );
}

function CorrectionDialog({ row, onClose, onSaved }: { row: AttendanceRowDto; onClose: () => void; onSaved: () => void }) {
  const [checkIn, setCheckIn] = useState(row.check_in ?? "");
  const [checkOut, setCheckOut] = useState(row.check_out ?? "");
  const [justified, setJustified] = useState(row.justified);
  const [justification, setJustification] = useState(row.justification ?? "");
  const [notes, setNotes] = useState(row.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await api("/api/attendance", {
        method: "PUT",
        body: { employee_id: row.employee_id, date: row.date, check_in: checkIn || null, check_out: checkOut || null, justified, justification, notes },
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Corregir asistencia</DialogTitle>
          <DialogDescription>
            {row.full_name} · {formatLongCap(row.date)}
            {row.expected_start ? ` · programado ${row.expected_start}–${row.expected_end}` : ""}. Queda registrado en la auditoría.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-in">Entrada</Label>
            <Input id="c-in" type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="c-out">Salida</Label>
            <Input id="c-out" type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">Si es menor que la entrada, cuenta al día siguiente.</p>
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={justified} onChange={(e) => setJustified(e.target.checked)} />
            Justificar la tardanza o falta
          </label>
          {justified && (
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="c-just">
                Motivo de la justificación <span className="text-red-500">*</span>
              </Label>
              <Input id="c-just" maxLength={200} value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Cita médica con constancia, corte de transporte…" />
            </div>
          )}
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="c-notes">Observaciones</Label>
            <Input id="c-notes" maxLength={200} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Olvidó marcar, se registró por supervisor…" />
          </div>
        </div>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <DialogFooter>
          <AppButton variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </AppButton>
          <AppButton loading={saving} onClick={submit}>
            Guardar
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Bitácora inmutable: cada marcación con su origen, IP y dispositivo (para auditar la asistencia). */
function MarksLog({ date }: { date: string }) {
  const [rows, setRows] = useState<AttendanceMarkDto[] | null>(null);
  useEffect(() => {
    api<AttendanceMarkDto[]>(`/api/attendance/marks?date=${date}`)
      .then(setRows)
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "No se pudo cargar la bitácora");
        setRows([]);
      });
  }, [date]);

  const columns: DataTableColumn<AttendanceMarkDto>[] = [
    {
      key: "at",
      header: "Registrado",
      cell: (m) => (
        <span className="font-mono text-xs">
          {new Date(m.created_at).toLocaleTimeString("es-PE", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      ),
    },
    {
      key: "employee",
      header: "Trabajador",
      primary: { title: (m) => m.employee_name, subtitle: (m) => (m.username ? `por ${m.username}` : "—"), icon: <UserCheck />, iconTone: "blue", href: (m) => `/hr/employees/${m.employee_id}` },
    },
    {
      key: "kind",
      header: "Marca",
      cell: (m) => (
        <div className="text-xs">
          <p className="font-semibold">{m.kind}</p>
          <p className="font-mono text-muted-foreground">{m.time ?? "borrada"}</p>
        </div>
      ),
    },
    { key: "source", header: "Origen", cell: (m) => <SourceTag source={m.source} /> },
    { key: "ip", header: "IP", cell: (m) => <span className="font-mono text-xs">{m.ip ?? "—"}</span> },
    { key: "device", header: "Dispositivo", cell: (m) => <span className="text-xs">{m.device ?? "—"}</span> },
    { key: "note", header: "Nota", cell: (m) => <span className="max-w-56 truncate text-xs text-muted-foreground">{m.note ?? ""}</span> },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows ?? []}
      rowKey={(m) => m.mark_id}
      loading={rows === null}
      pagination={{ defaultPageSize: 20, itemLabel: "marcaciones" }}
      emptyState={{ icon: <CalendarCheck2 className="h-7 w-7" />, title: "Sin marcaciones registradas este día" }}
    />
  );
}

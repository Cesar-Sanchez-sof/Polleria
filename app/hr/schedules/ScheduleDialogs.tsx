"use client";

import { FormEvent, useEffect, useState } from "react";
import { CalendarClock, Edit2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AppButton } from "@/components/shared/AppButton";
import { Tag } from "@/components/shared/TagCell";
import { Checkbox } from "@/components/ui/checkbox";
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
import { formatLongCap } from "./dates";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useShiftTemplates } from "../_components/useShiftTemplates";

export interface ScheduleRow {
  shift_id: number;
  name: string;
  date: string;
  start_time: string;
  end_time: string;
  overnight: boolean;
  hours: number;
  employees: Array<{ employee_id: number; full_name: string; dni: string; position: string | null; active: boolean }>;
}

interface EmployeeOption {
  employee_id: number;
  full_name: string;
  dni: string;
  position: string | null;
  active: boolean;
}

async function send(url: string, method: string, body?: unknown): Promise<{ error: string | null; data: unknown }> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { error: res.ok ? null : ((data as { error?: string }).error ?? "No se pudo guardar"), data };
  } catch {
    return { error: "No se pudo conectar con el servidor", data: null };
  }
}

/** Detalle de un turno: quién trabaja y las acciones disponibles según los permisos. */
export function ScheduleDetailDialog({
  schedule,
  canEdit,
  canDelete,
  onClose,
  onAssign,
  onEdit,
  onDelete,
}: {
  schedule: ScheduleRow | null;
  canEdit: boolean;
  canDelete: boolean;
  onClose: () => void;
  onAssign: (s: ScheduleRow) => void;
  onEdit: (s: ScheduleRow) => void;
  onDelete: (s: ScheduleRow) => void;
}) {
  return (
    <Dialog open={schedule !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {schedule && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-primary" /> {schedule.name}
              </DialogTitle>
              <DialogDescription>{formatLongCap(schedule.date)}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-foreground">
                {schedule.start_time}–{schedule.end_time}
              </span>
              <Tag tone="neutral" size="sm">
                {schedule.hours} h
              </Tag>
              {schedule.overnight && (
                <Tag tone="indigo" size="sm">
                  Termina al día siguiente
                </Tag>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Personal asignado ({schedule.employees.length})
              </p>
              {schedule.employees.length === 0 ? (
                <p className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3 py-4 text-center text-xs font-medium text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                  Este turno aún no tiene personal asignado.
                </p>
              ) : (
                <ul className="divide-y rounded-xl border">
                  {schedule.employees.map((e) => (
                    <li key={e.employee_id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span>
                        <span className="font-semibold">{e.full_name}</span>
                        <span className="block text-xs text-muted-foreground">{e.position ?? "Sin cargo"}</span>
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">{e.dni}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              {canDelete ? (
                <AppButton variant="danger" size="sm" icon={<Trash2 />} onClick={() => onDelete(schedule)}>
                  Eliminar
                </AppButton>
              ) : (
                <span />
              )}
              <div className="flex flex-wrap gap-2">
                {canEdit && (
                  <>
                    <AppButton variant="secondary" size="sm" icon={<Edit2 />} onClick={() => onEdit(schedule)}>
                      Editar
                    </AppButton>
                    <AppButton size="sm" icon={<UserPlus />} onClick={() => onAssign(schedule)}>
                      Asignar personal
                    </AppButton>
                  </>
                )}
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Alta y edición del horario (nombre, fecha y franja). */
export function ScheduleForm({
  open,
  schedule,
  defaultDate,
  onClose,
  onSaved,
}: {
  open: boolean;
  schedule: ScheduleRow | null;
  /** Fecha sugerida al crear (el día donde se pulsó "+"). */
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editing = schedule !== null;
  const { templates } = useShiftTemplates(open);
  // "" = horario eventual (nombre y horas libres); si no, el id del turno base elegido.
  const [templateId, setTemplateId] = useState<string>("");
  const [name, setName] = useState("");
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState("23:30");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Reinicia los campos al abrir el formulario para otro horario o fecha.
  const formKey = open ? `${schedule?.shift_id ?? "nuevo"}-${defaultDate}-${templates.length}` : null;
  if (formKey !== loadedFor) {
    setLoadedFor(formKey);
    setError(null);
    const match = templates.find((t) => t.name.toLowerCase() === (schedule?.name ?? "").toLowerCase());
    const first = templates.find((t) => t.active);
    if (schedule) {
      setTemplateId(match ? String(match.id) : "");
      setName(schedule.name);
      setStart(schedule.start_time);
      setEnd(schedule.end_time);
    } else if (first) {
      setTemplateId(String(first.id));
      setName(first.name);
      setStart(first.start_time);
      setEnd(first.end_time);
    }
  }

  function chooseTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => String(x.id) === id);
    if (t) {
      setName(t.name);
      setStart(t.start_time);
      setEnd(t.end_time);
    } else {
      setName("");
    }
  }
  const fromTemplate = templateId !== "";

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const data = { ...Object.fromEntries(new FormData(e.currentTarget)), name, start_time: start, end_time: end };
    const { error: err } = await send(
      editing ? `/api/schedules/${schedule.shift_id}` : "/api/schedules",
      editing ? "PUT" : "POST",
      data,
    );
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    toast.success(editing ? "Horario actualizado exitosamente" : "Horario creado exitosamente");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Horario" : "Nuevo Horario"}</DialogTitle>
          <DialogDescription>
            Elige un turno base (los mismos que se pactan en los contratos) o crea un horario eventual. Si la hora de fin es menor
            que la de inicio, el turno termina al día siguiente.
          </DialogDescription>
        </DialogHeader>
        <form key={schedule?.shift_id ?? `nuevo-${defaultDate}`} onSubmit={submit} className="grid grid-cols-2 gap-4 py-2">
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="template">Turno</Label>
            <NativeSelect id="template" className="w-full" value={templateId} onChange={(e) => chooseTemplate(e.target.value)}>
              {templates
                .filter((t) => t.active || String(t.id) === templateId)
                .map((t) => (
                  <NativeSelectOption key={t.id} value={String(t.id)}>
                    {t.name} ({t.start_time}–{t.end_time})
                  </NativeSelectOption>
                ))}
              <NativeSelectOption value="">Horario eventual (no pactado en contratos)</NativeSelectOption>
            </NativeSelect>
            {!fromTemplate && (
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                Un horario eventual sirve para eventos o refuerzos puntuales: no aparece en el horario pactado de los contratos.
              </p>
            )}
          </div>
          {!fromTemplate && (
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="name">
                Nombre del horario <span className="text-red-500">*</span>
              </Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={30} placeholder="Evento privado" />
            </div>
          )}
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="date">
              Fecha <span className="text-red-500">*</span>
            </Label>
            <Input id="date" name="date" type="date" defaultValue={schedule?.date ?? defaultDate} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="start_time">
              Hora de inicio <span className="text-red-500">*</span>
            </Label>
            <Input id="start_time" type="time" value={start} onChange={(e) => setStart(e.target.value)} disabled={fromTemplate} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="end_time">
              Hora de fin <span className="text-red-500">*</span>
            </Label>
            <Input id="end_time" type="time" value={end} onChange={(e) => setEnd(e.target.value)} disabled={fromTemplate} required />
          </div>
          {error && (
            <p role="alert" className="col-span-2 text-sm font-medium text-rose-600">
              {error}
            </p>
          )}
          <DialogFooter className="col-span-2 pt-2">
            <AppButton variant="secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </AppButton>
            <AppButton type="submit" loading={saving}>
              {editing ? "Guardar Cambios" : "Crear Horario"}
            </AppButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Marca qué empleados activos trabajan en el horario. */
export function AssignEmployeesDialog({
  schedule,
  sameDay,
  onClose,
  onSaved,
}: {
  schedule: ScheduleRow | null;
  /** Horarios de la misma fecha: sirven para avisar quién ya trabaja en otro turno ese día. */
  sameDay: ScheduleRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [options, setOptions] = useState<EmployeeOption[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!schedule) return;
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect -- reinicia el diálogo al abrirlo con otro horario */
    setSelected(new Set(schedule.employees.map((e) => e.employee_id)));
    setFilter("");
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    fetch("/api/employees")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((rows: EmployeeOption[]) => !cancelled && setOptions(rows.filter((o) => o.active)))
      .catch(() => !cancelled && setError("No se pudo cargar la lista de empleados"));
    return () => {
      cancelled = true;
    };
  }, [schedule]);

  function toggle(id: number, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function save() {
    if (!schedule) return;
    setSaving(true);
    const { error: err } = await send(`/api/schedules/${schedule.shift_id}/employees`, "PUT", { employee_ids: [...selected] });
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    toast.success(`Personal del turno ${schedule.name} actualizado`);
    onSaved();
  }

  const q = filter.trim().toLowerCase();
  const visible = options.filter((o) => !q || o.full_name.toLowerCase().includes(q) || o.dni.includes(q));

  return (
    <Dialog open={schedule !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Personal del turno {schedule?.name}</DialogTitle>
          <DialogDescription>
            {schedule && formatLongCap(schedule.date)} · {schedule?.start_time}–
            {schedule?.end_time}. Un empleado puede tener varios horarios, pero no dos que se crucen.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Buscar por nombre o DNI..."
          aria-label="Buscar empleado"
          className="h-10 rounded-xl text-xs"
        />
        <ul className="max-h-72 divide-y overflow-y-auto rounded-xl border">
                    {visible.map((o) => {
            const others = sameDay.filter(
              (d) => d.shift_id !== schedule?.shift_id && d.employees.some((e) => e.employee_id === o.employee_id),
            );
            return (
              <li key={o.employee_id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-900">
                  <Checkbox checked={selected.has(o.employee_id)} onCheckedChange={(v) => toggle(o.employee_id, v === true)} />
                  <span className="flex-1">
                    <span className="font-semibold">{o.full_name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {o.position ?? "Sin cargo"} · DNI {o.dni}
                    </span>
                  </span>
                  {others.length > 0 && (
                    <Tag tone="amber" size="sm">
                      También: {others.map((d) => d.name).join(", ")}
                    </Tag>
                  )}
                </label>
              </li>
            );
          })}
          {visible.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Sin empleados</li>}
        </ul>
        {error && (
          <p role="alert" className="text-sm font-medium text-rose-600">
            {error}
          </p>
        )}
        <DialogFooter>
          <AppButton variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </AppButton>
          <AppButton loading={saving} onClick={save}>
            Guardar ({selected.size})
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteScheduleDialog({
  schedule,
  onClose,
  onDeleted,
}: {
  schedule: ScheduleRow | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!schedule) return;
    setBusy(true);
    setError(null);
    const { error: err } = await send(`/api/schedules/${schedule.shift_id}`, "DELETE");
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    toast.success(`Horario ${schedule.name} eliminado`);
    onDeleted();
  }

  return (
    <Dialog open={schedule !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-rose-600" /> Eliminar horario
          </DialogTitle>
          <DialogDescription>
            Se eliminará «{schedule?.name}» del {schedule && formatLongCap(schedule.date).toLowerCase()}.
            {schedule && schedule.employees.length > 0 &&
              ` Sus ${schedule.employees.length} empleado(s) quedarán sin horario.`}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm font-medium text-rose-600">
            {error}
          </p>
        )}
        <DialogFooter>
          <AppButton variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </AppButton>
          <AppButton variant="danger" icon={<Trash2 />} loading={busy} onClick={confirm}>
            Eliminar
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarClock, CalendarDays, ChevronLeft, ChevronRight, Clock, Edit2, List, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { AppButton } from "@/components/shared/AppButton";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { RowActions } from "@/components/shared/RowActions";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Tag } from "@/components/shared/TagCell";
import { usePermissions } from "@/components/personalized/PermissionsProvider";
import { addDays, formatLongCap, formatWeekRange, mondayOf, todayLima } from "./dates";
import { AssignEmployeesDialog, DeleteScheduleDialog, ScheduleDetailDialog, ScheduleForm, type ScheduleRow } from "./ScheduleDialogs";
import { WeekGrid } from "./WeekGrid";

type View = "week" | "list";

export default function SchedulesPage() {
  // La fecha de hoy se calcula en el cliente para que el HTML del servidor no difiera del navegador.
  const [today, setToday] = useState<string | null>(null);
  const [monday, setMonday] = useState<string | null>(null);
  const [view, setView] = useState<View>("week");
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ScheduleRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleRow | null>(null);
  const [newDate, setNewDate] = useState("");
  const [assigning, setAssigning] = useState<ScheduleRow | null>(null);
  const [deleting, setDeleting] = useState<ScheduleRow | null>(null);
  const { can } = usePermissions();

  useEffect(() => {
    const t = todayLima();
    /* eslint-disable react-hooks/set-state-in-effect -- fecha local del navegador, solo disponible en el cliente */
    setToday(t);
    setMonday(mondayOf(t));
    setNewDate(t);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const load = useCallback(async () => {
    if (!monday) return;
    try {
      const res = await fetch(`/api/schedules?from=${monday}&to=${addDays(monday, 6)}`);
      if (!res.ok) throw new Error();
      setSchedules(await res.json());
      setError(null);
    } catch {
      setError("No se pudo cargar los horarios de la semana");
    } finally {
      setLoading(false);
    }
  }, [monday]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos remotos
    load();
  }, [load]);

  const metrics = useMemo(
    () => ({
      shifts: schedules.length,
      hours: Math.round(schedules.reduce((sum, s) => sum + s.hours, 0) * 100) / 100,
      people: new Set(schedules.flatMap((s) => s.employees.map((e) => e.employee_id))).size,
      unstaffed: schedules.filter((s) => s.employees.length === 0).length,
    }),
    [schedules],
  );

  function openCreate(date: string) {
    setEditing(null);
    setNewDate(date);
    setFormOpen(true);
  }

  function openEdit(s: ScheduleRow) {
    setDetail(null);
    setEditing(s);
    setFormOpen(true);
  }

  const columns: DataTableColumn<ScheduleRow>[] = [
    {
      key: "name",
      header: "Horario",
      width: "min-w-[200px]",
      sortable: true,
      sortValue: (s) => s.name,
      primary: {
        title: (s) => s.name,
        subtitle: (s) => formatLongCap(s.date),
        icon: <CalendarClock />,
        iconTone: "amber",
        onClick: (s) => setDetail(s),
      },
    },
    { key: "date", header: "Fecha", width: "w-32", sortable: true, sortValue: (s) => `${s.date} ${s.start_time}`, cell: (s) => <span className="font-mono text-xs">{s.date}</span> },
    {
      key: "time",
      header: "Franja",
      width: "w-44",
      cell: (s) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-foreground">
            {s.start_time}–{s.end_time}
          </span>
          {s.overnight && (
            <Tag tone="indigo" size="sm">
              +1 día
            </Tag>
          )}
        </div>
      ),
    },
    { key: "hours", header: "Horas", align: "right", width: "w-20", cell: (s) => <span className="font-mono text-xs">{s.hours} h</span> },
    {
      key: "employees",
      header: "Personal",
      width: "min-w-[220px]",
      cell: (s) =>
        s.employees.length === 0 ? (
          <StatusBadge tone="warning" size="sm">
            Sin personal
          </StatusBadge>
        ) : (
          <div className="flex max-w-sm flex-wrap gap-1">
            {s.employees.map((e) => (
              <Tag key={e.employee_id} tone={e.active ? "blue" : "neutral"} size="sm">
                {e.full_name}
              </Tag>
            ))}
          </div>
        ),
    },
    {
      key: "actions",
      header: "Acciones",
      align: "right",
      width: "w-36",
      cell: (s) => (
        <RowActions
          size="sm"
          actions={[
            { key: "assign", label: "Asignar personal", icon: <UserPlus />, tone: "blue", hidden: !can("horarios.editar"), onClick: () => setAssigning(s) },
            { key: "edit", label: "Editar horario", icon: <Edit2 />, tone: "amber", hidden: !can("horarios.editar"), onClick: () => openEdit(s) },
            { key: "delete", label: "Eliminar horario", icon: <Trash2 />, tone: "rose", hidden: !can("horarios.eliminar"), onClick: () => setDeleting(s) },
          ]}
        />
      ),
    },
  ];

  const isCurrentWeek = today !== null && monday === mondayOf(today);

  return (
    <>
      <ModuleHeader
        title="Horarios Laborales"
        subtitle="Turnos de la semana y personal asignado a cada uno"
        icon={CalendarClock}
      >
        <div className="flex flex-wrap items-center justify-end gap-2">
          <SegmentedTabs<View>
            ariaLabel="Vista de horarios"
            value={view}
            onValueChange={setView}
            items={[
              { value: "week", label: "Semana", icon: <CalendarDays />, tone: "brand" },
              { value: "list", label: "Lista", icon: <List />, tone: "brand" },
            ]}
          />
          {can("horarios.crear") && (
            <AppButton size="sm" icon={<Plus />} onClick={() => openCreate(today ?? "")}>
              Nuevo Horario
            </AppButton>
          )}
        </div>
      </ModuleHeader>

      <main className="flex min-w-0 flex-1 flex-col gap-5 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard layout="label-first" tone="neutral" icon={<CalendarClock />} label="Turnos de la Semana" value={metrics.shifts} />
          <StatCard layout="label-first" tone="blue" icon={<Clock />} label="Horas Programadas" value={metrics.hours} colorValue />
          <StatCard layout="label-first" tone="emerald" icon={<Users />} label="Personal Asignado" value={metrics.people} colorValue />
          <StatCard layout="label-first" tone="amber" icon={<AlertCircle />} label="Turnos Sin Personal" value={metrics.unstaffed} colorValue />
        </div>

        {/* Navegación por semanas */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-card p-3 shadow-xs sm:p-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <AppButton variant="secondary" size="sm" ariaLabel="Semana anterior" icon={<ChevronLeft />} onClick={() => monday && setMonday(addDays(monday, -7))} />
            <AppButton variant="secondary" size="sm" ariaLabel="Semana siguiente" icon={<ChevronRight />} onClick={() => monday && setMonday(addDays(monday, 7))} />
            <AppButton variant="soft" size="sm" disabled={isCurrentWeek || !today} onClick={() => today && setMonday(mondayOf(today))}>
              Hoy
            </AppButton>
          </div>
          <p className="text-sm font-bold text-foreground">{monday ? formatWeekRange(monday) : "\u00a0"}</p>
          <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm border border-blue-300 bg-blue-100" /> Con personal
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm border border-amber-300 bg-amber-100" /> Sin personal
            </span>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-rose-600">
            {error}
          </p>
        )}

        {view === "week" && monday ? (
          <WeekGrid
            monday={monday}
            today={today}
            schedules={schedules}
            canCreate={can("horarios.crear")}
            onCreate={openCreate}
            onOpen={setDetail}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={schedules}
            rowKey={(s) => s.shift_id}
            loading={loading}
            loadingMode="auto"
            defaultSort={{ key: "date", direction: "asc" }}
            pagination={{ defaultPageSize: 15, itemLabel: "horarios" }}
            emptyState={{
              icon: <CalendarClock className="h-7 w-7" />,
              title: "No hay horarios en esta semana",
              description: "Crea un horario o muévete a otra semana.",
              action: can("horarios.crear") ? (
                <AppButton size="sm" icon={<Plus />} onClick={() => openCreate(monday ?? "")}>
                  Nuevo Horario
                </AppButton>
              ) : undefined,
            }}
          />
        )}
      </main>

      <ScheduleDetailDialog
        schedule={detail}
        canEdit={can("horarios.editar")}
        canDelete={can("horarios.eliminar")}
        onClose={() => setDetail(null)}
        onAssign={(s) => {
          setDetail(null);
          setAssigning(s);
        }}
        onEdit={openEdit}
        onDelete={(s) => {
          setDetail(null);
          setDeleting(s);
        }}
      />
      <ScheduleForm
        open={formOpen}
        schedule={editing}
        defaultDate={newDate}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          load();
        }}
      />
            <AssignEmployeesDialog
        schedule={assigning}
        sameDay={assigning ? schedules.filter((s) => s.date === assigning.date) : []}
        onClose={() => setAssigning(null)}
        onSaved={() => {
          setAssigning(null);
          load();
        }}
      />
      <DeleteScheduleDialog
        schedule={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => {
          setDeleting(null);
          load();
        }}
      />
    </>
  );
}
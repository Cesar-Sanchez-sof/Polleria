"use client";

import { Plus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { DAYS_SHORT, dayNumber, formatLong, weekDays } from "./dates";
import type { ScheduleRow } from "./ScheduleDialogs";

/** Alto en píxeles de cada hora del calendario. */
const HOUR_PX = 56;
/** Alto mínimo de un bloque para que su texto siga siendo legible. */
const MIN_BLOCK_PX = 44;

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

interface Placed {
  schedule: ScheduleRow;
  top: number;
  height: number;
  lane: number;
  lanes: number;
}

/** Coloca los turnos del día en carriles para que los que se cruzan queden lado a lado. */
function layoutDay(day: ScheduleRow[], startMin: number): Placed[] {
  const sorted = [...day].sort((a, b) => toMin(a.start_time) - toMin(b.start_time) || a.shift_id - b.shift_id);
  const laneEnds: number[] = [];
  const placed = sorted.map((schedule) => {
    const start = toMin(schedule.start_time);
    // Un turno nocturno sigue pasada la medianoche: se dibuja hasta su fin real (marcado con "+1").
    const end = toMin(schedule.end_time) + (schedule.overnight ? 24 * 60 : 0);
    let lane = laneEnds.findIndex((e) => e <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    return {
      schedule,
      top: ((start - startMin) / 60) * HOUR_PX,
      height: Math.max(((end - start) / 60) * HOUR_PX, MIN_BLOCK_PX),
      lane,
    };
  });
  const lanes = Math.max(1, laneEnds.length);
  return placed.map((p) => ({ ...p, lanes }));
}

function Count({ staffed, n, narrow }: { staffed: boolean; n: number; narrow: boolean }) {
  return (
    <span className="mt-auto flex shrink-0 items-center gap-1 text-[11px] font-semibold">
      <Users className="size-3" />
      {staffed ? n : narrow ? "0" : "Sin personal"}
    </span>
  );
}

interface Props {
  monday: string;
  today: string | null;
  schedules: ScheduleRow[];
  canCreate: boolean;
  onCreate: (date: string) => void;
  onOpen: (schedule: ScheduleRow) => void;
}

/** Calendario semanal: una columna por día y los turnos como bloques sobre un eje de horas. */
export function WeekGrid({ monday, today, schedules, canCreate, onCreate, onOpen }: Props) {
  const days = weekDays(monday);

  // Rango de horas visible: al menos 16:00–24:00, ampliado si hay turnos fuera de ese rango.
  const startHour = Math.min(16, ...schedules.map((s) => Math.floor(toMin(s.start_time) / 60)));
  const endHour = Math.max(
    24,
    ...schedules.map((s) => Math.ceil((toMin(s.end_time) + (s.overnight ? 24 * 60 : 0)) / 60)),
  );
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  const bodyHeight = (endHour - startHour) * HOUR_PX + 8;

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-card shadow-xs dark:border-slate-800">
      <div className="grid min-w-[880px] grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
        {/* Encabezado de días */}
        <div className="border-b border-slate-200/80 dark:border-slate-800" />
        {days.map((day, i) => {
          const isToday = day === today;
          return (
            <div
              key={day}
              className={cn(
                "flex items-center justify-between gap-1 border-b border-l border-slate-200/80 px-3 py-2.5 dark:border-slate-800",
                isToday && "bg-red-50/60 dark:bg-red-950/20",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{DAYS_SHORT[i]}</span>
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-sm font-bold",
                    isToday ? "bg-primary text-primary-foreground" : "text-foreground",
                  )}
                >
                  {dayNumber(day)}
                </span>
              </div>
              {canCreate && (
                <button
                  type="button"
                  onClick={() => onCreate(day)}
                  aria-label={`Agregar horario el ${formatLong(day)}`}
                  title="Agregar horario"
                  className="flex size-6 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground dark:hover:bg-slate-800"
                >
                  <Plus className="size-4" />
                </button>
              )}
            </div>
          );
        })}

        {/* Eje de horas */}
        <div className="relative" style={{ height: bodyHeight }}>
          {hours.map((h, i) => (
            <span
              key={h}
              className="absolute right-2 -translate-y-1/2 font-mono text-[11px] text-muted-foreground"
              style={{ top: i * HOUR_PX + (i === 0 ? 8 : 0) }}
            >
              {String(h % 24).padStart(2, "0")}:00
            </span>
          ))}
        </div>

        {/* Columnas de cada día */}
        {days.map((day) => {
          const placed = layoutDay(
            schedules.filter((s) => s.date === day),
            startHour * 60,
          );
          return (
            <div
              key={day}
              className={cn("relative border-l border-slate-200/80 dark:border-slate-800", day === today && "bg-red-50/40 dark:bg-red-950/10")}
              style={{ height: bodyHeight }}
            >
              {hours.map((h, i) => (
                <div
                  key={h}
                  className="absolute inset-x-0 border-t border-dashed border-slate-200/80 dark:border-slate-800"
                  style={{ top: i * HOUR_PX }}
                />
              ))}
              {placed.map(({ schedule: s, top, height, lane, lanes }) => {
                const staffed = s.employees.length > 0;
                // Los bloques bajos no tienen sitio para una tercera línea: el conteo sube junto al nombre.
                const compact = height < 64;
                return (
                  <button
                    key={s.shift_id}
                    type="button"
                    onClick={() => onOpen(s)}
                    title={`${s.name} · ${s.start_time}–${s.end_time}`}
                    className={cn(
                      "absolute flex cursor-pointer flex-col overflow-hidden rounded-xl border px-2 py-1.5 text-left shadow-xs transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      staffed
                        ? "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
                        : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200",
                    )}
                    style={{
                      top,
                      height: height - 2,
                      left: `calc(${(lane / lanes) * 100}% + 3px)`,
                      width: `calc(${100 / lanes}% - 6px)`,
                    }}
                  >
                    <span className="flex items-center justify-between gap-1">
                      <span className={cn("truncate font-bold leading-tight", lanes > 1 ? "text-[11px]" : "text-xs")}>{s.name}</span>
                      {compact && <Count staffed={staffed} n={s.employees.length} narrow />}
                    </span>
                    <span className={cn("truncate font-mono leading-tight", lanes > 1 ? "text-[10px]" : "text-[11px]")}>
                      {s.start_time}–{s.end_time}
                      {s.overnight ? " (+1)" : ""}
                    </span>
                    {!compact && <Count staffed={staffed} n={s.employees.length} narrow={lanes > 1} />}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
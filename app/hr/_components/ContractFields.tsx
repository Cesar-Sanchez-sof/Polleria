"use client";

import { useMemo } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ContractDto } from "@/lib/services/hr/contracts.service";
import type { ShiftTemplateDto } from "@/lib/services/hr/shift-templates.service";
import {
  AFP_NAMES,
  CONTRACT_TYPE_LABEL,
  LABOR_REGIME_LABEL,
  MINIMUM_WAGE,
  WEEKDAY_LABEL,
  annualVacationDays,
  evaluateSchedule,
  hasTrialPeriod,
  isEmployment,
  requiresEndDate,
  trialEndFor,
  type ContractTypeCode,
  type LaborRegimeCode,
  type PensionSystemCode,
  type ScheduleSummary,
} from "@/lib/services/hr/labor-rules";

export interface ContractFormState {
  contract_type: ContractTypeCode;
  labor_regime: LaborRegimeCode;
  position: string;
  area: string;
  start_date: string;
  end_date: string;
  trial_end_date: string;
  base_salary: string;
  family_allowance: boolean;
  pension_system: PensionSystemCode;
  afp_name: string;
  cuspp: string;
  notes: string;
  /** weekday (0 = lunes) → ids de turnos base. */
  schedule: Record<number, number[]>;
}

export function emptyContract(today: string): ContractFormState {
  return {
    contract_type: "Indeterminado",
    labor_regime: "General",
    position: "",
    area: "",
    start_date: today,
    end_date: "",
    trial_end_date: "",
    base_salary: String(MINIMUM_WAGE),
    family_allowance: false,
    pension_system: "ONP",
    afp_name: "",
    cuspp: "",
    notes: "",
    schedule: {},
  };
}

export function contractFromDto(c: ContractDto): ContractFormState {
  return {
    contract_type: c.contract_type,
    labor_regime: c.labor_regime,
    position: c.position,
    area: c.area,
    start_date: c.start_date,
    end_date: c.end_date ?? "",
    trial_end_date: c.trial_end_date ?? "",
    base_salary: String(c.base_salary),
    family_allowance: c.family_allowance,
    pension_system: c.pension_system,
    afp_name: c.afp_name ?? "",
    cuspp: c.cuspp ?? "",
    notes: c.notes ?? "",
    schedule: Object.fromEntries(c.schedule.map((d) => [d.weekday, d.shifts.map((s) => s.template_id)])),
  };
}

export function toContractPayload(s: ContractFormState) {
  return {
    contract_type: s.contract_type,
    labor_regime: s.labor_regime,
    position: s.position,
    area: s.area,
    start_date: s.start_date,
    end_date: s.end_date || null,
    trial_end_date: s.trial_end_date || null,
    base_salary: s.base_salary,
    family_allowance: s.family_allowance,
    pension_system: s.pension_system,
    afp_name: s.afp_name || null,
    cuspp: s.cuspp || null,
    notes: s.notes || null,
    schedule: Object.entries(s.schedule)
      .filter(([, ids]) => ids.length > 0)
      .map(([weekday, ids]) => ({ weekday: Number(weekday), template_ids: ids })),
  };
}

/** Evalúa el horario en el cliente con las mismas reglas que el servidor. */
export function useScheduleSummary(state: ContractFormState, templates: ShiftTemplateDto[]) {
  return useMemo((): { summary: ScheduleSummary | null; error: string | null } => {
    const map = new Map(templates.map((t) => [t.id, t]));
    const days = toContractPayload(state).schedule;
    if (days.length === 0) return { summary: null, error: "Marca los turnos que cubrirá cada día" };
    try {
      return { summary: evaluateSchedule(state.contract_type, days, map), error: null };
    } catch (e) {
      return { summary: null, error: e instanceof Error ? e.message : "Horario no válido" };
    }
  }, [state, templates]);
}

const POSITIONS = ["Mozo(a)", "Cajero(a)", "Cocinero(a)", "Ayudante de cocina", "Parrillero(a)", "Bartender", "Repartidor(a)", "Limpieza", "Administrador(a)"];
const AREAS = ["Salón", "Cocina", "Caja", "Bar", "Delivery", "Limpieza", "Administración"];

type Patch = (p: Partial<ContractFormState>) => void;

/** Condiciones del contrato: modalidad, cargo, fechas, sueldo y pensión. */
export function ContractTermsFields({ value, onChange, lockType = false }: { value: ContractFormState; onChange: Patch; lockType?: boolean }) {
  const v = value;
  const needsEnd = requiresEndDate(v.contract_type);
  const trial = hasTrialPeriod(v.contract_type);
  const pensionApplies = isEmployment(v.contract_type) && v.contract_type !== "Practicas";
  const vacation = annualVacationDays(v.labor_regime, v.contract_type);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="contract_type">
          Modalidad de contrato <span className="text-red-500">*</span>
        </Label>
        <NativeSelect
          id="contract_type"
          className="w-full"
          value={v.contract_type}
          disabled={lockType}
          onChange={(e) => {
            const t = e.target.value as ContractTypeCode;
            onChange({
              contract_type: t,
              end_date: t === "Indeterminado" ? "" : v.end_date,
              pension_system: isEmployment(t) && t !== "Practicas" ? (v.pension_system === "Ninguno" ? "ONP" : v.pension_system) : "Ninguno",
            });
          }}
        >
          {(Object.keys(CONTRACT_TYPE_LABEL) as ContractTypeCode[]).map((t) => (
            <NativeSelectOption key={t} value={t}>
              {CONTRACT_TYPE_LABEL[t]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="labor_regime">Régimen laboral</Label>
        <NativeSelect id="labor_regime" className="w-full" value={v.labor_regime} onChange={(e) => onChange({ labor_regime: e.target.value as LaborRegimeCode })}>
          {(Object.keys(LABOR_REGIME_LABEL) as LaborRegimeCode[]).map((r) => (
            <NativeSelectOption key={r} value={r}>
              {LABOR_REGIME_LABEL[r]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <p className="text-[11px] text-muted-foreground">
          {vacation > 0 ? `${vacation} días de vacaciones por año completo` : "Esta modalidad no genera vacaciones"}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="position">
          Cargo <span className="text-red-500">*</span>
        </Label>
        <Input id="position" list="hr-positions" maxLength={40} value={v.position} onChange={(e) => onChange({ position: e.target.value })} placeholder="Mozo(a), cocinero(a)…" />
        <datalist id="hr-positions">
          {POSITIONS.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="area">
          Área <span className="text-red-500">*</span>
        </Label>
        <Input id="area" list="hr-areas" maxLength={30} value={v.area} onChange={(e) => onChange({ area: e.target.value })} placeholder="Salón, cocina, caja…" />
        <datalist id="hr-areas">
          {AREAS.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="start_date">
          Fecha de inicio <span className="text-red-500">*</span>
        </Label>
        <Input id="start_date" type="date" value={v.start_date} onChange={(e) => onChange({ start_date: e.target.value })} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="end_date">
          Fecha de término {needsEnd && <span className="text-red-500">*</span>}
        </Label>
        <Input
          id="end_date"
          type="date"
          value={v.end_date}
          min={v.start_date}
          disabled={v.contract_type === "Indeterminado"}
          onChange={(e) => onChange({ end_date: e.target.value })}
        />
        {v.contract_type === "Indeterminado" && <p className="text-[11px] text-muted-foreground">Plazo indeterminado: sin fecha de término</p>}
      </div>

      {trial && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="trial_end_date">Fin del periodo de prueba</Label>
          <Input
            id="trial_end_date"
            type="date"
            value={v.trial_end_date}
            min={v.start_date}
            placeholder={v.start_date ? trialEndFor(v.start_date) : ""}
            onChange={(e) => onChange({ trial_end_date: e.target.value })}
          />
          <p className="text-[11px] text-muted-foreground">
            Por defecto 3 meses{v.start_date ? ` (hasta el ${trialEndFor(v.start_date)})` : ""}.
          </p>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="base_salary">
          {v.contract_type === "Practicas" ? "Subvención mensual (S/)" : v.contract_type === "LocacionServicios" ? "Honorarios mensuales (S/)" : "Sueldo básico (S/)"}{" "}
          <span className="text-red-500">*</span>
        </Label>
        <Input id="base_salary" type="number" min={0} step="0.01" value={v.base_salary} onChange={(e) => onChange({ base_salary: e.target.value })} />
        {(v.contract_type === "Indeterminado" || v.contract_type === "PlazoFijo") && (
          <p className="text-[11px] text-muted-foreground">Mínimo legal: S/ {MINIMUM_WAGE.toFixed(2)} (RMV)</p>
        )}
      </div>

      {pensionApplies && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pension_system">
              Sistema de pensiones <span className="text-red-500">*</span>
            </Label>
            <NativeSelect
              id="pension_system"
              className="w-full"
              value={v.pension_system}
              onChange={(e) => onChange({ pension_system: e.target.value as PensionSystemCode })}
            >
              <NativeSelectOption value="ONP">ONP (Sistema Nacional)</NativeSelectOption>
              <NativeSelectOption value="AFP">AFP (Sistema Privado)</NativeSelectOption>
            </NativeSelect>
          </div>
          {v.pension_system === "AFP" ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="afp_name">
                  AFP <span className="text-red-500">*</span>
                </Label>
                <NativeSelect id="afp_name" className="w-full" value={v.afp_name} onChange={(e) => onChange({ afp_name: e.target.value })}>
                  <NativeSelectOption value="">Selecciona</NativeSelectOption>
                  {AFP_NAMES.map((a) => (
                    <NativeSelectOption key={a} value={a}>
                      {a}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cuspp">CUSPP</Label>
                <Input id="cuspp" maxLength={12} value={v.cuspp} onChange={(e) => onChange({ cuspp: e.target.value.toUpperCase() })} className="font-mono" />
              </div>
            </div>
          ) : (
            <div />
          )}
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={v.family_allowance}
              onChange={(e) => onChange({ family_allowance: e.target.checked })}
            />
            Percibe asignación familiar (tiene hijos menores de 18 o cursando estudios superiores)
          </label>
        </>
      )}

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="notes">Observaciones</Label>
        <Input id="notes" maxLength={255} value={v.notes} onChange={(e) => onChange({ notes: e.target.value })} placeholder="Causa objetiva del plazo fijo, acuerdos especiales…" />
      </div>
    </div>
  );
}

/** Horario pactado: qué turnos base cubre cada día de la semana, con la jornada calculada en vivo. */
export function ScheduleFields({
  value,
  onChange,
  templates,
}: {
  value: ContractFormState;
  onChange: Patch;
  templates: ShiftTemplateDto[];
}) {
  const { summary, error } = useScheduleSummary(value, templates);
  const active = templates.filter((t) => t.active || Object.values(value.schedule).some((ids) => ids.includes(t.id)));

  function toggle(day: number, id: number) {
    const current = value.schedule[day] ?? [];
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    onChange({ schedule: { ...value.schedule, [day]: next } });
  }

  function copyMonday() {
    const monday = value.schedule[0] ?? [];
    onChange({ schedule: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, d === 6 ? [] : [...monday]])) });
  }

  if (active.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        No hay turnos base activos. Créalos en Horarios laborales → Turnos base.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Marca los turnos que cubrirá cada día. Un día sin turnos es día de descanso.</p>
        <button type="button" onClick={copyMonday} className="shrink-0 text-xs font-semibold text-primary hover:underline">
          Copiar lunes a lun–sáb
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[560px] text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Turno</th>
              {WEEKDAY_LABEL.map((d) => (
                <th key={d} className="px-2 py-2 text-center font-semibold">
                  {d.slice(0, 3)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {active.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="px-3 py-2">
                  <p className="font-semibold">{t.name}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {t.start_time}–{t.end_time} · {t.hours} h
                  </p>
                </td>
                {WEEKDAY_LABEL.map((d, i) => (
                  <td key={d} className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      aria-label={`${t.name} el ${d}`}
                      className="h-4 w-4 accent-primary"
                      checked={(value.schedule[i] ?? []).includes(t.id)}
                      onChange={() => toggle(i, t.id)}
                    />
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t bg-muted/30">
              <td className="px-3 py-2 font-semibold">Horas del día</td>
              {WEEKDAY_LABEL.map((d, i) => {
                const h = summary?.daily_hours[i] ?? 0;
                return (
                  <td key={d} className={`px-2 py-2 text-center font-mono ${h === 0 ? "text-muted-foreground" : "font-semibold"}`}>
                    {h === 0 ? "Desc." : `${h}h`}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      {error ? (
        <p className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      ) : summary ? (
        <div className="flex flex-col gap-1.5 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4" /> Jornada de {summary.weekly_hours} h semanales en {summary.working_days} día(s) · {7 - summary.working_days} de descanso
          </p>
          {summary.warnings.map((w) => (
            <p key={w} className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" /> {w}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Horario pactado en solo lectura (ficha del empleado, contratos, autoservicio). */
export function ScheduleView({ schedule }: { schedule: ContractDto["schedule"] }) {
  if (schedule.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin horario pactado.</p>;
  }
  const byDay = new Map(schedule.map((d) => [d.weekday, d.shifts]));
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {WEEKDAY_LABEL.map((d, i) => {
        const shifts = byDay.get(i) ?? [];
        return (
          <div
            key={d}
            className={`flex min-h-20 flex-col gap-1 rounded-lg border p-1.5 text-center ${shifts.length ? "border-primary/30 bg-primary/5" : "bg-muted/40"}`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{d.slice(0, 3)}</p>
            {shifts.length === 0 ? (
              <p className="m-auto text-[10px] text-muted-foreground">Descanso</p>
            ) : (
              shifts.map((s) => (
                <div key={s.template_id} className="rounded bg-background px-1 py-0.5 shadow-xs">
                  <p className="truncate text-[10px] font-semibold">{s.name}</p>
                  <p className="font-mono text-[9px] text-muted-foreground">
                    {s.start_time}–{s.end_time}
                  </p>
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ScheduleHeader() {
  return (
    <p className="flex items-center gap-2 text-sm font-semibold">
      <CalendarClock className="h-4 w-4 text-primary" /> Horario pactado
    </p>
  );
}

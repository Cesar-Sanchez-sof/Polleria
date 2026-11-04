"use client";

import { useCallback, useEffect, useState } from "react";
import { Banknote, BookOpenCheck, Calculator, CheckCircle2, Edit2, Eye, FileText, Landmark, RotateCcw, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { AppButton } from "@/components/shared/AppButton";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { RowActions } from "@/components/shared/RowActions";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePermissions } from "@/components/personalized/PermissionsProvider";
import type { PayrollLineDto, PayrollPeriodDto } from "@/lib/services/hr/payroll.service";
import { PayslipDialog } from "../_components/Payslip";
import { api, fmtDateTime, fmtMinutes, money } from "../_lib/hr-client";

const todayIso = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
/** Por defecto, el mes anterior (la planilla se trabaja al cierre del mes). */
function previousMonth() {
  const t = todayIso();
  const y = Number(t.slice(0, 4));
  const m = Number(t.slice(5, 7));
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

const STATUS_TONE = { Borrador: "warning", Aprobada: "info", Pagada: "success" } as const;

export default function PayrollPage() {
  const { can } = usePermissions();
  const [month, setMonth] = useState(previousMonth);
  const [period, setPeriod] = useState<PayrollPeriodDto | null>(null);
  const [history, setHistory] = useState<PayrollPeriodDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [payslip, setPayslip] = useState<PayrollLineDto | null>(null);
  const [editing, setEditing] = useState<PayrollLineDto | null>(null);
  const [paying, setPaying] = useState(false);
  const [reopening, setReopening] = useState(false);

  const [y, m] = month.split("-").map(Number);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, h] = await Promise.all([
        api<PayrollPeriodDto | null>(`/api/payroll?year=${y}&month=${m}`),
        api<PayrollPeriodDto[]>("/api/payroll"),
      ]);
      setPeriod(p);
      setHistory(h);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cargar la planilla");
    } finally {
      setLoading(false);
    }
  }, [y, m]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos remotos
    load();
  }, [load]);

  async function run(label: string, fn: () => Promise<PayrollPeriodDto>, ok: string) {
    setBusy(label);
    try {
      setPeriod(await fn());
      toast.success(ok);
      api<PayrollPeriodDto[]>("/api/payroll").then(setHistory).catch(() => undefined);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo completar la operación");
    } finally {
      setBusy(null);
    }
  }

  const calculate = () =>
    run("calc", () => api<PayrollPeriodDto>("/api/payroll", { method: "POST", body: { year: y, month: m } }), "Planilla calculada con la asistencia, licencias y adelantos del mes");
  const approve = () =>
    period && run("approve", () => api<PayrollPeriodDto>(`/api/payroll/${period.period_id}`, { method: "PATCH", body: { action: "approve" } }), "Planilla aprobada: asiento de devengo registrado en Contabilidad");

  const p = period;
  const draft = p?.status === "Borrador";
  const columns: DataTableColumn<PayrollLineDto>[] = [
    {
      key: "employee",
      header: "Trabajador",
      width: "min-w-[200px]",
      sortable: true,
      sortValue: (l) => l.employee_name,
      primary: { title: (l) => l.employee_name, subtitle: (l) => `${l.position ?? "—"} · ${l.contract_type_label ?? ""}`, icon: <Users />, iconTone: "amber", onClick: (l) => setPayslip(l) },
    },
    {
      key: "days",
      header: "Días / incidencias",
      cell: (l) => (
        <div className="text-xs">
          <p>
            <b>{l.paid_days}</b>/{l.contract_days} días pagados
          </p>
          {l.unpaid_days > 0 && <p className="text-rose-600">{l.unpaid_days} día(s) no remunerado(s)</p>}
          {l.late_minutes > 0 && <p className="text-amber-600">{fmtMinutes(l.late_minutes)} de tardanza</p>}
          {l.overtime_minutes > 0 && <p className="text-blue-600">{fmtMinutes(l.overtime_minutes)} extra</p>}
        </div>
      ),
    },
    { key: "gross", header: "Bruto", align: "right", sortable: true, sortValue: (l) => l.gross_pay, cell: (l) => <span className="font-mono text-xs">{money.format(l.gross_pay)}</span> },
    {
      key: "deductions",
      header: "Descuentos",
      align: "right",
      cell: (l) => (
        <div className="text-right text-xs">
          <p className="font-mono">{money.format(l.deductions)}</p>
          <p className="text-[11px] text-muted-foreground">
            {l.pension_system ?? ""}
            {l.advance_deduction ? ` · adel. ${money.format(l.advance_deduction)}` : ""}
            {l.income_tax ? ` · 5.ª ${money.format(l.income_tax)}` : ""}
          </p>
        </div>
      ),
    },
    { key: "net", header: "Neto", align: "right", sortable: true, sortValue: (l) => l.net_pay, cell: (l) => <span className="font-mono text-xs font-bold">{money.format(l.net_pay)}</span> },
    { key: "employer", header: "EsSalud + seguros", align: "right", cell: (l) => <span className="font-mono text-xs">{money.format(l.essalud + l.insurance_cost)}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (l) => (
        <RowActions
          size="sm"
          actions={[
            { key: "view", label: "Ver boleta", icon: <Eye />, tone: "blue", onClick: () => setPayslip(l) },
            { key: "edit", label: "Bonos y descuentos", icon: <Edit2 />, tone: "amber", hidden: !draft || !can("planilla.crear"), onClick: () => setEditing(l) },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <ModuleHeader title="Planilla de sueldos" subtitle="Cálculo mensual, boletas de pago y su impacto contable" icon={Wallet}>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Input type="month" value={month} max={todayIso().slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-9 w-44 text-xs" aria-label="Mes de la planilla" />
          {can("planilla.crear") && (!p || draft) && (
            <AppButton size="sm" variant="soft" icon={<Calculator />} loading={busy === "calc"} onClick={calculate}>
              {p ? "Recalcular" : "Calcular planilla"}
            </AppButton>
          )}
          {can("planilla.editar") && draft && (
            <AppButton size="sm" icon={<CheckCircle2 />} loading={busy === "approve"} onClick={approve}>
              Aprobar y contabilizar
            </AppButton>
          )}
          {can("planilla.editar") && p?.status === "Aprobada" && (
            <>
              <AppButton size="sm" variant="secondary" icon={<RotateCcw />} onClick={() => setReopening(true)}>
                Reabrir
              </AppButton>
              <AppButton size="sm" variant="success" icon={<Banknote />} onClick={() => setPaying(true)}>
                Registrar pago
              </AppButton>
            </>
          )}
        </div>
      </ModuleHeader>
      <main className="flex min-w-0 flex-1 flex-col gap-5 p-4 sm:p-6">
        {p ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <p className="font-bold">Planilla de {p.label}</p>
            <StatusBadge tone={STATUS_TONE[p.status]}>{p.status}</StatusBadge>
            <span className="text-xs text-muted-foreground">
              Calculada {fmtDateTime(p.calculated_at)}
              {p.approved_at ? ` · aprobada por ${p.approved_by} el ${fmtDateTime(p.approved_at)}` : ""}
              {p.paid_at ? ` · pagada por ${p.paid_by} (${p.payment_method}) el ${fmtDateTime(p.paid_at)}` : ""}
            </span>
          </div>
        ) : (
          !loading && (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Aún no se calculó la planilla de este mes. «Calcular planilla» toma los contratos vigentes, la asistencia (faltas, tardanzas y horas
              extra), las licencias sin goce, los seguros y las cuotas de adelantos.
            </p>
          )
        )}

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard layout="label-first" tone="neutral" icon={<Users />} label="Trabajadores" value={p?.workers ?? 0} />
          <StatCard layout="label-first" tone="blue" icon={<FileText />} label="Remuneración bruta" value={money.format(p?.total_gross ?? 0)} />
          <StatCard layout="label-first" tone="emerald" icon={<Banknote />} label="Neto a pagar" value={money.format(p?.total_net ?? 0)} colorValue />
          <StatCard layout="label-first" tone="amber" icon={<Landmark />} label="Aportes del empleador" value={money.format(p?.total_employer ?? 0)} footerLeft="EsSalud + seguros" />
        </div>

        <DataTable
          columns={columns}
          rows={p?.lines ?? []}
          rowKey={(l) => l.payroll_id}
          loading={loading}
          loadingMode="auto"
          emptyState={{ icon: <Wallet className="h-7 w-7" />, title: "Sin boletas", description: "Calcula la planilla del mes." }}
        />

        {p && p.journal_entries.length > 0 && (
          <section className="rounded-2xl border bg-card p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-bold">
              <BookOpenCheck className="h-4 w-4 text-primary" /> Impacto contable
            </p>
            <ul className="flex flex-col gap-1.5 text-xs">
              {p.journal_entries.map((j) => (
                <li key={j.id} className={`flex justify-between gap-3 rounded-lg border px-3 py-2 ${j.status ? "" : "opacity-60 line-through"}`}>
                  <span>
                    <b className="font-mono">{j.code}</b> · {j.description}
                    {!j.status && " (anulado)"}
                  </span>
                  <span className="font-mono">{money.format(j.total)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Devengo: 6211 Sueldos · 6271 EsSalud · 6274 Seguros / 4031 EsSalud · 4032 ONP · 407 AFP · 4017 Renta 5.ª · 141 Adelantos · 461
              Aseguradoras · 411 Remuneraciones por pagar. Pago: 411 / 104 Bancos o 101 Caja. Los asientos se ven en Contabilidad → Asientos
              contables (libro «Planillas» y «Caja y bancos»).
            </p>
          </section>
        )}

        {history.length > 0 && (
          <section className="rounded-2xl border bg-card p-4">
            <p className="mb-2 text-sm font-bold">Historial de planillas</p>
            <div className="flex flex-wrap gap-2">
              {history.map((h) => (
                <button
                  key={h.period_id}
                  type="button"
                  onClick={() => setMonth(`${h.year}-${String(h.month).padStart(2, "0")}`)}
                  className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs hover:bg-muted"
                >
                  {h.label} <StatusBadge tone={STATUS_TONE[h.status]}>{h.status}</StatusBadge> {money.format(h.total_net)}
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      <PayslipDialog line={payslip} periodLabel={p?.label ?? ""} onClose={() => setPayslip(null)} />
      {editing && p && (
        <LineDialog
          line={editing}
          onClose={() => setEditing(null)}
          onSaved={(np) => {
            setEditing(null);
            setPeriod(np);
            toast.success("Boleta ajustada y planilla recalculada");
          }}
        />
      )}
      {paying && p && (
        <PayDialog
          period={p}
          onClose={() => setPaying(false)}
          onPaid={(np) => {
            setPaying(false);
            setPeriod(np);
            toast.success("Pago registrado: asiento de pago contabilizado y adelantos descontados");
          }}
        />
      )}
      {reopening && p && (
        <ReopenDialog
          period={p}
          onClose={() => setReopening(false)}
          onDone={(np) => {
            setReopening(false);
            setPeriod(np);
            toast.success("Planilla reabierta: el asiento de devengo quedó anulado");
          }}
        />
      )}
    </>
  );
}

function LineDialog({ line, onClose, onSaved }: { line: PayrollLineDto; onClose: () => void; onSaved: (p: PayrollPeriodDto) => void }) {
  const [bonus, setBonus] = useState(String(line.bonus || ""));
  const [other, setOther] = useState(String(line.other_deductions || ""));
  const [notes, setNotes] = useState(line.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function submit() {
    setSaving(true);
    setError(null);
    try {
      onSaved(await api<PayrollPeriodDto>(`/api/payroll/lines/${line.payroll_id}`, { method: "PUT", body: { bonus, other_deductions: other, notes } }));
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
          <DialogTitle>Bonos y descuentos</DialogTitle>
          <DialogDescription>{line.employee_name}. Los días, tardanzas y horas extra salen de la asistencia: corrígelos allí.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pl-bonus">Bonos / otros ingresos (S/)</Label>
            <Input id="pl-bonus" type="number" min={0} step="0.01" value={bonus} onChange={(e) => setBonus(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pl-other">Otros descuentos (S/)</Label>
            <Input id="pl-other" type="number" min={0} step="0.01" value={other} onChange={(e) => setOther(e.target.value)} />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="pl-notes">Observación (aparece en la boleta)</Label>
            <Input id="pl-notes" maxLength={200} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Bono por metas, retención judicial…" />
          </div>
        </div>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <DialogFooter>
          <AppButton variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </AppButton>
          <AppButton loading={saving} onClick={submit}>
            Guardar y recalcular
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PayDialog({ period, onClose, onPaid }: { period: PayrollPeriodDto; onClose: () => void; onPaid: (p: PayrollPeriodDto) => void }) {
  const [method, setMethod] = useState("Transferencia");
  const [date, setDate] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function submit() {
    setSaving(true);
    setError(null);
    try {
      onPaid(await api<PayrollPeriodDto>(`/api/payroll/${period.period_id}`, { method: "PATCH", body: { action: "pay", payment_method: method, payment_date: date } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar el pago");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pago de la planilla</DialogTitle>
          <DialogDescription>
            Neto total {money.format(period.total_net)} a {period.workers} trabajadores. Se registra el asiento 411 / Caja-Bancos y se descuentan
            las cuotas de adelantos.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pp-method">Medio de pago</Label>
            <NativeSelect id="pp-method" className="w-full" value={method} onChange={(e) => setMethod(e.target.value)}>
              {["Transferencia", "Efectivo", "Yape", "Plin"].map((x) => (
                <NativeSelectOption key={x} value={x}>
                  {x}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pp-date">Fecha de pago</Label>
            <Input id="pp-date" type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <DialogFooter>
          <AppButton variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </AppButton>
          <AppButton variant="success" loading={saving} onClick={submit}>
            Registrar pago
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReopenDialog({ period, onClose, onDone }: { period: PayrollPeriodDto; onClose: () => void; onDone: (p: PayrollPeriodDto) => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function submit() {
    setSaving(true);
    setError(null);
    try {
      onDone(await api<PayrollPeriodDto>(`/api/payroll/${period.period_id}`, { method: "PATCH", body: { action: "reopen", reason } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo reabrir");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reabrir planilla de {period.label}</DialogTitle>
          <DialogDescription>El asiento de devengo queda anulado (no se borra) y la planilla vuelve a borrador para corregirla.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rp-reason">Motivo</Label>
          <Input id="rp-reason" maxLength={150} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Faltó registrar una licencia, bono omitido…" />
        </div>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <DialogFooter>
          <AppButton variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </AppButton>
          <AppButton variant="danger" loading={saving} onClick={submit}>
            Reabrir
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


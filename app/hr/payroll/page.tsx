"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Banknote, Calculator, Edit2, Settings2, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppButton } from "@/components/shared/AppButton";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { RowActions } from "@/components/shared/RowActions";
import { StatusBadge, type StatusBadgeTone } from "@/components/shared/StatusBadge";
import { Tag } from "@/components/shared/TagCell";
import { usePermissions } from "@/components/personalized/PermissionsProvider";
import { CONTRACT_KIND_LABEL, limaToday, LABOR_REGIME_LABEL } from "@/lib/hr/contracts";
import {
  MONTH_LABEL,
  PAYROLL_PARAMETER_CODES,
  PAYROLL_PARAMETER_META,
  PAYROLL_STATUS_LABEL,
  round2,
  type PayrollParameterCode,
  type PayrollStatus,
} from "@/lib/hr/payroll";
import type { PayrollDto, PayrollParameterDto } from "@/lib/services/payroll.service";

const money = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });

const STATUS_TONE: Record<PayrollStatus, StatusBadgeTone> = {
  Draft: "warning",
  Approved: "info",
  Paid: "success",
};

const PAYMENT_METHODS = ["Efectivo", "Transferencia bancaria"] as const;

/** Un parámetro "rate" se guarda como fracción (0.13) y se muestra y escribe como porcentaje (13). */
function showValue(p: Pick<PayrollParameterDto, "unit" | "value">): string {
  return p.unit === "rate" ? `${round2(p.value * 100)}%` : money.format(p.value);
}

export default function PayrollPage() {
  const today = limaToday();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [rows, setRows] = useState<PayrollDto[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toEdit, setToEdit] = useState<PayrollDto | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [paramsOpen, setParamsOpen] = useState(false);
  const { can } = usePermissions();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payroll?year=${year}&month=${month}`);
      if (!res.ok) throw new Error();
      const body = await res.json();
      setRows(body.payrolls);
      setMissing(body.missing_parameters);
      setError(null);
    } catch {
      setError("No se pudo cargar la planilla");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos remotos al cambiar de mes
    load();
  }, [load]);

  const drafts = useMemo(() => rows.filter((r) => r.status === "Draft"), [rows]);
  const approved = useMemo(() => rows.filter((r) => r.status === "Approved"), [rows]);
  const totals = useMemo(
    () => ({
      gross: round2(rows.reduce((s, r) => s + r.gross_pay, 0)),
      net: round2(rows.reduce((s, r) => s + r.net_pay, 0)),
      employer: round2(rows.reduce((s, r) => s + r.employer_contribution, 0)),
    }),
    [rows],
  );

  async function call(url: string, init: RequestInit, onOk: (body: unknown) => string, onFail?: (message: string) => void) {
    setBusy(true);
    try {
      const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = body.error ?? "No se pudo completar la operación";
        if (onFail) onFail(message);
        else toast.error(message);
        return false;
      }
      toast.success(onOk(body));
      await load();
      return true;
    } catch {
      const message = "No se pudo conectar con el servidor";
      if (onFail) onFail(message);
      else toast.error(message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const calculate = () =>
    call(
      "/api/payroll",
      { method: "POST", body: JSON.stringify({ year, month }) },
      (b) => {
        const r = b as { created: number; updated: number; locked: number; without_contract: number };
        return `Planilla calculada: ${r.created} nuevas, ${r.updated} recalculadas${r.locked ? `, ${r.locked} ya aprobadas` : ""}`;
      },
    );

  const approveDrafts = () =>
    call(
      "/api/payroll",
      { method: "PATCH", body: JSON.stringify({ action: "approve", ids: drafts.map((r) => r.payroll_id) }) },
      (b) => `${(b as unknown[]).length} boleta(s) aprobadas y contabilizadas`,
    );

  async function pay(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const data = Object.fromEntries(new FormData(ev.currentTarget));
    setPayError(null);
    const ok = await call(
      "/api/payroll",
      { method: "PATCH", body: JSON.stringify({ action: "pay", ids: approved.map((r) => r.payroll_id), ...data }) },
      (b) => `${(b as unknown[]).length} boleta(s) pagadas`,
      setPayError,
    );
    if (ok) setPaying(false);
  }

  async function saveEdit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!toEdit) return;
    const data = Object.fromEntries(new FormData(ev.currentTarget));
    setEditError(null);
    const ok = await call(
      `/api/payroll/${toEdit.payroll_id}`,
      { method: "PUT", body: JSON.stringify(data) },
      () => `Boleta de ${toEdit.employee_name} actualizada`,
      setEditError,
    );
    if (ok) setToEdit(null);
  }

  const remove = (r: PayrollDto) =>
    call(`/api/payroll/${r.payroll_id}`, { method: "DELETE" }, () => `Boleta de ${r.employee_name} quitada`);

  const columns: DataTableColumn<PayrollDto>[] = [
    {
      key: "employee",
      header: "Empleado",
      width: "min-w-[220px]",
      sortable: true,
      sortValue: (r) => r.employee_name,
      primary: {
        title: (r) => r.employee_name,
        subtitle: (r) => `DNI ${r.employee_dni}${r.position ? ` · ${r.position}` : ""}`,
        icon: <Wallet />,
        iconTone: "indigo",
      },
    },
    {
      key: "contract",
      header: "Contrato",
      width: "min-w-[150px]",
      cell: (r) => (
        <div className="flex flex-col items-start gap-1">
          {r.contract_kind && (
            <Tag tone={r.contract_kind === "Internship" ? "indigo" : r.contract_kind === "FixedTerm" ? "blue" : "emerald"} size="sm">
              {CONTRACT_KIND_LABEL[r.contract_kind]}
            </Tag>
          )}
          {r.regime && r.regime !== "None" && (
            <span className="text-[11px] text-muted-foreground">{LABOR_REGIME_LABEL[r.regime]}</span>
          )}
        </div>
      ),
    },
    {
      key: "earned",
      header: "Ganado",
      align: "right",
      sortable: true,
      sortValue: (r) => r.gross_pay,
      cell: (r) => (
        <div className="text-right">
          <p className="font-mono text-xs font-semibold">{money.format(r.gross_pay)}</p>
          <p className="text-[11px] text-muted-foreground">
            Base {money.format(r.base_salary)}
            {r.family_allowance > 0 ? ` + asig. ${money.format(r.family_allowance)}` : ""}
            {r.overtime_pay + r.bonus > 0 ? ` + extras ${money.format(r.overtime_pay + r.bonus)}` : ""}
            {r.absence_discount > 0 ? ` − faltas ${money.format(r.absence_discount)}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "deductions",
      header: "Descuentos",
      align: "right",
      sortable: true,
      sortValue: (r) => r.deductions,
      cell: (r) => (
        <div className="text-right">
          <p className="font-mono text-xs font-semibold">{money.format(r.deductions)}</p>
          <p className="text-[11px] text-muted-foreground">
            {r.pension_system !== "None" ? `${r.pension_system} ${money.format(r.pension_amount)}` : "Sin pensión"}
            {r.advances > 0 ? ` · anticipo ${money.format(r.advances)}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "net",
      header: "Neto a pagar",
      align: "right",
      sortable: true,
      sortValue: (r) => r.net_pay,
      cell: (r) => <span className="font-mono text-sm font-bold">{money.format(r.net_pay)}</span>,
    },
    {
      key: "employer",
      header: "Aporte empleador",
      align: "right",
      sortable: true,
      sortValue: (r) => r.employer_contribution,
      cell: (r) => <span className="font-mono text-xs">{money.format(r.employer_contribution)}</span>,
    },
    {
      key: "status",
      header: "Estado",
      align: "center",
      width: "w-32",
      sortable: true,
      sortValue: (r) => r.status,
      cell: (r) => (
        <div className="flex flex-col items-center gap-0.5">
          <StatusBadge tone={STATUS_TONE[r.status]}>{PAYROLL_STATUS_LABEL[r.status]}</StatusBadge>
          {r.payment_date && (
            <span className="text-[11px] text-muted-foreground">
              {r.payment_date.slice(8)}/{r.payment_date.slice(5, 7)}/{r.payment_date.slice(0, 4)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      align: "right",
      width: "w-28",
      cell: (r) => (
        <RowActions
          size="sm"
          actions={[
            {
              key: "edit",
              label: "Horas extra, bonos, faltas y anticipos",
              icon: <Edit2 />,
              tone: "amber",
              hidden: r.status !== "Draft" || !can("planilla.editar"),
              onClick: () => {
                setEditError(null);
                setToEdit(r);
              },
            },
            {
              key: "remove",
              label: "Quitar boleta",
              icon: <Trash2 />,
              tone: "rose",
              hidden: r.status !== "Draft" || !can("planilla.editar"),
              onClick: () => remove(r),
            },
          ]}
        />
      ),
    },
  ];

  const years = Array.from({ length: 6 }, (_, i) => Number(today.slice(0, 4)) - 4 + i);

  return (
    <>
      <ModuleHeader title="Planilla" subtitle="Remuneraciones mensuales, aportes y asientos contables" icon={Wallet}>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <NativeSelect value={month} onChange={(e) => setMonth(Number(e.target.value))} aria-label="Mes" className="h-9 w-36">
            {MONTH_LABEL.map((label, i) => (
              <NativeSelectOption key={label} value={i + 1}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <NativeSelect value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Año" className="h-9 w-24">
            {years.map((y) => (
              <NativeSelectOption key={y} value={y}>
                {y}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {can("planilla.ver") && (
            <AppButton size="sm" variant="secondary" icon={<Settings2 />} onClick={() => setParamsOpen(true)}>
              Parámetros
            </AppButton>
          )}
          {can("planilla.crear") && (
            <AppButton size="sm" icon={<Calculator />} onClick={calculate} loading={busy} disabled={missing.length > 0}>
              Calcular planilla
            </AppButton>
          )}
          {can("planilla.editar") && drafts.length > 0 && (
            <AppButton size="sm" variant="secondary" icon={<BadgeCheck />} onClick={approveDrafts} loading={busy}>
              Aprobar borradores ({drafts.length})
            </AppButton>
          )}
          {can("planilla.editar") && approved.length > 0 && (
            <AppButton
              size="sm"
              variant="secondary"
              icon={<Banknote />}
              onClick={() => {
                setPayError(null);
                setPaying(true);
              }}
            >
              Pagar aprobadas ({approved.length})
            </AppButton>
          )}
        </div>
      </ModuleHeader>

      <main className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:p-6">
        {missing.length > 0 && (
          <p role="alert" className="text-sm font-medium text-amber-700">
            Faltan parámetros vigentes en {MONTH_LABEL[month - 1].toLowerCase()} de {year}: {missing.join(", ")}. Cárgalos en
            Parámetros para poder calcular.
          </p>
        )}
        {rows.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {MONTH_LABEL[month - 1]} {year}: ganado{" "}
            <span className="font-medium text-foreground">{money.format(totals.gross)}</span> · neto a pagar{" "}
            <span className="font-medium text-foreground">{money.format(totals.net)}</span> · aporte del empleador{" "}
            <span className="font-medium text-foreground">{money.format(totals.employer)}</span>
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-rose-600">
            {error}
          </p>
        )}

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.payroll_id}
          loading={loading}
          loadingMode="auto"
          defaultSort={{ key: "employee", direction: "asc" }}
          pageResetKey={`${year}-${month}`}
          pagination={{ defaultPageSize: 15, itemLabel: "boletas" }}
          emptyState={{
            icon: <Wallet className="h-7 w-7" />,
            title: `No hay boletas en ${MONTH_LABEL[month - 1].toLowerCase()} de ${year}`,
            description:
              "Calcula la planilla para generar la boleta de cada empleado con contrato en el mes. Los contratos privados no entran.",
          }}
        />
      </main>

      <Dialog open={toEdit !== null} onOpenChange={(o) => !o && setToEdit(null)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={saveEdit} key={toEdit?.payroll_id ?? "none"} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Boleta de {toEdit?.employee_name}</DialogTitle>
              <DialogDescription>
                Montos del mes que no salen del contrato. La pensión y el aporte del empleador se recalculan solos.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["overtime_pay", "Horas extra (S/)", toEdit?.overtime_pay],
                  ["bonus", "Bonos (S/)", toEdit?.bonus],
                  ["absence_discount", "Descuento por faltas (S/)", toEdit?.absence_discount],
                  ["advances", "Anticipos a descontar (S/)", toEdit?.advances],
                ] as const
              ).map(([name, label, value]) => (
                <div key={name} className="flex flex-col gap-1.5">
                  <Label htmlFor={name}>{label}</Label>
                  <Input id={name} name={name} type="number" min={0} step="0.01" defaultValue={String(value ?? 0)} />
                </div>
              ))}
            </div>
            {editError && (
              <p role="alert" className="text-sm font-medium text-rose-600">
                {editError}
              </p>
            )}
            <DialogFooter>
              <AppButton variant="secondary" onClick={() => setToEdit(null)} disabled={busy}>
                Cancelar
              </AppButton>
              <AppButton type="submit" loading={busy}>
                Guardar
              </AppButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={paying} onOpenChange={setPaying}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={pay} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Pagar planilla de {MONTH_LABEL[month - 1].toLowerCase()}</DialogTitle>
              <DialogDescription>
                Se pagan {approved.length} boleta(s) aprobadas por{" "}
                {money.format(round2(approved.reduce((s, r) => s + r.net_pay, 0)))} y se registra la salida de caja o bancos.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="method">Medio de pago</Label>
              <NativeSelect id="method" name="method" defaultValue="Efectivo" className="w-full">
                {PAYMENT_METHODS.map((m) => (
                  <NativeSelectOption key={m} value={m}>
                    {m}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payment_date">Fecha de pago</Label>
              <Input id="payment_date" name="payment_date" type="date" required defaultValue={limaToday()} />
            </div>
            {payError && (
              <p role="alert" className="text-sm font-medium text-rose-600">
                {payError}
              </p>
            )}
            <DialogFooter>
              <AppButton variant="secondary" onClick={() => setPaying(false)} disabled={busy}>
                Cancelar
              </AppButton>
              <AppButton type="submit" icon={<Banknote />} loading={busy}>
                Registrar pago
              </AppButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ParametersDialog open={paramsOpen} onClose={() => setParamsOpen(false)} canEdit={can("planilla.editar")} onChanged={load} />
    </>
  );
}

function ParametersDialog({
  open,
  onClose,
  canEdit,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [items, setItems] = useState<PayrollParameterDto[]>([]);
  const [code, setCode] = useState<PayrollParameterCode>("RMV");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/payroll/parameters");
      if (res.ok) setItems(await res.json());
    } catch {
      /* la lista queda como estaba */
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos remotos al abrir el diálogo
    if (open) refresh();
  }, [open, refresh]);

  const meta = PAYROLL_PARAMETER_META[code];

  async function save(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = new FormData(ev.currentTarget);
    const raw = Number(form.get("value"));
    // Las tasas se escriben como porcentaje y se guardan como fracción.
    const value = meta.unit === "rate" ? raw / 100 : raw;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/payroll/parameters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, value: form.get("value") === "" ? "" : value, effective_from: form.get("effective_from"), notes: form.get("notes") }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "No se pudo guardar");
        return;
      }
      toast.success(`${meta.label} guardado`);
      setFormKey((k) => k + 1);
      await refresh();
      onChanged();
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Parámetros de planilla</DialogTitle>
          <DialogDescription>
            Cada valor rige desde su fecha de vigencia. Los iniciales son sugeridos: confírmalos con tu contador antes de
            aprobar una planilla.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Parámetro</th>
                <th className="px-3 py-2 text-right font-medium">Valor</th>
                <th className="px-3 py-2 font-medium">Vigente desde</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.parameter_id} className="border-t">
                  <td className="px-3 py-1.5">{p.label}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{showValue(p)}</td>
                  <td className="px-3 py-1.5 font-mono">
                    {p.effective_from.slice(8)}/{p.effective_from.slice(5, 7)}/{p.effective_from.slice(0, 4)}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">
                    Aún no hay parámetros cargados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {canEdit && (
          <form key={formKey} onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="param_code">Parámetro</Label>
              <NativeSelect id="param_code" value={code} onChange={(e) => setCode(e.target.value as PayrollParameterCode)} className="w-full">
                {PAYROLL_PARAMETER_CODES.map((c) => (
                  <NativeSelectOption key={c} value={c}>
                    {PAYROLL_PARAMETER_META[c].label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="value">
                Nuevo valor ({meta.unit === "rate" ? "%" : "S/"}) <span className="text-red-500">*</span>
              </Label>
              <Input id="value" name="value" type="number" step="0.0001" min={0} required />
              <p className="text-[11px] text-muted-foreground">{meta.hint}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="effective_from">
                Vigente desde <span className="text-red-500">*</span>
              </Label>
              <Input id="effective_from" name="effective_from" type="date" required defaultValue={limaToday()} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes">Nota</Label>
              <Input id="notes" name="notes" maxLength={200} placeholder="Norma o fuente" />
            </div>
            {error && (
              <p role="alert" className="text-sm font-medium text-rose-600 sm:col-span-2">
                {error}
              </p>
            )}
            <DialogFooter className="sm:col-span-2">
              <AppButton variant="secondary" onClick={onClose} disabled={saving}>
                Cerrar
              </AppButton>
              <AppButton type="submit" loading={saving}>
                Guardar valor
              </AppButton>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

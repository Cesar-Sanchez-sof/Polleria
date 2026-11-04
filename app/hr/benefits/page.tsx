"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Banknote, CheckCircle2, Edit2, HandCoins, HeartHandshake, MinusCircle, Plus, Power, ShieldPlus, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AppButton } from "@/components/shared/AppButton";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { RowActions } from "@/components/shared/RowActions";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePermissions } from "@/components/personalized/PermissionsProvider";
import type { AdvanceDto, InsuranceDto } from "@/lib/services/hr/benefits.service";
import { AdvanceBadge } from "../_components/HrBadges";
import { AdvanceDialog, InsuranceDialog } from "../_components/RequestDialogs";
import { api, fmtDate, money } from "../_lib/hr-client";

type Tab = "insurances" | "advances";
type AdvanceAction = "approve" | "reject" | "pay" | "deduct" | "cancel";

export default function BenefitsPage() {
  const { can } = usePermissions();
  const [selected, setSelected] = useState<Tab>("insurances");
  // Los permisos llegan después del primer render: sin acceso a seguros se muestran los adelantos.
  const tab: Tab = selected === "insurances" && !can("seguros.ver") ? "advances" : selected;

  return (
    <>
      <ModuleHeader title="Seguros y adelantos" subtitle="Coberturas del personal y adelantos de sueldo" icon={HeartHandshake}>
        <SegmentedTabs<Tab>
          ariaLabel="Sección"
          value={tab}
          onValueChange={setSelected}
          items={[
            ...(can("seguros.ver") ? [{ value: "insurances" as const, label: "Seguros", icon: <ShieldPlus className="h-3.5 w-3.5" /> }] : []),
            ...(can("anticipos.ver") ? [{ value: "advances" as const, label: "Adelantos de sueldo", icon: <HandCoins className="h-3.5 w-3.5" /> }] : []),
          ]}
        />
      </ModuleHeader>
      <main className="flex min-w-0 flex-1 flex-col gap-5 p-4 sm:p-6">
        {tab === "insurances" && can("seguros.ver") && <InsurancesSection />}
        {tab === "advances" && can("anticipos.ver") && <AdvancesSection />}
      </main>
    </>
  );
}

function InsurancesSection() {
  const { can } = usePermissions();
  const [rows, setRows] = useState<InsuranceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<InsuranceDto | "new" | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await api<InsuranceDto[]>("/api/insurances"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron cargar los seguros");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos remotos
    load();
  }, [load]);

  async function toggle(i: InsuranceDto) {
    try {
      await api(`/api/insurances/${i.insurance_id}`, { method: "PATCH", body: { active: !i.active } });
      toast.success(i.active ? "Seguro dado de baja" : "Seguro reactivado");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar");
    }
  }

  const active = rows.filter((r) => r.active);
  const visible = showInactive ? rows : active;
  const metrics = {
    vidaLey: new Set(active.filter((r) => r.type === "VidaLey").map((r) => r.employee_id)).size,
    expiring: active.filter((r) => r.validity === "Por vencer" || r.validity === "Vencida").length,
    cost: active.reduce((s, r) => s + r.monthly_cost, 0),
  };

  const columns: DataTableColumn<InsuranceDto>[] = [
    {
      key: "employee",
      header: "Trabajador",
      sortable: true,
      sortValue: (i) => i.employee_name,
      primary: { title: (i) => i.employee_name, subtitle: (i) => `DNI ${i.employee_dni}`, icon: <ShieldPlus />, iconTone: "emerald", href: (i) => `/hr/employees/${i.employee_id}` },
    },
    {
      key: "type",
      header: "Seguro",
      cell: (i) => (
        <div className="text-xs">
          <p className="font-semibold">{i.type_label}</p>
          <p className="text-muted-foreground">
            {i.provider}
            {i.policy_number ? ` · ${i.policy_number}` : ""}
          </p>
        </div>
      ),
    },
    { key: "dates", header: "Cobertura", cell: (i) => <span className="text-xs">{`${fmtDate(i.start_date)} → ${i.end_date ? fmtDate(i.end_date) : "sin fin"}`}</span> },
    { key: "cost", header: "Costo mensual", align: "right", cell: (i) => <span className="font-mono text-xs">{money.format(i.monthly_cost)}</span> },
    {
      key: "validity",
      header: "Vigencia",
      cell: (i) => (
        <StatusBadge tone={i.validity === "Vigente" ? "success" : i.validity === "Por vencer" ? "warning" : i.validity === "Vencida" ? "danger" : "neutral"}>
          {i.validity}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (i) => (
        <RowActions
          size="sm"
          actions={[
            { key: "edit", label: "Editar", icon: <Edit2 />, tone: "amber", hidden: !can("seguros.editar"), onClick: () => setEditing(i) },
            { key: "toggle", label: i.active ? "Dar de baja" : "Reactivar", icon: <Power />, tone: i.active ? "rose" : "emerald", hidden: !can("seguros.editar"), onClick: () => toggle(i) },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard layout="label-first" tone="emerald" icon={<ShieldPlus />} label="Coberturas activas" value={active.length} colorValue />
        <StatCard layout="label-first" tone="blue" icon={<HeartHandshake />} label="Trabajadores con Vida Ley" value={metrics.vidaLey} colorValue />
        <StatCard layout="label-first" tone="amber" icon={<Ban />} label="Por vencer o vencidas" value={metrics.expiring} colorValue />
        <StatCard layout="label-first" tone="neutral" icon={<Banknote />} label="Costo mensual" value={money.format(metrics.cost)} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" className="h-4 w-4 accent-primary" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Mostrar seguros dados de baja
        </label>
        {can("seguros.crear") && (
          <AppButton size="sm" icon={<Plus />} onClick={() => setEditing("new")}>
            Registrar seguro
          </AppButton>
        )}
      </div>
      <DataTable
        columns={columns}
        rows={visible}
        rowKey={(i) => i.insurance_id}
        loading={loading}
        loadingMode="auto"
        pagination={{ defaultPageSize: 15, itemLabel: "seguros" }}
        emptyState={{ icon: <ShieldPlus className="h-7 w-7" />, title: "Sin seguros registrados" }}
      />
      <InsuranceDialog
        open={editing !== null}
        insurance={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={(msg) => {
          setEditing(null);
          toast.success(msg);
          load();
        }}
      />
    </>
  );
}

function AdvancesSection() {
  const { can } = usePermissions();
  const [rows, setRows] = useState<AdvanceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [acting, setActing] = useState<{ advance: AdvanceDto; action: AdvanceAction } | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await api<AdvanceDto[]>("/api/advances"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron cargar los adelantos");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos remotos
    load();
  }, [load]);

  const metrics = useMemo(
    () => ({
      pending: rows.filter((r) => r.status === "Pendiente").length,
      toPay: rows.filter((r) => r.status === "Aprobado").length,
      outstanding: rows.filter((r) => r.status === "Pagado").reduce((s, r) => s + r.balance, 0),
      monthly: rows.filter((r) => r.status === "Pagado").reduce((s, r) => s + Math.min(r.installment_amount, r.balance), 0),
    }),
    [rows],
  );

  const edit = can("anticipos.editar");
  const columns: DataTableColumn<AdvanceDto>[] = [
    {
      key: "employee",
      header: "Trabajador",
      sortable: true,
      sortValue: (a) => a.employee_name,
      primary: { title: (a) => a.employee_name, subtitle: (a) => fmtDate(a.request_date), icon: <HandCoins />, iconTone: "amber", href: (a) => `/hr/employees/${a.employee_id}` },
    },
    {
      key: "amount",
      header: "Monto",
      align: "right",
      cell: (a) => (
        <div className="text-right text-xs">
          <p className="font-mono font-semibold">{money.format(a.amount)}</p>
          <p className="text-muted-foreground">
            {a.installments} × {money.format(a.installment_amount)}
          </p>
        </div>
      ),
    },
    { key: "reason", header: "Motivo", cell: (a) => <span className="text-xs text-muted-foreground">{a.reason}</span> },
    {
      key: "balance",
      header: "Saldo por descontar",
      align: "right",
      cell: (a) => <span className="font-mono text-xs">{a.status === "Pagado" || a.status === "Liquidado" ? money.format(a.balance) : "—"}</span>,
    },
    {
      key: "status",
      header: "Estado",
      cell: (a) => (
        <div className="flex flex-col gap-0.5">
          <AdvanceBadge status={a.status} />
          {a.payment_method && (
            <span className="text-[11px] text-muted-foreground">
              {a.payment_method}
              {a.journal_entry_id ? " · asiento 141 / caja registrado" : ""}
            </span>
          )}
          {a.review_note && <span className="max-w-40 truncate text-[11px] text-muted-foreground">{a.review_note}</span>}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      align: "right",
      cell: (a) => (
        <RowActions
          size="sm"
          actions={[
            { key: "approve", label: "Aprobar", icon: <CheckCircle2 />, tone: "emerald", hidden: !edit || a.status !== "Pendiente", onClick: () => setActing({ advance: a, action: "approve" }) },
            { key: "reject", label: "Rechazar", icon: <XCircle />, tone: "rose", hidden: !edit || a.status !== "Pendiente", onClick: () => setActing({ advance: a, action: "reject" }) },
            { key: "pay", label: "Registrar entrega", icon: <Banknote />, tone: "blue", hidden: !edit || a.status !== "Aprobado", onClick: () => setActing({ advance: a, action: "pay" }) },
            { key: "deduct", label: "Registrar descuento", icon: <MinusCircle />, tone: "amber", hidden: !edit || a.status !== "Pagado", onClick: () => setActing({ advance: a, action: "deduct" }) },
            {
              key: "cancel",
              label: "Anular",
              icon: <Ban />,
              tone: "neutral",
              hidden: !edit || (a.status !== "Pendiente" && a.status !== "Aprobado"),
              onClick: () => setActing({ advance: a, action: "cancel" }),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard layout="label-first" tone="amber" icon={<HandCoins />} label="Por aprobar" value={metrics.pending} colorValue />
        <StatCard layout="label-first" tone="blue" icon={<Banknote />} label="Aprobados por entregar" value={metrics.toPay} colorValue />
        <StatCard layout="label-first" tone="rose" icon={<MinusCircle />} label="Saldo por descontar" value={money.format(metrics.outstanding)} />
        <StatCard layout="label-first" tone="neutral" icon={<MinusCircle />} label="Descuento del próximo mes" value={money.format(metrics.monthly)} />
      </div>
      {can("anticipos.crear") && (
        <div className="flex justify-end">
          <AppButton size="sm" icon={<Plus />} onClick={() => setCreating(true)}>
            Registrar adelanto
          </AppButton>
        </div>
      )}
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(a) => a.advance_id}
        loading={loading}
        loadingMode="auto"
        pagination={{ defaultPageSize: 15, itemLabel: "adelantos" }}
        emptyState={{ icon: <HandCoins className="h-7 w-7" />, title: "Sin adelantos registrados" }}
      />
      {creating && (
        <AdvanceDialog
          open
          onClose={() => setCreating(false)}
          onSaved={(msg) => {
            setCreating(false);
            toast.success(msg);
            load();
          }}
        />
      )}
      {acting && (
        <AdvanceActionDialog
          {...acting}
          onClose={() => setActing(null)}
          onDone={(msg) => {
            setActing(null);
            toast.success(msg);
            load();
          }}
        />
      )}
    </>
  );
}

const ACTION_TEXT: Record<AdvanceAction, { title: string; button: string; done: string }> = {
  approve: { title: "Aprobar adelanto", button: "Aprobar", done: "Adelanto aprobado" },
  reject: { title: "Rechazar adelanto", button: "Rechazar", done: "Adelanto rechazado" },
  pay: { title: "Registrar entrega", button: "Registrar entrega", done: "Entrega registrada y contabilizada (141 Adelantos / Caja-Bancos)" },
  deduct: { title: "Registrar descuento manual", button: "Registrar descuento", done: "Descuento registrado" },
  cancel: { title: "Anular adelanto", button: "Anular", done: "Adelanto anulado" },
};

function AdvanceActionDialog({
  advance,
  action,
  onClose,
  onDone,
}: {
  advance: AdvanceDto;
  action: AdvanceAction;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [note, setNote] = useState("");
  const [method, setMethod] = useState("Efectivo");
  const [amount, setAmount] = useState(String(Math.min(advance.installment_amount, advance.balance)));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const text = ACTION_TEXT[action];

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await api(`/api/advances/${advance.advance_id}`, { method: "PATCH", body: { action, note, payment_method: method, amount } });
      onDone(text.done);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{text.title}</DialogTitle>
          <DialogDescription>
            {advance.employee_name}: {money.format(advance.amount)} en {advance.installments} cuota(s) — {advance.reason}
          </DialogDescription>
        </DialogHeader>
        {action === "pay" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adv-method">Medio de entrega</Label>
            <NativeSelect id="adv-method" className="w-full" value={method} onChange={(e) => setMethod(e.target.value)}>
              {["Efectivo", "Transferencia", "Yape", "Plin"].map((m) => (
                <NativeSelectOption key={m} value={m}>
                  {m}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        )}
        {action === "deduct" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adv-amount">Monto descontado (S/)</Label>
            <Input id="adv-amount" type="number" min={0.01} step="0.01" max={advance.balance} value={amount} onChange={(e) => setAmount(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">Saldo pendiente: {money.format(advance.balance)}</p>
          </div>
        )}
        {(action === "approve" || action === "reject" || action === "cancel") && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adv-note">
              {action === "reject" ? "Motivo del rechazo" : "Observación"} {action === "reject" && <span className="text-red-500">*</span>}
            </Label>
            <Input id="adv-note" maxLength={255} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        )}
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <DialogFooter>
          <AppButton variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </AppButton>
          <AppButton variant={action === "reject" || action === "cancel" ? "danger" : "primary"} loading={saving} onClick={submit}>
            {text.button}
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

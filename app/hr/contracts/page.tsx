"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarClock, CheckCircle2, Edit2, FileText, Plus, RefreshCw, Search, UserX, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppButton } from "@/components/shared/AppButton";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { RowActions } from "@/components/shared/RowActions";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge, type StatusBadgeTone } from "@/components/shared/StatusBadge";
import { Tag } from "@/components/shared/TagCell";
import { usePermissions } from "@/components/personalized/PermissionsProvider";
import {
  CONTRACT_KIND_LABEL,
  CONTRACT_STATUS_LABEL,
  LABOR_REGIME_LABEL,
  limaToday,
  type ContractStatus,
} from "@/lib/hr/contracts";
import { ContractForm, type ContractFormMode, type ContractRow, type EmployeeOption } from "./ContractForm";

type StatusFilter = "all" | ContractStatus;

const money = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });

const STATUS_TONE: Record<ContractStatus, StatusBadgeTone> = {
  active: "success",
  expiring: "warning",
  upcoming: "info",
  expired: "danger",
  terminated: "neutral",
};

/** "AAAA-MM-DD" → "DD/MM/AAAA". */
const shortDate = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

function endNote(c: ContractRow): string | null {
  if (c.terminated_at) return `Rescindido el ${shortDate(c.terminated_at)}`;
  if (c.days_to_end === null) return null;
  if (c.days_to_end < 0) return `Venció hace ${-c.days_to_end} día(s)`;
  if (c.days_to_end === 0) return "Vence hoy";
  if (c.status === "expiring") return `Vence en ${c.days_to_end} día(s)`;
  return null;
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<ContractFormMode>({ type: "create" });
  const [formKey, setFormKey] = useState(0);
  const [toTerminate, setToTerminate] = useState<ContractRow | null>(null);
  const [terminateError, setTerminateError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { can } = usePermissions();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/contracts");
      if (!res.ok) throw new Error();
      const body = await res.json();
      setContracts(body.contracts);
      setEmployees(body.employees);
      setError(null);
    } catch {
      setError("No se pudo cargar la lista de contratos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos remotos
    load();
  }, [load]);

  const metrics = useMemo(() => {
    const count = (s: ContractStatus) => contracts.filter((c) => c.status === s).length;
    return {
      total: contracts.length,
      active: count("active") + count("expiring"),
      expiring: count("expiring"),
      expired: count("expired"),
      upcoming: count("upcoming"),
      terminated: count("terminated"),
      withoutContract: employees.filter((e) => !e.has_current_contract),
    };
  }, [contracts, employees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contracts.filter((c) => {
      const matchesSearch = !q || c.employee_dni.includes(q) || c.employee_name.toLowerCase().includes(q);
      return matchesSearch && (status === "all" || c.status === status);
    });
  }, [contracts, search, status]);

  const hasActiveFilter = search.trim() !== "" || status !== "all";

  function openForm(mode: ContractFormMode) {
    setFormMode(mode);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  }

  function askTerminate(c: ContractRow) {
    setTerminateError(null);
    setToTerminate(c);
  }

  async function terminate(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!toTerminate) return;
    const data = Object.fromEntries(new FormData(ev.currentTarget));
    setBusy(true);
    setTerminateError(null);
    try {
      const res = await fetch(`/api/contracts/${toTerminate.contract_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTerminateError(body.error ?? "No se pudo rescindir el contrato");
        return;
      }
      toast.success(`Contrato de ${toTerminate.employee_name} rescindido`);
      setToTerminate(null);
      await load();
    } catch {
      setTerminateError("No se pudo conectar con el servidor");
    } finally {
      setBusy(false);
    }
  }

  const columns: DataTableColumn<ContractRow>[] = [
    {
      key: "employee",
      header: "Empleado",
      width: "min-w-[220px]",
      sortable: true,
      sortValue: (c) => c.employee_name,
      primary: {
        title: (c) => c.employee_name,
        subtitle: (c) => `DNI ${c.employee_dni}${c.position ? ` · ${c.position}` : ""}`,
        icon: <FileText />,
        iconTone: "indigo",
      },
    },
    {
      key: "kind",
      header: "Contrato",
      width: "min-w-[170px]",
      sortable: true,
      sortValue: (c) => c.kind,
      cell: (c) => (
        <div className="flex flex-col items-start gap-1">
          <Tag tone={c.kind === "Private" ? "amber" : c.kind === "FixedTerm" ? "blue" : "emerald"} size="sm">
            {CONTRACT_KIND_LABEL[c.kind]}
          </Tag>
          <span className="text-[11px] text-muted-foreground">
            {LABOR_REGIME_LABEL[c.regime]}
            {c.renews_contract_id ? " · Renovación" : ""}
          </span>
        </div>
      ),
    },
    {
      key: "period",
      header: "Vigencia",
      width: "min-w-[190px]",
      sortable: true,
      sortValue: (c) => c.start_date,
      cell: (c) => (
        <div className="text-xs">
          <p className="font-mono font-semibold text-foreground">
            {shortDate(c.start_date)} – {c.end_date ? shortDate(c.end_date) : "Sin fin"}
          </p>
          {endNote(c) && (
            <p className={c.status === "expired" ? "text-rose-600" : "text-muted-foreground"}>{endNote(c)}</p>
          )}
        </div>
      ),
    },
    {
      key: "salary",
      header: "Remuneración",
      align: "right",
      sortable: true,
      sortValue: (c) => c.monthly_salary,
      cell: (c) => (
        <div className="text-right">
          <p className="font-mono text-xs font-semibold">{money.format(c.monthly_salary)}</p>
          <p className="text-[11px] text-muted-foreground">{c.weekly_hours} h/semana</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Estado",
      align: "center",
      width: "w-32",
      sortable: true,
      sortValue: (c) => c.status,
      cell: (c) => (
        <StatusBadge tone={STATUS_TONE[c.status]} pulse={c.status === "expiring"}>
          {CONTRACT_STATUS_LABEL[c.status]}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      align: "right",
      width: "w-32",
      cell: (c) => {
        const open = c.status !== "terminated";
        return (
          <RowActions
            size="sm"
            actions={[
              {
                key: "edit",
                label: "Editar contrato",
                icon: <Edit2 />,
                tone: "amber",
                hidden: !open || !can("contratos.editar"),
                onClick: () => openForm({ type: "edit", contract: c }),
              },
              {
                key: "renew",
                label: "Renovar contrato",
                icon: <RefreshCw />,
                tone: "emerald",
                hidden: !(c.status === "expiring" || c.status === "expired") || !can("contratos.crear"),
                onClick: () => openForm({ type: "renew", contract: c }),
              },
              {
                key: "terminate",
                label: "Rescindir contrato",
                icon: <XCircle />,
                tone: "rose",
                hidden: !open || c.status === "expired" || !can("contratos.editar"),
                onClick: () => askTerminate(c),
              },
            ]}
          />
        );
      },
    },
  ];

  return (
    <>
      <ModuleHeader title="Contratos" subtitle="Contratos laborales y vencimientos del personal" icon={FileText}>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="relative w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar empleado..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar contratos"
              className="h-9 rounded-xl pl-9 pr-8 text-xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <SegmentedTabs<StatusFilter>
            ariaLabel="Filtrar por estado"
            value={status}
            onValueChange={setStatus}
            className="max-w-full overflow-x-auto"
            items={[
              { value: "all", label: "Todos", count: metrics.total, tone: "brand" },
              { value: "active", label: "Vigentes", count: contracts.filter((c) => c.status === "active").length, tone: "success" },
              { value: "expiring", label: "Por vencer", count: metrics.expiring, tone: "warning" },
              { value: "upcoming", label: "Por iniciar", count: metrics.upcoming, tone: "info" },
              { value: "expired", label: "Vencidos", count: metrics.expired, tone: "danger" },
              { value: "terminated", label: "Rescindidos", count: metrics.terminated, tone: "neutral" },
            ]}
          />
          {can("contratos.crear") && (
            <AppButton size="sm" icon={<Plus />} onClick={() => openForm({ type: "create" })}>
              Nuevo Contrato
            </AppButton>
          )}
        </div>
      </ModuleHeader>

      <main className="flex min-w-0 flex-1 flex-col gap-5 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard layout="label-first" tone="emerald" icon={<CheckCircle2 />} label="Contratos Vigentes" value={metrics.active} colorValue />
          <StatCard layout="label-first" tone="amber" icon={<CalendarClock />} label="Por Vencer (30 días)" value={metrics.expiring} colorValue />
          <StatCard layout="label-first" tone="rose" icon={<AlertCircle />} label="Vencidos sin Renovar" value={metrics.expired} colorValue />
          <StatCard layout="label-first" tone="blue" icon={<UserX />} label="Empleados sin Contrato" value={metrics.withoutContract.length} colorValue />
        </div>

        {metrics.withoutContract.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Sin contrato vigente:{" "}
            <span className="font-medium text-foreground">
              {metrics.withoutContract
                .slice(0, 6)
                .map((e) => e.full_name)
                .join(", ")}
              {metrics.withoutContract.length > 6 ? ` y ${metrics.withoutContract.length - 6} más` : ""}
            </span>
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm font-medium text-rose-600">
            {error}
          </p>
        )}

        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(c) => c.contract_id}
          loading={loading}
          loadingMode="auto"
          defaultSort={{ key: "period", direction: "desc" }}
          pageResetKey={`${search}|${status}`}
          pagination={{ defaultPageSize: 15, itemLabel: "contratos" }}
          emptyState={{
            icon: <FileText className="h-7 w-7" />,
            title: hasActiveFilter ? "No se encontraron contratos con esos filtros" : "Aún no hay contratos registrados",
            description: hasActiveFilter
              ? "Prueba cambiando los términos de búsqueda o selecciona otro estado."
              : "Registra el contrato de cada empleado para llevar sus vencimientos.",
            action: hasActiveFilter ? (
              <AppButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                }}
              >
                Limpiar filtros
              </AppButton>
            ) : can("contratos.crear") ? (
              <AppButton size="sm" icon={<Plus />} onClick={() => openForm({ type: "create" })}>
                Registrar Primer Contrato
              </AppButton>
            ) : undefined,
          }}
        />
      </main>

      <ContractForm
        key={formKey}
        open={formOpen}
        mode={formMode}
        employees={employees}
        onClose={() => setFormOpen(false)}
        onSaved={(saved, kind) => {
          setFormOpen(false);
          toast.success(
            kind === "renew"
              ? `Contrato de ${saved.employee_name} renovado`
              : kind === "edit"
                ? "Contrato actualizado exitosamente"
                : `Contrato de ${saved.employee_name} registrado`,
          );
          load();
        }}
      />

      <Dialog open={toTerminate !== null} onOpenChange={(o) => !o && setToTerminate(null)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={terminate} key={toTerminate?.contract_id ?? "none"} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-rose-600" /> Rescindir contrato
              </DialogTitle>
              <DialogDescription>
                El contrato de {toTerminate?.employee_name} dejará de regir desde la fecha que indiques. Queda en el historial;
                no se borra.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="terminated_at">
                Fecha de rescisión <span className="text-red-500">*</span>
              </Label>
              <Input
                id="terminated_at"
                name="terminated_at"
                type="date"
                required
                defaultValue={limaToday()}
                min={toTerminate?.start_date}
                max={toTerminate?.end_date ?? undefined}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reason">
                Motivo <span className="text-red-500">*</span>
              </Label>
              <Input id="reason" name="reason" required maxLength={200} placeholder="Renuncia, mutuo disenso, falta grave…" />
            </div>
            {terminateError && (
              <p role="alert" className="text-sm font-medium text-rose-600">
                {terminateError}
              </p>
            )}
            <DialogFooter>
              <AppButton variant="secondary" onClick={() => setToTerminate(null)} disabled={busy}>
                Cancelar
              </AppButton>
              <AppButton type="submit" variant="danger" icon={<XCircle />} loading={busy}>
                Rescindir
              </AppButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

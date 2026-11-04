"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Eye, FilePlus2, FileSignature, FileText, FileX, RefreshCw, Search, UserX } from "lucide-react";
import { AppButton } from "@/components/shared/AppButton";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { RowActions } from "@/components/shared/RowActions";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { StatCard } from "@/components/shared/StatCard";
import { Tag } from "@/components/shared/TagCell";
import { usePermissions } from "@/components/personalized/PermissionsProvider";
import type { ContractDto, HrAlert } from "@/lib/services/hr/contracts.service";
import { ContractDialog, TerminateDialog, type ContractDialogMode } from "../_components/ContractDialogs";
import { AlertsPanel } from "../_components/AlertsPanel";
import { ContractPhaseBadge } from "../_components/HrBadges";
import { api, fmtDate, money } from "../_lib/hr-client";

type Filter = "current" | "expiring" | "history" | "all";

export default function ContractsPage() {
  const [contracts, setContracts] = useState<ContractDto[]>([]);
  const [alerts, setAlerts] = useState<HrAlert[]>([]);
  const [filter, setFilter] = useState<Filter>("current");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ContractDialogMode | null>(null);
  const [terminating, setTerminating] = useState<ContractDto | null>(null);
  const { can } = usePermissions();

  const load = useCallback(async () => {
    try {
      const [list, alertList] = await Promise.all([api<ContractDto[]>("/api/contracts"), api<HrAlert[]>("/api/contracts/alerts")]);
      setContracts(list);
      setAlerts(alertList);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los contratos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos remotos
    load();
  }, [load]);

  const counts = useMemo(
    () => ({
      current: contracts.filter((c) => c.status === "Vigente").length,
      expiring: contracts.filter((c) => c.phase === "Por vencer" || c.phase === "Vencido").length,
      history: contracts.filter((c) => c.status !== "Vigente").length,
      trial: contracts.filter((c) => c.in_trial).length,
      payroll: contracts.filter((c) => c.status === "Vigente").reduce((s, c) => s + c.base_salary, 0),
    }),
    [contracts],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contracts.filter((c) => {
      const byFilter =
        filter === "all" ||
        (filter === "current" && c.status === "Vigente") ||
        (filter === "expiring" && (c.phase === "Por vencer" || c.phase === "Vencido")) ||
        (filter === "history" && c.status !== "Vigente");
      const byText = !q || c.employee_name.toLowerCase().includes(q) || c.employee_dni.includes(q) || c.position.toLowerCase().includes(q);
      return byFilter && byText;
    });
  }, [contracts, filter, search]);

  const columns: DataTableColumn<ContractDto>[] = [
    {
      key: "employee",
      header: "Trabajador",
      width: "min-w-[220px]",
      sortable: true,
      sortValue: (c) => c.employee_name,
      primary: {
        title: (c) => c.employee_name,
        subtitle: (c) => `${c.position} · ${c.area}`,
        icon: <FileSignature />,
        iconTone: "amber",
        href: (c) => `/hr/employees/${c.employee_id}`,
      },
    },
    {
      key: "type",
      header: "Modalidad",
      cell: (c) => (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold">{c.contract_type_label}</span>
          <Tag tone="neutral" size="sm">
            {c.labor_regime_label}
          </Tag>
        </div>
      ),
    },
    {
      key: "dates",
      header: "Vigencia",
      sortable: true,
      sortValue: (c) => c.end_date ?? "9999",
      cell: (c) => (
        <div className="text-xs">
          <p>
            {fmtDate(c.start_date)} → {c.end_date ? fmtDate(c.end_date) : "indeterminado"}
          </p>
          {c.days_to_expiry != null && c.days_to_expiry <= 30 && (
            <p className={c.days_to_expiry < 0 ? "font-semibold text-rose-600" : "font-semibold text-amber-600"}>
              {c.days_to_expiry < 0 ? `Venció hace ${-c.days_to_expiry} día(s)` : `Vence en ${c.days_to_expiry} día(s)`}
            </p>
          )}
          {c.in_trial && <p className="text-blue-600">En periodo de prueba hasta {fmtDate(c.trial_end_date)}</p>}
        </div>
      ),
    },
    {
      key: "salary",
      header: "Sueldo / jornada",
      align: "right",
      sortable: true,
      sortValue: (c) => c.base_salary,
      cell: (c) => (
        <div className="text-right text-xs">
          <p className="font-mono font-semibold">{money.format(c.base_salary)}</p>
          <p className="text-muted-foreground">{c.weekly_hours} h/sem</p>
        </div>
      ),
    },
    { key: "status", header: "Estado", cell: (c) => <ContractPhaseBadge phase={c.phase} /> },
    {
      key: "actions",
      header: "Acciones",
      align: "right",
      cell: (c) => (
        <RowActions
          size="sm"
          actions={[
            { key: "view", label: "Ver ficha", icon: <Eye />, tone: "blue", href: `/hr/employees/${c.employee_id}` },
            {
              key: "renew",
              label: "Renovar",
              icon: <RefreshCw />,
              tone: "emerald",
              hidden: c.status !== "Vigente" || !can("contratos.crear") || c.renewed_by_id != null || c.contract_type === "Indeterminado",
              onClick: () => setMode({ kind: "renew", contract: c }),
            },
            {
              key: "edit",
              label: "Adenda",
              icon: <FileText />,
              tone: "amber",
              hidden: c.status !== "Vigente" || !can("contratos.editar"),
              onClick: () => setMode({ kind: "edit", contract: c }),
            },
            {
              key: "end",
              label: "Registrar cese",
              icon: <UserX />,
              tone: "rose",
              hidden: c.status !== "Vigente" || !can("contratos.editar"),
              onClick: () => setTerminating(c),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <ModuleHeader title="Contratos" subtitle="Vigencias, renovaciones, adendas y ceses" icon={FileSignature}>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="relative w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar trabajador o cargo..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 rounded-xl pl-9 text-xs" />
          </div>
          <SegmentedTabs<Filter>
            ariaLabel="Filtrar contratos"
            value={filter}
            onValueChange={setFilter}
            className="max-w-full overflow-x-auto"
            items={[
              { value: "current", label: "Vigentes", count: counts.current, tone: "success" },
              { value: "expiring", label: "Por vencer", count: counts.expiring, tone: "warning" },
              { value: "history", label: "Historial", count: counts.history, tone: "neutral" },
              { value: "all", label: "Todos", count: contracts.length, tone: "brand" },
            ]}
          />
          {can("contratos.crear") && (
            <AppButton size="sm" icon={<FilePlus2 />} onClick={() => setMode({ kind: "new", employee: null })}>
              Nuevo contrato
            </AppButton>
          )}
        </div>
      </ModuleHeader>
      <main className="flex min-w-0 flex-1 flex-col gap-5 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard layout="label-first" tone="emerald" icon={<FileSignature />} label="Contratos vigentes" value={counts.current} colorValue />
          <StatCard layout="label-first" tone="amber" icon={<AlertTriangle />} label="Por vencer o vencidos" value={counts.expiring} colorValue />
          <StatCard layout="label-first" tone="blue" icon={<FileText />} label="En periodo de prueba" value={counts.trial} colorValue />
          <StatCard layout="label-first" tone="neutral" icon={<FileX />} label="Planilla básica" value={money.format(counts.payroll)} />
        </div>
        <AlertsPanel alerts={alerts} max={10} />
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(c) => c.contract_id}
          loading={loading}
          loadingMode="auto"
          pageResetKey={`${filter}|${search}`}
          pagination={{ defaultPageSize: 15, itemLabel: "contratos" }}
          emptyState={{ icon: <FileSignature className="h-7 w-7" />, title: "No hay contratos en esta vista" }}
        />
      </main>
      <ContractDialog
        mode={mode}
        onClose={() => setMode(null)}
        onSaved={(c) => {
          toast.success(
            mode?.kind === "renew" ? `Contrato de ${c.employee_name} renovado` : mode?.kind === "new" ? `Contrato de ${c.employee_name} registrado` : "Adenda registrada",
          );
          setMode(null);
          load();
        }}
      />
      <TerminateDialog
        contract={terminating}
        onClose={() => setTerminating(null)}
        onDone={(msg) => {
          setTerminating(null);
          toast.success(msg);
          load();
        }}
      />
    </>
  );
}

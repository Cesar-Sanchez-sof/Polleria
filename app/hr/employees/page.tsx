"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Briefcase, CheckCircle2, Clock, Edit2, Eye, FilePlus2, FileWarning, KeyRound, Search, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { AppButton } from "@/components/shared/AppButton";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { RowActions } from "@/components/shared/RowActions";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Tag } from "@/components/shared/TagCell";
import { usePermissions } from "@/components/personalized/PermissionsProvider";
import type { HrAlert } from "@/lib/services/hr/contracts.service";
import { EmployeeForm, type EmployeeRow } from "./EmployeeForm";
import { ContractDialog, HireWizard, type ContractDialogMode } from "../_components/ContractDialogs";
import { AlertsPanel } from "../_components/AlertsPanel";
import { ContractPhaseBadge } from "../_components/HrBadges";
import { api, fmtDate, money } from "../_lib/hr-client";

type StatusFilter = "all" | "active" | "inactive";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [alerts, setAlerts] = useState<HrAlert[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [area, setArea] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hiring, setHiring] = useState(false);
  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [contractMode, setContractMode] = useState<ContractDialogMode | null>(null);
  const { can } = usePermissions();

  const load = useCallback(async () => {
    try {
      const [list, alertList] = await Promise.all([
        api<EmployeeRow[]>("/api/employees"),
        api<HrAlert[]>("/api/contracts/alerts").catch(() => []),
      ]);
      setEmployees(list);
      setAlerts(alertList);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la lista de empleados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos remotos
    load();
  }, [load]);

  const metrics = useMemo(() => {
    const active = employees.filter((e) => e.active);
    return {
      total: employees.length,
      active: active.length,
      inactive: employees.length - active.length,
      withUser: active.filter((e) => e.has_user).length,
      expiring: active.filter((e) => e.contract && (e.contract.phase === "Por vencer" || e.contract.phase === "Vencido")).length,
      payroll: active.reduce((sum, e) => sum + (e.contract?.base_salary ?? 0), 0),
    };
  }, [employees]);

  const areas = useMemo(() => [...new Set(employees.map((e) => e.area).filter((a): a is string => Boolean(a)))].sort(), [employees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      const matchesSearch = !q || e.dni.includes(q) || e.full_name.toLowerCase().includes(q) || (e.position ?? "").toLowerCase().includes(q);
      const matchesStatus = status === "all" || (status === "active" ? e.active : !e.active);
      return matchesSearch && matchesStatus && (!area || e.area === area);
    });
  }, [employees, search, status, area]);

  const hasActiveFilter = search.trim() !== "" || status !== "active" || area !== "";

  const columns: DataTableColumn<EmployeeRow>[] = [
    {
      key: "name",
      header: "Trabajador",
      width: "min-w-[240px]",
      sortable: true,
      sortValue: (e) => `${e.paternal_last_name} ${e.first_name}`,
      primary: {
        title: (e) => e.full_name,
        subtitle: (e) => (
          <span className="inline-flex items-center gap-1.5">
            <span className="font-mono">DNI {e.dni}</span>
            {e.has_user && <KeyRound className="h-3 w-3 text-blue-600" aria-label="Tiene usuario del sistema" />}
          </span>
        ),
        icon: <Briefcase />,
        iconTone: "amber",
        href: (e) => `/hr/employees/${e.employee_id}`,
      },
    },
    {
      key: "position",
      header: "Cargo y área",
      sortable: true,
      sortValue: (e) => e.position ?? "",
      cell: (e) =>
        e.contract ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold">{e.contract.position}</span>
            <Tag tone="indigo" variant="soft" size="sm">
              {e.contract.area}
            </Tag>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/60">Sin contrato</span>
        ),
    },
    {
      key: "contract",
      header: "Contrato",
      width: "min-w-[180px]",
      cell: (e) =>
        e.contract ? (
          <div className="flex flex-col gap-1 text-xs">
            <span>{e.contract.contract_type_label}</span>
            <span className="text-muted-foreground">
              {e.contract.end_date ? `Hasta ${fmtDate(e.contract.end_date)}` : `Desde ${fmtDate(e.contract.start_date)}`}
            </span>
            <ContractPhaseBadge phase={e.contract.phase} />
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/60">—</span>
        ),
    },
    {
      key: "salary",
      header: "Sueldo y jornada",
      align: "right",
      sortable: true,
      sortValue: (e) => e.contract?.base_salary ?? 0,
      cell: (e) =>
        e.contract ? (
          <div className="text-right">
            <p className="font-mono text-xs font-semibold">{money.format(e.contract.base_salary)}</p>
            <p className="text-[11px] text-muted-foreground">{e.contract.weekly_hours ? `${e.contract.weekly_hours} h/sem` : "Sin horario"}</p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/60">—</span>
        ),
    },
    {
      key: "shift",
      header: "Próximo turno",
      width: "min-w-[150px]",
      cell: (e) =>
        e.next_shift ? (
          <div className="text-xs">
            <p className="font-semibold">{e.next_shift.name}</p>
            <p className="font-mono text-muted-foreground">
              {e.next_shift.date.slice(8)}/{e.next_shift.date.slice(5, 7)} · {e.next_shift.start_time}–{e.next_shift.end_time}
            </p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/60">Sin programar</span>
        ),
    },
    {
      key: "status",
      header: "Estado",
      align: "center",
      width: "w-28",
      sortable: true,
      sortValue: (e) => (e.active ? 1 : 0),
      cell: (e) => (
        <StatusBadge tone={e.active ? "success" : "neutral"} pulse={e.active}>
          {e.active ? "Activo" : "Cesado"}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      align: "right",
      width: "w-24",
      cell: (e) => (
        <RowActions
          size="sm"
          actions={[
            { key: "view", label: "Ver ficha", icon: <Eye />, tone: "blue", href: `/hr/employees/${e.employee_id}` },
            {
              key: "contract",
              label: e.active ? "Registrar contrato" : "Reingresar (nuevo contrato)",
              icon: <FilePlus2 />,
              tone: "emerald",
              hidden: Boolean(e.contract) || !can("contratos.crear"),
              onClick: () => setContractMode({ kind: "new", employee: { employee_id: e.employee_id, full_name: e.full_name } }),
            },
            { key: "edit", label: "Editar datos personales", icon: <Edit2 />, tone: "amber", hidden: !can("empleados.editar"), onClick: () => setEditing(e) },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <ModuleHeader title="Empleados" subtitle="Personal, contratos y condiciones laborales" icon={Users}>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="relative w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por nombre, DNI o cargo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar empleados"
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
          <NativeSelect value={area} onChange={(e) => setArea(e.target.value)} aria-label="Filtrar por área" className="h-9 w-40 rounded-xl text-xs">
            <NativeSelectOption value="">Todas las áreas</NativeSelectOption>
            {areas.map((a) => (
              <NativeSelectOption key={a} value={a}>
                {a}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <SegmentedTabs<StatusFilter>
            ariaLabel="Filtrar por estado"
            value={status}
            onValueChange={setStatus}
            className="max-w-full overflow-x-auto"
            items={[
              { value: "active", label: "Activos", count: metrics.active, tone: "success" },
              { value: "inactive", label: "Cesados", count: metrics.inactive, tone: "danger" },
              { value: "all", label: "Todos", count: metrics.total, tone: "brand" },
            ]}
          />
          {can("empleados.crear") && (
            <AppButton size="sm" icon={<UserPlus />} onClick={() => setHiring(true)}>
              Contratar personal
            </AppButton>
          )}
        </div>
      </ModuleHeader>

      <main className="flex min-w-0 flex-1 flex-col gap-5 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard layout="label-first" tone="emerald" icon={<CheckCircle2 />} label="Personal activo" value={metrics.active} colorValue />
          <StatCard layout="label-first" tone="blue" icon={<KeyRound />} label="Con acceso al sistema" value={metrics.withUser} colorValue />
          <StatCard layout="label-first" tone="amber" icon={<FileWarning />} label="Contratos por vencer" value={metrics.expiring} colorValue />
          <StatCard layout="label-first" tone="neutral" icon={<Clock />} label="Planilla básica mensual" value={money.format(metrics.payroll)} />
        </div>

        <AlertsPanel alerts={alerts} />

        {error && (
          <p role="alert" className="flex items-center gap-2 text-sm font-medium text-rose-600">
            <AlertCircle className="h-4 w-4" /> {error}
          </p>
        )}

        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(e) => e.employee_id}
          loading={loading}
          loadingMode="auto"
          defaultSort={{ key: "name", direction: "asc" }}
          pageResetKey={`${search}|${status}|${area}`}
          pagination={{ defaultPageSize: 15, itemLabel: "empleados" }}
          emptyState={{
            icon: <Users className="h-7 w-7" />,
            title: hasActiveFilter ? "No se encontraron empleados con esos filtros" : "Aún no tienes personal contratado",
            description: hasActiveFilter ? "Prueba con otros términos o filtros." : "Contrata al primer trabajador con su contrato y horario.",
            action: hasActiveFilter ? (
              <AppButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStatus("active");
                  setArea("");
                }}
              >
                Limpiar filtros
              </AppButton>
            ) : can("empleados.crear") ? (
              <AppButton size="sm" icon={<UserPlus />} onClick={() => setHiring(true)}>
                Contratar personal
              </AppButton>
            ) : undefined,
          }}
        />
      </main>

      {hiring && (
        <HireWizard
          open
          onClose={() => setHiring(false)}
          onHired={(e) => {
            setHiring(false);
            toast.success(`${e.full_name} fue contratado y su horario quedó programado las próximas 2 semanas. Registra su Seguro Vida Ley.`);
            load();
          }}
        />
      )}

      <ContractDialog
        mode={contractMode}
        onClose={() => setContractMode(null)}
        onSaved={(c) => {
          setContractMode(null);
          toast.success(`Contrato de ${c.employee_name} registrado con su horario pactado`);
          load();
        }}
      />

      <EmployeeForm
        open={editing !== null}
        employee={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          toast.success("Datos personales actualizados");
          load();
        }}
      />
    </>
  );
}

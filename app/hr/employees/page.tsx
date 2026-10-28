"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Briefcase, CheckCircle2, Edit2, KeyRound, Plus, Power, Search, UserX, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppButton } from "@/components/shared/AppButton";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { RowActions } from "@/components/shared/RowActions";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Tag } from "@/components/shared/TagCell";
import { usePermissions } from "@/components/personalized/PermissionsProvider";
import { EmployeeForm, type EmployeeRow } from "./EmployeeForm";

type StatusFilter = "all" | "active" | "inactive";

const money = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [area, setArea] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [toDeactivate, setToDeactivate] = useState<EmployeeRow | null>(null);
  const [busy, setBusy] = useState(false);
  const { can } = usePermissions();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/employees");
      if (!res.ok) throw new Error();
      setEmployees(await res.json());
      setError(null);
    } catch {
      setError("No se pudo cargar la lista de empleados");
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
      total: employees.length,
      active: employees.filter((e) => e.active).length,
      inactive: employees.filter((e) => !e.active).length,
      withUser: employees.filter((e) => e.has_user).length,
       withoutShift: employees.filter((e) => e.active && e.upcoming_shifts === 0).length,
    }),
    [employees],
  );

  const areas = useMemo(
    () => [...new Set(employees.map((e) => e.area).filter((a): a is string => Boolean(a)))].sort(),
    [employees],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      const matchesSearch =
        !q || e.dni.includes(q) || e.full_name.toLowerCase().includes(q) || (e.position ?? "").toLowerCase().includes(q);
      const matchesStatus = status === "all" || (status === "active" ? e.active : !e.active);
      const matchesArea = !area || e.area === area;
      return matchesSearch && matchesStatus && matchesArea;
    });
  }, [employees, search, status, area]);

  const hasActiveFilter = search.trim() !== "" || status !== "all" || area !== "";

  function openForm(e: EmployeeRow | null) {
    setEditing(e);
    setFormOpen(true);
  }

  async function changeStatus(e: EmployeeRow, active: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/employees/${e.employee_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error ?? "No se pudo cambiar el estado");
        return;
      }
      toast.success(
        active
          ? `${e.full_name} reingresó. Sus usuarios siguen inactivos hasta que los actives en Seguridad.`
          : body.users_deactivated > 0
            ? `${e.full_name} fue dado de baja y se desactivó su acceso al sistema.`
            : `${e.full_name} fue dado de baja.`,
      );
      setToDeactivate(null);
      await load();
    } catch {
      toast.error("No se pudo conectar con el servidor");
    } finally {
      setBusy(false);
    }
  }

  const columns: DataTableColumn<EmployeeRow>[] = [
    {
      key: "name",
      header: "Empleado",
      width: "min-w-[240px]",
      sortable: true,
      sortValue: (e) => `${e.paternal_last_name} ${e.first_name}`,
      primary: {
        title: (e) => e.full_name,
        subtitle: (e) => (
          <span className="inline-flex items-center gap-1.5">
            {e.position ?? "Sin cargo registrado"}
            {e.has_user && <KeyRound className="h-3 w-3 text-blue-600" aria-label="Tiene usuario del sistema" />}
          </span>
        ),
        icon: <Briefcase />,
        iconTone: "amber",
      },
    },
    {
      key: "dni",
      header: "Documento",
      width: "w-40",
      cell: (e) => (
        <div className="flex items-center gap-2">
          <Tag tone="amber" size="sm">
            DNI
          </Tag>
          <span className="font-mono text-xs font-bold text-foreground">{e.dni}</span>
        </div>
      ),
    },
    {
      key: "area",
      header: "Área",
      sortable: true,
      sortValue: (e) => e.area ?? "",
      cell: (e) =>
        e.area ? (
          <Tag tone="indigo" variant="soft" size="sm">
            {e.area}
          </Tag>
        ) : (
          <span className="text-xs text-muted-foreground/60">-</span>
        ),
    },
    {
      key: "salary",
      header: "Sueldo base",
      align: "right",
      sortable: true,
      sortValue: (e) => e.base_salary,
      cell: (e) => (
        <div className="text-right">
          <p className="font-mono text-xs font-semibold">{money.format(e.base_salary)}</p>
          {e.contract_type && <p className="text-[11px] text-muted-foreground">{e.contract_type}</p>}
        </div>
      ),
    },
        {
      key: "shift",
      header: "Próximo horario",
      width: "min-w-[170px]",
      cell: (e) =>
        e.next_shift ? (
          <div className="text-xs">
            <p className="font-semibold text-foreground">{e.next_shift.name}</p>
            <p className="font-mono text-muted-foreground">
              {e.next_shift.date.slice(8)}/{e.next_shift.date.slice(5, 7)} · {e.next_shift.start_time}–{e.next_shift.end_time}
            </p>
            {e.upcoming_shifts > 1 && <p className="text-[11px] text-muted-foreground">+{e.upcoming_shifts - 1} más</p>}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/60">Sin horario</span>
        ),
    },
    {
      key: "status",
      header: "Estado",
      align: "center",
      width: "w-32",
      sortable: true,
      sortValue: (e) => (e.active ? 1 : 0),
      cell: (e) => (
        <StatusBadge tone={e.active ? "success" : "neutral"} pulse={e.active}>
          {e.active ? "Activo" : "Inactivo"}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      align: "right",
      width: "w-28",
      cell: (e) => (
        <RowActions
          size="sm"
          actions={[
            { key: "edit", label: "Editar empleado", icon: <Edit2 />, tone: "amber", hidden: !can("empleados.editar"), onClick: () => openForm(e) },
            {
              key: "toggle",
              label: e.active ? "Dar de baja" : "Reingresar",
              icon: <Power />,
              tone: e.active ? "rose" : "emerald",
              hidden: !can("empleados.editar"),
              onClick: () => (e.active ? setToDeactivate(e) : changeStatus(e, true)),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <ModuleHeader
        title="Empleados"
        subtitle="Registro y consulta del personal"
        icon={Users}
      >
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="relative w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar empleado..."
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
              { value: "all", label: "Todos", count: metrics.total, tone: "brand" },
              { value: "active", label: "Activos", count: metrics.active, tone: "success" },
              { value: "inactive", label: "Inactivos", count: metrics.inactive, tone: "danger" },
            ]}
          />
          {can("empleados.crear") && (
            <AppButton size="sm" icon={<Plus />} onClick={() => openForm(null)}>
              Nuevo Empleado
            </AppButton>
          )}
        </div>
      </ModuleHeader>

      <main className="flex min-w-0 flex-1 flex-col gap-5 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard layout="label-first" tone="neutral" icon={<Users />} label="Total Empleados" value={metrics.total} />
          <StatCard layout="label-first" tone="emerald" icon={<CheckCircle2 />} label="Activos" value={metrics.active} colorValue />
          <StatCard layout="label-first" tone="blue" icon={<KeyRound />} label="Con Acceso al Sistema" value={metrics.withUser} colorValue />
          <StatCard layout="label-first" tone="amber" icon={<AlertCircle />} label="Sin Horario Asignado" value={metrics.withoutShift} colorValue />
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-rose-600">
            {error}
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
            title: hasActiveFilter ? "No se encontraron empleados con esos filtros" : "Aún no tienes empleados registrados",
            description: hasActiveFilter
              ? "Prueba cambiando los términos de búsqueda o selecciona otro filtro."
              : "Comienza registrando al personal de la pollería.",
            action: hasActiveFilter ? (
              <AppButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                  setArea("");
                }}
              >
                Limpiar filtros
              </AppButton>
            ) : can("empleados.crear") ? (
              <AppButton size="sm" icon={<Plus />} onClick={() => openForm(null)}>
                Registrar Primer Empleado
              </AppButton>
            ) : undefined,
          }}
        />
      </main>

      <EmployeeForm
        open={formOpen}
        employee={editing}
        onClose={() => setFormOpen(false)}
        onSaved={(saved, created) => {
          setFormOpen(false);
          toast.success(created ? `Empleado ${saved.full_name} registrado exitosamente` : "Empleado actualizado exitosamente");
          load();
        }}
      />

      <Dialog open={toDeactivate !== null} onOpenChange={(o) => !o && setToDeactivate(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-rose-600" /> Dar de baja al empleado
            </DialogTitle>
            <DialogDescription>
              {toDeactivate?.full_name} dejará de figurar como personal activo y no podrá asignarse a nuevos horarios.
              {toDeactivate?.has_user && " También se desactivará su acceso al sistema."} El historial se conserva y puedes
              reingresarlo cuando quieras.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <AppButton variant="secondary" onClick={() => setToDeactivate(null)} disabled={busy}>
              Cancelar
            </AppButton>
            <AppButton variant="danger" icon={<Power />} loading={busy} onClick={() => toDeactivate && changeStatus(toDeactivate, false)}>
              Dar de baja
            </AppButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
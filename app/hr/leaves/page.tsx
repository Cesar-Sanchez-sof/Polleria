"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, CalendarRange, CheckCircle2, Clock, Plus, Umbrella, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AppButton } from "@/components/shared/AppButton";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { RowActions } from "@/components/shared/RowActions";
import { SegmentedTabs } from "@/components/shared/SegmentedTabs";
import { StatCard } from "@/components/shared/StatCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePermissions } from "@/components/personalized/PermissionsProvider";
import type { LeaveDto } from "@/lib/services/hr/leaves.service";
import { LEAVE_TYPE_LABEL, type LeaveTypeCode, type RequestStatusCode } from "@/lib/services/hr/labor-rules";
import { RequestBadge } from "../_components/HrBadges";
import { LeaveDialog } from "../_components/RequestDialogs";
import { api, fmtDate, fmtDateTime } from "../_lib/hr-client";

type StatusFilter = "Pendiente" | "Aprobada" | "all";
type Review = { leave: LeaveDto; action: "approve" | "reject" | "cancel" };

const todayIso = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);

export default function LeavesPage() {
  const [leaves, setLeaves] = useState<LeaveDto[]>([]);
  const [status, setStatus] = useState<StatusFilter>("Pendiente");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const { can } = usePermissions();

  const load = useCallback(async () => {
    try {
      setLeaves(await api<LeaveDto[]>("/api/leaves"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron cargar las solicitudes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de datos remotos
    load();
  }, [load]);

  const today = todayIso();
  const metrics = useMemo(
    () => ({
      pending: leaves.filter((l) => l.status === "Pendiente").length,
      approved: leaves.filter((l) => l.status === "Aprobada").length,
      onLeaveToday: leaves.filter((l) => l.status === "Aprobada" && l.start_date <= today && today <= l.end_date).length,
      upcoming: leaves.filter((l) => l.status === "Aprobada" && l.start_date > today).length,
    }),
    [leaves, today],
  );

  const rows = useMemo(
    () => leaves.filter((l) => (status === "all" || l.status === status) && (!type || l.type === type)),
    [leaves, status, type],
  );

  const columns: DataTableColumn<LeaveDto>[] = [
    {
      key: "employee",
      header: "Trabajador",
      width: "min-w-[200px]",
      sortable: true,
      sortValue: (l) => l.employee_name,
      primary: { title: (l) => l.employee_name, subtitle: (l) => `DNI ${l.employee_dni}`, icon: <Umbrella />, iconTone: "blue", href: (l) => `/hr/employees/${l.employee_id}` },
    },
    {
      key: "type",
      header: "Tipo",
      cell: (l) => (
        <div className="flex flex-col">
          <span className="text-xs font-semibold">{l.type_label}</span>
          {l.is_advance && <span className="text-[11px] font-semibold text-amber-600">Adelanto de vacaciones</span>}
          {!l.paid && <span className="text-[11px] text-muted-foreground">Sin goce de haber</span>}
        </div>
      ),
    },
    {
      key: "dates",
      header: "Fechas",
      sortable: true,
      sortValue: (l) => l.start_date,
      cell: (l) => (
        <div className="text-xs">
          <p>
            {fmtDate(l.start_date)} → {fmtDate(l.end_date)}
          </p>
          <p className="text-muted-foreground">{l.days} día(s)</p>
        </div>
      ),
    },
    {
      key: "reason",
      header: "Motivo / sustento",
      cell: (l) => <span className="text-xs text-muted-foreground">{[l.reason, l.document_ref].filter(Boolean).join(" · ") || "—"}</span>,
    },
    {
      key: "status",
      header: "Estado",
      cell: (l) => (
        <div className="flex flex-col gap-0.5">
          <RequestBadge status={l.status as RequestStatusCode} />
          {l.reviewed_by && (
            <span className="text-[11px] text-muted-foreground">
              {l.reviewed_by} · {fmtDateTime(l.reviewed_at)}
            </span>
          )}
          {l.review_note && <span className="max-w-48 truncate text-[11px] text-muted-foreground">{l.review_note}</span>}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      align: "right",
      cell: (l) => (
        <RowActions
          size="sm"
          actions={[
            { key: "approve", label: "Aprobar", icon: <CheckCircle2 />, tone: "emerald", hidden: l.status !== "Pendiente" || !can("vacaciones.editar"), onClick: () => setReview({ leave: l, action: "approve" }) },
            { key: "reject", label: "Rechazar", icon: <XCircle />, tone: "rose", hidden: l.status !== "Pendiente" || !can("vacaciones.editar"), onClick: () => setReview({ leave: l, action: "reject" }) },
            {
              key: "cancel",
              label: "Anular",
              icon: <Ban />,
              tone: "neutral",
              hidden: !can("vacaciones.editar") || !(l.status === "Pendiente" || (l.status === "Aprobada" && l.start_date > today)),
              onClick: () => setReview({ leave: l, action: "cancel" }),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <ModuleHeader title="Vacaciones y permisos" subtitle="Solicitudes, aprobaciones, adelantos de vacaciones y licencias" icon={Umbrella}>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <NativeSelect value={type} onChange={(e) => setType(e.target.value)} aria-label="Tipo" className="h-9 w-48 rounded-xl text-xs">
            <NativeSelectOption value="">Todos los tipos</NativeSelectOption>
            {(Object.keys(LEAVE_TYPE_LABEL) as LeaveTypeCode[]).map((t) => (
              <NativeSelectOption key={t} value={t}>
                {LEAVE_TYPE_LABEL[t]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <SegmentedTabs<StatusFilter>
            ariaLabel="Estado"
            value={status}
            onValueChange={setStatus}
            items={[
              { value: "Pendiente", label: "Por revisar", count: metrics.pending, tone: "warning" },
              { value: "Aprobada", label: "Aprobadas", count: metrics.approved, tone: "success" },
              { value: "all", label: "Todas", count: leaves.length, tone: "brand" },
            ]}
          />
          {can("vacaciones.crear") && (
            <AppButton size="sm" icon={<Plus />} onClick={() => setCreating(true)}>
              Registrar
            </AppButton>
          )}
        </div>
      </ModuleHeader>
      <main className="flex min-w-0 flex-1 flex-col gap-5 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard layout="label-first" tone="amber" icon={<Clock />} label="Por revisar" value={metrics.pending} colorValue />
          <StatCard layout="label-first" tone="blue" icon={<Umbrella />} label="Ausentes hoy" value={metrics.onLeaveToday} colorValue />
          <StatCard layout="label-first" tone="emerald" icon={<CalendarRange />} label="Próximas aprobadas" value={metrics.upcoming} colorValue />
          <StatCard layout="label-first" tone="neutral" icon={<CheckCircle2 />} label="Aprobadas (total)" value={metrics.approved} />
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(l) => l.leave_id}
          loading={loading}
          loadingMode="auto"
          pageResetKey={`${status}|${type}`}
          pagination={{ defaultPageSize: 15, itemLabel: "solicitudes" }}
          emptyState={{ icon: <Umbrella className="h-7 w-7" />, title: status === "Pendiente" ? "No hay solicitudes por revisar" : "Sin solicitudes" }}
        />
      </main>
      {creating && (
        <LeaveDialog
          open
          canApprove={can("vacaciones.editar")}
          onClose={() => setCreating(false)}
          onSaved={(msg) => {
            setCreating(false);
            toast.success(msg);
            load();
          }}
        />
      )}
      {review && (
        <ReviewDialog
          review={review}
          onClose={() => setReview(null)}
          onDone={(msg) => {
            setReview(null);
            toast.success(msg);
            load();
          }}
        />
      )}
    </>
  );
}

function ReviewDialog({ review, onClose, onDone }: { review: Review; onClose: () => void; onDone: (msg: string) => void }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { leave, action } = review;
  const verb = action === "approve" ? "Aprobar" : action === "reject" ? "Rechazar" : "Anular";

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await api<{ shifts_released?: number }>(`/api/leaves/${leave.leave_id}`, { method: "PATCH", body: { action, note } });
      onDone(
        action === "approve"
          ? `Solicitud aprobada${res.shifts_released ? `: se liberaron ${res.shifts_released} horario(s) de ${leave.employee_name}` : ""}`
          : action === "reject"
            ? "Solicitud rechazada"
            : "Solicitud anulada",
      );
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
          <DialogTitle>{verb} solicitud</DialogTitle>
          <DialogDescription>
            {leave.type_label} de {leave.employee_name}: {fmtDate(leave.start_date)} → {fmtDate(leave.end_date)} ({leave.days} días)
            {leave.is_advance ? " · incluye adelanto de vacaciones" : ""}.
            {action === "approve" && " El trabajador saldrá de los horarios programados en esas fechas."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="r-note">
            {action === "reject" ? "Motivo del rechazo" : "Observación"} {action === "reject" && <span className="text-red-500">*</span>}
          </Label>
          <Input id="r-note" maxLength={255} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <DialogFooter>
          <AppButton variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </AppButton>
          <AppButton variant={action === "approve" ? "success" : "danger"} loading={saving} onClick={submit}>
            {verb}
          </AppButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

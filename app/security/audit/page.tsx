"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, ShieldCheck } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { RowActions } from "@/components/shared/RowActions";

interface AuditRow {
  id: number;
  date: string;
  user: string;
  action: string;
  module: string;
  entity: string;
  entityId: string | null;
  description: string;
  details: unknown;
  ip: string | null;
}

interface Response {
  data: AuditRow[];
  total: number;
  page: number;
  totalPages: number;
  modules: string[];
  actions: string[];
}

const ACTION_LABEL: Record<string, string> = {
  CREATE: "Creación",
  UPDATE: "Modificación",
  DELETE: "Eliminación",
  STATUS_CHANGE: "Cambio de estado",
  LOGIN: "Inicio de sesión",
  LOGIN_FAILED: "Login fallido",
  LOGOUT: "Cierre de sesión",
};

const EMPTY_FILTERS = { from: "", to: "", user: "", action: "", module: "", q: "" };

export default function AuditPage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AuditRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), perPage: "20" });
      for (const [k, v] of Object.entries(applied)) if (v) params.set(k, v);
      const res = await fetch(`/api/audit-logs?${params}`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "No se pudo cargar la auditoría");
      setData(body);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [applied, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos remotos
    load();
  }, [load]);

  const change = (field: keyof typeof EMPTY_FILTERS) => (e: { target: { value: string } }) =>
    setFilters((f) => ({ ...f, [field]: e.target.value }));

  function search(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setApplied(filters);
  }

  function clear() {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setPage(1);
  }

  const columns: DataTableColumn<AuditRow>[] = [
    { key: "date", header: "Fecha", width: "w-28", cell: (r) => new Date(r.date).toLocaleDateString("es-PE") },
    { key: "time", header: "Hora", width: "w-28", cell: (r) => new Date(r.date).toLocaleTimeString("es-PE") },
    { key: "user", header: "Usuario", cell: (r) => r.user },
    {
      key: "action",
      header: "Acción",
      cell: (r) => <Badge variant="outline">{ACTION_LABEL[r.action] ?? r.action}</Badge>,
    },
    { key: "module", header: "Módulo", cell: (r) => r.module },
    { key: "entity", header: "Entidad", cell: (r) => `${r.entity}${r.entityId ? ` #${r.entityId}` : ""}` },
    { key: "description", header: "Detalle", width: "min-w-[240px]", cell: (r) => r.description },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (r) =>
        r.details != null ? (
          <RowActions
            mode="label"
            variant="outline"
            size="sm"
            actions={[{ key: "changes", label: "Ver cambios", icon: <Eye />, onClick: () => setDetail(r) }]}
          />
        ) : null,
    },
  ];

  return (
    <>
      <ModuleHeader
        title="Auditoría"
        subtitle="Registro de cambios: fecha, hora, usuario, acción, módulo y detalle"
        icon={ShieldCheck}
      />
      <main className="relative flex-1 w-full min-w-0 p-3 sm:p-4 md:p-6 flex flex-col gap-4">
        <Card>
          <CardContent>
            <form onSubmit={search} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(6,minmax(0,1fr))_auto]">
              <Input type="date" aria-label="Desde" value={filters.from} onChange={change("from")} />
              <Input type="date" aria-label="Hasta" value={filters.to} onChange={change("to")} />
              <Input placeholder="Usuario" aria-label="Usuario" value={filters.user} onChange={change("user")} />
              <NativeSelect className="w-full" aria-label="Acción" value={filters.action} onChange={change("action")}>
                <option value="">Todas las acciones</option>
                {(data?.actions ?? Object.keys(ACTION_LABEL)).map((a) => (
                  <option key={a} value={a}>
                    {ACTION_LABEL[a] ?? a}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect className="w-full" aria-label="Módulo" value={filters.module} onChange={change("module")}>
                <option value="">Todos los módulos</option>
                {(data?.modules ?? []).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </NativeSelect>
              <Input placeholder="Buscar en descripción" aria-label="Buscar" value={filters.q} onChange={change("q")} />
              <div className="flex gap-2 sm:col-span-2 xl:col-span-1">
                <Button type="submit">Filtrar</Button>
                <Button type="button" variant="outline" onClick={clear}>
                  Limpiar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <DataTable
          columns={columns}
          rows={data?.data ?? []}
          rowKey={(r) => r.id}
          enableSorting={false}
          loading={loading}
          loadingMode="auto"
          error={error}
          onRetry={load}
          emptyState={{ title: "No hay registros de auditoría para los filtros indicados." }}
          footer={
            data ? (
              <div className="flex items-center justify-between border-t border-slate-200/80 px-4 py-3 text-sm dark:border-slate-800">
                <span className="text-muted-foreground">
                  {data.total} registro(s) — página {data.page} de {data.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Anterior
                  </Button>
                  <Button variant="outline" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
                    Siguiente
                  </Button>
                </div>
              </div>
            ) : undefined
          }
        />

        <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Cambios registrados</DialogTitle>
              <DialogDescription>{detail?.description}</DialogDescription>
            </DialogHeader>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(detail?.details, null, 2)}
              {detail?.ip ? `
IP: ${detail.ip}` : ""}
            </pre>
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}

"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
  const [open, setOpen] = useState<number | null>(null);

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

  return (
      <div className="min-h-screen">
      <ModuleHeader
        title="Auditoría"
        subtitle="Registro de cambios: fecha, hora, usuario, acción, módulo y detalle"
        icon={ShieldCheck}
      />
      <main className="p-3 sm:p-4 md:p-6 space-y-4">
        <Card>
          <CardContent>
            <form onSubmit={search} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
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
              <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
                <Button type="submit">Filtrar</Button>
                <Button type="button" variant="outline" onClick={clear}>
                  Limpiar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Card>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="dark:bg-slate-800/75">
                  <TableHead>Fecha</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Cargando...
                    </TableCell>
                  </TableRow>
                )}
                {!loading && !error && data?.data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No hay registros de auditoría para los filtros indicados.
                    </TableCell>
                  </TableRow>
                )}
                {data?.data.map((r) => {
                  const f = new Date(r.date);
                  return (
                    <Fragment key={r.id}>
                      <TableRow>
                        <TableCell>{f.toLocaleDateString("es-PE")}</TableCell>
                        <TableCell>{f.toLocaleTimeString("es-PE")}</TableCell>
                        <TableCell>{r.user}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{ACTION_LABEL[r.action] ?? r.action}</Badge>
                        </TableCell>
                        <TableCell>{r.module}</TableCell>
                        <TableCell>
                          {r.entity}
                          {r.entityId ? ` #${r.entityId}` : ""}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{r.description}</span>
                            {r.details != null && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setOpen(open === r.id ? null : r.id)}
                              >
                                {open === r.id ? "Ocultar" : "Ver cambios"}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {open === r.id && (
                        <TableRow>
                          <TableCell colSpan={7}>
                            <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
                              {JSON.stringify(r.details, null, 2)}
                              {r.ip ? `\nIP: ${r.ip}` : ""}
                            </pre>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {data && (
          <div className="flex items-center justify-between text-sm">
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
        )}
      </main>
    </div>
  );
}
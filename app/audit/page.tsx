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

interface FilaAuditoria {
  id: number;
  fecha: string;
  usuario: string;
  accion: string;
  modulo: string;
  entidad: string;
  idEntidad: string | null;
  descripcion: string;
  detalles: unknown;
  ip: string | null;
}

interface Respuesta {
  datos: FilaAuditoria[];
  total: number;
  pagina: number;
  totalPaginas: number;
  modulos: string[];
  acciones: string[];
}

const ETIQUETA_ACCION: Record<string, string> = {
  CREATE: "Creación",
  UPDATE: "Modificación",
  DELETE: "Eliminación",
  STATUS_CHANGE: "Cambio de estado",
  LOGIN: "Inicio de sesión",
  LOGIN_FAILED: "Login fallido",
  LOGOUT: "Cierre de sesión",
};

const FILTROS_VACIOS = { desde: "", hasta: "", usuario: "", accion: "", modulo: "", q: "" };

export default function AuditPage() {
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [aplicados, setAplicados] = useState(FILTROS_VACIOS);
  const [pagina, setPagina] = useState(1);
  const [data, setData] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams({ pagina: String(pagina), porPagina: "20" });
      for (const [k, v] of Object.entries(aplicados)) if (v) params.set(k, v);
      const res = await fetch(`/api/audit-logs?${params}`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "No se pudo cargar la auditoría");
      setData(body);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, [aplicados, pagina]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos remotos
    cargar();
  }, [cargar]);

  const cambiar = (campo: keyof typeof FILTROS_VACIOS) => (e: { target: { value: string } }) =>
    setFiltros((f) => ({ ...f, [campo]: e.target.value }));

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    setPagina(1);
    setAplicados(filtros);
  }

  function limpiar() {
    setFiltros(FILTROS_VACIOS);
    setAplicados(FILTROS_VACIOS);
    setPagina(1);
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
            <form onSubmit={buscar} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <Input type="date" aria-label="Desde" value={filtros.desde} onChange={cambiar("desde")} />
              <Input type="date" aria-label="Hasta" value={filtros.hasta} onChange={cambiar("hasta")} />
              <Input placeholder="Usuario" aria-label="Usuario" value={filtros.usuario} onChange={cambiar("usuario")} />
              <NativeSelect className="w-full" aria-label="Acción" value={filtros.accion} onChange={cambiar("accion")}>
                <option value="">Todas las acciones</option>
                {(data?.acciones ?? Object.keys(ETIQUETA_ACCION)).map((a) => (
                  <option key={a} value={a}>
                    {ETIQUETA_ACCION[a] ?? a}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect className="w-full" aria-label="Módulo" value={filtros.modulo} onChange={cambiar("modulo")}>
                <option value="">Todos los módulos</option>
                {(data?.modulos ?? []).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </NativeSelect>
              <Input placeholder="Buscar en descripción" aria-label="Buscar" value={filtros.q} onChange={cambiar("q")} />
              <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
                <Button type="submit">Filtrar</Button>
                <Button type="button" variant="outline" onClick={limpiar}>
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
                {cargando && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Cargando...
                    </TableCell>
                  </TableRow>
                )}
                {!cargando && !error && data?.datos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No hay registros de auditoría para los filtros indicados.
                    </TableCell>
                  </TableRow>
                )}
                {data?.datos.map((r) => {
                  const f = new Date(r.fecha);
                  return (
                    <Fragment key={r.id}>
                      <TableRow>
                        <TableCell>{f.toLocaleDateString("es-PE")}</TableCell>
                        <TableCell>{f.toLocaleTimeString("es-PE")}</TableCell>
                        <TableCell>{r.usuario}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{ETIQUETA_ACCION[r.accion] ?? r.accion}</Badge>
                        </TableCell>
                        <TableCell>{r.modulo}</TableCell>
                        <TableCell>
                          {r.entidad}
                          {r.idEntidad ? ` #${r.idEntidad}` : ""}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{r.descripcion}</span>
                            {r.detalles != null && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setAbierta(abierta === r.id ? null : r.id)}
                              >
                                {abierta === r.id ? "Ocultar" : "Ver cambios"}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {abierta === r.id && (
                        <TableRow>
                          <TableCell colSpan={7}>
                            <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
                              {JSON.stringify(r.detalles, null, 2)}
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
              {data.total} registro(s) — página {data.pagina} de {data.totalPaginas}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
                Anterior
              </Button>
              <Button variant="outline" disabled={pagina >= data.totalPaginas} onClick={() => setPagina((p) => p + 1)}>
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
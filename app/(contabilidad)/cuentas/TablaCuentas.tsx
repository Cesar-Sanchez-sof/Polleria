"use client";

import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Inbox,
  Loader2,
  Pencil,
  Power,
  RefreshCw,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CuentaContable } from "@/lib/services/cuentas.service";

/** Una fila del árbol: la cuenta con su nivel de anidamiento y su estado de rama. */
export interface FilaCuenta {
  cuenta: CuentaContable;
  /** Profundidad dentro del árbol (0 = cuenta raíz). */
  profundidad: number;
  tieneHijos: boolean;
  /** `false` cuando la rama está contraída. */
  expandida: boolean;
}

interface Props {
  filas: FilaCuenta[];
  cargando: boolean;
  error: string | null;
  hayFiltros: boolean;
  /** Cuenta que tiene una operación en curso (para bloquear sus botones). */
  idEnAccion: number | null;
  onAlternarRama: (id: number) => void;
  onExpandirTodo: () => void;
  onContraerTodo: () => void;
  onEditar: (cuenta: CuentaContable) => void;
  onNuevoHijo: (cuenta: CuentaContable) => void;
  onCambiarEstado: (cuenta: CuentaContable) => void;
  onReintentar: () => void;
  onLimpiarFiltros: () => void;
}

const COLUMNAS = 6;

/** Listado del plan contable como árbol: estados, filas y acciones por cuenta. */
export function TablaCuentas({
  filas,
  cargando,
  error,
  hayFiltros,
  idEnAccion,
  onAlternarRama,
  onExpandirTodo,
  onContraerTodo,
  onEditar,
  onNuevoHijo,
  onCambiarEstado,
  onReintentar,
  onLimpiarFiltros,
}: Readonly<Props>) {
  const esqueleto = cargando && filas.length === 0 && !error;
  const vacio = !error && !cargando && filas.length === 0;

  return (
    <div className="w-full">
      {/* Contraer / expandir todas las ramas */}
      <div className="flex items-center justify-end gap-3 pb-2 text-[11px] font-semibold text-slate-500">
        <button
          type="button"
          onClick={onExpandirTodo}
          className="uppercase tracking-wider hover:text-slate-900 cursor-pointer transition-colors"
        >
          Expandir todo
        </button>
        <span aria-hidden="true" className="text-slate-300">
          ·
        </span>
        <button
          type="button"
          onClick={onContraerTodo}
          className="uppercase tracking-wider hover:text-slate-900 cursor-pointer transition-colors"
        >
          Contraer todo
        </button>
      </div>

      <div
        className={`w-full overflow-x-auto rounded-lg transition-opacity ${cargando && filas.length > 0 ? "opacity-60" : ""}`}
      >
        <Table className="w-full text-left border-collapse min-w-30">
          <TableHeader>
            <TableRow className="text-slate-900 text-xs font-semibold bg-slate-50/75 hover:bg-slate-50/75">
              <TableHead className="py-3 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px] w-24">
                Código
              </TableHead>
              <TableHead className="py-3 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px]">
                Nombre de la cuenta
              </TableHead>
              <TableHead className="py-3 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px] w-32">
                Tipo
              </TableHead>
              <TableHead className="py-3 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px] w-28 text-center">
                Estado
              </TableHead>
              <TableHead className="py-3 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px] w-24 text-right">
                Líneas
              </TableHead>
              <TableHead className="py-3 px-3 w-32 text-right text-slate-500">Acciones</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody className="divide-y divide-slate-100 text-sm text-slate-900">
            {/* Cargando por primera vez */}
            {esqueleto &&
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`} className="hover:bg-transparent">
                  <TableCell className="py-3 px-3">
                    <Skeleton className="h-4 w-14" />
                  </TableCell>
                  <TableCell className="py-3 px-3">
                    <Skeleton className="h-4 w-56" />
                  </TableCell>
                  <TableCell className="py-3 px-3">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell className="py-3 px-3">
                    <Skeleton className="h-4 w-16 mx-auto" />
                  </TableCell>
                  <TableCell className="py-3 px-3">
                    <Skeleton className="h-4 w-8 ml-auto" />
                  </TableCell>
                  <TableCell className="py-3 px-3">
                    <Skeleton className="h-4 w-20 ml-auto" />
                  </TableCell>
                </TableRow>
              ))}

            {/* Error de carga */}
            {error && !cargando && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COLUMNAS} className="py-10 text-center">
                  <div className="flex flex-col items-center gap-3 text-slate-600">
                    <AlertCircle className="w-8 h-8 text-red-600" />
                    <p className="text-sm font-semibold">{error}</p>
                    <Button
                      type="button"
                      onClick={onReintentar}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Reintentar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* Sin resultados */}
            {vacio && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COLUMNAS} className="py-10 text-center">
                  <div className="flex flex-col items-center gap-3 text-slate-500">
                    <Inbox className="w-8 h-8 text-slate-400" />
                    <p className="text-sm font-semibold text-slate-700">
                      {hayFiltros
                        ? "No se encontraron cuentas con los filtros seleccionados"
                        : "Sin cuentas contables"}
                    </p>
                    <p className="text-xs">
                      {hayFiltros
                        ? "Ajusta la búsqueda, el tipo o el estado."
                        : "Registra la primera cuenta con el botón “Nueva cuenta”."}
                    </p>
                    {hayFiltros && (
                      <Button
                        type="button"
                        onClick={onLimpiarFiltros}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        Limpiar filtros
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* Filas del árbol */}
            {!error &&
              filas.map(({ cuenta, profundidad, tieneHijos, expandida }) => {
                const enAccion = idEnAccion === cuenta.id;
                return (
                  <TableRow
                    key={cuenta.id}
                    className="hover:bg-(--color-background) transition-colors group border-b border-slate-100"
                  >
                    <TableCell className="py-2.5 px-3 font-mono text-xs font-semibold text-slate-700 tabular-nums">
                      {cuenta.codigo}
                    </TableCell>

                    <TableCell className="py-2.5 px-3">
                      <span
                        className="flex items-center gap-1"
                        style={{ marginLeft: profundidad * 18 }}
                      >
                        {tieneHijos ? (
                          <button
                            type="button"
                            onClick={() => onAlternarRama(cuenta.id)}
                            className="p-0.5 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-colors"
                            title={expandida ? "Contraer subcuentas" : "Expandir subcuentas"}
                            aria-label={
                              expandida
                                ? `Contraer las subcuentas de ${cuenta.nombre}`
                                : `Expandir las subcuentas de ${cuenta.nombre}`
                            }
                            aria-expanded={expandida}
                          >
                            {expandida ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        ) : (
                          <span className="w-4 h-4 shrink-0" aria-hidden="true" />
                        )}
                        <span
                          className={
                            profundidad === 0
                              ? "font-semibold text-slate-900"
                              : "text-slate-700"
                          }
                        >
                          {cuenta.nombre}
                        </span>
                      </span>
                    </TableCell>

                    <TableCell className="py-2.5 px-3 text-slate-600 text-xs font-medium">
                      {cuenta.tipo}
                    </TableCell>

                    <TableCell className="py-2.5 px-3 text-center">
                      <Badge
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border-none shadow-none ${cuenta.activo ? "bg-emerald-100/80 text-emerald-700" : "bg-slate-200/80 text-slate-600"}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${cuenta.activo ? "bg-emerald-600" : "bg-slate-500"}`}
                        ></span>
                        {cuenta.activo ? "Activa" : "Inactiva"}
                      </Badge>
                    </TableCell>

                    <TableCell
                      className="py-2.5 px-3 text-right tabular-nums text-xs text-slate-500"
                      title={
                        cuenta.usos > 0
                          ? `Usada en ${cuenta.usos} línea${cuenta.usos === 1 ? "" : "s"} de asiento`
                          : "Todavía no se usa en ningún asiento"
                      }
                    >
                      {cuenta.usos}
                    </TableCell>

                    <TableCell className="py-2.5 px-3 text-right">
                      <span className="inline-flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          title={`Añadir subcuenta a ${cuenta.codigo}`}
                          aria-label={`Añadir subcuenta a ${cuenta.nombre}`}
                          onClick={() => onNuevoHijo(cuenta)}
                          disabled={enAccion}
                          className="p-1.5 rounded text-slate-400 hover:text-slate-700 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer h-7 w-7"
                        >
                          <FolderPlus className="w-4 h-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          title={`Editar ${cuenta.codigo}`}
                          aria-label={`Editar la cuenta ${cuenta.nombre}`}
                          onClick={() => onEditar(cuenta)}
                          disabled={enAccion}
                          className="p-1.5 rounded text-slate-400 hover:text-slate-700 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer h-7 w-7"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          title={cuenta.activo ? `Desactivar ${cuenta.codigo}` : `Activar ${cuenta.codigo}`}
                          aria-label={
                            cuenta.activo
                              ? `Desactivar la cuenta ${cuenta.nombre}`
                              : `Activar la cuenta ${cuenta.nombre}`
                          }
                          onClick={() => onCambiarEstado(cuenta)}
                          disabled={enAccion}
                          className={`p-1.5 rounded opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer h-7 w-7 ${cuenta.activo ? "text-slate-400 hover:text-rose-600" : "text-slate-400 hover:text-emerald-600"}`}
                        >
                          {enAccion ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Power className="w-4 h-4" />
                          )}
                        </Button>
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

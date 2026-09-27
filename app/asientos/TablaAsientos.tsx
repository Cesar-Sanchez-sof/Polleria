"use client";

import type { ReactNode } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ExternalLink,
  Inbox,
  MoreVertical,
  RefreshCw,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatearFecha,
  formatearMoneda,
  type AsientoResumen,
  type DireccionOrden,
  type OrdenAsiento,
} from "@/lib/services/asientos.service";

interface Props {
  filas: AsientoResumen[];
  cargando: boolean;
  error: string | null;
  hayFiltros: boolean;
  orden: { campo: OrdenAsiento; dir: DireccionOrden };
  pageSize: number;
  selectedIds: number[];
  onOrdenar: (campo: OrdenAsiento) => void;
  onSeleccionarTodo: (checked: boolean) => void;
  onSeleccionarFila: (id: number, checked: boolean) => void;
  onAbrirDetalle: (id: number) => void;
  onReintentar: () => void;
  onLimpiarFiltros: () => void;
}

/** Encabezado de columna ordenable (fecha, número, total, etc.). */
function ThOrden({
  campo,
  titulo,
  ordenActual,
  dir,
  onOrdenar,
  children,
  className = "",
  align = "left",
}: Readonly<{
  campo: OrdenAsiento;
  titulo: string;
  ordenActual: OrdenAsiento;
  dir: DireccionOrden;
  onOrdenar: (campo: OrdenAsiento) => void;
  children: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}>) {
  const activo = ordenActual === campo;
  const alineacion =
    align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";

  return (
    <TableHead
      className={`py-3 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px] ${className}`}
      aria-sort={activo ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onOrdenar(campo)}
        className={`w-full inline-flex items-center gap-1 uppercase cursor-pointer transition-colors hover:text-slate-900 ${alineacion} ${activo ? "text-red-700" : ""}`}
        title={`Ordenar por ${titulo}`}
      >
        <span>{children}</span>
        {activo ? (
          dir === "asc" ? (
            <ArrowUp className="w-3 h-3" />
          ) : (
            <ArrowDown className="w-3 h-3" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}

/** Listado de asientos: estados de carga/error/vacío, filas y selección. */
export function TablaAsientos({
  filas,
  cargando,
  error,
  hayFiltros,
  orden,
  pageSize,
  selectedIds,
  onOrdenar,
  onSeleccionarTodo,
  onSeleccionarFila,
  onAbrirDetalle,
  onReintentar,
  onLimpiarFiltros,
}: Readonly<Props>) {
  const esqueleto = cargando && filas.length === 0 && !error;
  const vacio = !error && !cargando && filas.length === 0;
  const allSelected = filas.length > 0 && filas.every((r) => selectedIds.includes(r.id));

  return (
    <div
      className={`w-full overflow-x-auto rounded-lg transition-opacity ${cargando && filas.length > 0 ? "opacity-60" : ""}`}
    >
      <Table className="w-full text-left border-collapse min-w-245">
        <TableHeader>
          <TableRow className="text-slate-900 text-xs font-semibold  bg-slate-50/75 hover:bg-slate-50/75">
            <TableHead className="py-3 px-3 w-10 text-center">
              <Checkbox
                id="check-all"
                checked={allSelected}
                onCheckedChange={(checked) => onSeleccionarTodo(!!checked)}
                className="cursor-pointer"
              />
            </TableHead>
            <ThOrden
              campo="fecha"
              titulo="Fecha"
              ordenActual={orden.campo}
              dir={orden.dir}
              onOrdenar={onOrdenar}
            >
              Fecha
            </ThOrden>
            <ThOrden
              campo="numero"
              titulo="Número"
              ordenActual={orden.campo}
              dir={orden.dir}
              onOrdenar={onOrdenar}
            >
              Número
            </ThOrden>
            <TableHead className="py-3 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px]">
              Concepto
            </TableHead>
            <ThOrden
              campo="diario"
              titulo="Diario"
              ordenActual={orden.campo}
              dir={orden.dir}
              onOrdenar={onOrdenar}
            >
              Diario
            </ThOrden>
            <TableHead className="py-3 px-3 font-bold uppercase tracking-wider text-slate-500 text-[11px]">
              Responsable
            </TableHead>
            <ThOrden
              campo="total"
              titulo="Total"
              ordenActual={orden.campo}
              dir={orden.dir}
              onOrdenar={onOrdenar}
              align="right"
              className="text-right"
            >
              Total
            </ThOrden>
            <ThOrden
              campo="estado"
              titulo="Estado"
              ordenActual={orden.campo}
              dir={orden.dir}
              onOrdenar={onOrdenar}
              align="center"
              className="text-center"
            >
              Estado
            </ThOrden>
            <TableHead
              className="py-3 px-3 w-12 text-center text-slate-500"
              title="Personalizar columnas"
            >
              <SlidersHorizontal className="w-4 h-4 inline cursor-pointer hover:text-slate-900" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-slate-100 text-sm text-slate-900">
          {/* Cargando por primera vez */}
          {esqueleto &&
            Array.from({ length: Math.min(pageSize, 8) }).map((_, i) => (
              <TableRow key={`skeleton-${i}`} className="hover:bg-transparent">
                <TableCell className="py-3 px-3">
                  <Skeleton className="h-4 w-4 mx-auto" />
                </TableCell>
                <TableCell className="py-3 px-3">
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell className="py-3 px-3">
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell className="py-3 px-3">
                  <Skeleton className="h-4 w-48" />
                </TableCell>
                <TableCell className="py-3 px-3">
                  <Skeleton className="h-4 w-32" />
                </TableCell>
                <TableCell className="py-3 px-3">
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell className="py-3 px-3">
                  <Skeleton className="h-4 w-20 ml-auto" />
                </TableCell>
                <TableCell className="py-3 px-3">
                  <Skeleton className="h-4 w-16 mx-auto" />
                </TableCell>
                <TableCell className="py-3 px-3">
                  <Skeleton className="h-4 w-4 mx-auto" />
                </TableCell>
              </TableRow>
            ))}

          {/* Error de carga */}
          {error && !cargando && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={9} className="py-10 text-center">
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
              <TableCell colSpan={9} className="py-10 text-center">
                <div className="flex flex-col items-center gap-3 text-slate-500">
                  <Inbox className="w-8 h-8 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-700">
                    No se encontraron asientos con los filtros seleccionados
                  </p>
                  <p className="text-xs">
                    Ajusta el rango de fechas, el diario, el estado o la búsqueda.
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

          {/* Filas */}
          {!error &&
            filas.map((row) => {
              const isSelected = selectedIds.includes(row.id);
              return (
                <TableRow
                  key={row.id}
                  onClick={() => void onAbrirDetalle(row.id)}
                  className={`hover:bg-(--color-background) transition-colors group cursor-pointer border-b border-slate-100 ${isSelected ? "bg-slate-100/75" : ""}`}
                  title="Ver detalle del asiento"
                >
                  <TableCell
                    className="py-3 px-3 text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => onSeleccionarFila(row.id, !!checked)}
                      className="cursor-pointer"
                    />
                  </TableCell>
                  <TableCell className="py-3 px-3 tabular-nums font-medium text-slate-800">
                    {formatearFecha(row.fecha)}
                  </TableCell>
                  <TableCell className="py-3 px-3 font-semibold text-red-700 hover:underline">
                    <Button
                      className="flex items-center gap-1.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        void onAbrirDetalle(row.id);
                      }}
                    >
                      <span>{row.numero}</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-slate-400 transition-opacity" />
                    </Button>
                  </TableCell>
                  <TableCell className="py-3 px-3 text-slate-700 text-xs max-w-72">
                    <span className="line-clamp-2">{row.concepto}</span>
                  </TableCell>
                  <TableCell className="py-3 px-3 text-slate-600 font-medium">
                    {row.diario}
                  </TableCell>
                  <TableCell className="py-3 px-3 text-slate-500 text-xs">
                    {row.responsable ?? "—"}
                  </TableCell>
                  <TableCell className="py-3 px-3 text-right tabular-nums font-bold text-slate-900">
                    {formatearMoneda(row.total)}
                  </TableCell>
                  <TableCell className="py-3 px-3 text-center">
                    <Badge
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border-none shadow-none ${row.estado === "Registrado" ? "bg-emerald-100/80 text-emerald-700" : "bg-rose-100/80 text-rose-700"}`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${row.estado === "Registrado" ? "bg-emerald-600" : "bg-rose-600"}`}
                      ></span>
                      {row.estado}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className="py-3 px-3 text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="p-1 rounded text-slate-400 hover:text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer h-7 w-7"
                      type="button"
                      title="Opciones"
                      onClick={() => void onAbrirDetalle(row.id)}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
        </TableBody>
      </Table>
    </div>
  );
}

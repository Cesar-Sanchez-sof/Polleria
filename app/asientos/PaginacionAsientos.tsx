"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAGE_SIZE_OPCIONES = [10, 25, 50];

interface Props {
  page: number;
  totalPaginas: number;
  pageSize: number;
  cargando: boolean;
  desdeMostrado: number;
  hastaMostrado: number;
  total: number;
  seleccionados: number;
  onPagina: (pagina: number) => void;
  onPageSize: (pageSize: number) => void;
}

/** Paginación inferior: rango visible, filas por página y saltos de página. */
export function PaginacionAsientos({
  page,
  totalPaginas,
  pageSize,
  cargando,
  desdeMostrado,
  hastaMostrado,
  total,
  seleccionados,
  onPagina,
  onPageSize,
}: Readonly<Props>) {
  const paginasVisibles = useMemo(() => {
    const actual = Math.min(page, totalPaginas);
    const inicio = Math.max(1, Math.min(actual - 2, totalPaginas - 4));
    const fin = Math.min(totalPaginas, inicio + 4);
    const lista: (number | "…")[] = [];
    if (inicio > 1) lista.push(1);
    if (inicio > 2) lista.push("…");
    for (let n = inicio; n <= fin; n++) lista.push(n);
    if (fin < totalPaginas - 1) lista.push("…");
    if (fin < totalPaginas) lista.push(totalPaginas);
    return lista;
  }, [page, totalPaginas]);

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
      <div className="flex items-center gap-3 text-xs text-slate-500">
        {seleccionados > 0 && (
          <span className="font-semibold text-slate-800">{seleccionados} seleccionado(s)</span>
        )}
        <span className="tabular-nums">
          Mostrando {desdeMostrado}–{hastaMostrado} de {total} asientos
        </span>
        <div className="flex items-center gap-1.5">
          <label id="page-size-label" className="text-slate-500">
            Por página
          </label>
          <Select
            value={pageSize}
            onValueChange={(valor) => {
              if (typeof valor === "number") onPageSize(valor);
            }}
          >
            <SelectTrigger
              size="sm"
              className="rounded-lg bg-white text-xs"
              aria-labelledby="page-size-label"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPCIONES.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          type="button"
          disabled={cargando || page <= 1}
          onClick={() => onPagina(Math.max(1, page - 1))}
          className="h-7 w-7 rounded-md text-slate-600 hover:text-slate-900 disabled:text-slate-300"
          title="Página anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        {paginasVisibles.map((n, i) =>
          n === "…" ? (
            <span key={`ellipsis-${i}`} className="px-1 text-slate-400 text-xs">
              …
            </span>
          ) : (
            <Button
              key={n}
              variant="ghost"
              type="button"
              onClick={() => onPagina(n)}
              disabled={cargando}
              className={`h-7 min-w-7 px-2 rounded-md text-xs tabular-nums cursor-pointer ${
                n === page
                  ? "bg-slate-900 text-white font-bold hover:bg-slate-900 hover:text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {n}
            </Button>
          )
        )}

        <Button
          variant="ghost"
          size="icon"
          type="button"
          disabled={cargando || page >= totalPaginas}
          onClick={() => onPagina(Math.min(totalPaginas, page + 1))}
          className="h-7 w-7 rounded-md text-slate-600 hover:text-slate-900 disabled:text-slate-300"
          title="Página siguiente"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

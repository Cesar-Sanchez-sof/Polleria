"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

import { JournalEntryDetail } from "../entries/components/JournalEntryDetail";
import { JournalEntryPagination } from "../entries/components/JournalEntryPagination";
import { DailyBookFilters } from "./components/DailyBookFilters";
import { DailyJournalTable } from "./components/DailyJournalTable";
import {
  listDailyBookEntries,
  getJournalEntry,
  type JournalEntryDetail as EntryDetailData,
  type DailyBookPage as DailyBookPageData,
} from "@/lib/services/daily-book.service";

/**
 * Pantalla del Libro Diario: asientos contables ordenados cronológicamente
 * (del más reciente al más antiguo) con sus líneas y totales, filtrables por
 * un periodo de fechas.
 *
 * La lógica de presentación vive en ./components/DailyBookFilters.tsx y
 * ./components/DailyJournalTable.tsx; el acceso a datos en lib/services/diario.service.ts.
 */
export default function DailyBookPage() {
  // ---------------------------------------------------------------------
  // Filtro de periodo (fechas inicial y final, ambas inclusive)
  // ---------------------------------------------------------------------
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  // Paginación
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Datos
  const [pageData, setPageData] = useState<DailyBookPageData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Detalle del asiento seleccionado
  const [detailOpen, setDetailOpen] = useState<boolean>(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<EntryDetailData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  // Control de carreras: sólo la última petición puede escribir estado
  const requestRef = useRef(0);
  const detailRequestRef = useRef(0);

  const invalidRange = Boolean(from && to && from > to);
  const hasFilters = Boolean(from) || Boolean(to);

  // Listado: se reconsulta cada vez que cambia el periodo o la página.
  // Un rango invertido no se consulta: el aviso se deriva del propio estado
  // (`displayedError`), sin tocar el estado dentro del efecto.
  const loadList = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await listDailyBookEntries({ desde: from, hasta: to, page, pageSize });
      if (request !== requestRef.current) return;
      setPageData(data);
    } catch (e) {
      if (request !== requestRef.current) return;
      setPageData(null);
      setError(e instanceof Error ? e.message : "No se pudo cargar el libro diario.");
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [from, to, page, pageSize]);

  useEffect(() => {
    // Se difiere al siguiente tick para no invocar setState de forma síncrona
    // dentro del cuerpo del efecto (regla react-hooks/set-state-in-effect).
    // Si cambia el periodo, el cleanup cancela el disparo pendiente.
    if (invalidRange) return;
    const timer = setTimeout(() => {
      void loadList();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadList, invalidRange]);

  // ---------------------------------------------------------------------
  // Acciones
  // ---------------------------------------------------------------------
  const clearFilters = () => {
    setFrom("");
    setTo("");
    setPage(1);
  };

  const changeRange = (field: "from" | "to", value: string) => {
    if (field === "from") setFrom(value);
    else setTo(value);
    setPage(1);
  };

  const changePageSize = (value: number) => {
    setPageSize(value);
    setPage(1);
  };

  const changePage = (value: number) => setPage(value);

  const openDetail = async (id: number) => {
    const request = ++detailRequestRef.current;
    setDetailOpen(true);
    setDetailId(id);
    setDetail(null);
    setErrorDetail(null);
    setLoadingDetail(true);
    try {
      const data = await getJournalEntry(id);
      if (request !== detailRequestRef.current) return;
      setDetail(data);
    } catch (e) {
      if (request !== detailRequestRef.current) return;
      setErrorDetail(
        e instanceof Error ? e.message : "No se pudo cargar el detalle del asiento."
      );
    } finally {
      if (request === detailRequestRef.current) setLoadingDetail(false);
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailId(null);
    setDetail(null);
    setErrorDetail(null);
  };

  const retryDetail = () => {
    if (detailId !== null) void openDetail(detailId);
  };

  // ---------------------------------------------------------------------
  // Datos derivados
  // ---------------------------------------------------------------------
  const rows = pageData?.data ?? [];
  const meta = pageData?.meta;
  const total = meta?.total ?? 0;
  const totalPages = meta?.totalPaginas ?? 1;

  // Un rango invertido suspende la consulta: se muestra el aviso del filtro en
  // lugar de los datos del último periodo válido (todo se deriva del estado).
  const displayedError = invalidRange
    ? "La fecha inicial no puede ser posterior a la fecha final."
    : error;
  const isLoading = loading && !invalidRange;
  const displayedTotal = invalidRange ? 0 : total;

  const fromShown = total === 0 ? 0 : (Math.min(page, totalPages) - 1) * pageSize + 1;
  const toShown = total === 0 ? 0 : Math.min(fromShown + rows.length - 1, total);

  return (
    <>
      {/* Main content area */}
      <div className="pl-64 min-h-screen flex flex-col bg-(--color-background) w-full">
        {/* Main Content */}
        <main className="relative flex-1 p-6">
          <div className="flex flex-col w-full gap-5">

            {/* HEADER */}
            <Card className="bg-white rounded-xl shadow-sm ring-0 p-6 flex flex-col gap-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-7 h-7" />
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                      Libro Diario
                    </h1>
                    <p className="text-xs text-slate-500">
                      Asientos ordenados cronológicamente, del más reciente al más antiguo.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="bg-slate-100 px-2.5 py-1.5 rounded-lg">
                    <span className="tabular-nums font-semibold text-slate-900">
                      {displayedTotal}
                    </span>{" "}
                    asiento{displayedTotal === 1 ? "" : "s"}
                    {hasFilters && !invalidRange ? " en el periodo" : ""}
                  </span>
                </div>
              </div>
            </Card>

            {/* FILTRO DE PERIODO Y TABLA */}
            <Card className="bg-white rounded-xl shadow-sm ring-0 p-6 flex flex-col gap-5">
              <DailyBookFilters
                from={from}
                to={to}
                hasFilters={hasFilters}
                invalidRange={invalidRange}
                onFrom={(value) => changeRange("from", value)}
                onTo={(value) => changeRange("to", value)}
                onClear={clearFilters}
              />

              <DailyJournalTable
                rows={rows}
                loading={isLoading}
                error={displayedError}
                hasFilters={hasFilters}
                invalidRange={invalidRange}
                onOpenDetail={(id) => void openDetail(id)}
                onRetry={() => void loadList()}
                onClearFilters={clearFilters}
              />

              {!invalidRange && (
                <JournalEntryPagination
                  page={page}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  loading={loading}
                  fromShown={fromShown}
                  toShown={toShown}
                  total={total}
                  selectedCount={0}
                  onPage={changePage}
                  onPageSize={changePageSize}
                />
              )}
            </Card>
          </div>
        </main>
      </div>

      {/* DETALLE DEL ASIENTE SELECCIONADO */}
      <JournalEntryDetail
        open={detailOpen}
        detail={detail}
        loading={loadingDetail}
        error={errorDetail}
        onClose={closeDetail}
        onRetry={retryDetail}
      />
    </>
  );
}

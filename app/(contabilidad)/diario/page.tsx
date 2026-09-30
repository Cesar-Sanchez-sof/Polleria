"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

import { DetalleAsientos } from "../asientos/DetalleAsientos";
import { PaginacionAsientos } from "../asientos/PaginacionAsientos";
import { FiltrosDiario } from "./FiltrosDiario";
import { DailyJournalTable } from "./TablaDiario";

import {
  listarLibroDiario,
  obtenerAsiento,
  type AsientoDetalle,
  type PaginaDiario,
} from "@/lib/services/diario.service";

/**
 * Pantalla del Libro Diario: asientos contables ordenados cronológicamente
 * (del más reciente al más antiguo) con sus líneas y totales, filtrables por
 * un periodo de fechas.
 *
 * La lógica de presentación vive en ./<Componente>Diario.tsx y el acceso a
 * datos en lib/services/diario.service.ts.
 */
export default function LibroDiarioPage() {
  // ---------------------------------------------------------------------
  // Filtro de periodo (fechas inicial y final, ambas inclusive)
  // ---------------------------------------------------------------------
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");

  // Paginación
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Datos
  const [pagina, setPagina] = useState<PaginaDiario | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Detalle del asiento seleccionado
  const [detalleAbierto, setDetalleAbierto] = useState<boolean>(false);
  const [detalleId, setDetalleId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<AsientoDetalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState<boolean>(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);

  // Control de carreras: sólo la última petición puede escribir estado
  const solicitudRef = useRef(0);
  const detalleSolicitudRef = useRef(0);

  const rangoInvalido = Boolean(desde && hasta && desde > hasta);
  const hayFiltros = Boolean(desde) || Boolean(hasta);

  // Listado: se reconsulta cada vez que cambia el periodo o la página.
  // Un rango invertido no se consulta: el aviso se deriva del propio estado
  // (`errorMostrado`), sin tocar el estado dentro del efecto.
  const cargarListado = useCallback(async () => {
    const solicitud = ++solicitudRef.current;
    setCargando(true);
    setError(null);
    try {
      const datos = await listarLibroDiario({ desde, hasta, page, pageSize });
      if (solicitud !== solicitudRef.current) return;
      setPagina(datos);
    } catch (e) {
      if (solicitud !== solicitudRef.current) return;
      setPagina(null);
      setError(e instanceof Error ? e.message : "No se pudo cargar el libro diario.");
    } finally {
      if (solicitud === solicitudRef.current) setCargando(false);
    }
  }, [desde, hasta, page, pageSize]);

  useEffect(() => {
    // Se difiere al siguiente tick para no invocar setState de forma síncrona
    // dentro del cuerpo del efecto (regla react-hooks/set-state-in-effect).
    // Si cambia el periodo, el cleanup cancela el disparo pendiente.
    if (rangoInvalido) return;
    const timer = setTimeout(() => {
      void cargarListado();
    }, 0);
    return () => clearTimeout(timer);
  }, [cargarListado, rangoInvalido]);

  // ---------------------------------------------------------------------
  // Acciones
  // ---------------------------------------------------------------------
  const limpiarFiltros = () => {
    setDesde("");
    setHasta("");
    setPage(1);
  };

  const cambiarRango = (campo: "desde" | "hasta", valor: string) => {
    if (campo === "desde") setDesde(valor);
    else setHasta(valor);
    setPage(1);
  };

  const cambiarPageSize = (valor: number) => {
    setPageSize(valor);
    setPage(1);
  };

  const cambiarPagina = (valor: number) => setPage(valor);

  const abrirDetalle = async (id: number) => {
    const solicitud = ++detalleSolicitudRef.current;
    setDetalleAbierto(true);
    setDetalleId(id);
    setDetalle(null);
    setErrorDetalle(null);
    setCargandoDetalle(true);
    try {
      const datos = await obtenerAsiento(id);
      if (solicitud !== detalleSolicitudRef.current) return;
      setDetalle(datos);
    } catch (e) {
      if (solicitud !== detalleSolicitudRef.current) return;
      setErrorDetalle(
        e instanceof Error ? e.message : "No se pudo cargar el detalle del asiento."
      );
    } finally {
      if (solicitud === detalleSolicitudRef.current) setCargandoDetalle(false);
    }
  };

  const cerrarDetalle = () => {
    setDetalleAbierto(false);
    setDetalleId(null);
    setDetalle(null);
    setErrorDetalle(null);
  };

  const reintentarDetalle = () => {
    if (detalleId !== null) void abrirDetalle(detalleId);
  };

  // ---------------------------------------------------------------------
  // Datos derivados
  // ---------------------------------------------------------------------
  const rows = pagina?.data ?? [];
  const meta = pagina?.meta;
  const total = meta?.total ?? 0;
  const totalPaginas = meta?.totalPaginas ?? 1;

  // Un rango invertido suspende la consulta: se muestra el aviso del filtro en
  // lugar de los datos del último periodo válido (todo se deriva del estado).
  const errorMostrado = rangoInvalido
    ? "La fecha inicial no puede ser posterior a la fecha final."
    : error;
  const enCarga = cargando && !rangoInvalido;
  const totalMostrado = rangoInvalido ? 0 : total;

  const desdeMostrado = total === 0 ? 0 : (Math.min(page, totalPaginas) - 1) * pageSize + 1;
  const hastaMostrado = total === 0 ? 0 : Math.min(desdeMostrado + filas.length - 1, total);

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
                      {totalMostrado}
                    </span>{" "}
                    asiento{totalMostrado === 1 ? "" : "s"}
                    {hayFiltros && !rangoInvalido ? " en el periodo" : ""}
                  </span>
                </div>
              </div>
            </Card>

            {/* FILTRO DE PERIODO Y TABLA */}
            <Card className="bg-white rounded-xl shadow-sm ring-0 p-6 flex flex-col gap-5">
              <FiltrosDiario
                from={desde}
                to={hasta}
                hasFilters={hayFiltros}
                invalidRange={rangoInvalido}
                onFrom={(valor) => cambiarRango("desde", valor)}
                onTo={(valor) => cambiarRango("hasta", valor)}
                onClear={limpiarFiltros}
              />

              <DailyJournalTable
                rows={rows}
                loading={enCarga}
                error={errorMostrado}
                hasFilters={hayFiltros}
                invalidRange={rangoInvalido}
                onOpenDetail={(id) => void abrirDetalle(id)}
                onRetry={() => void cargarListado()}
                onClearFilters={limpiarFiltros}
              />

              {!rangoInvalido && (
                <PaginacionAsientos
                  page={page}
                  totalPaginas={totalPaginas}
                  pageSize={pageSize}
                  cargando={cargando}
                  desdeMostrado={desdeMostrado}
                  hastaMostrado={hastaMostrado}
                  total={total}
                  seleccionados={0}
                  onPagina={cambiarPagina}
                  onPageSize={cambiarPageSize}
                />
              )}
            </Card>
          </div>
        </main>
      </div>

      {/* DETALLE DEL ASIENTE SELECCIONADO */}
      <DetalleAsientos
        abierto={detalleAbierto}
        detalle={detalle}
        cargando={cargandoDetalle}
        error={errorDetalle}
        onCerrar={cerrarDetalle}
        onReintentar={reintentarDetalle}
      />
    </>
  );
}

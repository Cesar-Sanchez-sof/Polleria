"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "../../../components/personalized/Sidebar";
import { Card } from "@/components/ui/card";

import { DetalleAsientos } from "./DetalleAsientos";
import { FiltrosAsientos, type FiltroChip } from "./FiltrosAsientos";
import { NuevoAsientoDialog } from "./NuevoAsientoDialog";
import { PaginacionAsientos } from "./PaginacionAsientos";
import { TabsDiarioAsientos } from "./TabsDiarioAsientos";
import { TablaAsientos } from "./TablaAsientos";
import { ToolbarAsientos } from "./ToolbarAsientos";

import {
  listarAsientos,
  obtenerAsiento,
  obtenerOpcionesAsientos,
  type AsientoDetalle,
  type DireccionOrden,
  type OrdenAsiento,
  type OpcionesAsientos,
  type PaginaAsientos,
} from "@/lib/services/asientos.service";

/**
 * Pantalla de consulta de asientos contables.
 * La lógica de presentación vive en ./<Componente>Asientos.tsx y el acceso a
 * datos en lib/services/asientos.service.ts.
 */
export default function AsientosPage() {
  // ---------------------------------------------------------------------
  // Filtros (todos se aplican de forma simultánea)
  // ---------------------------------------------------------------------
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");
  const [diario, setDiario] = useState<string>("todos");
  const [estadoFiltro, setEstadoFiltro] = useState<string>("todos");
  const [q, setQ] = useState<string>("");
  const [busqueda, setBusqueda] = useState<string>("");

  // Orden y paginación
  const [orden, setOrden] = useState<{ campo: OrdenAsiento; dir: DireccionOrden }>({
    campo: "fecha",
    dir: "desc",
  });
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Datos
  const [pagina, setPagina] = useState<PaginaAsientos | null>(null);
  const [opciones, setOpciones] = useState<OpcionesAsientos | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Detalle del asiento seleccionado
  const [detalleAbierto, setDetalleAbierto] = useState<boolean>(false);
  const [detalleId, setDetalleId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<AsientoDetalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState<boolean>(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);

  // Diálogo de alta manual
  const [nuevoAbierto, setNuevoAbierto] = useState<boolean>(false);

  // Control de carreras: sólo la última petición puede escribir estado
  const solicitudRef = useRef(0);
  const detalleSolicitudRef = useRef(0);

  // Selección de filas
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Búsqueda con debounce para no disparar una petición por tecla
  useEffect(() => {
    const timer = setTimeout(() => {
      setBusqueda((anterior) => (anterior === q ? anterior : q));
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [q]);

  // Opciones de filtro (diarios y estados)
  useEffect(() => {
    let activo = true;
    obtenerOpcionesAsientos()
      .then((datos) => {
        if (activo) setOpciones(datos);
      })
      .catch(() => {
        if (activo) setOpciones(null);
      });
    return () => {
      activo = false;
    };
  }, []);

  // Un asiento recién creado puede aportar un diario nuevo a los filtros
  const recargarOpciones = useCallback(() => {
    obtenerOpcionesAsientos()
      .then((datos) => setOpciones(datos))
      .catch(() => setOpciones(null));
  }, []);

  // Listado: se reconsulta cada vez que cambia un filtro, el orden o la página
  const cargarListado = useCallback(async () => {
    // Sólo la última petición puede escribir el estado (evita respuestas fuera de orden)
    const solicitud = ++solicitudRef.current;
    setCargando(true);
    setError(null);
    try {
      const datos = await listarAsientos({
        desde,
        hasta,
        diario: diario === "todos" ? "" : diario,
        estado: estadoFiltro === "todos" ? "" : estadoFiltro,
        q: busqueda,
        page,
        pageSize,
        orden: orden.campo,
        dir: orden.dir,
      });
      if (solicitud !== solicitudRef.current) return;
      setPagina(datos);
    } catch (e) {
      if (solicitud !== solicitudRef.current) return;
      setPagina(null);
      setError(e instanceof Error ? e.message : "No se pudo cargar el listado de asientos.");
    } finally {
      if (solicitud === solicitudRef.current) setCargando(false);
    }
  }, [desde, hasta, diario, estadoFiltro, busqueda, page, pageSize, orden]);

  useEffect(() => {
    // Se difiere al siguiente tick para no invocar setState de forma síncrona
    // dentro del cuerpo del efecto (regla react-hooks/set-state-in-effect).
    // Si cambian los filtros, el cleanup cancela el disparo pendiente.
    const timer = setTimeout(() => {
      void cargarListado();
    }, 0);
    return () => clearTimeout(timer);
  }, [cargarListado]);

  // ---------------------------------------------------------------------
  // Acciones
  // ---------------------------------------------------------------------
  const hayFiltros =
    Boolean(desde) ||
    Boolean(hasta) ||
    diario !== "todos" ||
    estadoFiltro !== "todos" ||
    busqueda.trim() !== "";

  const limpiarFiltros = () => {
    setDesde("");
    setHasta("");
    setDiario("todos");
    setEstadoFiltro("todos");
    setQ("");
    setBusqueda("");
    setPage(1);
  };

  const limpiarBusqueda = () => {
    setQ("");
    setBusqueda("");
    setPage(1);
  };

  const cambiarDiario = (valor: string) => {
    setDiario(valor);
    setPage(1);
  };

  const cambiarEstado = (valor: string) => {
    setEstadoFiltro(valor);
    setPage(1);
  };

  const cambiarRango = (campo: "desde" | "hasta", valor: string) => {
    if (campo === "desde") setDesde(valor);
    else setHasta(valor);
    setPage(1);
  };

  const quitarFiltro = (chip: FiltroChip) => {
    switch (chip) {
      case "desde":
        cambiarRango("desde", "");
        break;
      case "hasta":
        cambiarRango("hasta", "");
        break;
      case "diario":
        cambiarDiario("todos");
        break;
      case "estado":
        cambiarEstado("todos");
        break;
      case "q":
        limpiarBusqueda();
        break;
    }
  };

  const ordenarPor = (campo: OrdenAsiento) => {
    setOrden((anterior) => {
      if (anterior.campo === campo) {
        return { campo, dir: anterior.dir === "asc" ? "desc" : "asc" };
      }
      const dirPorDefecto: DireccionOrden =
        campo === "fecha" || campo === "total" ? "desc" : "asc";
      return { campo, dir: dirPorDefecto };
    });
    setPage(1);
  };

  const cambiarPageSize = (valor: number) => {
    setPageSize(valor);
    setPage(1);
  };

  const cambiarPagina = (valor: number) => setPage(valor);

  /** Tras registrar un asiento manual: refresca listado y opciones de filtro. */
  const trasCrearAsiento = () => {
    if (page !== 1) {
      // Cambiar de página ya dispara la recarga del listado
      setPage(1);
    } else {
      void cargarListado();
    }
    recargarOpciones();
  };

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

  const handleSelectAll = (checked: boolean) => {
    const visibles = (pagina?.data ?? []).map((r) => r.id);
    if (checked) {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibles])));
    } else {
      const visiblesSet = new Set(visibles);
      setSelectedIds((prev) => prev.filter((id) => !visiblesSet.has(id)));
    }
  };

  const handleSelectRow = (id: number, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((item) => item !== id)));
  };

  // ---------------------------------------------------------------------
  // Datos derivados
  // ---------------------------------------------------------------------
  const filas = pagina?.data ?? [];
  const meta = pagina?.meta;
  const total = meta?.total ?? 0;
  const totalPaginas = meta?.totalPaginas ?? 1;

  const desdeMostrado = total === 0 ? 0 : (Math.min(page, totalPaginas) - 1) * pageSize + 1;
  const hastaMostrado = total === 0 ? 0 : Math.min(desdeMostrado + filas.length - 1, total);

  const porcentajeValidados =
    total > 0 && meta ? Math.round((meta.registrados / total) * 100) : 0;

  const diarios = opciones?.diarios ?? [];

  return (
    <>
      {/* Main content area */}
      <div className="pl-64 min-h-screen flex flex-col bg-(--color-background) w-full">
        {/* Main Content */}
        <main className="relative flex-1 p-6">
          <div className="flex flex-col w-full gap-5">


            {/* MAIN LEDGER APPLICATION CARD */}
            <Card className="bg-white rounded-xl shadow-sm ring-0 p-6 flex flex-col gap-5">
              <ToolbarAsientos
                q={q}
                onBuscar={setQ}
                onLimpiarBusqueda={limpiarBusqueda}
                onNuevo={() => setNuevoAbierto(true)}
                desdeMostrado={desdeMostrado}
                hastaMostrado={hastaMostrado}
                total={total}
                cargando={cargando}
                page={page}
                totalPaginas={totalPaginas}
                onPagina={cambiarPagina}
              />
            </Card>



            <Card className="bg-white rounded-xl shadow-sm ring-0 p-6 flex flex-col gap-5">

              <div className="flex flex-wrap gap-3">
                <TabsDiarioAsientos
                  diarios={diarios}
                  total={total}
                  diario={diario}
                  onSeleccionar={cambiarDiario}
                />

                <FiltrosAsientos
                  desde={desde}
                  hasta={hasta}
                  diario={diario}
                  estadoFiltro={estadoFiltro}
                  busqueda={busqueda}
                  opciones={opciones}
                  hayFiltros={hayFiltros}
                  onDesde={(valor) => cambiarRango("desde", valor)}
                  onHasta={(valor) => cambiarRango("hasta", valor)}
                  onEstado={cambiarEstado}
                  onLimpiar={limpiarFiltros}
                  onQuitar={quitarFiltro}
                />
              </div>

              <TablaAsientos
                filas={filas}
                cargando={cargando}
                error={error}
                hayFiltros={hayFiltros}
                orden={orden}
                pageSize={pageSize}
                selectedIds={selectedIds}
                onOrdenar={ordenarPor}
                onSeleccionarTodo={handleSelectAll}
                onSeleccionarFila={handleSelectRow}
                onAbrirDetalle={abrirDetalle}
                onReintentar={() => void cargarListado()}
                onLimpiarFiltros={limpiarFiltros}
              />



              <PaginacionAsientos
                page={page}
                totalPaginas={totalPaginas}
                pageSize={pageSize}
                cargando={cargando}
                desdeMostrado={desdeMostrado}
                hastaMostrado={hastaMostrado}
                total={total}
                seleccionados={selectedIds.length}
                onPagina={cambiarPagina}
                onPageSize={cambiarPageSize}
              />
            </Card>
          </div>
        </main>
      </div>

      {/* DETALLE DEL ASIENTO SELECCIONADO */}
      <DetalleAsientos
        abierto={detalleAbierto}
        detalle={detalle}
        cargando={cargandoDetalle}
        error={errorDetalle}
        onCerrar={cerrarDetalle}
        onReintentar={reintentarDetalle}
      />

      {/* ALTA MANUAL DE UN ASIENTO */}
      <NuevoAsientoDialog
        abierto={nuevoAbierto}
        diarios={opciones?.diarios ?? []}
        onCerrar={() => setNuevoAbierto(false)}
        onCreado={trasCrearAsiento}
      />
    </>
  );
}

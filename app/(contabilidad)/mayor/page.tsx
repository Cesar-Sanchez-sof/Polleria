"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { BookMarked } from "lucide-react";

import { DetalleAsientos } from "../asientos/DetalleAsientos";
import { FiltrosMayor } from "./FiltrosMayor";
import { TablaMayor } from "./TablaMayor";

import {
  listarCuentasContables,
  obtenerAsiento,
  obtenerLibroMayor,
  type AsientoDetalle,
  type CuentaContable,
  type LibroMayor,
} from "@/lib/services/mayor.service";

/**
 * Pantalla del Libro mayor: movimientos de una cuenta contable en orden
 * cronológico (del más antiguo al más reciente) con su saldo corriente,
 * consultables por cuenta (C01) y periodo de fechas (C09).
 *
 * La lógica de presentación vive en ./<Componente>Mayor.tsx y el acceso a
 * datos en lib/services/mayor.service.ts.
 */
export default function LibroMayorPage() {
  // ---------------------------------------------------------------------
  // Plan contable disponible para la selección de cuenta (C01)
  // ---------------------------------------------------------------------
  const [cuentas, setCuentas] = useState<CuentaContable[]>([]);
  const [cargandoCuentas, setCargandoCuentas] = useState<boolean>(true);
  const [errorCuentas, setErrorCuentas] = useState<string | null>(null);

  // ---------------------------------------------------------------------
  // Cuenta seleccionada y periodo consultado (C01, C09)
  // ---------------------------------------------------------------------
  const [codigo, setCodigo] = useState<string>("");
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");

  // Datos del libro mayor
  const [libro, setLibro] = useState<LibroMayor | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Detalle del asiento relacionado (C13)
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

  // Plan contable: se carga una sola vez y se selecciona la primera cuenta
  useEffect(() => {
    // Se difiere al siguiente tick para no invocar setState de forma síncrona
    // dentro del cuerpo del efecto (regla react-hooks/set-state-in-effect).
    const timer = setTimeout(async () => {
      try {
        const data = await listarCuentasContables();
        setCuentas(data);
        setCodigo((actual) => actual || data[0]?.codigo || "");
      } catch (e) {
        setErrorCuentas(
          e instanceof Error ? e.message : "No se pudo cargar el plan contable."
        );
      } finally {
        setCargandoCuentas(false);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Libro mayor: se reconsulta cuando cambia la cuenta o el periodo
  const cargarLibro = useCallback(async () => {
    if (!codigo) {
      // Sin cuenta seleccionada no hay nada que consultar todavía.
      setLibro(null);
      setError(null);
      setCargando(false);
      return;
    }
    const solicitud = ++solicitudRef.current;
    setCargando(true);
    setError(null);
    try {
      const datos = await obtenerLibroMayor({ codigo, desde, hasta });
      if (solicitud !== solicitudRef.current) return;
      setLibro(datos);
    } catch (e) {
      if (solicitud !== solicitudRef.current) return;
      setLibro(null);
      setError(e instanceof Error ? e.message : "No se pudo cargar el libro mayor.");
    } finally {
      if (solicitud === solicitudRef.current) setCargando(false);
    }
  }, [codigo, desde, hasta]);

  useEffect(() => {
    // Un rango invertido no se consulta: el aviso lo deriva el propio estado.
    // Si cambia la cuenta o el periodo, el cleanup cancela el disparo pendiente.
    if (rangoInvalido) return;
    const timer = setTimeout(() => {
      void cargarLibro();
    }, 0);
    return () => clearTimeout(timer);
  }, [cargarLibro, rangoInvalido]);

  // ---------------------------------------------------------------------
  // Acciones
  // ---------------------------------------------------------------------
  const limpiarFiltros = () => {
    setDesde("");
    setHasta("");
  };

  const cambiarPeriodo = (campo: "desde" | "hasta", valor: string) => {
    if (campo === "desde") setDesde(valor);
    else setHasta(valor);
  };

  const abrirDetalle = async (idAsiento: number) => {
    const solicitud = ++detalleSolicitudRef.current;
    setDetalleAbierto(true);
    setDetalleId(idAsiento);
    setDetalle(null);
    setErrorDetalle(null);
    setCargandoDetalle(true);
    try {
      const datos = await obtenerAsiento(idAsiento);
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
  // Un rango invertido suspende la consulta: se muestra el aviso del filtro en
  // lugar de los datos del último periodo válido (todo se deriva del estado).
  const errorMostrado = rangoInvalido
    ? "La fecha inicial no puede ser posterior a la fecha final."
    : error;
  const enCarga = (cargando || (cargandoCuentas && !codigo)) && !rangoInvalido;
  const sinCuenta = codigo
    ? null
    : (errorCuentas ??
      (cargandoCuentas
        ? null
        : "Selecciona una cuenta contable para ver su libro mayor."));
  const movimientos = libro?.totales.movimientos ?? 0;

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
                  <BookMarked className="w-7 h-7" />
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                      Libro mayor
                    </h1>
                    <p className="text-xs text-slate-500">
                      Movimientos de la cuenta seleccionada, en orden cronológico del
                      más antiguo al más reciente.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="bg-slate-100 px-2.5 py-1.5 rounded-lg">
                    <span className="tabular-nums font-semibold text-slate-900">
                      {movimientos}
                    </span>{" "}
                    movimiento{movimientos === 1 ? "" : "s"}
                    {codigo && hayFiltros && !rangoInvalido ? " en el periodo" : ""}
                  </span>
                </div>
              </div>
            </Card>

            {/* FILTROS Y TABLA */}
            <Card className="bg-white rounded-xl shadow-sm ring-0 p-6 flex flex-col gap-5">
              <FiltrosMayor
                cuentas={cuentas}
                codigo={codigo}
                desde={desde}
                hasta={hasta}
                cargandoCuentas={cargandoCuentas}
                hayFiltros={hayFiltros}
                rangoInvalido={rangoInvalido}
                errorCuentas={errorCuentas}
                onCodigo={setCodigo}
                onDesde={(valor) => cambiarPeriodo("desde", valor)}
                onHasta={(valor) => cambiarPeriodo("hasta", valor)}
                onLimpiar={limpiarFiltros}
              />

              <TablaMayor
                libro={libro}
                cargando={enCarga}
                error={errorMostrado}
                sinCuenta={sinCuenta}
                hayFiltros={hayFiltros}
                rangoInvalido={rangoInvalido}
                onAbrirDetalle={(idAsiento) => void abrirDetalle(idAsiento)}
                onReintentar={() => void cargarLibro()}
                onLimpiarFiltros={limpiarFiltros}
              />
            </Card>
          </div>
        </main>
      </div>

      {/* DETALLE DEL ASIENTO RELACIONADO (C13) */}
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

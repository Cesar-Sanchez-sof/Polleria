"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import Sidebar from "@/components/personalized/Sidebar";
import { Card } from "@/components/ui/card";

import { CuentaDialog } from "./CuentaDialog";
import { TablaCuentas, type FilaCuenta } from "./TablaCuentas";
import { ToolbarCuentas } from "./ToolbarCuentas";

import {
  actualizarCuenta,
  ErrorApi,
  listarCuentas,
  type CuentaContable,
} from "@/lib/services/cuentas.service";

/**
 * Pantalla de consulta y alta del plan contable.
 * La lógica de presentación vive en ./<Componente>Cuentas.tsx y el acceso a
 * datos en lib/services/cuentas.service.ts.
 */
export default function CuentasPage() {
  // ---------------------------------------------------------------------
  // Datos del plan contable
  // ---------------------------------------------------------------------
  const [cuentas, setCuentas] = useState<CuentaContable[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros (se aplican en cliente para no separar a una subcuenta de su padre)
  const [q, setQ] = useState<string>("");
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");
  const [estadoFiltro, setEstadoFiltro] = useState<string>("todos");

  // Ramas contraídas del árbol
  const [contraidas, setContraidas] = useState<Set<number>>(() => new Set());

  // Diálogo de alta / edición
  const [dialogAbierto, setDialogAbierto] = useState<boolean>(false);
  const [cuentaEditando, setCuentaEditando] = useState<CuentaContable | null>(null);
  const [padreInicial, setPadreInicial] = useState<CuentaContable | null>(null);

  // Cambio de estado (activar / desactivar) y avisos de error de acciones
  const [idEnAccion, setIdEnAccion] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const datos = await listarCuentas();
      setCuentas(datos);
    } catch (e) {
      setCuentas([]);
      setError(e instanceof Error ? e.message : "No se pudo cargar el plan contable.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    // Se difiere al siguiente tick para no invocar setState de forma síncrona
    // dentro del cuerpo del efecto (regla react-hooks/set-state-in-effect).
    const timer = setTimeout(() => {
      void cargar();
    }, 0);
    return () => clearTimeout(timer);
  }, [cargar]);

  // ---------------------------------------------------------------------
  // Árbol y filas visibles
  // ---------------------------------------------------------------------
  const arbol = useMemo(() => {
    const ids = new Set(cuentas.map((c) => c.id));
    const hijos = new Map<number, CuentaContable[]>();
    const raices: CuentaContable[] = [];
    const comparar = (a: CuentaContable, b: CuentaContable) =>
      a.codigo.localeCompare(b.codigo);

    for (const cuenta of cuentas) {
      if (cuenta.idPadre !== null && ids.has(cuenta.idPadre)) {
        const lista = hijos.get(cuenta.idPadre) ?? [];
        lista.push(cuenta);
        hijos.set(cuenta.idPadre, lista);
      } else {
        raices.push(cuenta);
      }
    }

    raices.sort(comparar);
    for (const lista of hijos.values()) lista.sort(comparar);
    return { hijos, raices };
  }, [cuentas]);

  const hayFiltros = q.trim() !== "" || tipoFiltro !== "todos" || estadoFiltro !== "todos";

  const filas = useMemo<FilaCuenta[]>(() => {
    const texto = q.trim().toLowerCase();

    const coincide = (cuenta: CuentaContable): boolean => {
      if (texto && !`${cuenta.codigo} ${cuenta.nombre} ${cuenta.tipo}`.toLowerCase().includes(texto)) {
        return false;
      }
      if (tipoFiltro !== "todos" && cuenta.tipo !== tipoFiltro) return false;
      if (estadoFiltro === "activas" && !cuenta.activo) return false;
      if (estadoFiltro === "inactivas" && cuenta.activo) return false;
      return true;
    };

    // Con filtros activos se muestra la cuenta y toda su ascendencia.
    const enRama = (cuenta: CuentaContable): boolean =>
      coincide(cuenta) || (arbol.hijos.get(cuenta.id) ?? []).some(enRama);

    const salida: FilaCuenta[] = [];
    const recorrer = (lista: CuentaContable[], profundidad: number) => {
      for (const cuenta of lista) {
        if (hayFiltros && !enRama(cuenta)) continue;
        const hijos = arbol.hijos.get(cuenta.id) ?? [];
        const contraida = !hayFiltros && contraidas.has(cuenta.id);
        salida.push({
          cuenta,
          profundidad,
          tieneHijos: hijos.length > 0,
          expandida: !contraida,
        });
        if (!contraida) recorrer(hijos, profundidad + 1);
      }
    };

    recorrer(arbol.raices, 0);
    return salida;
  }, [arbol, contraidas, estadoFiltro, hayFiltros, q, tipoFiltro]);

  // ---------------------------------------------------------------------
  // Acciones
  // ---------------------------------------------------------------------
  const alternarRama = (id: number) => {
    setContraidas((previo) => {
      const siguiente = new Set(previo);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  };

  const expandirTodo = () => setContraidas(new Set());
  const contraerTodo = () => setContraidas(new Set(arbol.hijos.keys()));

  const nuevaCuenta = () => {
    setCuentaEditando(null);
    setPadreInicial(null);
    setDialogAbierto(true);
  };

  const nuevaSubcuenta = (cuenta: CuentaContable) => {
    setCuentaEditando(null);
    setPadreInicial(cuenta);
    setDialogAbierto(true);
  };

  const editarCuenta = (cuenta: CuentaContable) => {
    setCuentaEditando(cuenta);
    setPadreInicial(null);
    setDialogAbierto(true);
  };

  const cerrarDialogo = () => {
    setDialogAbierto(false);
    setCuentaEditando(null);
    setPadreInicial(null);
  };

  const trasGuardar = () => {
    cerrarDialogo();
    void cargar();
  };

  /** Activa o desactiva la cuenta; el servidor explica por qué no puede. */
  const cambiarEstado = async (cuenta: CuentaContable) => {
    if (idEnAccion !== null) return;
    setIdEnAccion(cuenta.id);
    setAviso(null);
    try {
      await actualizarCuenta(cuenta.id, { activo: !cuenta.activo });
      await cargar();
    } catch (e) {
      setAviso(
        e instanceof ErrorApi
          ? e.message
          : e instanceof Error
            ? e.message
            : "No se pudo cambiar el estado de la cuenta."
      );
    } finally {
      setIdEnAccion(null);
    }
  };

  const limpiarFiltros = () => {
    setQ("");
    setTipoFiltro("todos");
    setEstadoFiltro("todos");
  };

  return (
    <>
      {/* Main content area */}
      <div className="pl-64 min-h-screen flex flex-col bg-(--color-background) w-full">
        {/* Main Content */}
        <main className="relative flex-1 p-6">
          <div className="flex flex-col w-full gap-5">
            {/* MAIN PLAN CONTABLE APPLICATION CARD */}
            <Card className="bg-white rounded-xl shadow-sm ring-0 p-6 flex flex-col gap-5">
              <ToolbarCuentas
                q={q}
                onBuscar={setQ}
                onLimpiarBusqueda={() => setQ("")}
                tipo={tipoFiltro}
                onTipo={setTipoFiltro}
                estado={estadoFiltro}
                onEstado={setEstadoFiltro}
                onNuevo={nuevaCuenta}
                visibles={filas.length}
                total={cuentas.length}
                cargando={cargando}
              />
            </Card>

            <Card className="bg-white rounded-xl shadow-sm ring-0 p-6 flex flex-col gap-5">
              {/* Aviso de una acción rechazada por el servidor */}
              {aviso && (
                <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                  <p className="flex items-start gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{aviso}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setAviso(null)}
                    className="text-amber-500 hover:text-amber-800 cursor-pointer shrink-0"
                    title="Descartar aviso"
                    aria-label="Descartar aviso"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <TablaCuentas
                filas={filas}
                cargando={cargando}
                error={error}
                hayFiltros={hayFiltros}
                idEnAccion={idEnAccion}
                onAlternarRama={alternarRama}
                onExpandirTodo={expandirTodo}
                onContraerTodo={contraerTodo}
                onEditar={editarCuenta}
                onNuevoHijo={nuevaSubcuenta}
                onCambiarEstado={(cuenta) => void cambiarEstado(cuenta)}
                onReintentar={() => void cargar()}
                onLimpiarFiltros={limpiarFiltros}
              />
            </Card>
          </div>
        </main>
      </div>

      {/* ALTA / EDICIÓN DE UNA CUENTA */}
      {dialogAbierto && (
        <CuentaDialog
          abierto={dialogAbierto}
          cuenta={cuentaEditando}
          padreInicial={padreInicial}
          cuentas={cuentas}
          onCerrar={cerrarDialogo}
          onGuardado={trasGuardar}
        />
      )}
    </>
  );
}

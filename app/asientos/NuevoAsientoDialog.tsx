"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ErrorApi,
  formatearMoneda,
  listarCuentasContables,
  obtenerSiguienteCodigo,
  registrarAsiento,
  type AsientoResumen,
  type CuentaContable,
  type OpcionDiario,
} from "@/lib/services/asientos.service";

const DIARIO_POR_DEFECTO = "Operaciones varias";
const LINEAS_INICIALES = 2;

/** Fecha local de hoy en YYYY-MM-DD, sin corrimiento por zona horaria. */
function hoy(): string {
  const fecha = new Date();
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

/** Importe escrito en un input: vacío o inválido = 0, redondeado a 2 decimales. */
function aImporte(valor: string): number {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return 0;
  return Math.round(numero * 100) / 100;
}

/** Fila del editor de partidas; `clave` es sólo un identificador para React. */
interface LineaForm {
  clave: number;
  idCuenta: string;
  descripcion: string;
  debe: string;
  haber: string;
}

function lineaVacia(clave: number): LineaForm {
  return { clave, idCuenta: "", descripcion: "", debe: "", haber: "" };
}

interface Props {
  abierto: boolean;
  /** Diarios contables existentes, ya cargados por la página. */
  diarios: OpcionDiario[];
  onCerrar: () => void;
  /** Se invoca con el asiento recién registrado (para refrescar el listado). */
  onCreado: (asiento: AsientoResumen) => void;
}

/** Diálogo para registrar un asiento contable manual con sus partidas. */
export function NuevoAsientoDialog({
  abierto,
  diarios,
  onCerrar,
  onCreado,
}: Readonly<Props>) {
  // Encabezado del asiento
  const [fecha, setFecha] = useState<string>(() => hoy());
  const [diario, setDiario] = useState<string>(DIARIO_POR_DEFECTO);
  const [glosa, setGlosa] = useState<string>("");
  const [responsable, setResponsable] = useState<string>("");
  const [observacion, setObservacion] = useState<string>("");

  // Partidas
  const [lineas, setLineas] = useState<LineaForm[]>(() =>
    Array.from({ length: LINEAS_INICIALES }, (_, i) => lineaVacia(i + 1))
  );
  const contadorClaves = useRef(LINEAS_INICIALES);

  // Datos de apoyo y estado del formulario
  const [cuentas, setCuentas] = useState<CuentaContable[]>([]);
  const [codigoSugerido, setCodigoSugerido] = useState<string>("");
  const [errores, setErrores] = useState<string[]>([]);
  const [guardando, setGuardando] = useState<boolean>(false);

  // Plan contable: se consulta una sola vez al montar el diálogo.
  useEffect(() => {
    let activo = true;
    listarCuentasContables()
      .then((datos) => {
        if (activo) setCuentas(datos);
      })
      .catch(() => {
        if (activo) setCuentas([]);
      });
    return () => {
      activo = false;
    };
  }, []);

  // Número sugerido para la fecha elegida (se vuelve a pedir si cambia).
  useEffect(() => {
    let activo = true;
    obtenerSiguienteCodigo(fecha)
      .then((codigo) => {
        if (activo) setCodigoSugerido(codigo);
      })
      .catch(() => {
        if (activo) setCodigoSugerido("");
      });
    return () => {
      activo = false;
    };
  }, [fecha]);

  const opcionesCuenta = useMemo(
    () =>
      cuentas.map((cuenta) => ({
        value: String(cuenta.id),
        label: `${cuenta.codigo} · ${cuenta.nombre}`,
      })),
    [cuentas]
  );

  const opcionesDiario = useMemo(() => {
    const nombres = Array.from(
      new Set([DIARIO_POR_DEFECTO, ...diarios.map((opcion) => opcion.nombre)])
    );
    return nombres.map((nombre) => ({ value: nombre, label: nombre }));
  }, [diarios]);

  const totales = lineas.reduce(
    (acumulado, linea) => ({
      debe: acumulado.debe + aImporte(linea.debe),
      haber: acumulado.haber + aImporte(linea.haber),
    }),
    { debe: 0, haber: 0 }
  );
  const totalDebe = Math.round(totales.debe * 100) / 100;
  const totalHaber = Math.round(totales.haber * 100) / 100;
  const cuadrado = Math.abs(totalDebe - totalHaber) < 0.005 && totalDebe > 0;

  /** Vuelve el formulario a su estado inicial. */
  const reiniciar = () => {
    contadorClaves.current = LINEAS_INICIALES;
    setFecha(hoy());
    setDiario(DIARIO_POR_DEFECTO);
    setGlosa("");
    setResponsable("");
    setObservacion("");
    setLineas(
      Array.from({ length: LINEAS_INICIALES }, (_, i) => lineaVacia(i + 1))
    );
    setErrores([]);
  };

  const manejarApertura = (open: boolean) => {
    if (open) return;
    reiniciar();
    onCerrar();
  };

  const actualizarLinea = (clave: number, cambios: Partial<LineaForm>) => {
    setLineas((previo) =>
      previo.map((linea) => (linea.clave === clave ? { ...linea, ...cambios } : linea))
    );
  };

  const agregarLinea = () => {
    contadorClaves.current += 1;
    const nueva = lineaVacia(contadorClaves.current);
    setLineas((previo) => [...previo, nueva]);
  };

  const quitarLinea = (clave: number) => {
    setLineas((previo) => (previo.length > 1 ? previo.filter((l) => l.clave !== clave) : previo));
  };

  /** Validaciones del cliente; el servidor vuelve a validar todo. */
  const validar = (): string[] => {
    const lista: string[] = [];

    if (!fecha) lista.push("Selecciona la fecha contable.");
    if (!glosa.trim()) lista.push("Escribe el concepto (glosa) del asiento.");
    if (!diario) lista.push("Selecciona el diario contable.");
    if (lineas.length < LINEAS_INICIALES) {
      lista.push("El asiento debe tener al menos dos líneas (debe y haber).");
    }

    lineas.forEach((linea, indice) => {
      const etiqueta = `Línea ${indice + 1}:`;
      if (!linea.idCuenta) lista.push(`${etiqueta} selecciona la cuenta contable.`);

      const debe = aImporte(linea.debe);
      const haber = aImporte(linea.haber);
      if (debe > 0 && haber > 0) {
        lista.push(`${etiqueta} no puede tener importe en debe y en haber a la vez.`);
      } else if (debe === 0 && haber === 0) {
        lista.push(`${etiqueta} indica el importe en el debe o en el haber.`);
      }
    });

    if (lista.length === 0 && !cuadrado) {
      lista.push(
        `El asiento debe cuadrar: debe ${formatearMoneda(totalDebe)} vs. haber ${formatearMoneda(totalHaber)}.`
      );
    }

    return lista;
  };

  const manejarEnvio = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (guardando) return;

    const validacion = validar();
    if (validacion.length > 0) {
      setErrores(validacion);
      return;
    }

    setErrores([]);
    setGuardando(true);
    try {
      const asiento = await registrarAsiento({
        fecha,
        diario,
        glosa: glosa.trim(),
        responsable: responsable.trim() || undefined,
        observacion: observacion.trim() || undefined,
        lineas: lineas.map((linea) => ({
          idCuenta: Number(linea.idCuenta),
          descripcion: linea.descripcion.trim() || undefined,
          debe: aImporte(linea.debe),
          haber: aImporte(linea.haber),
        })),
      });
      reiniciar();
      onCreado(asiento);
      onCerrar();
    } catch (error) {
      setErrores(
        error instanceof ErrorApi
          ? error.errores
          : [error instanceof Error ? error.message : "No se pudo registrar el asiento."]
      );
    } finally {
      setGuardando(false);
    }
  };

  const etiquetaCampo =
    "text-[11px] font-bold uppercase tracking-wider text-slate-500";
  const inputCampo =
    "h-9 w-full rounded-lg border-slate-200 bg-white text-xs shadow-none";

  return (
    <Dialog open={abierto} onOpenChange={manejarApertura}>
      <DialogContent className="sm:max-w-3xl max-h-[calc(100vh-4rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">
            Nuevo asiento contable
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Registra un asiento manual: completa el encabezado y las partidas de
            debe y haber. El número se asigna automáticamente.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={(e) => void manejarEnvio(e)}>
          {/* Encabezado del asiento */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="asiento-fecha" className={etiquetaCampo}>
                Fecha contable
              </label>
              <Input
                id="asiento-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={inputCampo}
                disabled={guardando}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label id="asiento-diario-label" htmlFor="asiento-diario" className={etiquetaCampo}>
                Diario
              </label>
              <Select
                id="asiento-diario"
                value={diario}
                items={opcionesDiario}
                onValueChange={(valor) => setDiario(valor ?? DIARIO_POR_DEFECTO)}
                disabled={guardando}
              >
                <SelectTrigger
                  className="w-full rounded-lg bg-white text-xs"
                  aria-labelledby="asiento-diario-label"
                >
                  <SelectValue placeholder="Seleccionar diario" />
                </SelectTrigger>
                <SelectContent>
                  {opcionesDiario.map((opcion) => (
                    <SelectItem key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="asiento-responsable" className={etiquetaCampo}>
                Responsable (opcional)
              </label>
              <Input
                id="asiento-responsable"
                type="text"
                maxLength={100}
                value={responsable}
                onChange={(e) => setResponsable(e.target.value)}
                className={inputCampo}
                disabled={guardando}
              />
            </div>

            <div className="flex flex-col gap-1 sm:col-span-2">
              <label htmlFor="asiento-glosa" className={etiquetaCampo}>
                Concepto (glosa)
              </label>
              <Input
                id="asiento-glosa"
                type="text"
                maxLength={200}
                placeholder="Ej. Ajuste por diferencia de caja del mes"
                value={glosa}
                onChange={(e) => setGlosa(e.target.value)}
                className={inputCampo}
                disabled={guardando}
              />
            </div>

            

            <div className="flex flex-col gap-1">
              <label htmlFor="asiento-observacion" className={etiquetaCampo}>
                Observación (opcional)
              </label>
              <Input
                id="asiento-observacion"
                type="text"
                maxLength={200}
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                className={inputCampo}
                disabled={guardando}
              />
            </div>
          </div>

          {/* Número que se asignará */}
          <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
            <span className={etiquetaCampo}>Número</span>
            <p className="text-xs text-slate-600 mt-1">
              Se genera automáticamente al registrar
              {codigoSugerido ? (
                <>
                  {" "}
                  · referencia{" "}
                  <span className="font-bold text-slate-900 tabular-nums">{codigoSugerido}</span>
                </>
              ) : null}
            </p>
          </div>

          {/* Partidas */}
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Líneas del asiento ({lineas.length})
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={agregarLinea}
              disabled={guardando}
              className="inline-flex items-center gap-1.5 rounded-lg border-slate-200 bg-white text-xs font-semibold shadow-none cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar línea
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <div className="min-w-176">
              <div className="grid grid-cols-[14rem_minmax(0,1fr)_8rem_8rem_2rem] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
                <span className={etiquetaCampo}>Cuenta contable</span>
                <span className={etiquetaCampo}>Descripción</span>
                <span className={`${etiquetaCampo} text-right`}>Debe (S/)</span>
                <span className={`${etiquetaCampo} text-right`}>Haber (S/)</span>
                <span aria-hidden="true"></span>
              </div>

              {lineas.map((linea, indice) => (
                <div
                  key={linea.clave}
                  className="grid grid-cols-[14rem_minmax(0,1fr)_8rem_8rem_2rem] items-center gap-2 border-b border-slate-100 px-3 py-2 last:border-b-0"
                >
                  <Select
                    value={linea.idCuenta}
                    items={opcionesCuenta}
                    onValueChange={(valor) =>
                      actualizarLinea(linea.clave, { idCuenta: valor ?? "" })
                    }
                    disabled={guardando}
                  >
                    <SelectTrigger
                      className="h-8 w-full rounded-lg bg-white text-xs"
                      aria-label={`Cuenta de la línea ${indice + 1}`}
                    >
                      <SelectValue placeholder="Seleccionar cuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      {opcionesCuenta.map((opcion) => (
                        <SelectItem  className="text-xs" key={opcion.value} value={opcion.value}>
                          {opcion.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    type="text"
                    maxLength={200}
                    placeholder="Detalle (opcional)"
                    aria-label={`Descripción de la línea ${indice + 1}`}
                    value={linea.descripcion}
                    onChange={(e) => actualizarLinea(linea.clave, { descripcion: e.target.value })}
                    className="h-8 rounded-lg border-slate-200 bg-white text-xs shadow-none"
                    disabled={guardando}
                  />

                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    aria-label={`Debe de la línea ${indice + 1}`}
                    value={linea.debe}
                    onChange={(e) =>
                      actualizarLinea(linea.clave, { debe: e.target.value, haber: "" })
                    }
                    className="h-8 rounded-lg border-slate-200 bg-white text-xs text-right tabular-nums shadow-none"
                    disabled={guardando}
                  />

                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    aria-label={`Haber de la línea ${indice + 1}`}
                    value={linea.haber}
                    onChange={(e) =>
                      actualizarLinea(linea.clave, { haber: e.target.value, debe: "" })
                    }
                    className="h-8 rounded-lg border-slate-200 bg-white text-xs text-right tabular-nums shadow-none"
                    disabled={guardando}
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="Quitar línea"
                    aria-label={`Quitar la línea ${indice + 1}`}
                    onClick={() => quitarLinea(linea.clave)}
                    disabled={guardando || lineas.length <= LINEAS_INICIALES}
                    className="h-8 w-8 text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {opcionesCuenta.length === 0 && (
            <p className="text-xs text-amber-700">
              No hay cuentas disponibles en el plan contable para registrar las líneas.
            </p>
          )}

          {/* Totales y cuadre */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-900 text-white px-4 py-3">
            <div className="flex items-center gap-5 text-xs">
              <span className="uppercase tracking-wider text-slate-400">
                Debe{" "}
                <b className="text-sm text-white tabular-nums ml-1">
                  {formatearMoneda(totalDebe)}
                </b>
              </span>
              <span className="uppercase tracking-wider text-slate-400">
                Haber{" "}
                <b className="text-sm text-white tabular-nums ml-1">
                  {formatearMoneda(totalHaber)}
                </b>
              </span>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                cuadrado ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  cuadrado ? "bg-emerald-400" : "bg-amber-400"
                }`}
              ></span>
              {cuadrado ? "Asiento cuadrado" : "Debe y haber deben coincidir"}
            </span>
          </div>

          {/* Validaciones del cliente y del servidor */}
          {errores.length > 0 && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
              <p className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Revisa lo siguiente para registrar el asiento
              </p>
              <ul className="list-disc pl-5 mt-1.5 space-y-0.5">
                {errores.map((error, indice) => (
                  <li key={`${indice}-${error}`}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => manejarApertura(false)}
              disabled={guardando}
              className="rounded-lg border-slate-200 bg-white text-xs font-semibold shadow-none"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={guardando || opcionesCuenta.length === 0}
              className="rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold shadow-none"
            >
              {guardando ? "Registrando..." : "Registrar asiento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

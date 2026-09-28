"use client";

import { useMemo, useState, type FormEvent } from "react";
import { AlertCircle, Info } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ErrorApi,
  registrarCuenta,
  actualizarCuenta,
  TIPOS_CUENTA,
  type CuentaContable,
} from "@/lib/services/cuentas.service";

/** Mismo formato que valida el servidor (`cuenta_contable.codigo` ≤ 10). */
const CODIGO_RE = /^[A-Za-z0-9.-]{1,10}$/;

/** Valor del selector que significa "cuenta raíz" (sin padre). */
const SIN_PADRE = "__raiz__";

interface Props {
  /** El diálogo sólo se monta cuando está abierto: el estado nace con él. */
  abierto: boolean;
  /** Cuenta en edición; `null` para dar de alta. */
  cuenta: CuentaContable | null;
  /** Cuenta padre preseleccionada desde el botón "añadir subcuenta". */
  padreInicial: CuentaContable | null;
  /** Plan completo, para elegir la cuenta padre. */
  cuentas: CuentaContable[];
  onCerrar: () => void;
  /** Se invoca con la cuenta guardada (para refrescar el listado). */
  onGuardado: (cuenta: CuentaContable) => void;
}

/**
 * Alta y edición de una cuenta contable.
 *
 * Al elegir una cuenta padre, el tipo se hereda de ésta (una jerarquía
 * siempre comparte el tipo) y sólo se habilita el campo para cuentas raíz.
 */
export function CuentaDialog({
  abierto,
  cuenta,
  padreInicial,
  cuentas,
  onCerrar,
  onGuardado,
}: Readonly<Props>) {
  const [codigo, setCodigo] = useState<string>(() => (cuenta ? cuenta.codigo : ""));
  const [nombre, setNombre] = useState<string>(() => (cuenta ? cuenta.nombre : ""));
  const [idPadre, setIdPadre] = useState<string>(() => {
    if (cuenta) return cuenta.idPadre === null ? SIN_PADRE : String(cuenta.idPadre);
    if (padreInicial) return String(padreInicial.id);
    return SIN_PADRE;
  });
  const [tipo, setTipo] = useState<string>(() => {
    if (cuenta) return cuenta.tipo;
    if (padreInicial) return padreInicial.tipo;
    return "";
  });
  const [activo, setActivo] = useState<boolean>(() => (cuenta ? cuenta.activo : true));
  const [errores, setErrores] = useState<string[]>([]);
  const [guardando, setGuardando] = useState<boolean>(false);

  const esEdicion = cuenta !== null;
  const idPadreNumerico = idPadre === SIN_PADRE ? null : Number(idPadre);
  // Con cuenta padre el tipo se hereda de la jerarquía y no se puede cambiar.
  const tipoHeredado = idPadreNumerico !== null;

  const cuentaPadre = useMemo(
    () => (idPadreNumerico === null ? null : (cuentas.find((c) => c.id === idPadreNumerico) ?? null)),
    [cuentas, idPadreNumerico]
  );

  /** La cuenta en edición y sus subcuentas no pueden ser su propio padre. */
  const excluidas = useMemo(() => {
    const excluidos = new Set<number>();
    if (!cuenta) return excluidos;
    excluidos.add(cuenta.id);
    let huboCambios = true;
    while (huboCambios) {
      huboCambios = false;
      for (const candidata of cuentas) {
        if (
          !excluidos.has(candidata.id) &&
          candidata.idPadre !== null &&
          excluidos.has(candidata.idPadre)
        ) {
          excluidos.add(candidata.id);
          huboCambios = true;
        }
      }
    }
    return excluidos;
  }, [cuenta, cuentas]);

  /** Cuentas que pueden ser padre: nunca inactivas salvo la actual. */
  const opcionesPadre = useMemo(
    () =>
      cuentas
        .filter((c) => !excluidas.has(c.id) && (c.activo || c.id === idPadreNumerico))
        .slice()
        .sort((a, b) => a.codigo.localeCompare(b.codigo)),
    [cuentas, excluidas, idPadreNumerico]
  );

  const opcionesTipo = useMemo(
    () => TIPOS_CUENTA.map((valor) => ({ value: valor as string, label: valor })),
    []
  );

  /** Al cambiar de padre se hereda el tipo de la nueva jerarquía. */
  const cambiarPadre = (valor: string | null) => {
    const nuevo = valor ?? SIN_PADRE;
    setIdPadre(nuevo);
    if (nuevo !== SIN_PADRE) {
      const padre = cuentas.find((c) => String(c.id) === nuevo);
      if (padre) setTipo(padre.tipo);
    }
  };

  /** Validaciones del cliente; el servidor vuelve a validar todo. */
  const validar = (): string[] => {
    const lista: string[] = [];
    const codigoLimpio = codigo.trim();
    const nombreLimpio = nombre.trim();

    if (!codigoLimpio) lista.push("Escribe el código de la cuenta.");
    else if (!CODIGO_RE.test(codigoLimpio)) {
      lista.push(
        "El código sólo puede tener hasta 10 caracteres con letras, números, punto o guion."
      );
    }

    if (!nombreLimpio) lista.push("Escribe el nombre de la cuenta.");
    else if (nombreLimpio.length > 100) {
      lista.push("El nombre de la cuenta no puede superar los 100 caracteres.");
    }

    if (!tipo) lista.push("Selecciona el tipo de cuenta.");

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
      const datos = {
        codigo: codigo.trim(),
        nombre: nombre.trim(),
        tipo,
        idPadre: idPadreNumerico,
        ...(esEdicion ? { activo } : {}),
      };
      const guardada = esEdicion
        ? await actualizarCuenta(cuenta.id, datos)
        : await registrarCuenta(datos);
      onGuardado(guardada);
    } catch (error) {
      setErrores(
        error instanceof ErrorApi
          ? error.errores
          : [error instanceof Error ? error.message : "No se pudo guardar la cuenta."]
      );
    } finally {
      setGuardando(false);
    }
  };

  const etiquetaCampo = "text-[11px] font-bold uppercase tracking-wider text-slate-500";
  const inputCampo = "h-9 w-full rounded-lg border-slate-200 bg-white text-xs shadow-none";

  return (
    <Dialog open={abierto} onOpenChange={(open) => (open ? undefined : onCerrar())}>
      <DialogContent className="sm:max-w-xl max-h-[calc(100vh-4rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">
            {esEdicion
              ? "Editar cuenta contable"
              : padreInicial
                ? `Nueva subcuenta de ${padreInicial.codigo}`
                : "Nueva cuenta contable"}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {esEdicion
              ? "Modifica los datos de la cuenta. Si cambias el tipo, éste se aplica también a sus subcuentas."
              : "El código es único en todo el plan contable. Una subcuenta hereda el tipo de su cuenta padre."}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={(e) => void manejarEnvio(e)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="cuenta-codigo" className={etiquetaCampo}>
                Código
              </label>
              <Input
                id="cuenta-codigo"
                type="text"
                maxLength={10}
                placeholder="Ej. 101"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                className={`${inputCampo} font-mono tabular-nums`}
                disabled={guardando}
                autoComplete="off"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label id="cuenta-tipo-label" htmlFor="cuenta-tipo" className={etiquetaCampo}>
                Tipo de cuenta
              </label>
              <Select
                id="cuenta-tipo"
                value={tipo}
                items={opcionesTipo}
                onValueChange={(valor) => setTipo(valor ?? "")}
                disabled={guardando || tipoHeredado}
              >
                <SelectTrigger
                  className="w-full rounded-lg bg-white text-xs"
                  aria-labelledby="cuenta-tipo-label"
                >
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {opcionesTipo.map((opcion) => (
                    <SelectItem key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1 sm:col-span-2">
              <label htmlFor="cuenta-nombre" className={etiquetaCampo}>
                Nombre de la cuenta
              </label>
              <Input
                id="cuenta-nombre"
                type="text"
                maxLength={100}
                placeholder="Ej. Caja"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className={inputCampo}
                disabled={guardando}
                autoComplete="off"
              />
            </div>

            <div className="flex flex-col gap-1 sm:col-span-2">
              <label id="cuenta-padre-label" htmlFor="cuenta-padre" className={etiquetaCampo}>
                Cuenta padre (subcuenta de)
              </label>
              <Select
                id="cuenta-padre"
                value={idPadre}
                items={[
                  { value: SIN_PADRE, label: "Ninguna · es una cuenta raíz" },
                  ...opcionesPadre.map((c) => ({
                    value: String(c.id),
                    label: `${c.codigo} · ${c.nombre}${c.activo ? "" : " (inactiva)"}`,
                  })),
                ]}
                onValueChange={cambiarPadre}
                disabled={guardando}
              >
                <SelectTrigger
                  className="w-full rounded-lg bg-white text-xs"
                  aria-labelledby="cuenta-padre-label"
                >
                  <SelectValue placeholder="Seleccionar cuenta padre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_PADRE}>Ninguna · es una cuenta raíz</SelectItem>
                  {opcionesPadre.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.codigo} · {c.nombre}
                      {c.activo ? "" : " (inactiva)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tipoHeredado && (
                <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  El tipo se hereda de{" "}
                  <b className="text-slate-700">{cuentaPadre?.codigo ?? "la cuenta padre"}</b>.
                </p>
              )}
            </div>
          </div>

          {/* Estado de la cuenta (sólo al editar; el alta siempre es activa) */}
          {esEdicion && (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-slate-800">Cuenta activa</span>
                <span className="text-[11px] text-slate-500">
                  {activo
                    ? "Disponible para registrar asientos contables."
                    : "Oculta para registrar asientos; los asientos existentes la conservan."}
                </span>
              </div>
              <Switch
                checked={activo}
                onCheckedChange={(valor) => setActivo(!!valor)}
                disabled={guardando}
                aria-label="Estado activo de la cuenta"
              />
            </div>
          )}

          {/* Uso actual de la cuenta */}
          {esEdicion && cuenta.usos > 0 && (
            <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
              <span className={etiquetaCampo}>Uso actual</span>
              <p className="text-xs text-slate-600 mt-1">
                La cuenta está en{" "}
                <b className="text-slate-900 tabular-nums">
                  {cuenta.usos} línea{cuenta.usos === 1 ? "" : "s"}
                </b>{" "}
                de asiento{cuenta.usos === 1 ? "" : "s"}. Su historial no se modifica.
              </p>
            </div>
          )}

          {/* Validaciones del cliente y del servidor */}
          {errores.length > 0 && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
              <p className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Revisa lo siguiente para guardar la cuenta
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
              onClick={onCerrar}
              disabled={guardando}
              className="rounded-lg border-slate-200 bg-white text-xs font-semibold shadow-none"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={guardando}
              className="rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold shadow-none"
            >
              {guardando
                ? "Guardando..."
                : esEdicion
                  ? "Guardar cambios"
                  : "Registrar cuenta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

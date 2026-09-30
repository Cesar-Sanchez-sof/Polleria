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
  ApiError,
  formatCurrency,
  listAccountingAccounts,
  getNextJournalEntryCode,
  registerJournalEntry,
  type JournalEntrySummary,
  type AccountingAccount,
  type JournalBookOption,
} from "@/lib/services/asientos.service";

const DEFAULT_BOOK = "Operaciones varias";
const INITIAL_LINE_COUNT = 2;

/** Today's local date in YYYY-MM-DD format. */
function getTodayIsoDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Parses numeric string to 2-decimal rounded amount. */
function parseAmount(value: string): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100) / 100;
}

interface FormLine {
  key: number;
  accountId: string;
  description: string;
  debit: string;
  credit: string;
}

function createEmptyLine(key: number): FormLine {
  return { key, accountId: "", description: "", debit: "", credit: "" };
}

interface NewJournalEntryDialogProps {
  abierto: boolean;
  diarios: JournalBookOption[];
  onCerrar: () => void;
  onCreado: (asiento: JournalEntrySummary) => void;
}

export function NewJournalEntryDialog({
  abierto,
  diarios,
  onCerrar,
  onCreado,
}: Readonly<NewJournalEntryDialogProps>) {
  const [entryDate, setEntryDate] = useState<string>(() => getTodayIsoDate());
  const [book, setBook] = useState<string>(DEFAULT_BOOK);
  const [description, setDescription] = useState<string>("");
  const [responsible, setResponsible] = useState<string>("");
  const [observation, setObservation] = useState<string>("");

  const [lines, setLines] = useState<FormLine[]>(() =>
    Array.from({ length: INITIAL_LINE_COUNT }, (_, i) => createEmptyLine(i + 1))
  );
  const lineKeyCounter = useRef(INITIAL_LINE_COUNT);

  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [suggestedCode, setSuggestedCode] = useState<string>("");
  const [errors, setErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    let isActive = true;
    listAccountingAccounts()
      .then((data) => {
        if (isActive) setAccounts(data);
      })
      .catch(() => {
        if (isActive) setAccounts([]);
      });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    getNextJournalEntryCode(entryDate)
      .then((code) => {
        if (isActive) setSuggestedCode(code);
      })
      .catch(() => {
        if (isActive) setSuggestedCode("");
      });
    return () => {
      isActive = false;
    };
  }, [entryDate]);

  const accountOptions = useMemo(
    () =>
      accounts.map((acc) => ({
        value: String(acc.id),
        label: `${acc.codigo} · ${acc.nombre}`,
      })),
    [accounts]
  );

  const bookOptions = useMemo(() => {
    const bookNames = Array.from(
      new Set([DEFAULT_BOOK, ...diarios.map((d) => d.nombre)])
    );
    return bookNames.map((name) => ({ value: name, label: name }));
  }, [diarios]);

  const totals = lines.reduce(
    (acc, line) => ({
      debit: acc.debit + parseAmount(line.debit),
      credit: acc.credit + parseAmount(line.credit),
    }),
    { debit: 0, credit: 0 }
  );
  const totalDebit = Math.round(totals.debit * 100) / 100;
  const totalCredit = Math.round(totals.credit * 100) / 100;
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0;

  const resetForm = () => {
    lineKeyCounter.current = INITIAL_LINE_COUNT;
    setEntryDate(getTodayIsoDate());
    setBook(DEFAULT_BOOK);
    setDescription("");
    setResponsible("");
    setObservation("");
    setLines(Array.from({ length: INITIAL_LINE_COUNT }, (_, i) => createEmptyLine(i + 1)));
    setErrors([]);
  };

  const handleOpenChange = (open: boolean) => {
    if (open) return;
    resetForm();
    onCerrar();
  };

  const updateLine = (key: number, changes: Partial<FormLine>) => {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...changes } : line))
    );
  };

  const addLine = () => {
    lineKeyCounter.current += 1;
    const newLine = createEmptyLine(lineKeyCounter.current);
    setLines((prev) => [...prev, newLine]);
  };

  const removeLine = (key: number) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  };

  const validate = (): string[] => {
    const list: string[] = [];

    if (!entryDate) list.push("Selecciona la fecha contable.");
    if (!description.trim()) list.push("Escribe el concepto (glosa) del asiento.");
    if (!book) list.push("Selecciona el diario contable.");
    if (lines.length < INITIAL_LINE_COUNT) {
      list.push("El asiento debe tener al menos dos líneas (debe y haber).");
    }

    lines.forEach((line, index) => {
      const lineLabel = `Línea ${index + 1}:`;
      if (!line.accountId) list.push(`${lineLabel} selecciona la cuenta contable.`);

      const debit = parseAmount(line.debit);
      const credit = parseAmount(line.credit);
      if (debit > 0 && credit > 0) {
        list.push(`${lineLabel} no puede tener importe en debe y en haber a la vez.`);
      } else if (debit === 0 && credit === 0) {
        list.push(`${lineLabel} indica el importe en el debe o en el haber.`);
      }
    });

    if (list.length === 0 && !isBalanced) {
      list.push(
        `El asiento debe cuadrar: debe ${formatCurrency(totalDebit)} vs. haber ${formatCurrency(totalCredit)}.`
      );
    }

    return list;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;

    const validationErrors = validate();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    setIsSaving(true);
    try {
      const createdEntry = await registerJournalEntry({
        fecha: entryDate,
        diario: book,
        glosa: description.trim(),
        responsable: responsible.trim() || undefined,
        observacion: observation.trim() || undefined,
        lineas: lines.map((line) => ({
          idCuenta: Number(line.accountId),
          descripcion: line.description.trim() || undefined,
          debe: parseAmount(line.debit),
          haber: parseAmount(line.credit),
        })),
      });
      resetForm();
      onCreado(createdEntry);
      onCerrar();
    } catch (err) {
      setErrors(
        err instanceof ApiError
          ? err.errors
          : [err instanceof Error ? err.message : "No se pudo registrar el asiento."]
      );
    } finally {
      setIsSaving(false);
    }
  };

  const labelClasses = "text-[11px] font-bold uppercase tracking-wider text-slate-500";
  const inputClasses = "h-9 w-full rounded-lg border-slate-200 bg-white text-xs shadow-none";

  return (
    <Dialog open={abierto} onOpenChange={handleOpenChange}>
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

        <form className="flex flex-col gap-4" onSubmit={(e) => void handleSubmit(e)}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="asiento-fecha" className={labelClasses}>
                Fecha contable
              </label>
              <Input
                id="asiento-fecha"
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className={inputClasses}
                disabled={isSaving}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label id="asiento-diario-label" htmlFor="asiento-diario" className={labelClasses}>
                Diario
              </label>
              <Select
                id="asiento-diario"
                value={book}
                items={bookOptions}
                onValueChange={(val) => setBook(val ?? DEFAULT_BOOK)}
                disabled={isSaving}
              >
                <SelectTrigger
                  className="w-full rounded-lg bg-white text-xs"
                  aria-labelledby="asiento-diario-label"
                >
                  <SelectValue placeholder="Seleccionar diario" />
                </SelectTrigger>
                <SelectContent>
                  {bookOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="asiento-responsable" className={labelClasses}>
                Responsable (opcional)
              </label>
              <Input
                id="asiento-responsable"
                type="text"
                maxLength={100}
                value={responsible}
                onChange={(e) => setResponsible(e.target.value)}
                className={inputClasses}
                disabled={isSaving}
              />
            </div>

            <div className="flex flex-col gap-1 sm:col-span-2">
              <label htmlFor="asiento-glosa" className={labelClasses}>
                Concepto (glosa)
              </label>
              <Input
                id="asiento-glosa"
                type="text"
                maxLength={200}
                placeholder="Ej. Ajuste por diferencia de caja del mes"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputClasses}
                disabled={isSaving}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="asiento-observacion" className={labelClasses}>
                Observación (opcional)
              </label>
              <Input
                id="asiento-observacion"
                type="text"
                maxLength={200}
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                className={inputClasses}
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
            <span className={labelClasses}>Número</span>
            <p className="text-xs text-slate-600 mt-1">
              Se genera automáticamente al registrar
              {suggestedCode ? (
                <>
                  {" "}
                  · referencia{" "}
                  <span className="font-bold text-slate-900 tabular-nums">{suggestedCode}</span>
                </>
              ) : null}
            </p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Líneas del asiento ({lines.length})
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLine}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-lg border-slate-200 bg-white text-xs font-semibold shadow-none cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar línea
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <div className="min-w-176">
              <div className="grid grid-cols-[14rem_minmax(0,1fr)_8rem_8rem_2rem] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
                <span className={labelClasses}>Cuenta contable</span>
                <span className={labelClasses}>Descripción</span>
                <span className={`${labelClasses} text-right`}>Debe (S/)</span>
                <span className={`${labelClasses} text-right`}>Haber (S/)</span>
                <span aria-hidden="true"></span>
              </div>

              {lines.map((line, index) => (
                <div
                  key={line.key}
                  className="grid grid-cols-[14rem_minmax(0,1fr)_8rem_8rem_2rem] items-center gap-2 border-b border-slate-100 px-3 py-2 last:border-b-0"
                >
                  <Select
                    value={line.accountId}
                    items={accountOptions}
                    onValueChange={(val) =>
                      updateLine(line.key, { accountId: val ?? "" })
                    }
                    disabled={isSaving}
                  >
                    <SelectTrigger
                      className="h-8 w-full rounded-lg bg-white text-xs"
                      aria-label={`Cuenta de la línea ${index + 1}`}
                    >
                      <SelectValue placeholder="Seleccionar cuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      {accountOptions.map((opt) => (
                        <SelectItem className="text-xs" key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    type="text"
                    maxLength={200}
                    placeholder="Detalle (opcional)"
                    aria-label={`Descripción de la línea ${index + 1}`}
                    value={line.description}
                    onChange={(e) => updateLine(line.key, { description: e.target.value })}
                    className="h-8 rounded-lg border-slate-200 bg-white text-xs shadow-none"
                    disabled={isSaving}
                  />

                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    aria-label={`Debe de la línea ${index + 1}`}
                    value={line.debit}
                    onChange={(e) =>
                      updateLine(line.key, { debit: e.target.value, credit: "" })
                    }
                    className="h-8 rounded-lg border-slate-200 bg-white text-xs text-right tabular-nums shadow-none"
                    disabled={isSaving}
                  />

                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    aria-label={`Haber de la línea ${index + 1}`}
                    value={line.credit}
                    onChange={(e) =>
                      updateLine(line.key, { credit: e.target.value, debit: "" })
                    }
                    className="h-8 rounded-lg border-slate-200 bg-white text-xs text-right tabular-nums shadow-none"
                    disabled={isSaving}
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="Quitar línea"
                    aria-label={`Quitar la línea ${index + 1}`}
                    onClick={() => removeLine(line.key)}
                    disabled={isSaving || lines.length <= INITIAL_LINE_COUNT}
                    className="h-8 w-8 text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {accountOptions.length === 0 && (
            <p className="text-xs text-amber-700">
              No hay cuentas disponibles en el plan contable para registrar las líneas.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-900 text-white px-4 py-3">
            <div className="flex items-center gap-5 text-xs">
              <span className="uppercase tracking-wider text-slate-400">
                Debe{" "}
                <b className="text-sm text-white tabular-nums ml-1">
                  {formatCurrency(totalDebit)}
                </b>
              </span>
              <span className="uppercase tracking-wider text-slate-400">
                Haber{" "}
                <b className="text-sm text-white tabular-nums ml-1">
                  {formatCurrency(totalCredit)}
                </b>
              </span>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${isBalanced ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
                }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${isBalanced ? "bg-emerald-400" : "bg-amber-400"
                  }`}
              ></span>
              {isBalanced ? "Asiento cuadrado" : "Debe y haber deben coincidir"}
            </span>
          </div>

          {errors.length > 0 && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
              <p className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Revisa lo siguiente para registrar el asiento
              </p>
              <ul className="list-disc pl-5 mt-1.5 space-y-0.5">
                {errors.map((err, idx) => (
                  <li key={`${idx}-${err}`}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSaving}
              className="rounded-lg border-slate-200 bg-white text-xs font-semibold shadow-none"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving || accountOptions.length === 0}
              className="rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold shadow-none"
            >
              {isSaving ? "Registrando..." : "Registrar asiento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

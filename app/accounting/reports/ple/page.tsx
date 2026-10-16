"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, BookOpenCheck, Download, FileText, FlaskConical, Loader2, Sheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { BOOK_FORMATS, type PleBookId } from "@/lib/ple/constants";
import {
  downloadPle,
  getPlePreview,
  simulateSireTest,
  type PleDownloadFormat,
  type PlePreview,
  type SireTestResult,
} from "@/lib/services/ple-client.service";

interface BookEntry {
  id?: PleBookId;
  format: string;
  label: string;
  description: string;
}

const BOOKS: readonly BookEntry[] = [
  { id: "sales-register", format: "14.1", label: "Registro de Ventas", description: "Registro de Ventas e Ingresos" },
  { id: "purchases-register", format: "8.1", label: "Registro de Compras", description: "Compras con y sin derecho a crédito fiscal" },
  { id: "cash-book", format: "1.1", label: "Libro Caja y Bancos - efectivo", description: "Movimientos de las cuentas 101 a 103" },
  { id: "general-journal", format: "5.1", label: "Libro Diario", description: "Todos los asientos del mes" },
  { id: "chart-of-accounts", format: "5.3", label: "Detalle del Plan Contable", description: "Cuentas utilizadas en el Diario" },
  { id: "general-ledger", format: "6.1", label: "Libro Mayor", description: "Movimientos agrupados por cuenta" },
];

/** Formats of the SUNAT catalog whose layout is not implemented yet (shown disabled). */
const PENDING_BOOKS: readonly BookEntry[] = [
  { format: "1.2", label: "Libro Caja y Bancos - cuenta corriente", description: "Movimientos de las cuentas corrientes" },
  { format: "4.1", label: "Libro de Retenciones (inc. e y f, art. 34 LIR)", description: "Retenciones de rentas de quinta categoría" },
  { format: "5.2", label: "Libro Diario Simplificado", description: "Diario en formato simplificado" },
  { format: "3.17", label: "Estado de Situación Financiera", description: "Balance de situación financiera" },
  { format: "3.1", label: "Estado de Situación Financiera - PCGE 2019 (comparativo)", description: "Formato comparativo PCGE 2019" },
  { format: "3.20", label: "Estado de Resultados - PCGE 2019 (comparativo)", description: "Formato 3.20 comparativo PCGE 2019" },
  { format: "13.1", label: "Registro de Inventario Permanente Valorizado", description: "Inventario permanente valorizado" },
];

const ALL_BOOKS = [...BOOKS, ...PENDING_BOOKS].sort((a, b) =>
  a.label.localeCompare(b.label, "es")
);

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatTotal(value: number): string {
  return value.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Electronic books (SUNAT / PCGE): picks year and month, validates a book and downloads its
 * PLE TXT. The file is only delivered when the validation has no errors.
 */
export default function PleBooksPage() {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [active, setActive] = useState<PleBookId | null>(null);
  const [preview, setPreview] = useState<PlePreview | null>(null);
  const [loading, setLoading] = useState<PleBookId | null>(null);
  const [downloading, setDownloading] = useState<PleDownloadFormat | null>(null);
  const [testingSire, setTestingSire] = useState(false);
  const [sireTest, setSireTest] = useState<SireTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const years = useMemo(() => {
    const current = now.getFullYear();
    return Array.from({ length: 6 }, (_, index) => current - index);
  }, [now]);

  const validate = async (book: PleBookId) => {
    setActive(book);
    setLoading(book);
    setError(null);
    setPreview(null);
    setSireTest(null);
    try {
      setPreview(await getPlePreview(book, year, month));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo validar el libro.");
    } finally {
      setLoading(null);
    }
  };

  const testSire = async () => {
    if (active !== "sales-register" && active !== "purchases-register") return;
    setTestingSire(true);
    setError(null);
    try {
      const result = await simulateSireTest(active, year, month);
      setSireTest(result);
      if (result.status === "validated") {
        toast.success(`Prueba local ${result.register} validada.`);
      } else {
        toast.error(`Prueba local ${result.register} rechazada por validaciones.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la prueba local de SIRE.");
    } finally {
      setTestingSire(false);
    }
  };

  const download = async (format: PleDownloadFormat) => {
    if (!active) return;
    setDownloading(format);
    try {
      const fileName = await downloadPle(active, year, month, format);
      toast.success(`Archivo ${fileName} descargado.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo descargar el archivo.");
    } finally {
      setDownloading(null);
    }
  };

  const errors = preview?.issues.filter((issue) => issue.severity === "error") ?? [];
  const warnings = preview?.issues.filter((issue) => issue.severity === "warning") ?? [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <ModuleHeader
        title="Libros Contables (SUNAT / PCGE)"
        subtitle=""
        icon={BookOpenCheck}
        iconClassName="bg-blue-100 text-blue-700"
      >
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Año
              <select
                value={year}
                onChange={(e) => {
                  setYear(Number(e.target.value));
                  setPreview(null);
                  setSireTest(null);
                }}
                className="h-8 w-auto rounded-lg border border-slate-200 bg-white px-2 text-sm font-normal normal-case text-slate-800"
              >
                {years.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Mes
              <select
                value={month}
                onChange={(e) => {
                  setMonth(Number(e.target.value));
                  setPreview(null);
                  setSireTest(null);
                }}
                className="h-8 w-auto rounded-lg border border-slate-200 bg-white px-2 text-sm font-normal normal-case text-slate-800"
              >
                {MONTHS.map((name, index) => (
                  <option key={name} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
      </ModuleHeader>

      <main className="w-full space-y-4 p-4 sm:p-6">
        <Card className="space-y-2 p-3">
          <p className="text-xs text-slate-500">
            Genera los archivos TXT del Programa de Libros Electrónicos (PLE) con la estructura de
            SUNAT. Primero se valida el libro; el archivo solo se descarga si no hay errores.
          </p>
        </Card>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ALL_BOOKS.map((book) => {
            const bookId = book.id;
            const available = bookId !== undefined;
            return (
            <Card
              key={book.format}
              className={`flex min-h-28 items-center justify-between gap-3 p-4 ${
                active === bookId ? "border-blue-200 bg-blue-50/60 dark:bg-slate-800/60" : ""
              } ${available ? "" : "opacity-60"}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <FileText className={`h-4 w-4 shrink-0 ${available ? "text-slate-400" : "text-slate-300"}`} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                    {book.label}
                  </p>
                  <p className="truncate text-xs text-slate-500">{book.description}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!available || loading !== null}
                onClick={available ? () => validate(bookId) : undefined}
                title={available ? undefined : "Disponible próximamente"}
                aria-label={available ? `Validar y generar PLE ${BOOK_FORMATS[bookId]}` : undefined}
              >
                {available && loading === bookId ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  `PLE ${book.format}`
                )}
              </Button>
            </Card>
          );
          })}
        </div>

        {error && (
          <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</Card>
        )}

        {preview && (
          <Card className="space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-slate-500">Archivo</p>
                <p className="break-all font-mono text-sm text-slate-800 dark:text-slate-100">
                  {preview.fileName || "—"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {preview.recordCount} registro(s)
                  {Object.entries(preview.totals).map(([name, value]) => (
                    <span key={name}>
                      {" · "}
                      {name}: {formatTotal(value)}
                    </span>
                  ))}
                </p>
              </div>
              <div className="flex gap-2">
                {(active === "sales-register" || active === "purchases-register") && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button variant="outline" onClick={testSire} disabled={testingSire || downloading !== null} />
                        }
                      >
                        {testingSire ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <FlaskConical className="mr-2 h-4 w-4" />
                        )}
                        Probar SIRE
                      </TooltipTrigger>
                      <TooltipContent side="bottom" align="end" className="max-w-sm flex-col items-start gap-1.5 p-3 text-xs leading-snug">
                        <p className="font-semibold">Prueba local de SIRE (no envía nada a SUNAT)</p>
                        <ul className="list-disc space-y-1 pl-4">
                          <li>
                            Toma el libro que estás viendo y su periodo: el Registro de Ventas (RVIE) o el de Compras (RCE),
                            con los mismos datos y validaciones del PLE.
                          </li>
                          <li>Revisa cada registro y reporta los errores y advertencias que SUNAT rechazaría.</li>
                          <li>
                            Devuelve un ticket de prueba (LOCAL-RVIE/RCE-AAAAMM-OK o -ERR), la cantidad de registros, los
                            totales y si la validación fue aprobada o rechazada.
                          </li>
                          <li>
                            Es 100 % local: no se comunica con SUNAT, no usa credenciales ni guarda nada, y no descarga
                            ningún archivo.
                          </li>
                          <li>Requiere el RUC de 11 dígitos configurado en los datos del restaurante.</li>
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <Button
                  variant="outline"
                  onClick={() => download("csv")}
                  disabled={downloading !== null}
                  title="Copia de revisión para Excel (no es un archivo SUNAT)"
                >
                  {downloading === "csv" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sheet className="mr-2 h-4 w-4" />
                  )}
                  Descargar CSV
                </Button>
                <Button
                  onClick={() => download("txt")}
                  disabled={preview.hasErrors || downloading !== null}
                  title={preview.hasErrors ? "Corrige los errores para descargar el TXT" : undefined}
                >
                  {downloading === "txt" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Descargar TXT
                </Button>
              </div>
            </div>

            {errors.length === 0 && warnings.length === 0 && (
              <p className="text-sm text-emerald-700">Sin observaciones: el libro está listo.</p>
            )}

            {errors.length > 0 && (
              <IssueList title="Errores (bloquean la descarga)" tone="error" issues={errors} />
            )}
            {warnings.length > 0 && (
              <IssueList title="Advertencias" tone="warning" issues={warnings} />
            )}

            <PreviewTable preview={preview} />

            {sireTest && <SireTestCard result={sireTest} />}
          </Card>
        )}
      </main>
    </div>
  );
}

function SireTestCard({ result }: Readonly<{ result: SireTestResult }>) {
  const accepted = result.status === "validated";
  return (
    <div className={`rounded-lg border p-3 text-sm ${accepted ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
      <p className={accepted ? "font-semibold text-emerald-800" : "font-semibold text-red-800"}>
        SIRE {result.register}: {accepted ? "validación local aprobada" : "prueba local rechazada"}
      </p>
      <p className="mt-1 text-xs text-slate-600">
        Ticket {result.ticket} · {result.recordCount} registro(s) · periodo {result.period}.
      </p>
      <p className="mt-1 text-xs text-slate-600">
        Entorno local de prueba: no se enviaron datos ni se usaron credenciales de SUNAT.
      </p>
    </div>
  );
}

function IssueList({
  title,
  tone,
  issues,
}: Readonly<{ title: string; tone: "error" | "warning"; issues: PlePreview["issues"] }>) {
  const color = tone === "error" ? "text-red-700" : "text-amber-700";
  return (
    <div>
      <p className={`mb-1 flex items-center gap-1 text-sm font-semibold ${color}`}>
        <AlertTriangle className="h-4 w-4" />
        {title} ({issues.length})
      </p>
      <ul className="max-h-64 space-y-1 overflow-auto text-xs text-slate-700 dark:text-slate-300">
        {issues.map((issue, index) => (
          <li key={`${issue.record}-${issue.field ?? 0}-${index}`}>
            <span className="font-mono">{issue.record}</span>
            {issue.field ? ` (campo ${issue.field})` : ""}: {issue.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Read-only table with every column of the SUNAT structure, to review before downloading. */
function PreviewTable({ preview }: Readonly<{ preview: PlePreview }>) {
  if (preview.rows.length === 0) {
    return <p className="text-sm text-slate-500">El libro no tiene registros en este periodo.</p>;
  }
  return (
    <div>
      <div className="max-h-[28rem] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-max min-w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
            <tr>
              <th className="border-b border-slate-200 px-2 py-1.5 text-right font-semibold text-slate-500">
                #
              </th>
              {preview.columns.map((column) => (
                <th
                  key={column.index}
                  className="whitespace-nowrap border-b border-l border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-600 dark:text-slate-300"
                  title={`Campo ${column.index}`}
                >
                  {column.index}. {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="odd:bg-white even:bg-slate-50/60 dark:odd:bg-transparent">
                <td className="px-2 py-1 text-right text-slate-400">{rowIndex + 1}</td>
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="whitespace-nowrap border-l border-slate-100 px-2 py-1 font-mono text-slate-800 dark:text-slate-200"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {preview.truncated && (
        <p className="mt-1 text-xs text-slate-500">
          Se muestran las primeras {preview.rows.length} de {preview.recordCount} filas; los
          archivos descargados incluyen todas.
        </p>
      )}
    </div>
  );
}

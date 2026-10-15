"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, BookOpenCheck, Download, FileText, Loader2, Sheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { BOOK_FORMATS, type PleBookId } from "@/lib/ple/constants";
import {
  downloadPle,
  getPlePreview,
  type PleDownloadFormat,
  type PlePreview,
} from "@/lib/services/ple-client.service";

interface BookEntry {
  id: PleBookId;
  label: string;
  description: string;
}

const BOOKS: readonly BookEntry[] = [
  { id: "sales-register", label: "Registro de Ventas", description: "Registro de Ventas e Ingresos" },
  { id: "purchases-register", label: "Registro de Compras", description: "Compras con y sin derecho a crédito fiscal" },
  { id: "cash-book", label: "Libro Caja y Bancos - efectivo", description: "Movimientos de las cuentas 101 a 103" },
  { id: "general-journal", label: "Libro Diario", description: "Todos los asientos del mes" },
  { id: "chart-of-accounts", label: "Detalle del Plan Contable", description: "Cuentas utilizadas en el Diario" },
  { id: "general-ledger", label: "Libro Mayor", description: "Movimientos agrupados por cuenta" },
];

/** Formats of the SUNAT catalog whose layout is not implemented yet (shown disabled). */
const PENDING_BOOKS: readonly { format: string; label: string; description: string }[] = [
  { format: "1.2", label: "Libro Caja y Bancos - cuenta corriente", description: "Movimientos de las cuentas corrientes" },
  { format: "4.1", label: "Libro de Retenciones (inc. e y f, art. 34 LIR)", description: "Retenciones de rentas de quinta categoría" },
  { format: "5.2", label: "Libro Diario Simplificado", description: "Diario en formato simplificado" },
  { format: "3.17", label: "Estado de Situación Financiera", description: "Balance de situación financiera" },
  { format: "3.1", label: "Estado de Situación Financiera - PCGE 2019 (comparativo)", description: "Formato comparativo PCGE 2019" },
  { format: "3.20", label: "Estado de Resultados - PCGE 2019 (comparativo)", description: "Formato 3.20 comparativo PCGE 2019" },
  { format: "13.1", label: "Registro de Inventario Permanente Valorizado", description: "Inventario permanente valorizado" },
];

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
    try {
      setPreview(await getPlePreview(book, year, month));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo validar el libro.");
    } finally {
      setLoading(null);
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

        <Card className="gap-0 divide-y divide-slate-100 p-0 dark:divide-slate-800">
          {BOOKS.map((book) => (
            <div
              key={book.id}
              className={`flex items-center justify-between gap-3 px-5 py-4 ${
                active === book.id ? "bg-blue-50/60 dark:bg-slate-800/60" : ""
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="h-4 w-4 shrink-0 text-slate-400" />
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
                disabled={loading !== null}
                onClick={() => validate(book.id)}
                aria-label={`Validar y generar PLE ${BOOK_FORMATS[book.id]}`}
              >
                {loading === book.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  `PLE ${BOOK_FORMATS[book.id]}`
                )}
              </Button>
            </div>
          ))}
          {PENDING_BOOKS.map((book) => (
            <div key={book.format} className="flex items-center justify-between gap-3 px-5 py-4 opacity-60">
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="h-4 w-4 shrink-0 text-slate-300" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                    {book.label}
                  </p>
                  <p className="truncate text-xs text-slate-500">{book.description}</p>
                </div>
              </div>
              <Button size="sm" variant="outline" disabled title="Disponible próximamente">
                PLE {book.format}
              </Button>
            </div>
          ))}
        </Card>

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
          </Card>
        )}
      </main>
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

"use client"

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AlertTriangle, FileSearch, Info, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { getPurchasesWithoutVoucher } from "@/lib/services/purchases-client.service";
import {
  consultSirePurchases,
  type SireOutcome,
  type SirePurchaseDocument,
} from "@/lib/services/sire-purchases-client.service";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Each request waits up to ~40 s for SUNAT; while the file is still being generated we ask again a few times. */
const MAX_ATTEMPTS = 3;

type Ready = Extract<SireOutcome, { status: "ready" }>;
type Kind = "facturas-boletas" | "todos";

const money = (value: number): string =>
  value.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** `2026-10-05` -> `05/10/2026`; any other format is shown as received. */
function showDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

const fieldClass = "h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm";

/**
 * SIRE - Comprobantes de compras: lists the invoices and receipts that SUNAT has registered as purchases of the
 * company for a month. Read-only. The SOL / SUNAT API credentials live only in this page's memory and are sent
 * once per query; the server never stores or logs them.
 */
export default function SirePurchasesPage() {
  const now = useMemo(() => new Date(), []);
  const [ruc, setRuc] = useState("");
  const [solUser, setSolUser] = useState("");
  const [solPassword, setSolPassword] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [pendingTicket, setPendingTicket] = useState<string | null>(null);
  const [result, setResult] = useState<Ready | null>(null);
  const [localPurchases, setLocalPurchases] = useState<any[]>([]);
  const [reconciliation, setReconciliation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("facturas-boletas");
  const [search, setSearch] = useState("");
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    // Load saved purchases without voucher on mount
    const fetchLocal = async () => {
      try {
        const data = await getPurchasesWithoutVoucher();
        setLocalPurchases(data);
      } catch (e) {
        console.error('Error loading local purchases', e);
      }
    };
    fetchLocal();
  }, []);

  const reconcile = () => {
    if (!result) return;
    // Simple reconciliation: match by supplierDocument and number/series
    const sireMap = new Map<string, SirePurchaseDocument>();
    result.documents.forEach((doc) => {
      const key = `${doc.supplierDocument}-${doc.series}-${doc.number}`;
      sireMap.set(key, doc);
    });
    const unmatchedLocal = localPurchases.filter((p) => {
      const key = `${p.supplierDocument}-${p.series}-${p.number}`;
      return !sireMap.has(key);
    });
    const unmatchedSire = result.documents.filter((doc) => {
      const key = `${doc.supplierDocument}-${doc.series}-${doc.number}`;
      return !localPurchases.some((p) => `${p.supplierDocument}-${p.series}-${p.number}` === key);
    });
    const summary = `Local sin coincidencia: ${unmatchedLocal.length}, SIRE sin coincidencia: ${unmatchedSire.length}`;
    setReconciliation(summary);
    toast.info(summary);
  };

  // Existing clearResult function updated above


  const years = useMemo(() => Array.from({ length: 6 }, (_, index) => now.getFullYear() - index), [now]);
  const clearResult = () => {
    setResult(null);
    setPendingTicket(null);
    setError(null);
    // reset reconciliation when clearing
    setReconciliation(null);
  };

  const consult = async (event: FormEvent) => {
    event.preventDefault();
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setLoading(true);
    setError(null);
    setResult(null);
    let ticket = pendingTicket ?? undefined;
    try {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        setProgress(attempt === 1 && !ticket ? "Consultando a SUNAT..." : "SUNAT sigue generando el archivo...");
        const outcome = await consultSirePurchases(
          { ruc, usuarioSol: solUser, claveSol: solPassword, clientId, clientSecret, anio: year, mes: month, ticket },
          abort.signal
        );
        if (outcome.status === "ready") {
          setPendingTicket(null);
          setResult(outcome);
          toast.success(`${outcome.documentCount} comprobante(s) de compra encontrados.`);
          return;
        }
        ticket = outcome.ticket;
        setPendingTicket(outcome.ticket);
      }
      setError("SUNAT aún no termina de generar el archivo. Pulsa «Consultar» de nuevo en unos minutos para continuar con el mismo ticket.");
    } catch (e) {
      if (abort.signal.aborted) return;
      setError(e instanceof Error ? e.message : "No se pudo consultar SUNAT.");
    } finally {
      if (controller.current === abort) {
        setLoading(false);
        setProgress(null);
      }
    }
  };

  const documents = useMemo<SirePurchaseDocument[]>(() => {
    if (!result) return [];
    const needle = search.trim().toLowerCase();
    return result.documents.filter((doc) => {
      if (kind === "facturas-boletas" && doc.typeCode !== "01" && doc.typeCode !== "03") return false;
      if (!needle) return true;
      return [doc.supplierName, doc.supplierDocument, doc.series, doc.number].some((value) => value.toLowerCase().includes(needle));
    });
  }, [result, kind, search]);

  const complete = ruc.length === 11 && solUser && solPassword && clientId && clientSecret;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <ModuleHeader
        title="SIRE · Comprobantes de compras"
        subtitle="Facturas y boletas de compra que figuran en SUNAT"
        icon={FileSearch}
        iconClassName="bg-blue-100 text-blue-700"
      />

      <main className="w-full space-y-4 p-4 sm:p-6">
        <Card className="space-y-3 p-4">
          <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <p>
              Solo <strong>consulta</strong>: no envía ni modifica nada en SUNAT. Tus credenciales se usan únicamente en
              esta consulta; no se guardan ni se registran. Si SUNAT rechaza las credenciales, espera antes de reintentar:
              varios intentos fallidos pueden bloquear la clave SOL.
            </p>
          </div>
          <div className="flex items-start gap-2 text-xs text-slate-500">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              El <strong>Client ID</strong> y el <strong>Client Secret</strong> se generan en SUNAT Operaciones en Línea
              (SOL) → Empresas → Credenciales de API SUNAT. Además del RUC y la clave SOL, SUNAT exige el usuario SOL.
            </p>
          </div>

          <form onSubmit={consult} autoComplete="off" className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="sire-ruc">RUC</Label>
              <Input id="sire-ruc" inputMode="numeric" maxLength={11} placeholder="20123456789" value={ruc}
                onChange={(e) => { setRuc(e.target.value.replace(/\D/g, "")); clearResult(); }} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sire-user">Usuario SOL</Label>
              <Input id="sire-user" maxLength={20} value={solUser} onChange={(e) => { setSolUser(e.target.value); clearResult(); }}
                autoComplete="off" autoCapitalize="characters" spellCheck={false} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sire-password">Clave SOL</Label>
              <Input id="sire-password" type="password" maxLength={64} value={solPassword}
                onChange={(e) => { setSolPassword(e.target.value); clearResult(); }} autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sire-client-id">Client ID (API SUNAT)</Label>
              <Input id="sire-client-id" maxLength={64} value={clientId} onChange={(e) => { setClientId(e.target.value); clearResult(); }}
                autoComplete="off" spellCheck={false} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sire-client-secret">Client Secret (API SUNAT)</Label>
              <Input id="sire-client-secret" type="password" maxLength={128} value={clientSecret}
                onChange={(e) => { setClientSecret(e.target.value); clearResult(); }} autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sire-year">Periodo</Label>
              <div className="flex gap-2">
                <select id="sire-month" aria-label="Mes" value={month} className={fieldClass}
                  onChange={(e) => { setMonth(Number(e.target.value)); clearResult(); }}>
                  {MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
                </select>
                <select id="sire-year" aria-label="Año" value={year} className={fieldClass}
                  onChange={(e) => { setYear(Number(e.target.value)); clearResult(); }}>
                  {years.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 md:col-span-2 xl:col-span-3">
              <Button type="submit" disabled={loading || !complete}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
                {pendingTicket ? "Continuar consulta" : "Consultar en SUNAT"}
              </Button>
              {progress && <span className="text-xs text-slate-500">{progress}</span>}
              {result && (
                <>
                  <Button type="button" disabled={!result} onClick={reconcile}>Conciliar</Button>
                  {reconciliation && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{reconciliation}</p>}
                </>
              )}
            </div>

          </form>
        </Card>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {result && (
          <Card className="space-y-3 p-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {result.totals.map((row) => (
                <div key={row.currency} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {row.currency} · {row.count} comprobante(s)
                  </p>
                  <p className="mt-1 text-lg font-semibold">{money(row.total)}</p>
                  <p className="text-xs text-slate-500">Base {money(row.taxableBase)} · IGV {money(row.igv)}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select aria-label="Tipo de comprobante" value={kind} onChange={(e) => setKind(e.target.value as Kind)}
                className={`${fieldClass} w-auto`}>
                <option value="facturas-boletas">Facturas y boletas</option>
                <option value="todos">Todos los comprobantes</option>
              </select>
              <Input aria-label="Buscar" placeholder="Buscar proveedor, RUC, serie o número" value={search}
                onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
              <span className="text-xs text-slate-500">
                {documents.length} de {result.documentCount} · {MONTHS[month - 1]} {year}
              </span>
            </div>

            {result.truncated && (
              <p className="text-xs text-amber-700">
                Se muestran los primeros {result.documents.length} comprobantes de {result.documentCount}.
              </p>
            )}

            {documents.length === 0 ? (
              <p className="text-sm text-slate-500">No hay comprobantes con ese filtro en el periodo.</p>
            ) : (
              <div className="max-h-[32rem] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-max min-w-full border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
                    <tr>
                      {["Emisión", "Tipo", "Serie-Número", "RUC / Doc.", "Proveedor", "Mon.", "Base", "IGV", "Total"].map((label, index) => (
                        <th key={label}
                          className={`whitespace-nowrap border-b border-slate-200 px-2 py-1.5 font-semibold text-slate-600 dark:text-slate-300 ${index >= 6 ? "text-right" : "text-left"}`}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc, index) => (
                      <tr key={`${doc.car || `${doc.series}-${doc.number}`}-${index}`} className="odd:bg-white even:bg-slate-50/60 dark:odd:bg-transparent">
                        <td className="whitespace-nowrap px-2 py-1">{showDate(doc.issueDate)}</td>
                        <td className="whitespace-nowrap px-2 py-1">{doc.typeName}</td>
                        <td className="whitespace-nowrap px-2 py-1 font-mono">{doc.series}-{doc.number}</td>
                        <td className="whitespace-nowrap px-2 py-1 font-mono">{doc.supplierDocument}</td>
                        <td className="px-2 py-1">{doc.supplierName}</td>
                        <td className="px-2 py-1">{doc.currency}</td>
                        <td className="whitespace-nowrap px-2 py-1 text-right font-mono">{money(doc.taxableBase)}</td>
                        <td className="whitespace-nowrap px-2 py-1 text-right font-mono">{money(doc.igv)}</td>
                        <td className="whitespace-nowrap px-2 py-1 text-right font-mono font-semibold">{money(doc.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}

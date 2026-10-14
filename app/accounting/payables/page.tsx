"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { HandCoins, AlertCircle, Loader2 } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { PayablesKpis } from "./components/PayablesKpis";
import { PayablesTable } from "./components/PayablesTable";
import {
  getAccountingPayables,
  type PayableInvoice,
  type PayablesSummary,
} from "@/lib/services/accounting-payables.service";

/**
 * Cuentas por Pagar (Cta. 42 - Acreedores comerciales).
 *
 * Los datos llegan del server action `getAccountingPayables`
 * (lib/services/accounting-payables.service), que arma la cartera de
 * comprobantes de compra con sus amortizaciones y asientos vinculados.
 */
export default function PayablesPage() {
  const [invoices, setInvoices] = useState<PayableInvoice[]>([]);
  const [summary, setSummary] = useState<PayablesSummary | null>(null);
  const [paymentTypes, setPaymentTypes] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Sólo la última petición puede escribir estado.
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getAccountingPayables();
      if (request !== requestRef.current) return;
      setInvoices(data.invoices);
      setSummary(data.summary);
      setPaymentTypes(data.paymentTypes);
    } catch (e) {
      if (request !== requestRef.current) return;
      setInvoices([]);
      setSummary(null);
      setError(
        e instanceof Error ? e.message : "No se pudo cargar la cartera de cuentas por pagar."
      );
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Se difiere al siguiente tick para no invocar setState de forma síncrona
    // dentro del cuerpo del efecto (regla react-hooks/set-state-in-effect).
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <>
      <ModuleHeader
        title="Cuentas por Pagar"
        subtitle="Cartera de acreedores comerciales (Cta. 42), amortizaciones y pagos."
        icon={HandCoins}
        iconClassName="bg-amber-100 text-amber-700"
      >
        {summary && (
          <span className="bg-slate-100 px-2.5 py-1.5 rounded-lg text-xs text-slate-500">
            Deuda pendiente:{" "}
            <span className="font-semibold text-slate-900 font-mono">
              S/{" "}
              {summary.totalPendingDebt.toLocaleString("es-PE", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </span>
        )}
      </ModuleHeader>

      <main className="relative flex-1 w-full min-w-0 p-3 sm:p-4 md:p-6">
        <div className="flex flex-col w-full gap-5">
          {error && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800">
              <p className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </p>
              <button
                type="button"
                onClick={() => void load()}
                className="font-semibold text-rose-600 hover:text-rose-800 cursor-pointer shrink-0"
              >
                Reintentar
              </button>
            </div>
          )}

          {loading ? (
            <Card className="bg-white rounded-xl shadow-sm ring-0 p-10 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm">Cargando cartera de cuentas por pagar...</p>
            </Card>
          ) : (
            <>
              {summary && <PayablesKpis summary={summary} />}
              <PayablesTable
                invoices={invoices}
                paymentTypes={paymentTypes}
                onRefresh={() => void load()}
              />
            </>
          )}
        </div>
      </main>
    </>
  );
}

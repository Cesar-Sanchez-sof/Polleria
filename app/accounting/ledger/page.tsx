"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { BookMarked } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";

import { JournalEntryDetail } from "../entries/components/JournalEntryDetail";
import { LedgerFilters } from "./components/LedgerFilters";
import { LedgerTable } from "./components/LedgerTable";
import {
  listAccountingAccounts,
  getJournalEntry,
  getGeneralLedger,
  type JournalEntryDetail as EntryDetailData,
  type AccountingAccount,
  type GeneralLedger,
} from "@/lib/services/general-ledger.service";

/**
 * Pantalla del Libro mayor: movimientos de una cuenta contable en orden
 * cronológico (del más antiguo al más reciente) con su saldo corriente,
 * consultables por cuenta (C01) y periodo de fechas (C09).
 *
 * La lógica de presentación vive en ./components/Ledger*.tsx y el acceso a
 * datos en lib/services/mayor.service.ts.
 */
export default function GeneralLedgerPage() {
  // ---------------------------------------------------------------------
  // Plan contable disponible para la selección de cuenta (C01)
  // ---------------------------------------------------------------------
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState<boolean>(true);
  const [accountsError, setAccountsError] = useState<string | null>(null);

  // ---------------------------------------------------------------------
  // Cuenta seleccionada y periodo consultado (C01, C09)
  // ---------------------------------------------------------------------
  const [code, setCode] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  // Datos del libro mayor
  const [ledger, setLedger] = useState<GeneralLedger | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Detalle del asiento relacionado (C13)
  const [detailOpen, setDetailOpen] = useState<boolean>(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<EntryDetailData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  // Control de carreras: sólo la última petición puede escribir estado
  const requestRef = useRef(0);
  const detailRequestRef = useRef(0);

  const invalidRange = Boolean(from && to && from > to);
  const hasFilters = Boolean(from) || Boolean(to);

  // Plan contable: se carga una sola vez y se selecciona la primera cuenta
  useEffect(() => {
    // Se difiere al siguiente tick para no invocar setState de forma síncrona
    // dentro del cuerpo del efecto (regla react-hooks/set-state-in-effect).
    const timer = setTimeout(async () => {
      try {
        const data = await listAccountingAccounts();
        setAccounts(data);
        setCode((current) => current || data[0]?.codigo || "");
      } catch (e) {
        setAccountsError(
          e instanceof Error ? e.message : "No se pudo cargar el plan contable."
        );
      } finally {
        setLoadingAccounts(false);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Libro mayor: se reconsulta cuando cambia la cuenta o el periodo
  const loadLedger = useCallback(async () => {
    if (!code) {
      // Sin cuenta seleccionada no hay nada que consultar todavía.
      setLedger(null);
      setError(null);
      setLoading(false);
      return;
    }
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getGeneralLedger({ codigo: code, desde: from, hasta: to });
      if (request !== requestRef.current) return;
      setLedger(data);
    } catch (e) {
      if (request !== requestRef.current) return;
      setLedger(null);
      setError(e instanceof Error ? e.message : "No se pudo cargar el libro mayor.");
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [code, from, to]);

  useEffect(() => {
    // Un rango invertido no se consulta: el aviso lo deriva el propio estado.
    // Si cambia la cuenta o el periodo, el cleanup cancela el disparo pendiente.
    if (invalidRange) return;
    const timer = setTimeout(() => {
      void loadLedger();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadLedger, invalidRange]);

  // ---------------------------------------------------------------------
  // Acciones
  // ---------------------------------------------------------------------
  const clearFilters = () => {
    setFrom("");
    setTo("");
  };

  const changePeriod = (field: "from" | "to", value: string) => {
    if (field === "from") setFrom(value);
    else setTo(value);
  };

  const openDetail = async (entryId: number) => {
    const request = ++detailRequestRef.current;
    setDetailOpen(true);
    setDetailId(entryId);
    setDetail(null);
    setErrorDetail(null);
    setLoadingDetail(true);
    try {
      const data = await getJournalEntry(entryId);
      if (request !== detailRequestRef.current) return;
      setDetail(data);
    } catch (e) {
      if (request !== detailRequestRef.current) return;
      setErrorDetail(
        e instanceof Error ? e.message : "No se pudo cargar el detalle del asiento."
      );
    } finally {
      if (request === detailRequestRef.current) setLoadingDetail(false);
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailId(null);
    setDetail(null);
    setErrorDetail(null);
  };

  const retryDetail = () => {
    if (detailId !== null) void openDetail(detailId);
  };

  // ---------------------------------------------------------------------
  // Datos derivados
  // ---------------------------------------------------------------------
  // Un rango invertido suspende la consulta: se muestra el aviso del filtro en
  // lugar de los datos del último periodo válido (todo se deriva del estado).
  const displayedError = invalidRange
    ? "La fecha inicial no puede ser posterior a la fecha final."
    : error;
  const isLoading = (loading || (loadingAccounts && !code)) && !invalidRange;
  const noAccountMessage = code
    ? null
    : (accountsError ??
      (loadingAccounts
        ? null
        : "Selecciona una cuenta contable para ver su libro mayor."));
  const movementCount = ledger?.totales.movimientos ?? 0;

  return (
    <>
      {/* Main content area */}
      <ModuleHeader
        title="Libro mayor"
        subtitle="Movimientos de la cuenta seleccionada, en orden cronológico del más antiguo al más reciente."
        icon={BookMarked}
        iconClassName="bg-red-100 text-red-700"
      >
        <span className="bg-slate-100 px-2.5 py-1.5 rounded-lg text-xs text-slate-500">
          <span className="tabular-nums font-semibold text-slate-900">
            {movementCount}
          </span>{" "}
          movimiento{movementCount === 1 ? "" : "s"}
          {code && hasFilters && !invalidRange ? " en el periodo" : ""}
        </span>
      </ModuleHeader>
      {/* Main Content */}
      <main className="relative flex-1 w-full min-w-0 p-3 sm:p-4 md:p-6">
        <div className="flex flex-col w-full gap-5">
          {/* FILTROS Y TABLA */}
          <Card className="bg-white rounded-xl shadow-sm ring-0 p-6 flex flex-col gap-5">
            <LedgerFilters
              accounts={accounts}
              code={code}
              from={from}
              to={to}
              loadingAccounts={loadingAccounts}
              hasFilters={hasFilters}
              invalidRange={invalidRange}
              accountsError={accountsError}
              onCode={setCode}
              onFrom={(value) => changePeriod("from", value)}
              onTo={(value) => changePeriod("to", value)}
              onClear={clearFilters}
            />

            <LedgerTable
              ledger={ledger}
              loading={isLoading}
              error={displayedError}
              noAccountMessage={noAccountMessage}
              hasFilters={hasFilters}
              invalidRange={invalidRange}
              onOpenDetail={(entryId) => void openDetail(entryId)}
              onRetry={() => void loadLedger()}
              onClearFilters={clearFilters}
            />
          </Card>
        </div>
      </main>

      {/* DETALLE DEL ASIENTO RELACIONADO (C13) */}
      <JournalEntryDetail
        open={detailOpen}
        detail={detail}
        loading={loadingDetail}
        error={errorDetail}
        onClose={closeDetail}
        onRetry={retryDetail}
      />
    </>
  );
}

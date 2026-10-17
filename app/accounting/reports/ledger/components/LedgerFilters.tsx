"use client";

import { FunnelX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Typeahead } from "@/components/shared/Typeahead";
import type { AccountingAccount } from "@/lib/services/general-ledger.service";

interface Props {
  accounts: AccountingAccount[];
  /** Código de la cuenta contable seleccionada (vacío = sin selección). */
  code: string;
  from: string;
  to: string;
  loadingAccounts: boolean;
  /** `true` cuando hay un periodo aplicado. */
  hasFilters: boolean;
  onCode: (value: string) => void;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  onClear: () => void;
}

/**
 * Filtros del libro mayor: selección de la cuenta contable (C01) y periodo de
 * fechas (C09), ambas inclusive. El `max`/`min` de cada input impide elegir un
 * rango invertido desde el navegador.
 */
export function LedgerFilters({
  accounts,
  code,
  from,
  to,
  loadingAccounts,
  hasFilters,
  onCode,
  onFrom,
  onTo,
  onClear,
}: Readonly<Props>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
       <label htmlFor="ledger-from" className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Cuenta
        </label>
      <Typeahead
        items={accounts.map((account) => ({
          value: account.code,
          label: account.name,
          prefix: <span className="font-bold tabular-nums text-red-700">{account.code}</span>,
        }))}
        value={code}
        onValueChange={(value) => {
          if (value) onCode(value);
        }}
        clearable={false}
        disabled={loadingAccounts}
        placeholder="Cuenta contable"
        ariaLabel="Cuenta contable"
        className="w-80"
      />

      <div className="flex flex-row items-center gap-2">
        <label htmlFor="ledger-from" className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          De
        </label>
        <Input
          id="ledger-from"
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => onFrom(e.target.value)}
          aria-label="Fecha inicial del periodo"
          title="Sin fechas se muestran todos los movimientos de la cuenta."
          className="h-9 w-36 rounded-lg border-slate-200 bg-white text-xs shadow-none"
        />
        <label htmlFor="ledger-to" className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          A
        </label>
        <Input
          id="ledger-to"
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => onTo(e.target.value)}
          aria-label="Fecha final del periodo"
          title="Sin fechas se muestran todos los movimientos de la cuenta."
          className="h-9 w-36 rounded-lg border-slate-200 bg-white text-xs shadow-none"
        />
      </div>

      <Button
        variant="outline"
        type="button"
        onClick={onClear}
        disabled={!hasFilters}
        title="Limpiar filtros"
        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border-slate-200 bg-red-800 px-3 py-2 text-xs font-semibold text-white shadow-none hover:bg-red-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <FunnelX className="h-5 w-5" />
      </Button>
    </div>
  );
}

/** Avisos de los filtros del libro mayor (rango invertido o error al cargar el plan contable). */
export function LedgerFilterMessages({
  invalidRange,
  accountsError,
}: Readonly<{ invalidRange: boolean; accountsError: string | null }>) {
  if (!invalidRange && !accountsError) return null;
  return (
    <div className="flex flex-col gap-2">
      {invalidRange && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
          La fecha inicial no puede ser posterior a la fecha final.
        </p>
      )}
      {accountsError && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          {accountsError}
        </p>
      )}
    </div>
  );
}

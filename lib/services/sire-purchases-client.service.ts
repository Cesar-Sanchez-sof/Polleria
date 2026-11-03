/**
 * Frontend service for the SIRE purchase-voucher query (`/api/sire/purchases`).
 * The credentials only travel in the request body and are never stored by this module.
 */
import { ApiError, fetchJson } from "./http";
import type { SireOutcome } from "@/lib/sire/purchases";

export { ApiError };
export type { SireOutcome, SirePurchaseDocument, SireCurrencyTotal } from "@/lib/sire/purchases";

export interface SirePurchasesInput {
  ruc: string;
  usuarioSol: string;
  claveSol: string;
  clientId: string;
  clientSecret: string;
  anio: number;
  mes: number;
  /** Ticket of a previous request that SUNAT was still processing. */
  ticket?: string;
}

export function consultSirePurchases(input: SirePurchasesInput, signal?: AbortSignal): Promise<SireOutcome> {
  return fetchJson<SireOutcome>("/api/sire/purchases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
    signal,
  });
}

import { generatePleBook } from "@/lib/ple/generate";
import type { PleBookId } from "@/lib/ple/constants";
import type { PleIssue, PleTotals } from "@/lib/ple/types";
import type { PleSnapshot } from "@/lib/ple/snapshot";

export type SireTestBook = Extract<PleBookId, "sales-register" | "purchases-register">;

export interface SireTestSubmission {
  environment: "local-test";
  register: "RVIE" | "RCE";
  period: string;
  ticket: string;
  status: "validated" | "rejected";
  recordCount: number;
  totals: PleTotals;
  issues: PleIssue[];
  /** The generated PLE has been transformed into a local SIRE test payload only. */
  payload: { fileName: string; content: string };
}

export function isSireTestBook(book: string): book is SireTestBook {
  return book === "sales-register" || book === "purchases-register";
}

/**
 * Validates the existing canonical PLE records as a SIRE test submission.
 * This is intentionally offline: it does not call SUNAT, persist a payload, or use credentials.
 */
export function simulateSireSubmission(
  book: SireTestBook,
  snapshot: PleSnapshot
): SireTestSubmission {
  const result = generatePleBook(book, snapshot);
  const period = `${snapshot.period.year}${String(snapshot.period.month).padStart(2, "0")}`;
  const register = book === "sales-register" ? "RVIE" : "RCE";
  const status = result.hasErrors ? "rejected" : "validated";

  return {
    environment: "local-test",
    register,
    period,
    ticket: `LOCAL-${register}-${period}-${status === "validated" ? "OK" : "ERR"}`,
    status,
    recordCount: result.recordCount,
    totals: result.totals,
    issues: result.issues,
    payload: { fileName: result.fileName, content: result.content },
  };
}

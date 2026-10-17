/**
 * Frontend service for the SUNAT electronic books (PLE): preview and TXT download
 * through `/api/ple/[book]`.
 */
import { ApiError, getJson } from "./http";
import type { PleBookId } from "@/lib/ple/constants";
import type { PleColumn, PleIssue, PleTotals } from "@/lib/ple/types";

export { ApiError };

export interface PlePreview {
  book: PleBookId;
  fileName: string;
  recordCount: number;
  columns: PleColumn[];
  rows: string[][];
  /** True when the preview shows only the first rows. */
  truncated: boolean;
  totals: PleTotals;
  issues: PleIssue[];
  hasErrors: boolean;
}

export type PleDownloadFormat = "txt" | "csv";

export interface SireTestResult {
  environment: "local-test";
  register: "RVIE" | "RCE";
  period: string;
  ticket: string;
  status: "validated" | "rejected";
  recordCount: number;
  totals: PleTotals;
  issues: PleIssue[];
}

function buildUrl(
  book: PleBookId,
  year: number,
  month: number,
  mode: "preview" | "download",
  format: PleDownloadFormat = "txt"
) {
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
    mode,
    format,
  });
  return `/api/ple/${book}?${params.toString()}`;
}

export async function getPlePreview(
  book: PleBookId,
  year: number,
  month: number
): Promise<PlePreview> {
  return getJson<PlePreview>(buildUrl(book, year, month, "preview"));
}

/** Runs the offline RVIE/RCE validation simulator. It never contacts SUNAT. */
export async function simulateSireTest(
  book: Extract<PleBookId, "sales-register" | "purchases-register">,
  year: number,
  month: number
): Promise<SireTestResult> {
  const response = await fetch(`/api/sire/test/${book}`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ year, month }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(body?.error ?? "No se pudo completar la prueba local de SIRE.");
  }
  return response.json() as Promise<SireTestResult>;
}

/** Downloads the TXT (or the CSV review copy) and triggers the browser save dialog. Returns the file name. */
export async function downloadPle(
  book: PleBookId,
  year: number,
  month: number,
  format: PleDownloadFormat = "txt"
): Promise<string> {
  const response = await fetch(buildUrl(book, year, month, "download", format), { cache: "no-store" });
  if (!response.ok) {
    let message = "The file could not be generated.";
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* body was not JSON */
    }
    throw new ApiError(message);
  }

  const disposition = response.headers.get("Content-Disposition") ?? "";
  const fileName = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? `${book}.TXT`;
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return fileName;
}

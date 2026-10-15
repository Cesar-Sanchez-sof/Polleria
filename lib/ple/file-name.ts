import {
  BOOK_CODES,
  CURRENCY_INDICATOR,
  GENERATED_BY_INDICATOR,
  OPERATIONS_INDICATOR,
  type PleBookId,
} from "./constants";

export interface FileNameInput {
  book: PleBookId;
  ruc: string;
  year: number;
  month: number;
  /** True when the book has at least one record. */
  hasContent: boolean;
  /** Defaults to "operating company". */
  operations?: string;
  /** "1" soles (default) or "2" US dollars. */
  currency?: string;
}

/**
 * Builds the 33-character PLE file name plus ".TXT":
 * LE + RUC(11) + YYYY + MM + DD("00") + book(6) + opportunity("00") +
 * operations(1) + content(1) + currency(1) + generatedBy(1).
 */
export function buildPleFileName(input: FileNameInput): string {
  if (!/^\d{11}$/.test(input.ruc)) {
    throw new Error("RUC must have exactly 11 digits.");
  }
  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100) {
    throw new Error("Year is out of range.");
  }
  if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12) {
    throw new Error("Month must be between 1 and 12.");
  }

  return [
    "LE",
    input.ruc,
    String(input.year),
    String(input.month).padStart(2, "0"),
    "00",
    BOOK_CODES[input.book],
    "00",
    input.operations ?? OPERATIONS_INDICATOR.operating,
    input.hasContent ? "1" : "0",
    input.currency ?? CURRENCY_INDICATOR.pen,
    GENERATED_BY_INDICATOR,
    ".TXT",
  ].join("");
}

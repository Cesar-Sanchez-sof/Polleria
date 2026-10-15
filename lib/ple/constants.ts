/**
 * Constants of the SUNAT electronic books program (PLE / SLE-PLE).
 *
 * Sources: RS 286-2009/SUNAT (Annex 2) and amendments, RS 361-2015/SUNAT,
 * RS 042-2021/SUNAT and RS 112-2021/SUNAT. See specs/039-ple-sunat-generation/research.md.
 * Values flagged "to validate" must be checked against the SUNAT PLE validator.
 */

export type PleBookId =
  | "sales-register"
  | "purchases-register"
  | "general-journal"
  | "chart-of-accounts"
  | "general-ledger"
  | "cash-book";

/** Six-digit book codes used in the file name (positions 22-27). */
export const BOOK_CODES: Record<PleBookId, string> = {
  "sales-register": "140100", // format 14.1
  "purchases-register": "080100", // format 8.1
  "general-journal": "050100", // format 5.1 (to validate)
  "chart-of-accounts": "050300", // format 5.3 (to validate)
  "general-ledger": "060100", // format 6.1 (to validate)
  "cash-book": "010100", // format 1.1 (to validate)
};

/** Official SUNAT format number of every book (used in the UI). */
export const BOOK_FORMATS: Record<PleBookId, string> = {
  "sales-register": "14.1",
  "purchases-register": "8.1",
  "general-journal": "5.1",
  "chart-of-accounts": "5.3",
  "general-ledger": "6.1",
  "cash-book": "1.1",
};

export const BOOK_IDS = Object.keys(BOOK_CODES) as PleBookId[];

export function isPleBookId(value: string): value is PleBookId {
  return (BOOK_IDS as string[]).includes(value);
}

/** Field delimiter ("palote", ASCII 124). */
export const FIELD_SEPARATOR = "|";
/** Record terminator: every line ends with a delimiter followed by CRLF (to validate). */
export const RECORD_TERMINATOR = "\r\n";
/** Default file encoding. The PLE program expects ANSI; UTF-8 is risky with accents. */
export const FILE_ENCODING = "windows-1252";

/** Operations indicator (file name position 30). */
export const OPERATIONS_INDICATOR = {
  operating: "1",
  bookClosed: "2",
  businessClosed: "0",
} as const;

/** Currency indicator (position 32). */
export const CURRENCY_INDICATOR = { pen: "1", usd: "2" } as const;
/** Generated-by indicator (position 33): 1 = PLE program, 2 = SUNAT portal. */
export const GENERATED_BY_INDICATOR = "1";

/** Currency code of table 4 used by this ERP (only soles are supported). */
export const CURRENCY_CODE = "PEN";

/** Code of the chart of accounts in table 17: 01 = PCGE. */
export const CHART_OF_ACCOUNTS_CODE = "01";

/** Boletas at or above this amount (S/) must identify the customer and be detailed. */
export const BOLETA_DETAIL_THRESHOLD = 700;

/** Months after the issue date in which a purchase still keeps its tax credit (status 6 vs 7). */
export const PURCHASE_CREDIT_WINDOW_MONTHS = 12;

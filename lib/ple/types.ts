import type { PleBookId } from "./constants";

export type FieldKind =
  | "text"
  | "alphanumeric"
  | "numeric"
  | "money"
  | "rate"
  | "date"
  /** Structured data (book code & period & CUO & line): keeps the ampersand separator. */
  | "structured";

/** Value a book builder can hand to the serializer for one field. */
export type FieldValue = string | number | null | undefined;

export interface FieldDef {
  /** 1-based position inside the SUNAT structure. */
  index: number;
  key: string;
  label: string;
  kind: FieldKind;
  /** Maximum length (characters). Not enforced for money/rate/date fields. */
  maxLength: number;
  required: boolean;
}

export type IssueSeverity = "error" | "warning";

export interface PleIssue {
  severity: IssueSeverity;
  book: PleBookId;
  /** Human readable reference of the record (voucher, entry code, account). */
  record: string;
  /** SUNAT field index when the issue is about a single field. */
  field?: number;
  message: string;
}

/** One output record: values keyed by `FieldDef.key` plus a reference for messages. */
export interface PleRecord {
  ref: string;
  values: Record<string, FieldValue>;
}

export interface BookDefinition {
  id: PleBookId;
  /** Fields in SUNAT order. Only these are emitted (free-use fields are omitted). */
  fields: readonly FieldDef[];
}

export type PleTotals = Record<string, number>;

export interface PleColumn {
  index: number;
  label: string;
}

export interface PleResult {
  book: PleBookId;
  fileName: string;
  content: string;
  recordCount: number;
  /** Column headers (SUNAT field index and label). */
  columns: PleColumn[];
  /** Serialized cells of every record, same order as the TXT lines. */
  rows: string[][];
  totals: PleTotals;
  issues: PleIssue[];
  hasErrors: boolean;
}

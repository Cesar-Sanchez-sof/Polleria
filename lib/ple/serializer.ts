import { FIELD_SEPARATOR } from "./constants";
import { formatDate, formatMoney, formatRate, sanitizeText } from "./format";
import type { BookDefinition, FieldDef, FieldValue, PleIssue, PleRecord } from "./types";

/** Collects issues for one book while serializing. */
export class IssueCollector {
  readonly issues: PleIssue[] = [];

  constructor(private readonly book: PleIssue["book"]) {}

  error(record: string, message: string, field?: number): void {
    this.issues.push({ severity: "error", book: this.book, record, field, message });
  }

  warning(record: string, message: string, field?: number): void {
    this.issues.push({ severity: "warning", book: this.book, record, field, message });
  }

  get hasErrors(): boolean {
    return this.issues.some((issue) => issue.severity === "error");
  }
}

function isEmpty(value: FieldValue): boolean {
  return value === null || value === undefined || value === "";
}

/** Converts one value to its TXT representation applying the field rules. */
export function serializeField(
  field: FieldDef,
  value: FieldValue,
  record: string,
  collector: IssueCollector
): string {
  if (isEmpty(value)) {
    if (field.required) {
      collector.error(record, `Required field "${field.label}" is empty.`, field.index);
    }
    return "";
  }

  switch (field.kind) {
    case "money": {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        collector.error(record, `"${field.label}" is not a valid amount.`, field.index);
        return "";
      }
      return formatMoney(numeric);
    }
    case "rate": {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        collector.error(record, `"${field.label}" must be a positive rate.`, field.index);
        return "";
      }
      return formatRate(numeric);
    }
    case "date": {
      const formatted = formatDate(String(value));
      if (!formatted) {
        collector.error(record, `"${field.label}" is not a valid date.`, field.index);
      }
      return formatted;
    }
    case "numeric": {
      const text = String(value);
      if (!/^\d+$/.test(text)) {
        collector.error(record, `"${field.label}" must be numeric.`, field.index);
        return "";
      }
      if (text.length > field.maxLength) {
        collector.error(
          record,
          `"${field.label}" exceeds ${field.maxLength} characters.`,
          field.index
        );
      }
      return text;
    }
    case "structured": {
        const text = String(value).replace(/[|\x00-\x1f\x7f]/g, " ").trim();
      if (text.length > field.maxLength) {
        collector.error(
          record,
          `"${field.label}" exceeds ${field.maxLength} characters.`,
          field.index
        );
      }
      return text;
    }
    case "alphanumeric":
    case "text":
    default: {
      const { text, truncated } = sanitizeText(String(value), field.maxLength);
      if (truncated) {
        collector.warning(
          record,
          `"${field.label}" was truncated to ${field.maxLength} characters.`,
          field.index
        );
      }
      if (!text && field.required) {
        collector.error(record, `Required field "${field.label}" is empty.`, field.index);
      }
      return text;
    }
  }
}

/** Serialized cells of one record (validated), in SUNAT field order. */
export function serializeCells(
  definition: BookDefinition,
  record: PleRecord,
  collector: IssueCollector
): string[] {
  return definition.fields.map((field) =>
    serializeField(field, record.values[field.key], record.ref, collector)
  );
}

/** Joins cells into one TXT line: separated and terminated by the delimiter. */
export function joinCells(cells: readonly string[]): string {
  return cells.join(FIELD_SEPARATOR) + FIELD_SEPARATOR;
}

export function serializeRecord(
  definition: BookDefinition,
  record: PleRecord,
  collector: IssueCollector
): string {
  return joinCells(serializeCells(definition, record, collector));
}

export function serializeRecords(
  definition: BookDefinition,
  records: readonly PleRecord[],
  collector: IssueCollector
): string[] {
  return records.map((record) => serializeRecord(definition, record, collector));
}

import type { PleColumn } from "./types";

function escapeCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Review copy of a book as CSV (comma separated, CRLF, header with the SUNAT field labels).
 * It is not a SUNAT file: SUNAT only accepts the pipe-delimited TXT.
 */
export function buildCsv(columns: readonly PleColumn[], rows: readonly string[][]): string {
  const header = columns.map((column) => escapeCell(`${column.index}. ${column.label}`));
  const lines = [header, ...rows.map((row) => row.map(escapeCell))];
  return lines.map((line) => line.join(",")).join("\r\n") + "\r\n";
}

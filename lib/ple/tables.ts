/** SUNAT code tables used by the supported books (Annex 3 of RS 286-2009/SUNAT). */

/** Table 10: voucher types. */
export const VOUCHER_TYPE = {
  other: "00",
  invoice: "01",
  receipt: "03",
  creditNote: "07",
  debitNote: "08",
} as const;

/** Table 2: identity document types. */
export const IDENTITY_DOC = {
  noRuc: "0",
  dni: "1",
  foreignCard: "4",
  ruc: "6",
  passport: "7",
} as const;

/** Maps the ERP voucher label ("Factura", "Boleta", ...) to table 10. */
export function voucherTypeCode(label: string): string {
  const normalized = label.trim().toLowerCase();
  if (normalized === "factura") return VOUCHER_TYPE.invoice;
  if (normalized === "boleta") return VOUCHER_TYPE.receipt;
  if (normalized.startsWith("nota de cr")) return VOUCHER_TYPE.creditNote;
  if (normalized.startsWith("nota de d")) return VOUCHER_TYPE.debitNote;
  return VOUCHER_TYPE.other;
}

/** Infers the table 2 code from a document number (11 digits = RUC, 8 = DNI). */
export function identityDocFromNumber(
  documentNumber: string | null | undefined
): { type: string; number: string } | null {
  const digits = (documentNumber ?? "").trim();
  // Placeholder documents ("00000000") mean "no document".
  if (/^0+$/.test(digits)) return null;
  if (/^\d{11}$/.test(digits)) return { type: IDENTITY_DOC.ruc, number: digits };
  if (/^\d{8}$/.test(digits)) return { type: IDENTITY_DOC.dni, number: digits };
  return null;
}

/** Only invoices give tax credit in the purchases register of this ERP. */
export function givesTaxCredit(voucherType: string): boolean {
  return voucherType === VOUCHER_TYPE.invoice;
}

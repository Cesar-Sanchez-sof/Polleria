import type { PayableInvoice } from "@/lib/services/accounting-payables.service";

export type PayableStatusFilter = "todos" | "Pendiente" | "Parcial" | "Pagado";

export interface PayablesFilters {
  search: string;
  status: PayableStatusFilter;
  onlyOverdue: boolean;
  sortOrder: "desc" | "asc";
}

export const DEFAULT_PAYABLES_FILTERS: PayablesFilters = {
  search: "",
  status: "todos",
  onlyOverdue: false,
  sortOrder: "desc",
};

/** Aplica búsqueda, estado, vencidos y orden por fecha de emisión. */
export function filterPayables(invoices: PayableInvoice[], f: PayablesFilters): PayableInvoice[] {
  const q = f.search.trim().toLowerCase();
  return invoices
    .filter((inv) => {
      if (f.status !== "todos" && inv.status !== f.status) return false;
      if (f.onlyOverdue && !inv.isOverdue) return false;
      if (q) {
        return (
          inv.voucherLabel.toLowerCase().includes(q) ||
          inv.supplier.businessName.toLowerCase().includes(q) ||
          inv.supplier.ruc.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      const timeA = new Date(a.issuedAt).getTime();
      const timeB = new Date(b.issuedAt).getTime();
      return f.sortOrder === "desc" ? timeB - timeA : timeA - timeB;
    });
}

export function exportPayablesCsv(filtered: PayableInvoice[]) {
  const headers = [
    "Fecha Emisión",
    "Tipo Comprobante",
    "Serie",
    "Número",
    "RUC Proveedor",
    "Razón Social Proveedor",
    "Cuenta Contable",
    "Total Comprobante",
    "Monto Amortizado",
    "Saldo Pendiente",
    "Estado de Pago",
    "Días Antigüedad",
    "Vencido (>30d)",
    "Asientos Contables",
  ];

  const rows = filtered.map((inv) => [
    inv.issuedAt.split("T")[0],
    inv.voucherType,
    inv.series,
    inv.number,
    `"${inv.supplier.ruc}"`,
    `"${inv.supplier.businessName.replace(/"/g, '""')}"`,
    "4212 Cuentas por Pagar Comerciales",
    inv.totalAmount.toFixed(2),
    inv.totalPaid.toFixed(2),
    inv.pendingBalance.toFixed(2),
    inv.status,
    inv.daysOpen,
    inv.isOverdue ? "SÍ" : "NO",
    `"${inv.journalEntries.map((je) => je.code).join(", ")}"`,
  ]);

  const csvContent =
    "data:text/csv;charset=utf-8,\uFEFF" +
    [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `cuentas_por_pagar_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

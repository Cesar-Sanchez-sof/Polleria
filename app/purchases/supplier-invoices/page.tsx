import React from "react";
import {
  getPurchaseVouchers,
  getReceiptsWithoutVoucher,
  getPaymentTypes,
} from "@/lib/services/purchases/invoices";
import { VouchersTable } from "@/components/purchases/invoices/VouchersTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Supplier Invoices & Vouchers | Purchases",
};

export default async function SupplierInvoicesPage() {
  const [vouchers, receipts, paymentTypes] = await Promise.all([
    getPurchaseVouchers(),
    getReceiptsWithoutVoucher(),
    getPaymentTypes(),
  ]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Comprobantes y Facturas de Supplier</h1>
        <p className="text-sm text-muted-foreground">
          Registra las facturas o boletas asociadas a las recepciones de mercadería y gestiona los pagos efectuados a proveedores.
        </p>
      </div>

      <VouchersTable
        initialVouchers={JSON.parse(JSON.stringify(vouchers))}
        receiptsWithoutVoucher={JSON.parse(JSON.stringify(receipts))}
        paymentTypes={JSON.parse(JSON.stringify(paymentTypes))}
      />
    </div>
  );
}

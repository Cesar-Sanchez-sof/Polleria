import React from "react";
import { FileText } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
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
    <>
      <ModuleHeader
        title="Comprobantes y Facturas de Proveedor"
        subtitle="Registra facturas/boletas y gestiona pagos a proveedores"
        icon={FileText}
        iconClassName="bg-violet-100 text-violet-800"
      />
      <main className="relative flex-1 w-full min-w-0 p-3 sm:p-4 md:p-6">
        <div className="flex flex-col w-full gap-5">
          <VouchersTable
            initialVouchers={JSON.parse(JSON.stringify(vouchers))}
            receiptsWithoutVoucher={JSON.parse(JSON.stringify(receipts))}
            paymentTypes={JSON.parse(JSON.stringify(paymentTypes))}
          />
        </div>
      </main>
    </>
  );
}

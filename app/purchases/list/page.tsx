import React from "react";
import { FileText } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { getPurchaseVouchers, getPaymentTypes } from "@/lib/services/purchases/invoices";
import { PurchasesTable } from "@/components/purchases/list/PurchasesTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Listar Compras | Purchases",
};

export default async function ListPurchasesPage() {
  const [invoices, paymentTypes] = await Promise.all([
    getPurchaseVouchers(),
    getPaymentTypes(),
  ]);

  return (
    <>
      <ModuleHeader
        title="Listar Compras"
        subtitle="Historial de compras registradas y estado de pagos"
        icon={FileText}
        iconClassName="bg-blue-100 text-blue-800"
      />
      <main className="relative flex-1 w-full min-w-0 p-3 sm:p-4 md:p-6">
        <div className="flex flex-col w-full gap-5">
          <PurchasesTable
            initialInvoices={JSON.parse(JSON.stringify(invoices))}
            paymentTypes={JSON.parse(JSON.stringify(paymentTypes))}
          />
        </div>
      </main>
    </>
  );
}

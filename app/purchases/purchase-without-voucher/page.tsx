import React from "react";
import { Receipt } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { getSupplies } from "@/lib/services/purchases/supply";
import { getPurchasesWithoutVoucher } from "@/lib/services/purchases/purchase-without-voucher";
import { PurchaseWithoutVoucherForm } from "@/components/purchases/manual-entry/PurchaseWithoutVoucherForm";
import { PurchasesWithoutVoucherTable } from "@/components/purchases/manual-entry/PurchasesWithoutVoucherTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Small Purchase Without Voucher | Purchases",
};

export default async function PurchaseWithoutVoucherPage() {
  const [supplies, purchases] = await Promise.all([
    getSupplies(),
    getPurchasesWithoutVoucher(),
  ]);

  return (
    <>
      <ModuleHeader
        title="Compra Menor Sin Comprobante"
        subtitle="Compras informales de bajo monto que ingresan directo al inventario"
        icon={Receipt}
        iconClassName="bg-teal-100 text-teal-800"
      />
      <main className="relative flex-1 w-full min-w-0 p-3 sm:p-4 md:p-6">
        <div className="flex flex-col w-full gap-5">
          <PurchaseWithoutVoucherForm supplies={JSON.parse(JSON.stringify(supplies))} />
          <PurchasesWithoutVoucherTable purchases={JSON.parse(JSON.stringify(purchases))} />
        </div>
      </main>
    </>
  );
}

import React from "react";
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
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Compra Menor Sin Comprobante</h1>
        <p className="text-sm text-muted-foreground">
          Registra compras informales de insumos de bajo monto que ingresan directamente al inventario sin requerir factura o boleta formal.
        </p>
      </div>

      <PurchaseWithoutVoucherForm supplies={JSON.parse(JSON.stringify(supplies))} />

      <PurchasesWithoutVoucherTable purchases={JSON.parse(JSON.stringify(purchases))} />
    </div>
  );
}

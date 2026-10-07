import React from "react";
import { ShoppingCart } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { getSuppliers } from "@/lib/services/purchases/supplier";
import { getSupplies } from "@/lib/services/purchases/supply";
import { getPaymentTypes } from "@/lib/services/purchases/invoices";
import { PurchaseOrderForm } from "@/components/purchases/add/PurchaseOrderForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Añadir Compra Unificada | Compras",
};

export default async function AddPurchaseOrderPage() {
  const [suppliers, supplies, paymentTypes] = await Promise.all([
    getSuppliers(),
    getSupplies(),
    getPaymentTypes(),
  ]);

  return (
    <>
      <ModuleHeader
        title="Añadir Compra Unificada"
        subtitle="Registra el proveedor, comprobante, insumos y método de pago en una sola transacción"
        icon={ShoppingCart}
        iconClassName="bg-amber-100 text-amber-800"
      />
      <main className="relative flex-1 w-full min-w-0 p-3 sm:p-4 md:p-6">
        <div className="flex flex-col w-full gap-5">
          <PurchaseOrderForm
            initialSuppliers={JSON.parse(JSON.stringify(suppliers))}
            initialSupplies={JSON.parse(JSON.stringify(supplies))}
            paymentTypes={JSON.parse(JSON.stringify(paymentTypes))}
          />
        </div>
      </main>
    </>
  );
}

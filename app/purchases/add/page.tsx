import React from "react";
import { ShoppingCart } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { getSuppliers } from "@/lib/services/purchases/supplier";
import { getSupplies } from "@/lib/services/purchases/supply";
import { PurchaseOrderForm } from "@/components/purchases/add/PurchaseOrderForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Add Purchase Order | Purchases",
};

export default async function AddPurchaseOrderPage() {
  const [suppliers, supplies] = await Promise.all([
    getSuppliers(),
    getSupplies(),
  ]);

  return (
    <>
      <ModuleHeader
        title="Nueva Orden de Compra"
        subtitle="Selecciona un proveedor e ingresa el detalle de los insumos a solicitar"
        icon={ShoppingCart}
        iconClassName="bg-amber-100 text-amber-800"
      />
      <main className="relative flex-1 w-full min-w-0 p-3 sm:p-4 md:p-6">
        <div className="flex flex-col w-full gap-5">
          <PurchaseOrderForm
            initialSuppliers={JSON.parse(JSON.stringify(suppliers))}
            initialSupplies={JSON.parse(JSON.stringify(supplies))}
          />
        </div>
      </main>
    </>
  );
}

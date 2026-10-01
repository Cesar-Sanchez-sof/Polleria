import React from "react";
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
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Generar Nueva Orden de Compra</h1>
        <p className="text-sm text-muted-foreground">
          Selecciona un proveedor e ingresa el detalle de los insumos a solicitar. La orden iniciará en estado 'Pendiente'.
        </p>
      </div>

      <PurchaseOrderForm
        initialSuppliers={JSON.parse(JSON.stringify(suppliers))}
        initialSupplies={JSON.parse(JSON.stringify(supplies))}
      />
    </div>
  );
}

import React from "react";
import { getSupplies } from "@/lib/services/purchases/supply";
import { InventoryTable } from "@/components/purchases/inventory/InventoryTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Supplies Inventory | Purchases",
};

export default async function InventoryPage() {
  const supplies = await getSupplies();

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Kardex e Inventario de Insumos</h1>
        <p className="text-sm text-muted-foreground">
          Visualiza los stocks actuales de materias primas y productos terminados. El stock se actualiza automáticamente mediante movimientos de Kardex.
        </p>
      </div>

      <InventoryTable initialSupplies={JSON.parse(JSON.stringify(supplies))} />
    </div>
  );
}

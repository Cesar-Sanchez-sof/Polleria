import React from "react";
import { Boxes } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { getSupplies } from "@/lib/services/purchases/supply";
import { InventoryTable } from "@/components/purchases/inventory/InventoryTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Supplies Inventory | Purchases",
};

export default async function InventoryPage() {
  const supplies = await getSupplies();

  return (
    <>
      <ModuleHeader
        title="Kardex e Inventario de Insumos"
        subtitle="Stocks de materias primas y productos terminados"
        icon={Boxes}
        iconClassName="bg-emerald-100 text-emerald-800"
      />
      <main className="relative flex-1 w-full min-w-0 p-3 sm:p-4 md:p-6">
        <div className="flex flex-col w-full gap-5">
          <InventoryTable initialSupplies={JSON.parse(JSON.stringify(supplies))} />
        </div>
      </main>
    </>
  );
}

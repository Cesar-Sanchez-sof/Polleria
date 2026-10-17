import React from "react";
import { Boxes } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { getProducts } from "@/lib/services/purchases/product";
import { InventoryTable } from "@/components/purchases/inventory/InventoryTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Kardex e Inventario | Compras",
};

export default async function InventoryPage() {
  const products = await getProducts();

  return (
    <>
      <ModuleHeader
        title="Kardex e Inventario"
        subtitle="Stocks de materias primas y productos terminados"
        icon={Boxes}
        iconClassName="bg-emerald-100 text-emerald-800"
      />
      <main className="relative flex-1 w-full min-w-0 p-3 sm:p-4 md:p-6">
        <div className="flex flex-col w-full gap-5">
          <InventoryTable initialProducts={JSON.parse(JSON.stringify(products))} />
        </div>
      </main>
    </>
  );
}

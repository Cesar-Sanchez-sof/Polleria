import React from "react";
import { PackageCheck } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { getOrdersForReceiving } from "@/lib/services/purchases/receiving";
import { ReceivingTable } from "@/components/purchases/receiving/ReceivingTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Purchase Receiving | Purchases",
};

export default async function ReceivingPage() {
  const orders = await getOrdersForReceiving();

  return (
    <>
      <ModuleHeader
        title="Recepción de Mercadería"
        subtitle="Ingresa recepciones de órdenes de compra; actualiza el inventario automáticamente"
        icon={PackageCheck}
        iconClassName="bg-sky-100 text-sky-800"
      />
      <main className="relative flex-1 w-full min-w-0 p-3 sm:p-4 md:p-6">
        <div className="flex flex-col w-full gap-5">
          <ReceivingTable initialOrders={JSON.parse(JSON.stringify(orders))} />
        </div>
      </main>
    </>
  );
}

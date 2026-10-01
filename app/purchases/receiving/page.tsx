import React from "react";
import { getOrdersForReceiving } from "@/lib/services/purchases/receiving";
import { ReceivingTable } from "@/components/purchases/receiving/ReceivingTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Purchase Receiving | Purchases",
};

export default async function ReceivingPage() {
  const orders = await getOrdersForReceiving();

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recepción de Mercadería / Compras</h1>
        <p className="text-sm text-muted-foreground">
          Ingresa la recepción de las órdenes de compra emitidas a proveedores. La recepción genera automáticamente los movimientos de ingreso en el inventario.
        </p>
      </div>

      <ReceivingTable initialOrders={JSON.parse(JSON.stringify(orders))} />
    </div>
  );
}

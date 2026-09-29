import React from "react";
import { obtenerOrdenesParaRecepcion } from "@/lib/services/compras/recepcion";
import { TablaRecepcion } from "@/components/compras/recepcion/TablaRecepcion";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Recepción de Compra | Compras",
};

export default async function RecepcionPage() {
  const ordenes = await obtenerOrdenesParaRecepcion();

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recepción de Mercadería / Compras</h1>
        <p className="text-sm text-muted-foreground">
          Ingresa la recepción de las órdenes de compra emitidas a proveedores. La recepción genera automáticamente los movimientos de ingreso en el inventario.
        </p>
      </div>

      <TablaRecepcion initialOrdenes={JSON.parse(JSON.stringify(ordenes))} />
    </div>
  );
}

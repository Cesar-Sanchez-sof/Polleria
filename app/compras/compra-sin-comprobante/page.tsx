import React from "react";
import { obtenerInsumos } from "@/lib/services/compras/insumo";
import { obtenerComprasSinComprobante } from "@/lib/services/compras/compra-sin-comprobante";
import { FormularioCompraSinComprobante } from "@/components/compras/asiento-manual/FormularioCompraSinComprobante";
import { TablaComprasSinComprobante } from "@/components/compras/asiento-manual/TablaComprasSinComprobante";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Compra Menor Sin Comprobante | Compras",
};

export default async function CompraSinComprobantePage() {
  const [insumos, compras] = await Promise.all([
    obtenerInsumos(),
    obtenerComprasSinComprobante(),
  ]);

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Compra Menor Sin Comprobante</h1>
        <p className="text-sm text-muted-foreground">
          Registra compras informales de insumos de bajo monto que ingresan directamente al inventario sin requerir factura o boleta formal.
        </p>
      </div>

      <FormularioCompraSinComprobante insumos={JSON.parse(JSON.stringify(insumos))} />

      <TablaComprasSinComprobante compras={JSON.parse(JSON.stringify(compras))} />
    </div>
  );
}

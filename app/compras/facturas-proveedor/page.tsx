import React from "react";
import {
  obtenerComprobantesCompra,
  obtenerRecepcionesSinComprobante,
  obtenerTiposPago,
} from "@/lib/services/compras/facturas";
import { TablaComprobantes } from "@/components/compras/facturas/TablaComprobantes";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Facturas y Comprobantes de Proveedor | Compras",
};

export default async function FacturasProveedorPage() {
  const [comprobantes, recepciones, tiposPago] = await Promise.all([
    obtenerComprobantesCompra(),
    obtenerRecepcionesSinComprobante(),
    obtenerTiposPago(),
  ]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Comprobantes y Facturas de Proveedor</h1>
        <p className="text-sm text-muted-foreground">
          Registra las facturas o boletas asociadas a las recepciones de mercadería y gestiona los pagos efectuados a proveedores.
        </p>
      </div>

      <TablaComprobantes
        initialComprobantes={JSON.parse(JSON.stringify(comprobantes))}
        recepcionesSinComprobante={JSON.parse(JSON.stringify(recepciones))}
        tiposPago={JSON.parse(JSON.stringify(tiposPago))}
      />
    </div>
  );
}

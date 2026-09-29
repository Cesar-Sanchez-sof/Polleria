import React from "react";
import { obtenerProveedores } from "@/lib/services/compras/proveedor";
import { obtenerInsumos } from "@/lib/services/compras/insumo";
import { FormularioOrdenCompra } from "@/components/compras/anadir/FormularioOrdenCompra";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Añadir Orden de Compra | Compras",
};

export default async function AnadirCompraPage() {
  const [proveedores, insumos] = await Promise.all([
    obtenerProveedores(),
    obtenerInsumos(),
  ]);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Generar Nueva Orden de Compra</h1>
        <p className="text-sm text-muted-foreground">
          Selecciona un proveedor e ingresa el detalle de los insumos a solicitar. La orden iniciará en estado 'Pendiente'.
        </p>
      </div>

      <FormularioOrdenCompra
        initialProveedores={JSON.parse(JSON.stringify(proveedores))}
        initialInsumos={JSON.parse(JSON.stringify(insumos))}
      />
    </div>
  );
}
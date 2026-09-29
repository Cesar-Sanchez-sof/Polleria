import React from "react";
import { obtenerInsumos } from "@/lib/services/compras/insumo";
import { TablaInventario } from "@/components/compras/inventario/TablaInventario";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Inventario de Insumos | Compras",
};

export default async function InventarioPage() {
  const insumos = await obtenerInsumos();

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Kardex e Inventario de Insumos</h1>
        <p className="text-sm text-muted-foreground">
          Visualiza los stocks actuales de materias primas y productos terminados. El stock se actualiza automáticamente mediante movimientos de Kardex.
        </p>
      </div>

      <TablaInventario initialInsumos={JSON.parse(JSON.stringify(insumos))} />
    </div>
  );
}
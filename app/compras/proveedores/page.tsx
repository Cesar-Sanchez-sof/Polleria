import React from "react";
import { obtenerProveedores } from "@/lib/services/compras/proveedor";
import { TablaProveedores } from "@/components/compras/proveedores/TablaProveedores";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Gestión de Proveedores | Compras",
};

export default async function ProveedoresPage() {
  const proveedores = await obtenerProveedores();

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gestión de Proveedores</h1>
        <p className="text-sm text-muted-foreground">
          Administra el catálogo de proveedores y sus datos de contacto.
        </p>
      </div>

      <TablaProveedores initialProveedores={JSON.parse(JSON.stringify(proveedores))} />
    </div>
  );
}

import React from "react";
import { getSuppliers } from "@/lib/services/purchases/supplier";
import { SuppliersTable } from "@/components/purchases/suppliers/SuppliersTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Supplier Management | Purchases",
};

export default async function SuppliersPage() {
  const suppliers = await getSuppliers();

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gestión de Proveedores</h1>
        <p className="text-sm text-muted-foreground">
          Administra el catálogo de proveedores y sus datos de contacto.
        </p>
      </div>

      <SuppliersTable initialSuppliers={JSON.parse(JSON.stringify(suppliers))} />
    </div>
  );
}

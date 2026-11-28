import React from "react";
import { getSuppliers } from "@/lib/services/purchases/supplier";
import { SuppliersTable } from "@/components/purchases/suppliers/SuppliersTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Gestión de Proveedores | Purchases",
};

export default async function SuppliersPage() {
  const suppliers = await getSuppliers();

  return (
    <SuppliersTable initialSuppliers={JSON.parse(JSON.stringify(suppliers))} />
  );
}

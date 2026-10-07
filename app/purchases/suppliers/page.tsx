import React from "react";
import { Users } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { getSuppliers } from "@/lib/services/purchases/supplier";
import { getPurchaseVouchers } from "@/lib/services/purchases/invoices";
import { SuppliersTable } from "@/components/purchases/suppliers/SuppliersTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Gestión de Proveedores | Purchases",
};

export default async function SuppliersPage() {
  const [suppliers, vouchers] = await Promise.all([
    getSuppliers(),
    getPurchaseVouchers().catch(() => []),
  ]);

  return (
    <>
      <ModuleHeader
        title="Gestión de Proveedores"
        subtitle="Catálogo de proveedores y datos de contacto"
        icon={Users}
        iconClassName="bg-blue-100 text-blue-800"
      />
      <main className="relative flex-1 w-full min-w-0 p-3 sm:p-4 md:p-6">
        <div className="flex flex-col w-full gap-5">
          <SuppliersTable
            initialSuppliers={JSON.parse(JSON.stringify(suppliers))}
            vouchers={JSON.parse(JSON.stringify(vouchers))}
          />
        </div>
      </main>
    </>
  );
}

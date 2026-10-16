import React from "react";
import { LayoutDashboard } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { getPurchaseVouchers } from "@/lib/services/purchases/invoices";
import { getSuppliers } from "@/lib/services/purchases/supplier";
import { getSupplies } from "@/lib/services/purchases/supply";
import { getTransformations } from "@/lib/services/purchases/transformation";
import { PurchasesDashboard } from "@/components/purchases/dashboard/PurchasesDashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard | Compras",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = (value: unknown): any => JSON.parse(JSON.stringify(value));

export default async function PurchasesDashboardPage() {
  const [invoices, supplies, suppliers, transformations] = await Promise.all([
    getPurchaseVouchers().catch(() => []),
    getSupplies().catch(() => []),
    getSuppliers().catch(() => []),
    getTransformations().catch(() => []),
  ]);

  return (
    <>
      <ModuleHeader
        title="Dashboard de Compras"
        subtitle="Resumen de compras, inventario, proveedores y transformación"
        icon={LayoutDashboard}
        iconClassName="bg-blue-100 text-blue-800"
      />
      <main className="relative flex-1 w-full min-w-0 p-3 sm:p-4 md:p-6">
        <PurchasesDashboard
          invoices={json(invoices)}
          supplies={json(supplies)}
          suppliers={json(suppliers)}
          transformations={json(transformations)}
        />
      </main>
    </>
  );
}

import React from "react";
import Link from "next/link";
import { FileText, Plus, Receipt } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { getPurchaseVouchers, getPaymentTypes } from "@/lib/services/purchases/invoices";
import { getSuppliers } from "@/lib/services/purchases/supplier";
import { getSupplies } from "@/lib/services/purchases/supply";
import { getPurchasesWithoutVoucher } from "@/lib/services/purchases/purchase-without-voucher";
import { PurchasesTable } from "@/components/purchases/list/PurchasesTable";
import { PurchaseOrderForm } from "@/components/purchases/add/PurchaseOrderForm";
import { PurchaseWithoutVoucherForm } from "@/components/purchases/manual-entry/PurchaseWithoutVoucherForm";
import { PurchasesWithoutVoucherTable } from "@/components/purchases/manual-entry/PurchasesWithoutVoucherTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Compras | Purchases",
};

const TABS = [
  { key: "list", label: "Compras registradas", icon: FileText },
  { key: "add", label: "Añadir compra", icon: Plus },
  { key: "informal", label: "Sin comprobante", icon: Receipt },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = (value: unknown): any => JSON.parse(JSON.stringify(value));

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: rawTab } = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : "list";

  let content: React.ReactNode;
  if (tab === "add") {
    const [suppliers, supplies, paymentTypes] = await Promise.all([
      getSuppliers(),
      getSupplies(),
      getPaymentTypes(),
    ]);
    content = (
      <PurchaseOrderForm
        initialSuppliers={json(suppliers)}
        initialSupplies={json(supplies)}
        paymentTypes={json(paymentTypes)}
      />
    );
  } else if (tab === "informal") {
    const [supplies, purchases] = await Promise.all([getSupplies(), getPurchasesWithoutVoucher()]);
    content = (
      <>
        <PurchaseWithoutVoucherForm supplies={json(supplies)} />
        <PurchasesWithoutVoucherTable purchases={json(purchases)} />
      </>
    );
  } else {
    const [invoices, paymentTypes] = await Promise.all([getPurchaseVouchers(), getPaymentTypes()]);
    content = <PurchasesTable initialInvoices={json(invoices)} paymentTypes={json(paymentTypes)} />;
  }

  return (
    <>
      <ModuleHeader
        title="Compras"
        subtitle="Historial, registro de compras con comprobante y compras menores sin comprobante"
        icon={FileText}
        iconClassName="bg-blue-100 text-blue-800"
      />
      <main className="relative flex-1 w-full min-w-0 p-3 sm:p-4 md:p-6">
        <div className="flex flex-col w-full gap-5">
          <nav className="flex flex-wrap gap-1 border-b border-border" aria-label="Vistas de compras">
            {TABS.map(({ key, label, icon: Icon }) => (
              <Link
                key={key}
                href={`/purchases/list?tab=${key}`}
                aria-current={tab === key ? "page" : undefined}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                  tab === key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
          {content}
        </div>
      </main>
    </>
  );
}

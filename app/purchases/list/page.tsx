import React from "react";
import { FileText } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { getPurchaseVouchers, getPaymentTypes } from "@/lib/services/purchases/invoices";
import { getSuppliers } from "@/lib/services/purchases/supplier";
import { getProducts } from "@/lib/services/purchases/product";
import { getPurchasesWithoutVoucher } from "@/lib/services/purchases/purchase-without-voucher";
import { PurchasesTable } from "@/components/purchases/list/PurchasesTable";
import { PurchasesViewTabs } from "@/components/purchases/list/PurchasesViewTabs";
import { PurchaseOrderForm } from "@/components/purchases/add/PurchaseOrderForm";
import { PurchaseWithoutVoucherForm } from "@/components/purchases/manual-entry/PurchaseWithoutVoucherForm";
import { PurchasesWithoutVoucherTable } from "@/components/purchases/manual-entry/PurchasesWithoutVoucherTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Compras | Purchases",
};

const TAB_KEYS = ["list", "add", "informal"] as const;

type TabKey = (typeof TAB_KEYS)[number];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = (value: unknown): any => JSON.parse(JSON.stringify(value));

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: rawTab } = await searchParams;
  const tab: TabKey = TAB_KEYS.some((key) => key === rawTab) ? (rawTab as TabKey) : "list";

  let content: React.ReactNode;
  if (tab === "add") {
    const [suppliers, products, paymentTypes] = await Promise.all([
      getSuppliers(),
      getProducts(),
      getPaymentTypes(),
    ]);
    content = (
      <PurchaseOrderForm
        initialSuppliers={json(suppliers)}
        initialProducts={json(products)}
        paymentTypes={json(paymentTypes)}
      />
    );
  } else if (tab === "informal") {
    const [products, purchases] = await Promise.all([getProducts(), getPurchasesWithoutVoucher()]);
    content = (
      <>
        <PurchaseWithoutVoucherForm products={json(products)} />
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
      >
        <PurchasesViewTabs active={tab} />
      </ModuleHeader>
      <main className="relative flex-1 w-full min-w-0 p-3 sm:p-4 md:p-6">
        <div className="flex flex-col w-full gap-5">
          {content}
        </div>
      </main>
    </>
  );
}

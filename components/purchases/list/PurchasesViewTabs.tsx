"use client";

import { useRouter } from "next/navigation";
import { FileText, Plus, Receipt } from "lucide-react";
import { SegmentedTabs, type SegmentedTabItem } from "@/components/shared/SegmentedTabs";

export type PurchasesViewKey = "list" | "add" | "informal";

const ITEMS: SegmentedTabItem<PurchasesViewKey>[] = [
  { value: "list", label: "Compras registradas", icon: <FileText />, tone: "brand" },
  { value: "add", label: "Añadir compra", icon: <Plus />, tone: "brand" },
  { value: "informal", label: "Sin comprobante", icon: <Receipt />, tone: "brand" },
];

/** View switcher of the purchases module: keeps the active view in the `?tab=` query parameter. */
export function PurchasesViewTabs({ active }: Readonly<{ active: PurchasesViewKey }>) {
  const router = useRouter();

  return (
    <SegmentedTabs
      items={ITEMS}
      value={active}
      onValueChange={(view) => router.push(`/purchases/list?tab=${view}`)}
      ariaLabel="Vistas de compras"
      className="max-w-full overflow-x-auto"
    />
  );
}

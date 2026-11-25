import React from "react";
import { getProducts } from "@/lib/services/purchases/product";
import { InventoryTable } from "@/components/purchases/inventory/InventoryTable";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Kardex e Inventario | Compras",
};

export default async function InventoryPage() {
  const products = await getProducts();

  return (
    <InventoryTable initialProducts={JSON.parse(JSON.stringify(products))} />
  );
}
